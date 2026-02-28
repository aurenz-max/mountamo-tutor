# backend/app/services/review_engine.py
"""
Review Engine — Completion Factor Model

Implements the actuarial chain-ladder–inspired review scheduling algorithm
described in PRD Sections 3 and 7.

Key concepts:
  - A skill enters the review pipeline when it reaches initial mastery (90%+).
  - The standard schedule is 4 total sessions (mastery + 3 reviews at expanding
    intervals: +2w, +4w, +6w from mastery).
  - A failure (< 90%) adds +1 to the estimated ultimate and enters a tight-loop
    (weekly) recovery cycle requiring 2 consecutive passes before resuming normal
    intervals.
  - completionFactor = sessionsCompleted / estimatedUltimate

This service is pure algorithmic — no LLM or external API calls.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from ..db.firestore_service import FirestoreService
from ..models.planning import (
    AggregateMetrics,
    DevelopmentPattern,
    ReviewEntry,
    SkillLifecycleStatus,
    SkillStatus,
)

logger = logging.getLogger(__name__)

# Mastery threshold: score >= this value counts as a pass.
# Competency scores are stored 0-10; 9.0 corresponds to 90%.
MASTERY_THRESHOLD_10 = 9.0

# Same threshold expressed 0-1 (for data that arrives normalised).
MASTERY_THRESHOLD_01 = 0.9

# Standard review intervals in weeks from the initial mastery date.
STANDARD_REVIEW_WEEKS = [2, 4, 6]

# Default estimated ultimate for a newly mastered skill.
DEFAULT_ULTIMATE = 4

# Tight-loop interval in days.
TIGHT_LOOP_INTERVAL_DAYS = 7

# Normal stability-proving interval in days after exiting tight loop.
STABILITY_INTERVAL_DAYS = 14


class ReviewEngine:
    """
    Stateless service that processes session results and maintains the
    skill_status subcollection in Firestore.
    """

    def __init__(self, firestore_service: FirestoreService):
        self.firestore = firestore_service
        logger.info("ReviewEngine initialized")

    # ------------------------------------------------------------------
    # Main entry point (PRD Section 7)
    # ------------------------------------------------------------------

    async def process_session_result(
        self,
        student_id: int,
        skill_id: str,
        subject: str,
        score: float,
        skill_name: str = "",
    ) -> Dict[str, Any]:
        """
        Handle a completed assessment session for one skill.

        Args:
            student_id: Student identifier.
            skill_id: The skill (subskill) that was assessed.
            subject: Subject name.
            score: Raw score on a 0-10 scale.
            skill_name: Human-readable name (optional, stored for convenience).

        Returns:
            Updated skill status dict.
        """
        passed = score >= MASTERY_THRESHOLD_10
        now = datetime.now(timezone.utc)
        today_str = now.strftime("%Y-%m-%d")
        now_iso = now.isoformat()

        # Fetch or initialise the skill_status document
        existing = await self.firestore.get_skill_status(student_id, skill_id)

        if existing is None:
            # First time we see this skill — create a skeleton
            skill = SkillStatus(
                skill_id=skill_id,
                subject=subject,
                skill_name=skill_name,
                status=SkillLifecycleStatus.LEARNING,
                first_introduced=now_iso,
                sessions_completed=0,
                estimated_ultimate=DEFAULT_ULTIMATE,
            )
        else:
            skill = SkillStatus(**existing)

        # Ensure metadata is up-to-date
        if skill_name and not skill.skill_name:
            skill.skill_name = skill_name

        # ---- Branching by current status ----

        if skill.status == SkillLifecycleStatus.CLOSED:
            # Skill is already closed; ignore subsequent results.
            logger.info(f"Skill {skill_id} already closed for student {student_id}, ignoring")
            return skill.model_dump()

        if skill.status in (SkillLifecycleStatus.NOT_STARTED, SkillLifecycleStatus.LEARNING):
            # Not yet mastered — check for initial mastery.
            skill.sessions_completed += 1

            if passed:
                # Initial mastery achieved
                skill.status = SkillLifecycleStatus.IN_REVIEW
                skill.initial_mastery_date = now_iso
                skill.estimated_ultimate = DEFAULT_ULTIMATE
                skill.next_review_date = self._standard_review_date(now, session_index=1)
                logger.info(f"Skill {skill_id}: initial mastery for student {student_id}")
            else:
                # Still learning — no pipeline changes
                skill.status = SkillLifecycleStatus.LEARNING

        elif skill.status == SkillLifecycleStatus.IN_REVIEW:
            # Already in the review pipeline
            review_session = len(skill.review_history) + 1
            skill.sessions_completed += 1

            # Append review history
            skill.review_history.append(
                ReviewEntry(
                    date=today_str,
                    score=round(score / 10.0, 4),  # store normalised 0-1
                    session=review_session,
                    passed=passed,
                )
            )

            if passed:
                skill = self._handle_review_pass(skill, now)
            else:
                skill = self._handle_review_fail(skill, now)

        # Recalculate completion factor
        skill.completion_factor = self._calc_completion_factor(
            skill.sessions_completed, skill.estimated_ultimate
        )

        # Check for closure
        if (
            skill.status == SkillLifecycleStatus.IN_REVIEW
            and skill.sessions_completed >= skill.estimated_ultimate
            and not skill.in_tight_loop
        ):
            skill.status = SkillLifecycleStatus.CLOSED
            skill.closed_date = now_iso
            skill.next_review_date = None
            skill.completion_factor = 1.0
            logger.info(f"Skill {skill_id}: CLOSED for student {student_id}")

        # Persist
        await self.firestore.upsert_skill_status(
            student_id, skill_id, skill.model_dump()
        )

        # Update student-level aggregates (fire-and-forget style, but awaited)
        await self._refresh_student_aggregates(student_id, subject)

        return skill.model_dump()

    # ------------------------------------------------------------------
    # Pass / Fail handlers
    # ------------------------------------------------------------------

    def _handle_review_pass(self, skill: SkillStatus, now: datetime) -> SkillStatus:
        """Handle a passing review (score >= 90%)."""
        if skill.in_tight_loop:
            skill.tight_loop_passes_needed -= 1
            if skill.tight_loop_passes_needed <= 0:
                # Exited tight loop — resume normal stability intervals
                skill.in_tight_loop = False
                skill.tight_loop_passes_needed = 0
                skill.next_review_date = (
                    now + timedelta(days=STABILITY_INTERVAL_DAYS)
                ).strftime("%Y-%m-%d")
            else:
                # Still proving stability — +2 weeks
                skill.next_review_date = (
                    now + timedelta(days=STABILITY_INTERVAL_DAYS)
                ).strftime("%Y-%m-%d")
        else:
            # Standard progression — schedule next review
            skill.next_review_date = self._next_standard_review(skill, now)

        return skill

    def _handle_review_fail(self, skill: SkillStatus, now: datetime) -> SkillStatus:
        """Handle a failing review (score < 90%)."""
        skill.estimated_ultimate += 1
        skill.in_tight_loop = True
        skill.tight_loop_passes_needed = 2
        skill.next_review_date = (
            now + timedelta(days=TIGHT_LOOP_INTERVAL_DAYS)
        ).strftime("%Y-%m-%d")
        logger.info(
            f"Skill {skill.skill_id}: failure — ultimate now {skill.estimated_ultimate}, "
            f"entering tight loop"
        )
        return skill

    # ------------------------------------------------------------------
    # Scheduling helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _standard_review_date(mastery_date: datetime, session_index: int) -> str:
        """
        Return the date for standard review session N (1-indexed).

        Session 1: +2 weeks, Session 2: +4 weeks, Session 3: +6 weeks.
        """
        if session_index <= len(STANDARD_REVIEW_WEEKS):
            weeks = STANDARD_REVIEW_WEEKS[session_index - 1]
        else:
            # Beyond standard schedule — use last interval
            weeks = STANDARD_REVIEW_WEEKS[-1]
        return (mastery_date + timedelta(weeks=weeks)).strftime("%Y-%m-%d")

    @staticmethod
    def _next_standard_review(skill: SkillStatus, now: datetime) -> Optional[str]:
        """Determine next review date based on how many passing reviews have occurred."""
        passing_reviews = sum(1 for r in skill.review_history if r.passed)

        if passing_reviews < len(STANDARD_REVIEW_WEEKS):
            # Still within standard schedule — use interval from mastery date
            mastery = datetime.fromisoformat(skill.initial_mastery_date)
            weeks = STANDARD_REVIEW_WEEKS[passing_reviews]
            candidate = mastery + timedelta(weeks=weeks)
            # Never schedule in the past
            if candidate.date() <= now.date():
                candidate = now + timedelta(days=STABILITY_INTERVAL_DAYS)
            return candidate.strftime("%Y-%m-%d")

        # All standard reviews done — skill should be closing
        return None

    @staticmethod
    def _calc_completion_factor(sessions_completed: int, estimated_ultimate: int) -> float:
        if estimated_ultimate <= 0:
            return 0.0
        return round(min(sessions_completed / estimated_ultimate, 1.0), 4)

    # ------------------------------------------------------------------
    # Aggregate metrics (PRD Section 3.6 / 6.1)
    # ------------------------------------------------------------------

    async def _refresh_student_aggregates(
        self, student_id: int, subject: str
    ) -> None:
        """
        Recalculate student-level planning fields after a skill_status change.
        """
        try:
            all_skills = await self.firestore.get_all_skill_statuses(student_id)
            planning = await self.firestore.get_student_planning_fields(student_id)
            capacity = planning.get("daily_session_capacity", 25)

            # --- Total review reserve ---
            total_reserve = 0
            for s in all_skills:
                if s.get("status") not in ("closed", "not_started"):
                    ultimate = s.get("estimated_ultimate", DEFAULT_ULTIMATE)
                    completed = s.get("sessions_completed", 0)
                    total_reserve += max(0, ultimate - completed)

            # --- Projected daily review load (skills due in next 7 days / 7) ---
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            week_ahead = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d")
            due_soon = await self.firestore.get_skills_with_review_due(student_id, week_ahead)
            projected_daily = round(len(due_soon) / 7.0, 2)

            sustainable_new = max(0.0, capacity - projected_daily)

            aggregate = AggregateMetrics(
                total_review_reserve=total_reserve,
                projected_daily_review_load=projected_daily,
                sustainable_new_per_day=sustainable_new,
                last_recalculated=datetime.now(timezone.utc).isoformat(),
            )

            # --- Development patterns for this subject ---
            dev_patterns = planning.get("development_patterns", {})
            subject_skills = [s for s in all_skills if s.get("subject") == subject]
            closed_subject = [s for s in subject_skills if s.get("status") == "closed"]

            if closed_subject:
                avg_ult = sum(s.get("estimated_ultimate", DEFAULT_ULTIMATE) for s in closed_subject) / len(closed_subject)
                total_sess = sum(s.get("sessions_completed", 0) for s in closed_subject)
                dev_patterns[subject] = DevelopmentPattern(
                    average_ultimate=round(avg_ult, 2),
                    skills_closed=len(closed_subject),
                    total_sessions=total_sess,
                ).model_dump()

            await self.firestore.update_student_planning_fields(student_id, {
                "aggregate_metrics": aggregate.model_dump(),
                "development_patterns": dev_patterns,
            })

        except Exception as e:
            logger.error(f"Error refreshing aggregates for student {student_id}: {e}")
