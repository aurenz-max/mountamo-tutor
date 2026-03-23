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
"""

import logging
from datetime import datetime
from typing import Dict, List, Optional, Any

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

        pending_count = await self._count_pending_suggestions(subject_id)

        report = GraphHealthReport(
            subject_id=subject_id,
            health_score=score,
            metrics=metrics,
            anomalies=anomalies,
            suggestions_count=pending_count,
            computed_at=datetime.utcnow(),
        )

        self._health_cache[subject_id] = report

        # Persist to Firestore for dashboard access
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
        This prevents duplicates from accumulating across runs.
        """
        graph = await self.cache.get_graph(subject_id, include_drafts=True)

        suggestions = await self.suggestions_engine.generate_suggestions(
            subject_id, graph.nodes, graph.edges, max_suggestions
        )

        # Clear previous pending suggestions before storing new batch
        await self._clear_pending_suggestions(subject_id)

        # Store in Firestore
        for suggestion in suggestions:
            await self._store_suggestion(subject_id, suggestion)

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
        suggestion = await self._get_suggestion(subject_id, suggestion_id)
        if not suggestion:
            raise ValueError(f"Suggestion {suggestion_id} not found")

        edge = CurriculumEdgeCreate(
            source_entity_id=suggestion.source_entity_id,
            source_entity_type="subskill",  # Suggestions are subskill-level
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

        # Import version_control here to avoid circular imports
        from app.services.version_control import version_control
        version_id = await version_control.get_or_create_active_version(
            subject_id, "agent"
        )

        await self.edges.create_edge(edge, version_id, subject_id)
        await self._update_suggestion_status(
            subject_id, suggestion_id, "accepted"
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
        """Accept all pending suggestions in bulk — streaming BigQuery insert.

        Much faster than individual accept calls for large batches.
        Creates draft edges for all pending suggestions, marks them accepted.
        """
        import uuid
        from app.core.database import db
        from app.core.config import settings

        # Get version once
        from app.services.version_control import version_control
        version_id = await version_control.get_or_create_active_version(
            subject_id, "agent"
        )

        suggestions = await self._list_pending_suggestions(subject_id)
        if not suggestions:
            return {"accepted": 0, "message": "No pending suggestions"}

        logger.info(f"Bulk accepting {len(suggestions)} suggestions for {subject_id}")

        # Build all edge rows
        now = datetime.utcnow().isoformat()
        rows = []
        parallel_reverses = []

        for s in suggestions:
            edge_id = str(uuid.uuid4())
            pair_id = str(uuid.uuid4()) if s.relationship == "parallel" else None

            row = {
                "edge_id": edge_id,
                "subject_id": subject_id,
                "source_entity_id": s.source_entity_id,
                "source_entity_type": "subskill",
                "target_entity_id": s.target_entity_id,
                "target_entity_type": "subskill",
                "relationship": s.relationship,
                "strength": s.strength,
                "is_prerequisite": s.is_prerequisite,
                "min_proficiency_threshold": s.threshold,
                "rationale": s.rationale,
                "authored_by": "agent",
                "confidence": s.confidence,
                "version_id": version_id,
                "is_draft": True,
                "created_at": now,
                "updated_at": now,
                "pair_id": pair_id,
            }
            rows.append(row)

            # Auto-create reverse for parallel edges
            if s.relationship == "parallel":
                parallel_reverses.append({
                    **row,
                    "edge_id": str(uuid.uuid4()),
                    "source_entity_id": s.target_entity_id,
                    "target_entity_id": s.source_entity_id,
                    "is_prerequisite": False,
                })

        all_rows = rows + parallel_reverses

        # Streaming insert to BigQuery (batches of 500)
        batch_size = 500
        for i in range(0, len(all_rows), batch_size):
            batch = all_rows[i:i + batch_size]
            success = await db.insert_rows(settings.TABLE_EDGES, batch)
            if not success:
                logger.error(f"BigQuery batch insert failed at offset {i}")
                return {"error": f"BigQuery insert failed at batch {i // batch_size}"}
            logger.info(f"  Inserted batch {i // batch_size + 1} ({len(batch)} rows)")

        # Mark all suggestions as accepted in Firestore
        coll = self._suggestions_collection(subject_id)
        if coll:
            batch_writer = self.firestore.batch()
            batch_count = 0
            for s in suggestions:
                batch_writer.update(coll.document(s.suggestion_id), {
                    "status": "accepted",
                    "reviewed_at": datetime.utcnow().isoformat(),
                    "reviewed_by": "bulk_accept",
                })
                batch_count += 1
                if batch_count >= 450:
                    batch_writer.commit()
                    batch_writer = self.firestore.batch()
                    batch_count = 0
            if batch_count > 0:
                batch_writer.commit()

        # Invalidate caches
        self._health_cache.pop(subject_id, None)
        try:
            await self.cache.invalidate_cache(subject_id, "draft")
        except Exception:
            pass

        result = {
            "accepted": len(suggestions),
            "edges_created": len(all_rows),
            "parallel_reverses": len(parallel_reverses),
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
        await self._update_suggestion_status(
            subject_id, suggestion_id, "rejected"
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
        suggestions = await self._list_pending_suggestions(subject_id)

        proposed_edges = [
            {
                "source": s.source_entity_id,
                "target": s.target_entity_id,
                "relationship": s.relationship,
                "strength": s.strength,
                "is_prerequisite": s.is_prerequisite,
            }
            for s in suggestions
        ]

        return self.analysis.compute_impact(
            graph.nodes, graph.edges, proposed_edges
        )

    # ------------------------------------------------------------------ #
    #  Firestore persistence helpers
    # ------------------------------------------------------------------ #

    def _suggestions_collection(self, subject_id: str):
        """Get Firestore collection ref for suggestions."""
        if not self.firestore:
            return None
        return self.firestore.collection("edge_suggestions").document(subject_id).collection("pending")

    async def _store_suggestion(self, subject_id: str, suggestion: EdgeSuggestion) -> None:
        """Store a suggestion in Firestore."""
        coll = self._suggestions_collection(subject_id)
        if not coll:
            logger.warning("No Firestore client — suggestion not persisted")
            return
        try:
            coll.document(suggestion.suggestion_id).set(suggestion.model_dump(mode="json"))
        except Exception as e:
            logger.error(f"Failed to store suggestion: {e}")

    async def _get_suggestion(self, subject_id: str, suggestion_id: str) -> Optional[EdgeSuggestion]:
        """Retrieve a suggestion from Firestore."""
        coll = self._suggestions_collection(subject_id)
        if not coll:
            return None
        try:
            doc = coll.document(suggestion_id).get()
            if doc.exists:
                return EdgeSuggestion(**doc.to_dict())
        except Exception as e:
            logger.error(f"Failed to get suggestion: {e}")
        return None

    async def _update_suggestion_status(
        self, subject_id: str, suggestion_id: str, status: str
    ) -> None:
        """Update suggestion status in Firestore."""
        coll = self._suggestions_collection(subject_id)
        if not coll:
            return
        try:
            coll.document(suggestion_id).update({
                "status": status,
                "reviewed_at": datetime.utcnow().isoformat(),
            })
        except Exception as e:
            logger.error(f"Failed to update suggestion status: {e}")

    async def _clear_pending_suggestions(self, subject_id: str) -> int:
        """Delete all pending suggestions for a subject.

        Called before storing a new batch to prevent duplicates.
        """
        coll = self._suggestions_collection(subject_id)
        if not coll:
            return 0
        try:
            docs = list(coll.stream())
            count = 0
            for doc in docs:
                doc.reference.delete()
                count += 1
            logger.info(f"Cleared {count} previous suggestions for {subject_id}")
            return count
        except Exception as e:
            logger.error(f"Failed to clear suggestions: {e}")
            return 0

    async def _list_pending_suggestions(self, subject_id: str) -> List[EdgeSuggestion]:
        """List all pending suggestions for a subject."""
        coll = self._suggestions_collection(subject_id)
        if not coll:
            return []
        try:
            docs = coll.where("status", "==", "pending").stream()
            return [EdgeSuggestion(**doc.to_dict()) for doc in docs]
        except Exception as e:
            logger.error(f"Failed to list suggestions: {e}")
            return []

    async def _count_pending_suggestions(self, subject_id: str) -> int:
        """Count pending suggestions."""
        suggestions = await self._list_pending_suggestions(subject_id)
        return len(suggestions)

    # ------------------------------------------------------------------ #
    #  Bulk Reclassification
    # ------------------------------------------------------------------ #

    async def reclassify_suggestions(
        self,
        subject_id: str,
        rules: Dict,
    ) -> Dict:
        """Reclassify pending suggestions in a single Firestore transaction.

        Rules dict controls the reclassification thresholds:
          - combo_promote_threshold: float (default 0.76) — Tier 1 cutoff
          - combo_drop_threshold: float (default 0.60) — Tier 3 cutoff
          - strong_domain_paths: set of (src_domain, tgt_domain) tuples
          - weak_domain_paths: set of (src_domain, tgt_domain) tuples
          - redundancy_cap: int (default 2) — max gated targets per source

        Returns summary dict with counts and per-suggestion actions.
        """
        from collections import defaultdict

        UNIT_DOMAINS = {
            "COUNT": "NumSense", "OPS": "NumSense",
            "MEAS": "MeasData", "GEOM": "Geometry",
            "PTRN": "Patterns", "TIME": "Time",
        }

        def get_domain(eid):
            prefix = eid.split("001")[0]
            return UNIT_DOMAINS.get(prefix, "Unknown")

        def get_unit(eid):
            return eid.split("-")[0]

        combo_promote = rules.get("combo_promote_threshold", 0.76)
        combo_drop = rules.get("combo_drop_threshold", 0.60)
        strong_paths = rules.get("strong_domain_paths", set())
        weak_paths = rules.get("weak_domain_paths", set())
        redundancy_cap = rules.get("redundancy_cap", 2)

        coll = self._suggestions_collection(subject_id)
        if not coll:
            return {"error": "No Firestore client"}

        docs = list(coll.where("status", "==", "pending").stream())
        logger.info(f"Reclassifying {len(docs)} pending suggestions for {subject_id}")

        # Phase 1: classify each suggestion
        actions = []  # (doc_ref, update_fields, action_label)
        promotions_by_source = defaultdict(list)

        for doc in docs:
            data = doc.to_dict()
            rel = data.get("relationship", "")
            is_prereq = data.get("is_prerequisite", False)

            # Only reclassify non-prerequisite types that have is_prerequisite=true
            if rel == "prerequisite" or not is_prereq:
                actions.append((doc.reference, {}, "unchanged"))
                continue

            strength = data.get("strength", 0)
            confidence = data.get("confidence", 0)
            combo = strength * confidence

            src_id = data.get("source_entity_id", "")
            tgt_id = data.get("target_entity_id", "")
            same_unit = get_unit(src_id) == get_unit(tgt_id)
            domain_path = (get_domain(src_id), get_domain(tgt_id))

            if combo >= combo_promote:
                # Tier 1: promote
                actions.append((doc.reference, {"relationship": "prerequisite"}, "promote_t1"))
                promotions_by_source[src_id].append((doc.reference, combo, tgt_id))
            elif combo < combo_drop:
                # Tier 3: drop gate
                actions.append((doc.reference, {"is_prerequisite": False, "threshold": None}, "drop_t3"))
            elif same_unit:
                # Tier 2 same-unit: promote
                actions.append((doc.reference, {"relationship": "prerequisite"}, "promote_t2_same"))
                promotions_by_source[src_id].append((doc.reference, combo, tgt_id))
            elif domain_path in strong_paths and combo >= 0.63:
                # Tier 2 strong cross-unit: promote
                actions.append((doc.reference, {"relationship": "prerequisite"}, "promote_t2_cross"))
                promotions_by_source[src_id].append((doc.reference, combo, tgt_id))
            else:
                # Tier 2 weak cross-unit: drop gate
                actions.append((doc.reference, {"is_prerequisite": False, "threshold": None}, "drop_t2_weak"))

        # Phase 2: redundancy cap — demote excess fan-out
        demote_refs = set()
        for src_id, targets in promotions_by_source.items():
            if len(targets) <= redundancy_cap:
                continue
            targets.sort(key=lambda x: -x[1])  # Sort by combo descending
            for ref, combo, tgt_id in targets[redundancy_cap:]:
                demote_refs.add(ref.id)
                logger.info(f"  Redundancy cap: {src_id} -> {tgt_id} (combo={combo:.2f})")

        # Phase 3: apply in batched transaction
        batch = self.firestore.batch()
        batch_count = 0
        stats = defaultdict(int)

        for doc_ref, update_fields, label in actions:
            if not update_fields:
                stats["unchanged"] += 1
                continue

            # Check redundancy demotion
            if doc_ref.id in demote_refs:
                update_fields = {"is_prerequisite": False, "threshold": None}
                label = "demote_redundancy"

            update_fields["reviewed_at"] = datetime.utcnow().isoformat()
            update_fields["reviewed_by"] = "reclassify_agent"

            batch.update(doc_ref, update_fields)
            batch_count += 1
            stats[label] += 1

            # Firestore batch limit is 500
            if batch_count >= 450:
                batch.commit()
                logger.info(f"  Committed batch of {batch_count}")
                batch = self.firestore.batch()
                batch_count = 0

        if batch_count > 0:
            batch.commit()
            logger.info(f"  Committed final batch of {batch_count}")

        # Invalidate caches
        self._health_cache.pop(subject_id, None)

        summary = {
            "total": len(docs),
            "promoted": stats.get("promote_t1", 0) + stats.get("promote_t2_same", 0) + stats.get("promote_t2_cross", 0),
            "gates_dropped": stats.get("drop_t3", 0) + stats.get("drop_t2_weak", 0) + stats.get("demote_redundancy", 0),
            "unchanged": stats.get("unchanged", 0),
            "detail": dict(stats),
        }

        logger.info(f"Reclassification complete: {summary}")
        return summary

    async def _cache_health_report(self, subject_id: str, report: GraphHealthReport) -> None:
        """Cache health report in Firestore for dashboard access."""
        if not self.firestore:
            return
        try:
            self.firestore.collection("graph_health").document(subject_id).set(
                report.model_dump(mode="json")
            )
        except Exception as e:
            logger.error(f"Failed to cache health report: {e}")
