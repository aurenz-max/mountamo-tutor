# backend/app/services/velocity_service.py
"""
Velocity Service — Pipeline-Adjusted Mastery Progress Metric (PRD Section 15)

Computes the single most important progress metric: "Is this student on track?"

Key concepts:
  - Earned mastery:  closed skills at 1.0 + in-pipeline at completion_pct
  - Pipeline-adjusted expected mastery: expectations based on how long each skill
    has been in the pipeline (not just calendar time)
  - Velocity = earnedMastery / adjustedExpectedMastery
  - Decomposition: introduction / pass-through / closure velocities

Data source: mastery_lifecycle subcollection (unified — PRD §2).
"""

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from ..db.firestore_service import FirestoreService
from ..services.curriculum_service import CurriculumService
from ..models.planning import SchoolBreak, SchoolYearConfig
from ..models.velocity import (
    AggregateVelocity,
    PrimaryDriver,
    SchoolYearProgress,
    SubjectVelocity,
    VelocityDecomposition,
    VelocityResponse,
)

logger = logging.getLogger(__name__)


class VelocityService:
    """
    Stateless velocity calculator. Reads live Firestore mastery_lifecycle
    state and computes pipeline-adjusted mastery velocity on demand.
    """

    def __init__(
        self,
        firestore_service: FirestoreService,
        curriculum_service: CurriculumService,
    ):
        self.firestore = firestore_service
        self.curriculum = curriculum_service
        logger.info("VelocityService initialized")

    # ====================================================================
    # Main entry point
    # ====================================================================

    async def get_velocity(self, student_id: int) -> VelocityResponse:
        """
        Compute the full velocity report for a student.

        Returns aggregate + per-subject velocity with decomposition and trend.
        """
        today = date.today()

        # 1. School year context
        config = await self._get_school_year_config()
        year_start = date.fromisoformat(config.start_date)
        year_end = date.fromisoformat(config.end_date)
        total_days = (year_end - year_start).days or 1
        fraction_elapsed = min(max((today - year_start).days / total_days, 0.0), 1.0)
        weeks_completed = max(0, (today - year_start).days // 7)
        weeks_remaining = self._school_weeks_remaining(today, year_end, config.breaks)

        school_year = SchoolYearProgress(
            fractionElapsed=round(fraction_elapsed, 3),
            weeksCompleted=weeks_completed,
            weeksRemaining=weeks_remaining,
        )

        # 2. Load all mastery lifecycles
        all_lifecycles = await self.firestore.get_all_mastery_lifecycles(student_id)

        # 3. Get available subjects and their total skill counts
        subjects_list = await self.curriculum.get_available_subjects()
        subject_names: List[str] = []
        for s in subjects_list:
            if isinstance(s, dict):
                subject_names.append(s.get("subject_id") or s.get("subject_name", ""))
            else:
                subject_names.append(str(s))

        # 4. Load velocity history for trends
        history = await self.firestore.get_velocity_history(student_id, limit=8)

        # 5. Compute per-subject velocity
        subjects: Dict[str, SubjectVelocity] = {}
        total_earned = 0.0
        total_expected = 0.0

        for subj in subject_names:
            curriculum_data = await self.curriculum.get_curriculum(subj)
            total_skills = self._count_subskills(curriculum_data)

            if total_skills == 0:
                continue

            subj_lcs = [lc for lc in all_lifecycles if lc.get("subject") == subj]

            # Core calculations
            earned = self._compute_earned_mastery(subj_lcs)
            closed = sum(1 for lc in subj_lcs if lc.get("current_gate", 0) >= 4)
            in_review_earned = round(earned - closed, 2)
            adjusted_expected = self._compute_adjusted_expected(
                subj_lcs, total_skills, fraction_elapsed, today
            )

            velocity = round(earned / adjusted_expected, 3) if adjusted_expected > 0 else 1.0

            # Decomposition
            decomposition = self._compute_decomposition(
                subj_lcs, total_skills, fraction_elapsed, today
            )

            # Primary driver
            primary_driver = self._identify_primary_driver(decomposition, subj_lcs, today)

            # Trend: extract historical values for this subject, append current
            trend = self._extract_subject_trend(history, subj)
            trend.append(round(velocity, 2))

            total_earned += earned
            total_expected += adjusted_expected

            subjects[subj] = SubjectVelocity(
                totalSkills=total_skills,
                closed=closed,
                inReviewEarned=in_review_earned,
                earnedMastery=round(earned, 2),
                adjustedExpectedMastery=round(adjusted_expected, 2),
                velocity=velocity,
                trend=trend,
                decomposition=decomposition,
                primaryDriver=primary_driver,
            )

        # 6. Aggregate
        agg_velocity = round(total_earned / total_expected, 3) if total_expected > 0 else 1.0
        agg_trend = self._extract_aggregate_trend(history)
        agg_trend.append(round(agg_velocity, 2))

        aggregate = AggregateVelocity(
            earnedMastery=round(total_earned, 2),
            adjustedExpectedMastery=round(total_expected, 2),
            velocity=agg_velocity,
            trend=agg_trend,
        )

        return VelocityResponse(
            studentId=str(student_id),
            asOfDate=today.isoformat(),
            schoolYear=school_year,
            aggregate=aggregate,
            subjects=subjects,
        )

    # ====================================================================
    # Gate-to-status helper
    # ====================================================================

    @staticmethod
    def _derive_status(lc: Dict[str, Any]) -> str:
        """Derive a planning status from mastery lifecycle gate value."""
        gate = lc.get("current_gate", 0)
        if gate >= 4:
            return "closed"
        elif gate >= 1:
            return "in_review"
        elif lc.get("lesson_eval_count", 0) > 0:
            return "learning"
        return "not_started"

    # ====================================================================
    # Core calculations
    # ====================================================================

    @staticmethod
    def _compute_earned_mastery(lifecycles: List[Dict[str, Any]]) -> float:
        """
        Earned mastery = Σ 1.0 (closed) + Σ completion_pct (in-pipeline).

        Analogous to earned premium in insurance: credit for work done,
        including work in progress.
        """
        earned = 0.0
        for lc in lifecycles:
            gate = lc.get("current_gate", 0)
            if gate >= 4:
                earned += 1.0
            elif gate >= 1 or lc.get("lesson_eval_count", 0) > 0:
                earned += lc.get("completion_pct", 0.0)
        return earned

    @staticmethod
    def _compute_adjusted_expected(
        lifecycles: List[Dict[str, Any]],
        total_skills: int,
        fraction_elapsed: float,
        today: date,
    ) -> float:
        """
        Pipeline-adjusted expected mastery.

        For each introduced skill, the expected contribution depends on how
        long it has been in the pipeline:
          >= 4 weeks → 1.0  (should be at Gate 4 / closed)
          >= 2 weeks → 0.75 (should be at Gate 3)
          >= 1 week  → 0.50 (should be at Gate 2)
          <  1 week  → 0.25 (just entered pipeline)

        Timeline based on mastery lifecycle intervals:
          Gate 1→2: 3 days (~0.5 weeks)
          Gate 2→3: 7 days (~1 week)
          Gate 3→4: 14 days (~2 weeks)
          Total pipeline: 24 days (~3.5 weeks)
        """
        introduced = [
            lc for lc in lifecycles
            if lc.get("current_gate", 0) > 0 or lc.get("lesson_eval_count", 0) > 0
        ]
        adjusted = 0.0

        for lc in introduced:
            created = lc.get("created_at")
            if not created:
                adjusted += 0.25
                continue

            try:
                intro_date = date.fromisoformat(created[:10])
            except (ValueError, TypeError):
                adjusted += 0.25
                continue

            weeks_in_pipeline = (today - intro_date).days / 7.0

            if weeks_in_pipeline >= 4:
                adjusted += 1.0
            elif weeks_in_pipeline >= 2:
                adjusted += 0.75
            elif weeks_in_pipeline >= 1:
                adjusted += 0.50
            else:
                adjusted += 0.25

        # Account for skills that should have been introduced by now
        expected_introduced = total_skills * fraction_elapsed
        shortfall = max(0.0, expected_introduced - len(introduced))
        adjusted += shortfall * 0.5

        return adjusted

    @staticmethod
    def _compute_decomposition(
        lifecycles: List[Dict[str, Any]],
        total_skills: int,
        fraction_elapsed: float,
        today: date,
    ) -> VelocityDecomposition:
        """
        Decompose velocity into three drivers.

        Introduction velocity: Are we introducing skills on pace?
        Pass-through velocity: Are in-pipeline skills advancing?
        Closure velocity: Are mature skills actually closing?
        """
        introduced = [
            lc for lc in lifecycles
            if lc.get("current_gate", 0) > 0 or lc.get("lesson_eval_count", 0) > 0
        ]
        in_pipeline = [
            lc for lc in lifecycles
            if 1 <= lc.get("current_gate", 0) <= 3
        ]
        closed_lcs = [lc for lc in lifecycles if lc.get("current_gate", 0) >= 4]

        # --- Introduction velocity ---
        expected_introduced = total_skills * fraction_elapsed
        intro_velocity = (
            len(introduced) / expected_introduced
            if expected_introduced > 0
            else 1.0
        )

        # --- Pass-through velocity ---
        if in_pipeline:
            avg_completion = sum(lc.get("completion_pct", 0.0) for lc in in_pipeline) / len(in_pipeline)
            expected_completions = []
            for lc in in_pipeline:
                created = lc.get("created_at")
                if not created:
                    expected_completions.append(0.25)
                    continue
                try:
                    intro_date = date.fromisoformat(created[:10])
                except (ValueError, TypeError):
                    expected_completions.append(0.25)
                    continue

                weeks = (today - intro_date).days / 7.0
                if weeks >= 4:
                    expected_completions.append(1.0)
                elif weeks >= 2:
                    expected_completions.append(0.75)
                elif weeks >= 1:
                    expected_completions.append(0.50)
                else:
                    expected_completions.append(0.25)

            expected_avg = sum(expected_completions) / len(expected_completions) if expected_completions else 0.25
            pass_through_velocity = avg_completion / expected_avg if expected_avg > 0 else 1.0
        else:
            pass_through_velocity = 1.0

        # --- Closure velocity ---
        # Expected closures: skills introduced >= 4 weeks ago should be closed
        mature_lcs = []
        for lc in introduced:
            created = lc.get("created_at")
            if not created:
                continue
            try:
                intro_date = date.fromisoformat(created[:10])
            except (ValueError, TypeError):
                continue
            if (today - intro_date).days >= 28:  # 4 weeks
                mature_lcs.append(lc)

        expected_closed = len(mature_lcs)
        closure_velocity = (
            len(closed_lcs) / expected_closed
            if expected_closed > 0
            else 1.0
        )

        return VelocityDecomposition(
            introductionVelocity=round(min(intro_velocity, 2.0), 2),
            passThroughVelocity=round(min(pass_through_velocity, 2.0), 2),
            closureVelocity=round(min(closure_velocity, 2.0), 2),
        )

    @staticmethod
    def _identify_primary_driver(
        decomposition: VelocityDecomposition,
        lifecycles: List[Dict[str, Any]],
        today: date,
    ) -> PrimaryDriver:
        """
        Identify the single biggest factor driving velocity.

        If all components are healthy (>= 0.95), report "all_healthy".
        Otherwise, the lowest component is the primary driver with
        a human-readable explanation.
        """
        components = {
            "introduction": decomposition.introductionVelocity,
            "pass_through": decomposition.passThroughVelocity,
            "closure": decomposition.closureVelocity,
        }

        if all(v >= 0.95 for v in components.values()):
            return PrimaryDriver(
                component="all_healthy",
                value=None,
                explanation="On pace across all dimensions",
            )

        worst_key = min(components, key=lambda k: components[k])
        worst_val = components[worst_key]

        # Generate contextual explanation
        if worst_key == "introduction":
            explanation = (
                "New skill introductions are behind pace — "
                "review burden may be crowding out new skills"
            )
        elif worst_key == "pass_through":
            low_pass = sum(
                1 for lc in lifecycles
                if 1 <= lc.get("current_gate", 0) <= 3
                and lc.get("blended_pass_rate", 1.0) < 0.7
            )
            if low_pass > 0:
                explanation = (
                    f"{low_pass} skill{'s' if low_pass != 1 else ''} "
                    f"with low pass rates {'are' if low_pass != 1 else 'is'} "
                    f"slowing pipeline throughput"
                )
            else:
                explanation = (
                    "In-review skills are advancing slower than expected — "
                    "review scores may be below passing threshold"
                )
        else:  # closure
            explanation = (
                "Skills that should have closed are still in review — "
                "scheduled reviews may not be served on time"
            )

        return PrimaryDriver(
            component=worst_key,
            value=round(worst_val, 2),
            explanation=explanation,
        )

    # ====================================================================
    # Trend helpers
    # ====================================================================

    @staticmethod
    def _extract_subject_trend(
        history: List[Dict[str, Any]], subject: str
    ) -> List[float]:
        """Extract a subject's velocity values from historical snapshots."""
        trend: List[float] = []
        for snapshot in history:
            subjects_data = snapshot.get("subjects", {})
            subj_data = subjects_data.get(subject, {})
            v = subj_data.get("velocity")
            if v is not None:
                trend.append(round(float(v), 2))
        return trend

    @staticmethod
    def _extract_aggregate_trend(history: List[Dict[str, Any]]) -> List[float]:
        """Extract aggregate velocity values from historical snapshots."""
        trend: List[float] = []
        for snapshot in history:
            agg = snapshot.get("aggregate", {})
            v = agg.get("velocity")
            if v is not None:
                trend.append(round(float(v), 2))
        return trend

    # ====================================================================
    # Shared helpers
    # ====================================================================

    async def _get_school_year_config(self) -> SchoolYearConfig:
        """Load school year config from Firestore, with sensible defaults."""
        raw = await self.firestore.get_school_year_config()
        if raw:
            return SchoolYearConfig(**raw)
        logger.warning("No school year config in Firestore — using defaults")
        return SchoolYearConfig(
            start_date="2025-08-25",
            end_date="2026-05-29",
            breaks=[],
            school_days_per_week=5,
        )

    @staticmethod
    def _school_weeks_remaining(
        today: date,
        year_end: date,
        breaks: List[SchoolBreak],
    ) -> int:
        """Calculate school weeks remaining, subtracting break periods."""
        if today >= year_end:
            return 0
        total_days = (year_end - today).days
        break_days = 0
        for b in breaks:
            try:
                b_start = date.fromisoformat(
                    b.start if isinstance(b, SchoolBreak) else b.get("start", "")
                )
                b_end = date.fromisoformat(
                    b.end if isinstance(b, SchoolBreak) else b.get("end", "")
                )
            except (ValueError, TypeError):
                continue
            if b_end <= today:
                continue
            effective_start = max(b_start, today)
            break_days += max(0, (b_end - effective_start).days)
        school_days = max(0, total_days - break_days)
        return max(1, school_days // 5)

    @staticmethod
    def _count_subskills(curriculum_data: List[Dict]) -> int:
        """Count total subskills in a curriculum hierarchy."""
        count = 0
        for unit in curriculum_data:
            for skill in unit.get("skills", []):
                count += len(skill.get("subskills", []))
        return count
