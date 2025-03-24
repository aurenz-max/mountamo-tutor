from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import math
from pathlib import Path
import pandas as pd
import random


import asyncpg
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

class CompetencyService:
    def __init__(self, data_dir: str = "data"):
        """Initialize CompetencyService.
        
        Args:
            data_dir: Path to data directory containing syllabus and objectives files
        """
        self._competencies = {}  # In-memory storage for now
        self.cosmos_db = None  # Will be set by dependency injection
        self.full_credibility_standard = 15  # Full credibility for specific subskill
        self.full_credibility_standard_subject = 150  # Full credibility for subject
        self.default_score = 5.0  # Default score when no data exists
        self.syllabus_cache: Dict[str, List[Dict]] = {}
        self.data_dir = Path(data_dir)
        self.detailed_objectives = {}
        
        # Load data at initialization
        self._load_all_data(data_dir)

    def _load_all_data(self, data_dir):
        """Load syllabus data from CSVs with subject column"""
        self.syllabus_cache = {}
        
        try:
            # Load all syllabus files with the new format
            for syllabus_file in Path(data_dir).glob("*syllabus*.csv"):  # New filename pattern
                try:
                    print(f"[DEBUG] Loading syllabus file: {syllabus_file}")
                    df = pd.read_csv(syllabus_file)
                    
                    # Validate required columns
                    required_columns = [
                        'Subject', 'UnitID', 'UnitTitle', 'SkillID', 
                        'SkillDescription', 'SubskillID', 'SubskillDescription',
                        'DifficultyStart', 'DifficultyEnd', 'TargetDifficulty'
                    ]
                    
                    if not set(required_columns).issubset(df.columns):
                        print(f"Skipping {syllabus_file} - missing required columns")
                        continue

                    # Group by subject and structure syllabus
                    for subject, group in df.groupby('Subject'):
                        if subject not in self.syllabus_cache:
                            self.syllabus_cache[subject] = []
                        
                        # Structure the syllabus data
                        structured = []
                        current_unit = None
                        current_skill = None
                        
                        for _, row in group.sort_values(["UnitID", "SkillID", "SubskillID"]).iterrows():
                            # Add unit
                            if not current_unit or current_unit["id"] != row["UnitID"]:
                                current_unit = {
                                    "id": row["UnitID"],
                                    "title": row["UnitTitle"],
                                    "skills": []
                                }
                                structured.append(current_unit)
                            
                            # Add skill
                            if not current_skill or current_skill["id"] != row["SkillID"]:
                                current_skill = {
                                    "id": row["SkillID"],
                                    "description": row["SkillDescription"],
                                    "subskills": []
                                }
                                current_unit["skills"].append(current_skill)
                            
                            # Add subskill
                            current_skill["subskills"].append({
                                "id": row["SubskillID"],
                                "description": row["SubskillDescription"],
                                "difficulty_range": {
                                    "start": row["DifficultyStart"],
                                    "end": row["DifficultyEnd"],
                                    "target": row["TargetDifficulty"]
                                }
                            })
                        
                        # Merge with existing data for this subject
                        self.syllabus_cache[subject].extend(structured)
                    
                    print(f"[DEBUG] Loaded data for subjects: {list(self.syllabus_cache.keys())}")
                        
                except Exception as e:
                    print(f"Error loading {syllabus_file}: {str(e)}")
                    import traceback
                    traceback.print_exc()

            # Load detailed objectives from all matching files
            self.detailed_objectives = {}
            for obj_file in Path(data_dir).glob("detailed_objectives_*.csv"):
                try:
                    print(f"[DEBUG] Loading objectives file: {obj_file}")
                    # Read CSV with proper escaping
                    df = pd.read_csv(obj_file, quoting=1)  # QUOTE_ALL mode
                    
                    # Group by Subject and SubskillID
                    for (subject, subskill_id), group in df.groupby(['Subject', 'SubskillID']):
                        if subject not in self.detailed_objectives:
                            self.detailed_objectives[subject] = {}
                        
                        # Store all objectives for this subskill as a list
                        self.detailed_objectives[subject][subskill_id] = []
                        
                        for _, row in group.iterrows():
                            self.detailed_objectives[subject][subskill_id].append({
                                'ConceptGroup': row['ConceptGroup'],
                                'DetailedObjective': row['DetailedObjective'],
                                'SubskillDescription': row['SubskillDescription']
                            })
                                
                except Exception as e:
                    print(f"Error loading {obj_file}: {str(e)}")
                    import traceback
                    traceback.print_exc()
        except Exception as e:
            print(f"Critical error loading data: {str(e)}")
            import traceback
            traceback.print_exc()

    async def get_detailed_objectives(self, subject: str, subskill_id: str) -> dict:
        """Get detailed objectives for a subskill - returns a randomly selected objective"""
        try:
            from asyncio import to_thread
            
            objectives = self.detailed_objectives.get(subject, {}).get(subskill_id, [])
            if objectives:
                # Move random selection to thread since it's CPU-bound
                return await to_thread(lambda: random.choice(objectives))
            
            return {
                'ConceptGroup': 'General',
                'DetailedObjective': 'Develop core skills'
            }
        except Exception as e:
            print(f"Error getting detailed objectives: {str(e)}")
            return {
                'ConceptGroup': 'General',
                'DetailedObjective': 'Develop core skills'
            }
    
    async def get_all_objectives(self, subject: str, subskill_id: str) -> list:
        """Get ALL detailed objectives for a subskill"""
        return self.detailed_objectives.get(subject, {}).get(subskill_id, [])

    def _structure_syllabus(self, df: pd.DataFrame) -> List[Dict]:
        """Convert flat CSV data to hierarchical structure"""
        structured = []
        current_unit = None
        current_skill = None
        
        for _, row in df.sort_values(["unit_id", "skill_id"]).iterrows():
            # Add unit
            if not current_unit or current_unit["id"] != row["unit_id"]:
                current_unit = {
                    "id": row["unit_id"],
                    "title": row["unit_title"],
                    "skills": []
                }
                structured.append(current_unit)
            
            # Add skill
            if not current_skill or current_skill["id"] != row["skill_id"]:
                current_skill = {
                    "id": row["skill_id"],
                    "description": row["skill_description"],
                    "subskills": []
                }
                current_unit["skills"].append(current_skill)
            
            # Add subskill
            current_skill["subskills"].append({
                "id": row["subskill_id"],
                "description": row["subskill_description"],
                "difficulty_range": {
                    "start": row["difficulty_start"],
                    "end": row["difficulty_end"],
                    "target": row["target_difficulty"]
                }
            })
        
        return structured

    async def get_available_subjects(self) -> List[str]:
        """Get list of all available subjects from the syllabus cache"""
        # Simply return the keys from the syllabus cache dictionary
        return list(self.syllabus_cache.keys())

    async def get_curriculum(self, subject: str) -> List[Dict]:
        """Get full curriculum structure for a subject"""
        try:
            from asyncio import to_thread
            # Move dictionary access to thread since it might be CPU-intensive for large curricula
            return await to_thread(lambda: self.syllabus_cache.get(subject, []))
        except Exception as e:
            print(f"Error getting curriculum: {str(e)}")
            return []

    async def update_competency_from_problem(
        self,
        student_id: int,
        subject: str,
        skill_id: str,
        subskill_id: str,
        evaluation: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update competency based on problem evaluation"""
        try:
            # Check if cosmos_db is available
            if not self.cosmos_db:
                print("[ERROR] CosmosDB service not initialized")
                return {
                    "error": "Database service not available",
                    "student_id": student_id,
                    "subject": subject,
                    "skill_id": skill_id,
                    "subskill_id": subskill_id
                }
                    
            # Extract score from evaluation, handling both dictionary and scalar formats
            score = 0.0
            if isinstance(evaluation.get('evaluation'), dict):
                # New structured format (dictionary with score and justification)
                score_value = evaluation['evaluation'].get('score')
                if isinstance(score_value, str):
                    score = float(score_value)
                else:
                    score = float(score_value or 0)
            else:
                # Old format (directly as number or string)
                score = float(evaluation.get('evaluation', 0))
                
            # Extract feedback for the attempt record
            feedback = ""
            if isinstance(evaluation.get('feedback'), dict):
                # New structured format
                feedback_parts = []
                if evaluation['feedback'].get('praise'):
                    feedback_parts.append(evaluation['feedback']['praise'])
                if evaluation['feedback'].get('guidance'):
                    feedback_parts.append(evaluation['feedback']['guidance'])
                if evaluation['feedback'].get('encouragement'):
                    feedback_parts.append(evaluation['feedback']['encouragement'])
                if evaluation['feedback'].get('next_steps'):
                    feedback_parts.append(evaluation['feedback']['next_steps'])
                feedback = " ".join(feedback_parts)
            else:
                # Old format
                feedback = str(evaluation.get('feedback', ''))
                
            # Extract analysis for the attempt record
            analysis = ""
            if isinstance(evaluation.get('analysis'), dict):
                # New structured format
                analysis_parts = []
                if evaluation['analysis'].get('understanding'):
                    analysis_parts.append(evaluation['analysis']['understanding'])
                if evaluation['analysis'].get('approach'):
                    analysis_parts.append(evaluation['analysis']['approach'])
                if evaluation['analysis'].get('accuracy'):
                    analysis_parts.append(evaluation['analysis']['accuracy'])
                analysis = " ".join(analysis_parts)
            else:
                # Old format
                analysis = str(evaluation.get('analysis', ''))
            
            # Save the attempt
            await self.cosmos_db.save_attempt(
                student_id=student_id,
                subject=subject,
                skill_id=skill_id,
                subskill_id=subskill_id,
                score=score,
                analysis=analysis,
                feedback=feedback
            )
            
            # Get all attempts for this skill
            attempts = await self.cosmos_db.get_student_attempts(
                student_id=student_id,
                subject=subject,
                skill_id=skill_id,
                subskill_id=subskill_id
            )
            
            # Move calculations to a thread since they're CPU bound
            from asyncio import to_thread
            def calculate_scores():
                average_score = sum(attempt["score"] for attempt in attempts) / len(attempts)
                credibility = min(1.0, math.sqrt(len(attempts) / self.full_credibility_standard))
                blended_score = (average_score * credibility) + (self.default_score * (1 - credibility))
                return blended_score, credibility
            
            blended_score, credibility = await to_thread(calculate_scores)

            # Update competency
            return await self.cosmos_db.update_competency(
                student_id=student_id,
                subject=subject,
                skill_id=skill_id,
                subskill_id=subskill_id,
                score=blended_score,
                credibility=credibility,
                total_attempts=len(attempts)
            )
                
        except Exception as e:
            print(f"Error updating competency: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "error": str(e),
                "student_id": student_id,
                "subject": subject,
                "skill_id": skill_id,
                "subskill_id": subskill_id
            }

    async def get_competency(
        self,
        student_id: int,
        subject: str,
        skill_id: str,
        subskill_id: str
    ) -> Dict[str, Any]:
        """Get competency for a specific skill/subskill"""
        try:
            # Check if cosmos_db is available
            if not self.cosmos_db:
                print("[ERROR] CosmosDB service not initialized")
                return {
                    "current_score": self.default_score,
                    "credibility": 0.0,
                    "total_attempts": 0
                }
                
            result = await self.cosmos_db.get_competency(
                student_id=student_id,
                subject=subject,
                skill_id=skill_id,
                subskill_id=subskill_id
            )
            
            if not result:
                return {
                    "current_score": self.default_score,
                    "credibility": 0.0,
                    "total_attempts": 0
                }
            
            return result
        except Exception as e:
            print(f"Error getting competency: {str(e)}")
            return {
                "current_score": self.default_score,
                "credibility": 0.0,
                "total_attempts": 0
            }

    async def get_subject_competency(
        self,
        student_id: int,
        subject: str
    ) -> Dict[str, Any]:
        """Get aggregated competency for entire subject"""
        try:
            # Check if cosmos_db is available
            if not self.cosmos_db:
                print("[ERROR] CosmosDB service not initialized")
                return {
                    "student_id": student_id,
                    "subject": subject,
                    "current_score": self.default_score,
                    "credibility": 0,
                    "total_attempts": 0
                }
                
            from asyncio import to_thread
            
            competencies = await self.cosmos_db.get_subject_competencies(
                student_id=student_id,
                subject=subject
            )
            
            if not competencies:
                return {
                    "student_id": student_id,
                    "subject": subject,
                    "current_score": self.default_score,
                    "credibility": 0,
                    "total_attempts": 0
                }
            
            def calculate_subject_scores():
                total_attempts = sum(comp.get("total_attempts", 0) for comp in competencies)
                average_score = sum(comp.get("current_score", 0) for comp in competencies) / len(competencies)
                credibility = min(1.0, math.sqrt(total_attempts / self.full_credibility_standard_subject))
                blended_score = (average_score * credibility) + (self.default_score * (1 - credibility))
                return blended_score, credibility, total_attempts
                
            blended_score, credibility, total_attempts = await to_thread(calculate_subject_scores)
            
            return {
                "student_id": student_id,
                "subject": subject,
                "current_score": blended_score,
                "credibility": credibility,
                "total_attempts": total_attempts
            }
            
        except Exception as e:
            print(f"Error calculating subject competency: {str(e)}")
            return {
                "student_id": student_id,
                "subject": subject,
                "current_score": self.default_score,
                "credibility": 0,
                "total_attempts": 0
            }

    async def get_detailed_problem_reviews(
        self,
        student_id: int,
        subject: Optional[str] = None,
        skill_id: Optional[str] = None, 
        subskill_id: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get detailed problem reviews with structured feedback components."""
        try:
            print(f"[DEBUG] get_detailed_problem_reviews called with:")
            print(f"[DEBUG]   - student_id: {student_id}")
            print(f"[DEBUG]   - subject: {subject}")
            print(f"[DEBUG]   - skill_id: {skill_id}")
            print(f"[DEBUG]   - subskill_id: {subskill_id}")
            print(f"[DEBUG]   - limit: {limit}")
            
            # Check if cosmos_db is available
            if not self.cosmos_db:
                print("[ERROR] CosmosDB service not initialized")
                return []
                
            # Get reviews from cosmos_db
            reviews = await self.cosmos_db.get_problem_reviews(
                student_id=student_id,
                subject=subject,
                skill_id=skill_id,
                subskill_id=subskill_id,
                limit=limit
            )
            
            print(f"[DEBUG] Got {len(reviews)} reviews from cosmos_db")
            
            # Format the reviews to include the structured components
            formatted_reviews = []
            for i, review in enumerate(reviews):
                print(f"[DEBUG] Processing review {i+1}/{len(reviews)} with ID: {review.get('id', 'No ID')}")
                
                # Check for problem_content
                has_problem_content = 'problem_content' in review
                problem_content_type = type(review.get('problem_content')).__name__ if has_problem_content else 'N/A'
                print(f"[DEBUG]   - Has problem_content: {'yes' if has_problem_content else 'no'}")
                print(f"[DEBUG]   - problem_content type: {problem_content_type}")
                
                formatted_review = {
                    "id": review["id"],
                    "student_id": review["student_id"],
                    "subject": review["subject"],
                    "skill_id": review["skill_id"],
                    "subskill_id": review["subskill_id"],
                    "problem_id": review["problem_id"],
                    "timestamp": review["timestamp"],
                    "score": review["score"],
                    "problem_content": review.get("problem_content", None),  # Include problem content
                    "feedback_components": {
                        "observation": review.get("observation", {}),
                        "analysis": review.get("analysis", {}),
                        "evaluation": review.get("evaluation", {}),
                        "feedback": review.get("feedback", {})
                    }
                }
                
                print(f"[DEBUG]   - Formatted review has problem_content: {'yes' if 'problem_content' in formatted_review else 'no'}")
                
                formatted_reviews.append(formatted_review)
            
            print(f"[DEBUG] Returning {len(formatted_reviews)} formatted reviews")
            return formatted_reviews
            
        except Exception as e:
            print(f"[ERROR] Error getting detailed problem reviews: {str(e)}")
            import traceback
            traceback.print_exc()
            return []

    async def get_subskill_types(self, subject: str) -> List[str]:
        """Get list of all problem types (subskills) available"""
        curriculum = await self.get_curriculum(subject)
        return [
            subskill["id"]
            for unit in curriculum
            for skill in unit["skills"]
            for subskill in skill["subskills"]
        ]

    # Add these methods to your existing CompetencyService class


# Import the necessary modules




class AnalyticsExtension:
    def __init__(self, competency_service):
        self.competency_service = competency_service
        # We keep the reference to CosmosDB only for live competency data
        self.cosmos_db = None  
        
        # Configure PostgreSQL connection string

        # Set credibility standards for different curriculum levels
        self.full_credibility_standard_subskill = 10    # Full credibility for specific subskill
        self.full_credibility_standard_skill = 30       # Full credibility for skill
        self.full_credibility_standard_unit = 100       # Full credibility for unit
        self.full_credibility_standard_subject = 200    # Full credibility for subject
    
    async def get_pg_connection(self):
        """Get a PostgreSQL connection"""
        try:
            return await asyncpg.connect(
                host=settings.PG_HOST,
                port=settings.PG_PORT,
                user=settings.PG_USER,
                password=settings.PG_PASSWORD,  # Use the raw password
                database=settings.PG_DATABASE
            )
        except Exception as e:
            logger.error(f"Error connecting to PostgreSQL: {e}")
            raise
    
    async def get_daily_progress(self, student_id: int, days: int = 7) -> List[Dict[str, Any]]:
        """Get daily progress statistics for a student from the analytics warehouse"""
        conn = await self.get_pg_connection()
        
        try:
            # Calculate date range
            end_date = datetime.utcnow().date()
            start_date = end_date - timedelta(days=days-1)
            
            # Query using the analytics data
            rows = await conn.fetch('''
                SELECT 
                    dd.date,
                    dd.weekday_name as day_name,
                    COUNT(fa.attempt_key) as problems,
                    AVG(fa.attempt_score) as competency,
                    SUM(fa.time_spent_minutes) as time_spent,
                    COUNT(DISTINCT fa.skill_id) as unique_skills,
                    COUNT(DISTINCT fa.subskill_id) as unique_subskills
                FROM 
                    analytics.dim_date dd
                LEFT JOIN 
                    analytics.fact_attempts fa 
                    ON dd.date_key = fa.date_key AND fa.student_id = $1
                WHERE 
                    dd.date BETWEEN $2 AND $3
                GROUP BY 
                    dd.date, dd.weekday_name
                ORDER BY 
                    dd.date
            ''', student_id, start_date, end_date)
            
            # Format results
            daily_stats = []
            for row in rows:
                daily_stats.append({
                    "day": row["day_name"][:3],  # First 3 letters of day name
                    "date": row["date"].strftime('%Y-%m-%d'),
                    "competency": row["competency"] if row["competency"] is not None else 0,
                    "timeSpent": row["time_spent"] if row["time_spent"] is not None else 0,
                    "problems": row["problems"],
                    "uniqueSkills": row["unique_skills"],
                    "uniqueSubskills": row["unique_subskills"]
                })
            
            return daily_stats
            
        finally:
            await conn.close()
    
    async def get_skill_competencies(self, student_id: int, subject: str) -> List[Dict[str, Any]]:
        """Get competencies for all skills in a subject from the analytics warehouse"""
        conn = await self.get_pg_connection()
        
        try:
            # Query the data warehouse for skill competencies
            rows = await conn.fetch('''
                SELECT 
                    m.skill_id,
                    sk.skill_description,
                    m.mastery_score,
                    m.average_score,
                    m.credibility,
                    m.total_attempts,
                    m.completion_percentage,
                    ml.mastery_level
                FROM 
                    analytics.fact_mastery_metrics m
                JOIN 
                    analytics.dim_mastery_level ml 
                    ON m.mastery_level_key = ml.mastery_level_key
                JOIN
                    analytics.dim_skill sk
                    ON m.skill_id = sk.skill_id
                WHERE 
                    m.student_id = $1
                    AND m.subject_id = $2
                    AND m.hierarchy_level = 'skill'
                    AND m.calculation_timestamp = (
                        SELECT MAX(calculation_timestamp) 
                        FROM analytics.fact_mastery_metrics 
                        WHERE student_id = $1 AND subject_id = $2 AND hierarchy_level = 'skill'
                    )
            ''', student_id, subject)
            
            # Calculate trend data from attempts
            trend_data = await conn.fetch('''
                WITH recent_attempts AS (
                    SELECT 
                        skill_id,
                        attempt_score,
                        attempt_timestamp,
                        ROW_NUMBER() OVER (PARTITION BY skill_id ORDER BY attempt_timestamp DESC) as rn
                    FROM 
                        analytics.fact_attempts
                    WHERE 
                        student_id = $1
                        AND subject_id = $2
                        AND attempt_timestamp >= NOW() - INTERVAL '30 days'
                ),
                first_half AS (
                    SELECT 
                        skill_id,
                        AVG(attempt_score) as avg_score
                    FROM 
                        recent_attempts
                    WHERE 
                        rn > 5
                    GROUP BY 
                        skill_id
                ),
                second_half AS (
                    SELECT 
                        skill_id,
                        AVG(attempt_score) as avg_score
                    FROM 
                        recent_attempts
                    WHERE 
                        rn <= 5
                    GROUP BY 
                        skill_id
                )
                SELECT 
                    COALESCE(s.skill_id, f.skill_id) as skill_id,
                    COALESCE(s.avg_score, 0) - COALESCE(f.avg_score, 0) as trend_value,
                    CASE 
                        WHEN COALESCE(s.avg_score, 0) - COALESCE(f.avg_score, 0) > 0.5 THEN 'improving'
                        WHEN COALESCE(s.avg_score, 0) - COALESCE(f.avg_score, 0) < -0.5 THEN 'declining'
                        ELSE 'stable'
                    END as trend,
                    COUNT(ra.skill_id) as recent_attempts
                FROM 
                    recent_attempts ra
                LEFT JOIN 
                    first_half f ON ra.skill_id = f.skill_id
                LEFT JOIN 
                    second_half s ON ra.skill_id = s.skill_id
                WHERE 
                    ra.rn = 1
                GROUP BY 
                    s.skill_id, f.skill_id, s.avg_score, f.avg_score
            ''', student_id, subject)
            
            # Create a mapping of trend data
            trend_map = {t["skill_id"]: t for t in trend_data}
            
            # Format results
            skill_data = []
            for row in rows:
                skill_id = row["skill_id"]
                trend_info = trend_map.get(skill_id, {})
                
                skill_data.append({
                    "skill": skill_id,
                    "description": row["skill_description"],
                    "score": row["average_score"],
                    "credibility": row["credibility"],
                    "attempts": row["total_attempts"],
                    "trend": trend_info.get("trend", "stable"),
                    "trend_value": trend_info.get("trend_value", 0),
                    "recent_attempts": trend_info.get("recent_attempts", 0),
                    "mastery_level": row["mastery_level"].lower()
                })
            
            # Sort by score
            skill_data.sort(key=lambda x: x["score"], reverse=True)
            
            return skill_data
            
        finally:
            await conn.close()
    
    async def get_detailed_analytics(self, student_id: int, subject: str) -> Dict[str, Any]:
        """Get enhanced detailed analytics for a student in a subject"""
        conn = await self.get_pg_connection()
        
        try:
            # Get current stats
            current_stats = await conn.fetchrow('''
                SELECT 
                    SUM(fa.attempt_key) as total_problems,
                    AVG(m.average_score) as average_score,
                    AVG(m.credibility) as credibility,
                    COUNT(DISTINCT m.subskill_id) as unique_subskills
                FROM 
                    analytics.fact_mastery_metrics m
                LEFT JOIN
                    analytics.fact_attempts fa
                    ON m.student_id = fa.student_id 
                    AND m.subject_id = fa.subject_id
                WHERE 
                    m.student_id = $1
                    AND m.subject_id = $2
                    AND m.hierarchy_level = 'subskill'
                    AND m.calculation_timestamp = (
                        SELECT MAX(calculation_timestamp) 
                        FROM analytics.fact_mastery_metrics 
                        WHERE student_id = $1 
                        AND subject_id = $2 
                        AND hierarchy_level = 'subskill'
                    )
            ''', student_id, subject)
            
            # Get subskill stats
            subskill_rows = await conn.fetch('''
                SELECT 
                    m.subskill_id,
                    m.skill_id,
                    m.average_score,
                    m.credibility,
                    m.total_attempts,
                    ss.subskill_description
                FROM 
                    analytics.fact_mastery_metrics m
                JOIN
                    analytics.dim_subskill ss
                    ON m.subskill_id = ss.subskill_id
                WHERE 
                    m.student_id = $1
                    AND m.subject_id = $2
                    AND m.hierarchy_level = 'subskill'
                    AND m.calculation_timestamp = (
                        SELECT MAX(calculation_timestamp) 
                        FROM analytics.fact_mastery_metrics 
                        WHERE student_id = $1 
                        AND subject_id = $2 
                        AND hierarchy_level = 'subskill'
                    )
            ''', student_id, subject)
            
            # Get progression data
            progression_rows = await conn.fetch('''
                WITH weekly_data AS (
                    SELECT 
                        dd.year,
                        dd.week,
                        CONCAT(dd.year, '-W', LPAD(dd.week::text, 2, '0')) as period,
                        AVG(fa.attempt_score) as avg_score,
                        COUNT(fa.attempt_key) as attempts,
                        COUNT(DISTINCT fa.skill_id) as unique_skills,
                        COUNT(DISTINCT fa.subskill_id) as unique_subskills
                    FROM 
                        analytics.fact_attempts fa
                    JOIN 
                        analytics.dim_date dd
                        ON fa.date_key = dd.date_key
                    WHERE 
                        fa.student_id = $1
                        AND fa.subject_id = $2
                    GROUP BY 
                        dd.year, dd.week
                    ORDER BY 
                        dd.year, dd.week
                )
                SELECT 
                    period,
                    avg_score * 10 as score,
                    attempts,
                    unique_skills,
                    unique_subskills
                FROM 
                    weekly_data
                ORDER BY 
                    year, week
            ''', student_id, subject)
            
            # Get strengths and gaps
            strength_rows = await conn.fetch('''
                SELECT 
                    m.subskill_id,
                    m.skill_id,
                    m.average_score,
                    m.total_attempts,
                    ss.subskill_description
                FROM 
                    analytics.fact_mastery_metrics m
                JOIN
                    analytics.dim_subskill ss
                    ON m.subskill_id = ss.subskill_id
                WHERE 
                    m.student_id = $1
                    AND m.subject_id = $2
                    AND m.hierarchy_level = 'subskill'
                    AND m.credibility >= 0.3
                    AND m.average_score >= 75
                    AND m.calculation_timestamp = (
                        SELECT MAX(calculation_timestamp) 
                        FROM analytics.fact_mastery_metrics 
                        WHERE student_id = $1 
                        AND subject_id = $2 
                        AND hierarchy_level = 'subskill'
                    )
                ORDER BY
                    m.average_score DESC
                LIMIT 5
            ''', student_id, subject)
            
            gap_rows = await conn.fetch('''
                SELECT 
                    m.subskill_id,
                    m.skill_id,
                    m.average_score,
                    m.total_attempts,
                    ss.subskill_description
                FROM 
                    analytics.fact_mastery_metrics m
                JOIN
                    analytics.dim_subskill ss
                    ON m.subskill_id = ss.subskill_id
                WHERE 
                    m.student_id = $1
                    AND m.subject_id = $2
                    AND m.hierarchy_level = 'subskill'
                    AND m.credibility >= 0.3
                    AND m.average_score <= 45
                    AND m.calculation_timestamp = (
                        SELECT MAX(calculation_timestamp) 
                        FROM analytics.fact_mastery_metrics 
                        WHERE student_id = $1 
                        AND subject_id = $2 
                        AND hierarchy_level = 'subskill'
                    )
                ORDER BY
                    m.average_score
                LIMIT 5
            ''', student_id, subject)
            
            # Format subskill stats
            subskill_stats = {}
            for row in subskill_rows:
                subskill_id = row["subskill_id"]
                
                # Calculate recent performance using attempts
                recent_attempts = await conn.fetch('''
                    SELECT 
                        attempt_score
                    FROM 
                        analytics.fact_attempts
                    WHERE 
                        student_id = $1
                        AND subject_id = $2
                        AND subskill_id = $3
                    ORDER BY 
                        attempt_timestamp DESC
                    LIMIT 5
                ''', student_id, subject, subskill_id)
                
                recent_score = 0
                if recent_attempts:
                    recent_score = sum(a["attempt_score"] for a in recent_attempts) / len(recent_attempts)
                
                trend = "stable"
                if recent_score > row["average_score"] + 0.5:
                    trend = "improving"
                elif recent_score < row["average_score"] - 0.5:
                    trend = "declining"
                
                subskill_stats[subskill_id] = {
                    "problems": row["total_attempts"],
                    "averageScore": row["average_score"],
                    "credibility": row["credibility"],
                    "recentScore": recent_score,
                    "trend": trend,
                    "skillId": row["skill_id"],
                    "description": row["subskill_description"]
                }
            
            # Format strengths and gaps
            strengths = []
            for row in strength_rows:
                strengths.append({
                    "subskillId": row["subskill_id"],
                    "skillId": row["skill_id"],
                    "score": row["average_score"],
                    "problems": row["total_attempts"],
                    "description": row["subskill_description"]
                })
                
            gaps = []
            for row in gap_rows:
                gaps.append({
                    "subskillId": row["subskill_id"],
                    "skillId": row["skill_id"],
                    "score": row["average_score"],
                    "problems": row["total_attempts"],
                    "description": row["subskill_description"]
                })
            
            # Format progression data
            progression_data = []
            for row in progression_rows:
                progression_data.append({
                    "period": row["period"],
                    "score": row["score"],
                    "attempts": row["attempts"],
                    "uniqueSkills": row["unique_skills"],
                    "uniqueSubskills": row["unique_subskills"]
                })
            
            # Compile results
            return {
                "currentStats": {
                    "totalProblems": current_stats["total_problems"] if current_stats["total_problems"] else 0,
                    "averageScore": current_stats["average_score"] if current_stats["average_score"] else 0,
                    "credibility": current_stats["credibility"] * 100 if current_stats["credibility"] else 0,
                    "subSkills": subskill_stats,
                    "uniqueSubskills": current_stats["unique_subskills"] if current_stats["unique_subskills"] else 0
                },
                "progressionData": progression_data,
                "strengthsAndGaps": {
                    "strengths": strengths,
                    "gaps": gaps
                }
            }
            
        finally:
            await conn.close()

    async def get_gap_analysis(self, student_id: int, subject: str) -> Dict[str, Any]:
        """Get detailed gap analysis information from the analytics warehouse"""
        conn = await self.get_pg_connection()
        
        try:
            # Get summary counts
            summary_row = await conn.fetchrow('''
                SELECT 
                    total_curriculum_items,
                    coverage_gaps,
                    performance_gaps,
                    mastered_items,
                    stale_items,
                    coverage_gap_percentage,
                    performance_gap_percentage,
                    mastery_percentage
                FROM 
                    analytics.vw_student_gap_summary
                WHERE 
                    student_id = $1
                    AND subject_id = $2
            ''', student_id, subject)
            
            # Get top coverage gaps (areas not attempted)
            coverage_gaps = await conn.fetch('''
                SELECT 
                    g.unit_id,
                    u.unit_title,
                    g.skill_id,
                    sk.skill_description,
                    g.subskill_id,
                    ss.subskill_description
                FROM 
                    analytics.vw_curriculum_gaps g
                JOIN
                    analytics.dim_unit u ON g.unit_id = u.unit_id
                JOIN
                    analytics.dim_skill sk ON g.skill_id = sk.skill_id
                JOIN
                    analytics.dim_subskill ss ON g.subskill_id = ss.subskill_id
                WHERE 
                    g.student_id = $1
                    AND g.subject_id = $2
                    AND g.gap_status = 'coverage_gap'
                ORDER BY 
                    u.unit_order, sk.skill_order, ss.subskill_order
                LIMIT 10
            ''', student_id, subject)
            
            # Get top performance gaps (attempted but low scores)
            performance_gaps = await conn.fetch('''
                SELECT 
                    g.unit_id,
                    u.unit_title,
                    g.skill_id,
                    sk.skill_description,
                    g.subskill_id,
                    ss.subskill_description,
                    g.average_score,
                    g.last_attempt_date
                FROM 
                    analytics.vw_curriculum_gaps g
                JOIN
                    analytics.dim_unit u ON g.unit_id = u.unit_id
                JOIN
                    analytics.dim_skill sk ON g.skill_id = sk.skill_id
                JOIN
                    analytics.dim_subskill ss ON g.subskill_id = ss.subskill_id
                WHERE 
                    g.student_id = $1
                    AND g.subject_id = $2
                    AND g.gap_status = 'performance_gap'
                ORDER BY 
                    g.average_score
                LIMIT 10
            ''', student_id, subject)
            
            # Get stale content (not recently practiced)
            stale_content = await conn.fetch('''
                SELECT 
                    g.unit_id,
                    u.unit_title,
                    g.skill_id,
                    sk.skill_description,
                    g.subskill_id,
                    ss.subskill_description,
                    g.average_score,
                    g.last_attempt_date
                FROM 
                    analytics.vw_curriculum_gaps g
                JOIN
                    analytics.dim_unit u ON g.unit_id = u.unit_id
                JOIN
                    analytics.dim_skill sk ON g.skill_id = sk.skill_id
                JOIN
                    analytics.dim_subskill ss ON g.subskill_id = ss.subskill_id
                WHERE 
                    g.student_id = $1
                    AND g.subject_id = $2
                    AND g.recency_status = 'stale'
                    AND g.gap_status = 'no_gap'
                ORDER BY 
                    g.last_attempt_date
                LIMIT 10
            ''', student_id, subject)
            
            # Format results
            return {
                "summary": {
                    "total_items": summary_row["total_curriculum_items"] if summary_row else 0,
                    "coverage_gaps": summary_row["coverage_gaps"] if summary_row else 0,
                    "performance_gaps": summary_row["performance_gaps"] if summary_row else 0,
                    "mastered_items": summary_row["mastered_items"] if summary_row else 0,
                    "stale_items": summary_row["stale_items"] if summary_row else 0,
                    "coverage_gap_percentage": summary_row["coverage_gap_percentage"] if summary_row else 0,
                    "performance_gap_percentage": summary_row["performance_gap_percentage"] if summary_row else 0,
                    "mastery_percentage": summary_row["mastery_percentage"] if summary_row else 0,
                },
                "coverage_gaps": [dict(row) for row in coverage_gaps],
                "performance_gaps": [dict(row) for row in performance_gaps],
                "stale_content": [dict(row) for row in stale_content]
            }
        finally:
            await conn.close()

    async def get_focus_recommendations(self, student_id: int, subject: str, limit: int = 5) -> Dict[str, Any]:
        """Get personalized study recommendations based on gap analysis"""
        conn = await self.get_pg_connection()
        
        try:
            # Get most critical performance gaps (attempted but poor scores)
            performance_recommendations = await conn.fetch('''
                SELECT 
                    g.skill_id,
                    sk.skill_description,
                    g.subskill_id,
                    ss.subskill_description,
                    g.average_score,
                    'performance_gap' as recommendation_type,
                    'This is an area you\'ve attempted but struggled with. Focus on mastering these concepts.' as recommendation_reason
                FROM 
                    analytics.vw_curriculum_gaps g
                JOIN
                    analytics.dim_skill sk ON g.skill_id = sk.skill_id
                JOIN
                    analytics.dim_subskill ss ON g.subskill_id = ss.subskill_id
                WHERE 
                    g.student_id = $1
                    AND g.subject_id = $2
                    AND g.gap_status = 'performance_gap'
                ORDER BY 
                    g.average_score
                LIMIT $3
            ''', student_id, subject, limit)
            
            # Get most critical coverage gaps (based on curriculum order)
            coverage_recommendations = await conn.fetch('''
                SELECT 
                    g.skill_id,
                    sk.skill_description,
                    g.subskill_id,
                    ss.subskill_description,
                    0 as average_score,
                    'coverage_gap' as recommendation_type,
                    'You haven\'t attempted this yet. This is a foundational concept to explore.' as recommendation_reason
                FROM 
                    analytics.vw_curriculum_gaps g
                JOIN
                    analytics.dim_unit u ON g.unit_id = u.unit_id
                JOIN
                    analytics.dim_skill sk ON g.skill_id = sk.skill_id
                JOIN
                    analytics.dim_subskill ss ON g.subskill_id = ss.subskill_id
                WHERE 
                    g.student_id = $1
                    AND g.subject_id = $2
                    AND g.gap_status = 'coverage_gap'
                ORDER BY 
                    u.unit_order, sk.skill_order, ss.subskill_order
                LIMIT $3
            ''', student_id, subject, limit)
            
            # Get stale content that should be refreshed
            refresh_recommendations = await conn.fetch('''
                SELECT 
                    g.skill_id,
                    sk.skill_description,
                    g.subskill_id,
                    ss.subskill_description,
                    g.average_score,
                    'refresh_needed' as recommendation_type,
                    'You haven\'t practiced this in over 30 days. Consider reviewing to maintain mastery.' as recommendation_reason
                FROM 
                    analytics.vw_curriculum_gaps g
                JOIN
                    analytics.dim_skill sk ON g.skill_id = sk.skill_id
                JOIN
                    analytics.dim_subskill ss ON g.subskill_id = ss.subskill_id
                WHERE 
                    g.student_id = $1
                    AND g.subject_id = $2
                    AND g.recency_status = 'stale'
                    AND g.gap_status = 'no_gap'
                ORDER BY 
                    g.last_attempt_date
                LIMIT $3
            ''', student_id, subject, limit)
            
            # Combine all recommendations
            all_recommendations = [dict(row) for row in performance_recommendations]
            all_recommendations.extend([dict(row) for row in coverage_recommendations])
            all_recommendations.extend([dict(row) for row in refresh_recommendations])
            
            return {
                "recommendations": all_recommendations,
                "performance_gaps": [dict(row) for row in performance_recommendations],
                "coverage_gaps": [dict(row) for row in coverage_recommendations],
                "refresh_needed": [dict(row) for row in refresh_recommendations]
            }
        finally:
            await conn.close()

    async def get_curriculum_mastery_map(self, student_id: int, subject: str) -> Dict[str, Any]:
        """Get curriculum mastery map from the analytics warehouse"""
        # Get curriculum structure (still from competency_service)
        curriculum = await self.competency_service.get_curriculum(subject)
        if not curriculum:
            return {"error": f"Curriculum not found for subject: {subject}"}

        conn = await self.get_pg_connection()
        
        try:
            # Get subject-level mastery metrics
            subject_row = await conn.fetchrow('''
                SELECT 
                    m.mastery_score, 
                    m.average_score, 
                    m.completion_percentage, 
                    m.credibility
                FROM 
                    analytics.fact_mastery_metrics m
                WHERE 
                    m.student_id = $1
                    AND m.subject_id = $2
                    AND m.hierarchy_level = 'subject'
                    AND m.calculation_timestamp = (
                        SELECT MAX(calculation_timestamp) 
                        FROM analytics.fact_mastery_metrics 
                        WHERE student_id = $1 AND subject_id = $2 AND hierarchy_level = 'subject'
                    )
            ''', student_id, subject)
            
            if not subject_row:
                # Default values if no data exists
                subject_mastery = 0
                subject_completion = 0
                subject_avg_score = 0
                subject_credibility = 0
            else:
                subject_mastery = subject_row["mastery_score"]
                subject_completion = subject_row["completion_percentage"]
                subject_avg_score = subject_row["average_score"]
                subject_credibility = subject_row["credibility"]
            
            # Initialize mastery map
            mastery_map = []
            
            # Get all unit data in one query for efficiency
            unit_rows = await conn.fetch('''
                SELECT 
                    m.unit_id, 
                    m.mastery_score, 
                    m.average_score, 
                    m.completion_percentage, 
                    m.credibility,
                    m.total_attempts
                FROM 
                    analytics.fact_mastery_metrics m
                WHERE 
                    m.student_id = $1
                    AND m.subject_id = $2
                    AND m.hierarchy_level = 'unit'
                    AND m.calculation_timestamp IN (
                        SELECT MAX(calculation_timestamp) 
                        FROM analytics.fact_mastery_metrics 
                        WHERE student_id = $1 AND subject_id = $2 AND hierarchy_level = 'unit'
                        GROUP BY unit_id
                    )
            ''', student_id, subject)
            
            # Create unit lookup
            unit_metrics = {row["unit_id"]: row for row in unit_rows}
            
            # Get all skill data in one query
            skill_rows = await conn.fetch('''
                SELECT 
                    m.unit_id,
                    m.skill_id, 
                    m.mastery_score, 
                    m.average_score, 
                    m.completion_percentage, 
                    m.credibility,
                    m.total_attempts
                FROM 
                    analytics.fact_mastery_metrics m
                WHERE 
                    m.student_id = $1
                    AND m.subject_id = $2
                    AND m.hierarchy_level = 'skill'
                    AND m.calculation_timestamp IN (
                        SELECT MAX(calculation_timestamp) 
                        FROM analytics.fact_mastery_metrics 
                        WHERE student_id = $1 AND subject_id = $2 AND hierarchy_level = 'skill'
                        GROUP BY skill_id
                    )
            ''', student_id, subject)
            
            # Create skill lookup
            skill_metrics = {row["skill_id"]: row for row in skill_rows}
            
            # When querying for subskill data, add these fields:
            subskill_rows = await conn.fetch('''
                SELECT 
                    m.unit_id,
                    m.skill_id,
                    m.subskill_id, 
                    m.mastery_score, 
                    m.average_score, 
                    m.completion_percentage, 
                    m.credibility,
                    m.total_attempts,
                    m.last_attempt_date,
                    m.gap_status,
                    CASE
                        WHEN m.last_attempt_date IS NULL THEN 'never_attempted'
                        WHEN m.last_attempt_date < NOW() - INTERVAL '30 days' THEN 'stale'
                        ELSE 'recent'
                    END as recency_status
                FROM 
                    analytics.fact_mastery_metrics m
                WHERE 
                    m.student_id = $1
                    AND m.subject_id = $2
                    AND m.hierarchy_level = 'subskill'
                    AND m.calculation_timestamp IN (
                        SELECT MAX(calculation_timestamp) 
                        FROM analytics.fact_mastery_metrics 
                        WHERE student_id = $1 AND subject_id = $2 AND hierarchy_level = 'subskill'
                        GROUP BY subskill_id
                    )
            ''', student_id, subject)
            
            # Create subskill lookup
            subskill_metrics = {row["subskill_id"]: row for row in subskill_rows}
            
            # Build the mastery map using our curriculum structure and the retrieved metrics
            for unit in curriculum:
                unit_id = unit["id"]
                
                # Get metrics or use defaults
                unit_row = unit_metrics.get(unit_id, {})
                
                unit_data = {
                    "id": unit_id,
                    "title": unit["title"],
                    "mastery": unit_row.get("mastery_score", 0),
                    "average_score": unit_row.get("average_score", 0),
                    "completion": unit_row.get("completion_percentage", 0),
                    "credibility": unit_row.get("credibility", 0),
                    "skills": [],
                }
                
                for skill in unit["skills"]:
                    skill_id = skill["id"]
                    
                    # Get metrics or use defaults
                    skill_row = skill_metrics.get(skill_id, {})
                    
                    skill_data = {
                        "id": skill_id,
                        "description": skill["description"],
                        "mastery": skill_row.get("mastery_score", 0),
                        "average_score": skill_row.get("average_score", 0),
                        "completion": skill_row.get("completion_percentage", 0),
                        "credibility": skill_row.get("credibility", 0),
                        "subskills": [],
                    }
                    
                    for subskill in skill["subskills"]:
                        subskill_id = subskill["id"]
                        
                        # Get metrics or use defaults
                        subskill_row = subskill_metrics.get(subskill_id, {})
                        
                        skill_data["subskills"].append({
                            "id": subskill_id,
                            "description": subskill["description"],
                            "mastery": subskill_row.get("mastery_score", 0),
                            "average_score": subskill_row.get("average_score", 0),
                            "completion": subskill_row.get("completion_percentage", 0),
                            "credibility": subskill_row.get("credibility", 0),
                            "attempts": subskill_row.get("total_attempts", 0),
                            "difficulty_range": subskill.get("difficulty_range", {}),
                            "gap_status": subskill_row.get("gap_status", "no_data"),
                            "recency_status": subskill_row.get("recency_status", "never_attempted"),
                            "last_attempt_date": subskill_row.get("last_attempt_date")
                        })
                    
                    unit_data["skills"].append(skill_data)
                
                mastery_map.append(unit_data)
            
            return {
                "student_id": student_id,
                "subject": subject,
                "subject_mastery": subject_mastery,
                "subject_completion": subject_completion,
                "subject_average_score": subject_avg_score,
                "subject_credibility": subject_credibility,
                "mastery_map": mastery_map
            }
            
        finally:
            await conn.close()

    async def get_dashboard_recommendations(self, student_id: int) -> Dict[str, Any]:
        """Get recommended focus areas for display on student dashboard"""
        conn = await self.get_pg_connection()
        
        try:
            # Get top subjects
            subject_rows = await conn.fetch('''
                SELECT 
                    subject_id
                FROM 
                    analytics.fact_mastery_metrics
                WHERE 
                    student_id = $1
                    AND hierarchy_level = 'subject'
                GROUP BY 
                    subject_id
                ORDER BY 
                    MAX(calculation_timestamp) DESC
                LIMIT 3
            ''', student_id)
            
            subjects = [row["subject_id"] for row in subject_rows]
            
            recommendations = []
            
            # For each subject, get top recommendations
            for subject in subjects:
                # Get a mix of performance gaps, coverage gaps, and stale content
                subject_recommendations = await conn.fetch('''
                    WITH performance_gaps AS (
                        SELECT 
                            g.subject_id,
                            s.subject_name,
                            g.skill_id,
                            sk.skill_description,
                            g.subskill_id,
                            ss.subskill_description,
                            g.average_score,
                            'performance_gap' as gap_type,
                            'Focus on improving' as recommendation
                        FROM 
                            analytics.vw_curriculum_gaps g
                        JOIN
                            analytics.dim_subject s ON g.subject_id = s.subject_id
                        JOIN
                            analytics.dim_skill sk ON g.skill_id = sk.skill_id
                        JOIN
                            analytics.dim_subskill ss ON g.subskill_id = ss.subskill_id
                        WHERE 
                            g.student_id = $1
                            AND g.subject_id = $2
                            AND g.gap_status = 'performance_gap'
                        ORDER BY 
                            g.average_score
                        LIMIT 3
                    ),
                    coverage_gaps AS (
                        SELECT 
                            g.subject_id,
                            s.subject_name,
                            g.skill_id,
                            sk.skill_description,
                            g.subskill_id,
                            ss.subskill_description,
                            0 as average_score,
                            'coverage_gap' as gap_type,
                            'Explore new content' as recommendation
                        FROM 
                            analytics.vw_curriculum_gaps g
                        JOIN
                            analytics.dim_subject s ON g.subject_id = s.subject_id
                        JOIN
                            analytics.dim_unit u ON g.unit_id = u.unit_id
                        JOIN
                            analytics.dim_skill sk ON g.skill_id = sk.skill_id
                        JOIN
                            analytics.dim_subskill ss ON g.subskill_id = ss.subskill_id
                        WHERE 
                            g.student_id = $1
                            AND g.subject_id = $2
                            AND g.gap_status = 'coverage_gap'
                        ORDER BY 
                            u.unit_order, sk.skill_order
                        LIMIT 2
                    ),
                    stale_items AS (
                        SELECT 
                            g.subject_id,
                            s.subject_name,
                            g.skill_id,
                            sk.skill_description,
                            g.subskill_id,
                            ss.subskill_description,
                            g.average_score,
                            'stale_content' as gap_type,
                            'Review' as recommendation
                        FROM 
                            analytics.vw_curriculum_gaps g
                        JOIN
                            analytics.dim_subject s ON g.subject_id = s.subject_id
                        JOIN
                            analytics.dim_skill sk ON g.skill_id = sk.skill_id
                        JOIN
                            analytics.dim_subskill ss ON g.subskill_id = ss.subskill_id
                        WHERE 
                            g.student_id = $1
                            AND g.subject_id = $2
                            AND g.recency_status = 'stale'
                            AND g.gap_status = 'no_gap'
                        ORDER BY 
                            g.last_attempt_date
                        LIMIT 1
                    )
                    SELECT * FROM performance_gaps
                    UNION ALL
                    SELECT * FROM coverage_gaps
                    UNION ALL
                    SELECT * FROM stale_items
                    ORDER BY gap_type, average_score
                ''', student_id, subject)
                
                for row in subject_recommendations:
                    recommendations.append({
                        "subject": row["subject_id"],
                        "subject_name": row["subject_name"],
                        "skill_id": row["skill_id"],
                        "skill_description": row["skill_description"],
                        "subskill_id": row["subskill_id"],
                        "subskill_description": row["subskill_description"],
                        "gap_type": row["gap_type"],
                        "score": row["average_score"],
                        "recommendation": row["recommendation"]
                    })
            
            return {
                "recommended_focus_areas": recommendations
            }
        finally:
            await conn.close()

    async def get_subject_mastery_breakdown(self, student_id: int, subject: str) -> Dict[str, Any]:
        """
        Get detailed mastery breakdown for a subject, including overall metrics and unit-level summaries.
        
        Returns data compatible with the MasteryBreakdownData interface:
        {
            student_id: number;
            subject: string;
            overall_completion: number;
            overall_score: number;
            overall_mastery: number;
            mastery_level: string;
            units_summary: Array<{
                id: string;
                title: string;
                completion: number;
                average_score: number;
                mastery: number;
                mastery_level: string;
            }>;
        }
        """
        conn = await self.get_pg_connection()
        
        try:
            # Get subject-level mastery metrics
            subject_row = await conn.fetchrow('''
                SELECT 
                    m.mastery_score,
                    m.average_score, 
                    m.completion_percentage, 
                    m.credibility,
                    ml.mastery_level
                FROM 
                    analytics.fact_mastery_metrics m
                JOIN
                    analytics.dim_mastery_level ml
                    ON m.mastery_level_key = ml.mastery_level_key
                WHERE 
                    m.student_id = $1
                    AND m.subject_id = $2
                    AND m.hierarchy_level = 'subject'
                    AND m.calculation_timestamp = (
                        SELECT MAX(calculation_timestamp) 
                        FROM analytics.fact_mastery_metrics 
                        WHERE student_id = $1 AND subject_id = $2 AND hierarchy_level = 'subject'
                    )
            ''', student_id, subject)
            
            if not subject_row:
                # Default values if no data exists
                subject_mastery = 0
                subject_avg_score = 0
                subject_completion = 0
                mastery_level = "Beginning"
            else:
                subject_mastery = subject_row["mastery_score"]
                subject_avg_score = subject_row["average_score"]
                subject_completion = subject_row["completion_percentage"]
                mastery_level = subject_row["mastery_level"]
            
            # Get unit-level summaries
            unit_rows = await conn.fetch('''
                SELECT 
                    m.unit_id,
                    u.unit_title, 
                    m.mastery_score,
                    m.average_score, 
                    m.completion_percentage,
                    ml.mastery_level
                FROM 
                    analytics.fact_mastery_metrics m
                JOIN
                    analytics.dim_unit u
                    ON m.unit_id = u.unit_id
                JOIN
                    analytics.dim_mastery_level ml
                    ON m.mastery_level_key = ml.mastery_level_key
                WHERE 
                    m.student_id = $1
                    AND m.subject_id = $2
                    AND m.hierarchy_level = 'unit'
                    AND m.calculation_timestamp IN (
                        SELECT MAX(calculation_timestamp) 
                        FROM analytics.fact_mastery_metrics 
                        WHERE student_id = $1 AND subject_id = $2 AND hierarchy_level = 'unit'
                        GROUP BY unit_id
                    )
                ORDER BY
                    u.unit_order
            ''', student_id, subject)
            
            # Format unit summaries
            units_summary = []
            for row in unit_rows:
                units_summary.append({
                    "id": row["unit_id"],
                    "title": row["unit_title"],
                    "completion": row["completion_percentage"],
                    "average_score": row["average_score"],
                    "mastery": row["mastery_score"],
                    "mastery_level": row["mastery_level"]
                })
            
            # Return formatted data matching the interface
            return {
                "student_id": student_id,
                "subject": subject,
                "overall_completion": subject_completion,
                "overall_score": subject_avg_score,
                "overall_mastery": subject_mastery,
                "mastery_level": mastery_level,
                "units_summary": units_summary
            }
            
        finally:
            await conn.close()

    async def get_student_progress(self, student_id: int, days: int = 7, subject: str = "Mathematics") -> Dict[str, Any]:
        """Get comprehensive progress data for student analytics dashboard"""
        # Call the individual methods and combine the results
        daily_progress = await self.get_daily_progress(student_id, days)
        skill_competencies = await self.get_skill_competencies(student_id, subject)
        detailed_analytics = await self.get_detailed_analytics(student_id, subject)
        
        return {
            "dailyProgress": daily_progress,
            "skillCompetencies": skill_competencies,
            "detailedAnalytics": detailed_analytics
        }
    
    async def get_dashboard_summary(self, student_id: int) -> Dict[str, Any]:
        """Get comprehensive dashboard summary with key metrics"""
        conn = await self.get_pg_connection()
        
        try:
            # Get overall mastery across subjects
            overall_row = await conn.fetchrow('''
                SELECT 
                    AVG(m.mastery_score) as overall_score,
                    COUNT(DISTINCT m.subject_id) as total_subjects
                FROM 
                    analytics.fact_mastery_metrics m
                WHERE 
                    m.student_id = $1
                    AND m.hierarchy_level = 'subject'
                    AND m.calculation_timestamp IN (
                        SELECT MAX(calculation_timestamp) 
                        FROM analytics.fact_mastery_metrics 
                        WHERE student_id = $1 AND hierarchy_level = 'subject'
                        GROUP BY subject_id
                    )
            ''', student_id)
            
            # Get subjects data
            subject_rows = await conn.fetch('''
                SELECT 
                    m.subject_id,
                    s.subject_name,
                    m.mastery_score,
                    m.average_score,
                    m.completion_percentage,
                    m.credibility,
                    m.total_attempts,
                    ml.mastery_level
                FROM 
                    analytics.fact_mastery_metrics m
                JOIN
                    analytics.dim_subject s
                    ON m.subject_id = s.subject_id
                JOIN
                    analytics.dim_mastery_level ml
                    ON m.mastery_level_key = ml.mastery_level_key
                WHERE 
                    m.student_id = $1
                    AND m.hierarchy_level = 'subject'
                    AND m.calculation_timestamp IN (
                        SELECT MAX(calculation_timestamp) 
                        FROM analytics.fact_mastery_metrics 
                        WHERE student_id = $1 AND hierarchy_level = 'subject'
                        GROUP BY subject_id
                    )
                ORDER BY
                    m.mastery_score DESC
            ''', student_id)
            
            # Get recent activity
            recent_row = await conn.fetchrow('''
                SELECT 
                    COUNT(*) as recent_attempts,
                    COUNT(DISTINCT dd.date) as active_days
                FROM 
                    analytics.fact_attempts fa
                JOIN
                    analytics.dim_date dd
                    ON fa.date_key = dd.date_key
                WHERE 
                    fa.student_id = $1
                    AND dd.date >= CURRENT_DATE - INTERVAL '7 days'
            ''', student_id)
            
            # Format subjects data
            subjects_data = []
            for row in subject_rows:
                subjects_data.append({
                    "subject": row["subject_id"],
                    "name": row["subject_name"],
                    "current_score": row["mastery_score"],
                    "credibility": row["credibility"] * 100,  # Convert to percentage
                    "total_attempts": row["total_attempts"],
                    "completion": row["completion_percentage"],
                    "mastery_level": row["mastery_level"]
                })
            
            # Get daily stats for streak calculation
            daily_stats = await self.get_daily_progress(student_id, days=7)
            
            # Calculate streak
            streak = 0
            for i, day in enumerate(daily_stats):
                if day["problems"] > 0:
                    if i == 0 or daily_stats[i-1]["problems"] > 0:
                        streak += 1
                    else:
                        break
                else:
                    break
            
            # Format overall summary
            overall_score = overall_row["overall_score"] if overall_row and overall_row["overall_score"] is not None else 0
            
            # Determine mastery level
            if overall_score >= 80:
                mastery_level = "Advanced"
            elif overall_score >= 60:
                mastery_level = "Proficient"
            elif overall_score >= 40:
                mastery_level = "Developing"
            else:
                mastery_level = "Beginning"
            
            return {
                "student_id": student_id,
                "overall_mastery": {
                    "score": overall_score,
                    "level": mastery_level
                },
                "activity": {
                    "recent_attempts": recent_row["recent_attempts"] if recent_row else 0,
                    "active_days": recent_row["active_days"] if recent_row else 0,
                    "streak": streak
                },
                "subjects_overview": {
                    "count": overall_row["total_subjects"] if overall_row else 0,
                    "top_subject": subjects_data[0]["subject"] if subjects_data else None,
                    "top_subject_score": subjects_data[0]["current_score"] if subjects_data else 0,
                    "subjects": subjects_data
                },
                "recent_progress": daily_stats
            }
            
        finally:
            await conn.close()

    async def get_subject_performance_details(self, student_id: int, subject: str, time_period: str = "all") -> Dict[str, Any]:
        """Get detailed subject performance analytics for dashboards"""
        conn = await self.get_pg_connection()
        
        try:
            # Define time filter based on time_period
            time_filter = ""
            time_params = [student_id, subject]
            
            if time_period != "all":
                if time_period == "week":
                    time_filter = "AND dd.date >= CURRENT_DATE - INTERVAL '7 days'"
                elif time_period == "month":
                    time_filter = "AND dd.date >= CURRENT_DATE - INTERVAL '30 days'"
                elif time_period == "quarter":
                    time_filter = "AND dd.date >= CURRENT_DATE - INTERVAL '90 days'"
                elif time_period == "year":
                    time_filter = "AND dd.date >= CURRENT_DATE - INTERVAL '365 days'"
            
            # Get subject stats
            subject_row = await conn.fetchrow('''
                SELECT 
                    m.average_score,
                    m.credibility,
                    m.total_attempts,
                    m.mastery_score,
                    m.completion_percentage,
                    ml.mastery_level
                FROM 
                    analytics.fact_mastery_metrics m
                JOIN
                    analytics.dim_mastery_level ml
                    ON m.mastery_level_key = ml.mastery_level_key
                WHERE 
                    m.student_id = $1
                    AND m.subject_id = $2
                    AND m.hierarchy_level = 'subject'
                    AND m.calculation_timestamp = (
                        SELECT MAX(calculation_timestamp) 
                        FROM analytics.fact_mastery_metrics 
                        WHERE student_id = $1 AND subject_id = $2 AND hierarchy_level = 'subject'
                    )
            ''', *time_params)
            
            # Get recent attempts within time period
            attempts_query = f'''
                SELECT 
                    COUNT(*) as recent_attempts
                FROM 
                    analytics.fact_attempts fa
                JOIN
                    analytics.dim_date dd
                    ON fa.date_key = dd.date_key
                WHERE 
                    fa.student_id = $1
                    AND fa.subject_id = $2
                    {time_filter}
            '''
            
            attempts_row = await conn.fetchrow(attempts_query, *time_params)
            
            # Get skill analytics
            skill_analytics_query = f'''
                WITH skill_data AS (
                    SELECT 
                        fa.skill_id,
                        COUNT(*) as attempts,
                        AVG(fa.attempt_score) as average_score,
                        MAX(fa.attempt_timestamp) as last_attempt,
                        (SELECT attempt_score FROM analytics.fact_attempts 
                        WHERE student_id = $1 AND subject_id = $2 AND skill_id = fa.skill_id
                        ORDER BY attempt_timestamp DESC LIMIT 1) as recent_score
                    FROM 
                        analytics.fact_attempts fa
                    JOIN
                        analytics.dim_date dd
                        ON fa.date_key = dd.date_key
                    WHERE 
                        fa.student_id = $1
                        AND fa.subject_id = $2
                        {time_filter}
                    GROUP BY
                        fa.skill_id
                ),
                first_half AS (
                    SELECT 
                        fa.skill_id,
                        AVG(fa.attempt_score) as avg_score
                    FROM 
                        analytics.fact_attempts fa
                    JOIN
                        analytics.dim_date dd
                        ON fa.date_key = dd.date_key
                    WHERE 
                        fa.student_id = $1
                        AND fa.subject_id = $2
                        {time_filter}
                        AND fa.attempt_timestamp < (
                            SELECT MAX(attempt_timestamp) FROM analytics.fact_attempts 
                            WHERE student_id = $1 AND subject_id = $2
                        ) - (
                            SELECT (MAX(attempt_timestamp) - MIN(attempt_timestamp))/2 
                            FROM analytics.fact_attempts 
                            WHERE student_id = $1 AND subject_id = $2
                        )
                    GROUP BY
                        fa.skill_id
                ),
                second_half AS (
                    SELECT 
                        fa.skill_id,
                        AVG(fa.attempt_score) as avg_score
                    FROM 
                        analytics.fact_attempts fa
                    JOIN
                        analytics.dim_date dd
                        ON fa.date_key = dd.date_key
                    WHERE 
                        fa.student_id = $1
                        AND fa.subject_id = $2
                        {time_filter}
                        AND fa.attempt_timestamp >= (
                            SELECT MAX(attempt_timestamp) FROM analytics.fact_attempts 
                            WHERE student_id = $1 AND subject_id = $2
                        ) - (
                            SELECT (MAX(attempt_timestamp) - MIN(attempt_timestamp))/2 
                            FROM analytics.fact_attempts 
                            WHERE student_id = $1 AND subject_id = $2
                        )
                    GROUP BY
                        fa.skill_id
                )
                SELECT 
                    sd.skill_id,
                    sk.skill_description,
                    sd.attempts,
                    sd.average_score,
                    COALESCE(s.avg_score, 0) - COALESCE(f.avg_score, 0) as trend_value,
                    CASE 
                        WHEN COALESCE(s.avg_score, 0) - COALESCE(f.avg_score, 0) > 0.5 THEN 'improving'
                        WHEN COALESCE(s.avg_score, 0) - COALESCE(f.avg_score, 0) < -0.5 THEN 'declining'
                        ELSE 'stable'
                    END as trend,
                    sd.last_attempt,
                    sd.recent_score
                FROM 
                    skill_data sd
                JOIN
                    analytics.dim_skill sk
                    ON sd.skill_id = sk.skill_id
                LEFT JOIN
                    first_half f
                    ON sd.skill_id = f.skill_id
                LEFT JOIN
                    second_half s
                    ON sd.skill_id = s.skill_id
            '''
            
            skill_analytics_rows = await conn.fetch(skill_analytics_query, *time_params)
            
            
            # Get activity patterns
            activity_patterns_query = f'''
                SELECT 
                    dd.day_of_week,
                    dd.weekday_name,
                    COUNT(*) as activity_count
                FROM 
                    analytics.fact_attempts fa
                JOIN
                    analytics.dim_date dd
                    ON fa.date_key = dd.date_key
                WHERE 
                    fa.student_id = $1
                    AND fa.subject_id = $2
                    {time_filter}
                GROUP BY
                    dd.day_of_week, dd.weekday_name
                ORDER BY
                    dd.day_of_week
            '''
            
            weekday_rows = await conn.fetch(activity_patterns_query, *time_params)
            
            hour_query = f'''
                SELECT 
                    EXTRACT(HOUR FROM fa.attempt_timestamp) as hour,
                    COUNT(*) as activity_count
                FROM 
                    analytics.fact_attempts fa
                JOIN
                    analytics.dim_date dd
                    ON fa.date_key = dd.date_key
                WHERE 
                    fa.student_id = $1
                    AND fa.subject_id = $2
                    {time_filter}
                GROUP BY
                    EXTRACT(HOUR FROM fa.attempt_timestamp)
                ORDER BY
                    hour
            '''
            
            hour_rows = await conn.fetch(hour_query, *time_params)
            
            active_days_query = f'''
                SELECT 
                    COUNT(DISTINCT dd.date) as active_days
                FROM 
                    analytics.fact_attempts fa
                JOIN
                    analytics.dim_date dd
                    ON fa.date_key = dd.date_key
                WHERE 
                    fa.student_id = $1
                    AND fa.subject_id = $2
                    {time_filter}
            '''
            
            active_days_row = await conn.fetchrow(active_days_query, *time_params)
            
            # Get score distribution
            score_query = f'''
                SELECT 
                    CASE
                        WHEN fa.attempt_score BETWEEN 9 AND 10 THEN '9-10'
                        WHEN fa.attempt_score BETWEEN 8 AND 9 THEN '8-9'
                        WHEN fa.attempt_score BETWEEN 7 AND 8 THEN '7-8'
                        WHEN fa.attempt_score BETWEEN 6 AND 7 THEN '6-7'
                        WHEN fa.attempt_score BETWEEN 5 AND 6 THEN '5-6'
                        WHEN fa.attempt_score BETWEEN 4 AND 5 THEN '4-5'
                        WHEN fa.attempt_score BETWEEN 3 AND 4 THEN '3-4'
                        WHEN fa.attempt_score BETWEEN 2 AND 3 THEN '2-3'
                        WHEN fa.attempt_score BETWEEN 1 AND 2 THEN '1-2'
                        ELSE '0-1'
                    END as score_range,
                    COUNT(*) as count
                FROM 
                    analytics.fact_attempts fa
                JOIN
                    analytics.dim_date dd
                    ON fa.date_key = dd.date_key
                WHERE 
                    fa.student_id = $1
                    AND fa.subject_id = $2
                    {time_filter}
                GROUP BY
                    score_range
                ORDER BY
                    score_range DESC
            '''
            
            score_rows = await conn.fetch(score_query, *time_params)
            
            # Get mastery map (simplified version)
            mastery_map_query = '''
                SELECT 
                    m.unit_id,
                    u.unit_title,
                    m.mastery_score,
                    m.completion_percentage,
                    m.average_score
                FROM 
                    analytics.fact_mastery_metrics m
                JOIN
                    analytics.dim_unit u
                    ON m.unit_id = u.unit_id
                WHERE 
                    m.student_id = $1
                    AND m.subject_id = $2
                    AND m.hierarchy_level = 'unit'
                    AND m.calculation_timestamp IN (
                        SELECT MAX(calculation_timestamp) 
                        FROM analytics.fact_mastery_metrics 
                        WHERE student_id = $1 AND subject_id = $2 AND hierarchy_level = 'unit'
                        GROUP BY unit_id
                    )
            '''
            
            mastery_map_rows = await conn.fetch(mastery_map_query, student_id, subject)
            
            # Format results
            skill_analytics = []
            for row in skill_analytics_rows:
                skill_analytics.append({
                    "skill_id": row["skill_id"],
                    "description": row["skill_description"],
                    "attempts": row["attempts"],
                    "average_score": row["average_score"],
                    "trend": row["trend"],
                    "trend_value": row["trend_value"],
                    "last_attempt": row["last_attempt"].isoformat(),
                    "recent_score": row["recent_score"]
                })
            
            weekday_distribution = []
            for row in weekday_rows:
                weekday_distribution.append([row["weekday_name"], row["activity_count"]])
            
            hour_distribution = []
            for row in hour_rows:
                hour_distribution.append([int(row["hour"]), row["activity_count"]])
            
            # Find peak day and hour
            peak_day = max(weekday_rows, key=lambda x: x["activity_count"])["weekday_name"] if weekday_rows else "None"
            peak_hour = int(max(hour_rows, key=lambda x: x["activity_count"])["hour"]) if hour_rows else 0
            
            activity_patterns = {
                "weekday_distribution": weekday_distribution,
                "hour_distribution": hour_distribution,
                "peak_day": peak_day,
                "peak_hour": peak_hour,
                "total_active_days": active_days_row["active_days"] if active_days_row else 0
            }
            
            score_buckets = {
                "9-10": 0, "8-9": 0, "7-8": 0, "6-7": 0, "5-6": 0,
                "4-5": 0, "3-4": 0, "2-3": 0, "1-2": 0, "0-1": 0
            }
            
            for row in score_rows:
                score_buckets[row["score_range"]] = row["count"]
            
            mastery_map = []
            for row in mastery_map_rows:
                mastery_map.append({
                    "id": row["unit_id"],
                    "title": row["unit_title"],
                    "mastery": row["mastery_score"],
                    "completion": row["completion_percentage"],
                    "average_score": row["average_score"]
                })
            
            return {
                "student_id": student_id,
                "subject": subject,
                "time_period": time_period,
                "subject_stats": {
                    "average_score": subject_row["average_score"] if subject_row else 0,
                    "credibility": subject_row["credibility"] * 100 if subject_row else 0,
                    "total_attempts": subject_row["total_attempts"] if subject_row else 0,
                    "recent_attempts": attempts_row["recent_attempts"] if attempts_row else 0,
                    "mastery": subject_row["mastery_score"] if subject_row else 0,
                    "completion": subject_row["completion_percentage"] if subject_row else 0,
                    "mastery_level": subject_row["mastery_level"] if subject_row else "Beginning"
                },
                "skill_analytics": skill_analytics,
                "activity_patterns": activity_patterns,
                "score_distribution": score_buckets,
                "mastery_map": mastery_map,
            }
            
        finally:
            await conn.close()

    async def calculate_true_mastery(
        self,
        student_id: int,
        subject: str,
        unit_id: Optional[str] = None,
        skill_id: Optional[str] = None,
        subskill_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Calculate true mastery based on curriculum coverage and performance.
        Mastery = (avg score in category 1 * cat_1 + avg score cat 2 * cat_2 +... + avg score cat n * cat_n)/(sum of categories)
        
        This method calculates mastery at different levels of the curriculum hierarchy based on parameters provided.
        """
        try:
            # Get curriculum structure for context
            curriculum = await self.competency_service.get_curriculum(subject)
            if not curriculum:
                return {
                    "error": f"Curriculum not found for subject: {subject}"
                }
            
            # Determine the scope based on parameters
            if subskill_id:
                # Subskill level calculation
                level = "subskill"
                items = [subskill_id]
                parent_id = skill_id
            elif skill_id:
                # Skill level calculation
                level = "skill"
                # Get all subskills for this skill
                items = []
                for unit in curriculum:
                    for skill in unit["skills"]:
                        if skill["id"] == skill_id:
                            items = [subskill["id"] for subskill in skill["subskills"]]
                            break
                parent_id = unit_id
            elif unit_id:
                # Unit level calculation
                level = "unit"
                # Get all skills in this unit
                items = []
                for unit in curriculum:
                    if unit["id"] == unit_id:
                        for skill in unit["skills"]:
                            items.append(skill["id"])
                        break
                parent_id = None
            else:
                # Subject level calculation
                level = "subject"
                # Get all units
                items = [unit["id"] for unit in curriculum]
                parent_id = None
                
            # Calculate mastery based on the level
            total_items = len(items)
            if total_items == 0:
                return {
                    "student_id": student_id,
                    "subject": subject,
                    "level": level,
                    "mastery_score": 0,
                    "average_score": 0,
                    "completion_percentage": 0,
                    "credibility": 0,
                    "total_attempts": 0
                }
                
            # Set credibility standard based on level
            if level == "subskill":
                credibility_standard = self.full_credibility_standard_subskill
            elif level == "skill":
                credibility_standard = self.full_credibility_standard_skill
            elif level == "unit":
                credibility_standard = self.full_credibility_standard_unit
            else:  # subject
                credibility_standard = self.full_credibility_standard_subject
                
            # Get competencies for all items
            competencies = []
            total_attempts = 0
            covered_items = 0
            
            for item_id in items:
                if level == "subskill":
                    comp = await self.competency_service.get_competency(student_id, subject, skill_id, item_id)
                elif level == "skill":
                    comp = await self.competency_service.get_competency(student_id, subject, item_id, "")
                elif level == "unit":
                    # For units, aggregate all skills within
                    unit_competencies = []
                    for unit in curriculum:
                        if unit["id"] == unit_id:
                            for skill in unit["skills"]:
                                skill_comp = await self.competency_service.get_competency(student_id, subject, skill["id"], "")
                                unit_competencies.append(skill_comp)
                    
                    # Aggregate unit competency
                    comp = {
                        "current_score": sum(c.get("current_score", 0) for c in unit_competencies) / len(unit_competencies) if unit_competencies else 0,
                        "total_attempts": sum(c.get("total_attempts", 0) for c in unit_competencies),
                        "credibility": min(1.0, sum(c.get("total_attempts", 0) for c in unit_competencies) / credibility_standard)
                    }
                else:  # subject
                    # Get subject level competency
                    comp = await self.competency_service.get_subject_competency(student_id, subject)
                
                competencies.append(comp)
                total_attempts += comp.get("total_attempts", 0)
                if comp.get("total_attempts", 0) > 0:
                    covered_items += 1
                    
            # Calculate averages and mastery
            if covered_items > 0:
                # Average score across covered items
                average_score = sum(comp.get("current_score", 0) for comp in competencies if comp.get("total_attempts", 0) > 0) / covered_items
                
                # Mastery combines coverage with performance
                # Sum of (score * weight) for each category, divided by total categories
                weighted_score_sum = sum(comp.get("current_score", 0) * (1 if comp.get("total_attempts", 0) > 0 else 0) for comp in competencies)
                mastery_score = weighted_score_sum / total_items
                
                # Completion percentage
                completion_percentage = (covered_items / total_items) * 100
                
                # Credibility
                credibility = min(1.0, total_attempts / credibility_standard)
            else:
                average_score = 0
                mastery_score = 0
                completion_percentage = 0
                credibility = 0
                
            return {
                "student_id": student_id,
                "subject": subject,
                "level": level,
                "level_id": skill_id if level == "subskill" else unit_id if level == "skill" else None,
                "mastery_score": mastery_score * 10,  # Convert to percentage scale
                "average_score": average_score * 10,  # Convert to percentage scale
                "completion_percentage": completion_percentage,
                "credibility": credibility * 100,  # Convert to percentage
                "total_attempts": total_attempts,
                "covered_items": covered_items,
                "total_items": total_items
            }
        except Exception as e:
            print(f"Error calculating mastery: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "error": str(e),
                "student_id": student_id,
                "subject": subject
            }

    async def get_curriculum_coverage_analysis(self, student_id: int, subject: str) -> Dict[str, Any]:
        """Get detailed analysis of curriculum coverage"""
        conn = await self.get_pg_connection()
        
        try:
            # Get subject level metrics
            subject_row = await conn.fetchrow('''
                SELECT 
                    m.total_items,
                    m.covered_items,
                    m.completion_percentage
                FROM 
                    analytics.fact_mastery_metrics m
                WHERE 
                    m.student_id = $1
                    AND m.subject_id = $2
                    AND m.hierarchy_level = 'subject'
                    AND m.calculation_timestamp = (
                        SELECT MAX(calculation_timestamp) 
                        FROM analytics.fact_mastery_metrics 
                        WHERE student_id = $1 AND subject_id = $2 AND hierarchy_level = 'subject'
                    )
            ''', student_id, subject)
            
            # Get unit coverage
            unit_rows = await conn.fetch('''
                SELECT 
                    m.unit_id,
                    u.unit_title,
                    m.total_items as total_skills,
                    m.covered_items as covered_skills,
                    (SELECT COUNT(*) FROM analytics.dim_subskill ss 
                    JOIN analytics.dim_skill sk ON ss.skill_id = sk.skill_id
                    WHERE sk.unit_id = m.unit_id) as total_subskills,
                    (SELECT COUNT(DISTINCT fa.subskill_id) FROM analytics.fact_attempts fa
                    JOIN analytics.dim_skill sk ON fa.skill_id = sk.skill_id
                    WHERE fa.student_id = $1 AND fa.subject_id = $2 AND sk.unit_id = m.unit_id) as covered_subskills,
                    m.completion_percentage as skills_coverage,
                    m.completion_percentage as subskills_coverage
                FROM 
                    analytics.fact_mastery_metrics m
                JOIN
                    analytics.dim_unit u
                    ON m.unit_id = u.unit_id
                WHERE 
                    m.student_id = $1
                    AND m.subject_id = $2
                    AND m.hierarchy_level = 'unit'
                    AND m.calculation_timestamp IN (
                        SELECT MAX(calculation_timestamp) 
                        FROM analytics.fact_mastery_metrics 
                        WHERE student_id = $1 AND subject_id = $2 AND hierarchy_level = 'unit'
                        GROUP BY unit_id
                    )
                ORDER BY 
                    m.completion_percentage DESC
            ''', student_id, subject)
            
            # Format unit coverage
            unit_coverage = []
            for row in unit_rows:
                # For the subskills coverage, calculate it if we have the data
                subskills_coverage = 0
                if row["total_subskills"] > 0:
                    subskills_coverage = (row["covered_subskills"] / row["total_subskills"]) * 100
                
                unit_coverage.append({
                    "id": row["unit_id"],
                    "title": row["unit_title"],
                    "total_skills": row["total_skills"],
                    "covered_skills": row["covered_skills"],
                    "skills_coverage": row["skills_coverage"],
                    "total_subskills": row["total_subskills"],
                    "covered_subskills": row["covered_subskills"],
                    "subskills_coverage": subskills_coverage
                })
            
            # Get counts directly from curriculum dimensions
            total_skills = await conn.fetchval('''
                SELECT COUNT(*) FROM analytics.dim_skill sk
                JOIN analytics.dim_unit u ON sk.unit_id = u.unit_id
                WHERE u.subject_id = $1
            ''', subject)
            
            total_subskills = await conn.fetchval('''
                SELECT COUNT(*) FROM analytics.dim_subskill ss
                JOIN analytics.dim_skill sk ON ss.skill_id = sk.skill_id
                JOIN analytics.dim_unit u ON sk.unit_id = u.unit_id
                WHERE u.subject_id = $1
            ''', subject)
            
            # Get covered counts from attempts
            covered_skills = await conn.fetchval('''
                SELECT COUNT(DISTINCT fa.skill_id) FROM analytics.fact_attempts fa
                WHERE fa.student_id = $1 AND fa.subject_id = $2
            ''', student_id, subject)
            
            covered_subskills = await conn.fetchval('''
                SELECT COUNT(DISTINCT fa.subskill_id) FROM analytics.fact_attempts fa
                WHERE fa.student_id = $1 AND fa.subject_id = $2 AND fa.subskill_id IS NOT NULL
            ''', student_id, subject)
            
            # Calculate coverage percentages
            skills_coverage = (covered_skills / total_skills) * 100 if total_skills > 0 else 0
            subskills_coverage = (covered_subskills / total_subskills) * 100 if total_subskills > 0 else 0
            
            return {
                "student_id": student_id,
                "subject": subject,
                "total_units": len(unit_rows),
                "total_skills": total_skills,
                "total_subskills": total_subskills,
                "covered_skills": covered_skills,
                "covered_subskills": covered_subskills,
                "skills_coverage": skills_coverage,
                "subskills_coverage": subskills_coverage,
                "unit_coverage": unit_coverage
            }
            
        finally:
            await conn.close()