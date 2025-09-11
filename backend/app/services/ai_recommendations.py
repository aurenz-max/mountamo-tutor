# services/ai_recommendations.py

import asyncio
import json
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from google.cloud import bigquery
from google import genai
from google.genai.types import GenerateContentConfig
from google.cloud.exceptions import NotFound

from ..core.config import settings

logger = logging.getLogger(__name__)

class AIRecommendationService:
    """Parsimonious AI-powered daily playlist generator following structured pedagogical approach"""
    
    def __init__(self, project_id: str, dataset_id: str = "analytics"):
        self.project_id = project_id
        self.dataset_id = dataset_id
        self.client = bigquery.Client(project=project_id)
        
        # Initialize Gemini using the same pattern as the generators
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is required. Please check your configuration.")
        
        self.gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
        
        logger.info("Parsimonious AI Recommendation Service initialized")
    
    async def generate_daily_playlist(
        self, 
        student_id: int,
        target_activities: int = 6,
        daily_theme: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate a parsimonious daily playlist following PRD pedagogical structure:
        1. Warm-Up (confidence builder)
        2. Core Challenges (new learning from priority subjects)  
        3. Practice & Reinforcement (supporting skills)
        4. Cool-Down (engaging review)
        
        This approach is much more efficient than the previous implementation.
        """
        
        logger.info(f"Generating daily playlist for student {student_id}")
        
        try:
            # Single optimized query to get all needed data
            student_summary = await self._get_student_summary(student_id)
            
            if not student_summary:
                logger.warning(f"No data found for student {student_id}")
                return self._empty_playlist_response()
            
            # Algorithmically allocate activities based on PRD velocity rules
            session_structure = self._create_session_structure(student_summary, target_activities)
            
            # Use LLM efficiently for final activity selection within structure
            playlist = await self._generate_structured_playlist(session_structure, daily_theme)
            
            logger.info(f"Generated playlist with {len(playlist.get('activities', []))} activities")
            return playlist
            
        except Exception as e:
            logger.error(f"Error generating daily playlist for student {student_id}: {e}")
            raise
    
    async def _get_student_summary(self, student_id: int) -> Dict[str, Any]:
        """Get optimized student summary in a single query - much more parsimonious"""
        
        logger.info(f"Getting student summary for {student_id}")
        
        try:
            # Single comprehensive query instead of multiple queries
            summary_query = f"""
            WITH velocity_data AS (
              SELECT 
                subject,
                velocity_status,
                velocity_percentage,
                days_ahead_behind,
                recommendation_priority
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
            ),
            mastery_overview AS (
              SELECT 
                subject,
                AVG(skill_mastery_pct) as avg_mastery,
                COUNT(*) as total_skills
              FROM `{self.project_id}.{self.dataset_id}.v_student_skill_mastery`
              WHERE student_id = @student_id
              GROUP BY subject
            )
            SELECT 
              v.subject,
              v.velocity_status,
              v.velocity_percentage,
              v.days_ahead_behind,
              v.recommendation_priority,
              m.avg_mastery,
              m.total_skills,
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
                LIMIT 4  -- Only get 4 options per subject, not dozens
              ) as available_subskills
            FROM velocity_data v
            LEFT JOIN mastery_overview m ON v.subject = m.subject
            LEFT JOIN available_skills a ON v.subject = a.subject AND a.skill_rank <= 4
            GROUP BY v.subject, v.velocity_status, v.velocity_percentage, 
                     v.days_ahead_behind, v.recommendation_priority, 
                     m.avg_mastery, m.total_skills
            ORDER BY v.recommendation_priority
            """
            
            results = await self._run_query_async(summary_query, [
                bigquery.ScalarQueryParameter("student_id", "INT64", student_id)
            ])
            
            if not results:
                return None
                
            summary = {
                "student_id": student_id,
                "subjects": results
            }
            
            logger.info(f"Retrieved summary for {len(results)} subjects")
            return summary
            
        except Exception as e:
            logger.error(f"Error getting student summary: {e}")
            raise
    
    def _create_session_structure(self, student_summary: Dict[str, Any], target_activities: int) -> Dict[str, Any]:
        """Algorithmically create session structure based on PRD velocity rules - no LLM needed"""
        
        subjects = student_summary["subjects"]
        
        # Apply PRD allocation rules based on velocity status
        subject_allocations = []
        total_allocated = 0
        
        for subject_data in subjects:
            velocity_pct = subject_data.get("velocity_percentage", 100)
            subject = subject_data["subject"]
            
            # PRD allocation rules
            if velocity_pct < 70:  # Significantly Behind
                allocation = 3
            elif velocity_pct < 85:  # Behind  
                allocation = 2
            else:  # On Track or Ahead
                allocation = 1
                
            # Adjust for session size
            if len(subjects) <= 2:
                allocation = min(allocation + 1, 4)
            elif len(subjects) >= 4:
                allocation = max(allocation - 1, 1)
            
            subject_allocations.append({
                "subject": subject,
                "allocation": allocation,
                "velocity_status": subject_data.get("velocity_status", "Unknown"),
                "velocity_percentage": velocity_pct,
                "available_subskills": subject_data.get("available_subskills", [])
            })
            total_allocated += allocation
        
        # Adjust to fit target_activities
        if total_allocated != target_activities:
            # Simple proportional adjustment
            adjustment_factor = target_activities / total_allocated
            for allocation in subject_allocations:
                allocation["allocation"] = max(1, round(allocation["allocation"] * adjustment_factor))
        
        # Create PRD pedagogical structure
        session_structure = {
            "total_activities": target_activities,
            "pedagogical_flow": [
                {"activity_type": "warm_up", "purpose": "confidence_builder", "count": 1},
                {"activity_type": "core_challenge", "purpose": "new_learning", "count": 2},
                {"activity_type": "practice_reinforcement", "purpose": "skill_building", "count": 2},
                {"activity_type": "cool_down", "purpose": "engaging_review", "count": 1}
            ],
            "subject_allocations": subject_allocations,
            "focus_subjects": [s["subject"] for s in sorted(subject_allocations, key=lambda x: x["velocity_percentage"])[:2]]
        }
        
        logger.info(f"Created session structure: {len(subject_allocations)} subjects, {target_activities} activities")
        return session_structure
    
    async def _generate_structured_playlist(
        self, 
        session_structure: Dict[str, Any], 
        daily_theme: Optional[str]
    ) -> Dict[str, Any]:
        """Use LLM efficiently within pre-structured session - minimal token usage"""
        
        logger.info("Generating structured playlist with LLM")
        
        try:
            # Minimal schema for efficient LLM usage
            playlist_schema = {
                "type": "object",
                "properties": {
                    "daily_theme": {"type": "string"},
                    "learning_objectives": {"type": "array", "items": {"type": "string"}},
                    "activities": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "subject": {"type": "string"},
                                "subskill_id": {"type": "string"},
                                "activity_type": {"type": "string"},
                                "reason": {"type": "string"},
                                "estimated_time": {"type": "integer"}
                            },
                            "required": ["subject", "subskill_id", "activity_type", "reason"]
                        }
                    },
                    "session_plan": {
                        "type": "object",
                        "properties": {
                            "session_focus": {"type": "string"},
                            "estimated_time_minutes": {"type": "integer"},
                            "difficulty_balance": {"type": "string"}
                        }
                    }
                },
                "required": ["activities", "session_plan"]
            }
            
            # Build concise context - only essential data
            context_summary = {
                "structure": session_structure["pedagogical_flow"],
                "focus_subjects": session_structure["focus_subjects"],
                "allocations": [{"subject": s["subject"], "allocation": s["allocation"], "velocity": s["velocity_status"]} 
                               for s in session_structure["subject_allocations"]],
                "available_options": {s["subject"]: [skill["subskill_id"] for skill in s["available_subskills"][:3]] 
                                    for s in session_structure["subject_allocations"]}
            }
            
            # Concise prompt - much smaller than before
            theme_text = f'Daily theme: "{daily_theme}"' if daily_theme else "Create an engaging daily theme"
            prompt = f"""Create a K-5 daily learning playlist following this structure:

{theme_text}

Session Structure:
1. Warm-Up: 1 confidence-building activity from strongest subject
2. Core Challenges: 2 new learning activities from focus subjects
3. Practice: 2 reinforcement activities  
4. Cool-Down: 1 engaging review activity

Subject Priorities & Available Options:
{json.dumps(context_summary, indent=2)}

Select specific subskill_ids for each activity type. Provide brief, student-friendly reasons."""
            
            # Efficient LLM call
            response = await self.gemini_client.aio.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=playlist_schema,
                    temperature=0.4,
                    max_output_tokens=5000  # Much smaller limit
                )
            )
            
            if not response or not response.text:
                raise Exception("Empty response from Gemini")
                
            playlist_data = json.loads(response.text)
            
            # Add curriculum data to activities
            enriched_activities = await self._enrich_activities(playlist_data["activities"])
            
            final_playlist = {
                "student_id": session_structure.get("student_id"),
                "daily_theme": playlist_data.get("daily_theme", "Learning Adventure!"),
                "learning_objectives": playlist_data.get("learning_objectives", []),
                "activities": enriched_activities,
                "session_plan": playlist_data.get("session_plan", {}),
                "generated_at": datetime.utcnow().isoformat()
            }
            
            logger.info(f"Generated playlist with {len(enriched_activities)} activities")
            return final_playlist
            
        except Exception as e:
            logger.error(f"Error generating structured playlist: {e}")
            raise
    
    async def _enrich_activities(self, activities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Add curriculum data to selected activities - single efficient query"""
        
        subskill_ids = [activity["subskill_id"] for activity in activities]
        
        if not subskill_ids:
            return activities
            
        # Single query to get all curriculum data
        placeholders = ",".join([f"@id_{i}" for i in range(len(subskill_ids))])
        curriculum_query = f"""
        SELECT
          subject, subskill_id, subskill_description, skill_description,
          difficulty_start, target_difficulty, grade, unit_title
        FROM `{self.project_id}.{self.dataset_id}.curriculum`
        WHERE subskill_id IN ({placeholders})
        """
        
        params = [bigquery.ScalarQueryParameter(f"id_{i}", "STRING", sid) 
                 for i, sid in enumerate(subskill_ids)]
        
        curriculum_data = await self._run_query_async(curriculum_query, params)
        curriculum_lookup = {row["subskill_id"]: row for row in curriculum_data}
        
        # Enrich activities
        enriched = []
        for activity in activities:
            subskill_id = activity["subskill_id"]
            curriculum = curriculum_lookup.get(subskill_id, {})
            
            enriched_activity = {
                **activity,
                "skill_description": curriculum.get("skill_description", ""),
                "subskill_description": curriculum.get("subskill_description", ""),
                "difficulty_start": curriculum.get("difficulty_start"),
                "target_difficulty": curriculum.get("target_difficulty"),
                "grade": curriculum.get("grade"),
                "unit_title": curriculum.get("unit_title"),
                "estimated_time": activity.get("estimated_time", 3)
            }
            enriched.append(enriched_activity)
            
        return enriched
    
    def _empty_playlist_response(self) -> Dict[str, Any]:
        """Return empty playlist when no data available"""
        return {
            "daily_theme": "Learning Break",
            "learning_objectives": [],
            "activities": [],
            "session_plan": {"session_focus": "no_data", "estimated_time_minutes": 0},
            "generated_at": datetime.utcnow().isoformat()
        }
    
    async def _run_query_async(self, query: str, parameters: List[bigquery.ScalarQueryParameter] = None) -> List[Dict]:
        """Run BigQuery query asynchronously"""
        
        def _execute_query():
            job_config = bigquery.QueryJobConfig()
            if parameters:
                job_config.query_parameters = parameters
            
            # Add labels for cost tracking
            job_config.labels = {"service": "ai_recommendations", "component": "recommendation_engine"}
            
            query_job = self.client.query(query, job_config=job_config)
            results = query_job.result()
            
            # Log query stats
            logger.debug(f"Query processed {query_job.total_bytes_processed} bytes")
            
            return [dict(row) for row in results]
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _execute_query)
    
    async def get_subject_skill_recommendations(
        self,
        student_id: int,
        subject: str,
        count: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Get targeted skill recommendations for a specific subject.
        Leverages existing student summary data but focuses on single subject.
        """
        
        logger.info(f"Generating {count} skill recommendations for student {student_id}, subject {subject}")
        
        try:
            # Get focused student data for this subject
            subject_data = await self._get_subject_focused_summary(student_id, subject)
            
            if not subject_data:
                logger.warning(f"No data found for student {student_id}, subject {subject}")
                return []
            
            # Generate recommendations using existing LLM infrastructure
            recommendations = await self._generate_subject_recommendations(
                subject_data, count
            )
            
            # Enrich with curriculum data
            enriched_recommendations = await self._enrich_skill_recommendations(recommendations)
            
            logger.info(f"Generated {len(enriched_recommendations)} recommendations for {subject}")
            return enriched_recommendations
            
        except Exception as e:
            logger.error(f"Error generating subject recommendations: {e}")
            raise

    async def _get_subject_focused_summary(self, student_id: int, subject: str) -> Dict[str, Any]:
        """Get optimized subject-specific summary"""
        
        query = f"""
        WITH subject_velocity AS (
          SELECT 
            subject,
            velocity_status,
            velocity_percentage,
            days_ahead_behind,
            actual_progress,
            expected_progress,
            total_subskills_in_subject
          FROM `{self.project_id}.{self.dataset_id}.student_velocity_metrics`
          WHERE student_id = @student_id AND subject = @subject
        ),
        available_skills AS (
          SELECT 
            subskill_id,
            subskill_description,
            skill_description,
            subskill_mastery_pct,
            unlock_score,
            difficulty_start,
            readiness_status
          FROM `{self.project_id}.{self.dataset_id}.student_available_subskills`
          WHERE student_id = @student_id 
            AND subject = @subject 
            AND is_available = TRUE
          ORDER BY 
            CASE readiness_status 
              WHEN 'Ready' THEN 1
              WHEN 'Nearly Ready' THEN 2 
              ELSE 3
            END,
            unlock_score DESC
          LIMIT 10  -- Get top 10 available skills
        ),
        mastery_context AS (
          SELECT 
            subject,
            AVG(skill_mastery_pct) as avg_mastery,
            COUNT(*) as total_skills,
            COUNT(CASE WHEN skill_mastery_pct >= 80 THEN 1 END) as mastered_skills
          FROM `{self.project_id}.{self.dataset_id}.v_student_skill_mastery`
          WHERE student_id = @student_id AND subject = @subject
          GROUP BY subject
        )
        SELECT 
          v.subject,
          v.velocity_status,
          v.velocity_percentage,
          v.days_ahead_behind,
          v.actual_progress,
          v.expected_progress,
          v.total_subskills_in_subject,
          m.avg_mastery,
          m.total_skills,
          m.mastered_skills,
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
            ORDER BY 
              CASE a.readiness_status 
                WHEN 'Ready' THEN 1
                WHEN 'Nearly Ready' THEN 2 
                ELSE 3
              END,
              a.unlock_score DESC
          ) as available_subskills
        FROM subject_velocity v
        LEFT JOIN mastery_context m ON v.subject = m.subject
        LEFT JOIN available_skills a ON TRUE
        GROUP BY v.subject, v.velocity_status, v.velocity_percentage, 
                 v.days_ahead_behind, v.actual_progress, v.expected_progress,
                 v.total_subskills_in_subject, m.avg_mastery, m.total_skills, m.mastered_skills
        """
        
        results = await self._run_query_async(query, [
            bigquery.ScalarQueryParameter("student_id", "INT64", student_id),
            bigquery.ScalarQueryParameter("subject", "STRING", subject)
        ])
        
        return results[0] if results else None

    async def _generate_subject_recommendations(
        self,
        subject_data: Dict[str, Any],
        count: int
    ) -> List[Dict[str, Any]]:
        """Generate skill recommendations using LLM for specific subject"""
        
        # Minimal schema for efficiency
        recommendations_schema = {
            "type": "object",
            "properties": {
                "recommendations": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "subskill_id": {"type": "string"},
                            "priority_rank": {"type": "integer"},
                            "student_friendly_reason": {"type": "string"},
                            "engagement_hook": {"type": "string"},
                            "estimated_time_minutes": {"type": "integer"},
                            "difficulty_level": {"type": "string"}
                        },
                        "required": ["subskill_id", "priority_rank", "student_friendly_reason", "engagement_hook"]
                    }
                }
            },
            "required": ["recommendations"]
        }
        
        # Build context
        velocity_context = {
            "subject": subject_data["subject"],
            "velocity_status": subject_data["velocity_status"],
            "days_behind": subject_data.get("days_ahead_behind", 0),
            "progress": f"{subject_data.get('actual_progress', 0)}/{subject_data.get('total_subskills_in_subject', 0)} skills completed",
            "avg_mastery": f"{subject_data.get('avg_mastery', 0):.1f}%"
        }
        
        available_skills = subject_data.get("available_subskills", [])[:8]  # Limit context size
        
        prompt = f"""You are recommending specific skills for a K-5 student who is struggling in {subject_data['subject']}.

Student Context:
- Subject: {velocity_context['subject']}
- Status: {velocity_context['velocity_status']} ({velocity_context['days_behind']} days behind)
- Progress: {velocity_context['progress']}
- Current mastery level: {velocity_context['avg_mastery']}

Available Skills to Choose From:
{json.dumps([{
    "subskill_id": skill["subskill_id"],
    "description": skill["subskill_description"], 
    "skill_area": skill["skill_description"],
    "readiness": skill["readiness_status"],
    "current_mastery": f"{skill.get('subskill_mastery_pct', 0):.0f}%"
} for skill in available_skills], indent=2)}

Select {count} skills that would be most engaging and helpful for this student to catch up. 
Focus on:
1. Skills they're ready for (readiness status)
2. Building confidence with achievable challenges
3. Variety in skill areas within the subject
4. Student-friendly explanations and engaging hooks

Rank by priority (1 = highest priority). Provide engaging, age-appropriate reasons why each skill would help them catch up."""

        response = await self.gemini_client.aio.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=GenerateContentConfig(
                response_mime_type='application/json',
                response_schema=recommendations_schema,
                temperature=0.6,  # Slightly more creative for engagement
                max_output_tokens=3000
            )
        )
        
        if not response or not response.text:
            raise Exception("Empty response from Gemini")
        
        result = json.loads(response.text)
        return result.get("recommendations", [])

    async def _enrich_skill_recommendations(
        self, 
        recommendations: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Add curriculum data to recommendations"""
        
        subskill_ids = [rec["subskill_id"] for rec in recommendations]
        
        if not subskill_ids:
            return recommendations
        
        # Get curriculum data
        placeholders = ",".join([f"@id_{i}" for i in range(len(subskill_ids))])
        curriculum_query = f"""
        SELECT
          subject, subskill_id, subskill_description, skill_description,
          difficulty_start, target_difficulty, grade, unit_title
        FROM `{self.project_id}.{self.dataset_id}.curriculum`
        WHERE subskill_id IN ({placeholders})
        """
        
        params = [bigquery.ScalarQueryParameter(f"id_{i}", "STRING", sid) 
                 for i, sid in enumerate(subskill_ids)]
        
        curriculum_data = await self._run_query_async(curriculum_query, params)
        curriculum_lookup = {row["subskill_id"]: row for row in curriculum_data}
        
        # Enrich recommendations
        enriched = []
        for rec in recommendations:
            subskill_id = rec["subskill_id"]
            curriculum = curriculum_lookup.get(subskill_id, {})
            
            enriched_rec = {
                **rec,
                "subject": curriculum.get("subject", ""),
                "skill_description": curriculum.get("skill_description", ""),
                "subskill_description": curriculum.get("subskill_description", ""),
                "difficulty_start": curriculum.get("difficulty_start"),
                "target_difficulty": curriculum.get("target_difficulty"),
                "grade": curriculum.get("grade"),
                "unit_title": curriculum.get("unit_title"),
                "estimated_time_minutes": rec.get("estimated_time_minutes", 4)
            }
            enriched.append(enriched_rec)
        
        return sorted(enriched, key=lambda x: x.get("priority_rank", 999))

    async def health_check(self) -> Dict[str, Any]:
        """Check service health"""
        try:
            # Test BigQuery connectivity
            test_query = f"SELECT 1 as test_value LIMIT 1"
            await self._run_query_async(test_query)
            
            # Test Gemini connectivity (simple test)
            test_schema = {
                "type": "object",
                "properties": {
                    "test": {"type": "string"}
                },
                "required": ["test"]
            }
            
            test_response = await self.gemini_client.aio.models.generate_content(
                model='gemini-2.5-flash',
                contents="Return JSON with test field set to 'success'",
                config=GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=test_schema,
                    max_output_tokens=50
                )
            )
            
            gemini_healthy = test_response and "success" in test_response.text
            
            return {
                "status": "healthy" if gemini_healthy else "degraded",
                "bigquery_connection": "healthy",
                "gemini_connection": "healthy" if gemini_healthy else "unhealthy",
                "model": "gemini-2.5-flash",
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }