"""
Calibration Engine

Implements inline incremental IRT-based item calibration (β) and student
ability estimation (θ) from the Difficulty Calibration PRD §5–6.

Entry point:  process_submission()
Called from:   CompetencyService.update_competency_from_problem() as a hook

This is Phase 1: parallel system. θ/EL are stored but do not affect
mastery gates or the planning service (PRD §6.5.2 — Option B).
"""

import logging
import math
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from ..db.firestore_service import FirestoreService
from ..models.calibration import (
    DEFAULT_STUDENT_THETA,
    DEFAULT_THETA_SIGMA,
    IRT_CORRECT_THRESHOLD,
    ITEM_CREDIBILITY_STANDARD,
    MAX_THETA_HISTORY,
    THETA_GRID_MAX,
    THETA_GRID_MIN,
    THETA_GRID_STEP,
    ItemCalibration,
    StudentAbility,
    ThetaHistoryEntry,
)
from .calibration.problem_type_registry import get_item_key, get_prior_beta

logger = logging.getLogger(__name__)


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

        Returns:
            Dict with updated calibrated_beta, credibility_z,
            student_theta, and earned_level.
        """
        now = datetime.now(timezone.utc)
        is_correct = score >= IRT_CORRECT_THRESHOLD
        item_key = get_item_key(primitive_type, eval_mode)

        logger.info(
            f"[CALIBRATION] Processing: student={student_id}, "
            f"item={item_key}, score={score}, correct={is_correct}"
        )

        # 1. Fetch or create student ability doc
        ability = await self._get_or_create_ability(student_id, skill_id)

        # 2. Fetch or create item calibration doc
        item_cal = await self._get_or_create_item_calibration(
            item_key, primitive_type, eval_mode
        )

        # 3. Update item β (uses student's current θ for ability adjustment)
        item_cal = self._update_item_beta(item_cal, ability.theta, is_correct)

        # 4. Update student θ (uses item's calibrated β)
        ability = self._update_student_theta(
            ability, item_cal.calibrated_beta, is_correct,
            now, primitive_type, eval_mode, score,
        )

        # 5. Persist both documents
        await self.firestore.upsert_item_calibration(
            item_key, item_cal.model_dump()
        )
        await self.firestore.upsert_student_ability(
            student_id, skill_id, ability.model_dump()
        )

        logger.info(
            f"[CALIBRATION] Result: item_beta={item_cal.calibrated_beta:.2f} "
            f"(Z={item_cal.credibility_z:.3f}), "
            f"student_theta={ability.theta:.2f}, "
            f"EL={ability.earned_level:.1f}"
        )

        return {
            "item_key": item_key,
            "calibrated_beta": item_cal.calibrated_beta,
            "credibility_z": item_cal.credibility_z,
            "student_theta": ability.theta,
            "earned_level": ability.earned_level,
        }

    # ------------------------------------------------------------------
    # Item calibration update (PRD §5.2)
    # ------------------------------------------------------------------

    def _update_item_beta(
        self,
        item: ItemCalibration,
        student_theta: float,
        is_correct: bool,
    ) -> ItemCalibration:
        """Update item difficulty using credibility-weighted IRT."""
        # Increment counters
        item.total_observations += 1
        if is_correct:
            item.total_correct += 1
        item.sum_respondent_theta += student_theta

        # Compute empirical beta via log-odds adjusted for ability
        n = item.total_observations
        c = item.total_correct
        f = n - c  # total incorrect
        mean_theta = item.sum_respondent_theta / n

        if c > 0 and f > 0:
            # Standard 1PL MLE: β = mean(θ) - ln(correct / incorrect)
            item.empirical_beta = mean_theta - math.log(c / f)
        elif c == 0:
            # All incorrect — item is very hard
            item.empirical_beta = mean_theta + 2.0
        else:
            # All correct — item is very easy
            item.empirical_beta = mean_theta - 2.0

        # Clamp to scale
        item.empirical_beta = max(0.0, min(10.0, item.empirical_beta))

        # Credibility blending (PRD §5.2)
        item.credibility_z = min(1.0, math.sqrt(n / ITEM_CREDIBILITY_STANDARD))
        z = item.credibility_z
        item.calibrated_beta = round(
            z * item.empirical_beta + (1 - z) * item.prior_beta, 3
        )
        item.calibrated_beta = max(0.0, min(10.0, item.calibrated_beta))

        item.updated_at = datetime.now(timezone.utc).isoformat()
        return item

    # ------------------------------------------------------------------
    # Student θ update via grid-approximation EAP (PRD §6.1–6.2)
    # ------------------------------------------------------------------

    def _update_student_theta(
        self,
        ability: StudentAbility,
        item_beta: float,
        is_correct: bool,
        now: datetime,
        primitive_type: str,
        eval_mode: str,
        score: float,
    ) -> StudentAbility:
        """Update student ability using Bayesian grid-approximation EAP."""
        # Build grid: 0.0, 0.1, 0.2, ..., 10.0 (101 points)
        grid_size = int((THETA_GRID_MAX - THETA_GRID_MIN) / THETA_GRID_STEP) + 1
        grid_points = [
            round(THETA_GRID_MIN + i * THETA_GRID_STEP, 1)
            for i in range(grid_size)
        ]

        # Prior: normal distribution centered on current θ with current σ
        prior = []
        for theta in grid_points:
            z = (theta - ability.theta) / ability.sigma
            prior.append(math.exp(-0.5 * z * z))

        # Normalize prior
        prior_sum = sum(prior)
        if prior_sum > 0:
            prior = [p / prior_sum for p in prior]

        # Likelihood: 1PL Rasch model
        likelihood = []
        for theta in grid_points:
            logit = theta - item_beta
            # Clamp to avoid overflow in exp
            logit = max(-20.0, min(20.0, logit))
            p_correct = 1.0 / (1.0 + math.exp(-logit))
            likelihood.append(p_correct if is_correct else 1.0 - p_correct)

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
        """Get existing item calibration doc or create with prior β."""
        existing = await self.firestore.get_item_calibration(item_key)
        if existing:
            return ItemCalibration(**existing)
        prior_beta = get_prior_beta(primitive_type, eval_mode)
        return ItemCalibration(
            primitive_type=primitive_type,
            eval_mode=eval_mode,
            prior_beta=prior_beta,
            calibrated_beta=prior_beta,
        )
