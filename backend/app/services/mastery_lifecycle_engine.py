"""
Mastery Lifecycle Engine — Stability-Based Retention Model (PRD §16)

Replaces the 4-gate retest cycle (Gates 1-4) with continuous forgetting +
spaced review driven by information value.

Gate 0 → 1 transition preserved for initial mastery verification.
After that, stability tracks memory strength and reviews surface automatically
when P(correct) drops below TARGET_RETENTION.

Entry point:  process_eval_result()
Called from:   CompetencyService.update_competency_from_problem() as a hook

State model:
  not_started  → active   (3 lesson evals ≥ 9.0 OR probability gate)
  active       → mastered (stability > 30 days)
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
    GATE_1_MIN_LESSON_EVALS,
    GATE_P_THRESHOLDS,
    GATE_REF_FRACTIONS,
    GATE_SIGMA_THRESHOLDS,
    GATE_THETA_OFFSETS,
    GATE_TO_STABILITY,
    INITIAL_STABILITY,
    MASTERY_STABILITY_THRESHOLD,
    MASTERY_THRESHOLD,
    RETEST_INTERVALS,
    STABILITY_GROWTH_PARTIAL,
    STABILITY_GROWTH_STRONG,
    STABILITY_SHRINK_FAIL,
    FAST_TRACK_P_THRESHOLD,
    FAST_TRACK_SIGMA_MAX,
    FAST_TRACK_STABILITY,
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
        theta: Optional[float] = None,
        sigma: Optional[float] = None,
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
            ability_doc = await self.firestore.get_student_ability(student_id, skill_id)
            skill_beta_median = CalibrationEngine.compute_skill_beta_median(ability_doc)

        # Compute beta range for probability-based gate checks
        min_beta: Optional[float] = None
        max_beta: Optional[float] = None
        if primitive_type:
            from .calibration.problem_type_registry import get_primitive_beta_range
            min_beta, max_beta = get_primitive_beta_range(primitive_type)

        # Route based on source
        if source == "lesson":
            lifecycle = self._handle_lesson_eval(
                lifecycle, score, passed, ts, theta, sigma, skill_beta_median,
                min_beta=min_beta, max_beta=max_beta, avg_a=avg_a,
            )
        elif source == "practice":
            # Fetch actual global pass rate for credibility blending (PRD 4.3)
            global_rate_data = await self.firestore.get_global_practice_pass_rate(student_id)
            global_rate = global_rate_data.get("global_practice_pass_rate", 0.8)
            lifecycle = self._handle_practice_eval(
                lifecycle, score, passed, ts, now, global_rate,
                theta=theta, sigma=sigma, primitive_type=primitive_type, avg_a=avg_a,
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
        """Handle a lesson-mode evaluation. Only affects not_started → active transition."""

        if lifecycle.retention_state != "not_started":
            logger.info(
                f"[MASTERY_ENGINE] Lesson eval for {lifecycle.subskill_id} "
                f"at state={lifecycle.retention_state} — no lifecycle effect"
            )
            return lifecycle

        # Still track lesson eval count (for display/legacy compat)
        if passed:
            lifecycle.lesson_eval_count += 1

        # --- Probability-based gate check (2PL/3PL ADAPT model) ---
        if (theta is not None and sigma is not None
                and min_beta is not None and max_beta is not None):
            gate_passed = self._check_probability_gate(
                target_gate=1, theta=theta, sigma=sigma,
                min_beta=min_beta, max_beta=max_beta,
                avg_a=avg_a or 1.4,
            )

            # Also check P(correct) alone (without sigma) for the fallback
            p_threshold = GATE_P_THRESHOLDS.get(1, 0.70)
            ref_fraction = GATE_REF_FRACTIONS.get(1, 0.0)
            ref_beta = min_beta + (max_beta - min_beta) * ref_fraction
            p = p_correct(theta, avg_a or 1.4, ref_beta)

            if gate_passed:
                self._activate_retention(lifecycle, timestamp, theta, sigma, skill_beta_median)
                logger.info(
                    f"[MASTERY_ENGINE] ACTIVE (probability mode) for {lifecycle.subskill_id} — "
                    f"theta={theta:.2f}, sigma={sigma:.3f}, stability={lifecycle.stability}"
                )
            elif (p >= p_threshold
                    and lifecycle.lesson_eval_count >= GATE_1_MIN_LESSON_EVALS):
                self._activate_retention(lifecycle, timestamp, theta, sigma, skill_beta_median)
                logger.info(
                    f"[MASTERY_ENGINE] ACTIVE (probability+lesson fallback) "
                    f"for {lifecycle.subskill_id} — P={p:.3f}>={p_threshold}, "
                    f"lesson_count={lifecycle.lesson_eval_count}"
                )
            else:
                logger.info(
                    f"[MASTERY_ENGINE] Probability gate check not met — "
                    f"P={p:.3f}, sigma={sigma:.3f}, "
                    f"lesson_eval_count={lifecycle.lesson_eval_count}"
                )

        # --- Theta-offset fallback (legacy theta mode) ---
        elif theta is not None and sigma is not None and skill_beta_median is not None:
            threshold = skill_beta_median + GATE_THETA_OFFSETS[1]
            sigma_max = GATE_SIGMA_THRESHOLDS[1]

            logger.info(
                f"[MASTERY_ENGINE] Theta gate check: theta={theta:.2f} vs "
                f"threshold={threshold:.2f} (β_median={skill_beta_median:.2f}), "
                f"sigma={sigma:.3f} vs max={sigma_max}"
            )

            if theta > threshold and sigma < sigma_max:
                self._activate_retention(lifecycle, timestamp, theta, sigma, skill_beta_median)
                logger.info(
                    f"[MASTERY_ENGINE] ACTIVE (theta mode) for {lifecycle.subskill_id} — "
                    f"theta={theta:.2f}, sigma={sigma:.3f}"
                )
        else:
            # --- Legacy fallback: score-based gate check ---
            if passed:
                logger.info(
                    f"[MASTERY_ENGINE] Lesson eval passed (legacy) — "
                    f"lesson_eval_count now {lifecycle.lesson_eval_count}/{GATE_1_MIN_LESSON_EVALS}"
                )
                if lifecycle.lesson_eval_count >= GATE_1_MIN_LESSON_EVALS:
                    self._activate_retention(lifecycle, timestamp, theta, sigma, skill_beta_median)
                    logger.info(
                        f"[MASTERY_ENGINE] ACTIVE (legacy) for {lifecycle.subskill_id}"
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
        primitive_type: Optional[str] = None,
        avg_a: Optional[float] = None,
    ) -> MasteryLifecycle:
        """
        Handle a practice-mode evaluation using the stability model.

        Instead of gate 1→2→3→4 calendar retests, stability grows or shrinks
        based on score. Reviews surface naturally via effective_theta decay.

        Ability-aware fast-track: if P(correct) on the hardest available mode
        exceeds FAST_TRACK_P_THRESHOLD (0.95), stability floors at
        FAST_TRACK_STABILITY (18.75) — skipping intermediate gates for students
        who demonstrably know the material.
        """
        if lifecycle.retention_state == "not_started":
            logger.info(
                f"[MASTERY_ENGINE] Practice eval at not_started — "
                f"no lifecycle effect (need initial mastery first)"
            )
            return lifecycle

        if lifecycle.retention_state == "mastered":
            logger.info(
                f"[MASTERY_ENGINE] Practice eval for {lifecycle.subskill_id} "
                f"already mastered — no lifecycle effect"
            )
            return lifecycle

        # --- Update stability based on score (PRD §16.4) ---
        old_stability = lifecycle.stability

        if score >= MASTERY_THRESHOLD:  # >= 9.0 — strong recall
            lifecycle.stability *= STABILITY_GROWTH_STRONG
            lifecycle.passes += 1
        elif score >= 7.0:  # partial recall
            lifecycle.stability *= STABILITY_GROWTH_PARTIAL
            lifecycle.passes += 1
        else:  # failed recall
            lifecycle.stability *= STABILITY_SHRINK_FAIL
            lifecycle.fails += 1

        # --- Ability-aware fast-track (multi-gate jump) ---
        # If the model predicts P(correct) >= 0.95 on the hardest mode AND
        # the student scored well, skip intermediate stability gates.
        # Only applies to strong-recall scores — partial/fail still grow normally.
        # Guard: σ must be below FAST_TRACK_SIGMA_MAX (1.0) so leapfrog-inferred
        # skills (σ=1.5) can't fast-track until the IRT model has enough real
        # observations to reduce uncertainty. This is the Pulse-native signal
        # for "we're confident this theta is earned, not fabricated."
        if (score >= MASTERY_THRESHOLD
                and theta is not None and primitive_type is not None
                and sigma is not None and sigma < FAST_TRACK_SIGMA_MAX):
            try:
                from .calibration.problem_type_registry import get_primitive_beta_range
                _, max_beta = get_primitive_beta_range(primitive_type)
                a = avg_a or 1.4
                p_hardest = p_correct(theta, a, max_beta)
                if p_hardest >= FAST_TRACK_P_THRESHOLD:
                    pre_fast = lifecycle.stability
                    lifecycle.stability = max(lifecycle.stability, FAST_TRACK_STABILITY)
                    if lifecycle.stability > pre_fast:
                        logger.info(
                            f"[MASTERY_ENGINE] FAST-TRACK for {lifecycle.subskill_id}: "
                            f"P(hardest)={p_hardest:.3f} >= {FAST_TRACK_P_THRESHOLD}, "
                            f"stability {pre_fast:.1f} → {lifecycle.stability:.1f}"
                        )
            except Exception as e:
                logger.debug(f"[MASTERY_ENGINE] Fast-track check skipped: {e}")

        lifecycle.last_reviewed = timestamp
        lifecycle.review_count += 1

        logger.info(
            f"[MASTERY_ENGINE] Stability update for {lifecycle.subskill_id}: "
            f"{old_stability:.1f} → {lifecycle.stability:.1f} "
            f"(score={score}, review_count={lifecycle.review_count})"
        )

        # --- Check mastery threshold (PRD §16.4) ---
        if lifecycle.stability > MASTERY_STABILITY_THRESHOLD:
            lifecycle.retention_state = "mastered"
            lifecycle.current_gate = MasteryGate.RETEST_3  # Gate 4 for backward compat
            lifecycle.next_retest_eligible = None
            lifecycle.retest_interval_days = 0
            logger.info(
                f"[MASTERY_ENGINE] MASTERED — {lifecycle.subskill_id} "
                f"stability={lifecycle.stability:.1f} > {MASTERY_STABILITY_THRESHOLD}"
            )
        else:
            # Update backward-compat gate field based on stability ranges
            if lifecycle.stability >= 18.75:
                lifecycle.current_gate = 3
            elif lifecycle.stability >= 7.5:
                lifecycle.current_gate = 2
            else:
                lifecycle.current_gate = 1

            # Update legacy retest eligible based on current stability
            # (reviews now surface by information value, not calendar,
            # but we keep this for any consumers still reading it)
            retest_date = datetime.fromisoformat(timestamp) + timedelta(
                days=lifecycle.stability
            )
            lifecycle.next_retest_eligible = retest_date.isoformat()
            lifecycle.retest_interval_days = max(1, round(lifecycle.stability))

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
