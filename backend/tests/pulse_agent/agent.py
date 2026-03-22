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

import logging
from typing import Any, Dict, List, Optional

from app.models.pulse import PulseItemSpec, PulseResultRequest, PulseResultResponse
from app.services.pulse_engine import PulseEngine
from app.db.firestore_service import FirestoreService

from .profiles import SyntheticProfile
from .scenarios import ScoreStrategy, get_strategy
from .journey_recorder import ItemResult, JourneyRecorder, JourneyTimeline

logger = logging.getLogger(__name__)


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
    ):
        self.engine = pulse_engine
        self.recorder = JourneyRecorder(firestore_service)
        self.seed = seed

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

        logger.info(
            f">> Starting journey: {profile.name} (id={profile.student_id}, "
            f"archetype={profile.archetype}, sessions={num_sessions})"
        )

        timeline = await self.recorder.create_timeline(
            student_id=profile.student_id,
            profile_name=profile.name,
            archetype=profile.archetype,
            subject=profile.subject,
        )

        for session_num in range(1, num_sessions + 1):
            strategy.advance_session()

            try:
                snapshot = await self._run_one_session(
                    profile=profile,
                    strategy=strategy,
                    timeline=timeline,
                    session_number=session_num,
                )

                logger.info(
                    f"  Session {session_num}/{num_sessions}: "
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

        from datetime import datetime, timezone
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
    ) -> Any:
        """Assemble a session, submit scores for each item, snapshot state."""

        # 1. Assemble session
        session_resp = await self.engine.assemble_session(
            student_id=profile.student_id,
            subject=profile.subject,
            item_count=profile.items_per_session,
        )

        session_id = session_resp.session_id
        is_cold_start = session_resp.is_cold_start

        # Count bands
        band_counts: Dict[str, int] = {"frontier": 0, "current": 0, "review": 0}
        for item in session_resp.items:
            band_counts[item.band.value] = band_counts.get(item.band.value, 0) + 1

        # 2. Build gate map for accurate fallback tracking
        lifecycles = await self.recorder.firestore.get_all_mastery_lifecycles(
            profile.student_id
        )
        gate_map: Dict[str, int] = {
            lc.get("subskill_id", ""): lc.get("current_gate", 0)
            for lc in lifecycles
        }

        # 3. Submit results for each item
        item_results: List[ItemResult] = []

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
            )

            # Extract IRT data from result
            irt = result_resp.irt
            fc = item.frontier_context

            # Use actual gate from lifecycle when gate_update is None
            actual_gate = gate_map.get(item.subskill_id, 0)

            # Build item result for the recorder
            item_result = ItemResult(
                item_id=item.item_id,
                band=item.band.value,
                subskill_id=item.subskill_id,
                skill_id=item.skill_id,
                description=item.description,
                target_mode=item.target_mode,
                target_beta=item.target_beta,
                score=score,
                theta_before=result_resp.theta_update.old_theta,
                theta_after=result_resp.theta_update.new_theta,
                gate_before=(
                    result_resp.gate_update.old_gate
                    if result_resp.gate_update else actual_gate
                ),
                gate_after=(
                    result_resp.gate_update.new_gate
                    if result_resp.gate_update else actual_gate
                ),
                leapfrog_triggered=result_resp.leapfrog is not None,
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

        # 3. Snapshot state
        snapshot = await self.recorder.snapshot_session(
            timeline=timeline,
            session_number=session_number,
            session_id=session_id,
            is_cold_start=is_cold_start,
            item_results=item_results,
            band_counts=band_counts,
        )

        return snapshot

    async def cleanup_student(self, student_id: int) -> None:
        """
        Remove all Firestore data for a synthetic student.
        Call this before re-running a scenario for a clean slate.

        Uses direct subcollection listing (not service queries) to ensure
        every document is found and deleted, regardless of field values.
        """
        logger.info(f"Cleaning up synthetic student {student_id}...")

        fs = self.recorder.firestore
        student_ref = fs.client.collection("students").document(str(student_id))

        # Delete ALL docs in each subcollection by listing doc refs directly
        subcollections = [
            "mastery_lifecycle",   # singular — matches FirestoreService
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

        # Delete pulse sessions (top-level collection, filtered by student_id)
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
