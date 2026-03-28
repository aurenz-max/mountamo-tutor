"""
Mastery Lifecycle Engine — IRT-Derived Gate Model (PRD §16)

Gates are derived from θ+σ via derive_gate_from_irt(). A single unified
eval handler manages both activation (not_started → active) and gate
advancement (G1→G2→G3→G4) in one pass. A gifted student can go from G0
straight to G4 if θ+σ warrant it.

Entry point:  process_eval_result()
Called from:   CompetencyService.update_competency_from_problem() as a hook

State model:
  not_started  → active   (IRT-derived gate >= 1)
  active       → mastered (IRT-derived gate == 4, stability > 30 days)
"""

import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Literal, Optional

# Maximum gate_history entries to retain per lifecycle document.
# Prevents unbounded Firestore document growth (1 MiB limit).
MAX_GATE_HISTORY = 50

from ..db.firestore_service import FirestoreService
from ..models.calibration import DEFAULT_STUDENT_THETA
from ..models.mastery_lifecycle import (
    CREDIBILITY_STANDARD,
    DECAY_RATE,
    GATE_CREDIBILITY_K,
    GATE_P_THRESHOLDS,
    GATE_REF_FRACTIONS,
    GATE_SIGMA_THRESHOLDS,
    GATE_TO_STABILITY,
    INITIAL_STABILITY,
    MASTERY_STABILITY_THRESHOLD,
    MASTERY_THRESHOLD,
    RETEST_INTERVALS,
    STABILITY_GROWTH_STRONG,
    THETA_DECAY_FLOOR_FACTOR,
    GateHistoryEntry,
    MasteryGate,
    MasteryLifecycle,
)
from ..services.calibration_engine import CalibrationEngine, p_correct

logger = logging.getLogger(__name__)


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


def derive_gate_from_irt(
    theta: float,
    sigma: float,
    item_beta: float,
    avg_a: float = 1.4,
    empirical_p: Optional[float] = None,
    n_observations: int = 0,
) -> tuple[int, str, float]:
    """
    Pure function: derive mastery gate from P(correct) at the item's actual β,
    blended with empirical pass rate when sufficient observations exist.

    Checks gates 4→3→2→1 (highest first) and returns the highest passed gate.
    No side effects, no stored state.

    Credibility blend (PRD §12.7):
        Z = n / (n + GATE_CREDIBILITY_K)
        P = Z × P_empirical + (1 - Z) × P_irt

    When n is small, the IRT model dominates. As observations accumulate,
    the student's demonstrated performance carries increasing weight. This
    solves the "grinder problem" where θ updates are negligible (±0.01/score)
    because σ has collapsed, leaving P_irt stuck just below a gate threshold
    despite consistent high scores.

    Returns (gate, retention_state, p_blended).
    """
    p_irt = p_correct(theta, avg_a, item_beta)

    # Credibility-blend with empirical pass rate when available
    if empirical_p is not None and n_observations > 0:
        z = n_observations / (n_observations + GATE_CREDIBILITY_K)
        p = z * empirical_p + (1.0 - z) * p_irt
    else:
        p = p_irt

    for gate in (4, 3, 2, 1):
        if p >= GATE_P_THRESHOLDS[gate]:
            if gate >= 4:
                return gate, "mastered", p
            else:
                return gate, "active", p

    return 0, "not_started", p


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
        *,
        prefetched_lifecycle: Optional[Dict] = None,
        prefetched_ability: Optional[Dict] = None,
        prefetched_global_pass_rate: Optional[float] = None,
        theta: Optional[float] = None,
        sigma: Optional[float] = None,
        item_beta: Optional[float] = None,
        primitive_type: Optional[str] = None,
        avg_a: Optional[float] = None,
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
            prefetched_lifecycle: Pre-loaded lifecycle doc to skip a Firestore read.
            prefetched_ability: Pre-loaded ability doc to skip a Firestore read
                for skill_beta_median computation.
            prefetched_global_pass_rate: Pre-loaded global practice pass rate to
                skip a Firestore read. Useful when processing multiple items in
                a session — the rate barely changes within one session.
            theta: Freshly-updated student ability (from CalibrationEngine).
            sigma: Freshly-updated uncertainty (from CalibrationEngine).
            primitive_type: Primitive type for beta range lookup (2PL gate checks).
            avg_a: Average discrimination for the skill's items (2PL gate checks).

        Returns:
            Updated mastery lifecycle dict.
        """
        now = datetime.now(timezone.utc)
        ts = timestamp or now.isoformat()
        passed = score >= MASTERY_THRESHOLD

        logger.info(
            f"[MASTERY_ENGINE] Processing eval: student={student_id}, "
            f"subskill={subskill_id}, score={score}, source={source}, "
            f"passed={passed}, theta={theta}, sigma={sigma}"
        )

        # Fetch or initialise the lifecycle document (skip read if pre-fetched)
        if prefetched_lifecycle is not None:
            existing = prefetched_lifecycle
        else:
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

        # Lazy migration: derive retention_state from gate if not set
        if not lifecycle.retention_state or lifecycle.retention_state == "not_started":
            rs, stab = derive_retention_state(lifecycle.model_dump())
            if rs != "not_started" or lifecycle.current_gate > 0:
                lifecycle.retention_state = rs
                if lifecycle.stability == 0.0 and stab > 0:
                    lifecycle.stability = stab
                if lifecycle.last_reviewed is None and lifecycle.updated_at:
                    lifecycle.last_reviewed = lifecycle.updated_at

        # Ensure metadata is current
        if subject and not lifecycle.subject:
            lifecycle.subject = subject
        if skill_id and not lifecycle.skill_id:
            lifecycle.skill_id = skill_id

        # Compute skill beta median for theta-based checks (if theta available)
        skill_beta_median: Optional[float] = None
        if theta is not None and sigma is not None:
            ability_doc = prefetched_ability
            if ability_doc is None:
                ability_doc = await self.firestore.get_student_ability(student_id, skill_id)
            skill_beta_median = CalibrationEngine.compute_skill_beta_median(ability_doc)

        # item_beta is passed directly from the caller (the mode's actual β)

        # Unified eval path — no lesson/practice split.
        # All evals route through the practice handler, which handles
        # activation (not_started → active) and gate advancement in one pass.
        if prefetched_global_pass_rate is not None:
            global_rate = prefetched_global_pass_rate
        else:
            global_rate_data = await self.firestore.get_global_practice_pass_rate(student_id)
            global_rate = global_rate_data.get("global_practice_pass_rate", 0.8)
        lifecycle = self._handle_practice_eval(
            lifecycle, score, passed, ts, now, global_rate,
            theta=theta, sigma=sigma, item_beta=item_beta, avg_a=avg_a,
            skill_beta_median=skill_beta_median,
        )

        # Append to gate history (capped to prevent unbounded doc growth)
        lifecycle.gate_history.append(
            GateHistoryEntry(
                gate=lifecycle.current_gate,
                timestamp=ts,
                score=score,
                passed=passed,
                source=source,
                theta=theta,
                sigma=sigma,
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
            f"[MASTERY_ENGINE] Result: retention_state={lifecycle.retention_state}, "
            f"stability={lifecycle.stability:.1f}, "
            f"gate={lifecycle.current_gate}, "
            f"completion={lifecycle.completion_pct:.3f}"
        )

        return lifecycle.model_dump()

    # ------------------------------------------------------------------
    # Lesson-mode handler (Gate 0 → 1 / not_started → active)
    # ------------------------------------------------------------------

    def _handle_lesson_eval(
        self,
        lifecycle: MasteryLifecycle,
        score: float,
        passed: bool,
        timestamp: str,
        theta: Optional[float] = None,
        sigma: Optional[float] = None,
        skill_beta_median: Optional[float] = None,
        min_beta: Optional[float] = None,
        max_beta: Optional[float] = None,
        avg_a: Optional[float] = None,
    ) -> MasteryLifecycle:
        """Handle a lesson-mode evaluation. Only affects not_started → active transition.

        Uses derive_gate_from_irt() when IRT data is available (single code path).
        Falls back to legacy 3-eval score check only when no IRT data exists.
        """

        if lifecycle.retention_state != "not_started":
            logger.info(
                f"[MASTERY_ENGINE] Lesson eval for {lifecycle.subskill_id} "
                f"at state={lifecycle.retention_state} — no lifecycle effect"
            )
            return lifecycle

        # Track lesson eval count (for display/legacy compat)
        if passed:
            lifecycle.lesson_eval_count += 1

        # --- IRT-derived gate check ---
        if (theta is not None and sigma is not None
                and min_beta is not None and max_beta is not None):
            irt_gate, irt_rs, irt_p = derive_gate_from_irt(
                theta, sigma, min_beta, max_beta, avg_a or 1.4,
            )

            if irt_gate >= 1:
                self._activate_retention(lifecycle, timestamp, theta, sigma, skill_beta_median)
                logger.info(
                    f"[MASTERY_ENGINE] ACTIVE (IRT) for {lifecycle.subskill_id} — "
                    f"gate={irt_gate}, P={irt_p:.3f}, θ={theta:.2f}, σ={sigma:.3f}"
                )
            else:
                logger.info(
                    f"[MASTERY_ENGINE] IRT gate check not met for {lifecycle.subskill_id} — "
                    f"P={irt_p:.3f}, θ={theta:.2f}, σ={sigma:.3f}"
                )
        else:
            logger.warning(
                f"[MASTERY_ENGINE] No IRT data for lesson eval on {lifecycle.subskill_id} — "
                f"no lifecycle effect (θ={theta}, σ={sigma}, min_β={min_beta}, max_β={max_beta})"
            )

        return lifecycle

    def _activate_retention(
        self,
        lifecycle: MasteryLifecycle,
        timestamp: str,
        theta: Optional[float] = None,
        sigma: Optional[float] = None,
        skill_beta_median: Optional[float] = None,
    ) -> None:
        """Transition from not_started to active (replaces Gate 0→1 + retest scheduling)."""
        # Retention model state
        lifecycle.retention_state = "active"
        lifecycle.stability = INITIAL_STABILITY
        lifecycle.last_reviewed = timestamp
        lifecycle.review_count = 0

        # Backward-compat gate fields
        lifecycle.current_gate = MasteryGate.INITIAL_MASTERY
        lifecycle.completion_pct = 0.25
        lifecycle.gate_mode = "probability" if theta is not None else "legacy"

        if theta is not None:
            lifecycle.theta_at_gate_entry = theta
        if sigma is not None:
            lifecycle.sigma_at_gate_entry = sigma
        if skill_beta_median is not None:
            lifecycle.gate_theta_threshold = skill_beta_median

        # Legacy retest fields — kept for any consumers still reading them
        base_interval, _ = RETEST_INTERVALS[(1, 2)]
        retest_date = datetime.fromisoformat(timestamp) + timedelta(days=base_interval)
        lifecycle.next_retest_eligible = retest_date.isoformat()
        lifecycle.retest_interval_days = base_interval

    # ------------------------------------------------------------------
    # Practice-mode handler — Stability updates (replaces Gates 1-4)
    # ------------------------------------------------------------------

    def _handle_practice_eval(
        self,
        lifecycle: MasteryLifecycle,
        score: float,
        passed: bool,
        timestamp: str,
        now: datetime,
        global_pass_rate: float,
        *,
        theta: Optional[float] = None,
        sigma: Optional[float] = None,
        item_beta: Optional[float] = None,
        avg_a: Optional[float] = None,
        skill_beta_median: Optional[float] = None,
    ) -> MasteryLifecycle:
        """
        Unified eval handler — activation + gate advancement in one pass.

        Gate and retention state are derived directly from IRT (θ+σ) via
        derive_gate_from_irt(). Gate checks P(correct) at the item's actual
        β (the mode selected for this student), not the primitive's hardest mode.

        If the subskill is not_started and IRT qualifies for gate >= 1,
        activates retention and then derives the full gate in one step
        (a gifted student can go from G0 straight to G4 if θ+σ warrant it).
        """
        was_not_started = lifecycle.retention_state == "not_started"

        # Track pass/fail for actuarial completion factor (continuous weight)
        # A score of 8.5 contributes 0.85 to passes and 0.15 to fails
        weight = score / 10.0
        lifecycle.passes += weight
        lifecycle.fails += (1.0 - weight)

        lifecycle.last_reviewed = timestamp
        lifecycle.review_count += 1

        # --- IRT-derived gate (primary path) ---
        if (theta is not None and sigma is not None
                and item_beta is not None):
            a = avg_a or 1.4

            old_gate = lifecycle.current_gate
            old_rs = lifecycle.retention_state

            # Compute empirical pass rate for credibility blend
            total_attempts = lifecycle.passes + lifecycle.fails
            emp_p = (lifecycle.passes / total_attempts) if total_attempts > 0 else None
            n_obs = lifecycle.review_count

            irt_gate, irt_rs, irt_p = derive_gate_from_irt(
                theta, sigma, item_beta, a,
                empirical_p=emp_p,
                n_observations=n_obs,
            )

            # Activate retention if not_started and IRT qualifies
            if was_not_started and irt_gate >= 1:
                self._activate_retention(lifecycle, timestamp, theta, sigma, skill_beta_median)
                logger.info(
                    f"[MASTERY_ENGINE] ACTIVATED (IRT) {lifecycle.subskill_id} — "
                    f"P={irt_p:.3f}, θ={theta:.2f}, σ={sigma:.3f}"
                )
            elif was_not_started:
                # IRT doesn't qualify yet — skip gate advancement
                logger.info(
                    f"[MASTERY_ENGINE] IRT gate check not met for {lifecycle.subskill_id} — "
                    f"P={irt_p:.3f}, θ={theta:.2f}, σ={sigma:.3f}"
                )
                return lifecycle

            # IRT-derived gate can only advance or hold — never regress on a
            # single eval. A bad score lowers θ (via CalibrationEngine), which
            # naturally lowers the derived gate on the NEXT eval. This prevents
            # jarring gate drops from momentary slips.
            if irt_gate >= lifecycle.current_gate:
                lifecycle.current_gate = irt_gate
                lifecycle.retention_state = irt_rs

            # Derive stability from gate for backward-compat consumers
            lifecycle.stability = GATE_TO_STABILITY.get(
                lifecycle.current_gate, INITIAL_STABILITY
            )

            if lifecycle.retention_state == "mastered":
                lifecycle.next_retest_eligible = None
                lifecycle.retest_interval_days = 0
            else:
                retest_days = max(1, round(lifecycle.stability))
                retest_date = datetime.fromisoformat(timestamp) + timedelta(
                    days=retest_days,
                )
                lifecycle.next_retest_eligible = retest_date.isoformat()
                lifecycle.retest_interval_days = retest_days

            logger.info(
                f"[MASTERY_ENGINE] IRT update for "
                f"{lifecycle.subskill_id}: gate {old_gate}→{lifecycle.current_gate}, "
                f"state {old_rs}→{lifecycle.retention_state}, "
                f"P={irt_p:.3f}, θ={theta:.2f}, σ={sigma:.3f}, score={score}"
            )

        else:
            if was_not_started:
                logger.warning(
                    f"[MASTERY_ENGINE] No IRT data for eval on not_started "
                    f"{lifecycle.subskill_id} — cannot activate "
                    f"(θ={theta}, σ={sigma}, item_beta={item_beta})"
                )
                return lifecycle
            logger.warning(
                f"[MASTERY_ENGINE] No IRT data for eval on "
                f"{lifecycle.subskill_id} — no gate update "
                f"(θ={theta}, σ={sigma}, item_beta={item_beta})"
            )

        # Recalculate actuarial completion factor
        lifecycle = self._recalculate_completion_factor(lifecycle, global_pass_rate)

        return lifecycle

    # ------------------------------------------------------------------
    # Probability-based gate check (2PL/3PL ADAPT model)
    # Only used for Gate 0→1 (not_started → active) now.
    # ------------------------------------------------------------------

    @staticmethod
    def _check_probability_gate(
        target_gate: int,
        theta: float,
        sigma: float,
        min_beta: float,
        max_beta: float,
        avg_a: float = 1.4,
    ) -> bool:
        """
        Check if a student passes a gate using P(correct) at a reference difficulty.

        Gate pass condition:
          P(correct | ref_b, avg_a) >= p_threshold  AND  sigma <= sigma_max

        Where ref_b = min_beta + (max_beta - min_beta) * ref_fraction.
        """
        p_threshold = GATE_P_THRESHOLDS.get(target_gate, 0.90)
        ref_fraction = GATE_REF_FRACTIONS.get(target_gate, 1.0)
        sigma_max = GATE_SIGMA_THRESHOLDS.get(target_gate, 0.8)

        ref_beta = min_beta + (max_beta - min_beta) * ref_fraction
        p = p_correct(theta, avg_a, ref_beta)

        gate_passed = p >= p_threshold and sigma <= sigma_max

        logger.info(
            f"[MASTERY_ENGINE] Probability gate check: gate={target_gate}, "
            f"P(correct)={p:.3f} vs threshold={p_threshold}, "
            f"ref_beta={ref_beta:.2f} (fraction={ref_fraction}), "
            f"sigma={sigma:.3f} vs max={sigma_max}, avg_a={avg_a:.2f} "
            f"→ {'PASS' if gate_passed else 'FAIL'}"
        )

        return gate_passed

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
