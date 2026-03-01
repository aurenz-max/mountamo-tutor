# backend/app/services/planning_service.py
"""
Planning Service — Algorithmic Weekly & Daily Planner

Replaces the LLM-based WeeklyPlannerService with a pure Firestore-native,
deterministic planning engine.

Single data source: mastery_lifecycle subcollection (PRD §2).

Data sources (all Firestore):
  - curriculum_published     — total skills per subject
  - students/{id}/mastery_lifecycle — unified lifecycle state
  - students/{id}            — planning fields (capacity)
  - config/schoolYear        — year dates, breaks
  - curriculum_graphs        — prerequisite relationships (via LearningPathsService)
"""

import logging
import math
from datetime import datetime, date, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from ..db.firestore_service import FirestoreService
from ..services.curriculum_service import CurriculumService
from ..models.planning import (
    ConfidenceBand,
    DailyPlanResponse,
    EndOfYearProjection,
    EndOfYearScenarios,
    MonthlyPlanResponse,
    MonthlyWarning,
    NewSkillSessionItem,
    ReviewSessionItem,
    SchoolBreak,
    SchoolYearConfig,
    SessionCategory,
    SessionReason,
    SubjectCurrentState,
    SubjectMonthlyProjection,
    SubjectWeekProgress,
    SubjectWeeklyStats,
    WeeklyPlanResponse,
    WeekProjection,
)

logger = logging.getLogger(__name__)

DEFAULT_CAPACITY = 25


class PlanningService:
    """
    Stateless planning engine.  Every call reads live Firestore state and
    computes the answer — no stored plans, no LLM, no BigQuery.

    Reads exclusively from mastery_lifecycle subcollection (PRD §2).
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
    # Gate-to-status mapping (PRD §5.1)
    # ====================================================================

    @staticmethod
    def _count_by_gate_status(
        lifecycles: List[Dict[str, Any]], subject: str
    ) -> Tuple[int, int, int, int, List[Dict[str, Any]]]:
        """
        Count closed / in_review / learning / not_started from mastery
        lifecycle gate values for a given subject.

        Gate mapping (PRD §5.1):
          Gate 4          → closed
          Gate 1, 2, 3    → in_review
          Gate 0 + evals  → learning
          No document     → not_started (handled by caller)

        Returns: (closed, in_review, learning, total_subskills_in_subject, subj_lifecycles)
        """
        subj_lcs = [lc for lc in lifecycles if lc.get("subject") == subject]
        closed = sum(1 for lc in subj_lcs if lc.get("current_gate", 0) >= 4)
        in_review = sum(1 for lc in subj_lcs if 1 <= lc.get("current_gate", 0) <= 3)
        learning = sum(
            1 for lc in subj_lcs
            if lc.get("current_gate", 0) == 0 and lc.get("lesson_eval_count", 0) > 0
        )
        return closed, in_review, learning, len(subj_lcs), subj_lcs

    # ====================================================================
    # Weekly Planner (PRD Section 5.4)
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

        # 3. Load all mastery lifecycles for this student
        all_lifecycles = await self.firestore.get_all_mastery_lifecycles(student_id)

        # 4. Load available subjects from curriculum
        subjects_list = await self.curriculum.get_available_subjects()
        subject_names: List[str] = []
        for s in subjects_list:
            if isinstance(s, dict):
                subject_names.append(s.get("subject_name") or s.get("subject_id", ""))
            else:
                subject_names.append(str(s))

        # 5. Compute per-subject stats
        subjects_stats: Dict[str, SubjectWeeklyStats] = {}
        warnings: List[str] = []
        total_in_pipeline = 0

        for subj in subject_names:
            # Get total subskills from curriculum
            curriculum_data = await self.curriculum.get_curriculum(subj)
            total_subskills = self._count_subskills(curriculum_data)

            # Count by gate status (PRD §5.1)
            closed, in_review, learning_count, _, subj_lcs = self._count_by_gate_status(
                all_lifecycles, subj
            )
            not_started = max(0, total_subskills - closed - in_review - learning_count)

            expected_by_now = round(total_subskills * fraction_elapsed, 1)
            behind_by = round(max(0, expected_by_now - closed - in_review), 1)

            if weeks_remaining > 0:
                weekly_new_target = math.ceil(not_started / weeks_remaining)
            else:
                weekly_new_target = not_started

            # Review reserve: sum of estimated_remaining_attempts for in-pipeline skills
            review_reserve = sum(
                lc.get("estimated_remaining_attempts", 0)
                for lc in subj_lcs
                if 0 < lc.get("current_gate", 0) < 4
            )

            total_in_pipeline += in_review + learning_count

            stats = SubjectWeeklyStats(
                total_skills=total_subskills,
                closed=closed,
                in_review=in_review,
                not_started=not_started,
                learning=learning_count,
                expected_by_now=expected_by_now,
                behind_by=behind_by,
                weekly_new_target=weekly_new_target,
                review_reserve=review_reserve,
            )
            subjects_stats[subj] = stats

            # Capacity overload warning
            if behind_by > 0:
                warnings.append(f"{subj}: {behind_by} skills behind expected pace")

        # Estimate sustainable new per day from current pipeline load
        estimated_daily_review_load = round(total_in_pipeline / 5.0, 1)
        sustainable = max(0.0, capacity - estimated_daily_review_load)

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
    # Monthly Planner — Forward Simulation (PRD Section 5.5)
    # ====================================================================

    async def get_monthly_plan(self, student_id: int) -> MonthlyPlanResponse:
        """
        Run a week-by-week forward simulation projecting where the student
        will be at 4, 8, and 12+ weeks out.

        Produces per-subject trajectories with optimistic / best-estimate /
        pessimistic confidence bands and early-warning flags.

        Pipeline delay model (PRD §5.5):
          Perfect:    4 weeks (ceil(24 days / 7))
          Typical:    5 weeks (ceil(30 days / 7))
          Pessimistic: 6 weeks (ceil(40 days / 7), 2+ failures)
        """
        today = datetime.now(timezone.utc).date()

        # 1. Load shared inputs
        config = await self._get_school_year_config()
        year_start = date.fromisoformat(config.start_date)
        year_end = date.fromisoformat(config.end_date)
        total_days = (year_end - year_start).days or 1
        fraction_elapsed = min(max((today - year_start).days / total_days, 0.0), 1.0)
        weeks_remaining = self._school_weeks_remaining(today, year_end, config.breaks)

        planning = await self.firestore.get_student_planning_fields(student_id)
        capacity = planning.get("daily_session_capacity", DEFAULT_CAPACITY)
        weekly_capacity = capacity * 5  # school days per week

        all_lifecycles = await self.firestore.get_all_mastery_lifecycles(student_id)

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

            closed, in_review, learning_count, _, subj_lcs = self._count_by_gate_status(
                all_lifecycles, subj
            )
            not_started = max(0, total_subskills - closed - in_review - learning_count)

            current_state = SubjectCurrentState(
                total=total_subskills,
                closed=closed,
                inReview=in_review,
                notStarted=not_started,
            )

            # Confidence bands from mastery lifecycle pass rates
            closed_lcs = [lc for lc in subj_lcs if lc.get("current_gate", 0) >= 4]
            if len(closed_lcs) >= 3:
                pass_rates = [lc.get("blended_pass_rate", 0.8) for lc in closed_lcs]
                mean_pr = sum(pass_rates) / len(pass_rates)
                variance = sum((p - mean_pr) ** 2 for p in pass_rates) / len(pass_rates)
                stddev_pr = math.sqrt(variance)
            else:
                mean_pr = 0.8
                stddev_pr = 0.15

            # Pipeline delay model (PRD §5.5: mastery lifecycle intervals)
            # Perfect: 24 days (3+7+14), Typical: 30 days, Pessimistic: 40 days
            weeks_to_close_best = 4   # ceil(24/7)
            weeks_to_close_opt = 4    # Optimistic path
            weeks_to_close_pess = 6   # 2+ failures: ~40 days

            # Build known-review schedule from in-pipeline mastery lifecycles
            known_reviews_by_week: dict[int, int] = {}
            in_pipeline_lcs = [
                lc for lc in subj_lcs
                if 1 <= lc.get("current_gate", 0) <= 3 and lc.get("next_retest_eligible")
            ]
            for lc in in_pipeline_lcs:
                try:
                    retest_date = date.fromisoformat(lc["next_retest_eligible"][:10])
                except (ValueError, TypeError):
                    continue
                if retest_date <= today:
                    week_num = 1  # overdue
                else:
                    delta_days = (retest_date - today).days
                    week_num = max(1, (delta_days // 7) + 1)
                if week_num <= weeks_remaining:
                    known_reviews_by_week[week_num] = known_reviews_by_week.get(week_num, 0) + 1

            # Pacing target
            pacing_target = math.ceil(not_started / weeks_remaining) if weeks_remaining > 0 else not_started

            # Build existing closure pipeline from gate-based remaining intervals
            existing_closures_by_week: dict[int, int] = {}
            for lc in subj_lcs:
                gate = lc.get("current_gate", 0)
                if 1 <= gate <= 3:
                    # Remaining days based on actual gate intervals
                    if gate == 1:
                        remaining_days = 3 + 7 + 14  # Gates 2, 3, 4
                    elif gate == 2:
                        remaining_days = 7 + 14  # Gates 3, 4
                    else:  # gate == 3
                        remaining_days = 14  # Gate 4 only
                    weeks_until_close = max(1, math.ceil(remaining_days / 7))
                    if weeks_until_close <= weeks_remaining:
                        existing_closures_by_week[weeks_until_close] = (
                            existing_closures_by_week.get(weeks_until_close, 0) + 1
                        )

            # --- Forward simulation ---
            week_by_week: list[WeekProjection] = []
            warnings: list[MonthlyWarning] = []

            open_inventory = in_review + learning_count
            cumulative_mastered_f = float(closed)
            cumulative_mastered_opt_f = float(closed)
            cumulative_mastered_pess_f = float(closed)

            new_introductions_by_week: list[int] = []

            for w in range(1, weeks_remaining + 1):
                week_monday = today + timedelta(days=(7 * (w - 1)) - today.weekday())
                if week_monday < today:
                    week_monday += timedelta(days=7)

                # --- Reviews due this week ---
                known_this_week = known_reviews_by_week.get(w, 0)

                # Estimated reviews from skills introduced in prior weeks
                # Gate transitions at ~1wk (3d), ~2wk (7d), ~4wk (14d)
                estimated_reviews = 0
                for intro_week_idx, intro_count in enumerate(new_introductions_by_week):
                    if intro_count <= 0:
                        continue
                    weeks_since_intro = w - (intro_week_idx + 1)
                    if weeks_since_intro in (1, 2, 4):
                        estimated_reviews += intro_count

                projected_reviews_due = known_this_week + estimated_reviews

                # --- Closures: pipeline delay model ---
                existing_closures = existing_closures_by_week.get(w, 0)

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
    # Daily Planner (PRD Section 5.2)
    # ====================================================================

    async def get_daily_plan(self, student_id: int) -> DailyPlanResponse:
        """
        Compute today's prioritised session queue.

        Step 1: Build review queue from mastery retests due (single source).
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

        # ---- Step 1: Review queue (single source — PRD §5.2) ----
        # All reviews come from mastery_lifecycle retests. No dual-source merge.
        review_queue: List[Dict[str, Any]] = []
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

                review_queue.append({
                    "skill_id": ml.get("subskill_id", ""),
                    "subject": ml.get("subject", ""),
                    "skill_name": ml.get("subskill_id", ""),
                    "type": "review",
                    "reason": SessionReason.MASTERY_RETEST.value,
                    "mastery_gate": ml.get("current_gate", 0),
                    "completion_factor": ml.get("completion_pct", 0.0),
                    "days_overdue": days_overdue,
                })

            # Sort: most overdue first, then lowest gate first (PRD §5.2)
            review_queue.sort(
                key=lambda x: (
                    -x.get("days_overdue", 0),
                    x.get("mastery_gate", 0),
                )
            )

            if review_queue:
                logger.info(
                    f"[DAILY_PLAN] {len(review_queue)} mastery retests due for student {student_id}"
                )
        except Exception as e:
            logger.warning(f"[DAILY_PLAN] Failed to fetch mastery retests: {e}")

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
                deficit = stats.weekly_new_target
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

                # Filter to not_started only (PRD §5.3)
                mastery_lifecycles = await self.firestore.get_all_mastery_lifecycles(
                    student_id, subject=subj
                )
                lifecycle_by_id = {
                    lc.get("subskill_id"): lc for lc in mastery_lifecycles
                }

                not_started_ids = [
                    sid for sid in unlocked
                    if sid not in lifecycle_by_id
                    or lifecycle_by_id[sid].get("current_gate", 0) == 0
                ]

                # Separate gate-eligible vs gate-blocked candidates
                eligible = []
                blocked_with_score = []
                for sid in not_started_ids:
                    prereq_lc = lifecycle_by_id.get(sid)
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
                        "skill_name": skill_id,
                        "type": "new",
                        "reason": reason,
                        "prerequisites_met": not is_bottleneck,
                        "bottleneck": is_bottleneck,
                    })
                    allocated += 1

                if allocated >= new_skill_slots:
                    break

        # ---- Step 4: Enrich with curriculum names ----
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
                sessions.append(
                    ReviewSessionItem(
                        skill_id=sid,
                        subject=item.get("subject", ""),
                        skill_name=meta.get("subskill_description") or item.get("skill_name", sid),
                        reason=SessionReason.MASTERY_RETEST,
                        priority=item["priority"],
                        completion_factor=item.get("completion_factor", 0.0),
                        days_overdue=item.get("days_overdue", 0),
                        mastery_gate=item.get("mastery_gate"),
                        session_category=category,
                        unit_title=meta.get("unit_title"),
                        skill_description=meta.get("skill_description"),
                        subskill_description=meta.get("subskill_description"),
                    ).model_dump()
                )

        # Week progress
        week_progress: Dict[str, SubjectWeekProgress] = {}
        for subj, stats in weekly_plan.subjects.items():
            week_progress[subj] = SubjectWeekProgress(
                new_target=stats.weekly_new_target,
                new_completed=0,
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
            candidates = sorted(
                ((subj, q) for subj, q in by_subject.items() if len(q) > 0),
                key=lambda x: -len(x[1]),
            )

            placed = False
            for subj, q in candidates:
                if subj != last_subject:
                    result.append(q.popleft())
                    last_subject = subj
                    placed = True
                    break

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
          1. Most-overdue mastery retests first (student is fresh)
          2. Interleaved body: [new_block, review, review, new_block, ...]
             - New skill blocks front-loaded in first 60% of total sessions
             - Reviews subject-alternated
          3. Tail: remaining reviews after the 60% boundary

        Each returned item has 'session_category' and 'priority' set.
        """
        REVIEWS_PER_NEW_BLOCK = 2

        # Tag types for downstream identification
        for item in review_queue:
            item.setdefault("type", "review")
        for item in new_skills:
            item.setdefault("type", "new")

        # Subject-alternate reviews
        alternated = self._alternate_subjects(review_queue)

        # Fatigue boundary (PRD §8.4)
        total = len(alternated) + len(new_skills)
        front_boundary = math.ceil(total * 0.60) if total > 0 else 0

        result: List[Dict[str, Any]] = []

        # Interleaved body
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
