"""
Mastery Lifecycle Engine — the per-subskill practice record and the gate writer.

The learner model sets every gate (C13, 10-16): `LearnerStateService` calls
`apply_model_states` after each answer with the model's gate, retention state
and memory stability. This engine no longer derives a gate or schedules
retests (retired C15, 10-16); `process_eval_result` keeps the practice record
the readers still use (passes/fails, evidence_n, lesson_eval_count, the
actuarial completion factor) and creates the doc the model's sync writes onto.

Entry point:  process_eval_result()
Called from:   CompetencyService.update_competency_from_problem() and
               PulseEngine.submit_item(), before the learner model's sync.
"""

import logging
import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

# Maximum gate_history entries to retain per lifecycle document.
# Prevents unbounded Firestore document growth (1 MiB limit).
MAX_GATE_HISTORY = 50

from ..db.firestore_service import FirestoreService
from ..models.calibration import DEFAULT_STUDENT_THETA
from ..models.mastery_lifecycle import (
    CREDIBILITY_STANDARD,
    DECAY_RATE,
    GATE_TO_STABILITY,
    INITIAL_STABILITY,
    MASTERY_STABILITY_THRESHOLD,
    MASTERY_THRESHOLD,
    STABILITY_GROWTH_STRONG,
    THETA_DECAY_FLOOR_FACTOR,
    GateHistoryEntry,
    MasteryLifecycle,
)

logger = logging.getLogger(__name__)

# The fields process_eval_result owns. It merge-writes only these on an existing
# doc, so a stale read can never put back a gate the model's sync replaced.
_RECORD_FIELDS = (
    "passes", "fails", "evidence_n", "review_count", "last_reviewed",
    "lesson_eval_count", "subskill_pass_rate", "blended_pass_rate",
    "credit_per_pass", "completion_pct", "estimated_remaining_attempts",
    "subject", "skill_id", "updated_at",
)


# ------------------------------------------------------------------
# Pure-math helpers (module-level for reuse by PulseEngine)
# ------------------------------------------------------------------

def effective_theta(
    theta_tested: float,
    days_since_test: float,
    stability: float,
) -> float:
    """
    Model memory decay as theta erosion over time (PRD §16.3).

    Uses power-law decay (√t) rather than exponential — matches Ebbinghaus
    forgetting curve research showing memory decays quickly at first,
    then plateaus. Stability (S) controls the rate: higher S = slower decay.

    Args:
        theta_tested: θ at last successful assessment
        days_since_test: calendar days since last assessment
        stability: memory strength in days (higher = more durable)

    Returns:
        effective θ reflecting predicted current ability
    """
    if days_since_test <= 0 or stability <= 0:
        return theta_tested

    decay = DECAY_RATE * math.sqrt(days_since_test / stability)
    floor = max(DEFAULT_STUDENT_THETA, theta_tested * THETA_DECAY_FLOOR_FACTOR)
    return max(floor, theta_tested - decay)


def derive_retention_state(lifecycle_dict: Dict[str, Any]) -> tuple[str, float]:
    """
    Derive retention_state and stability from legacy gate fields.

    Used for lazy migration of existing Firestore docs that don't have
    retention_state set yet.

    Returns (retention_state, stability).
    """
    rs = lifecycle_dict.get("retention_state")
    if rs and rs != "not_started":
        # Already migrated or explicitly set
        return rs, lifecycle_dict.get("stability", INITIAL_STABILITY)

    gate = lifecycle_dict.get("current_gate", 0)
    if gate == 0:
        return "not_started", 0.0
    elif gate >= 4:
        return "mastered", GATE_TO_STABILITY.get(gate, 47.0)
    else:
        return "active", GATE_TO_STABILITY.get(gate, INITIAL_STABILITY)


class MasteryLifecycleEngine:
    """
    Stateless service that keeps the mastery_lifecycle subcollection's practice
    record and writes the learner model's gates onto it.
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
        *,
        prefetched_lifecycle: Optional[Dict] = None,
        prefetched_global_pass_rate: Optional[float] = None,
        evidence_n: float = 1.0,
    ) -> Dict[str, Any]:
        """
        Record one evaluation on the subskill's lifecycle doc. Writes no gate,
        retention state, stability or gate history: the learner model owns those
        (`apply_model_states`). Creates the doc on a first answer so the model's
        sync has one to write onto.

        Args:
            score: Raw score on 0-10 scale.
            source: "lesson" or "practice".
            timestamp: ISO-8601 timestamp (defaults to now).
            prefetched_lifecycle: Pre-loaded lifecycle doc to skip a Firestore read.
            prefetched_global_pass_rate: Pre-loaded global practice pass rate to
                skip a Firestore read (it barely changes within one session).
            evidence_n: Effective observation count for this eval (>= 1.0).
                Multi-part primitives contribute more than a single problem
                (CalibrationEngine.effective_evidence).

        Returns:
            The updated lifecycle dict.
        """
        # Event time follows the storage layer's virtual clock when set
        # (pulse-agent loop mode advances `virtual_now` per simulated day).
        # Production FirestoreService has no such attribute -> wall clock; the
        # isinstance guard keeps MagicMock stores (unit tests) there too.
        _vn = getattr(self.firestore, "virtual_now", None)
        now = _vn if isinstance(_vn, datetime) else datetime.now(timezone.utc)
        ts = timestamp or now.isoformat()
        passed = score >= MASTERY_THRESHOLD

        if prefetched_lifecycle is not None:
            existing = prefetched_lifecycle
        else:
            existing = await self.firestore.get_mastery_lifecycle(student_id, subskill_id)

        if existing is None:
            lifecycle = MasteryLifecycle(
                student_id=student_id, subskill_id=subskill_id,
                subject=subject, skill_id=skill_id,
            )
        else:
            lifecycle = MasteryLifecycle(**existing)
        if subject and not lifecycle.subject:
            lifecycle.subject = subject
        if skill_id and not lifecycle.skill_id:
            lifecycle.skill_id = skill_id

        # Pass/fail record — continuous weight scaled by effective evidence: a
        # 7-part primitive moves it more than one true/false. A score of 8.5
        # contributes 0.85n to passes and 0.15n to fails.
        ev_n = max(1.0, float(evidence_n or 1.0))
        weight = score / 10.0
        lifecycle.passes += weight * ev_n
        lifecycle.fails += (1.0 - weight) * ev_n
        lifecycle.evidence_n += ev_n
        lifecycle.review_count += 1
        lifecycle.last_reviewed = ts
        # Passed lesson evals (the curriculum map's "lessons" column reads it).
        if source == "lesson" and passed:
            lifecycle.lesson_eval_count += 1

        if prefetched_global_pass_rate is not None:
            global_rate = prefetched_global_pass_rate
        else:
            global_rate_data = await self.firestore.get_global_practice_pass_rate(student_id)
            global_rate = global_rate_data.get("global_practice_pass_rate", 0.8)
        lifecycle = self._recalculate_completion_factor(lifecycle, global_rate)
        lifecycle.updated_at = now.isoformat()

        doc = lifecycle.model_dump()
        await self.firestore.upsert_mastery_lifecycle(
            student_id, subskill_id,
            doc if existing is None else {k: doc[k] for k in _RECORD_FIELDS},
        )
        logger.info(
            f"[MASTERY_ENGINE] Recorded eval: student={student_id}, subskill={subskill_id}, "
            f"score={score}, source={source}, n={lifecycle.evidence_n:.1f}, "
            f"completion={lifecycle.completion_pct:.3f}"
        )
        return doc

    async def apply_model_states(self, student_id: int, updates: List[Dict[str, Any]]) -> int:
        """Set gates from the learner model (C12, 10-16). Each update carries the
        lifecycle doc and the model's `gate`, `retention_state` and `stability`
        (memory stability, days). The model's mastery call matches what the child
        can do (precision 0.93-1.00, recall 0.79-1.00 vs truth); the IRT/retest
        gate missed 76-92% of it, and without retests it stops advancing, so every
        gate reader (planner unlock, My Progress, parent report, Pulse) reads the
        model through this doc. Writes only what changed; returns the write count."""
        _vn = getattr(self.firestore, "virtual_now", None)
        now = (_vn if isinstance(_vn, datetime) else datetime.now(timezone.utc)).isoformat()
        n = 0
        for u in updates:
            doc = u["doc"]
            new = {"current_gate": int(u["gate"]), "retention_state": u["retention_state"],
                   "stability": round(float(u["stability"]), 2)}
            if all(doc.get(k) == v for k, v in new.items()):
                continue
            # history carries the verdict too: the lesson close-out reads the
            # gate before the lesson from it (get_subskill_progress_delta)
            hist = list(doc.get("gate_history") or []) + [GateHistoryEntry(
                gate=new["current_gate"], timestamp=now, score=round(10 * float(u.get("pc", 0.0)), 2),
                passed=new["current_gate"] >= 4, source="learner_model").model_dump()]
            await self.firestore.upsert_mastery_lifecycle(
                student_id, doc["subskill_id"],
                {**doc, **new, "gate_history": hist[-MAX_GATE_HISTORY:],
                 "gate_source": "learner_model", "updated_at": now})
            n += 1
        return n

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
        gate_1_credit = 0.25 if lifecycle.retention_state != "not_started" else 0.0
        lifecycle.completion_pct = round(
            min(1.0, gate_1_credit + lifecycle.passes * lifecycle.credit_per_pass), 4
        )

        # For mastered subskills, force 100%
        if lifecycle.retention_state == "mastered":
            lifecycle.completion_pct = 1.0

        # Estimated remaining attempts
        if lifecycle.completion_pct >= 1.0 or lifecycle.retention_state == "mastered":
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
                "by_retention_state": {"not_started": 0, "active": 0, "mastered": 0},
                "average_completion_pct": 0.0,
                "fully_mastered": 0,
                "global_practice_pass_rate": global_rate.get("global_practice_pass_rate", 0.8),
                "by_subject": {},
            }

        by_subject: Dict[str, Dict[str, Any]] = {}
        by_gate = {str(g): 0 for g in range(5)}
        by_retention_state = {"not_started": 0, "active": 0, "mastered": 0}

        for lc in lifecycles:
            # Derive retention state for legacy docs
            rs, _ = derive_retention_state(lc)
            by_retention_state[rs] = by_retention_state.get(rs, 0) + 1

            gate = lc.get("current_gate", 0)
            by_gate[str(gate)] = by_gate.get(str(gate), 0) + 1

            subj = lc.get("subject", "unknown")
            if subj not in by_subject:
                by_subject[subj] = {
                    "total": 0,
                    "fully_mastered": 0,
                    "average_completion_pct": 0.0,
                    "by_gate": {str(g): 0 for g in range(5)},
                    "by_retention_state": {"not_started": 0, "active": 0, "mastered": 0},
                    "subskills": [],
                }
            entry = by_subject[subj]
            entry["total"] += 1
            entry["by_gate"][str(gate)] = entry["by_gate"].get(str(gate), 0) + 1
            entry["by_retention_state"][rs] = entry["by_retention_state"].get(rs, 0) + 1
            if rs == "mastered":
                entry["fully_mastered"] += 1
            entry["subskills"].append({
                "subskill_id": lc.get("subskill_id"),
                "skill_id": lc.get("skill_id"),
                "current_gate": gate,
                "retention_state": rs,
                "stability": lc.get("stability", 0.0),
                "completion_pct": lc.get("completion_pct", 0.0),
                "passes": lc.get("passes", 0),
                "fails": lc.get("fails", 0),
            })

        # Compute averages
        total = len(lifecycles)
        avg_completion = sum(lc.get("completion_pct", 0.0) for lc in lifecycles) / total
        fully_mastered = by_retention_state.get("mastered", 0)

        for subj, entry in by_subject.items():
            if entry["total"] > 0:
                entry["average_completion_pct"] = round(
                    sum(s["completion_pct"] for s in entry["subskills"]) / entry["total"], 4
                )

        return {
            "student_id": student_id,
            "total_subskills": total,
            "by_gate": by_gate,
            "by_retention_state": by_retention_state,
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
        Estimate time to full mastery for a single subskill.

        Uses stability-based projection: how many successful reviews needed
        to reach MASTERY_STABILITY_THRESHOLD.
        """
        rs, stability = derive_retention_state(lifecycle)
        completion = lifecycle.get("completion_pct", 0.0)

        if rs == "mastered" or completion >= 1.0:
            return {
                "subskill_id": lifecycle.get("subskill_id"),
                "estimated_days": 0,
                "estimated_attempts": 0,
                "status": "mastered",
            }

        if rs == "not_started":
            return {
                "subskill_id": lifecycle.get("subskill_id"),
                "estimated_days": 0,
                "estimated_attempts": 0,
                "status": "not_started",
            }

        # Project forward: how many strong reviews to reach mastery?
        projected_stability = stability
        reviews_needed = 0
        cumulative_days = 0.0
        while projected_stability < MASTERY_STABILITY_THRESHOLD and reviews_needed < 20:
            cumulative_days += projected_stability  # review at ~stability days
            projected_stability *= STABILITY_GROWTH_STRONG  # assume strong recall
            reviews_needed += 1

        return {
            "subskill_id": lifecycle.get("subskill_id"),
            "retention_state": rs,
            "stability": stability,
            "completion_pct": completion,
            "estimated_remaining_attempts": reviews_needed,
            "estimated_days": round(cumulative_days, 1),
            "status": "in_progress",
        }

    async def get_forecast(
        self,
        student_id: int,
        subject: Optional[str] = None,
        avg_days_between_attempts: float = 5.0,
    ) -> Dict[str, Any]:
        """
        Workload forecast at subject level.

        Uses stability-based projections instead of fixed gate intervals.
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
