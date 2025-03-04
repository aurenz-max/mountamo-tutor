from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import math
from pathlib import Path
import pandas as pd
import random

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

    async def get_student_overview(
        self,
        student_id: int
    ) -> Dict[str, Any]:
        """Get overview of all competencies for a student"""
        # Check if cosmos_db is available
        if not self.cosmos_db:
            print("[ERROR] CosmosDB service not initialized")
            return {
                "student_id": student_id,
                "subjects": {}
            }
            
        # Use in-memory storage for overview until migrated to cosmos_db
        subjects = {}
        
        # Group competencies by subject
        for key, comp in self._competencies.items():
            if key.startswith(f"{student_id}_"):
                _, subject, skill_id, subskill_id = key.split("_")
                
                if subject not in subjects:
                    subjects[subject] = []
                    
                subjects[subject].append({
                    "skill_id": skill_id,
                    "subskill_id": subskill_id,
                    "score": comp["current_score"],
                    "attempts": len(comp["attempts"]),
                    "last_updated": comp["last_updated"]
                })
        
        # Calculate subject-level statistics
        overview = {
            "student_id": student_id,
            "subjects": {}
        }
        
        for subject, competencies in subjects.items():
            subject_score = await self.get_subject_competency(student_id, subject)
            overview["subjects"][subject] = {
                "current_score": subject_score["current_score"],
                "credibility": subject_score["credibility"],
                "total_attempts": subject_score["total_attempts"],
                "skills": competencies
            }
            
        return overview
    
    async def get_subskill_types(self, subject: str) -> List[str]:
        """Get list of all problem types (subskills) available"""
        curriculum = await self.get_curriculum(subject)
        return [
            subskill["id"]
            for unit in curriculum
            for skill in unit["skills"]
            for subskill in skill["subskills"]
        ]

class AnalyticsExtension:
    def __init__(self, competency_service):
        self.competency_service = competency_service
        self.cosmos_db = None  # Will be set by dependency injection
        
    async def get_daily_progress(self, student_id: int, days: int = 7) -> List[Dict[str, Any]]:
        """Get daily progress statistics for a student"""
        # Check if cosmos_db is available
        if not self.cosmos_db:
            print("[ERROR] CosmosDB service not initialized")
            return []
            
        now = datetime.utcnow()
        start_date = (now - timedelta(days=days)).isoformat()
        
        query = """
        SELECT c.timestamp, c.score, c.subject
        FROM c 
        WHERE c.student_id = @student_id 
        AND c.timestamp >= @start_date
        """
        
        attempts = list(self.cosmos_db.attempts.query_items(
            query=query,
            parameters=[
                {"name": "@student_id", "value": student_id},
                {"name": "@start_date", "value": start_date}
            ],
            enable_cross_partition_query=True
        ))

        daily_stats = []
        for day_offset in range(days - 1, -1, -1):
            target_date = now - timedelta(days=day_offset)
            date_key = target_date.strftime('%Y-%m-%d')
            
            day_attempts = [a for a in attempts if a['timestamp'].startswith(date_key)]
            
            if day_attempts:
                avg_score = sum(a['score'] for a in day_attempts) / len(day_attempts)
                time_spent = len(day_attempts) * 5  # Assuming 5 minutes per attempt
            else:
                avg_score = 0
                time_spent = 0

            daily_stats.append({
                "day": target_date.strftime('%a'),
                "date": date_key,
                "competency": avg_score * 10,  # Convert to percentage
                "timeSpent": time_spent,
                "problems": len(day_attempts)
            })
            
        return daily_stats
    
    async def get_skill_competencies(self, student_id: int, subject: str) -> List[Dict[str, Any]]:
        """Get competencies for all skills in a subject"""
        # Check if cosmos_db is available
        if not self.cosmos_db:
            print("[ERROR] CosmosDB service not initialized")
            return []
            
        query = """
        SELECT c.skill_id, c.current_score, c.credibility
        FROM c
        WHERE c.student_id = @student_id
        AND c.subject = @subject
        """
        
        competencies = list(self.cosmos_db.competencies.query_items(
            query=query,
            parameters=[
                {"name": "@student_id", "value": student_id},
                {"name": "@subject", "value": subject}
            ],
            enable_cross_partition_query=True
        ))
        
        return [{
            "skill": comp["skill_id"],
            "score": comp["current_score"] * 10  # Convert to percentage
        } for comp in competencies]
    
    async def get_detailed_analytics(self, student_id: int, subject: str) -> Dict[str, Any]:
        """Get detailed analytics for a student in a subject"""
        # Check if cosmos_db is available
        if not self.cosmos_db:
            print("[ERROR] CosmosDB service not initialized")
            return {
                "currentStats": {
                    "totalProblems": 0,
                    "averageScore": 0,
                    "credibility": 0,
                    "subSkills": {}
                },
                "progressionData": []
            }
            
        # Get all competencies for this subject
        query = """
        SELECT c.subskill_id, c.current_score
        FROM c
        WHERE c.student_id = @student_id
        AND c.subject = @subject
        """
        
        competencies = list(self.cosmos_db.competencies.query_items(
            query=query,
            parameters=[
                {"name": "@student_id", "value": student_id},
                {"name": "@subject", "value": subject}
            ],
            enable_cross_partition_query=True
        ))

        # Get all attempts
        query_attempts = """
        SELECT c.subskill_id, c.score, c.timestamp
        FROM c
        WHERE c.student_id = @student_id
        AND c.subject = @subject
        """
        
        attempts = list(self.cosmos_db.attempts.query_items(
            query=query_attempts,
            parameters=[
                {"name": "@student_id", "value": student_id},
                {"name": "@subject", "value": subject}
            ],
            enable_cross_partition_query=True
        ))

        # Calculate statistics
        subskill_stats = {}
        for comp in competencies:
            subskill_id = comp["subskill_id"]
            subskill_attempts = [a for a in attempts if a["subskill_id"] == subskill_id]
            
            subskill_stats[subskill_id] = {
                "problems": len(subskill_attempts),
                "averageScore": comp["current_score"]
            }

        total_attempts = len(attempts)
        average_score = sum(c["current_score"] for c in competencies) / len(competencies) if competencies else 0
        credibility = min(1.0, total_attempts / 150)  # Using subject-level credibility standard

        return {
            "currentStats": {
                "totalProblems": total_attempts,
                "averageScore": average_score * 10,  # Convert to percentage
                "credibility": credibility,
                "subSkills": subskill_stats
            },
            "progressionData": self._generate_progression_data(total_attempts, average_score)
        }
    
    async def _calculate_overall_competency(self, student_id: int, daily_attempts: List[Dict[str, Any]]) -> float:
        """Calculate overall competency percentage including today's attempts"""
        # Check if competency_service is available
        if not self.competency_service:
            print("[ERROR] CompetencyService not initialized")
            return 0.0
            
        if not daily_attempts:
            return 0.0
            
        avg_score = sum(attempt["score"] for attempt in daily_attempts) / len(daily_attempts)
        credibility = min(1.0, math.sqrt(len(daily_attempts) / self.competency_service.full_credibility_standard))
        
        return (avg_score * 10 * credibility)  # Convert to percentage
    
    def _generate_progression_data(self, total_problems: int, current_score: float) -> List[Dict[str, Any]]:
        """Generate progression data for visualization"""
        data = []
        max_problems = max(150, total_problems)  # Using subject-level standard
        
        for problems in range(0, max_problems + 1, 2):
            credibility = min(1.0, problems / 150)
            skill_score = (current_score * credibility) + (5.0 * (1 - credibility))
            
            data.append({
                "problems": problems,
                "score": skill_score * 10,  # Convert to percentage
                "credibility": credibility * 100
            })
            
        return data