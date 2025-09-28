# backend/app/services/daily_activities.py
# Enhanced version with curriculum metadata

import logging
import re
from datetime import datetime
from typing import Dict, List, Optional, Any
from pydantic import BaseModel

logger = logging.getLogger(__name__)

class CurriculumMetadata(BaseModel):
    subject: str
    unit: Dict[str, str]  # {id, title, description}
    skill: Dict[str, str]  # {id, description}
    subskill: Dict[str, str]  # {id, description}

class DailyActivity(BaseModel):
    id: str
    type: str  # 'practice', 'tutoring', 'pathway', 'visual', 'review'
    title: str
    description: str
    category: str
    estimated_time: str
    points: int
    priority: str  # 'high', 'medium', 'low'
    time_slot: str  # 'morning', 'midday', 'afternoon', 'evening'
    action: str
    endpoint: str
    icon_type: str
    metadata: Dict[str, Any] = {}
    curriculum_metadata: Optional[CurriculumMetadata] = None

class DailyProgress(BaseModel):
    completed_activities: int
    total_activities: int
    points_earned_today: int
    daily_goal: int
    current_streak: int
    progress_percentage: float

class DailyPlan(BaseModel):
    student_id: int
    date: str
    activities: List[DailyActivity]
    progress: DailyProgress
    personalization_source: str  # 'ai_recommendations', 'bigquery_recommendations' or 'fallback'
    total_points: int
    session_plan: Optional[Dict[str, Any]] = None  # AI session plan information

class CurriculumParser:
    """Parse activity IDs and create curriculum metadata"""
    
    # Subject mappings
    SUBJECT_MAPPING = {
        'COUNT': 'Mathematics',
        'SS': 'Social Studies', 
        'SCI': 'Science',
        'ART': 'Arts',
        'LA': 'Language Arts',
        'MATH': 'Mathematics',
        'ELA': 'English Language Arts'
    }
    
    # Unit descriptions
    UNIT_DESCRIPTIONS = {
        'COUNT001': 'Counting and Cardinality',
        'SS001': 'Classroom Routines and Social Skills',
        'SCI001': 'Scientific Observation and Classification',
        'ART001': 'Art Materials and Creative Expression',
        'LA001': 'Print Concepts and Book Handling',
        'MATH001': 'Number Sense Foundations',
        'ELA001': 'Phonological Awareness'
    }
    
    # Skill descriptions by unit and skill number
    SKILL_DESCRIPTIONS = {
        ('COUNT001', '01'): 'Number Recognition and Counting 0-10',
        ('COUNT001', '02'): 'Number Writing and Formation',
        ('SS001', '01'): 'Basic Classroom Procedures and Independence',
        ('SS001', '02'): 'Social Interaction and Communication',
        ('SCI001', '01'): 'Observation and Description Skills',
        ('SCI001', '02'): 'Classification and Sorting',
        ('ART001', '01'): 'Material Exploration and Tool Use',
        ('ART001', '02'): 'Creative Expression Techniques',
        ('LA001', '01'): 'Print Awareness and Book Orientation',
        ('LA001', '02'): 'Letter Recognition and Sound Awareness'
    }
    
    @classmethod
    def parse_activity_id(cls, activity_id: str) -> Optional[Dict]:
        """
        Parse activity ID to extract curriculum metadata
        Expected formats:
        - rec-COUNT001-01-A
        - rec-[SUBJECT][UNIT]-[SKILL]-[SUBSKILL]
        """
        try:
            # Remove 'rec-' prefix if present
            clean_id = activity_id.replace('rec-', '') if activity_id.startswith('rec-') else activity_id
            
            # Split into parts
            parts = clean_id.split('-')
            if len(parts) < 3:
                logger.warning(f"Activity ID {activity_id} doesn't match expected format")
                return None
            
            subject_unit = parts[0]  # e.g., COUNT001
            skill_num = parts[1]     # e.g., 01
            subskill_code = parts[2] # e.g., A
            
            # Extract subject code and unit number using regex
            match = re.match(r'([A-Z]+)(\d+)', subject_unit)
            if not match:
                logger.warning(f"Cannot parse subject/unit from {subject_unit}")
                return None
            
            subject_code = match.group(1)  # e.g., COUNT
            unit_num = match.group(2)      # e.g., 001
            
            # Get descriptions
            subject_name = cls.SUBJECT_MAPPING.get(subject_code, subject_code)
            unit_description = cls.UNIT_DESCRIPTIONS.get(subject_unit, f"Unit {unit_num}")
            skill_description = cls.SKILL_DESCRIPTIONS.get((subject_unit, skill_num), f"Skill {skill_num}")
            
            return {
                'subject': subject_name,
                'unit': {
                    'id': subject_unit,
                    'title': unit_description,
                    'description': unit_description
                },
                'skill': {
                    'id': skill_num,
                    'description': skill_description
                },
                'subskill': {
                    'id': subskill_code,
                    'description': 'Learning Activity'  # Will be overridden by actual title
                }
            }
            
        except Exception as e:
            logger.warning(f"Failed to parse activity ID {activity_id}: {e}")
            return None
    
    @classmethod
    def enhance_activity_with_curriculum_data(cls, activity_dict: Dict, title: str = None, recommendation_data: Dict = None) -> Dict:
        """Add curriculum metadata to activity dictionary using real curriculum data from AI service if available"""
        
        curriculum_data = None
        
        # First try to use real curriculum data from AI recommendations
        if recommendation_data and recommendation_data.get('from_ai_recommendations'):
            try:
                # Extract real curriculum metadata from AI recommendation
                curriculum_data = {
                    'subject': recommendation_data.get('subject', 'Mathematics'),
                    'unit': {
                        'id': recommendation_data.get('subskill_id', '').split('-')[0] if '-' in recommendation_data.get('subskill_id', '') else '',
                        'title': recommendation_data.get('unit_title') or 'Learning Unit',
                        'description': recommendation_data.get('unit_title') or 'Learning Unit'
                    },
                    'skill': {
                        'id': recommendation_data.get('skill_id', ''),
                        'description': recommendation_data.get('skill_description', 'Learning Skill')
                    },
                    'subskill': {
                        'id': recommendation_data.get('subskill_id', ''),
                        'description': recommendation_data.get('subskill_description', 'Learning Activity')
                    },
                    'difficulty': {
                        'start': recommendation_data.get('difficulty_start'),
                        'end': recommendation_data.get('difficulty_end'),
                        'target': recommendation_data.get('target_difficulty')
                    },
                    'grade': recommendation_data.get('grade')
                }
                logger.info(f"Using real curriculum data from AI service for {recommendation_data.get('subskill_id')}")
            except Exception as e:
                logger.warning(f"Failed to extract real curriculum data, falling back to parser: {e}")
                curriculum_data = None
        
        # Fall back to parsing activity ID if no real data available
        if not curriculum_data:
            curriculum_data = cls.parse_activity_id(activity_dict.get('id', ''))
        
        if curriculum_data:
            # Clean up the title for subskill description
            clean_title = title or activity_dict.get('title', '')
            if clean_title.startswith('Learn: '):
                clean_title = clean_title[7:]  # Remove "Learn: " prefix
            elif clean_title.startswith('Practice: '):
                clean_title = clean_title[10:]  # Remove "Practice: " prefix
            elif clean_title.startswith('Review: '):
                clean_title = clean_title[8:]  # Remove "Review: " prefix
            
            # Update subskill description with actual learning objective if using parsed data
            if 'subskill' in curriculum_data and not recommendation_data:
                curriculum_data['subskill']['description'] = clean_title
            
            # Add curriculum metadata
            activity_dict['curriculum_metadata'] = curriculum_data
            
            # Also enhance the metadata for backward compatibility
            if 'metadata' not in activity_dict:
                activity_dict['metadata'] = {}
            
            activity_dict['metadata'].update({
                'subject': curriculum_data['subject'],
                'unit_description': curriculum_data['unit']['description'],
                'skill_description': curriculum_data['skill']['description']
            })
            
            # Add difficulty and grade info if available from real data
            if curriculum_data.get('difficulty'):
                activity_dict['metadata']['difficulty_range'] = curriculum_data['difficulty']
            if curriculum_data.get('grade'):
                activity_dict['metadata']['grade'] = curriculum_data['grade']
        
        return activity_dict

class DailyActivitiesService:
    """Enhanced service with curriculum metadata support"""
    
    def __init__(self, analytics_service=None, ai_recommendation_service=None, curriculum_service=None, cosmos_db_service=None):
        self.analytics_service = analytics_service
        self.ai_recommendation_service = ai_recommendation_service
        self.curriculum_service = curriculum_service
        self.cosmos_db_service = cosmos_db_service
    
    async def get_or_generate_daily_plan(self, student_id: int, date: Optional[str] = None, force_refresh: bool = False) -> DailyPlan:
        """
        Main method with persistence:
        1. Try to fetch today's plan from Cosmos DB.
        2. If not found OR force_refresh is true, generate a new one.
        3. Save the new plan to Cosmos DB.
        4. Return the plan.
        """
        if not date:
            date = datetime.now().strftime("%Y-%m-%d")

        logger.info(f"🔄 DAILY PLAN REQUEST - Student: {student_id}, Date: {date}, Force Refresh: {force_refresh}")
        logger.info(f"🔍 COSMOS DB SERVICE AVAILABLE: {self.cosmos_db_service is not None}")

        # Step 1: Retrieval-First Logic (FR6)
        if not force_refresh and self.cosmos_db_service:
            try:
                logger.info(f"🔍 ATTEMPTING COSMOS DB RETRIEVAL - Student: {student_id}, Date: {date}")
                existing_plan_doc = await self.cosmos_db_service.get_daily_plan(student_id, date)
                if existing_plan_doc:
                    logger.info(f"✅ FOUND EXISTING PLAN IN COSMOS DB - Student: {student_id}, Date: {date}")
                    logger.info(f"📋 Existing plan has {len(existing_plan_doc.get('activities', []))} activities")
                    logger.info(f"🎯 Activity IDs in saved plan: {[act.get('id') for act in existing_plan_doc.get('activities', [])]}")
                    converted_plan = self._convert_cosmos_doc_to_daily_plan(existing_plan_doc)
                    logger.info(f"📤 RETURNING SAVED PLAN - {len(converted_plan.activities)} activities, source: {converted_plan.personalization_source}")
                    return converted_plan
                else:
                    logger.info(f"❌ NO EXISTING PLAN FOUND IN COSMOS DB - Will generate new plan")
            except Exception as e:
                logger.warning(f"❌ ERROR RETRIEVING EXISTING PLAN - Will generate new one: {e}")

        # Step 2: Generation Logic (Fallback)
        logger.info(f"🚀 GENERATING NEW DAILY PLAN - Student: {student_id}, Date: {date}")
        generated_plan = await self._generate_fresh_daily_plan(student_id, date)
        logger.info(f"✨ FRESH PLAN GENERATED - {len(generated_plan.activities)} activities, source: {generated_plan.personalization_source}")
        logger.info(f"🚀 RECOMMENDATION_FLOW: Final personalization source: {generated_plan.personalization_source}")
        logger.info(f"🎯 Generated activity IDs: {[act.id for act in generated_plan.activities]}")

        # Step 3: Persistence Logic (FR5 & FR7)
        if self.cosmos_db_service:
            try:
                # If force_refresh, delete the existing plan first
                if force_refresh:
                    logger.info(f"🗑️ FORCE REFRESH - Deleting existing plan first")
                    await self.cosmos_db_service.delete_daily_plan(student_id, date)

                # Save the new plan
                plan_dict = generated_plan.dict()
                logger.info(f"💾 SAVING NEW PLAN TO COSMOS DB - Student: {student_id}, Date: {date}")
                await self.cosmos_db_service.save_daily_plan(student_id, date, plan_dict)
                logger.info(f"✅ SAVED NEW DAILY PLAN TO COSMOS DB - Student: {student_id}, Date: {date}")
            except Exception as e:
                logger.error(f"❌ FAILED TO SAVE DAILY PLAN TO COSMOS DB: {e}")
                # Continue without persistence - don't fail the entire request

        logger.info(f"📤 RETURNING GENERATED PLAN - Student: {student_id}, Source: {generated_plan.personalization_source}")
        if generated_plan.personalization_source == 'bigquery_recommendations':
            logger.warning(f"⚠️ ATTENTION: Plan used BigQuery fallback instead of AI recommendations")
        elif generated_plan.personalization_source == 'fallback':
            logger.error(f"🚨 CRITICAL: Plan used static fallback - both AI and BigQuery failed")
        return generated_plan

    async def _generate_fresh_daily_plan(self, student_id: int, date: str, session_type: str = 'daily') -> DailyPlan:
        """Generate a fresh daily plan using AI recommendations and fallbacks"""

        logger.info(f"Generating fresh daily plan for student {student_id}, session_type={session_type}")

        session_plan = None

        # Step 1: Try to get AI recommendations first, then fall back to basic recommendations
        logger.info(f"🚀 RECOMMENDATION_FLOW: Starting recommendation flow for student {student_id}")
        ai_result = await self._get_ai_recommendations_with_session_plan(student_id, session_type)

        if ai_result and ai_result.get('recommendations'):
            logger.info(f"🚀 RECOMMENDATION_FLOW: SUCCESS - Using AI recommendations")
            activities = await self._create_activities_from_recommendations(ai_result['recommendations'], student_id)
            personalization_source = 'ai_recommendations'
            session_plan = ai_result.get('session_plan')
            logger.info(f"🚀 RECOMMENDATION_FLOW: Created {len(activities)} activities from AI recommendations")
        else:
            # Step 2: Fall back to basic BigQuery recommendations
            logger.warning(f"🚀 RECOMMENDATION_FLOW: FALLBACK - AI recommendations failed, trying BigQuery")
            logger.warning(f"🚀 RECOMMENDATION_FLOW: AI result: {ai_result}")
            recommendations = await self._get_recommendations(student_id)

            if recommendations:
                logger.info(f"🚀 RECOMMENDATION_FLOW: Using BigQuery recommendations")
                activities = await self._create_activities_from_recommendations(recommendations, student_id)
                personalization_source = 'bigquery_recommendations'
                logger.info(f"🚀 RECOMMENDATION_FLOW: Created {len(activities)} activities from basic BigQuery recommendations")
            else:
                # Step 3: Final fallback to static activities
                logger.error(f"🚀 RECOMMENDATION_FLOW: FINAL FALLBACK - Both AI and BigQuery failed, using static activities")
                activities = self._create_fallback_activities()
                personalization_source = 'fallback'
                logger.info(f"🚀 RECOMMENDATION_FLOW: Created {len(activities)} fallback activities")

        # Step 4: Calculate totals and progress
        total_points = sum(a.points for a in activities)
        progress = DailyProgress(
            completed_activities=0,
            total_activities=len(activities),
            points_earned_today=0,
            daily_goal=60,
            current_streak=1,  # Would get from user profile
            progress_percentage=0.0
        )

        return DailyPlan(
            student_id=student_id,
            date=date,
            activities=activities,
            progress=progress,
            personalization_source=personalization_source,
            total_points=total_points,
            session_plan=session_plan
        )

    def _convert_cosmos_doc_to_daily_plan(self, cosmos_doc: Dict) -> DailyPlan:
        """Convert a Cosmos DB document back to a DailyPlan object"""

        logger.info(f"🔄 CONVERTING COSMOS DOC TO DAILY PLAN")
        logger.info(f"📋 Cosmos doc has {len(cosmos_doc.get('activities', []))} activities")

        # Convert activities back to DailyActivity objects
        activities = []
        for activity_dict in cosmos_doc.get("activities", []):
            # Ensure curriculum_metadata is properly structured if it exists
            if activity_dict.get("curriculum_metadata"):
                curr_meta = activity_dict["curriculum_metadata"]
                activity_dict["curriculum_metadata"] = CurriculumMetadata(**curr_meta)

            activity = DailyActivity(**activity_dict)
            activities.append(activity)

        # Get progress from Cosmos or calculate from current completion state
        completed_count = sum(1 for activity in cosmos_doc.get("activities", [])
                            if activity.get("is_complete", False))
        total_count = len(cosmos_doc.get("activities", []))

        progress = DailyProgress(
            completed_activities=completed_count,
            total_activities=total_count,
            points_earned_today=sum(
                activity.get("points", 0)
                for activity in cosmos_doc.get("activities", [])
                if activity.get("is_complete", False)
            ),
            daily_goal=60,
            current_streak=1,
            progress_percentage=(completed_count / total_count * 100) if total_count > 0 else 0.0
        )

        return DailyPlan(
            student_id=cosmos_doc["student_id"],
            date=cosmos_doc["date"],
            activities=activities,
            progress=progress,
            personalization_source=cosmos_doc.get("personalization_source", "unknown"),
            total_points=cosmos_doc.get("total_points", 0),
            session_plan=cosmos_doc.get("session_plan")
        )

    async def mark_activity_completed(self, student_id: int, activity_id: str, date: Optional[str] = None) -> bool:
        """Mark an activity as completed in the persistent daily plan"""

        if not date:
            date = datetime.now().strftime("%Y-%m-%d")

        if not self.cosmos_db_service:
            logger.warning("No Cosmos DB service available for activity completion")
            return False

        try:
            success = await self.cosmos_db_service.update_activity_completion(
                student_id=student_id,
                date=date,
                activity_id=activity_id,
                is_complete=True
            )

            if success:
                logger.info(f"Successfully marked activity {activity_id} as completed for student {student_id}")
            else:
                logger.warning(f"Failed to mark activity {activity_id} as completed for student {student_id}")

            return success

        except Exception as e:
            logger.error(f"Error marking activity completion: {e}")
            return False

    # Keep the old method for backward compatibility
    async def generate_daily_plan(self, student_id: int, date: Optional[str] = None, session_type: str = 'daily') -> DailyPlan:
        """Backward compatibility method - delegates to get_or_generate_daily_plan"""
        return await self.get_or_generate_daily_plan(student_id, date, force_refresh=False)
    
    async def _get_recent_assessment_feedback_by_subject(self, student_id: int) -> Dict[str, Dict[str, Any]]:
        """
        Get recent assessment feedback organized by subject for daily plan synthesis.
        Returns a dictionary mapping subject -> feedback document.
        """
        logger.info(f"📄 ASSESSMENT_FEEDBACK: Retrieving recent feedback for student {student_id}")

        if not self.cosmos_db_service:
            logger.warning(f"📄 ASSESSMENT_FEEDBACK: No Cosmos DB service configured, skipping feedback retrieval")
            return {}

        try:
            logger.info(f"📄 ASSESSMENT_FEEDBACK: Retrieving recent assessment feedback for student {student_id}")

            # Get recent completed assessments directly
            logger.info(f"📄 ASSESSMENT_FEEDBACK: Querying Cosmos DB for recent assessments (30 days back)")
            recent_assessments = await self.cosmos_db_service.get_recent_completed_assessments(
                student_id=student_id,
                days_back=30
            )
            logger.info(f"📄 ASSESSMENT_FEEDBACK: Found {len(recent_assessments)} recent assessments")

            # Extract insights from each assessment and organize by subject
            feedback_by_subject = {}
            for i, assessment in enumerate(recent_assessments):
                subject = assessment.get("subject")
                logger.debug(f"📄 ASSESSMENT_FEEDBACK: Processing assessment {i+1}: subject={subject}")
                if not subject:
                    logger.debug(f"📄 ASSESSMENT_FEEDBACK: Skipping assessment {i+1} - no subject")
                    continue

                # Extract insights from the assessment results
                logger.debug(f"📄 ASSESSMENT_FEEDBACK: Extracting insights from {subject} assessment")
                insights = self._extract_insights_from_assessment(assessment)
                if insights:
                    logger.info(f"📄 ASSESSMENT_FEEDBACK: Found insights for {subject}: {len(insights.get('insights', []))} skills")
                    # Keep only the most recent per subject
                    if subject not in feedback_by_subject:
                        feedback_by_subject[subject] = {
                            "subject": subject,
                            "assessment_id": assessment.get("assessment_id"),
                            "completed_at": assessment.get("completed_at"),
                            "insights": insights,
                            "score_percentage": insights.get("score_percentage", 0)
                        }
                        logger.info(f"📄 FEEDBACK_COMPILATION: Added feedback for {subject}")
                        insights = feedback_by_subject[subject]['insights']
                        rec_subskills = insights.get('recommended_subskills', [])
                        logger.info(f"📄 FEEDBACK_COMPILATION: {subject} has {len(rec_subskills)} recommended subskills:")
                        for rec in rec_subskills:
                            logger.info(f"📄 FEEDBACK_COMPILATION: - {rec['subskill_id']} ({rec['performance_label']})")
                    else:
                        logger.debug(f"📄 ASSESSMENT_FEEDBACK: Skipping {subject} - already have recent feedback")
                else:
                    logger.debug(f"📄 ASSESSMENT_FEEDBACK: No insights extracted from {subject} assessment")

            logger.info(f"📄 ASSESSMENT_FEEDBACK: SUCCESS - Retrieved feedback for {len(feedback_by_subject)} subjects")
            logger.info(f"📄 ASSESSMENT_FEEDBACK: Subjects with feedback: {list(feedback_by_subject.keys())}")
            return feedback_by_subject

        except Exception as e:
            logger.error(f"📄 ASSESSMENT_FEEDBACK: EXCEPTION - Error retrieving feedback for student {student_id}: {e}")
            import traceback
            logger.error(f"📄 ASSESSMENT_FEEDBACK: Stack trace: {traceback.format_exc()}")
            return {}

    def _extract_insights_from_assessment(self, assessment: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Extract insights from an assessment document for daily plan synthesis.
        Returns simplified insights data or None if no useful data found.
        """
        try:
            # Get assessment results
            results = assessment.get("results", {})
            if not results:
                return None

            # Extract AI insights (new structure)
            ai_insights = results.get("ai_insights", {})
            skill_insights = ai_insights.get("skill_insights", [])

            if not skill_insights:
                return None

            # Convert to the format expected by daily plan synthesis
            priority_skills = []
            weak_spot_skills = []
            developing_skills = []
            recommended_subskills = []  # New: specific subskill recommendations from assessment

            for insight in skill_insights:
                skill_id = insight.get("skill_id")
                if not skill_id:
                    continue

                # Extract recommended subskill from next_step, but ONLY for skills that need practice
                performance_label = insight.get("performance_label", "")

                # Only include subskills that need practice (not already mastered)
                if performance_label in ["Developing", "Needs Review"]:
                    next_step = insight.get("next_step", {})
                    if next_step and next_step.get("link"):
                        # Extract subskill ID from the link (e.g., "/practice/SS001-01-J?subject=social-studies" -> "SS001-01-J")
                        link = next_step.get("link", "")
                        if "/practice/" in link:
                            subskill_part = link.split("/practice/")[1].split("?")[0]
                            if subskill_part:
                                logger.info(f"📄 SUBSKILL_EXTRACTION: Extracted subskill {subskill_part} from link {link} (Performance: {performance_label})")
                                recommended_subskills.append({
                                    "skill_id": skill_id,
                                    "subskill_id": subskill_part,
                                    "reason": next_step.get("text", ""),
                                    "assessment_focus_tag": insight.get("assessment_focus_tag", ""),
                                    "performance_label": performance_label
                                })
                            else:
                                logger.warning(f"📄 SUBSKILL_EXTRACTION: Failed to extract subskill from link {link}")
                        else:
                            logger.warning(f"📄 SUBSKILL_EXTRACTION: Link does not contain /practice/ pattern: {link}")
                else:
                    logger.debug(f"📄 SUBSKILL_EXTRACTION: Skipping subskill extraction for {skill_id} - already {performance_label}")

                # Handle both string and enum values for assessment focus and performance
                assessment_focus = str(insight.get("assessment_focus_tag", "")).upper()
                performance = str(insight.get("performance_label", "")).upper()

                # Check for weak spot patterns
                if ("WEAK_SPOT" in assessment_focus or "🎯" in assessment_focus or
                    "NEEDS_REVIEW" in performance or "NEEDS REVIEW" in performance):
                    weak_spot_skills.append(skill_id)
                    priority_skills.append(skill_id)
                elif "DEVELOPING" in performance:
                    developing_skills.append(skill_id)
                    priority_skills.append(skill_id)

            # Extract summary data
            summary = results.get("summary", {})

            # At the end of the method, before return:
            logger.info(f"📄 ASSESSMENT_EXTRACTION: Final recommended_subskills count: {len(recommended_subskills)}")
            for rec in recommended_subskills:
                logger.info(f"📄 ASSESSMENT_EXTRACTION: Recommended: {rec['subskill_id']} ({rec['assessment_focus_tag']}, {rec['performance_label']})")

            return {
                "insights": skill_insights,
                "priority_skills": priority_skills,
                "weak_spot_skills": weak_spot_skills,
                "developing_skills": developing_skills,
                "recommended_subskills": recommended_subskills,  # New: pass specific recommendations
                "score_percentage": summary.get("score_percentage", 0),
                "total_questions": summary.get("total_questions", 0),
                "correct_count": summary.get("correct_count", 0)
            }

        except Exception as e:
            logger.error(f"Error extracting insights from assessment: {e}")
            return None

    async def _get_ai_recommendations_with_session_plan(self, student_id: int, session_type: str = 'daily') -> Optional[Dict]:
        """Get AI-powered recommendations with session plan from AI recommendation service using new playlist method"""

        logger.info(f"🤖 DAILY_ACTIVITIES: Starting AI recommendations flow for student {student_id}")

        if not self.ai_recommendation_service:
            logger.error(f"🤖 DAILY_ACTIVITIES: CRITICAL - No AI recommendation service configured")
            logger.error(f"🤖 DAILY_ACTIVITIES: This will cause immediate fallback to BigQuery recommendations")
            return None

        try:
            logger.info(f"🤖 DAILY_ACTIVITIES: Calling generate_daily_playlist for student {student_id}")

            # Get recent assessment feedback for intelligent synthesis
            logger.info(f"🤖 DAILY_ACTIVITIES: Retrieving recent assessment feedback...")
            assessment_feedback = await self._get_recent_assessment_feedback_by_subject(student_id)
            logger.info(f"🤖 DAILY_ACTIVITIES: Assessment feedback retrieved for {len(assessment_feedback)} subjects")

            # Call AI service with assessment feedback if available
            if assessment_feedback:
                logger.info(f"🤖 DAILY_ACTIVITIES: Including assessment feedback for {len(assessment_feedback)} subjects in AI recommendations")
                logger.info(f"🤖 DAILY_ACTIVITIES: Feedback subjects: {list(assessment_feedback.keys())}")
                playlist = await self.ai_recommendation_service.generate_daily_playlist(
                    student_id=student_id,
                    target_activities=6,  # Standard daily playlist size
                    assessment_feedback_map=assessment_feedback
                )
            else:
                logger.warning(f"🤖 DAILY_ACTIVITIES: No recent assessment feedback found, generating playlist with velocity data only")
                playlist = await self.ai_recommendation_service.generate_daily_playlist(
                    student_id=student_id,
                    target_activities=6
                )

            logger.info(f"🤖 DAILY_ACTIVITIES: AI service returned playlist: {playlist is not None}")
            if playlist:
                logger.info(f"🤖 DAILY_ACTIVITIES: Playlist has activities: {playlist.get('activities') is not None}")
                logger.info(f"🤖 DAILY_ACTIVITIES: Playlist keys: {list(playlist.keys())}")

            if playlist and playlist.get('activities'):
                activities = playlist.get('activities', [])
                logger.info(f"🤖 DAILY_ACTIVITIES: SUCCESS - Got {len(activities)} activities from AI daily playlist")

                # Extract session plan from playlist
                session_plan = playlist.get('session_plan', {})

                # Convert playlist activities to basic recommendation format for compatibility
                converted_recommendations = []
                for activity in activities:
                    basic_rec = {
                        'subskill_id': activity.get('subskill_id', ''),
                        'subskill_description': activity.get('subskill_description', ''),
                        'subject': activity.get('subject', 'Mathematics'),
                        'skill_id': activity.get('subskill_id', ''),  # Use subskill_id as skill_id for compatibility
                        'skill_description': activity.get('skill_description', ''),
                        'priority': 'high' if activity.get('activity_type') == 'core_challenge' else 'medium',
                        'priority_level': activity.get('activity_type', 'practice'),
                        'mastery': 0.0,  # Will be updated with actual competency data
                        'readiness_status': 'Ready',
                        # Add AI-specific metadata
                        'ai_reason': activity.get('reason', ''),
                        'priority_rank': 1,  # All playlist activities are high priority
                        'estimated_time': activity.get('estimated_time', 5),
                        'from_ai_recommendations': True,
                        # Add rich curriculum metadata from AI service
                        'unit_title': activity.get('unit_title', ''),
                        'difficulty_start': activity.get('difficulty_start'),
                        'difficulty_end': activity.get('difficulty_end'),
                        'target_difficulty': activity.get('target_difficulty'),
                        'grade': activity.get('grade'),
                        # Add assessment feedback context if used
                        'assessment_informed': len(assessment_feedback) > 0
                    }
                    converted_recommendations.append(basic_rec)

                logger.info(f"🤖 DAILY_ACTIVITIES: Converted {len(converted_recommendations)} playlist activities to recommendation format")
                result = {
                    'recommendations': converted_recommendations,
                    'session_plan': session_plan,
                    'assessment_feedback_used': len(assessment_feedback) > 0,
                    'subjects_with_feedback': list(assessment_feedback.keys())
                }
                logger.info(f"🤖 DAILY_ACTIVITIES: SUCCESS - Returning AI recommendations")
                return result
            else:
                logger.error(f"🤖 DAILY_ACTIVITIES: CRITICAL - No playlist activities returned from AI service")
                logger.error(f"🤖 DAILY_ACTIVITIES: This will cause fallback to BigQuery recommendations")
                return None

        except Exception as e:
            logger.error(f"🤖 DAILY_ACTIVITIES: EXCEPTION - Failed to get AI recommendations: {str(e)}")
            logger.error(f"🤖 DAILY_ACTIVITIES: This will cause fallback to BigQuery recommendations")
            import traceback
            logger.error(f"🤖 DAILY_ACTIVITIES: Stack trace: {traceback.format_exc()}")
            return None

    async def _get_ai_recommendations(self, student_id: int, session_type: str = 'daily') -> Optional[List[Dict]]:
        """Get AI-powered recommendations from AI recommendation service using new playlist method"""
        
        if not self.ai_recommendation_service:
            logger.info("No AI recommendation service configured, skipping AI recommendations")
            return None
        
        try:
            logger.info(f"Calling generate_daily_playlist for student {student_id} (legacy method)")
            playlist = await self.ai_recommendation_service.generate_daily_playlist(
                student_id=student_id,
                target_activities=6
            )
            
            if playlist and playlist.get('activities'):
                activities = playlist.get('activities', [])
                logger.info(f"Got {len(activities)} activities from daily playlist (legacy)")
                
                # Convert playlist activities to basic recommendation format for compatibility
                converted_recommendations = []
                for activity in activities:
                    basic_rec = {
                        'subskill_id': activity.get('subskill_id', ''),
                        'subskill_description': activity.get('subskill_description', ''),
                        'subject': activity.get('subject', 'Mathematics'),
                        'skill_id': activity.get('subskill_id', ''),  
                        'skill_description': activity.get('skill_description', ''),
                        'priority': 'high' if activity.get('activity_type') == 'core_challenge' else 'medium',
                        'priority_level': activity.get('activity_type', 'practice'),
                        'mastery': 0.5,
                        'readiness_status': 'Ready',
                        # Add AI-specific metadata
                        'ai_reason': activity.get('reason', ''),
                        'priority_rank': 1,
                        'estimated_time': activity.get('estimated_time', 5),
                        'from_ai_recommendations': True
                    }
                    converted_recommendations.append(basic_rec)
                
                return converted_recommendations
            else:
                logger.info("No playlist activities returned (legacy)")
                return None
                
        except Exception as e:
            logger.error(f"Failed to get AI recommendations (legacy): {str(e)}")
            return None

    async def _get_recommendations(self, student_id: int) -> Optional[List[Dict]]:
        """Get basic recommendations from BigQuery analytics service"""
        
        if not self.analytics_service:
            logger.warning("No analytics service configured")
            return None
        
        try:
            recommendations = await self.analytics_service.get_recommendations(
                student_id=student_id,
                limit=5
            )
            
            if recommendations and len(recommendations) > 0:
                logger.info(f"Got {len(recommendations)} basic recommendations from BigQuery")
                return recommendations
            else:
                logger.info("No recommendations returned from BigQuery")
                return None
                
        except Exception as e:
            logger.error(f"Failed to get basic recommendations: {str(e)}")
            return None
    
    async def _create_activities_from_recommendations(self, recommendations: List[Dict], student_id: int = None) -> List[DailyActivity]:
        """Convert basic BigQuery recommendations into daily activities with curriculum metadata"""

        activities = []

        for i, rec in enumerate(recommendations):
            # Extract data from recommendation
            subskill_desc = rec.get('subskill_description', 'Practice Session')
            subject = rec.get('subject', 'Mathematics')
            priority = rec.get('priority', 'medium')
            skill_id = rec.get('skill_id', '')
            subskill_id = rec.get('subskill_id', f'skill_{i}')

            # Fetch actual competency data if available
            mastery = await self._get_competency_score(student_id, subject, skill_id, subskill_id) if student_id else rec.get('mastery', 0.0)
            
            # Update the recommendation with actual mastery
            rec_with_mastery = rec.copy()
            rec_with_mastery['mastery'] = mastery

            # Determine activity type and get config
            activity_type = self._determine_activity_type(rec_with_mastery)
            config = self._get_activity_config(activity_type, subskill_desc)
            
            # Calculate points and assign time slot
            points = self._calculate_points(priority, mastery)
            time_slot = ['morning', 'midday', 'afternoon', 'evening'][i % 4]
            
            # Create base activity dictionary
            activity_dict = {
                'id': f"rec-{subskill_id}",
                'type': activity_type,
                'title': config['title'],
                'description': config['description'],
                'category': config['category'],
                'estimated_time': config['time'],
                'points': points,
                'priority': priority,
                'time_slot': time_slot,
                'action': config['action'],
                'endpoint': config['endpoint'],
                'icon_type': config['icon'],
                'metadata': {
                    'from_recommendations': True,
                    'recommendation_id': subskill_id,
                    'subject': subject,
                    'skill_id': skill_id,
                    'mastery_level': mastery,
                    'priority_level': rec.get('priority_level'),
                    'readiness_status': rec.get('readiness_status', 'Ready'),
                    # Add AI-specific metadata if available
                    'from_ai_recommendations': rec.get('from_ai_recommendations', False),
                    'ai_reason': rec.get('ai_reason'),
                    'priority_rank': rec.get('priority_rank'),
                    'estimated_time_minutes': rec.get('estimated_time'),
                    'assessment_informed': rec.get('assessment_informed', False)
                }
            }
            
            # Enhance with curriculum metadata - use real data from recommendations if available
            enhanced_dict = CurriculumParser.enhance_activity_with_curriculum_data(
                activity_dict, 
                config['title'],
                recommendation_data=rec
            )
            
            # Create DailyActivity from enhanced dictionary
            activity = DailyActivity(**enhanced_dict)
            activities.append(activity)
        
        return activities
    
    def _create_fallback_activities(self) -> List[DailyActivity]:
        """Create basic activities with curriculum metadata when no recommendations available"""
        
        fallback_configs = [
            {
                'id': 'rec-COUNT001-01-A',
                'title': 'Learn: Count and recognize numbers 0-10, including matching spoken words to written numerals',
                'subject': 'Mathematics'
            },
            {
                'id': 'rec-SS001-01-A', 
                'title': 'Learn: Follow basic 3-step classroom routines independently (entering, storing belongings, starting assigned task)',
                'subject': 'Social Studies'
            },
            {
                'id': 'rec-SCI001-02-A',
                'title': 'Learn: Sort and classify objects by basic observable properties (color, shape, size, texture)',
                'subject': 'Science'
            },
            {
                'id': 'rec-ART001-01-A',
                'title': 'Learn: Explore a variety of art materials and tools',
                'subject': 'Arts'
            },
            {
                'id': 'rec-LA001-01-A',
                'title': 'Learn: Demonstrate proper book handling skills (orientation, covers, page turning)',
                'subject': 'Language Arts'
            }
        ]
        
        activities = []
        time_slots = ['morning', 'midday', 'afternoon', 'evening']
        
        for i, config in enumerate(fallback_configs):
            activity_dict = {
                'id': config['id'],
                'type': 'practice',
                'title': config['title'],
                'description': f"Essential skill building in {config['subject'].lower()}",
                'category': config['subject'],
                'estimated_time': '12 min',
                'points': 23,
                'priority': 'medium',
                'time_slot': time_slots[i % len(time_slots)],
                'action': 'Start Learning',
                'endpoint': '/practice',
                'icon_type': 'zap',
                'metadata': {
                    'fallback': True,
                    'subject': config['subject'],
                    'from_recommendations': True  # These are AI-generated fallbacks
                }
            }
            
            # Enhance with curriculum metadata
            enhanced_dict = CurriculumParser.enhance_activity_with_curriculum_data(
                activity_dict,
                config['title']
            )
            
            activity = DailyActivity(**enhanced_dict)
            activities.append(activity)
        
        return activities

    async def _get_competency_score(self, student_id: int, subject: str, skill_id: str, subskill_id: str) -> float:
        """Fetch actual competency score from BigQuery using credibility-adjusted scoring"""
        if not self.analytics_service:
            logger.warning("No BigQuery analytics service available for competency lookup")
            return 0.0

        try:
            # Use BigQuery analytics service to get competency data
            competency_data = await self.analytics_service.get_student_competency(
                student_id=student_id,
                subject=subject,
                skill_id=skill_id,
                subskill_id=subskill_id
            )

            if not competency_data:
                logger.debug(f"No competency data found for {subskill_id}, defaulting to 0.0")
                return 0.0

            # Get raw score (0-10 scale) and credibility (0-1 scale)
            raw_score = competency_data.get('current_score', 0) / 10.0  # Convert to 0-1 scale

            # Use credibility-adjusted score: blended_score = score * credibility
            # This means low credibility results in very low effective scores
            adjusted_score = raw_score 

            logger.debug(f"Competency for {subskill_id}: raw={raw_score:.2f}, credibility={credibility:.2f}, adjusted={adjusted_score:.2f}")
            return adjusted_score

        except Exception as e:
            logger.warning(f"Error fetching competency from BigQuery for {subskill_id}: {e}")
            return 0.0  # Default to 0 for new/unknown skills

    def _determine_activity_type(self, recommendation: Dict) -> str:
        """Determine best activity type based on credibility-adjusted competency data"""
        mastery = recommendation.get('mastery', 0.0)
        priority = recommendation.get('priority', 'medium')

        # Using credibility-adjusted scores:
        # - Low mastery (< 0.3) = New/struggling skills -> Learning session
        # - Medium mastery (0.3-0.7) = Developing skills -> Practice
        # - High mastery (> 0.7) = Strong skills -> Review

        if mastery < 0.3:
            return 'packages'  # Learn: Interactive learning session
        else:
            return 'practice'  # Practice: Targeted practice
    
    def _get_activity_config(self, activity_type: str, subskill_desc: str) -> Dict[str, str]:
        """Get configuration for activity type"""
        configs = {
            "packages": {
                "title": f"Learn: {subskill_desc}",
                "description": f"Interactive learning session for {subskill_desc.lower()}",
                "category": "Learning Packages",
                "time": "12 min",
                "action": "Start Learning",
                "endpoint": "/packages",
                "icon": "book-open"
            },
            "practice": {
                "title": f"Practice: {subskill_desc}",
                "description": f"Targeted practice for {subskill_desc.lower()}",
                "category": "Practice Problems",
                "time": "12 min",
                "action": "Start Practice",
                "endpoint": "/practice",
                "icon": "zap"
            },
            "tutoring": {
                "title": f"Learn: {subskill_desc}",
                "description": f"Interactive learning session on {subskill_desc.lower()}",
                "category": "AI Tutoring",
                "time": "12 min",
                "action": "Start Session",
                "endpoint": "/tutoring",
                "icon": "headphones"
            },
            "review": {
                "title": f"Review: {subskill_desc}",
                "description": f"Reinforce {subskill_desc.lower()} concepts",
                "category": "Review Session",
                "time": "12 min",
                "action": "Review",
                "endpoint": "/practice",
                "icon": "brain"
            }
        }
        
        return configs.get(activity_type, configs["practice"])
    
    def _calculate_points(self, priority: str, mastery: float) -> int:
        """Calculate points for activity"""
        return 23  # Standard points for now