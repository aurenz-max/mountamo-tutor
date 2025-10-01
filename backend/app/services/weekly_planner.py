# backend/app/services/weekly_planner.py
"""
Weekly Planner Service
Generates proactive week-long learning plans using LLM-based curriculum planning
Replaces daily nightly runs with a single weekly generation for efficiency
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

from google.cloud import bigquery
from google import genai
from google.genai.types import GenerateContentConfig

from ..core.config import settings
from ..models.weekly_plan import (
    WeeklyPlan, PlannedActivity, ActivityStatus,
    ActivityPriority, ActivityType
)

logger = logging.getLogger(__name__)


class WeeklyPlannerService:
    """Service for generating proactive weekly learning plans"""

    def __init__(self, project_id: str, dataset_id: str = "analytics", cosmos_db_service=None):
        self.project_id = project_id
        self.dataset_id = dataset_id
        self.cosmos_db_service = cosmos_db_service
        self.bigquery_client = bigquery.Client(project=project_id)

        # Initialize Gemini client
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is required for weekly planner")

        self.gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)

        logger.info("📅 WeeklyPlannerService initialized")

    async def generate_weekly_plan(
        self,
        student_id: int,
        week_start_date: Optional[str] = None,
        target_activities: int = 20,
        force_regenerate: bool = False
    ) -> WeeklyPlan:
        """
        Generate a complete weekly learning plan for a student

        Args:
            student_id: Student ID
            week_start_date: Week start date (Monday, YYYY-MM-DD). If None, uses next Monday.
            target_activities: Target number of activities (15-30 recommended)
            force_regenerate: Force regeneration even if plan exists

        Returns:
            WeeklyPlan object
        """
        logger.info(f"📅 WEEKLY_PLANNER: Starting generation for student {student_id}")

        # Calculate week_start_date if not provided
        if not week_start_date:
            today = datetime.utcnow()
            # Get next Monday
            days_until_monday = (7 - today.weekday()) if today.weekday() != 0 else 0
            next_monday = today + timedelta(days=days_until_monday)
            week_start_date = next_monday.strftime('%Y-%m-%d')
            logger.info(f"📅 WEEKLY_PLANNER: Using calculated week start: {week_start_date}")

        # Check if plan already exists
        if not force_regenerate and self.cosmos_db_service:
            existing_plan = await self.cosmos_db_service.get_weekly_plan(student_id, week_start_date)
            if existing_plan:
                logger.info(f"📅 WEEKLY_PLANNER: Plan already exists for student {student_id}, week {week_start_date}")
                return WeeklyPlan(**existing_plan)

        try:
            # Step 1: Fetch student analytics snapshot
            logger.info(f"📊 WEEKLY_PLANNER: Fetching analytics snapshot...")
            analytics_snapshot = await self._fetch_student_analytics_snapshot(student_id)

            if not analytics_snapshot or not analytics_snapshot.get('subjects'):
                logger.error(f"❌ WEEKLY_PLANNER: No analytics data for student {student_id}")
                raise ValueError(f"No analytics data available for student {student_id}")

            logger.info(f"✅ WEEKLY_PLANNER: Analytics snapshot retrieved with {len(analytics_snapshot['subjects'])} subjects")

            # Step 2: Generate weekly plan using LLM
            logger.info(f"🤖 WEEKLY_PLANNER: Calling LLM for weekly plan generation...")
            weekly_plan_data = await self._call_llm_for_weekly_planning(
                student_id,
                week_start_date,
                analytics_snapshot,
                target_activities
            )

            logger.info(f"✅ WEEKLY_PLANNER: LLM generated {len(weekly_plan_data['planned_activities'])} activities")

            # Step 3: Create WeeklyPlan object
            weekly_plan = WeeklyPlan(
                student_id=student_id,
                week_start_date=week_start_date,
                plan_id=f"{student_id}_{week_start_date}",
                weekly_theme=weekly_plan_data['weekly_theme'],
                weekly_objectives=weekly_plan_data['weekly_objectives'],
                source_analytics_snapshot=analytics_snapshot,
                planned_activities=[PlannedActivity(**act) for act in weekly_plan_data['planned_activities']],
                generated_at=datetime.utcnow().isoformat(),
                last_updated_at=datetime.utcnow().isoformat(),
                generation_model="gemini-2.5-flash",
                total_activities=len(weekly_plan_data['planned_activities']),
                completed_activities=0,
                assigned_activities=0
            )

            # Step 4: Save to Cosmos DB
            if self.cosmos_db_service:
                logger.info(f"💾 WEEKLY_PLANNER: Saving plan to Cosmos DB...")
                await self._save_weekly_plan_to_cosmos(weekly_plan)
                logger.info(f"✅ WEEKLY_PLANNER: Plan saved successfully")

            logger.info(f"🎉 WEEKLY_PLANNER: Successfully generated weekly plan for student {student_id}")
            return weekly_plan

        except Exception as e:
            logger.error(f"❌ WEEKLY_PLANNER: Error generating weekly plan: {e}")
            import traceback
            logger.error(f"❌ WEEKLY_PLANNER: Stack trace: {traceback.format_exc()}")
            raise

    async def _fetch_student_analytics_snapshot(self, student_id: int) -> Dict[str, Any]:
        """
        Fetch student's velocity metrics and available subskills from BigQuery
        This is the input data for the LLM-based weekly planner
        """
        logger.info(f"📊 Fetching analytics snapshot for student {student_id}")

        try:
            # Query similar to AI recommendations service but optimized for weekly planning
            snapshot_query = f"""
            WITH velocity_data AS (
              SELECT
                subject,
                velocity_status,
                velocity_percentage,
                days_ahead_behind,
                recommendation_priority,
                actual_progress,
                expected_progress,
                total_subskills_in_subject
              FROM `{self.project_id}.{self.dataset_id}.student_velocity_metrics`
              WHERE student_id = @student_id
            ),
            available_skills AS (
              SELECT
                subject,
                subskill_id,
                subskill_description,
                skill_description,
                subskill_mastery_pct,
                unlock_score,
                difficulty_start,
                readiness_status,
                ROW_NUMBER() OVER (PARTITION BY subject ORDER BY unlock_score DESC) as skill_rank
              FROM `{self.project_id}.{self.dataset_id}.student_available_subskills`
              WHERE student_id = @student_id AND is_available = TRUE
            )
            SELECT
              v.subject,
              v.velocity_status,
              v.velocity_percentage,
              v.days_ahead_behind,
              v.recommendation_priority,
              v.actual_progress,
              v.expected_progress,
              v.total_subskills_in_subject,
              ARRAY_AGG(
                STRUCT(
                  a.subskill_id,
                  a.subskill_description,
                  a.skill_description,
                  a.subskill_mastery_pct,
                  a.unlock_score,
                  a.difficulty_start,
                  a.readiness_status
                )
                ORDER BY a.skill_rank
                LIMIT 10  -- Get top 10 available subskills per subject for weekly planning
              ) as available_subskills
            FROM velocity_data v
            LEFT JOIN available_skills a ON v.subject = a.subject AND a.skill_rank <= 10
            GROUP BY v.subject, v.velocity_status, v.velocity_percentage,
                     v.days_ahead_behind, v.recommendation_priority,
                     v.actual_progress, v.expected_progress, v.total_subskills_in_subject
            ORDER BY v.recommendation_priority
            """

            results = await self._run_query_async(snapshot_query, [
                bigquery.ScalarQueryParameter("student_id", "INT64", student_id)
            ])

            if not results:
                return None

            snapshot = {
                "student_id": student_id,
                "snapshot_date": datetime.utcnow().isoformat(),
                "subjects": results
            }

            logger.info(f"✅ Retrieved analytics snapshot for {len(results)} subjects")
            return snapshot

        except Exception as e:
            logger.error(f"❌ Error fetching analytics snapshot: {e}")
            raise

    async def _call_llm_for_weekly_planning(
        self,
        student_id: int,
        week_start_date: str,
        analytics_snapshot: Dict[str, Any],
        target_activities: int
    ) -> Dict[str, Any]:
        """
        Call Gemini LLM to generate structured weekly learning plan
        Uses strict JSON schema output for reliability
        """
        logger.info(f"🤖 LLM_WEEKLY: Generating weekly plan via Gemini")

        try:
            # Define strict JSON schema for weekly plan generation
            weekly_plan_schema = {
                "type": "object",
                "properties": {
                    "weekly_theme": {"type": "string"},
                    "weekly_objectives": {
                        "type": "array",
                        "items": {"type": "string"}
                    },
                    "planned_activities": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "activity_uid": {"type": "string"},
                                "subskill_id": {"type": "string"},
                                "subskill_description": {"type": "string"},
                                "subject": {"type": "string"},
                                "skill_description": {"type": "string"},
                                "activity_type": {"type": "string"},
                                "planned_day": {"type": "integer"},
                                "priority": {"type": "string"},
                                "llm_reasoning": {"type": "string"},
                                "estimated_time_minutes": {"type": "integer"},
                                "difficulty_start": {"type": "integer"}
                            },
                            "required": [
                                "activity_uid", "subskill_id", "subskill_description",
                                "subject", "activity_type", "planned_day",
                                "priority", "llm_reasoning"
                            ]
                        }
                    }
                },
                "required": ["weekly_theme", "weekly_objectives", "planned_activities"]
            }

            # Build context summary for LLM
            subjects = analytics_snapshot.get('subjects', [])

            # Apply PRD velocity-based allocation rules
            subject_allocations = self._calculate_subject_allocations(subjects, target_activities)

            # Build comprehensive prompt
            prompt = self._build_weekly_planning_prompt(
                week_start_date,
                subject_allocations,
                subjects,
                target_activities
            )

            logger.info(f"🤖 LLM_WEEKLY: Calling Gemini with prompt length: {len(prompt)} chars")
            logger.debug(f"🤖 LLM_WEEKLY: Prompt preview: {prompt[:500]}...")

            # Call Gemini with structured output
            response = await self.gemini_client.aio.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=weekly_plan_schema,
                    temperature=0.5,  # Balanced creativity and consistency
                    max_output_tokens=8000  # Larger for weekly planning
                )
            )

            if not response or not response.text:
                raise Exception("Empty response from Gemini")

            logger.info(f"🤖 LLM_WEEKLY: Received response: {len(response.text)} chars")

            # Parse and validate response
            weekly_plan_data = json.loads(response.text)

            # Add unique activity UIDs if not provided
            for activity in weekly_plan_data['planned_activities']:
                if not activity.get('activity_uid'):
                    activity['activity_uid'] = str(uuid.uuid4())

                # Set default status
                activity['status'] = ActivityStatus.PENDING.value

            logger.info(f"✅ LLM_WEEKLY: Successfully generated {len(weekly_plan_data['planned_activities'])} activities")
            logger.info(f"✅ LLM_WEEKLY: Weekly theme: {weekly_plan_data.get('weekly_theme')}")

            return weekly_plan_data

        except Exception as e:
            logger.error(f"❌ LLM_WEEKLY: Error calling Gemini: {e}")
            import traceback
            logger.error(f"❌ LLM_WEEKLY: Stack trace: {traceback.format_exc()}")
            raise

    def _calculate_subject_allocations(
        self,
        subjects: List[Dict[str, Any]],
        target_activities: int
    ) -> List[Dict[str, Any]]:
        """
        Calculate how many activities each subject should get based on PRD velocity rules
        """
        allocations = []
        total_allocated = 0

        for subject_data in subjects:
            velocity_pct = subject_data.get("velocity_percentage", 100)
            subject = subject_data["subject"]

            # PRD allocation rules:
            # - velocity < 70% (Significantly Behind) → 3 activities
            # - velocity < 85% (Behind) → 2 activities
            # - velocity >= 85% (On Track/Ahead) → 1 activity
            if velocity_pct < 70:
                allocation = 3
            elif velocity_pct < 85:
                allocation = 2
            else:
                allocation = 1

            # Adjust based on number of subjects
            if len(subjects) <= 2:
                allocation = min(allocation + 1, 4)
            elif len(subjects) >= 4:
                allocation = max(allocation - 1, 1)

            allocations.append({
                "subject": subject,
                "allocation": allocation,
                "velocity_status": subject_data.get("velocity_status", "Unknown"),
                "velocity_percentage": velocity_pct,
                "available_subskills": subject_data.get("available_subskills", [])
            })
            total_allocated += allocation

        # Proportional adjustment to hit target
        if total_allocated != target_activities:
            adjustment_factor = target_activities / total_allocated
            for allocation in allocations:
                allocation["allocation"] = max(1, round(allocation["allocation"] * adjustment_factor))

        logger.info(f"📊 Calculated subject allocations: {[(a['subject'], a['allocation']) for a in allocations]}")
        return allocations

    def _build_weekly_planning_prompt(
        self,
        week_start_date: str,
        subject_allocations: List[Dict[str, Any]],
        subjects: List[Dict[str, Any]],
        target_activities: int
    ) -> str:
        """Build comprehensive LLM prompt for weekly planning"""

        # Format week dates
        week_start = datetime.strptime(week_start_date, '%Y-%m-%d')
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        week_dates = [
            (days[i], (week_start + timedelta(days=i)).strftime('%Y-%m-%d'))
            for i in range(5)
        ]

        # Build allocation summary
        allocation_summary = [
            {
                "subject": a["subject"],
                "velocity_status": a["velocity_status"],
                "velocity_percentage": a["velocity_percentage"],
                "recommended_activities": a["allocation"]
            }
            for a in subject_allocations
        ]

        # Build available subskills summary
        available_subskills_by_subject = {
            a["subject"]: [
                {
                    "subskill_id": s["subskill_id"],
                    "subskill_description": s["subskill_description"],
                    "skill_description": s["skill_description"],
                    "readiness_status": s["readiness_status"],
                    "mastery_pct": s.get("subskill_mastery_pct", 0),
                    "difficulty_start": s.get("difficulty_start")
                }
                for s in a["available_subskills"][:6]
            ]
            for a in subject_allocations
        }

        prompt = f"""You are an expert K-5 curriculum planner creating a comprehensive weekly learning plan for a student.

**YOUR MISSION:** Create a balanced, engaging 5-day learning roadmap ({week_dates[0][1]} to {week_dates[4][1]}) with {target_activities} activities distributed across the week.

**CRITICAL INSTRUCTIONS:**
1. **Distribute activities across 5 days (Monday-Friday, days 0-4).**
2. **Respect subject allocations based on student velocity:** subjects with lower velocity (behind pace) get MORE activities.
3. **Balance each day:** Aim for 4-5 activities per day with variety in subjects and activity types.
4. **Activity progression:** Start with easier/review activities early in the week, build to more challenging topics by Friday.
5. **Use ONLY subskills from the available options provided below.**

---

**STUDENT VELOCITY & SUBJECT ALLOCATIONS:**
{json.dumps(allocation_summary, indent=2)}

**AVAILABLE SUBSKILLS BY SUBJECT:**
{json.dumps(available_subskills_by_subject, indent=2)}

---

**WEEKLY STRUCTURE GUIDELINES:**
- **Monday (day 0):** Warm-up activities, review from previous week, confidence builders
- **Tuesday (day 1):** Introduction of new concepts in priority subjects
- **Wednesday (day 2):** Practice and reinforcement
- **Thursday (day 3):** Challenge activities, deeper exploration
- **Friday (day 4):** Mixed review, prepare for next week

**ACTIVITY TYPES:**
- "practice": Problem-solving exercises
- "packages": Interactive learning packages
- "review": Reinforcement of previous concepts

**PRIORITY LEVELS:**
- "high": Critical skills, behind-pace subjects
- "medium": Standard practice
- "low": Enrichment and review

---

**OUTPUT REQUIREMENTS:**
1. **weekly_theme:** Creative, engaging theme that ties the week together (e.g., "Exploring Patterns and Numbers")
2. **weekly_objectives:** 3-5 high-level learning goals for the week
3. **planned_activities:** Array of {target_activities} activities with:
   - **activity_uid:** Generate a unique ID (use format: "ACT-<subject>-<day>-<number>")
   - **subskill_id:** MUST match exactly from available options
   - **subskill_description:** Copy from available options
   - **subject:** Subject name
   - **skill_description:** Copy from available options
   - **unit_title:** Copy from available options
   - **activity_type:** practice, packages, or review
   - **planned_day:** 0-4 (Monday-Friday)
   - **priority:** high, medium, or low
   - **llm_reasoning:** Brief (1-2 sentences) explanation of why this activity is included and when
   - **estimated_time_minutes:** 10-15 minutes per activity
   - **difficulty_start, target_difficulty, grade:** Copy from available options if present

**EXAMPLE ACTIVITY:**
{{
  "activity_uid": "ACT-Mathematics-0-1",
  "subskill_id": "MATH001-01-A",
  "subskill_description": "Count and identify numbers 0-10",
  "subject": "Mathematics",
  "skill_description": "Number Recognition and Counting",
  "unit_title": "Number Sense Foundations",
  "activity_type": "practice",
  "planned_day": 0,
  "priority": "high",
  "llm_reasoning": "Starting the week with foundational counting to build confidence. This is a high-priority subject where the student is behind pace.",
  "estimated_time_minutes": 12,
  "difficulty_start": 1,
  "target_difficulty": 3,
  "grade": "K"
}}

Create a comprehensive, balanced weekly plan now."""

        return prompt

    async def _save_weekly_plan_to_cosmos(self, weekly_plan: WeeklyPlan) -> None:
        """Save the generated weekly plan to Cosmos DB"""
        if not self.cosmos_db_service:
            logger.warning("No Cosmos DB service configured, skipping save")
            return

        try:
            plan_dict = weekly_plan.dict()

            # Convert PlannedActivity objects to dicts
            plan_dict['planned_activities'] = [
                act.dict() if hasattr(act, 'dict') else act
                for act in plan_dict['planned_activities']
            ]

            await self.cosmos_db_service.save_weekly_plan(
                student_id=weekly_plan.student_id,
                week_start_date=weekly_plan.week_start_date,
                plan_data=plan_dict
            )

            logger.info(f"✅ Saved weekly plan to Cosmos DB: {weekly_plan.plan_id}")

        except Exception as e:
            logger.error(f"❌ Error saving weekly plan to Cosmos DB: {e}")
            raise

    async def _run_query_async(
        self,
        query: str,
        parameters: List[bigquery.ScalarQueryParameter] = None
    ) -> List[Dict]:
        """Run BigQuery query asynchronously"""

        def _execute_query():
            job_config = bigquery.QueryJobConfig()
            if parameters:
                job_config.query_parameters = parameters

            # Add labels for cost tracking
            job_config.labels = {"service": "weekly_planner", "component": "analytics_snapshot"}

            query_job = self.bigquery_client.query(query, job_config=job_config)
            results = query_job.result()

            logger.debug(f"BigQuery processed {query_job.total_bytes_processed} bytes")

            return [dict(row) for row in results]

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _execute_query)

    async def get_weekly_plan_status(
        self,
        student_id: int,
        week_start_date: str
    ) -> Optional[Dict[str, Any]]:
        """Get status summary of a weekly plan"""
        if not self.cosmos_db_service:
            return None

        try:
            plan_dict = await self.cosmos_db_service.get_weekly_plan(student_id, week_start_date)
            if not plan_dict:
                return None

            weekly_plan = WeeklyPlan(**plan_dict)

            return {
                "student_id": student_id,
                "week_start_date": week_start_date,
                "weekly_theme": weekly_plan.weekly_theme,
                "total_activities": weekly_plan.total_activities,
                "completed_activities": weekly_plan.completed_activities,
                "assigned_activities": weekly_plan.assigned_activities,
                "pending_activities": weekly_plan.total_activities - weekly_plan.completed_activities - weekly_plan.assigned_activities,
                "progress_percentage": weekly_plan.get_progress_percentage(),
                "generated_at": weekly_plan.generated_at,
                "last_updated_at": weekly_plan.last_updated_at
            }

        except Exception as e:
            logger.error(f"Error getting weekly plan status: {e}")
            return None
