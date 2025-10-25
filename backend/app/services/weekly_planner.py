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

    def __init__(
        self,
        project_id: str,
        dataset_id: str = "analytics",
        cosmos_db_service=None,
        learning_paths_service=None
    ):
        self.project_id = project_id
        self.dataset_id = dataset_id
        self.cosmos_db_service = cosmos_db_service
        self.learning_paths_service = learning_paths_service
        self.bigquery_client = bigquery.Client(project=project_id)

        # Initialize Gemini client
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is required for weekly planner")

        self.gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)

        logger.info("📅 WeeklyPlannerService initialized")
        if learning_paths_service:
            logger.info("📅 WeeklyPlannerService: LearningPathsService integration enabled (PRD: WP-LP-INT-001)")

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

            # Step 1.5 (FR1): Fetch recent assessment feedback (last 7 days)
            logger.info(f"📄 WEEKLY_PLANNER: Fetching recent assessment feedback...")
            assessment_feedback = await self._get_recent_assessment_feedback(student_id, days_back=7)
            if assessment_feedback:
                logger.info(f"✅ WEEKLY_PLANNER: Found assessment feedback for {len(assessment_feedback)} subjects")
            else:
                logger.info(f"📄 WEEKLY_PLANNER: No recent assessment feedback found")

            # Step 2: Generate weekly plan using LLM (with assessment feedback)
            logger.info(f"🤖 WEEKLY_PLANNER: Calling LLM for weekly plan generation...")
            weekly_plan_data = await self._call_llm_for_weekly_planning(
                student_id,
                week_start_date,
                analytics_snapshot,
                target_activities,
                assessment_feedback=assessment_feedback
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

        PRD WP-LP-INT-001 (FR2): Now uses LearningPathsService for dynamic prerequisite-based unlocking

        Process:
        1. Query student_velocity_metrics for subjects and velocity data
        2. For each subject, call learning_paths_service.get_unlocked_entities()
        3. Enrich unlocked subskill IDs with curriculum metadata via BigQuery
        4. Combine into analytics_snapshot structure for LLM
        """
        logger.info(f"📊 WEEKLY_PLANNER: Fetching analytics snapshot for student {student_id}")

        try:
            # Step 1: Fetch velocity metrics for all subjects
            velocity_query = f"""
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
            ORDER BY recommendation_priority
            """

            velocity_results = await self._run_query_async(velocity_query, [
                bigquery.ScalarQueryParameter("student_id", "INT64", student_id)
            ])

            if not velocity_results:
                logger.warning(f"❌ WEEKLY_PLANNER: No velocity data found for student {student_id}")
                return None

            logger.info(f"📊 WEEKLY_PLANNER: Found velocity data for {len(velocity_results)} subjects")

            # Step 2: Get unlocked subskills for each subject using LearningPathsService
            if not self.learning_paths_service:
                logger.error(f"❌ WEEKLY_PLANNER: LearningPathsService not initialized (PRD NFR: fail fast)")
                raise ValueError("LearningPathsService is required for weekly plan generation")

            # Fetch unlocked entities in parallel for all subjects
            unlock_tasks = [
                self.learning_paths_service.get_unlocked_entities(
                    student_id=student_id,
                    entity_type='subskill',
                    subject=subject_data['subject']
                )
                for subject_data in velocity_results
            ]

            unlocked_by_subject = await asyncio.gather(*unlock_tasks, return_exceptions=True)

            # Check for failures in parallel tasks
            for idx, result in enumerate(unlocked_by_subject):
                if isinstance(result, Exception):
                    subject = velocity_results[idx]['subject']
                    logger.error(f"❌ WEEKLY_PLANNER: Failed to get unlocked entities for {subject}: {result}")
                    raise result

            logger.info(f"✅ WEEKLY_PLANNER: Retrieved unlocked entities for all subjects")

            # Step 3: Enrich unlocked subskills with curriculum metadata
            enriched_subjects = []

            for subject_data, unlocked_subskill_ids in zip(velocity_results, unlocked_by_subject):
                subject = subject_data['subject']

                if not unlocked_subskill_ids:
                    logger.warning(f"⚠️ WEEKLY_PLANNER: No unlocked subskills for {subject} (PRD Open Question: assigning no activities)")
                    subject_data['available_subskills'] = []
                    enriched_subjects.append(subject_data)
                    continue

                logger.info(f"📊 WEEKLY_PLANNER: {subject} has {len(unlocked_subskill_ids)} unlocked subskills")

                # Query curriculum metadata for unlocked subskills
                enrichment_query = f"""
                SELECT
                    subject,
                    subskill_id,
                    subskill_description,
                    skill_description,
                    skill_id,
                    unit_id,
                    unit_title,
                    difficulty_start,
                    target_difficulty,
                    grade,
                    subskill_order
                FROM `{self.project_id}.{self.dataset_id}.curriculum`
                WHERE subskill_id IN UNNEST(@unlocked_subskill_ids)
                    AND subject = @subject
                ORDER BY unit_order, skill_order, subskill_order
                LIMIT 10
                """

                enrichment_results = await self._run_query_async(enrichment_query, [
                    bigquery.ArrayQueryParameter("unlocked_subskill_ids", "STRING", list(unlocked_subskill_ids)),
                    bigquery.ScalarQueryParameter("subject", "STRING", subject)
                ])

                # Build available_subskills array for this subject
                available_subskills = [
                    {
                        "subskill_id": row["subskill_id"],
                        "subskill_description": row["subskill_description"],
                        "skill_description": row["skill_description"],
                        "skill_id": row["skill_id"],
                        "unit_id": row["unit_id"],
                        "unit_title": row["unit_title"],
                        "difficulty_start": row.get("difficulty_start"),
                        "target_difficulty": row.get("target_difficulty"),
                        "grade": row.get("grade"),
                        "subskill_mastery_pct": 0  # Not used by LLM, placeholder for compatibility
                    }
                    for row in enrichment_results
                ]

                subject_data['available_subskills'] = available_subskills
                enriched_subjects.append(subject_data)

                logger.info(f"✅ WEEKLY_PLANNER: Enriched {len(available_subskills)} subskills for {subject}")

            # Step 4: Return analytics snapshot
            snapshot = {
                "student_id": student_id,
                "snapshot_date": datetime.utcnow().isoformat(),
                "subjects": enriched_subjects
            }

            total_available = sum(len(s.get('available_subskills', [])) for s in enriched_subjects)
            logger.info(f"✅ WEEKLY_PLANNER: Analytics snapshot complete - {len(enriched_subjects)} subjects, {total_available} available subskills")

            return snapshot

        except Exception as e:
            logger.error(f"❌ WEEKLY_PLANNER: Error fetching analytics snapshot: {e}")
            import traceback
            logger.error(f"❌ WEEKLY_PLANNER: Stack trace: {traceback.format_exc()}")
            raise

    async def _get_recent_assessment_feedback(
        self,
        student_id: int,
        days_back: int = 7
    ) -> Optional[Dict[str, Any]]:
        """
        Get recent assessment feedback to inform weekly planning (FR1)
        Returns a dict mapping subject -> list of priority subskills from assessments
        """
        if not self.cosmos_db_service:
            logger.warning(f"📄 WEEKLY_PLANNER: No Cosmos DB service, skipping assessment feedback")
            return None

        try:
            # Get recent completed assessments
            assessments = await self.cosmos_db_service.get_recent_completed_assessments(
                student_id=student_id,
                days_back=days_back
            )

            if not assessments:
                return None

            logger.info(f"📄 WEEKLY_PLANNER: Processing {len(assessments)} recent assessments")

            # Extract priority skills by subject
            feedback_by_subject = {}

            for assessment in assessments:
                subject = assessment.get('subject')
                if not subject:
                    continue

                # Extract AI insights
                results = assessment.get('results', {})
                ai_insights = results.get('ai_insights', {})
                skill_insights = ai_insights.get('skill_insights', [])

                # Find "Needs Review" and "Developing" skills
                priority_subskills = []
                for insight in skill_insights:
                    performance = str(insight.get('performance_label', '')).upper()

                    if 'NEEDS_REVIEW' in performance or 'NEEDS REVIEW' in performance or 'DEVELOPING' in performance:
                        # Extract subskill from next_step link
                        next_step = insight.get('next_step', {})
                        link = next_step.get('link', '')

                        if '/practice/' in link:
                            subskill_id = link.split('/practice/')[1].split('?')[0]
                            priority_subskills.append({
                                'subskill_id': subskill_id,
                                'skill_id': insight.get('skill_id'),
                                'performance': performance,
                                'reason': next_step.get('text', ''),
                                'assessment_id': assessment.get('assessment_id')
                            })

                # Store the most recent per subject
                if priority_subskills and subject not in feedback_by_subject:
                    feedback_by_subject[subject] = {
                        'assessment_id': assessment.get('assessment_id'),
                        'completed_at': assessment.get('completed_at'),
                        'priority_subskills': priority_subskills[:3]  # Max 3 per subject
                    }

            logger.info(f"📄 WEEKLY_PLANNER: Extracted feedback for {len(feedback_by_subject)} subjects")
            for subject, data in feedback_by_subject.items():
                logger.info(f"📄 WEEKLY_PLANNER: {subject}: {len(data['priority_subskills'])} priority skills")

            return feedback_by_subject if feedback_by_subject else None

        except Exception as e:
            logger.error(f"❌ WEEKLY_PLANNER: Error getting assessment feedback: {e}")
            import traceback
            logger.error(f"❌ WEEKLY_PLANNER: {traceback.format_exc()}")
            return None

    async def _call_llm_for_weekly_planning(
        self,
        student_id: int,
        week_start_date: str,
        analytics_snapshot: Dict[str, Any],
        target_activities: int,
        assessment_feedback: Optional[Dict[str, Any]] = None
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
                                "skill_id": {"type": "string"},
                                "unit_id": {"type": "string"},
                                "unit_title": {"type": "string"},
                                "activity_type": {"type": "string"},
                                "planned_day": {"type": "integer"},
                                "priority": {"type": "string"},
                                "llm_reasoning": {"type": "string"},
                                "estimated_time_minutes": {"type": "integer"},
                                "difficulty_start": {"type": "integer"},
                                "target_difficulty": {"type": "integer"},
                                "grade": {"type": "string"}
                            },
                            "required": [
                                "activity_uid", "subskill_id", "subskill_description",
                                "subject", "skill_description", "skill_id", "unit_id",
                                "unit_title", "activity_type", "planned_day",
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

            # Build comprehensive prompt (with assessment feedback if available)
            prompt = self._build_weekly_planning_prompt(
                week_start_date,
                subject_allocations,
                subjects,
                target_activities,
                assessment_feedback=assessment_feedback
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
                    max_output_tokens=15000  # Larger for weekly planning
                )
            )

            if not response or not response.text:
                raise Exception("Empty response from Gemini")

            logger.info(f"🤖 LLM_WEEKLY: Received response: {len(response.text)} chars")

            # Parse and validate response
            weekly_plan_data = json.loads(response.text)

            # Add unique activity UIDs if not provided and mark assessment-driven activities
            for activity in weekly_plan_data['planned_activities']:
                if not activity.get('activity_uid'):
                    activity['activity_uid'] = str(uuid.uuid4())

                # Set default status
                activity['status'] = ActivityStatus.PENDING.value

                # Mark assessment-driven activities (FR1)
                if assessment_feedback:
                    subskill_id = activity.get('subskill_id')
                    llm_reasoning = activity.get('llm_reasoning', '').lower()

                    # Check if this activity matches any assessment feedback
                    for subject, feedback in assessment_feedback.items():
                        for priority_skill in feedback['priority_subskills']:
                            if priority_skill['subskill_id'] == subskill_id or 'assessment' in llm_reasoning:
                                activity['source_assessment_id'] = feedback['assessment_id']
                                logger.info(f"📄 WEEKLY_PLANNER: Marked {subskill_id} as assessment-driven from {feedback['assessment_id']}")
                                break

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
        target_activities: int,
        assessment_feedback: Optional[Dict[str, Any]] = None
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

        # Build available subskills summary (PRD FR3: removed unlock_score and readiness_status)
        available_subskills_by_subject = {
            a["subject"]: [
                {
                    "subskill_id": s["subskill_id"],
                    "subskill_description": s["subskill_description"],
                    "skill_description": s["skill_description"],
                    "skill_id": s.get("skill_id"),
                    "unit_id": s.get("unit_id"),
                    "unit_title": s.get("unit_title"),
                    "difficulty_start": s.get("difficulty_start"),
                    "target_difficulty": s.get("target_difficulty"),
                    "grade": s.get("grade")
                }
                for s in a["available_subskills"][:6]
            ]
            for a in subject_allocations
        }

        # Build assessment feedback section if available (FR1)
        assessment_section = ""
        if assessment_feedback:
            assessment_details = []
            for subject, feedback in assessment_feedback.items():
                skills_list = []
                for skill in feedback['priority_subskills']:
                    skills_list.append(f"  - {skill['subskill_id']}: {skill['reason']} (Performance: {skill['performance']})")
                assessment_details.append(f"**{subject}:**\n" + "\n".join(skills_list))

            assessment_section = f"""

---

**🎯 CRITICAL ASSESSMENT FEEDBACK (PRIORITY):**
Recent assessments identified skills that need immediate attention. These MUST be prioritized early in the week (Monday/Tuesday) with HIGH priority:

{chr(10).join(assessment_details)}

**ASSESSMENT-DRIVEN ACTIVITY REQUIREMENTS:**
- Include activities for these skills on Monday or Tuesday (days 0-1)
- Mark all assessment-driven activities with "high" priority
- In the llm_reasoning, reference the assessment feedback (e.g., "Assessment identified this as 'Needs Review'")

---
"""

        prompt = f"""You are an expert K-5 curriculum planner creating a comprehensive weekly learning plan for a student.

**YOUR MISSION:** Create a balanced, engaging 5-day learning roadmap ({week_dates[0][1]} to {week_dates[4][1]}) with {target_activities} activities distributed across the week.

**CRITICAL INSTRUCTIONS:**
1. **Distribute activities across 5 days (Monday-Friday, days 0-4).**
2. **Respect subject allocations based on student velocity:** subjects with lower velocity (behind pace) get MORE activities.
3. **Balance each day:** Aim for 4-5 activities per day with variety in subjects and activity types.
4. **Activity progression:** Start with easier/review activities early in the week, build to more challenging topics by Friday.
5. **Use ONLY subskills from the available options provided below.**

**IMPORTANT - PREREQUISITE-BASED CURRICULUM (PRD WP-LP-INT-001):**
The available subskills listed below have been dynamically unlocked for this student based on their proven mastery of all prerequisite skills. Each subskill is definitively ready for the student - they have met all proficiency thresholds for its dependencies. You can confidently assign any of these subskills knowing the student has the foundational knowledge required.

{assessment_section}
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
   - **subskill_description:** Copy EXACTLY from available options
   - **subject:** Subject name
   - **skill_description:** Copy EXACTLY from available options
   - **skill_id:** Copy EXACTLY from available options (REQUIRED)
   - **unit_id:** Copy EXACTLY from available options (REQUIRED)
   - **unit_title:** Copy EXACTLY from available options (REQUIRED - do NOT leave null)
   - **activity_type:** practice, packages, or review
   - **planned_day:** 0-4 (Monday-Friday)
   - **priority:** high, medium, or low
   - **llm_reasoning:** Brief (1-2 sentences) explanation of why this activity is included and when
   - **estimated_time_minutes:** 10-15 minutes per activity
   - **difficulty_start:** Copy from available options if present
   - **target_difficulty:** Copy from available options if present
   - **grade:** Copy from available options if present

**CRITICAL:** For each activity, you MUST copy the skill_id, unit_id, and unit_title EXACTLY from the available subskills data. Do NOT leave these fields null or empty.

**EXAMPLE ACTIVITY:**
{{
  "activity_uid": "ACT-Mathematics-0-1",
  "subskill_id": "MATH001-01-A",
  "subskill_description": "Count and identify numbers 0-10",
  "subject": "Mathematics",
  "skill_description": "Number Recognition and Counting",
  "skill_id": "MATH001-01",
  "unit_id": "MATH001",
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
