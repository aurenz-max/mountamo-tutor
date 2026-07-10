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

from ..core.config import settings
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
from ..models.skill_progress import (
    AlmostReadyItem,
    CraftingNowItem,
    PrerequisiteStatus,
    SkillProgressResponse,
    SubjectProgressSummary,
)
from ..models.lesson_plan import DailySessionPlan  # PRD Daily Learning Experience

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
        analytics_service: Optional[Any] = None,  # FirestoreAnalyticsService
    ):
        self.firestore = firestore_service
        self.curriculum = curriculum_service
        self.learning_paths = learning_paths_service
        # When present, daily-session new-skill selection uses the IRT
        # session-scope selector (select_session_targets) — ONE selection
        # brain shared with the Lesson Builder's Recommended fill mode.
        self.analytics = analytics_service
        logger.info("PlanningService initialized")

    def _now(self) -> datetime:
        """Current time, following the storage layer's virtual clock when set.

        Simulation harnesses (pulse-agent loop mode) advance `virtual_now` on
        their in-memory store so retest due-dates and pacing math run on the
        simulated timeline. Production FirestoreService has no such attribute
        → wall clock, unchanged behavior. The isinstance guard also keeps
        MagicMock stores (unit tests) on the wall clock.
        """
        vn = getattr(self.firestore, "virtual_now", None)
        return vn if isinstance(vn, datetime) else datetime.now(timezone.utc)

    # ====================================================================
    # Status mapping (PRD §16.5 — stability-based retention model)
    # ====================================================================

    @staticmethod
    def _derive_retention_state(lc: Dict[str, Any]) -> str:
        """Derive retention_state from lifecycle doc, with legacy gate fallback."""
        rs = lc.get("retention_state")
        if rs and rs in ("not_started", "active", "mastered"):
            return rs
        # Legacy fallback from gate field
        gate = lc.get("current_gate", 0)
        if gate >= 4:
            return "mastered"
        elif gate >= 1:
            return "active"
        return "not_started"

    @staticmethod
    def _collect_subskill_ids(curriculum_data: List[Dict]) -> set:
        """All subskill ids in a curriculum hierarchy — the canonical way to
        decide whether a lifecycle doc belongs to a subject. Lifecycle docs
        carry the subject string the submitter sent ("math", "Mathematics",
        "MATHEMATICS_GK", …), so string equality against curriculum subject
        ids silently drops docs; subskill-id membership does not."""
        ids = set()
        for unit in curriculum_data:
            for skill in unit.get("skills", []):
                for subskill in skill.get("subskills", []):
                    ssid = subskill.get("id")
                    if ssid:
                        ids.add(ssid)
        return ids

    @staticmethod
    def _count_by_gate_status(
        lifecycles: List[Dict[str, Any]],
        subject: str,
        subject_subskill_ids: Optional[set] = None,
    ) -> Tuple[int, int, int, int, List[Dict[str, Any]]]:
        """
        Count closed / in_review / learning / not_started from mastery
        lifecycle state for a given subject.

        Subject membership is decided by subskill-id membership in the
        subject's curriculum when `subject_subskill_ids` is provided
        (robust to non-canonical subject strings on lifecycle docs);
        falls back to raw subject-string equality otherwise.

        Retention state mapping (PRD §16.5):
          mastered (or gate >= 4)           → closed
          active (or gate 1-3)              → in_review
          not_started + evals (or gate 0)   → learning
          No document                       → not_started (handled by caller)

        Returns: (closed, in_review, learning, total_subskills_in_subject, subj_lifecycles)
        """
        if subject_subskill_ids:
            subj_lcs = [
                lc for lc in lifecycles
                if lc.get("subskill_id") in subject_subskill_ids
            ]
        else:
            subj_lcs = [lc for lc in lifecycles if lc.get("subject") == subject]
        closed = 0
        in_review = 0
        learning = 0
        for lc in subj_lcs:
            rs = PlanningService._derive_retention_state(lc)
            if rs == "mastered":
                closed += 1
            elif rs == "active":
                in_review += 1
            elif lc.get("lesson_eval_count", 0) > 0:
                learning += 1
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
        today = self._now().date()
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
                subject_names.append(s.get("subject_id") or s.get("subject_name", ""))
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

            # Count by gate status (PRD §5.1) — membership via curriculum ids
            closed, in_review, learning_count, _, subj_lcs = self._count_by_gate_status(
                all_lifecycles, subj, self._collect_subskill_ids(curriculum_data)
            )
            not_started = max(0, total_subskills - closed - in_review - learning_count)

            expected_by_now = round(total_subskills * fraction_elapsed, 1)
            behind_by = round(max(0, expected_by_now - closed - in_review), 1)

            if weeks_remaining > 0:
                weekly_new_target = math.ceil(not_started / weeks_remaining)
            else:
                weekly_new_target = not_started

            # Review reserve: sum of estimated_remaining_attempts for active skills
            review_reserve = sum(
                lc.get("estimated_remaining_attempts", 0)
                for lc in subj_lcs
                if PlanningService._derive_retention_state(lc) == "active"
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

        Pipeline delay model (PRD §5.5, mastery lifecycle intervals 3d/7d/14d):
          Optimistic:    4 weeks (ceil(24 days / 7), perfect — no failures)
          Best estimate: 5 weeks (ceil(30 days / 7), typical — ~1 failure)
          Pessimistic:   6 weeks (ceil(40 days / 7), struggling — 2+ failures)

        Capacity model (PRD §3.2):
          Each new introduction costs 3 lesson eval sessions.
          Each retest costs 1 session.
          Total daily load for N new/day: 3N (lessons) + 3N (retests) = 6N
        """
        today = self._now().date()

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
                subject_names.append(s.get("subject_id") or s.get("subject_name", ""))
            else:
                subject_names.append(str(s))

        # 2. Build projections per subject
        projections: dict[str, SubjectMonthlyProjection] = {}

        for subj in subject_names:
            curriculum_data = await self.curriculum.get_curriculum(subj)
            total_subskills = self._count_subskills(curriculum_data)

            closed, in_review, learning_count, _, subj_lcs = self._count_by_gate_status(
                all_lifecycles, subj, self._collect_subskill_ids(curriculum_data)
            )
            not_started = max(0, total_subskills - closed - in_review - learning_count)

            current_state = SubjectCurrentState(
                total=total_subskills,
                closed=closed,
                inReview=in_review,
                notStarted=not_started,
            )

            # Confidence bands from mastery lifecycle pass rates
            closed_lcs = [
                lc for lc in subj_lcs
                if PlanningService._derive_retention_state(lc) == "mastered"
            ]
            if len(closed_lcs) >= 3:
                pass_rates = [lc.get("blended_pass_rate", 0.8) for lc in closed_lcs]
                mean_pr = sum(pass_rates) / len(pass_rates)
                variance = sum((p - mean_pr) ** 2 for p in pass_rates) / len(pass_rates)
                stddev_pr = math.sqrt(variance)
            else:
                mean_pr = 0.8
                stddev_pr = 0.15

            # Pipeline delay model (PRD §16 stability model)
            # Strong learner: ~30 days (3 reviews: 3d→7.5d→18.75d→mastered)
            # Typical: ~40 days (4 reviews with partial recall)
            # Struggling: ~55 days (6+ reviews with failures)
            weeks_to_close_opt = 4    # ceil(30/7) — strong, no failures
            weeks_to_close_best = 6   # ceil(40/7) — typical, some partial recall
            weeks_to_close_pess = 8   # ceil(55/7) — struggling, multiple failures

            # Lesson sessions per new introduction (PRD §3.2)
            sessions_per_intro = 3

            # Build known-review schedule from active mastery lifecycles
            known_reviews_by_week: dict[int, int] = {}
            in_pipeline_lcs = [
                lc for lc in subj_lcs
                if PlanningService._derive_retention_state(lc) == "active"
                and lc.get("last_reviewed")
            ]
            for lc in in_pipeline_lcs:
                # Estimate next review from stability (review surfaces when P < 0.85)
                stability = lc.get("stability", 3.0)
                try:
                    last_reviewed = date.fromisoformat(lc["last_reviewed"][:10])
                    next_review = last_reviewed + timedelta(days=stability)
                except (ValueError, TypeError):
                    continue
                if next_review <= today:
                    week_num = 1  # overdue
                else:
                    delta_days = (next_review - today).days
                    week_num = max(1, (delta_days // 7) + 1)
                if week_num <= weeks_remaining:
                    known_reviews_by_week[week_num] = known_reviews_by_week.get(week_num, 0) + 1

            # Pacing target
            pacing_target = math.ceil(not_started / weeks_remaining) if weeks_remaining > 0 else not_started

            # Build existing closure pipeline from stability-based projections
            existing_closures_by_week: dict[int, int] = {}
            for lc in subj_lcs:
                rs = PlanningService._derive_retention_state(lc)
                if rs == "active":
                    stability = lc.get("stability", 3.0)
                    # Project days until stability > 30 (mastered)
                    # Assume strong recall (×2.5) per review at interval ~= stability
                    projected_s = stability
                    remaining_days = 0.0
                    while projected_s < 30.0 and remaining_days < 365:
                        remaining_days += projected_s
                        projected_s *= 2.5
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

                # Estimated reviews from skills introduced in prior weeks.
                # Mastery lifecycle retests (PRD §2.1): 1 session each at
                #   week +1 (Gate 1→2, 3d), +2 (Gate 2→3, 7d), +4 (Gate 3→4, 14d)
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

                new_closures_opt = 0.0
                new_closures_best = 0.0
                new_closures_pess = 0.0

                source_opt = w - weeks_to_close_opt  # 4-week optimistic pipeline
                if 1 <= source_opt <= len(new_introductions_by_week):
                    new_closures_opt = float(new_introductions_by_week[source_opt - 1])

                source_best = w - weeks_to_close_best  # 5-week typical pipeline
                if 1 <= source_best <= len(new_introductions_by_week):
                    new_closures_best = float(new_introductions_by_week[source_best - 1])

                source_pess = w - weeks_to_close_pess  # 6-week struggling pipeline
                if 1 <= source_pess <= len(new_introductions_by_week):
                    new_closures_pess = float(new_introductions_by_week[source_pess - 1])

                closures_opt_f = existing_closures + new_closures_opt
                closures_best_f = existing_closures + new_closures_best
                closures_pess_f = existing_closures + new_closures_pess
                closures_for_inventory = round(closures_best_f)

                # --- New skill capacity (PRD §3.2: each intro = 3 lesson sessions) ---
                session_budget = max(0, weekly_capacity - projected_reviews_due)
                max_intros_from_budget = session_budget // sessions_per_intro
                new_introductions = min(max_intros_from_budget, pacing_target, not_started)
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
                if max_intros_from_budget <= 0:
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
            generatedAt=self._now().isoformat(),
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
        today = self._now().date()
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
                student_id, self._now().isoformat()
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

            # One unfiltered fetch, keyed by subskill_id. Never filter
            # lifecycles by subject string here: docs carry whatever subject
            # the submitter sent ("math", "MATHEMATICS_GK", …), so a string
            # filter drops them and mastered subskills get re-planned as
            # "new" forever. The unlocked lists below are already
            # subject-scoped by the curriculum graph.
            all_lifecycles = await self.firestore.get_all_mastery_lifecycles(
                student_id
            )
            lifecycle_by_id = {
                lc.get("subskill_id"): lc for lc in all_lifecycles
            }

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
                not_started_ids = [
                    sid for sid in unlocked
                    if sid not in lifecycle_by_id
                    or PlanningService._derive_retention_state(
                        lifecycle_by_id[sid]
                    ) == "not_started"
                ]

                # Separate eligible vs blocked candidates
                eligible = []
                blocked_with_score = []
                for sid in not_started_ids:
                    prereq_lc = lifecycle_by_id.get(sid)
                    if prereq_lc and PlanningService._derive_retention_state(
                        prereq_lc
                    ) != "mastered":
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
    # Structured Session Plan — PRD Daily Learning Experience §3
    # ====================================================================

    async def get_daily_session_plan(
        self, student_id: int, force_refresh: bool = False
    ) -> "DailySessionPlan":
        """
        Get-or-create today's structured session plan.

        The plan is a daily commitment: generated once, persisted at
        students/{id}/dailySessionPlans/{date}, and re-read on every visit so
        backing out and returning never reshuffles the student's blocks or
        zeroes their progress. Adaptivity happens *between* days — the date
        key rolls over and tomorrow's plan regenerates from fresh mastery
        state.

        force_refresh regenerates today's plan but carries finished work
        forward: completed blocks (and their completion marks) never
        disappear from the student's view.
        """
        from ..models.lesson_plan import BlockTimeEntry, DailySessionPlan, LessonBlock

        today_str = self._now().date().isoformat()
        stored = await self.firestore.get_daily_session_plan_doc(student_id, today_str)

        if stored and not force_refresh:
            try:
                return DailySessionPlan.model_validate(
                    {k: v for k, v in stored.items() if k in DailySessionPlan.model_fields}
                )
            except Exception as e:
                logger.warning(
                    f"[SESSION_PLAN] Stored plan {student_id}/{today_str} unreadable, "
                    f"regenerating: {e}"
                )

        plan = await self._build_daily_session_plan(student_id)

        # Refresh carry-forward: the time ledger is observed data — never
        # regenerate it away. Keyed by block_id, so entries for blocks the
        # new plan dropped remain readable for telemetry.
        if stored and stored.get("block_times"):
            carried_times: Dict[str, BlockTimeEntry] = {}
            for bid, raw in stored["block_times"].items():
                try:
                    carried_times[bid] = BlockTimeEntry.model_validate(raw)
                except Exception:
                    continue
            plan.block_times = {**carried_times, **plan.block_times}

        # Refresh carry-forward: keep every completed block visible even if
        # the regenerated plan no longer selects it, and re-attach the marks.
        if stored and stored.get("completed_block_ids"):
            completed_ids = list(stored["completed_block_ids"])
            new_ids = {b.block_id for b in plan.blocks}
            carried: List[LessonBlock] = []
            for raw in stored.get("blocks", []):
                if raw.get("block_id") in completed_ids and raw.get("block_id") not in new_ids:
                    try:
                        carried.append(LessonBlock.model_validate(raw))
                    except Exception:
                        continue
            if carried:
                plan.blocks = carried + plan.blocks
                for i, block in enumerate(plan.blocks):
                    block.block_index = i + 1
                plan.estimated_total_minutes = sum(b.estimated_minutes for b in plan.blocks)
                plan.total_subskills = sum(len(b.subskills) for b in plan.blocks)
                statuses = [ss.status for b in plan.blocks for ss in b.subskills]
                plan.new_subskills = sum(1 for s in statuses if s == "new")
                plan.review_subskills = sum(1 for s in statuses if s in ("review", "retest"))
            final_ids = {b.block_id for b in plan.blocks}
            plan.completed_block_ids = [bid for bid in completed_ids if bid in final_ids]

        # Persist only real plans — an empty plan stays unsaved so content
        # unlocked later today still gets picked up on the next visit.
        if plan.blocks:
            await self.firestore.save_daily_session_plan_doc(
                student_id, today_str, plan.model_dump(mode="json")
            )
        return plan

    async def mark_session_block_complete(
        self, student_id: int, block_id: str, plan_date: Optional[str] = None
    ) -> bool:
        """Record a finished lesson block on the day's persisted session plan."""
        target_date = plan_date or self._now().date().isoformat()
        return await self.firestore.add_completed_session_block(
            student_id, target_date, block_id
        )

    async def mark_session_block_started(
        self, student_id: int, block_id: str, plan_date: Optional[str] = None
    ) -> bool:
        """Append a start timestamp to the block's time ledger (append-only)."""
        target_date = plan_date or self._now().date().isoformat()
        return await self.firestore.mark_session_block_started(
            student_id, target_date, block_id
        )

    async def _build_daily_session_plan(self, student_id: int) -> "DailySessionPlan":
        """
        Build today's structured session plan using lesson groups and a
        time-based capacity model.

        Unlike get_daily_plan() (item-count model), this method:
          - Fills a minute budget (default 75 min) instead of a slot count
          - Groups related subskills into 2–5 subskill lesson blocks
          - Returns a DailySessionPlan with 4–5 ordered LessonBlocks
          - Caps review time at 50% of budget (PRD §3.3)

        PRD §3 Planning Engine flow:
          1. Collect due mastery retests + unlocked new subskills
          2. Enrich with curriculum metadata (unit, skill, subskill names)
          3. Group into LessonBlocks by domain + Bloom's taxonomy
          4. Fill time budget in priority order
          5. Shape session for cognitive variety
        """
        from ..services.lesson_group_service import LessonGroupService
        from ..models.lesson_plan import DEFAULT_DAILY_BUDGET_MINUTES, DailySessionPlan

        planning = await self.firestore.get_student_planning_fields(student_id)
        budget_minutes = planning.get("daily_budget_minutes", DEFAULT_DAILY_BUDGET_MINUTES)
        # Grade of record (students/{id}.grade_level). Without it the graph
        # fetch falls into first-doc-wins scanning and a K student is served
        # the Grade 1 curriculum everywhere downstream.
        student_grade = planning.get("grade_level")
        # Cross-grade progression: a subject whose frontier is exhausted can
        # run ahead of the grade of record via a per-subject override
        # ({"MATHEMATICS": "1"}). Detection lives in _allocate_subject_minutes
        # (the one place remaining work is computed); promotion warnings ride
        # on the plan so exhaustion is never silent again.
        grade_overrides: Dict[str, str] = dict(planning.get("subject_grade_overrides") or {})
        promotion_ready: Dict[str, Any] = dict(planning.get("promotion_ready") or {})
        promo_warnings: List[str] = []

        all_candidates: List[Dict[str, Any]] = []

        # --- Step 1a: Due mastery retests (reviews) ---
        try:
            mastery_due = await self.firestore.get_mastery_retests_due(
                student_id, self._now().isoformat()
            )
            for ml in mastery_due:
                all_candidates.append({
                    "skill_id":          ml.get("subskill_id", ""),
                    "subject":           ml.get("subject", ""),
                    "type":              "review",
                    "mastery_gate":      ml.get("current_gate", 0),
                    "completion_factor": ml.get("completion_pct", 0.0),
                    "days_overdue":      self._compute_days_overdue(ml),
                })
        except Exception as e:
            logger.warning(f"[SESSION_PLAN] Mastery retests error: {e}")

        # --- Step 1b: New subskills (per subject) ---
        # IRT-first: the session-scope selector picks confirm/learn targets
        # from P(correct) vs gate thresholds — the SAME brain as the Lesson
        # Builder's Recommended fill (Lesson Entry Contract, one selection
        # brain). Legacy unlocked-scan remains as the fallback when the
        # analytics service is absent or the selector errors/returns nothing.
        #
        # Pace-aware allocation: each subject's share of the minute budget is
        # proportional to its REMAINING work (subskill nodes not mastered),
        # so a nearly-done subject tapers off instead of idling while a
        # behind subject starves. The selector count per subject follows its
        # minute share; the allocation itself caps block fill downstream.
        allocation = None
        pace_by_subject: Dict[str, Any] = {}
        if self.learning_paths:
            weekly_plan = await self.get_weekly_plan(student_id)
            if self.analytics:
                allocation = await self._allocate_subject_minutes(
                    student_id, list(weekly_plan.subjects), budget_minutes,
                    grade=student_grade,
                    grade_overrides=grade_overrides,
                    promotion_ready=promotion_ready,
                    promo_warnings=promo_warnings,
                )
                if allocation:
                    pace_by_subject = {p.subject: p for p in allocation.subjects}
            for subj in weekly_plan.subjects:
                pace = pace_by_subject.get(subj)
                if pace_by_subject and pace is None:
                    # No published curriculum graph (e.g. ENGINEERING_G*):
                    # the selector AND the unlocked scan can only fail here —
                    # skip instead of burning three Firestore round-trips.
                    logger.info(
                        f"[SESSION_PLAN] {subj}: no curriculum graph — "
                        f"excluded from pace allocation, skipped"
                    )
                    continue
                if pace is not None and pace.remaining_subskills == 0:
                    # Nothing left to learn; due retests still arrive via
                    # Step 1a (retention is lifecycle's job, not the pacer's).
                    continue
                selector_added = 0
                if self.analytics:
                    try:
                        targets = await self.analytics.select_session_targets(
                            student_id,
                            subj,
                            grade=self._subject_grade(subj, student_grade, grade_overrides),
                            count=pace.selector_count if pace else 5,
                        )
                        for o in targets.get("objectives", []):
                            all_candidates.append({
                                "skill_id":         o["subskillId"],
                                "subject":          subj,
                                "type":             "new",
                                "mastery_gate":     o.get("currentGate", 0),
                                # Model-state verb (confirm→apply, learn→
                                # identify/explain) — wins over keyword
                                # classification in the block builder.
                                "selection_verb":   o.get("verb"),
                                "selection_kind":   o.get("kind"),
                                "selection_reason": o.get("reason"),
                            })
                            selector_added += 1
                        if selector_added:
                            logger.info(
                                f"[SESSION_PLAN] Selector picked {selector_added} "
                                f"targets for {subj}"
                            )
                    except Exception as e:
                        logger.warning(
                            f"[SESSION_PLAN] Selector failed for {subj}, "
                            f"falling back to unlocked scan: {e}"
                        )
                if selector_added:
                    continue

                try:
                    unlocked = await self.learning_paths.get_unlocked_entities(
                        student_id=student_id, entity_type="subskill", subject=subj
                    )
                except Exception as e:
                    logger.warning(f"[SESSION_PLAN] Unlocked entities error for {subj}: {e}")
                    continue

                # Unfiltered fetch — lifecycle docs carry non-canonical
                # subject strings, and a string filter here made mastered
                # subskills look not_started (served as "new" forever).
                # `unlocked` is already subject-scoped by the graph.
                lifecycles = await self.firestore.get_all_mastery_lifecycles(
                    student_id
                )
                lc_by_id = {lc.get("subskill_id"): lc for lc in lifecycles}

                added = 0
                for sid in unlocked:
                    lc   = lc_by_id.get(sid)
                    rs = PlanningService._derive_retention_state(lc) if lc else "not_started"
                    if rs != "mastered":
                        all_candidates.append({
                            "skill_id":     sid,
                            "subject":      subj,
                            "type":         "new",
                            "mastery_gate": lc.get("current_gate", 0) if lc else 0,
                        })
                        added += 1
                        if added >= 20:   # cap per subject; time budget handles final selection
                            break

        # Empty state
        if not all_candidates:
            today = self._now().date()
            day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            return DailySessionPlan(
                student_id=str(student_id),
                date=today.isoformat(),
                day_of_week=day_names[today.weekday()],
                grade_level=student_grade,
                budget_minutes=budget_minutes,
                warnings=["No skills due or available for today."] + promo_warnings,
            )

        # --- Step 2: Enrich with curriculum metadata ---
        session_subjects = {c.get("subject", "") for c in all_candidates}
        session_subjects.discard("")
        curriculum_lookup = await self._build_curriculum_lookup(session_subjects)

        # A candidate with no curriculum home cannot be taught or displayed
        # honestly (its "name" would be a raw id, and its evidence would
        # attribute to a phantom subskill). Drop it — the lookup is
        # grade-aware, so a miss means the id genuinely isn't in any
        # published curriculum (e.g. synthetic ids from old free-form
        # lessons that leaked into mastery_lifecycle).
        enriched: List[Dict[str, Any]] = []
        dropped: List[str] = []
        for c in all_candidates:
            sid  = c.get("skill_id", "")
            meta = curriculum_lookup.get(sid)
            if not meta:
                dropped.append(sid)
                continue
            enriched.append({
                **c,
                "unit_title":           meta.get("unit_title"),
                "parent_skill_id":      meta.get("skill_id", ""),
                "skill_description":    meta.get("skill_description"),
                "subskill_description": meta.get("subskill_description"),
            })
        if dropped:
            logger.warning(
                f"[SESSION_PLAN] Dropped {len(dropped)} candidate(s) with no "
                f"curriculum home (first 3: {dropped[:3]}) — run "
                f"scripts/cleanup_synthetic_lifecycle.py to retire them"
            )
        if not enriched:
            today = self._now().date()
            day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            return DailySessionPlan(
                student_id=str(student_id),
                date=today.isoformat(),
                day_of_week=day_names[today.weekday()],
                grade_level=student_grade,
                budget_minutes=budget_minutes,
                warnings=["No curriculum-resolvable skills available for today."],
            )

        # --- Step 3: Divert measurement into the daily pulse beat, group
        #     the rest into lesson blocks ---
        # Due mastery checks + the selector's confirm targets become ONE
        # ~4-min pulse block, first beat of the day — pulse is the
        # measurement half of the evidence economy, not a separate practice
        # surface. What used to ship as singleton Mastery Check blocks
        # ships inside the beat.
        pulse_items, teaching = LessonGroupService.split_pulse_candidates(enriched)
        candidate_blocks = LessonGroupService.group_subskills_into_blocks(teaching)
        if pulse_items:
            candidate_blocks.append(LessonGroupService.build_pulse_block(pulse_items))
            logger.info(
                f"[SESSION_PLAN] Pulse beat: {len(pulse_items)} measurement "
                f"item(s) absorbed for student {student_id}"
            )

        # --- Step 4–5: Fill budget and shape session ---
        subject_budgets = (
            {p.subject: p.allocated_minutes for p in allocation.subjects}
            if allocation else None
        )
        plan = LessonGroupService.build_session_plan(
            student_id=student_id,
            candidate_blocks=candidate_blocks,
            budget_minutes=budget_minutes,
            subject_budgets=subject_budgets,
        )
        plan.allocation = allocation
        # Grade of record rides on the plan so the launch surface generates
        # at the student's ACTUAL grade, not the UI's default band.
        # (Per-subject overrides scope the GRAPH each subject plans from;
        # a promoted subject's blocks carry next-grade subskill ids.)
        plan.grade_level = student_grade
        if promo_warnings:
            plan.warnings = list(plan.warnings or []) + promo_warnings
        return plan

    async def _allocate_subject_minutes(
        self,
        student_id: int,
        subjects: List[str],
        budget_minutes: int,
        grade: Optional[str] = None,
        grade_overrides: Optional[Dict[str, str]] = None,
        promotion_ready: Optional[Dict[str, Any]] = None,
        promo_warnings: Optional[List[str]] = None,
    ) -> Optional["PlanAllocation"]:
        """
        Pace-aware minute allocation: minutes ∝ remaining work per subject.

        Remaining work = subskill nodes not mastered/inferred in the same
        knowledge graph the selector reads (include_nodes=True warms exactly
        the cache entry select_session_targets will hit next). The KG carries
        both skill and subskill nodes — count subskills only.

        Subjects whose graph fails to load (no published curriculum) are
        omitted from the returned allocation; the caller skips them entirely.
        Returns None when no subject has a graph (caller keeps legacy flow).

        Cross-grade progression: each subject plans at its EFFECTIVE grade
        (per-subject override, else grade of record). This is also the one
        place an exhausted frontier is visible (remaining == 0 on a nonempty
        graph), so detection lives here: always record promotion-ready +
        warn; with AUTO_GRADE_PROMOTION, apply the override and re-read the
        next grade's graph so the plan continues immediately.
        """
        from ..models.lesson_plan import (
            ASSUMED_MIN_PER_SUBSKILL,
            PlanAllocation,
            SubjectPace,
        )

        if not self.analytics:
            return None

        async def _graph_counts(subj: str, subj_grade: Optional[str]) -> Optional[tuple]:
            kg = await self.analytics.get_knowledge_graph_progress(
                student_id, subj, include_nodes=True, grade=subj_grade
            )
            subskill_nodes = [
                n for n in kg.get("nodes", [])
                if n.get("entity_type") == "subskill"
            ]
            total = len(subskill_nodes)
            done = sum(
                1 for n in subskill_nodes
                if n.get("status") in ("mastered", "inferred")
            )
            # New-learning channels the selector can still serve. NOT
            # done==total: real graphs carry permanently-locked orphan nodes
            # (ghost edges), so "everything mastered" never literally happens
            # — exhaustion is "nothing left to TEACH". in_review is excluded:
            # retention flows through retests regardless of grade.
            teachable = sum(
                1 for n in subskill_nodes
                if n.get("status") in ("frontier", "in_progress")
            )
            return total, done, teachable

        paces: List[SubjectPace] = []
        for subj in subjects:
            subj_grade = self._subject_grade(subj, grade, grade_overrides)
            try:
                total, done, teachable = await _graph_counts(subj, subj_grade)
            except Exception as e:
                logger.info(
                    f"[SESSION_PLAN] Pace allocation: no graph for {subj} ({e})"
                )
                continue

            # Grade frontier exhausted: mastery exists and no reachable
            # subskill is left to teach. Record the signal (never silent),
            # and with AUTO_GRADE_PROMOTION continue on the next grade's graph.
            if total > 0 and done > 0 and teachable == 0 and subj_grade is not None:
                promoted_grade = await self._handle_frontier_exhausted(
                    student_id, subj, subj_grade, done,
                    grade_overrides, promotion_ready, promo_warnings,
                )
                if promoted_grade:
                    subj_grade = promoted_grade
                    try:
                        total, done, teachable = await _graph_counts(subj, subj_grade)
                    except Exception as e:
                        logger.warning(
                            f"[SESSION_PLAN] Promoted {subj} to grade "
                            f"{promoted_grade} but its graph failed to load: {e}"
                        )

            paces.append(SubjectPace(
                subject=subj,
                total_subskills=total,
                remaining_subskills=total - done,
                weight=0.0,
                allocated_minutes=0.0,
                selector_count=0,
            ))
        if not paces:
            return None

        total_remaining = sum(p.remaining_subskills for p in paces)
        for p in paces:
            p.weight = (
                p.remaining_subskills / total_remaining if total_remaining else 0.0
            )
            p.allocated_minutes = round(budget_minutes * p.weight, 1)
            # Candidate-pool sizing, not a quota: budget fill trims, so aim a
            # little above what the subject's minutes can hold (~8 min/target).
            p.selector_count = (
                0 if p.remaining_subskills == 0
                else max(2, min(8, math.ceil(p.allocated_minutes / 8)))
            )

        # Pace signal for UIs/telemetry: what finishing on time would take.
        # Denominated in the ASSUMED per-subskill cost until the block time
        # ledger yields an observed one — the field name carries the caveat.
        config = await self._get_school_year_config()
        try:
            year_end = date.fromisoformat(config.end_date)
        except (ValueError, TypeError):
            year_end = self._now().date()
        weeks_left = self._school_weeks_remaining(
            self._now().date(), year_end, config.breaks
        )
        required = (
            total_remaining * ASSUMED_MIN_PER_SUBSKILL / (weeks_left * 5)
            if weeks_left > 0 else 0.0
        )
        logger.info(
            f"[SESSION_PLAN] Pace allocation for {student_id}: "
            + ", ".join(
                f"{p.subject}={p.allocated_minutes}m ({p.remaining_subskills} left)"
                for p in paces
            )
            + f" | required to finish: {required:.0f} min/day vs {budget_minutes} budget"
        )
        return PlanAllocation(
            weeks_remaining=weeks_left,
            assumed_min_per_subskill=ASSUMED_MIN_PER_SUBSKILL,
            required_minutes_per_day=round(required, 1),
            subjects=paces,
        )

    @staticmethod
    def _subject_grade(
        subject: str,
        grade: Optional[str],
        grade_overrides: Optional[Dict[str, str]],
    ) -> Optional[str]:
        """Effective planning grade for a subject: per-subject override
        (keyed by rollup_subject_key) wins over the grade of record."""
        if grade_overrides:
            override = grade_overrides.get(FirestoreService.rollup_subject_key(subject))
            if override:
                return override
        return grade

    async def _handle_frontier_exhausted(
        self,
        student_id: int,
        subject: str,
        current_grade: str,
        mastered_count: int,
        grade_overrides: Optional[Dict[str, str]],
        promotion_ready: Optional[Dict[str, Any]],
        promo_warnings: Optional[List[str]],
    ) -> Optional[str]:
        """A subject's grade frontier is exhausted — record it, and with
        AUTO_GRADE_PROMOTION apply the per-subject override.

        Always writes a promotion-ready record (once per from→to pair) so
        exhaustion is observable by parent surfaces instead of reading as
        "done for now". Returns the new effective grade when auto-promotion
        applied, else None (the caller keeps the subject retention-only).

        See backend/docs/ISSUE_CROSS_GRADE_PROGRESSION.md.
        """
        key = FirestoreService.rollup_subject_key(subject)
        next_grade = FirestoreService.next_grade_level(current_grade)
        if next_grade is None:
            logger.info(
                f"[PROMOTION] Student {student_id}: {key} grade "
                f"{current_grade} exhausted with no higher grade to offer"
            )
            return None

        # 1. Record promotion-ready (idempotent per from→to pair)
        existing = (promotion_ready or {}).get(key) or {}
        record = existing
        if (
            existing.get("from_grade") != str(current_grade)
            or existing.get("to_grade") != next_grade
        ):
            record = {
                "from_grade": str(current_grade),
                "to_grade": next_grade,
                "mastered_subskills": mastered_count,
                "detected_at": self._now().isoformat(),
            }
            if promotion_ready is not None:
                promotion_ready[key] = record
            try:
                await self.firestore.update_student_planning_fields(
                    student_id, {"promotion_ready": {key: record}}
                )
            except Exception as e:
                logger.warning(
                    f"[PROMOTION] Could not persist promotion-ready for "
                    f"student {student_id}/{key}: {e}"
                )
            logger.info(
                f"[PROMOTION] Student {student_id}: {key} grade "
                f"{current_grade} frontier exhausted ({mastered_count} "
                f"subskills mastered) — ready for grade {next_grade}"
            )

        if not settings.AUTO_GRADE_PROMOTION:
            if promo_warnings is not None:
                promo_warnings.append(
                    f"{key}: grade {current_grade} curriculum complete "
                    f"({mastered_count} subskills mastered) — ready to "
                    f"advance to grade {next_grade} (awaiting approval)."
                )
            return None

        # 2. Auto-apply: verify the next grade's graph actually exists
        # before pointing the subject at it (promotion past the highest
        # published grade must not strand the student on a missing graph).
        try:
            kg = await self.analytics.get_knowledge_graph_progress(
                student_id, subject, include_nodes=True, grade=next_grade
            )
            has_subskills = any(
                n.get("entity_type") == "subskill" for n in kg.get("nodes", [])
            )
        except Exception as e:
            logger.info(
                f"[PROMOTION] Student {student_id}: no grade-{next_grade} "
                f"graph for {key} ({e}) — staying at {current_grade}"
            )
            has_subskills = False
        if not has_subskills:
            if promo_warnings is not None:
                promo_warnings.append(
                    f"{key}: grade {current_grade} curriculum complete but "
                    f"no grade-{next_grade} curriculum is published — "
                    f"retention only."
                )
            return None

        if grade_overrides is not None:
            grade_overrides[key] = next_grade
        applied = {
            **record,
            "applied": True,
            "applied_at": self._now().isoformat(),
        }
        if promotion_ready is not None:
            promotion_ready[key] = applied
        try:
            await self.firestore.update_student_planning_fields(
                student_id,
                {
                    "subject_grade_overrides": {key: next_grade},
                    "promotion_ready": {key: applied},
                },
            )
        except Exception as e:
            logger.warning(
                f"[PROMOTION] Could not persist grade override for "
                f"student {student_id}/{key}: {e}"
            )
        if promo_warnings is not None:
            promo_warnings.append(
                f"{key}: advanced to grade {next_grade} — grade "
                f"{current_grade} curriculum complete "
                f"({mastered_count} subskills mastered)."
            )
        logger.info(
            f"[PROMOTION] Student {student_id}: {key} auto-promoted "
            f"{current_grade} → {next_grade}"
        )
        return next_grade

    def _compute_days_overdue(self, ml: Dict[str, Any]) -> int:
        """Days elapsed since a mastery lifecycle retest was due."""
        today = self._now().date()
        retest_eligible = ml.get("next_retest_eligible", "")
        try:
            return max(0, (today - date.fromisoformat(retest_eligible[:10])).days)
        except (ValueError, TypeError):
            return 0

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
        # total_days − break_days is CALENDAR days of remaining term, so a
        # week is 7 of them. Dividing by 5 here (the old code) counted
        # weekends as school days and overstated remaining weeks by 1.4×.
        school_days = max(0, total_days - break_days)
        return max(1, school_days // 7)

    async def _build_curriculum_lookup(
        self, subjects: set[str]
    ) -> Dict[str, Dict[str, str]]:
        """
        Build a subskill_id → {unit_title, skill_description, subskill_description}
        lookup from the curriculum hierarchy for the given subjects.

        Grade-aware: subjects are published once PER GRADE under the same
        name, and a bare-subject fetch resolves to a single grade's doc — so
        a Kindergarten subskill would miss and its block would render as
        "General" with a raw id. Load every published grade doc whose subject
        matches and merge (ids are grade-unique; first entry wins).
        """
        lookup: Dict[str, Dict[str, str]] = {}

        # Resolve each requested subject to ALL of its published grade docs.
        docs_to_load: List[tuple] = []
        try:
            published = await self.firestore.get_all_published_subjects()
            want = {FirestoreService.rollup_subject_key(s) for s in subjects}
            docs_to_load = [
                (e.get("subject_id", ""), e.get("grade"))
                for e in published
                if FirestoreService.rollup_subject_key(e.get("subject_id")) in want
            ]
        except Exception as e:
            logger.warning(f"Published-subjects listing failed, bare-subject fallback: {e}")
        if not docs_to_load:
            docs_to_load = [(subj, None) for subj in subjects]

        for subj, grade in docs_to_load:
            try:
                curriculum_data = await self.curriculum.get_curriculum(subj, grade=grade)
            except Exception as e:
                logger.warning(f"Failed to load curriculum for {subj} (grade={grade}): {e}")
                continue
            for unit in curriculum_data:
                unit_title = unit.get("title", unit.get("id", ""))
                for skill in unit.get("skills", []):
                    skill_id = skill.get("id", "")
                    skill_desc = skill.get("description", skill_id)
                    for subskill in skill.get("subskills", []):
                        ss_id = subskill.get("id", "")
                        ss_desc = subskill.get("description", ss_id)
                        if ss_id and ss_id not in lookup:
                            lookup[ss_id] = {
                                "unit_title": unit_title,
                                "skill_id": skill_id,
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

    # ====================================================================
    # Skill Progress Panel — 3-Layer "Crafting" Projection
    # ====================================================================

    async def get_skill_progress(self, student_id: int) -> SkillProgressResponse:
        """
        Compute the 3-layer skill progress panel (WoW crafting metaphor).

        Layer 1 "Crafting Now":  LOCKED skills whose prerequisites are IN_PROGRESS.
                                 These are "recipes being crafted" — the student is
                                 actively gathering materials (working on prereqs).
        Layer 2 "Almost Ready":  UNLOCKED skills the student hasn't started yet.
                                 These are "recipes ready to craft" — all materials
                                 gathered, just needs to begin.
        Layer 3 "Progress Overview": Per-subject mastery summary bars.

        All reads are from Firestore via cached services — no LLM, no BigQuery.
        """
        now = self._now().isoformat()

        # ── 1. Load shared data ──────────────────────────────────────
        all_lifecycles = await self.firestore.get_all_mastery_lifecycles(student_id)
        lifecycle_map: Dict[str, Dict[str, Any]] = {
            lc.get("subskill_id", ""): lc for lc in all_lifecycles if lc.get("subskill_id")
        }

        subjects_list = await self.curriculum.get_available_subjects()
        subject_names: List[str] = []
        for s in subjects_list:
            if isinstance(s, dict):
                subject_names.append(s.get("subject_id") or s.get("subject_name", ""))
            else:
                subject_names.append(str(s))

        # ── 2. Layer 3: Progress Overview + build description lookup ──
        progress_overview: Dict[str, SubjectProgressSummary] = {}
        # Map entity IDs to human-readable descriptions from curriculum
        desc_lookup: Dict[str, str] = {}

        for subj in subject_names:
            try:
                curriculum_data = await self.curriculum.get_curriculum(subj)
            except Exception:
                continue

            # Build description lookup from curriculum hierarchy
            for unit in curriculum_data:
                for skill in unit.get("skills", []):
                    sid = skill.get("id", "")
                    if sid:
                        desc_lookup[sid] = skill.get("description", sid)
                    for subskill in skill.get("subskills", []):
                        ssid = subskill.get("id", "")
                        if ssid:
                            desc_lookup[ssid] = subskill.get("description", ssid)

            total_subskills = self._count_subskills(curriculum_data)
            closed, in_review, learning_count, _, _ = self._count_by_gate_status(
                all_lifecycles, subj, self._collect_subskill_ids(curriculum_data)
            )
            not_started = max(0, total_subskills - closed - in_review - learning_count)

            progress_overview[subj] = SubjectProgressSummary(
                total=total_subskills,
                mastered=closed,
                in_progress=in_review + learning_count,
                not_started=not_started,
            )

        # ── 3. Layers 1 & 2: Graph-based crafting view ──────────────
        crafting_candidates: List[CraftingNowItem] = []
        almost_ready_candidates: List[AlmostReadyItem] = []

        if self.learning_paths:
            for subj in subject_names:
                try:
                    student_graph = await self.learning_paths.get_student_graph(
                        student_id, subj
                    )
                except Exception as e:
                    logger.debug(f"No graph for {subj}: {e}")
                    continue

                nodes = student_graph.get("nodes", [])
                edges = student_graph.get("edges", [])

                # Build lookups
                node_map: Dict[str, Dict[str, Any]] = {
                    n["id"]: n for n in nodes
                }
                # prereqs_by_target: target_id → [(source_id, threshold)]
                prereqs_by_target: Dict[str, List[tuple]] = {}
                for edge in edges:
                    target = edge.get("target", "")
                    source = edge.get("source", "")
                    threshold = edge.get("threshold", 0.8)
                    prereqs_by_target.setdefault(target, []).append(
                        (source, threshold)
                    )

                # ── Layer 1: "Crafting Now" ──────────────────────────
                # Find LOCKED nodes whose prerequisites include at least
                # one IN_PROGRESS or MASTERED node. These are the "recipes"
                # the student is actively working toward.
                for node in nodes:
                    if node.get("status") != "LOCKED":
                        continue

                    skill_id = node["id"]
                    prereq_edges = prereqs_by_target.get(skill_id, [])
                    if not prereq_edges:
                        continue

                    prereq_statuses: List[PrerequisiteStatus] = []
                    met_count = 0
                    active_prereq_count = 0  # prereqs that are IN_PROGRESS or MASTERED

                    for source_id, threshold in prereq_edges:
                        source_node = node_map.get(source_id, {})
                        source_prof = source_node.get("student_proficiency", 0.0)
                        source_status = source_node.get("status", "LOCKED")
                        is_met = source_prof >= threshold or source_status == "MASTERED"

                        if source_status in ("IN_PROGRESS", "MASTERED"):
                            active_prereq_count += 1

                        # Enrich with mastery state from lifecycle
                        lc = lifecycle_map.get(source_id, {})
                        current_gate = lc.get("current_gate", 0)
                        completion_pct = lc.get("completion_pct", 0.0)
                        rs = PlanningService._derive_retention_state(lc) if lc else "not_started"

                        # For in-progress prereqs with no lifecycle completion_pct,
                        # derive progress from stability or proficiency
                        if completion_pct == 0.0 and source_status == "IN_PROGRESS":
                            stability = lc.get("stability", 0.0) if lc else 0.0
                            if rs == "active" and stability > 0:
                                completion_pct = min(stability / 30.0, 0.99)
                            elif source_prof > 0 and threshold > 0:
                                completion_pct = min(source_prof / threshold, 0.99)

                        prereq_statuses.append(PrerequisiteStatus(
                            subskill_id=source_id,
                            name=desc_lookup.get(source_id, source_node.get("description", source_id)),
                            current_gate=current_gate,
                            target_gate=4,
                            completion_pct=round(completion_pct, 2),
                            met=is_met,
                        ))
                        if is_met:
                            met_count += 1

                    # Include if at least one prereq is being worked on
                    if active_prereq_count > 0:
                        readiness = met_count / len(prereq_edges)
                        crafting_candidates.append(CraftingNowItem(
                            skill_id=skill_id,
                            skill_name=desc_lookup.get(skill_id, node.get("description", skill_id)),
                            subject=subj,
                            prerequisites=prereq_statuses,
                            overall_readiness=round(readiness, 2),
                        ))

                # ── Layer 2: "Almost Ready" (ready to start) ─────────
                # UNLOCKED nodes the student hasn't begun yet.
                # These are "recipes you have all materials for."
                for node in nodes:
                    status = node.get("status", "LOCKED")
                    if status != "UNLOCKED":
                        continue

                    node_id = node["id"]
                    lc = lifecycle_map.get(node_id, {})
                    rs = PlanningService._derive_retention_state(lc) if lc else "not_started"
                    eval_count = lc.get("lesson_eval_count", 0)

                    # Skip if already started (has evals or past not_started)
                    if rs != "not_started" or eval_count > 0:
                        continue

                    almost_ready_candidates.append(AlmostReadyItem(
                        skill_id=node_id,
                        skill_name=desc_lookup.get(node_id, node.get("description", node_id)),
                        subject=subj,
                        blockers=[],  # No blockers — fully unlocked
                        readiness=1.0,
                    ))

        # Sort crafting candidates: most active prereqs first, then readiness
        crafting_candidates.sort(
            key=lambda c: (
                # Count prereqs that are in-progress (not met but being worked on)
                sum(1 for p in c.prerequisites if not p.met and p.completion_pct > 0),
                c.overall_readiness,
            ),
            reverse=True,
        )
        crafting_now = crafting_candidates[:3]

        # Limit almost-ready to 5
        almost_ready = almost_ready_candidates[:5]

        return SkillProgressResponse(
            student_id=str(student_id),
            crafting_now=crafting_now,
            almost_ready=almost_ready,
            progress_overview=progress_overview,
            generated_at=now,
        )
