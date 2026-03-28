"""
Calibration Engine

Implements inline incremental IRT-based item calibration (β) and student
ability estimation (θ) using the 2PL/3PL model from the Pulse IRT
Probability System project plan.

Entry point:  process_submission()
Called from:   CompetencyService.update_competency_from_problem() as a hook

Core formulas:
  P(correct) = c + (1 - c) / (1 + exp(-a(θ - b)))
  I(θ) = a² × (P - c)² × (1 - P) / (P × (1 - c)²)
"""

import asyncio
import logging
import math
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from ..db.firestore_service import FirestoreService
from ..models.calibration import (
    DEFAULT_STUDENT_THETA,
    DEFAULT_THETA_SIGMA,
    ITEM_CREDIBILITY_STANDARD,
    MAX_THETA_HISTORY,
    THETA_GRID_MAX,
    THETA_GRID_MIN,
    THETA_GRID_STEP,
    THETA_PROCESS_NOISE,
    ItemCalibration,
    PrimitiveGateProgress,
    StudentAbility,
    ThetaHistoryEntry,
    compute_gate_from_theta,
    compute_gate_thresholds,
)
from .calibration.problem_type_registry import (
    get_item_discrimination,
    get_item_key,
    get_primitive_beta_range,
    get_prior_beta,
)

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# 2PL/3PL core functions (module-level for reuse by other services)
# ------------------------------------------------------------------

def p_correct(theta: float, a: float, b: float, c: float = 0.0) -> float:
    """3PL probability of correct response.

    P(correct) = c + (1 - c) / (1 + exp(-a(θ - b)))
    """
    logit = max(-20.0, min(20.0, a * (theta - b)))
    return c + (1.0 - c) / (1.0 + math.exp(-logit))


def item_information(theta: float, a: float, b: float, c: float = 0.0) -> float:
    """Fisher information for a 2PL/3PL item.

    I(θ) = a² × (P - c)² × (1 - P) / (P × (1 - c)²)
    Higher = more measurement value at this θ.
    """
    p = p_correct(theta, a, b, c)
    q = 1.0 - p
    if p <= c or q <= 0:
        return 0.0
    return (a ** 2) * ((p - c) ** 2) * q / (p * ((1.0 - c) ** 2))


class CalibrationEngine:
    """
    Stateless service that processes submissions and maintains item
    calibration (β) + student ability (θ) documents in Firestore.

    Mirrors MasteryLifecycleEngine: __init__(firestore_service),
    single async entry point, pure-computation internal methods,
    Firestore persistence at the end.
    """

    def __init__(self, firestore_service: FirestoreService):
        self.firestore = firestore_service
        logger.info("CalibrationEngine initialized")

    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------

    async def process_submission(
        self,
        student_id: int,
        skill_id: str,
        subskill_id: str,
        primitive_type: str,
        eval_mode: str,
        score: float,
        source: str = "practice",
        *,
        prefetched_ability: Optional[Dict] = None,
        prefetched_item_calibration: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        """
        Process a single submission: update item β and student θ inline.

        Args:
            student_id:     Student identifier.
            skill_id:       Curriculum skill ID (e.g., "K.OA.A.1").
            subskill_id:    Curriculum subskill ID.
            primitive_type: Lumina primitive type (e.g., "ten-frame").
            eval_mode:      Evaluation mode (e.g., "subitize").
            score:          Score on 0–10 scale.
            source:         "lesson" | "practice".
            prefetched_ability: Pre-loaded ability doc to skip a Firestore read.
            prefetched_item_calibration: Pre-loaded item calibration doc to skip
                a Firestore read. Useful when multiple items share the same
                primitive_type+eval_mode within a session.

        Returns:
            Dict with updated calibrated_beta, credibility_z,
            student_theta, and earned_level.
        """
        now = datetime.now(timezone.utc)
        # Continuous response weight: 0.0 (wrong) to 1.0 (perfect)
        # Replaces the old binary is_correct = score >= 9.0
        response_weight = max(0.0, min(1.0, score / 10.0))
        item_key = get_item_key(primitive_type, eval_mode)

        logger.info(
            f"[CALIBRATION] Processing: student={student_id}, "
            f"item={item_key}, score={score}, weight={response_weight:.2f}"
        )

        # 1. Fetch or create student ability doc (skip read if pre-fetched)
        if prefetched_ability is not None:
            ability = StudentAbility(**prefetched_ability)
        else:
            ability = await self._get_or_create_ability(student_id, skill_id)

        # 2. Fetch or create item calibration doc (skip read if pre-fetched)
        if prefetched_item_calibration is not None:
            item_cal = ItemCalibration(**prefetched_item_calibration)
        else:
            item_cal = await self._get_or_create_item_calibration(
                item_key, primitive_type, eval_mode
            )

        # 3. Update item β (uses student's current θ for ability adjustment)
        item_cal = self._update_item_beta(item_cal, ability.theta, response_weight)

        # 4. Update student θ (uses item's calibrated β with 2PL/3PL likelihood)
        ability = self._update_student_theta(
            ability, item_cal.calibrated_beta, response_weight,
            now, primitive_type, eval_mode, score,
            item_a=item_cal.discrimination_a,
            item_c=item_cal.guessing_c,
        )

        # 5. Persist both documents (parallel — independent writes)
        await asyncio.gather(
            self.firestore.upsert_item_calibration(
                item_key, item_cal.model_dump()
            ),
            self.firestore.upsert_student_ability(
                student_id, skill_id, ability.model_dump()
            ),
        )

        # 6. Compute per-primitive gate progress
        gate_progress = self.get_gate_progress(primitive_type, ability.theta)

        # 7. Compute P(correct) and item information at current θ
        p_corr = p_correct(
            ability.theta, item_cal.discrimination_a,
            item_cal.calibrated_beta, item_cal.guessing_c,
        )
        info = item_information(
            ability.theta, item_cal.discrimination_a,
            item_cal.calibrated_beta, item_cal.guessing_c,
        )

        logger.info(
            f"[CALIBRATION] Result: item_beta={item_cal.calibrated_beta:.2f} "
            f"(Z={item_cal.credibility_z:.3f}, a={item_cal.discrimination_a:.2f}), "
            f"student_theta={ability.theta:.2f}, "
            f"P(correct)={p_corr:.3f}, I(θ)={info:.3f}, "
            f"EL={ability.earned_level:.1f}, "
            f"gate={gate_progress.current_gate}/4"
        )

        return {
            "item_key": item_key,
            "calibrated_beta": item_cal.calibrated_beta,
            "credibility_z": item_cal.credibility_z,
            "discrimination_a": item_cal.discrimination_a,
            "guessing_c": item_cal.guessing_c,
            "student_theta": ability.theta,
            "sigma": ability.sigma,
            "earned_level": ability.earned_level,
            "p_correct": round(p_corr, 4),
            "item_information": round(info, 4),
            "gate_progress": gate_progress.model_dump(),
            "ability_doc": ability.model_dump(),
            "item_calibration_doc": item_cal.model_dump(),
        }

    # ------------------------------------------------------------------
    # Skill-level beta median (for theta-based mastery gates)
    # ------------------------------------------------------------------

    @staticmethod
    def compute_skill_beta_median(ability: Optional[Dict] = None) -> float:
        """
        Compute the median item beta for a skill from the student's history.

        Uses the student's theta_history (which records primitive_type and
        eval_mode per observation) to find the prior betas of items they've
        actually been tested on. This makes the threshold student-specific:
        "your ability exceeds the difficulty of items you've been tested on."

        Falls back to DEFAULT_STUDENT_THETA (3.0) when no history exists.
        """
        if not ability:
            return DEFAULT_STUDENT_THETA

        history = ability.get("theta_history", [])
        if not history:
            return DEFAULT_STUDENT_THETA

        betas = []
        for entry in history:
            pt = entry.get("primitive_type")
            em = entry.get("eval_mode")
            if pt and em:
                betas.append(get_prior_beta(pt, em))

        if not betas:
            return DEFAULT_STUDENT_THETA

        betas.sort()
        n = len(betas)
        if n % 2 == 1:
            return betas[n // 2]
        return (betas[n // 2 - 1] + betas[n // 2]) / 2.0

    # ------------------------------------------------------------------
    # Per-primitive gate progress (PRD §6.5.4)
    # ------------------------------------------------------------------

    @staticmethod
    def get_gate_progress(
        primitive_type: str, theta: float
    ) -> PrimitiveGateProgress:
        """Compute gate progress for a student's theta on a given primitive."""
        min_beta, max_beta = get_primitive_beta_range(primitive_type)
        thresholds = compute_gate_thresholds(min_beta, max_beta)
        current_gate = compute_gate_from_theta(theta, thresholds)

        next_gate = None
        next_gate_theta = None
        gate_values = [thresholds.g1, thresholds.g2, thresholds.g3, thresholds.g4]
        if current_gate < 4:
            next_gate = current_gate + 1
            next_gate_theta = gate_values[current_gate]

        return PrimitiveGateProgress(
            primitive_type=primitive_type,
            current_gate=current_gate,
            thresholds=thresholds,
            theta=theta,
            next_gate=next_gate,
            next_gate_theta=next_gate_theta,
            min_beta=min_beta,
            max_beta=max_beta,
        )

    # ------------------------------------------------------------------
    # Item calibration update (PRD §5.2)
    # ------------------------------------------------------------------

    # Empirical a calibration constants (Phase 6.2)
    A_CREDIBILITY_K = 30         # Bühlmann credibility standard for a
    A_MIN_OBSERVATIONS = 20      # minimum obs before computing empirical a
    A_MIN_P_OBS = 0.1            # minimum observed p(correct) for stable r_pb
    A_MAX_P_OBS = 0.9            # maximum observed p(correct) for stable r_pb
    A_CLAMP_MIN = 0.3            # minimum allowed discrimination
    A_CLAMP_MAX = 3.0            # maximum allowed discrimination

    def _update_item_beta(
        self,
        item: ItemCalibration,
        student_theta: float,
        response_weight: float,
    ) -> ItemCalibration:
        """Update item difficulty and discrimination using credibility-weighted IRT.

        Uses continuous response weights (0-1) instead of binary correct/incorrect.
        total_correct accumulates fractional weights for MLE β estimation.

        Phase 6 upgrades:
        - 6.1: 2PL-adjusted β MLE (divides log-odds by a)
        - 6.2: Empirical a via point-biserial correlation with credibility blending
        """
        # Increment counters — total_correct accumulates continuous weights
        item.total_observations += 1
        item.total_correct += response_weight
        item.sum_correct_theta += response_weight * student_theta
        item.sum_respondent_theta += student_theta
        item.sum_theta_squared += student_theta ** 2

        # --- β update (6.1: 2PL-adjusted MLE) ---
        n = item.total_observations
        correct = item.total_correct      # now a float (sum of weights)
        incorrect = n - correct
        mean_theta = item.sum_respondent_theta / n

        if correct > 0.01 and incorrect > 0.01:
            # 2PL MLE: β = mean(θ) - (1/a) × ln(correct / incorrect)
            a = max(0.3, item.discrimination_a)
            item.empirical_beta = mean_theta - (1.0 / a) * math.log(correct / incorrect)
        elif correct <= 0.01:
            item.empirical_beta = mean_theta + 2.0
        else:
            item.empirical_beta = mean_theta - 2.0

        item.empirical_beta = max(0.0, min(10.0, item.empirical_beta))

        # β credibility blending (PRD §5.2)
        item.credibility_z = min(1.0, math.sqrt(n / ITEM_CREDIBILITY_STANDARD))
        z = item.credibility_z
        item.calibrated_beta = round(
            z * item.empirical_beta + (1 - z) * item.prior_beta, 3
        )
        item.calibrated_beta = max(0.0, min(10.0, item.calibrated_beta))

        # --- Empirical a update (6.2: point-biserial correlation) ---
        self._update_empirical_a(item)

        item.updated_at = datetime.now(timezone.utc).isoformat()
        return item

    def _update_empirical_a(self, item: ItemCalibration) -> None:
        """Compute empirical discrimination via weighted correlation.

        With continuous response weights, this generalizes point-biserial
        correlation: sum_correct_theta accumulates weight × θ, and
        total_correct accumulates weights. The formula produces a weighted
        mean-difference estimate of discrimination.

        Requires sufficient observations (≥20) with non-extreme average
        weights (0.1 < avg_weight < 0.9) and positive θ variance.
        Uses Bühlmann credibility blending (k=30).
        """
        n = item.total_observations
        if n < self.A_MIN_OBSERVATIONS:
            return

        p_obs = item.total_correct / n  # average response weight
        if p_obs <= self.A_MIN_P_OBS or p_obs >= self.A_MAX_P_OBS:
            return

        incorrect = n - item.total_correct  # sum of (1 - weight)
        if incorrect < 0.01:
            return

        mean_correct = item.sum_correct_theta / item.total_correct
        mean_incorrect = (item.sum_respondent_theta - item.sum_correct_theta) / incorrect
        theta_variance = (item.sum_theta_squared / n) - (item.sum_respondent_theta / n) ** 2

        if theta_variance <= 0.01:
            # Too little θ variance — can't estimate discrimination
            return

        # Point-biserial correlation
        r_pb = ((mean_correct - mean_incorrect) / math.sqrt(theta_variance)
                * math.sqrt(p_obs * (1.0 - p_obs)))

        # Clamp r_pb to avoid division by zero in Lord's formula
        r_pb = max(-0.95, min(0.95, r_pb))
        if r_pb <= 0:
            # Negative or zero correlation — item doesn't discriminate; keep prior
            return

        # Lord's formula: convert correlation to IRT discrimination
        a_empirical = r_pb * 1.7 / math.sqrt(1.0 - r_pb ** 2)
        a_empirical = max(self.A_CLAMP_MIN, min(self.A_CLAMP_MAX, a_empirical))

        # Bühlmann credibility blending: blend empirical a with categorical prior
        z_a = n / (n + self.A_CREDIBILITY_K)
        prior_a, _ = get_item_discrimination(item.primitive_type, item.eval_mode)

        a_updated = z_a * a_empirical + (1.0 - z_a) * prior_a
        a_updated = max(self.A_CLAMP_MIN, min(self.A_CLAMP_MAX, round(a_updated, 3)))

        if abs(a_updated - item.discrimination_a) > 0.001:
            logger.info(
                f"[CALIBRATION] Empirical a update for {item.primitive_type}/{item.eval_mode}: "
                f"a={item.discrimination_a:.3f} -> {a_updated:.3f} "
                f"(r_pb={r_pb:.3f}, a_emp={a_empirical:.3f}, Z={z_a:.3f}, n={n})"
            )

        item.discrimination_a = a_updated
        item.a_credibility = round(z_a, 3)
        item.a_source = "empirical" if z_a > 0.5 else "categorical_prior"

    # ------------------------------------------------------------------
    # Student θ update via grid-approximation EAP (PRD §6.1–6.2)
    # ------------------------------------------------------------------

    def _update_student_theta(
        self,
        ability: StudentAbility,
        item_beta: float,
        response_weight: float,
        now: datetime,
        primitive_type: str,
        eval_mode: str,
        score: float,
        item_a: float = 1.0,
        item_c: float = 0.0,
    ) -> StudentAbility:
        """Update student ability using Bayesian grid-approximation EAP with
        continuous Beta response model.

        Instead of binary correct/incorrect, uses:
            L(x|θ) = P(θ)^x × (1 - P(θ))^(1-x)
        where x = response_weight ∈ [0, 1].

        This naturally interpolates: x=1.0 is fully correct, x=0.0 is fully
        wrong, x=0.85 (score 8.5) is mostly correct with partial pull.
        """
        # Build grid: 0.0, 0.1, 0.2, ..., 10.0 (101 points)
        grid_size = int((THETA_GRID_MAX - THETA_GRID_MIN) / THETA_GRID_STEP) + 1
        grid_points = [
            round(THETA_GRID_MIN + i * THETA_GRID_STEP, 1)
            for i in range(grid_size)
        ]

        # Conditional process noise: only inflate σ when the model is
        # underestimating the student (mismatch detected). When the model
        # is accurate, let σ converge normally so mastery confirmation
        # doesn't take forever.
        prior_sigma = ability.sigma
        if self._has_model_mismatch(ability, item_a, item_beta, item_c):
            prior_sigma = math.sqrt(ability.sigma ** 2 + THETA_PROCESS_NOISE ** 2)

        # Prior: normal distribution centered on current θ
        prior = []
        for theta in grid_points:
            z = (theta - ability.theta) / prior_sigma
            prior.append(math.exp(-0.5 * z * z))

        # Normalize prior
        prior_sum = sum(prior)
        if prior_sum > 0:
            prior = [p / prior_sum for p in prior]

        # Likelihood: continuous Beta response model
        # L(x|θ) = P(θ)^x × (1-P(θ))^(1-x)
        # Clamp x away from exact 0/1 for numerical stability
        x = max(1e-6, min(1.0 - 1e-6, response_weight))
        likelihood = []
        for theta in grid_points:
            p = p_correct(theta, item_a, item_beta, item_c)
            p = max(1e-10, min(1.0 - 1e-10, p))
            likelihood.append(p ** x * (1.0 - p) ** (1.0 - x))

        # Posterior ∝ prior × likelihood
        posterior = [pr * lk for pr, lk in zip(prior, likelihood)]
        posterior_sum = sum(posterior)
        if posterior_sum > 0:
            posterior = [p / posterior_sum for p in posterior]
        else:
            # Fallback: keep prior unchanged
            posterior = prior

        # EAP: weighted mean of grid
        new_theta = sum(t * p for t, p in zip(grid_points, posterior))
        new_theta = round(max(0.0, min(10.0, new_theta)), 2)

        # Posterior σ: weighted standard deviation
        variance = sum(
            p * (t - new_theta) ** 2
            for t, p in zip(grid_points, posterior)
        )
        new_sigma = round(max(0.1, min(5.0, math.sqrt(variance))), 3)

        # 6.3: Adaptive σ floor — model-mismatch detection
        # When a student consistently outperforms the model's predictions,
        # inflate σ to allow faster θ movement (breaks the σ death spiral).
        new_sigma = self._apply_sigma_floor(
            ability, new_sigma, item_a, item_beta, item_c,
        )

        # Earned Level = round(θ, 1) (PRD §6.3)
        new_el = round(new_theta, 1)

        # Update ability document
        ability.theta = new_theta
        ability.sigma = new_sigma
        ability.earned_level = new_el
        ability.total_items_seen += 1

        # Append to history (capped at MAX_THETA_HISTORY)
        ability.theta_history.append(
            ThetaHistoryEntry(
                theta=new_theta,
                earned_level=new_el,
                timestamp=now.isoformat(),
                primitive_type=primitive_type,
                eval_mode=eval_mode,
                score=score,
            )
        )
        if len(ability.theta_history) > MAX_THETA_HISTORY:
            ability.theta_history = ability.theta_history[-MAX_THETA_HISTORY:]

        ability.updated_at = now.isoformat()
        return ability

    # ------------------------------------------------------------------
    # σ floor: model-mismatch detection (Phase 6.3)
    # ------------------------------------------------------------------

    MISMATCH_WINDOW = 10       # look-back window (items)
    MISMATCH_MIN_ITEMS = 5     # minimum items before checking
    MISMATCH_THRESHOLD = 0.15  # actual - predicted threshold
    MISMATCH_SIGMA_FLOOR = 0.5 # σ floor when mismatch detected

    @staticmethod
    def _compute_mismatch(
        ability: StudentAbility,
        item_a: float,
        item_beta: float,
        item_c: float,
    ) -> float:
        """Compute actual - predicted accuracy over recent items.

        Uses continuous response weights (score/10) instead of binary threshold.
        Returns 0 if insufficient data.
        """
        recent = ability.theta_history[-CalibrationEngine.MISMATCH_WINDOW:]
        if len(recent) < CalibrationEngine.MISMATCH_MIN_ITEMS:
            return 0.0

        predicted_sum = 0.0
        actual_sum = 0.0
        for h in recent:
            predicted_sum += p_correct(h.theta, item_a, item_beta, item_c)
            actual_sum += (h.score / 10.0) if h.score is not None else 0.0

        n = len(recent)
        return (actual_sum / n) - (predicted_sum / n)

    @staticmethod
    def _has_model_mismatch(
        ability: StudentAbility,
        item_a: float,
        item_beta: float,
        item_c: float,
    ) -> bool:
        """Check if the student is consistently outperforming predictions."""
        return CalibrationEngine._compute_mismatch(
            ability, item_a, item_beta, item_c,
        ) > CalibrationEngine.MISMATCH_THRESHOLD

    @staticmethod
    def _apply_sigma_floor(
        ability: StudentAbility,
        new_sigma: float,
        item_a: float,
        item_beta: float,
        item_c: float,
    ) -> float:
        """Inflate σ when the student consistently outperforms model predictions.

        Checks the last N items in theta_history: if actual accuracy exceeds
        predicted P(correct) by more than MISMATCH_THRESHOLD, σ is floored
        to allow faster θ movement. This prevents the "σ death spiral" where
        an overconfident model traps θ at a plateau.
        """
        mismatch = CalibrationEngine._compute_mismatch(
            ability, item_a, item_beta, item_c,
        )
        if mismatch > CalibrationEngine.MISMATCH_THRESHOLD:
            floored = max(new_sigma, CalibrationEngine.MISMATCH_SIGMA_FLOOR)
            if floored > new_sigma:
                logger.info(
                    f"[CALIBRATION] Model-mismatch detected: "
                    f"mismatch={mismatch:.2f}, "
                    f"inflating sigma {new_sigma:.3f} -> {floored:.3f}"
                )
            return floored

        return new_sigma

    # ------------------------------------------------------------------
    # Fetch / create helpers
    # ------------------------------------------------------------------

    async def _get_or_create_ability(
        self,
        student_id: int,
        skill_id: str,
    ) -> StudentAbility:
        """Get existing ability doc or create with default prior."""
        existing = await self.firestore.get_student_ability(
            student_id, skill_id
        )
        if existing:
            return StudentAbility(**existing)
        return StudentAbility(student_id=student_id, skill_id=skill_id)

    async def _get_or_create_item_calibration(
        self,
        item_key: str,
        primitive_type: str,
        eval_mode: str,
    ) -> ItemCalibration:
        """Get existing item calibration doc or create with prior β and a/c."""
        existing = await self.firestore.get_item_calibration(item_key)
        if existing:
            return ItemCalibration(**existing)
        prior_beta = get_prior_beta(primitive_type, eval_mode)
        disc_a, guess_c = get_item_discrimination(primitive_type, eval_mode)
        return ItemCalibration(
            primitive_type=primitive_type,
            eval_mode=eval_mode,
            prior_beta=prior_beta,
            calibrated_beta=prior_beta,
            discrimination_a=disc_a,
            guessing_c=guess_c,
            a_source="categorical_prior",
        )
