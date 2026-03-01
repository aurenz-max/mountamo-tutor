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
    CheckpointBreakdown,
    ConfidenceBand,
    DailyPlanResponse,
    DevelopmentPattern,
    EndOfYearProjection,
    EndOfYearScenarios,
    MonthlyPlanResponse,
    MonthlyWarning,
    NewSkillSessionItem,
    ReviewsByCheckpoint,
    ReviewSessionItem,
    SchoolBreak,
    SchoolYearConfig,
    SessionCategory,
    SessionReason,
    SkillLifecycleStatus,
    SubjectCurrentState,
    SubjectMonthlyProjection,
    SubjectWeekProgress,
    SubjectWeeklyStats,
    WeeklyPlanResponse,
    WeekProjection,
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

            # Checkpoint breakdown
            checkpoints = self._checkpoint_counts(subj_skills)

            # Development pattern
            pattern = dev_patterns.get(subj, {})
            avg_ult = pattern.get("average_ultimate", DEFAULT_ULTIMATE) if isinstance(pattern, dict) else DEFAULT_ULTIMATE

            stats = SubjectWeeklyStats(
                total_skills=total_subskills,
                closed=closed,
                in_review=in_review,
                checkpoints=checkpoints,
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
    # Monthly Planner — Forward Simulation (PRD Section 4)
    # ====================================================================

    async def get_monthly_plan(self, student_id: int) -> MonthlyPlanResponse:
        """
        Run a week-by-week forward simulation projecting where the student
        will be at 4, 8, and 12+ weeks out.

        Produces per-subject trajectories with optimistic / best-estimate /
        pessimistic confidence bands and early-warning flags.
        """
        today = datetime.now(timezone.utc).date()

        # 1. Load shared inputs (same sources as weekly planner)
        config = await self._get_school_year_config()
        year_start = date.fromisoformat(config.start_date)
        year_end = date.fromisoformat(config.end_date)
        total_days = (year_end - year_start).days or 1
        fraction_elapsed = min(max((today - year_start).days / total_days, 0.0), 1.0)
        weeks_remaining = self._school_weeks_remaining(today, year_end, config.breaks)

        planning = await self.firestore.get_student_planning_fields(student_id)
        capacity = planning.get("daily_session_capacity", DEFAULT_CAPACITY)
        weekly_capacity = capacity * 5  # school days per week
        dev_patterns = planning.get("development_patterns", {})

        all_skills = await self.firestore.get_all_skill_statuses(student_id)

        subjects_list = await self.curriculum.get_available_subjects()
        subject_names: list[str] = []
        for s in subjects_list:
            if isinstance(s, dict):
                subject_names.append(s.get("subject_name") or s.get("subject_id", ""))
            else:
                subject_names.append(str(s))

        # 2. Build projections per subject
        projections: dict[str, SubjectMonthlyProjection] = {}

        for subj in subject_names:
            curriculum_data = await self.curriculum.get_curriculum(subj)
            total_subskills = self._count_subskills(curriculum_data)

            subj_skills = [s for s in all_skills if s.get("subject") == subj]
            closed = sum(1 for s in subj_skills if s.get("status") == "closed")
            in_review = sum(1 for s in subj_skills if s.get("status") == "in_review")
            learning = sum(1 for s in subj_skills if s.get("status") == "learning")
            not_started = max(0, total_subskills - closed - in_review - learning)

            checkpoints = self._checkpoint_counts(subj_skills)

            current_state = SubjectCurrentState(
                total=total_subskills,
                closed=closed,
                inReview=in_review,
                checkpoints=checkpoints,
                notStarted=not_started,
            )

            # Development pattern stats for confidence bands
            pattern = dev_patterns.get(subj, {})
            if isinstance(pattern, dict):
                avg_ult = pattern.get("average_ultimate", float(DEFAULT_ULTIMATE))
                skills_closed_count = pattern.get("skills_closed", 0)
            else:
                avg_ult = float(DEFAULT_ULTIMATE)
                skills_closed_count = 0

            # Credibility weighting (PRD): blend toward prior of 5.0
            credibility = min(1.0, skills_closed_count / 10) if skills_closed_count > 0 else 0.0
            effective_avg_ult = credibility * avg_ult + (1.0 - credibility) * 5.0

            # Compute stddev of ultimates from closed skills for confidence bands
            closed_skills = [s for s in subj_skills if s.get("status") == "closed"]
            if len(closed_skills) >= 3:
                ultimates = [s.get("estimated_ultimate", DEFAULT_ULTIMATE) for s in closed_skills]
                mean_ult = sum(ultimates) / len(ultimates)
                variance = sum((u - mean_ult) ** 2 for u in ultimates) / len(ultimates)
                stddev_ult = math.sqrt(variance)
            else:
                stddev_ult = 1.0  # default uncertainty

            # Optimistic / pessimistic average ultimates (75th/25th percentile)
            # 0.675 is the z-score for the 75th percentile
            opt_ult = max(2.0, effective_avg_ult - 0.675 * stddev_ult)
            pess_ult = effective_avg_ult + 0.675 * stddev_ult

            # Build known-review schedule from existing in_review skills
            # Map: week_number -> {checkpoint_weeks: count}
            known_reviews_by_week: dict[int, dict[int, int]] = {}
            in_review_skills = [
                s for s in subj_skills
                if s.get("status") in ("in_review", "learning") and s.get("next_review_date")
            ]
            for s in in_review_skills:
                try:
                    review_date = date.fromisoformat(s["next_review_date"])
                except (ValueError, TypeError):
                    continue

                # Determine which checkpoint this upcoming review represents
                sc = s.get("sessions_completed", 0)
                if sc <= 1:
                    cp = 2   # next session is 2-wk checkpoint
                elif sc == 2:
                    cp = 4   # next session is 4-wk checkpoint
                else:
                    cp = 6   # next session is 6-wk checkpoint

                if review_date <= today:
                    week_num = 1  # overdue — due in week 1
                else:
                    delta_days = (review_date - today).days
                    week_num = max(1, (delta_days // 7) + 1)

                if week_num <= weeks_remaining:
                    if week_num not in known_reviews_by_week:
                        known_reviews_by_week[week_num] = {}
                    by_cp = known_reviews_by_week[week_num]
                    by_cp[cp] = by_cp.get(cp, 0) + 1

            # Pacing target: how many new skills per week to finish on time
            pacing_target = math.ceil(not_started / weeks_remaining) if weeks_remaining > 0 else not_started

            # --- Pipeline delay model ---
            # Skills need (ultimate - 1) review sessions at ~2-week intervals
            # after initial mastery, so total weeks to close ≈ (ult - 1) * 2
            weeks_to_close_best = max(2, round((effective_avg_ult - 1) * 2))
            weeks_to_close_opt = max(2, round((opt_ult - 1) * 2))
            weeks_to_close_pess = max(2, round((pess_ult - 1) * 2))

            # Build existing closure pipeline: when will currently-open skills close?
            # Each skill's remaining sessions * ~2 weeks per review interval
            existing_closures_by_week: dict[int, int] = {}
            for s in subj_skills:
                if s.get("status") in ("in_review", "learning"):
                    remaining_sessions = max(
                        0,
                        s.get("estimated_ultimate", DEFAULT_ULTIMATE)
                        - s.get("sessions_completed", 0),
                    )
                    weeks_until_close = max(1, remaining_sessions * 2)
                    if weeks_until_close <= weeks_remaining:
                        existing_closures_by_week[weeks_until_close] = (
                            existing_closures_by_week.get(weeks_until_close, 0) + 1
                        )

            # --- Forward simulation ---
            week_by_week: list[WeekProjection] = []
            warnings: list[MonthlyWarning] = []

            # Float accumulators so small per-week differences compound
            open_inventory = in_review + learning
            cumulative_mastered_f = float(closed)
            cumulative_mastered_opt_f = float(closed)
            cumulative_mastered_pess_f = float(closed)

            # Track new introductions for estimating future review load
            new_introductions_by_week: list[int] = []

            for w in range(1, weeks_remaining + 1):
                week_monday = today + timedelta(days=(7 * (w - 1)) - today.weekday())
                if week_monday < today:
                    week_monday += timedelta(days=7)

                # --- Reviews due this week (by checkpoint) ---
                known_this_week = known_reviews_by_week.get(w, {})

                # Estimated reviews from skills introduced in prior weeks
                # New skills get reviews at +2wk, +4wk, +6wk from introduction
                estimated_by_cp: dict[int, int] = {2: 0, 4: 0, 6: 0}
                for intro_week_idx, intro_count in enumerate(new_introductions_by_week):
                    if intro_count <= 0:
                        continue
                    weeks_since_intro = w - (intro_week_idx + 1)
                    if weeks_since_intro == 2:
                        estimated_by_cp[2] += intro_count
                    elif weeks_since_intro == 4:
                        estimated_by_cp[4] += intro_count
                    elif weeks_since_intro == 6:
                        estimated_by_cp[6] += intro_count

                reviews_cp2 = known_this_week.get(2, 0) + estimated_by_cp[2]
                reviews_cp4 = known_this_week.get(4, 0) + estimated_by_cp[4]
                reviews_cp6 = known_this_week.get(6, 0) + estimated_by_cp[6]
                projected_reviews_due = reviews_cp2 + reviews_cp4 + reviews_cp6

                reviews_by_checkpoint = ReviewsByCheckpoint(
                    checkpoint_2wk=reviews_cp2,
                    checkpoint_4wk=reviews_cp4,
                    checkpoint_6wk=reviews_cp6,
                )

                # --- Closures: pipeline delay model ---
                # 1) Existing skills: close based on their remaining sessions
                existing_closures = existing_closures_by_week.get(w, 0)

                # 2) New introductions: close after pipeline delay
                #    Skills intro'd in week X close in week X + weeks_to_close
                new_closures_best = 0.0
                new_closures_opt = 0.0
                new_closures_pess = 0.0

                source_best = w - weeks_to_close_best
                if 1 <= source_best <= len(new_introductions_by_week):
                    new_closures_best = float(new_introductions_by_week[source_best - 1])

                source_opt = w - weeks_to_close_opt
                if 1 <= source_opt <= len(new_introductions_by_week):
                    new_closures_opt = float(new_introductions_by_week[source_opt - 1])

                source_pess = w - weeks_to_close_pess
                if 1 <= source_pess <= len(new_introductions_by_week):
                    new_closures_pess = float(new_introductions_by_week[source_pess - 1])

                closures_best_f = existing_closures + new_closures_best
                closures_opt_f = existing_closures + new_closures_opt
                closures_pess_f = existing_closures + new_closures_pess
                closures_for_inventory = round(closures_best_f)

                # --- New skill capacity ---
                new_capacity = max(0, weekly_capacity - projected_reviews_due)
                new_introductions = min(new_capacity, pacing_target, not_started)
                not_started = max(0, not_started - new_introductions)

                new_introductions_by_week.append(new_introductions)

                # --- Running totals ---
                open_inventory = max(0, open_inventory + new_introductions - closures_for_inventory)

                cumulative_mastered_f += closures_best_f
                cumulative_mastered_opt_f += closures_opt_f
                cumulative_mastered_pess_f += closures_pess_f

                week_by_week.append(WeekProjection(
                    week=w,
                    weekOf=week_monday.isoformat(),
                    projectedReviewsDue=projected_reviews_due,
                    projectedReviewsByCheckpoint=reviews_by_checkpoint,
                    projectedNewIntroductions=new_introductions,
                    projectedClosures=closures_for_inventory,
                    projectedOpenInventory=open_inventory,
                    cumulativeMastered=ConfidenceBand(
                        optimistic=min(round(cumulative_mastered_opt_f), total_subskills),
                        bestEstimate=min(round(cumulative_mastered_f), total_subskills),
                        pessimistic=min(round(cumulative_mastered_pess_f), total_subskills),
                    ),
                ))

                # --- Danger signals ---
                if open_inventory > capacity * 5:
                    week_label = week_monday.strftime("%B %d")
                    warnings.append(MonthlyWarning(
                        type="review_overload_projected",
                        week=w,
                        message=f"Review burden projected to exceed daily capacity in week of {week_label}",
                    ))
                if new_capacity <= 0:
                    week_label = week_monday.strftime("%B %d")
                    warnings.append(MonthlyWarning(
                        type="zero_new_capacity_projected",
                        week=w,
                        message=f"No capacity for new skills projected in week of {week_label}",
                    ))

            # --- End of year projection ---
            final_opt = min(round(cumulative_mastered_opt_f), total_subskills)
            final_best = min(round(cumulative_mastered_f), total_subskills)
            final_pess = min(round(cumulative_mastered_pess_f), total_subskills)

            end_of_year = EndOfYearScenarios(
                optimistic=EndOfYearProjection(
                    closed=final_opt,
                    remainingGap=max(0, total_subskills - final_opt),
                ),
                bestEstimate=EndOfYearProjection(
                    closed=final_best,
                    remainingGap=max(0, total_subskills - final_best),
                ),
                pessimistic=EndOfYearProjection(
                    closed=final_pess,
                    remainingGap=max(0, total_subskills - final_pess),
                ),
            )

            projections[subj] = SubjectMonthlyProjection(
                currentState=current_state,
                weekByWeek=week_by_week,
                endOfYearProjection=end_of_year,
                warnings=warnings,
            )

        return MonthlyPlanResponse(
            studentId=str(student_id),
            generatedAt=datetime.now(timezone.utc).isoformat(),
            schoolYear={
                "fractionElapsed": round(fraction_elapsed, 3),
                "weeksRemaining": weeks_remaining,
            },
            projections=projections,
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

        # ---- Step 1.5: Mastery retest queue (PRD §7.1) ----
        # Mastery retests (4-gate model) have HIGHEST priority — above review_queue.
        mastery_retests: List[Dict[str, Any]] = []
        try:
            mastery_due = await self.firestore.get_mastery_retests_due(
                student_id, datetime.now(timezone.utc).isoformat()
            )
            for ml in mastery_due:
                retest_eligible = ml.get("next_retest_eligible", "")
                try:
                    days_overdue = max(
                        0,
                        (today - date.fromisoformat(retest_eligible[:10])).days,
                    )
                except (ValueError, TypeError):
                    days_overdue = 0

                mastery_retests.append({
                    "skill_id": ml.get("subskill_id", ""),
                    "subject": ml.get("subject", ""),
                    "skill_name": ml.get("subskill_id", ""),
                    "type": "review",
                    "reason": SessionReason.MASTERY_RETEST.value,
                    "is_mastery_retest": True,
                    "mastery_gate": ml.get("current_gate", 0),
                    "completion_factor": ml.get("completion_pct", 0.0),
                    "estimated_ultimate": 4,
                    "days_overdue": days_overdue,
                    "review_history": [],
                })

            # Sort: most overdue first
            mastery_retests.sort(key=lambda x: -x.get("days_overdue", 0))
            if mastery_retests:
                logger.info(
                    f"[DAILY_PLAN] {len(mastery_retests)} mastery retests due for student {student_id}"
                )
        except Exception as e:
            logger.warning(f"[DAILY_PLAN] Failed to fetch mastery retests: {e}")

        # Merge mastery retests at the front of the review queue (highest priority)
        review_queue = mastery_retests + review_queue

        # ---- Step 2: Capacity allocation ----
        max_review_slots = math.floor(capacity * 0.85)
        actual_review_slots = min(len(review_queue), max_review_slots)
        new_skill_slots = capacity - actual_review_slots

        # Trim review queue to allocated slots
        review_queue = review_queue[:actual_review_slots]

        # ---- Step 3: Select new skills (with gate-blocking — PRD §7.1) ----
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

                # Gate-blocking filter (PRD §7.1): only recommend subskills
                # whose prerequisites are all at Gate 4 (fully mastered).
                mastery_lifecycles = await self.firestore.get_all_mastery_lifecycles(
                    student_id, subject=subj
                )
                mastery_by_id = {
                    lc.get("subskill_id"): lc for lc in mastery_lifecycles
                }

                not_started = [sid for sid in unlocked if sid not in tracked_ids]

                # Separate gate-eligible vs gate-blocked candidates
                eligible = []
                blocked_with_score = []  # (skill_id, prereq_completion_pct)
                for sid in not_started:
                    # A skill is gate-blocked if any of its prerequisites
                    # (which are in the mastery_by_id map) haven't reached Gate 4.
                    # Since learning_paths already filters by prerequisite mastery
                    # for basic unlocking, we add the stricter Gate 4 check here.
                    prereq_lc = mastery_by_id.get(sid)
                    if prereq_lc and prereq_lc.get("current_gate", 0) < 4:
                        blocked_with_score.append(
                            (sid, prereq_lc.get("completion_pct", 0.0))
                        )
                    else:
                        eligible.append(sid)

                candidates = eligible[:slots_for_subj]

                # Dependency bottleneck (PRD §7.2): if no eligible candidates
                # but there are blocked ones, pick the one closest to complete.
                if not candidates and blocked_with_score:
                    blocked_with_score.sort(key=lambda x: -x[1])
                    bottleneck_id = blocked_with_score[0][0]
                    candidates = [bottleneck_id]
                    logger.info(
                        f"[DAILY_PLAN] Dependency bottleneck for {subj}: "
                        f"advancing {bottleneck_id} (prereq completion "
                        f"{blocked_with_score[0][1]:.2f})"
                    )

                for skill_id in candidates:
                    is_bottleneck = skill_id in [b[0] for b in blocked_with_score]
                    reason = (
                        SessionReason.BOTTLENECK_ADVANCE.value
                        if is_bottleneck
                        else (
                            SessionReason.BEHIND_PACE.value
                            if weekly_plan.subjects[subj].behind_by > 0
                            else SessionReason.NEXT_IN_SEQUENCE.value
                        )
                    )
                    new_skills.append({
                        "skill_id": skill_id,
                        "subject": subj,
                        "skill_name": skill_id,  # best we have without extra lookup
                        "type": "new",
                        "reason": reason,
                        "prerequisites_met": not is_bottleneck,
                        "bottleneck": is_bottleneck,
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

        # ---- Step 5: Interleave and return (PRD §8) ----
        interleaved = self._interleave_sessions(review_queue, new_skills, capacity)

        sessions: List[dict] = []
        for item in interleaved:
            sid = item.get("skill_id", "")
            meta = curriculum_lookup.get(sid, {})
            category = SessionCategory(item.get("session_category", SessionCategory.INTERLEAVED.value))

            if item.get("type") == "new":
                sessions.append(
                    NewSkillSessionItem(
                        skill_id=sid,
                        subject=item.get("subject", ""),
                        skill_name=meta.get("subskill_description") or item.get("skill_name", sid),
                        reason=SessionReason(item.get("reason", SessionReason.NEXT_IN_SEQUENCE.value)),
                        priority=item["priority"],
                        prerequisites_met=item.get("prerequisites_met", True),
                        bottleneck=item.get("bottleneck", False),
                        session_category=category,
                        unit_title=meta.get("unit_title"),
                        skill_description=meta.get("skill_description"),
                        subskill_description=meta.get("subskill_description"),
                    ).model_dump()
                )
            else:
                # Determine review reason: mastery retest > tight loop > scheduled
                if item.get("is_mastery_retest"):
                    reason = SessionReason.MASTERY_RETEST
                elif item.get("in_tight_loop"):
                    reason = SessionReason.TIGHT_LOOP_RECOVERY
                else:
                    reason = SessionReason.SCHEDULED_REVIEW

                sessions.append(
                    ReviewSessionItem(
                        skill_id=sid,
                        subject=item.get("subject", ""),
                        skill_name=meta.get("subskill_description") or item.get("skill_name", sid),
                        reason=reason,
                        priority=item["priority"],
                        review_session=len(item.get("review_history", [])) + 1,
                        estimated_ultimate=item.get("estimated_ultimate", DEFAULT_ULTIMATE),
                        completion_factor=item.get("completion_factor", 0.0),
                        days_overdue=item.get("days_overdue", 0),
                        is_mastery_retest=item.get("is_mastery_retest", False),
                        mastery_gate=item.get("mastery_gate"),
                        session_category=category,
                        unit_title=meta.get("unit_title"),
                        skill_description=meta.get("skill_description"),
                        subskill_description=meta.get("subskill_description"),
                    ).model_dump()
                )

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
    def _checkpoint_counts(skills: List[Dict]) -> CheckpointBreakdown:
        """Count in-review/learning skills by checkpoint stage."""
        c2 = c4 = c6 = 0
        for s in skills:
            if s.get("status") not in ("in_review", "learning"):
                continue
            sc = s.get("sessions_completed", 0)
            if sc == 1:
                c2 += 1
            elif sc == 2:
                c4 += 1
            elif sc >= 3:
                c6 += 1
            # sc == 0: learning but not yet mastered — not in review pipeline
        return CheckpointBreakdown(
            checkpoint_2wk=c2,
            checkpoint_4wk=c4,
            checkpoint_6wk=c6,
        )

    @staticmethod
    def _count_subskills(curriculum_data: List[Dict]) -> int:
        """Count total subskills in a curriculum hierarchy."""
        count = 0
        for unit in curriculum_data:
            for skill in unit.get("skills", []):
                count += len(skill.get("subskills", []))
        return count

    # ====================================================================
    # Session Interleaving (PRD Section 8)
    # ====================================================================

    @staticmethod
    def _alternate_subjects(reviews: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Reorder reviews so consecutive items differ in subject when possible.

        Uses a greedy approach: at each step, pick the item from the subject
        with the most remaining items that differs from the last-placed subject.
        Falls back to same-subject when no alternative exists (PRD §8, Rule 4).
        """
        if len(reviews) <= 1:
            return list(reviews)

        from collections import defaultdict, deque

        by_subject: Dict[str, deque] = defaultdict(deque)
        for r in reviews:
            by_subject[r.get("subject", "")].append(r)

        result: List[Dict[str, Any]] = []
        last_subject: Optional[str] = None

        while any(len(q) > 0 for q in by_subject.values()):
            # Sort candidates by queue length descending (avoid bunching)
            candidates = sorted(
                ((subj, q) for subj, q in by_subject.items() if len(q) > 0),
                key=lambda x: -len(x[1]),
            )

            placed = False
            # Prefer a subject different from the last one
            for subj, q in candidates:
                if subj != last_subject:
                    result.append(q.popleft())
                    last_subject = subj
                    placed = True
                    break

            # If all remaining items are the same subject, take the next one
            if not placed:
                for subj, q in candidates:
                    if len(q) > 0:
                        result.append(q.popleft())
                        last_subject = subj
                        break

        return result

    def _interleave_sessions(
        self,
        review_queue: List[Dict[str, Any]],
        new_skills: List[Dict[str, Any]],
        capacity: int,
    ) -> List[Dict[str, Any]]:
        """
        Build an interleaved session sequence per PRD Section 8.

        Output order:
          1. Tight-loop recovery items (served first while student is fresh)
          2. Interleaved body: [new_block, review, review, new_block, ...]
             - New skill blocks front-loaded in first 60% of total sessions
             - Reviews subject-alternated
          3. Tail: remaining reviews after the 60% boundary

        Each returned item has 'session_category' and 'priority' set.
        """
        REVIEWS_PER_NEW_BLOCK = 2

        # --- Partition reviews ---
        tight_loops = [r for r in review_queue if r.get("in_tight_loop")]
        scheduled = [r for r in review_queue if not r.get("in_tight_loop")]

        # Tag types for downstream identification
        for item in tight_loops:
            item.setdefault("type", "review")
        for item in scheduled:
            item.setdefault("type", "review")
        for item in new_skills:
            item.setdefault("type", "new")

        # --- Subject-alternate scheduled reviews ---
        alternated = self._alternate_subjects(scheduled)

        # --- Fatigue boundary (PRD §8.4) ---
        total = len(tight_loops) + len(alternated) + len(new_skills)
        front_boundary = math.ceil(total * 0.60) if total > 0 else 0

        result: List[Dict[str, Any]] = []

        # Phase 1: tight loops
        for item in tight_loops:
            item["session_category"] = SessionCategory.TIGHT_LOOP.value
            result.append(item)

        # Phase 2: interleaved body
        rev_iter = iter(alternated)
        new_iter = iter(new_skills)
        rev_done = False
        new_done = False

        while not (rev_done and new_done):
            past_boundary = len(result) >= front_boundary

            # Place a new-skill block if within front 60%
            if not new_done and not past_boundary:
                try:
                    n = next(new_iter)
                    n["session_category"] = SessionCategory.INTERLEAVED.value
                    result.append(n)
                except StopIteration:
                    new_done = True

            # Place up to REVIEWS_PER_NEW_BLOCK reviews
            placed = 0
            while placed < REVIEWS_PER_NEW_BLOCK and not rev_done:
                cat = (
                    SessionCategory.TAIL.value
                    if len(result) >= front_boundary
                    else SessionCategory.INTERLEAVED.value
                )
                try:
                    r = next(rev_iter)
                    r["session_category"] = cat
                    result.append(r)
                    placed += 1
                except StopIteration:
                    rev_done = True
                    break

            # Drain remaining new skills if reviews exhausted
            if rev_done and not new_done:
                for n in new_iter:
                    cat = (
                        SessionCategory.TAIL.value
                        if len(result) >= front_boundary
                        else SessionCategory.INTERLEAVED.value
                    )
                    n["session_category"] = cat
                    result.append(n)
                new_done = True

            # Drain remaining reviews if new skills exhausted
            if new_done and not rev_done:
                for r in rev_iter:
                    cat = (
                        SessionCategory.TAIL.value
                        if len(result) >= front_boundary
                        else SessionCategory.INTERLEAVED.value
                    )
                    r["session_category"] = cat
                    result.append(r)
                rev_done = True

        # Assign sequential priority
        for i, item in enumerate(result):
            item["priority"] = i + 1

        return result
