"""
Mastery Lifecycle Engine

Implements the 4-gate mastery lifecycle model (PRD Sections 3, 4, 5, 8).
This is a pure algorithmic service — no LLM or external API calls.

Entry point:  process_eval_result()
Called from:   CompetencyService.update_competency_from_problem() as a hook
               (runs alongside the existing ReviewEngine)

Gate transitions:
  Gate 0 → 1:  source="lesson", lesson_eval_count >= 3, score >= 9.0
  Gate 1 → 2:  source="practice", retest eligible, score >= 9.0, +3d interval
  Gate 2 → 3:  source="practice", retest eligible, score >= 9.0, +7d interval
  Gate 3 → 4:  source="practice", retest eligible, score >= 9.0, +14d interval
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Literal, Optional

# Maximum gate_history entries to retain per lifecycle document.
# Prevents unbounded Firestore document growth (1 MiB limit).
MAX_GATE_HISTORY = 50

from ..db.firestore_service import FirestoreService
from ..models.mastery_lifecycle import (
    CREDIBILITY_STANDARD,
    GATE_1_MIN_LESSON_EVALS,
    MASTERY_THRESHOLD,
    RETEST_INTERVALS,
    GateHistoryEntry,
    MasteryGate,
    MasteryLifecycle,
)

logger = logging.getLogger(__name__)


class MasteryLifecycleEngine:
    """
    Stateless service that processes eval results and maintains the
    mastery_lifecycle subcollection in Firestore.
    """

    def __init__(self, firestore_service: FirestoreService):
        self.firestore = firestore_service
        logger.info("MasteryLifecycleEngine initialized")

    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------

    async def process_eval_result(
        self,
        student_id: int,
        subskill_id: str,
        subject: str,
        skill_id: str,
        score: float,
        source: Literal["lesson", "practice"],
        timestamp: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Process a single evaluation event and update the mastery lifecycle.

        Args:
            student_id: Student identifier.
            subskill_id: The subskill that was evaluated.
            subject: Subject name (e.g. "Mathematics").
            skill_id: Parent skill identifier.
            score: Raw score on 0-10 scale.
            source: "lesson" or "practice".
            timestamp: ISO-8601 timestamp (defaults to now).

        Returns:
            Updated mastery lifecycle dict.
        """
        now = datetime.now(timezone.utc)
        ts = timestamp or now.isoformat()
        passed = score >= MASTERY_THRESHOLD

        logger.info(
            f"[MASTERY_ENGINE] Processing eval: student={student_id}, "
            f"subskill={subskill_id}, score={score}, source={source}, passed={passed}"
        )

        # Fetch or initialise the lifecycle document
        existing = await self.firestore.get_mastery_lifecycle(student_id, subskill_id)

        if existing is None:
            lifecycle = MasteryLifecycle(
                student_id=student_id,
                subskill_id=subskill_id,
                subject=subject,
                skill_id=skill_id,
            )
        else:
            lifecycle = MasteryLifecycle(**existing)

        # Ensure metadata is current
        if subject and not lifecycle.subject:
            lifecycle.subject = subject
        if skill_id and not lifecycle.skill_id:
            lifecycle.skill_id = skill_id

        # Route based on source
        if source == "lesson":
            lifecycle = self._handle_lesson_eval(lifecycle, score, passed, ts)
        elif source == "practice":
            # Fetch actual global pass rate for credibility blending (PRD 4.3)
            global_rate_data = await self.firestore.get_global_practice_pass_rate(student_id)
            global_rate = global_rate_data.get("global_practice_pass_rate", 0.8)
            lifecycle = self._handle_practice_eval(lifecycle, score, passed, ts, now, global_rate)

        # Append to gate history (capped to prevent unbounded doc growth)
        lifecycle.gate_history.append(
            GateHistoryEntry(
                gate=lifecycle.current_gate,
                timestamp=ts,
                score=score,
                passed=passed,
                source=source,
            )
        )
        if len(lifecycle.gate_history) > MAX_GATE_HISTORY:
            lifecycle.gate_history = lifecycle.gate_history[-MAX_GATE_HISTORY:]

        # Update timestamp
        lifecycle.updated_at = now.isoformat()

        # Persist
        await self.firestore.upsert_mastery_lifecycle(
            student_id, subskill_id, lifecycle.model_dump()
        )

        logger.info(
            f"[MASTERY_ENGINE] Result: gate={lifecycle.current_gate}, "
            f"completion={lifecycle.completion_pct:.3f}, "
            f"next_retest={lifecycle.next_retest_eligible}"
        )

        return lifecycle.model_dump()

    # ------------------------------------------------------------------
    # Lesson-mode handler (Gate 0 → 1)
    # ------------------------------------------------------------------

    def _handle_lesson_eval(
        self,
        lifecycle: MasteryLifecycle,
        score: float,
        passed: bool,
        timestamp: str,
    ) -> MasteryLifecycle:
        """Handle a lesson-mode evaluation. Only affects Gate 0 → 1 transition."""

        if lifecycle.current_gate > MasteryGate.NOT_STARTED:
            # Already past initial mastery — lesson evals don't affect later gates
            logger.info(
                f"[MASTERY_ENGINE] Lesson eval for {lifecycle.subskill_id} "
                f"at gate {lifecycle.current_gate} — no lifecycle effect"
            )
            return lifecycle

        # Track passing lesson evals toward Gate 1
        if passed:
            lifecycle.lesson_eval_count += 1
            logger.info(
                f"[MASTERY_ENGINE] Lesson eval passed — "
                f"lesson_eval_count now {lifecycle.lesson_eval_count}/{GATE_1_MIN_LESSON_EVALS}"
            )

            # Check if Gate 1 threshold met
            if lifecycle.lesson_eval_count >= GATE_1_MIN_LESSON_EVALS:
                lifecycle.current_gate = MasteryGate.INITIAL_MASTERY
                lifecycle.completion_pct = 0.25  # Base 25% credit for Gate 1

                # Schedule first retest in 3 days
                base_interval, _ = RETEST_INTERVALS[(1, 2)]
                retest_date = datetime.fromisoformat(timestamp) + timedelta(days=base_interval)
                lifecycle.next_retest_eligible = retest_date.isoformat()
                lifecycle.retest_interval_days = base_interval

                logger.info(
                    f"[MASTERY_ENGINE] Gate 1 CLEARED for {lifecycle.subskill_id} — "
                    f"next retest eligible: {lifecycle.next_retest_eligible}"
                )
        else:
            logger.info(
                f"[MASTERY_ENGINE] Lesson eval did not pass (score {score}) — "
                f"lesson_eval_count stays at {lifecycle.lesson_eval_count}"
            )

        return lifecycle

    # ------------------------------------------------------------------
    # Practice-mode handler (Gates 1 → 2, 2 → 3, 3 → 4)
    # ------------------------------------------------------------------

    def _handle_practice_eval(
        self,
        lifecycle: MasteryLifecycle,
        score: float,
        passed: bool,
        timestamp: str,
        now: datetime,
        global_pass_rate: float,
    ) -> MasteryLifecycle:
        """Handle a practice-mode evaluation. Affects retest gates 2-4."""

        gate = lifecycle.current_gate

        if gate == MasteryGate.NOT_STARTED:
            # Practice evals before initial mastery don't affect the lifecycle
            logger.info(
                f"[MASTERY_ENGINE] Practice eval at Gate 0 — "
                f"no lifecycle effect (need lesson mastery first)"
            )
            return lifecycle

        if gate >= MasteryGate.RETEST_3:
            # Already at Gate 4 — fully mastered
            logger.info(
                f"[MASTERY_ENGINE] Practice eval for {lifecycle.subskill_id} "
                f"already at Gate 4 — no lifecycle effect"
            )
            return lifecycle

        # Check retest eligibility (PRD 8.3: prevent gaming via rapid-fire)
        if lifecycle.next_retest_eligible:
            retest_eligible_dt = datetime.fromisoformat(
                lifecycle.next_retest_eligible.replace("Z", "+00:00")
            )
            # Make now timezone-aware if it isn't
            if now.tzinfo is None:
                now = now.replace(tzinfo=timezone.utc)
            if retest_eligible_dt.tzinfo is None:
                retest_eligible_dt = retest_eligible_dt.replace(tzinfo=timezone.utc)

            if now < retest_eligible_dt:
                logger.info(
                    f"[MASTERY_ENGINE] Practice eval for {lifecycle.subskill_id} "
                    f"before retest eligible ({lifecycle.next_retest_eligible}) — "
                    f"recorded in competency but skipping lifecycle update"
                )
                return lifecycle

        # This is an eligible retest — process it
        next_gate = gate + 1  # The gate being attempted
        transition_key = (gate, next_gate)

        if passed:
            lifecycle = self._handle_retest_pass(lifecycle, transition_key, timestamp)
        else:
            lifecycle = self._handle_retest_fail(lifecycle, transition_key, timestamp)

        # Recalculate actuarial completion factor
        lifecycle = self._recalculate_completion_factor(lifecycle, global_pass_rate)

        return lifecycle

    # ------------------------------------------------------------------
    # Retest pass / fail handlers
    # ------------------------------------------------------------------

    def _handle_retest_pass(
        self,
        lifecycle: MasteryLifecycle,
        transition_key: tuple,
        timestamp: str,
    ) -> MasteryLifecycle:
        """Handle a passing retest (score >= 9.0)."""
        lifecycle.passes += 1
        new_gate = transition_key[1]
        lifecycle.current_gate = new_gate

        logger.info(
            f"[MASTERY_ENGINE] Retest PASSED — advancing to Gate {new_gate}"
        )

        if new_gate >= MasteryGate.RETEST_3:
            # Fully mastered — no more retests
            lifecycle.next_retest_eligible = None
            lifecycle.retest_interval_days = 0
            logger.info(
                f"[MASTERY_ENGINE] Gate 4 REACHED — {lifecycle.subskill_id} fully mastered"
            )
        else:
            # Schedule next retest at the new gate's interval
            next_transition = (new_gate, new_gate + 1)
            if next_transition in RETEST_INTERVALS:
                base_interval, _ = RETEST_INTERVALS[next_transition]
                retest_date = datetime.fromisoformat(timestamp) + timedelta(days=base_interval)
                lifecycle.next_retest_eligible = retest_date.isoformat()
                lifecycle.retest_interval_days = base_interval

        return lifecycle

    def _handle_retest_fail(
        self,
        lifecycle: MasteryLifecycle,
        transition_key: tuple,
        timestamp: str,
    ) -> MasteryLifecycle:
        """Handle a failing retest (score < 9.0)."""
        lifecycle.fails += 1

        logger.info(
            f"[MASTERY_ENGINE] Retest FAILED at gate transition {transition_key} — "
            f"stays at Gate {lifecycle.current_gate}"
        )

        # Reset interval to the failed-retest value (PRD 5.1)
        if transition_key in RETEST_INTERVALS:
            _, failed_reset_days = RETEST_INTERVALS[transition_key]
            retest_date = datetime.fromisoformat(timestamp) + timedelta(days=failed_reset_days)
            lifecycle.next_retest_eligible = retest_date.isoformat()
            lifecycle.retest_interval_days = failed_reset_days

        return lifecycle

    # ------------------------------------------------------------------
    # Actuarial completion factor (PRD Section 4)
    # ------------------------------------------------------------------

    def _recalculate_completion_factor(
        self,
        lifecycle: MasteryLifecycle,
        global_pass_rate: float,
    ) -> MasteryLifecycle:
        """
        Recalculate the actuarial completion factor after a practice eval.

        completion_pct = gate_1_credit (0.25) + passes × credit_per_pass
        credit_per_pass = blended_pass_rate × 0.25
        blended_pass_rate = Z × subskill_rate + (1-Z) × global_rate
        Z = min(attempts / credibility_standard, 1.0)
        """
        total_attempts = lifecycle.passes + lifecycle.fails

        # Subskill-level pass rate
        if total_attempts > 0:
            lifecycle.subskill_pass_rate = round(
                lifecycle.passes / total_attempts, 4
            )
        else:
            lifecycle.subskill_pass_rate = 0.0

        # Credibility blending (PRD 4.3)
        z = min(total_attempts / CREDIBILITY_STANDARD, 1.0)
        lifecycle.blended_pass_rate = round(
            z * lifecycle.subskill_pass_rate + (1 - z) * global_pass_rate, 4
        )

        # Credit per pass
        lifecycle.credit_per_pass = round(lifecycle.blended_pass_rate * 0.25, 4)

        # Completion percentage
        gate_1_credit = 0.25 if lifecycle.current_gate >= MasteryGate.INITIAL_MASTERY else 0.0
        lifecycle.completion_pct = round(
            min(1.0, gate_1_credit + lifecycle.passes * lifecycle.credit_per_pass), 4
        )

        # Estimated remaining attempts
        if lifecycle.completion_pct >= 1.0:
            lifecycle.estimated_remaining_attempts = 0
        elif lifecycle.credit_per_pass > 0:
            remaining_credit = 1.0 - lifecycle.completion_pct
            passes_needed = remaining_credit / lifecycle.credit_per_pass
            if lifecycle.blended_pass_rate > 0:
                lifecycle.estimated_remaining_attempts = max(
                    1, round(passes_needed / lifecycle.blended_pass_rate)
                )
            else:
                lifecycle.estimated_remaining_attempts = max(1, round(passes_needed))
        else:
            lifecycle.estimated_remaining_attempts = 10  # Fallback

        return lifecycle

    # ------------------------------------------------------------------
    # Global pass rate maintenance (PRD 6.4)
    # ------------------------------------------------------------------

    async def update_global_pass_rate(
        self,
        student_id: int,
    ) -> None:
        """
        Recalculate and persist the student's global practice pass rate.

        Aggregates passes/fails across all mastery_lifecycle docs.
        Called after every practice-mode eval.
        """
        try:
            all_lifecycles = await self.firestore.get_all_mastery_lifecycles(student_id)

            total_passes = sum(lc.get("passes", 0) for lc in all_lifecycles)
            total_fails = sum(lc.get("fails", 0) for lc in all_lifecycles)

            await self.firestore.update_global_practice_pass_rate(
                student_id, total_passes, total_fails
            )

        except Exception as e:
            logger.error(
                f"[MASTERY_ENGINE] Error updating global pass rate for "
                f"student {student_id}: {e}"
            )

    # ------------------------------------------------------------------
    # Forecasting (PRD Section 7.4)
    # ------------------------------------------------------------------

    async def get_student_mastery_summary(
        self,
        student_id: int,
        subject: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Aggregated mastery summary for a student.

        Returns per-subject and per-skill gate counts, completion averages,
        and overall progress metrics.
        """
        lifecycles = await self.firestore.get_all_mastery_lifecycles(
            student_id, subject
        )
        global_rate = await self.firestore.get_global_practice_pass_rate(student_id)

        if not lifecycles:
            return {
                "student_id": student_id,
                "total_subskills": 0,
                "by_gate": {str(g): 0 for g in range(5)},
                "average_completion_pct": 0.0,
                "fully_mastered": 0,
                "global_practice_pass_rate": global_rate.get("global_practice_pass_rate", 0.8),
                "by_subject": {},
            }

        by_subject: Dict[str, Dict[str, Any]] = {}
        by_gate = {str(g): 0 for g in range(5)}

        for lc in lifecycles:
            gate = lc.get("current_gate", 0)
            by_gate[str(gate)] = by_gate.get(str(gate), 0) + 1

            subj = lc.get("subject", "unknown")
            if subj not in by_subject:
                by_subject[subj] = {
                    "total": 0,
                    "fully_mastered": 0,
                    "average_completion_pct": 0.0,
                    "by_gate": {str(g): 0 for g in range(5)},
                    "subskills": [],
                }
            entry = by_subject[subj]
            entry["total"] += 1
            entry["by_gate"][str(gate)] = entry["by_gate"].get(str(gate), 0) + 1
            if gate >= MasteryGate.RETEST_3:
                entry["fully_mastered"] += 1
            entry["subskills"].append({
                "subskill_id": lc.get("subskill_id"),
                "skill_id": lc.get("skill_id"),
                "current_gate": gate,
                "completion_pct": lc.get("completion_pct", 0.0),
                "passes": lc.get("passes", 0),
                "fails": lc.get("fails", 0),
            })

        # Compute averages
        total = len(lifecycles)
        avg_completion = sum(lc.get("completion_pct", 0.0) for lc in lifecycles) / total
        fully_mastered = sum(1 for lc in lifecycles if lc.get("current_gate", 0) >= 4)

        for subj, entry in by_subject.items():
            if entry["total"] > 0:
                entry["average_completion_pct"] = round(
                    sum(s["completion_pct"] for s in entry["subskills"]) / entry["total"], 4
                )

        return {
            "student_id": student_id,
            "total_subskills": total,
            "by_gate": by_gate,
            "average_completion_pct": round(avg_completion, 4),
            "fully_mastered": fully_mastered,
            "global_practice_pass_rate": global_rate.get("global_practice_pass_rate", 0.8),
            "by_subject": by_subject,
        }

    def get_subskill_eta(
        self,
        lifecycle: Dict[str, Any],
        avg_days_between_attempts: float = 5.0,
    ) -> Dict[str, Any]:
        """
        Estimate time to full mastery for a single subskill (PRD §7.4).

        subskill_eta = estimated_remaining_attempts × avg_days_between_attempts
        """
        remaining = lifecycle.get("estimated_remaining_attempts", 4)
        completion = lifecycle.get("completion_pct", 0.0)
        gate = lifecycle.get("current_gate", 0)

        if gate >= MasteryGate.RETEST_3 or completion >= 1.0:
            return {
                "subskill_id": lifecycle.get("subskill_id"),
                "estimated_days": 0,
                "estimated_attempts": 0,
                "status": "mastered",
            }

        eta_days = round(remaining * avg_days_between_attempts, 1)

        return {
            "subskill_id": lifecycle.get("subskill_id"),
            "current_gate": gate,
            "completion_pct": completion,
            "estimated_remaining_attempts": remaining,
            "estimated_days": eta_days,
            "status": "in_progress",
        }

    async def get_forecast(
        self,
        student_id: int,
        subject: Optional[str] = None,
        avg_days_between_attempts: float = 5.0,
    ) -> Dict[str, Any]:
        """
        Workload forecast at subject level (PRD §7.4).

        - Subskill ETA = estimated_remaining_attempts × avg_days_between_attempts
        - Unit ETA = max(subskill ETAs within unit)
        - Subject ETA = sum of sequential unit ETAs
        """
        lifecycles = await self.firestore.get_all_mastery_lifecycles(
            student_id, subject
        )

        if not lifecycles:
            return {
                "student_id": student_id,
                "subskill_forecasts": [],
                "by_unit": {},
                "by_subject": {},
            }

        subskill_forecasts = []
        by_unit: Dict[str, Dict[str, Any]] = {}
        by_subject: Dict[str, float] = {}

        for lc in lifecycles:
            eta = self.get_subskill_eta(lc, avg_days_between_attempts)
            eta["subject"] = lc.get("subject", "unknown")
            eta["skill_id"] = lc.get("skill_id", "")
            subskill_forecasts.append(eta)

            # Group by skill_id as proxy for unit (subskills within same skill)
            skill_id = lc.get("skill_id", "unknown")
            if skill_id not in by_unit:
                by_unit[skill_id] = {
                    "subject": lc.get("subject", "unknown"),
                    "max_eta_days": 0,
                    "subskill_count": 0,
                    "mastered_count": 0,
                }
            by_unit[skill_id]["subskill_count"] += 1
            if eta["status"] == "mastered":
                by_unit[skill_id]["mastered_count"] += 1
            by_unit[skill_id]["max_eta_days"] = max(
                by_unit[skill_id]["max_eta_days"],
                eta.get("estimated_days", 0),
            )

        # Subject ETA = sum of unit ETAs (sequential)
        for unit_id, unit_data in by_unit.items():
            subj = unit_data["subject"]
            by_subject[subj] = by_subject.get(subj, 0) + unit_data["max_eta_days"]

        return {
            "student_id": student_id,
            "subskill_forecasts": subskill_forecasts,
            "by_unit": by_unit,
            "by_subject": {
                subj: {"estimated_days": round(days, 1)}
                for subj, days in by_subject.items()
            },
        }
