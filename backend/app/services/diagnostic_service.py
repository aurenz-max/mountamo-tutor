"""
Diagnostic Placement Service — Session Orchestrator

Manages the full diagnostic placement flow:
  1. Create session: load DAGs, compute metrics, select initial probes
  2. Record probe results: classify, propagate inference, select next probes
  3. Complete session: seed mastery lifecycle, recalculate unlocks
  4. Query session state: for resume, parent view, knowledge profile

Uses DAGAnalysisEngine for all pure algorithm work.
Persists session state to Firestore at diagnostic_sessions/{session_id}.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from ..db.firestore_service import FirestoreService
from ..models.diagnostic import (
    DIAGNOSTIC_COMPLETION_MAP,
    DIAGNOSTIC_COVERAGE_TARGET,
    DIAGNOSTIC_GATE_MAP,
    DIAGNOSTIC_PASS_THRESHOLD,
    CompletionResponse,
    DiagnosticSession,
    DiagnosticSessionState,
    DiagnosticStatus,
    KnowledgeProfileResponse,
    ProbeRequest,
    ProbeResultResponse,
    SubjectSummary,
    SubskillClassification,
)
from ..models.mastery_lifecycle import GateHistoryEntry, MasteryLifecycle
from ..services.dag_analysis import DAGAnalysisEngine
from ..services.learning_paths import LearningPathsService
from ..services.mastery_lifecycle_engine import MasteryLifecycleEngine

logger = logging.getLogger(__name__)


class DiagnosticService:
    """
    Diagnostic Placement Engine — session orchestrator.

    Wraps the stateless DAGAnalysisEngine with Firestore persistence
    and mastery lifecycle seeding.
    """

    def __init__(
        self,
        firestore_service: FirestoreService,
        learning_paths_service: LearningPathsService,
        mastery_lifecycle_engine: MasteryLifecycleEngine,
    ):
        self.firestore = firestore_service
        self.learning_paths = learning_paths_service
        self.mastery_engine = mastery_lifecycle_engine

    # ------------------------------------------------------------------
    # Session creation
    # ------------------------------------------------------------------

    async def create_session(
        self,
        student_id: int,
        subjects: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Create a new diagnostic session.

        1. Load DAGs for requested subjects
        2. Merge all subskill nodes + edges
        3. Compute topological metrics
        4. Select initial probe points (midpoints of longest chains)
        5. Persist session to Firestore
        6. Return session_id + initial probes

        Args:
            student_id: The student being assessed
            subjects: List of subject IDs (e.g., ["MATHEMATICS", "LANGUAGE_ARTS"]).
                      None = all available subjects.
        """
        session_id = f"diag_{uuid.uuid4().hex[:12]}"
        logger.info(
            f"Creating diagnostic session {session_id} for student {student_id}"
        )

        # Resolve subjects
        if not subjects:
            subjects = await self.learning_paths._get_available_subjects()
        logger.info(f"Diagnostic subjects: {subjects}")

        # Load and merge graphs
        all_nodes: List[Dict] = []
        all_edges: List[Dict] = []
        for subject in subjects:
            try:
                graph_data = await self.learning_paths._get_graph(subject)
                graph = graph_data.get("graph", {})
                nodes = graph.get("nodes", [])
                edges = graph.get("edges", [])
                # Filter to subskills only (we probe at subskill level)
                subskill_nodes = [
                    n for n in nodes
                    if n.get("type") == "subskill"
                    or n.get("entity_type") == "subskill"
                ]
                # Filter edges to only include subskill-to-subskill
                subskill_ids = {n["id"] for n in subskill_nodes}
                subskill_edges = [
                    e for e in edges
                    if e["source"] in subskill_ids and e["target"] in subskill_ids
                ]
                all_nodes.extend(subskill_nodes)
                all_edges.extend(subskill_edges)
                logger.info(
                    f"  {subject}: {len(subskill_nodes)} subskills, "
                    f"{len(subskill_edges)} edges"
                )
            except ValueError as e:
                logger.warning(f"Skipping subject {subject}: {e}")
                continue

        if not all_nodes:
            raise ValueError("No curriculum subskills found for the requested subjects")

        # Topological sort + metrics
        topo_order = DAGAnalysisEngine.topological_sort(all_nodes, all_edges)
        metrics = DAGAnalysisEngine.compute_node_metrics(
            all_nodes, all_edges, topo_order,
        )

        # Select initial probes
        initial_probes = DAGAnalysisEngine.select_initial_probes(
            metrics, all_nodes, all_edges, max_probes=5,
        )

        # Initialize classifications (all UNKNOWN)
        classifications: Dict[str, SubskillClassification] = {}
        for node in all_nodes:
            nid = node["id"]
            classifications[nid] = SubskillClassification(
                subskill_id=nid,
                subject=node.get("subject", ""),
                skill_id=node.get("skill_id", ""),
                status=DiagnosticStatus.UNKNOWN,
            )

        # Build session
        session = DiagnosticSession(
            session_id=session_id,
            student_id=student_id,
            subjects=subjects,
            classifications={
                k: v.model_dump() for k, v in classifications.items()
            },
            total_nodes=len(all_nodes),
            classified_count=0,
            probed_count=0,
            coverage_pct=0.0,
            cached_edges=all_edges,
            node_metrics={k: v.model_dump() for k, v in metrics.items()},
        )

        # Persist
        await self.firestore.save_diagnostic_session(
            session_id, session.model_dump(),
        )

        logger.info(
            f"Diagnostic session {session_id} created: "
            f"{len(all_nodes)} subskills, {len(initial_probes)} initial probes"
        )

        return {
            "session_id": session_id,
            "student_id": student_id,
            "subjects": subjects,
            "total_nodes": len(all_nodes),
            "probes": [p.model_dump() for p in initial_probes],
        }

    # ------------------------------------------------------------------
    # Probe result recording
    # ------------------------------------------------------------------

    async def record_probe_result(
        self,
        session_id: str,
        subskill_id: str,
        score: float,
        items_completed: int = 3,
    ) -> ProbeResultResponse:
        """
        Record a probe result, run inference, return next probes or completion.

        Args:
            session_id: The diagnostic session
            subskill_id: The subskill that was probed
            score: Aggregate probe score (0-1). >= 0.75 = PASS.
            items_completed: Number of assessment items completed
        """
        # Load session
        session_data = await self.firestore.get_diagnostic_session(session_id)
        if not session_data:
            raise ValueError(f"Diagnostic session {session_id} not found")

        if session_data.get("state") != DiagnosticSessionState.IN_PROGRESS:
            raise ValueError(f"Session {session_id} is not in progress")

        # Reconstruct classifications as SubskillClassification objects
        classifications: Dict[str, SubskillClassification] = {}
        for sid, cls_data in session_data.get("classifications", {}).items():
            classifications[sid] = SubskillClassification(**cls_data)

        edges = session_data.get("cached_edges", [])
        node_metrics_raw = session_data.get("node_metrics", {})
        metrics = {
            k: _metrics_from_dict(v)
            for k, v in node_metrics_raw.items()
        }

        # Classify the probed node
        passed = score >= DIAGNOSTIC_PASS_THRESHOLD
        now = datetime.now(timezone.utc).isoformat()

        if subskill_id not in classifications:
            raise ValueError(
                f"Subskill {subskill_id} not found in session {session_id}"
            )

        classifications[subskill_id].status = (
            DiagnosticStatus.PROBED_MASTERED if passed
            else DiagnosticStatus.PROBED_NOT_MASTERED
        )
        classifications[subskill_id].score = score
        classifications[subskill_id].items_completed = items_completed
        classifications[subskill_id].probed_at = now

        # Propagate inference
        classifications, inferences = DAGAnalysisEngine.propagate_inference(
            subskill_id, passed, edges, classifications,
        )

        # Compute coverage
        total_nodes = session_data.get("total_nodes", len(classifications))
        coverage = DAGAnalysisEngine.compute_coverage(classifications, total_nodes)
        classified_count = sum(
            1 for c in classifications.values()
            if c.status != DiagnosticStatus.UNKNOWN
        )
        probed_count = sum(
            1 for c in classifications.values()
            if c.status in (
                DiagnosticStatus.PROBED_MASTERED,
                DiagnosticStatus.PROBED_NOT_MASTERED,
            )
        )

        # Record in probe history
        probe_history = session_data.get("probe_history", [])
        probe_history.append({
            "subskill_id": subskill_id,
            "score": score,
            "passed": passed,
            "items_completed": items_completed,
            "inferences_count": len(inferences),
            "coverage_after": coverage,
            "timestamp": now,
        })

        # Determine status and next probes
        if coverage >= DIAGNOSTIC_COVERAGE_TARGET:
            status = "complete"
            next_probes = []
        else:
            # Reconstruct nodes list for probe selection
            nodes = [
                {
                    "id": sid,
                    "subject": cls.subject,
                    "skill_id": cls.skill_id,
                    "description": "",
                    "type": "subskill",
                }
                for sid, cls in classifications.items()
            ]
            next_probes = DAGAnalysisEngine.select_next_probes(
                metrics, nodes, edges, classifications,
                last_probed_id=subskill_id,
                last_passed=passed,
                max_probes=3,
            )
            status = "complete" if not next_probes else "continue"

        # Persist updated session
        await self.firestore.save_diagnostic_session(session_id, {
            "classifications": {
                k: v.model_dump() for k, v in classifications.items()
            },
            "classified_count": classified_count,
            "probed_count": probed_count,
            "coverage_pct": round(coverage * 100, 1),
            "probe_history": probe_history,
            "updated_at": now,
        })

        logger.info(
            f"Probe result for {subskill_id} in session {session_id}: "
            f"{'PASS' if passed else 'FAIL'} (score={score:.2f}), "
            f"{len(inferences)} inferences, coverage={coverage:.1%}"
        )

        return ProbeResultResponse(
            status=status,
            classified_count=classified_count,
            total_count=total_nodes,
            coverage_pct=round(coverage * 100, 1),
            probes=[p.model_dump() for p in next_probes],
            inferences_made=[i.model_dump() for i in inferences],
        )

    # ------------------------------------------------------------------
    # Session retrieval
    # ------------------------------------------------------------------

    async def get_session(self, session_id: str) -> Dict[str, Any]:
        """Load and return session document from Firestore."""
        session_data = await self.firestore.get_diagnostic_session(session_id)
        if not session_data:
            raise ValueError(f"Diagnostic session {session_id} not found")
        return session_data

    # ------------------------------------------------------------------
    # Knowledge profile
    # ------------------------------------------------------------------

    async def get_knowledge_profile(
        self, session_id: str,
    ) -> KnowledgeProfileResponse:
        """Build the knowledge profile summary from session classifications."""
        session_data = await self.firestore.get_diagnostic_session(session_id)
        if not session_data:
            raise ValueError(f"Diagnostic session {session_id} not found")

        classifications = {
            sid: SubskillClassification(**cls_data)
            for sid, cls_data in session_data.get("classifications", {}).items()
        }
        edges = session_data.get("cached_edges", [])

        # Per-subject summary
        by_subject: Dict[str, SubjectSummary] = {}
        for sid, cls in classifications.items():
            subj = cls.subject or "Unknown"
            if subj not in by_subject:
                by_subject[subj] = SubjectSummary(subject=subj)
            summary = by_subject[subj]
            summary.total_skills += 1

            if cls.status in (
                DiagnosticStatus.PROBED_MASTERED,
                DiagnosticStatus.INFERRED_MASTERED,
            ):
                summary.mastered += 1
            elif cls.status == DiagnosticStatus.UNKNOWN:
                summary.unknown += 1
            else:
                summary.not_mastered += 1

        for summary in by_subject.values():
            if summary.total_skills > 0:
                summary.mastery_pct = round(
                    summary.mastered / summary.total_skills * 100, 1,
                )

        # Frontier identification
        frontier = DAGAnalysisEngine.identify_frontier(classifications, edges)

        # Assign frontier skills to their subjects
        for sid in frontier:
            cls = classifications.get(sid)
            if cls and cls.subject in by_subject:
                by_subject[cls.subject].frontier_skills.append(sid)

        # Aggregate counts
        total_probed = sum(
            1 for c in classifications.values()
            if c.status in (
                DiagnosticStatus.PROBED_MASTERED,
                DiagnosticStatus.PROBED_NOT_MASTERED,
            )
        )
        total_inferred = sum(
            1 for c in classifications.values()
            if c.status in (
                DiagnosticStatus.INFERRED_MASTERED,
                DiagnosticStatus.INFERRED_NOT_MASTERED,
            )
        )

        return KnowledgeProfileResponse(
            session_id=session_data.get("session_id", session_id),
            student_id=session_data.get("student_id", 0),
            state=DiagnosticSessionState(
                session_data.get("state", "in_progress"),
            ),
            total_probed=total_probed,
            total_inferred=total_inferred,
            total_classified=total_probed + total_inferred,
            coverage_pct=session_data.get("coverage_pct", 0.0),
            by_subject={k: v.model_dump() for k, v in by_subject.items()},
            frontier_skills=frontier,
        )

    # ------------------------------------------------------------------
    # Session completion + mastery seeding
    # ------------------------------------------------------------------

    async def complete_session(
        self, session_id: str,
    ) -> CompletionResponse:
        """
        Finalize a diagnostic session and seed the mastery lifecycle.

        1. Build knowledge profile
        2. Seed mastery lifecycle for classified subskills
        3. Recalculate unlocks per subject
        4. Mark session as COMPLETED
        """
        session_data = await self.firestore.get_diagnostic_session(session_id)
        if not session_data:
            raise ValueError(f"Diagnostic session {session_id} not found")

        if session_data.get("state") != DiagnosticSessionState.IN_PROGRESS:
            raise ValueError(f"Session {session_id} is not in progress")

        student_id = session_data["student_id"]
        subjects = session_data.get("subjects", [])
        classifications = {
            sid: SubskillClassification(**cls_data)
            for sid, cls_data in session_data.get("classifications", {}).items()
        }

        # Seed mastery lifecycle
        seed_result = await self._seed_mastery_from_diagnostic(
            student_id, classifications,
        )

        # Recalculate unlocks for each subject
        for subject in subjects:
            try:
                await self.learning_paths.recalculate_unlocks(
                    student_id=student_id, subject_id=subject,
                )
                logger.info(f"Recalculated unlocks for {subject}")
            except Exception as e:
                logger.warning(
                    f"Failed to recalculate unlocks for {subject}: {e}"
                )

        # Mark session completed
        now = datetime.now(timezone.utc).isoformat()
        await self.firestore.save_diagnostic_session(session_id, {
            "state": DiagnosticSessionState.COMPLETED,
            "completed_at": now,
            "updated_at": now,
        })

        # Build knowledge profile for response
        profile = await self.get_knowledge_profile(session_id)

        logger.info(
            f"Diagnostic session {session_id} completed: "
            f"seeded {seed_result['seeded_count']} lifecycles, "
            f"{len(seed_result['frontier_skills'])} frontier skills"
        )

        return CompletionResponse(
            session_id=session_id,
            student_id=student_id,
            seeded_count=seed_result["seeded_count"],
            frontier_skills=seed_result["frontier_skills"],
            knowledge_profile=profile,
        )

    # ------------------------------------------------------------------
    # Mastery seeding (internal)
    # ------------------------------------------------------------------

    async def _seed_mastery_from_diagnostic(
        self,
        student_id: int,
        classifications: Dict[str, SubskillClassification],
    ) -> Dict[str, Any]:
        """
        Seed mastery_lifecycle based on diagnostic knowledge profile.

        Mapping (PRD §3.2):
          PROBED_MASTERED     → Gate 4, completion=1.0 (fully mastered)
          INFERRED_MASTERED   → Gate 2, completion=0.5 (skip to practice)
          PROBED_NOT_MASTERED → Gate 0, completion=0.0 (needs lessons)
          INFERRED_NOT_MASTERED → Gate 0, completion=0.0 (not started)
          UNKNOWN             → no doc created (standard treatment)
        """
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        lifecycles_to_write: List[Dict[str, Any]] = []
        frontier_skills: List[str] = []
        seeded_count = 0

        for subskill_id, cls in classifications.items():
            status = cls.status
            if status == DiagnosticStatus.UNKNOWN:
                continue  # Don't create a doc — standard treatment

            target_gate = DIAGNOSTIC_GATE_MAP[status]
            completion = DIAGNOSTIC_COMPLETION_MAP[status]

            lc = MasteryLifecycle(
                student_id=student_id,
                subskill_id=subskill_id,
                subject=cls.subject,
                skill_id=cls.skill_id,
                current_gate=target_gate,
                completion_pct=completion,
                created_at=now_iso,
                updated_at=now_iso,
            )

            if status == DiagnosticStatus.PROBED_MASTERED:
                lc.passes = 3
                lc.lesson_eval_count = 3
                lc.next_retest_eligible = None
                lc.retest_interval_days = 0

            elif status == DiagnosticStatus.INFERRED_MASTERED:
                lc.lesson_eval_count = 3  # Skip lesson phase
                # Schedule verification retest in 3 days
                lc.next_retest_eligible = (
                    now + timedelta(days=3)
                ).isoformat()
                lc.retest_interval_days = 3
                frontier_skills.append(subskill_id)

            elif status == DiagnosticStatus.PROBED_NOT_MASTERED:
                lc.lesson_eval_count = 0

            elif status == DiagnosticStatus.INFERRED_NOT_MASTERED:
                lc.lesson_eval_count = 0

            # Record diagnostic source in gate history
            lc.gate_history = [GateHistoryEntry(
                gate=target_gate,
                timestamp=now_iso,
                score=(cls.score or 0.0) * 10,  # Convert 0-1 to 0-10 scale
                passed=status in (
                    DiagnosticStatus.PROBED_MASTERED,
                    DiagnosticStatus.INFERRED_MASTERED,
                ),
                source="diagnostic",
            )]

            lifecycles_to_write.append(lc.model_dump())
            seeded_count += 1

        # Batch write
        if lifecycles_to_write:
            success = await self.firestore.batch_write_mastery_lifecycles(
                student_id, lifecycles_to_write,
            )
            if not success:
                logger.error(
                    f"Failed to batch write {len(lifecycles_to_write)} "
                    f"mastery lifecycles for student {student_id}"
                )

        # Update global pass rate
        try:
            await self.mastery_engine.update_global_pass_rate(student_id)
        except Exception as e:
            logger.warning(f"Failed to update global pass rate: {e}")

        logger.info(
            f"Seeded {seeded_count} mastery lifecycles for student {student_id} "
            f"({len(frontier_skills)} frontier skills)"
        )

        return {
            "seeded_count": seeded_count,
            "frontier_skills": frontier_skills,
        }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _metrics_from_dict(d: Dict[str, Any]):
    """Reconstruct NodeMetrics from a dict (stored in Firestore)."""
    from ..models.diagnostic import NodeMetrics
    return NodeMetrics(
        node_id=d.get("node_id", ""),
        depth=d.get("depth", 0),
        height=d.get("height", 0),
        chain_length=d.get("chain_length", 0),
    )
