"""
Pulse Agent Runner
==================

Core orchestrator that drives synthetic students through Pulse sessions.
Calls PulseEngine directly (no HTTP layer, no auth) with isolated student IDs.

Usage:
    runner = PulseAgentRunner(pulse_engine, firestore_service)
    timeline = await runner.run_profile(profile)
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.models.pulse import PulseItemSpec, PulseResultRequest, PulseResultResponse
from app.services.pulse_engine import PulseEngine
from app.db.firestore_service import FirestoreService

from .profiles import SyntheticProfile
from .scenarios import ScoreStrategy, get_strategy
from .journey_recorder import ItemResult, JourneyRecorder, JourneyTimeline

logger = logging.getLogger(__name__)

# Default time gap between simulated sessions (1 day = realistic pacing)
DEFAULT_SESSION_GAP_DAYS = 1.0


class PulseAgentRunner:
    """
    Drives a synthetic student through N Pulse sessions, recording the
    full journey for later analysis and assertion checking.
    """

    def __init__(
        self,
        pulse_engine: PulseEngine,
        firestore_service: FirestoreService,
        seed: Optional[int] = None,
        session_gap_days: float = DEFAULT_SESSION_GAP_DAYS,
    ):
        self.engine = pulse_engine
        self.recorder = JourneyRecorder(firestore_service)
        self.seed = seed
        self.session_gap_days = session_gap_days

    async def run_profile(
        self,
        profile: SyntheticProfile,
        strategy_override: Optional[ScoreStrategy] = None,
        session_limit: Optional[int] = None,
        on_session_complete: Optional[Any] = None,  # async callback(snapshot)
    ) -> JourneyTimeline:
        """
        Run a full journey for one synthetic profile.

        Args:
            profile: The synthetic student definition
            strategy_override: Use a custom strategy instead of the profile's archetype
            session_limit: Override profile.target_sessions
            on_session_complete: Optional async callback after each session snapshot

        Returns:
            Complete JourneyTimeline with all snapshots
        """
        strategy = strategy_override or get_strategy(profile, seed=self.seed)
        num_sessions = session_limit or profile.target_sessions

        # Virtual clock: each session advances by session_gap_days
        virtual_now = datetime.now(timezone.utc)

        logger.info(
            f">> Starting journey: {profile.name} (id={profile.student_id}, "
            f"archetype={profile.archetype}, sessions={num_sessions}, "
            f"gap={self.session_gap_days}d/session)"
        )

        timeline = await self.recorder.create_timeline(
            student_id=profile.student_id,
            profile_name=profile.name,
            archetype=profile.archetype,
            subject=profile.subject,
        )

        # Fetch curriculum size for coverage tracking
        try:
            graph = await self.fetch_graph(profile.subject)
            timeline.total_curriculum_nodes = len(graph.get("nodes", []))
            logger.info(
                f"   Curriculum: {timeline.total_curriculum_nodes} subskill nodes"
            )
        except Exception as e:
            logger.warning(f"   Could not fetch curriculum graph: {e}")

        for session_num in range(1, num_sessions + 1):
            strategy.advance_session()

            try:
                snapshot = await self._run_one_session(
                    profile=profile,
                    strategy=strategy,
                    timeline=timeline,
                    session_number=session_num,
                    virtual_now=virtual_now,
                )

                logger.info(
                    f"  Session {session_num}/{num_sessions} (day {(session_num - 1) * self.session_gap_days:.0f}): "
                    f"avg={snapshot.avg_score:.1f}, "
                    f"leapfrogs={snapshot.total_leapfrogs}, "
                    f"gate_advances={snapshot.total_gate_advances}, "
                    f"bands={snapshot.band_counts}"
                )

                if on_session_complete:
                    await on_session_complete(snapshot)

            except Exception as e:
                logger.error(
                    f"  Session {session_num} FAILED: {e}",
                    exc_info=True,
                )
                # Continue to next session — don't abort the whole journey
                continue

            # Advance virtual clock for next session
            virtual_now += timedelta(days=self.session_gap_days)

        timeline.completed_at = datetime.now(timezone.utc).isoformat()

        logger.info(
            f">> Journey complete: {profile.name} -- "
            f"{timeline.total_sessions} sessions, "
            f"{timeline.total_items} items, "
            f"{timeline.total_leapfrogs} leapfrogs, "
            f"{timeline.total_gate_advances} gate advances, "
            f"{timeline.unique_skills_touched} unique skills"
        )

        return timeline

    async def _run_one_session(
        self,
        profile: SyntheticProfile,
        strategy: ScoreStrategy,
        timeline: JourneyTimeline,
        session_number: int,
        virtual_now: datetime,
    ) -> Any:
        """Assemble a session, submit scores for each item, snapshot state.

        Optimized to minimise Firestore round-trips:
        - Session doc loaded once (from assemble), passed in-memory to all items
        - Session doc saved once at end (deferred)
        - Primitive history saved once at end (deferred)
        - Competency writes batched and flushed once at end (deferred)
        - Global pass rate prefetched once, reused for all items
        - Item calibration docs cached across items sharing same primitive+mode
        - No duplicate get_all_mastery_lifecycles call
        """

        # 1. Assemble session (use virtual clock for decay calculations)
        session_resp = await self.engine.assemble_session(
            student_id=profile.student_id,
            subject=profile.subject,
            item_count=profile.items_per_session,
            now_override=virtual_now,
        )

        session_id = session_resp.session_id
        is_cold_start = session_resp.is_cold_start

        # Count bands
        band_counts: Dict[str, int] = {"frontier": 0, "current": 0, "review": 0}
        for item in session_resp.items:
            band_counts[item.band.value] = band_counts.get(item.band.value, 0) + 1

        # 2. Pre-fetch session doc + global pass rate in parallel
        session_doc, global_rate_data = await asyncio.gather(
            self.engine.firestore.get_pulse_session(session_id),
            self.engine.firestore.get_global_practice_pass_rate(profile.student_id),
        )
        global_pass_rate = global_rate_data.get("global_practice_pass_rate", 0.8)

        # Shared item calibration cache — avoids re-reading the same
        # primitive_type+eval_mode doc when multiple items share it
        item_calibration_cache: Dict[str, Dict] = {}

        # 3. Submit results for each item (deferred writes)
        item_results: List[ItemResult] = []
        primitive_entries: List[Dict] = []  # accumulated for batch write

        for item in session_resp.items:
            score = strategy.score_item(item)

            # We need primitive_type and eval_mode — use the item's affinity
            # or fall back to a default
            primitive_type = item.primitive_affinity or "ten-frame"
            eval_mode = item.eval_mode_name or "identify"

            result_req = PulseResultRequest(
                item_id=item.item_id,
                score=score,
                primitive_type=primitive_type,
                eval_mode=eval_mode,
                duration_ms=5000,  # Synthetic — fixed duration
            )

            result_resp: PulseResultResponse = await self.engine.process_result(
                student_id=profile.student_id,
                session_id=session_id,
                result=result_req,
                now_override=virtual_now,
                prefetched_session=session_doc,
                defer_session_save=True,
                defer_primitive_history=True,
                defer_competency=True,
                prefetched_global_pass_rate=global_pass_rate,
                item_calibration_cache=item_calibration_cache,
            )

            # Accumulate primitive entry for batch write
            primitive_entries.append({
                "primitive_type": primitive_type,
                "eval_mode": eval_mode,
                "score": score,
                "subskill_id": item.subskill_id,
                "timestamp": virtual_now.isoformat(),
            })

            # Extract IRT data from result
            irt = result_resp.irt
            fc = item.frontier_context

            # Build item result for the recorder
            old_theta = result_resp.theta_update.old_theta
            new_theta = result_resp.theta_update.new_theta
            theta_delta = new_theta - old_theta
            gate_before = result_resp.gate_update.old_gate if result_resp.gate_update else 0
            gate_after = result_resp.gate_update.new_gate if result_resp.gate_update else gate_before
            leapfrog_fired = result_resp.leapfrog is not None

            # Compact per-item line
            gate_str = f"G{gate_before}→G{gate_after}" if gate_before != gate_after else f"G{gate_before}"
            leap_str = f" LEAPFROG({len(result_resp.leapfrog.inferred_skills)} inferred)" if leapfrog_fired else ""
            p_str = f"P={irt.p_correct:.2f}" if irt else "P=?"
            logger.info(
                f"    [{item.band.value:8s}] {item.subskill_id:20s} "
                f"score={score:.1f}  θ={old_theta:+.2f}→{new_theta:+.2f} (Δ{theta_delta:+.3f})  "
                f"{gate_str}  {p_str}{leap_str}"
            )

            item_result = ItemResult(
                item_id=item.item_id,
                band=item.band.value,
                subskill_id=item.subskill_id,
                skill_id=item.skill_id,
                description=item.description,
                target_mode=item.target_mode,
                target_beta=item.target_beta,
                score=score,
                theta_before=old_theta,
                theta_after=new_theta,
                gate_before=gate_before,
                gate_after=gate_after,
                leapfrog_triggered=leapfrog_fired,
                inferred_skills=(
                    result_resp.leapfrog.inferred_skills
                    if result_resp.leapfrog else []
                ),
                # IRT result data
                p_correct=irt.p_correct if irt else None,
                item_information=irt.item_information if irt else None,
                discrimination_a=irt.discrimination_a if irt else None,
                # Frontier context
                dag_distance=fc.dag_distance if fc else None,
                ancestors_if_passed=fc.ancestors_if_passed if fc else None,
                lesson_group_id=item.lesson_group_id,
            )
            item_results.append(item_result)

        # 4. Flush deferred writes (session + unlock refresh + primitive history)
        await self.engine.save_deferred_session(
            session_id, session_doc, student_id=profile.student_id,
        )
        await self.engine.flush_primitive_history(
            profile.student_id, primitive_entries,
        )

        # 5. Snapshot state
        snapshot = await self.recorder.snapshot_session(
            timeline=timeline,
            session_number=session_number,
            session_id=session_id,
            is_cold_start=is_cold_start,
            item_results=item_results,
            band_counts=band_counts,
        )

        return snapshot

    async def fetch_graph(self, subject: str) -> Dict[str, Any]:
        """
        Fetch the curriculum graph (nodes + edges) from Firestore,
        using the same path as PulseEngine.

        Returns:
            {"nodes": [...], "edges": [...]}
        """
        graph_data = await self.engine.learning_paths._get_graph(subject)
        graph = graph_data["graph"]
        # Filter to subskill nodes only (same as PulseEngine.assemble_session)
        all_nodes = [
            n for n in graph.get("nodes", [])
            if n.get("type", n.get("entity_type", "")) == "subskill"
        ]
        all_edges = graph.get("edges", [])
        return {"nodes": all_nodes, "edges": all_edges}

    async def cleanup_student(self, student_id: int) -> None:
        """
        Remove all data for a synthetic student.

        Supports both real Firestore and InMemoryFirestoreService.
        For in-memory: calls clear_student() (instant).
        For Firestore: walks subcollections and deletes documents.
        """
        logger.info(f"Cleaning up synthetic student {student_id}...")

        fs = self.recorder.firestore

        # Fast path: in-memory store has a direct clear method
        if hasattr(fs, "clear_student"):
            fs.clear_student(student_id)
            logger.info(f"  Cleanup complete (in-memory) for student {student_id}")
            return

        # Firestore path: walk subcollections
        student_ref = fs.client.collection("students").document(str(student_id))

        subcollections = [
            "mastery_lifecycle",
            "abilities",
            "pulse_state",
        ]
        for subcol_name in subcollections:
            deleted = 0
            try:
                subcol_ref = student_ref.collection(subcol_name)
                for doc in subcol_ref.stream():
                    doc.reference.delete()
                    deleted += 1
            except Exception as e:
                logger.warning(f"  Failed to clean {subcol_name}: {e}")
            if deleted:
                logger.info(f"  Deleted {deleted} docs from {subcol_name}")

        deleted_sessions = 0
        try:
            sessions_ref = fs.client.collection("pulse_sessions")
            for doc in sessions_ref.where("student_id", "==", student_id).stream():
                doc.reference.delete()
                deleted_sessions += 1
        except Exception as e:
            logger.warning(f"  Failed to clean pulse_sessions: {e}")
        if deleted_sessions:
            logger.info(f"  Deleted {deleted_sessions} pulse sessions")

        logger.info(f"  Cleanup complete for student {student_id}")
