# backend/app/services/competency.py

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import math
import random
import logging

from app.services.curriculum_service import CurriculumService

logger = logging.getLogger(__name__)

class CompetencyService:
    def __init__(self, curriculum_service: CurriculumService):
        """Initialize CompetencyService with cloud storage.
        
        Args:
            curriculum_service: Service for managing curriculum data in cloud storage
        """
        self._competencies = {}  # In-memory storage for competency calculations
        self.cosmos_db = None  # Will be set by dependency injection
        self.curriculum_service = curriculum_service
        
        # Competency calculation settings
        self.full_credibility_standard = 15  # Full credibility for specific subskill
        self.full_credibility_standard_subject = 150  # Full credibility for subject
        self.default_score = 5.0  # Default score when no data exists

    async def initialize(self) -> bool:
        """Initialize the competency service"""
        try:
            # Initialize curriculum service
            await self.curriculum_service.initialize()
            logger.info("CompetencyService initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize CompetencyService: {str(e)}")
            return False

    async def get_available_subjects(self) -> List[str]:
        """Get list of all available subjects from curriculum storage"""
        try:
            return await self.curriculum_service.get_available_subjects()
        except Exception as e:
            logger.error(f"Error getting available subjects: {str(e)}")
            return []

    async def get_curriculum(self, subject: str) -> List[Dict]:
        """Get full curriculum structure for a subject from cloud storage"""
        try:
            return await self.curriculum_service.get_curriculum(subject)
        except Exception as e:
            logger.error(f"Error getting curriculum for {subject}: {str(e)}")
            return []

    async def get_detailed_objectives(self, subject: str, subskill_id: str) -> Dict[str, Any]:
        """Get detailed objectives for a subskill from cloud storage"""
        try:
            return await self.curriculum_service.get_detailed_objectives(subject, subskill_id)
        except Exception as e:
            logger.error(f"Error getting detailed objectives: {str(e)}")
            return {
                'ConceptGroup': 'General',
                'DetailedObjective': 'Develop core skills',
                'SubskillDescription': 'General skill development'
            }
    
    async def get_all_objectives(self, subject: str, subskill_id: str) -> List[Dict]:
        """Get ALL detailed objectives for a subskill"""
        try:
            return await self.curriculum_service.get_all_objectives(subject, subskill_id)
        except Exception as e:
            logger.error(f"Error getting all objectives: {str(e)}")
            return []

    async def get_subskill_types(self, subject: str) -> List[str]:
        """Get list of all problem types (subskills) available"""
        try:
            return await self.curriculum_service.get_subskill_types(subject)
        except Exception as e:
            logger.error(f"Error getting subskill types: {str(e)}")
            return []

    # The rest of the methods remain the same as they deal with competency calculations
    # rather than curriculum data loading
    
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
                logger.error("CosmosDB service not initialized")
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
            logger.error(f"Error updating competency: {str(e)}")
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
                logger.error("CosmosDB service not initialized")
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
            logger.error(f"Error getting competency: {str(e)}")
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
                logger.error("CosmosDB service not initialized")
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
            logger.error(f"Error calculating subject competency: {str(e)}")
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
            logger.debug(f"get_detailed_problem_reviews called with:")
            logger.debug(f"  - student_id: {student_id}")
            logger.debug(f"  - subject: {subject}")
            logger.debug(f"  - skill_id: {skill_id}")
            logger.debug(f"  - subskill_id: {subskill_id}")
            logger.debug(f"  - limit: {limit}")
            
            # Check if cosmos_db is available
            if not self.cosmos_db:
                logger.error("CosmosDB service not initialized")
                return []
                
            # Get reviews from cosmos_db
            reviews = await self.cosmos_db.get_problem_reviews(
                student_id=student_id,
                subject=subject,
                skill_id=skill_id,
                subskill_id=subskill_id,
                limit=limit
            )
            
            logger.debug(f"Got {len(reviews)} reviews from cosmos_db")
            
            # Format the reviews to include the structured components
            formatted_reviews = []
            for i, review in enumerate(reviews):
                logger.debug(f"Processing review {i+1}/{len(reviews)} with ID: {review.get('id', 'No ID')}")
                
                formatted_review = {
                    "id": review["id"],
                    "student_id": review["student_id"],
                    "subject": review["subject"],
                    "skill_id": review["skill_id"],
                    "subskill_id": review["subskill_id"],
                    "problem_id": review["problem_id"],
                    "timestamp": review["timestamp"],
                    "score": review["score"],
                    "problem_content": review.get("problem_content", None),
                    "feedback_components": {
                        "observation": review.get("observation", {}),
                        "analysis": review.get("analysis", {}),
                        "evaluation": review.get("evaluation", {}),
                        "feedback": review.get("feedback", {})
                    }
                }
                
                formatted_reviews.append(formatted_review)
            
            logger.debug(f"Returning {len(formatted_reviews)} formatted reviews")
            return formatted_reviews
            
        except Exception as e:
            logger.error(f"Error getting detailed problem reviews: {str(e)}")
            import traceback
            traceback.print_exc()
            return []

    async def health_check(self) -> Dict[str, Any]:
        """Check service health including curriculum storage"""
        try:
            curriculum_health = await self.curriculum_service.health_check()
            
            # Check if we can get available subjects
            subjects = await self.get_available_subjects()
            
            return {
                "status": "healthy" if curriculum_health["status"] == "healthy" else "unhealthy",
                "curriculum_storage": curriculum_health,
                "available_subjects": subjects,
                "subjects_count": len(subjects),
                "cosmos_db_connected": self.cosmos_db is not None,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

