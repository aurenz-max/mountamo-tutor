"""
Curriculum Graph Agent Service — First-Class Agentic Orchestrator

The core "natively agentic" service. Orchestrates graph analysis,
suggestion generation, and the approval workflow. Initialized at app
startup and wired into EdgeManager as an event-driven mutation hook.

Authority model: Agent suggests, humans approve. No auto-commit.

Event flow:
  EdgeManager.create_edge() -> on_graph_mutation() -> analyze_graph()
  EdgeManager.delete_edge() -> on_graph_mutation() -> analyze_graph()

Suggestion lifecycle:
  generate_suggestions() -> stored in Firestore -> author reviews ->
  accept_suggestion() -> creates draft edge via EdgeManager ->
  author publishes -> Pulse picks up new graph

Storage:
  curriculum_graphs/{grade}/subjects/{subject_id}/suggestions/{suggestion_id}
  curriculum_graphs/{grade}/subjects/{subject_id}/edges/{edge_id}
"""

import logging
from datetime import datetime
from typing import Dict, List, Optional, Any

from app.db.firestore_curriculum_service import firestore_curriculum_sync
from app.db.firestore_curriculum_reader import firestore_reader
from app.models.edges import CurriculumEdgeCreate
from app.models.suggestions import (
    EdgeSuggestion, GraphHealthReport, GraphHealthMetrics,
    SuggestionImpact,
)
from app.services.edge_manager import EdgeManager
from app.services.graph_cache_manager import GraphCacheManager
from app.services.graph_analysis import GraphAnalysisEngine
from app.services.suggestion_engine import SuggestionEngine

logger = logging.getLogger(__name__)


class CurriculumGraphAgentService:
    """
    First-class agentic service for curriculum knowledge graph analysis.

    Initialized at app startup. Provides:
      - Graph health analysis (cached, event-driven refresh)
      - Connection suggestion generation (Gemini-powered)
      - Suggestion approval workflow
      - Event hook for graph mutations
    """

    def __init__(
        self,
        edge_manager: EdgeManager,
        graph_cache: GraphCacheManager,
        suggestion_engine: SuggestionEngine,
        analysis_engine: GraphAnalysisEngine,
        firestore_client: Optional[Any] = None,
    ):
        self.edges = edge_manager
        self.cache = graph_cache
        self.suggestions_engine = suggestion_engine
        self.analysis = analysis_engine
        self.firestore = firestore_client

        # In-memory health report cache (invalidated on mutation)
        self._health_cache: Dict[str, GraphHealthReport] = {}

    # ------------------------------------------------------------------ #
    #  Health Analysis
    # ------------------------------------------------------------------ #

    async def analyze_graph(self, subject_id: str) -> GraphHealthReport:
        """Run full structural analysis. Cached until next mutation."""
        if subject_id in self._health_cache:
            cached = self._health_cache[subject_id]
            # Use cache if < 5 minutes old
            age = (datetime.utcnow() - cached.computed_at).total_seconds()
            if age < 300:
                return cached

        graph = await self.cache.get_graph(subject_id, include_drafts=True)
        nodes, edges_list = graph.nodes, graph.edges

        metrics = self.analysis.compute_health_metrics(nodes, edges_list)
        score = self.analysis.compute_health_score(metrics)
        anomalies = self.analysis.detect_anomalies(nodes, edges_list, metrics)

        pending = await firestore_reader.get_suggestions_for_subject(subject_id, status="pending")
        pending_count = len(pending)

        report = GraphHealthReport(
            subject_id=subject_id,
            health_score=score,
            metrics=metrics,
            anomalies=anomalies,
            suggestions_count=pending_count,
            computed_at=datetime.utcnow(),
        )

        self._health_cache[subject_id] = report

        # Persist to Firestore graph doc for dashboard access
        await self._cache_health_report(subject_id, report)

        logger.info(
            f"Graph health for {subject_id}: {score}/10 "
            f"({len(anomalies)} anomalies, {pending_count} pending suggestions)"
        )

        return report

    # ------------------------------------------------------------------ #
    #  Suggestion Generation
    # ------------------------------------------------------------------ #

    async def suggest_connections(
        self,
        subject_id: str,
        max_suggestions: int = 0,
    ) -> List[EdgeSuggestion]:
        """Generate and store new edge suggestions.

        max_suggestions: 0 = no limit (return all valid suggestions).
        Clears all previous pending suggestions before storing the new batch.
        """
        graph = await self.cache.get_graph(subject_id, include_drafts=True)

        suggestions = await self.suggestions_engine.generate_suggestions(
            subject_id, graph.nodes, graph.edges, max_suggestions
        )

        # Clear previous suggestions
        await firestore_curriculum_sync.delete_all_suggestions(subject_id)

        # Store in hierarchical subcollection
        for suggestion in suggestions:
            data = suggestion.model_dump(mode="json")
            data["status"] = "pending"
            data["origin"] = "bulk"
            data["created_at"] = datetime.utcnow().isoformat()
            await firestore_curriculum_sync.sync_suggestion(subject_id, data)

        logger.info(f"Generated and stored {len(suggestions)} suggestions for {subject_id}")
        return suggestions

    # ------------------------------------------------------------------ #
    #  Approval Workflow
    # ------------------------------------------------------------------ #

    async def accept_suggestion(
        self,
        subject_id: str,
        suggestion_id: str,
    ) -> CurriculumEdgeCreate:
        """Accept a suggestion: create draft edge + mark accepted."""
        suggestion_data = await firestore_reader.get_suggestion(subject_id, suggestion_id)
        if not suggestion_data:
            raise ValueError(f"Suggestion {suggestion_id} not found")

        suggestion_data.setdefault("subject_id", subject_id)
        suggestion_data.setdefault("rationale", "")
        suggestion_data.setdefault("confidence", 0.0)
        suggestion = EdgeSuggestion(**suggestion_data)

        edge = CurriculumEdgeCreate(
            source_entity_id=suggestion.source_entity_id,
            source_entity_type="subskill",
            target_entity_id=suggestion.target_entity_id,
            target_entity_type="subskill",
            relationship=suggestion.relationship,
            strength=suggestion.strength,
            is_prerequisite=suggestion.is_prerequisite,
            min_proficiency_threshold=suggestion.threshold,
            rationale=suggestion.rationale,
            authored_by="agent",
            confidence=suggestion.confidence,
        )

        from app.services.version_control import version_control
        version_id = await version_control.get_or_create_active_version(
            subject_id, "agent"
        )

        await self.edges.create_edge(edge, version_id, subject_id)
        await firestore_curriculum_sync.update_suggestion(
            subject_id, suggestion_id, {
                "status": "accepted",
                "reviewed_at": datetime.utcnow().isoformat(),
            }
        )

        # Invalidate caches
        self._health_cache.pop(subject_id, None)
        try:
            await self.cache.invalidate_cache(subject_id, "draft")
        except Exception:
            pass

        logger.info(f"Accepted suggestion {suggestion_id} -> created draft edge")
        return edge

    async def bulk_accept_all(self, subject_id: str) -> Dict:
        """Accept all pending suggestions in bulk via EdgeManager (Firestore-native).

        Creates draft edges for all pending suggestions, marks them accepted.
        Uses EdgeManager.create_edge() so edges go to the correct hierarchical
        subcollection with proper validation.
        """
        from app.services.version_control import version_control

        version_id = await version_control.get_or_create_active_version(
            subject_id, "agent"
        )

        suggestions_data = await firestore_reader.get_suggestions_for_subject(
            subject_id, status="pending"
        )
        if not suggestions_data:
            return {"accepted": 0, "message": "No pending suggestions"}

        logger.info(f"Bulk accepting {len(suggestions_data)} suggestions for {subject_id}")

        edges_created = 0
        parallel_reverses = 0
        accepted_ids = []

        for s in suggestions_data:
            s.setdefault("subject_id", subject_id)
            s.setdefault("rationale", "")
            s.setdefault("confidence", 0.0)
            suggestion = EdgeSuggestion(**s)
            edge = CurriculumEdgeCreate(
                source_entity_id=suggestion.source_entity_id,
                source_entity_type="subskill",
                target_entity_id=suggestion.target_entity_id,
                target_entity_type="subskill",
                relationship=suggestion.relationship,
                strength=suggestion.strength,
                is_prerequisite=suggestion.is_prerequisite,
                min_proficiency_threshold=suggestion.threshold,
                rationale=suggestion.rationale,
                authored_by="agent",
                confidence=suggestion.confidence,
            )

            await self.edges.create_edge(edge, version_id, subject_id)
            edges_created += 1
            if suggestion.relationship == "parallel":
                parallel_reverses += 1

            accepted_ids.append((suggestion.suggestion_id, {
                "status": "accepted",
                "reviewed_at": datetime.utcnow().isoformat(),
                "reviewed_by": "bulk_accept",
            }))

        # Batch-update suggestion statuses
        await firestore_curriculum_sync.batch_update_suggestions(subject_id, accepted_ids)

        # Invalidate caches
        self._health_cache.pop(subject_id, None)
        try:
            await self.cache.invalidate_cache(subject_id, "draft")
        except Exception:
            pass

        result = {
            "accepted": len(suggestions_data),
            "edges_created": edges_created + parallel_reverses,
            "parallel_reverses": parallel_reverses,
            "version_id": version_id,
        }
        logger.info(f"Bulk accept complete: {result}")
        return result

    async def reject_suggestion(
        self,
        subject_id: str,
        suggestion_id: str,
    ) -> None:
        """Reject a suggestion."""
        await firestore_curriculum_sync.update_suggestion(
            subject_id, suggestion_id, {
                "status": "rejected",
                "reviewed_at": datetime.utcnow().isoformat(),
            }
        )
        logger.info(f"Rejected suggestion {suggestion_id}")

    # ------------------------------------------------------------------ #
    #  Event Hook (called by EdgeManager on mutation)
    # ------------------------------------------------------------------ #

    async def on_graph_mutation(self, subject_id: str, event_type: str) -> None:
        """Event hook: called after edge create/delete.

        Invalidates cached health report and triggers lightweight re-analysis.
        Does NOT trigger full suggestion generation (that's explicit).
        """
        logger.info(f"Graph mutation ({event_type}) for {subject_id} — re-analyzing")
        self._health_cache.pop(subject_id, None)

        try:
            await self.analyze_graph(subject_id)
        except Exception as e:
            logger.warning(f"Post-mutation analysis failed (non-blocking): {e}")

    # ------------------------------------------------------------------ #
    #  Impact Preview
    # ------------------------------------------------------------------ #

    async def preview_all_pending(self, subject_id: str) -> SuggestionImpact:
        """Preview cumulative impact if all pending suggestions are accepted."""
        graph = await self.cache.get_graph(subject_id, include_drafts=True)
        suggestions_data = await firestore_reader.get_suggestions_for_subject(
            subject_id, status="pending"
        )

        proposed_edges = [
            {
                "source": s.get("source_entity_id"),
                "target": s.get("target_entity_id"),
                "relationship": s.get("relationship"),
                "strength": s.get("strength"),
                "is_prerequisite": s.get("is_prerequisite"),
            }
            for s in suggestions_data
        ]

        return self.analysis.compute_impact(
            graph.nodes, graph.edges, proposed_edges
        )

    # ------------------------------------------------------------------ #
    #  Bulk Reclassification (domain-agnostic)
    # ------------------------------------------------------------------ #

    async def reclassify_suggestions(
        self,
        subject_id: str,
        rules: Dict,
    ) -> Dict:
        """Reclassify pending suggestions using curriculum-derived domain context.

        Reads unit titles from the actual curriculum to determine domain grouping,
        rather than hardcoded prefix maps. Works for any subject (math, language arts, etc.).

        Rules dict controls the reclassification thresholds:
          - combo_promote_threshold: float (default 0.76) — Tier 1 cutoff
          - combo_drop_threshold: float (default 0.60) — Tier 3 cutoff
          - redundancy_cap: int (default 2) — max gated targets per source
        """
        from collections import defaultdict

        # Build domain map from actual curriculum structure
        nodes = await firestore_reader.get_subject_graph_nodes(subject_id, include_drafts=True)
        node_domain: Dict[str, str] = {}  # entity_id -> unit_title (as domain)
        node_unit: Dict[str, str] = {}    # entity_id -> unit_id
        for n in nodes:
            node_domain[n["id"]] = n.get("unit_title", "Unknown")
            node_unit[n["id"]] = n.get("unit_id", "")

        combo_promote = rules.get("combo_promote_threshold", 0.76)
        combo_drop = rules.get("combo_drop_threshold", 0.60)
        redundancy_cap = rules.get("redundancy_cap", 2)

        grade = await firestore_reader.resolve_grade(subject_id)
        if not grade:
            return {"error": f"Cannot resolve grade for {subject_id}"}

        suggestions_data = await firestore_reader.get_suggestions_for_subject(
            subject_id, status="pending"
        )
        logger.info(f"Reclassifying {len(suggestions_data)} pending suggestions for {subject_id}")

        # Phase 1: classify each suggestion
        actions = []  # (suggestion_id, update_fields, action_label)
        promotions_by_source = defaultdict(list)

        for data in suggestions_data:
            suggestion_id = data.get("suggestion_id", "")
            rel = data.get("relationship", "")
            is_prereq = data.get("is_prerequisite", False)

            # Only reclassify non-prerequisite types that have is_prerequisite=true
            if rel == "prerequisite" or not is_prereq:
                actions.append((suggestion_id, {}, "unchanged"))
                continue

            strength = data.get("strength", 0)
            confidence = data.get("confidence", 0)
            combo = strength * confidence

            src_id = data.get("source_entity_id", "")
            tgt_id = data.get("target_entity_id", "")
            same_unit = node_unit.get(src_id) == node_unit.get(tgt_id)

            if combo >= combo_promote:
                # Tier 1: promote
                actions.append((suggestion_id, {"relationship": "prerequisite"}, "promote_t1"))
                promotions_by_source[src_id].append((suggestion_id, combo, tgt_id))
            elif combo < combo_drop:
                # Tier 3: drop gate
                actions.append((suggestion_id, {"is_prerequisite": False, "threshold": None}, "drop_t3"))
            elif same_unit:
                # Tier 2 same-unit: promote
                actions.append((suggestion_id, {"relationship": "prerequisite"}, "promote_t2_same"))
                promotions_by_source[src_id].append((suggestion_id, combo, tgt_id))
            else:
                # Tier 2 cross-unit: drop gate (no hardcoded strong/weak paths)
                actions.append((suggestion_id, {"is_prerequisite": False, "threshold": None}, "drop_t2_cross"))

        # Phase 2: redundancy cap — demote excess fan-out
        demote_ids = set()
        for src_id, targets in promotions_by_source.items():
            if len(targets) <= redundancy_cap:
                continue
            targets.sort(key=lambda x: -x[1])  # Sort by combo descending
            for sid, combo, tgt_id in targets[redundancy_cap:]:
                demote_ids.add(sid)
                logger.info(f"  Redundancy cap: {src_id} -> {tgt_id} (combo={combo:.2f})")

        # Phase 3: build batch updates
        updates = []
        stats = defaultdict(int)

        for suggestion_id, update_fields, label in actions:
            if not update_fields:
                stats["unchanged"] += 1
                continue

            # Check redundancy demotion
            if suggestion_id in demote_ids:
                update_fields = {"is_prerequisite": False, "threshold": None}
                label = "demote_redundancy"

            update_fields["reviewed_at"] = datetime.utcnow().isoformat()
            update_fields["reviewed_by"] = "reclassify_agent"

            updates.append((suggestion_id, update_fields))
            stats[label] += 1

        # Batch write
        await firestore_curriculum_sync.batch_update_suggestions(subject_id, updates, grade=grade)

        # Invalidate caches
        self._health_cache.pop(subject_id, None)

        summary = {
            "total": len(suggestions_data),
            "promoted": stats.get("promote_t1", 0) + stats.get("promote_t2_same", 0),
            "gates_dropped": stats.get("drop_t3", 0) + stats.get("drop_t2_cross", 0) + stats.get("demote_redundancy", 0),
            "unchanged": stats.get("unchanged", 0),
            "detail": dict(stats),
        }

        logger.info(f"Reclassification complete: {summary}")
        return summary

    # ------------------------------------------------------------------ #
    #  Health Report Cache
    # ------------------------------------------------------------------ #

    async def _cache_health_report(self, subject_id: str, report: GraphHealthReport) -> None:
        """Cache health report on the graph subject doc for dashboard access."""
        grade = await firestore_reader.resolve_grade(subject_id)
        if not grade:
            return
        try:
            graph_ref = firestore_curriculum_sync._graph_ref(grade, subject_id)
            graph_ref.set(
                {"health_report": report.model_dump(mode="json"),
                 "subject_id": subject_id, "grade": grade},
                merge=True,
            )
        except Exception as e:
            logger.error(f"Failed to cache health report: {e}")
