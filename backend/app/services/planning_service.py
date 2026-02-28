# backend/app/services/planning_service.py
"""
Planning Service — Algorithmic Weekly & Daily Planner

Replaces the LLM-based WeeklyPlannerService with a pure Firestore-native,
deterministic planning engine (PRD Sections 4 & 5).

Data sources (all Firestore):
  - curriculum_published     — total skills per subject
  - students/{id}/skill_status — review pipeline state
  - students/{id}            — planning fields (capacity, dev patterns)
  - config/schoolYear        — year dates, breaks
  - curriculum_graphs        — prerequisite relationships (via LearningPathsService)
"""

import logging
import math
from datetime import datetime, date, timedelta, timezone
from typing import Any, Dict, List, Optional

from ..db.firestore_service import FirestoreService
from ..services.curriculum_service import CurriculumService
from ..models.planning import (
    AggregateMetrics,
    DailyPlanResponse,
    DevelopmentPattern,
    NewSkillSessionItem,
    ReviewSessionItem,
    SchoolBreak,
    SchoolYearConfig,
    SessionReason,
    SkillLifecycleStatus,
    SubjectWeekProgress,
    SubjectWeeklyStats,
    WeeklyPlanResponse,
)

logger = logging.getLogger(__name__)

DEFAULT_CAPACITY = 25
DEFAULT_ULTIMATE = 4


class PlanningService:
    """
    Stateless planning engine.  Every call reads live Firestore state and
    computes the answer — no stored plans, no LLM, no BigQuery.
    """

    def __init__(
        self,
        firestore_service: FirestoreService,
        curriculum_service: CurriculumService,
        learning_paths_service: Optional[Any] = None,  # LearningPathsService
    ):
        self.firestore = firestore_service
        self.curriculum = curriculum_service
        self.learning_paths = learning_paths_service
        logger.info("PlanningService initialized")

    # ====================================================================
    # Weekly Planner (PRD Section 4)
    # ====================================================================

    async def get_weekly_plan(self, student_id: int) -> WeeklyPlanResponse:
        """
        Compute a weekly pacing snapshot.

        Returns per-subject stats: how many skills are closed, in review,
        not started; whether the student is ahead or behind; and how many
        new skills per week are needed to finish the curriculum by year end.
        """
        today = datetime.now(timezone.utc).date()
        monday = today - timedelta(days=today.weekday())

        # 1. Load school year config
        config = await self._get_school_year_config()

        year_start = date.fromisoformat(config.start_date)
        year_end = date.fromisoformat(config.end_date)
        total_days = (year_end - year_start).days or 1
        fraction_elapsed = min(max((today - year_start).days / total_days, 0.0), 1.0)
        weeks_remaining = self._school_weeks_remaining(today, year_end, config.breaks)

        # 2. Load student planning fields
        planning = await self.firestore.get_student_planning_fields(student_id)
        capacity = planning.get("daily_session_capacity", DEFAULT_CAPACITY)
        dev_patterns = planning.get("development_patterns", {})
        agg = planning.get("aggregate_metrics", {})

        # 3. Load all skill statuses for this student
        all_skills = await self.firestore.get_all_skill_statuses(student_id)

        # 4. Load available subjects from curriculum
        subjects_list = await self.curriculum.get_available_subjects()
        # subjects_list may be a list of strings or dicts
        subject_names: List[str] = []
        for s in subjects_list:
            if isinstance(s, dict):
                subject_names.append(s.get("subject_name") or s.get("subject_id", ""))
            else:
                subject_names.append(str(s))

        # 5. Compute per-subject stats
        subjects_stats: Dict[str, SubjectWeeklyStats] = {}
        warnings: List[str] = []

        for subj in subject_names:
            # Get total subskills from curriculum
            curriculum_data = await self.curriculum.get_curriculum(subj)
            total_subskills = self._count_subskills(curriculum_data)

            # Count by status
            subj_skills = [s for s in all_skills if s.get("subject") == subj]
            closed = sum(1 for s in subj_skills if s.get("status") == "closed")
            in_review = sum(1 for s in subj_skills if s.get("status") == "in_review")
            learning = sum(1 for s in subj_skills if s.get("status") == "learning")
            not_started = max(0, total_subskills - closed - in_review - learning)

            expected_by_now = round(total_subskills * fraction_elapsed, 1)
            behind_by = round(max(0, expected_by_now - closed - in_review), 1)

            if weeks_remaining > 0:
                weekly_new_target = math.ceil(not_started / weeks_remaining)
            else:
                weekly_new_target = not_started

            # Review reserve for this subject
            review_reserve = sum(
                max(0, s.get("estimated_ultimate", DEFAULT_ULTIMATE) - s.get("sessions_completed", 0))
                for s in subj_skills
                if s.get("status") not in ("closed", "not_started")
            )

            # Development pattern
            pattern = dev_patterns.get(subj, {})
            avg_ult = pattern.get("average_ultimate", DEFAULT_ULTIMATE) if isinstance(pattern, dict) else DEFAULT_ULTIMATE

            stats = SubjectWeeklyStats(
                total_skills=total_subskills,
                closed=closed,
                in_review=in_review,
                not_started=not_started,
                expected_by_now=expected_by_now,
                behind_by=behind_by,
                weekly_new_target=weekly_new_target,
                review_reserve=review_reserve,
                avg_ultimate=round(avg_ult, 1),
            )
            subjects_stats[subj] = stats

            # Capacity overload warning (PRD 8.1)
            if behind_by > 0:
                warnings.append(f"{subj}: {behind_by} skills behind expected pace")

        sustainable = agg.get("sustainable_new_per_day", capacity)

        return WeeklyPlanResponse(
            student_id=str(student_id),
            week_of=monday.isoformat(),
            school_year={
                "start": config.start_date,
                "end": config.end_date,
                "fractionElapsed": round(fraction_elapsed, 3),
                "weeksRemaining": weeks_remaining,
            },
            daily_session_capacity=capacity,
            sustainable_new_per_day=round(sustainable, 1),
            subjects=subjects_stats,
            warnings=warnings,
        )

    # ====================================================================
    # Daily Planner (PRD Section 5)
    # ====================================================================

    async def get_daily_plan(self, student_id: int) -> DailyPlanResponse:
        """
        Compute today's prioritised session queue.

        Step 1: Build review queue (overdue reviews first).
        Step 2: Determine capacity for new skills.
        Step 3: Select new skills using knowledge graph / curriculum sequence.
        Step 4: Merge and return.
        """
        today = datetime.now(timezone.utc).date()
        today_str = today.isoformat()
        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

        # Load planning fields
        planning = await self.firestore.get_student_planning_fields(student_id)
        capacity = planning.get("daily_session_capacity", DEFAULT_CAPACITY)

        # ---- Step 1: Review queue ----
        due_skills = await self.firestore.get_skills_with_review_due(student_id, today_str)

        # Also include anything overdue (next_review_date < today) — the query already handles <= today
        review_queue: List[Dict[str, Any]] = []
        for s in due_skills:
            review_date = s.get("next_review_date", today_str)
            try:
                days_overdue = (today - date.fromisoformat(review_date)).days
            except (ValueError, TypeError):
                days_overdue = 0
            days_overdue = max(days_overdue, 0)

            review_queue.append({
                **s,
                "days_overdue": days_overdue,
            })

        # Sort: tight loop first, then most overdue, then by estimated_ultimate desc (more critical)
        review_queue.sort(
            key=lambda x: (
                not x.get("in_tight_loop", False),  # tight loop first (False sorts after True)
                -x.get("days_overdue", 0),
                -x.get("estimated_ultimate", DEFAULT_ULTIMATE),
            )
        )

        # ---- Step 2: Capacity allocation ----
        max_review_slots = math.floor(capacity * 0.85)
        actual_review_slots = min(len(review_queue), max_review_slots)
        new_skill_slots = capacity - actual_review_slots

        # Trim review queue to allocated slots
        review_queue = review_queue[:actual_review_slots]

        # ---- Step 3: Select new skills ----
        weekly_plan = await self.get_weekly_plan(student_id)
        new_skills: List[Dict[str, Any]] = []

        if new_skill_slots > 0 and self.learning_paths:
            # Allocate proportionally to weekly target deficit per subject
            subject_deficits = []
            for subj, stats in weekly_plan.subjects.items():
                deficit = stats.weekly_new_target  # simplified: full weekly target as proxy
                if deficit > 0:
                    subject_deficits.append((subj, deficit))

            total_deficit = sum(d for _, d in subject_deficits) or 1
            allocated = 0

            for subj, deficit in subject_deficits:
                slots_for_subj = max(1, round(new_skill_slots * deficit / total_deficit))
                if allocated + slots_for_subj > new_skill_slots:
                    slots_for_subj = new_skill_slots - allocated
                if slots_for_subj <= 0:
                    continue

                try:
                    unlocked = await self.learning_paths.get_unlocked_entities(
                        student_id=student_id,
                        entity_type='subskill',
                        subject=subj,
                    )
                except Exception as e:
                    logger.warning(f"Failed to get unlocked entities for {subj}: {e}")
                    unlocked = []

                if not unlocked:
                    continue

                # Filter to not_started only
                all_statuses = await self.firestore.get_all_skill_statuses(student_id, subject=subj)
                tracked_ids = {s.get("skill_id") for s in all_statuses}

                candidates = [sid for sid in unlocked if sid not in tracked_ids][:slots_for_subj]

                for skill_id in candidates:
                    new_skills.append({
                        "skill_id": skill_id,
                        "subject": subj,
                        "skill_name": skill_id,  # best we have without extra lookup
                        "type": "new",
                        "reason": SessionReason.BEHIND_PACE.value if weekly_plan.subjects[subj].behind_by > 0 else SessionReason.NEXT_IN_SEQUENCE.value,
                        "prerequisites_met": True,
                    })
                    allocated += 1

                if allocated >= new_skill_slots:
                    break

        # ---- Step 4: Enrich with curriculum names ----
        # Collect all subjects that appear in sessions, build lookup per subject
        session_subjects = set()
        for r in review_queue:
            session_subjects.add(r.get("subject", ""))
        for n in new_skills:
            session_subjects.add(n.get("subject", ""))
        session_subjects.discard("")

        curriculum_lookup = await self._build_curriculum_lookup(session_subjects)

        # Diagnostic: log IDs that couldn't be enriched
        all_session_ids = [r.get("skill_id", "") for r in review_queue] + [n["skill_id"] for n in new_skills]
        unresolved = [sid for sid in all_session_ids if sid and sid not in curriculum_lookup]
        if unresolved:
            # Per-subject breakdown of lookup keys
            from collections import Counter
            prefix_counts = Counter()
            la_sample = []
            for k in curriculum_lookup:
                prefix = k.split("-")[0] if "-" in k else k
                prefix_counts[prefix] += 1
                if k.startswith("LA") and len(la_sample) < 5:
                    la_sample.append(k)
            logger.warning(
                f"Curriculum lookup missed {len(unresolved)}/{len(all_session_ids)} session IDs. "
                f"Unresolved: {unresolved[:5]}  |  "
                f"Lookup by prefix: {dict(prefix_counts)}  |  "
                f"LA keys sample: {la_sample}"
            )

        # ---- Step 5: Merge and return ----
        sessions: List[dict] = []
        priority = 1

        for r in review_queue:
            sid = r.get("skill_id", "")
            meta = curriculum_lookup.get(sid, {})
            sessions.append(
                ReviewSessionItem(
                    skill_id=sid,
                    subject=r.get("subject", ""),
                    skill_name=meta.get("subskill_description") or r.get("skill_name", sid),
                    reason=SessionReason.TIGHT_LOOP_RECOVERY if r.get("in_tight_loop") else SessionReason.SCHEDULED_REVIEW,
                    priority=priority,
                    review_session=len(r.get("review_history", [])) + 1,
                    estimated_ultimate=r.get("estimated_ultimate", DEFAULT_ULTIMATE),
                    completion_factor=r.get("completion_factor", 0.0),
                    days_overdue=r.get("days_overdue", 0),
                    unit_title=meta.get("unit_title"),
                    skill_description=meta.get("skill_description"),
                    subskill_description=meta.get("subskill_description"),
                ).model_dump()
            )
            priority += 1

        for n in new_skills:
            sid = n["skill_id"]
            meta = curriculum_lookup.get(sid, {})
            sessions.append(
                NewSkillSessionItem(
                    skill_id=sid,
                    subject=n["subject"],
                    skill_name=meta.get("subskill_description") or n["skill_name"],
                    reason=SessionReason(n["reason"]),
                    priority=priority,
                    prerequisites_met=n.get("prerequisites_met", True),
                    unit_title=meta.get("unit_title"),
                    skill_description=meta.get("skill_description"),
                    subskill_description=meta.get("subskill_description"),
                ).model_dump()
            )
            priority += 1

        # Week progress (simplified — count completed this week from skill_status)
        week_progress: Dict[str, SubjectWeekProgress] = {}
        for subj, stats in weekly_plan.subjects.items():
            week_progress[subj] = SubjectWeekProgress(
                new_target=stats.weekly_new_target,
                new_completed=0,  # TODO: track intra-week completions
                reviews_completed=0,
            )

        warnings: List[str] = []
        if len(review_queue) > max_review_slots:
            warnings.append("Review backlog exceeds daily capacity — no new skills today")
        if actual_review_slots >= capacity:
            warnings.append("Capacity overload: all slots consumed by reviews")

        return DailyPlanResponse(
            student_id=str(student_id),
            date=today_str,
            day_of_week=day_names[today.weekday()],
            capacity=capacity,
            review_slots=actual_review_slots,
            new_slots=len(new_skills),
            week_progress=week_progress,
            sessions=sessions,
            warnings=warnings,
        )

    # ====================================================================
    # Helpers
    # ====================================================================

    async def _get_school_year_config(self) -> SchoolYearConfig:
        """Load school year config from Firestore, with sensible defaults."""
        raw = await self.firestore.get_school_year_config()
        if raw:
            return SchoolYearConfig(**raw)
        # Fallback defaults
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
                b_start = date.fromisoformat(b.start if isinstance(b, SchoolBreak) else b.get("start", ""))
                b_end = date.fromisoformat(b.end if isinstance(b, SchoolBreak) else b.get("end", ""))
            except (ValueError, TypeError):
                continue
            # Only count future break days
            if b_end <= today:
                continue
            effective_start = max(b_start, today)
            break_days += max(0, (b_end - effective_start).days)
        school_days = max(0, total_days - break_days)
        return max(1, school_days // 5)  # 5 school days per week

    async def _build_curriculum_lookup(
        self, subjects: set[str]
    ) -> Dict[str, Dict[str, str]]:
        """
        Build a subskill_id → {unit_title, skill_description, subskill_description}
        lookup from the curriculum hierarchy for the given subjects.
        """
        lookup: Dict[str, Dict[str, str]] = {}
        for subj in subjects:
            try:
                curriculum_data = await self.curriculum.get_curriculum(subj)
            except Exception as e:
                logger.warning(f"Failed to load curriculum for {subj}: {e}")
                continue
            for unit in curriculum_data:
                unit_title = unit.get("title", unit.get("id", ""))
                for skill in unit.get("skills", []):
                    skill_desc = skill.get("description", skill.get("id", ""))
                    for subskill in skill.get("subskills", []):
                        ss_id = subskill.get("id", "")
                        ss_desc = subskill.get("description", ss_id)
                        if ss_id:
                            lookup[ss_id] = {
                                "unit_title": unit_title,
                                "skill_description": skill_desc,
                                "subskill_description": ss_desc,
                            }
        return lookup

    @staticmethod
    def _count_subskills(curriculum_data: List[Dict]) -> int:
        """Count total subskills in a curriculum hierarchy."""
        count = 0
        for unit in curriculum_data:
            for skill in unit.get("skills", []):
                count += len(skill.get("subskills", []))
        return count
