# backend/app/services/competency.py - ENHANCED DEBUG VERSION

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import math
import random
import logging

# Updated import to handle optional curriculum service
from app.services.curriculum_service import CurriculumService

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)  # Ensure we see INFO logs

class CompetencyService:
    def __init__(self, curriculum_service: Optional[CurriculumService] = None):
        """Initialize CompetencyService with optional cloud storage.
        
        Args:
            curriculum_service: Optional service for managing curriculum data in cloud storage
        """
        logger.info(f"🔍 COMPETENCY_SERVICE: === INITIALIZING CompetencyService ===")
        logger.info(f"🔍 COMPETENCY_SERVICE: curriculum_service provided: {curriculum_service is not None}")
        
        if curriculum_service:
            logger.info(f"🔍 COMPETENCY_SERVICE: curriculum_service type: {type(curriculum_service)}")
            logger.info(f"🔍 COMPETENCY_SERVICE: curriculum_service.blob_service: {getattr(curriculum_service, 'blob_service', 'ATTRIBUTE_NOT_FOUND')}")
        
        self._competencies = {}  # In-memory storage for competency calculations
        self.cosmos_db = None  # Will be set by dependency injection
        self.curriculum_service = curriculum_service
        
        # Competency calculation settings
        self.full_credibility_standard = 15  # Full credibility for specific subskill
        self.full_credibility_standard_subject = 150  # Full credibility for subject
        self.default_score = 5.0  # Default score when no data exists
        
        logger.info(f"✅ COMPETENCY_SERVICE: CompetencyService constructor completed")

    async def initialize(self) -> bool:
        """Initialize the competency service"""
        logger.info(f"🔍 COMPETENCY_SERVICE: === INITIALIZING SERVICE ===")
        
        try:
            # Initialize curriculum service if available
            if self.curriculum_service:
                logger.info(f"🔍 COMPETENCY_SERVICE: Initializing curriculum service...")
                init_result = await self.curriculum_service.initialize()
                logger.info(f"🔍 COMPETENCY_SERVICE: Curriculum service initialization result: {init_result}")
                
                if init_result:
                    logger.info(f"✅ COMPETENCY_SERVICE: CompetencyService initialized successfully with curriculum service")
                else:
                    logger.warning(f"⚠️ COMPETENCY_SERVICE: Curriculum service initialization failed, but continuing")
            else:
                logger.warning(f"⚠️ COMPETENCY_SERVICE: CompetencyService initialized without curriculum service")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ COMPETENCY_SERVICE: Failed to initialize CompetencyService: {str(e)}")
            logger.error(f"❌ COMPETENCY_SERVICE: Exception type: {type(e)}")
            import traceback
            logger.error(f"❌ COMPETENCY_SERVICE: Traceback: {traceback.format_exc()}")
            return False

    async def get_available_subjects(self) -> List[str]:
        """Get list of all available subjects from curriculum storage"""
        logger.info(f"🔍 COMPETENCY_SERVICE: === GET_AVAILABLE_SUBJECTS ===")
        
        try:
            if not self.curriculum_service:
                logger.warning(f"⚠️ COMPETENCY_SERVICE: No curriculum service available, returning default subjects")
                default_subjects = ["Mathematics", "Science", "English", "Social Studies"]
                logger.info(f"✅ COMPETENCY_SERVICE: Returning default subjects: {default_subjects}")
                return default_subjects
            
            logger.info(f"🔍 COMPETENCY_SERVICE: Curriculum service available, calling get_available_subjects...")
            subjects = await self.curriculum_service.get_available_subjects()
            
            logger.info(f"✅ COMPETENCY_SERVICE: Curriculum service returned {len(subjects)} subjects: {subjects}")
            return subjects
            
        except Exception as e:
            logger.error(f"❌ COMPETENCY_SERVICE: Error getting available subjects: {str(e)}")
            logger.error(f"❌ COMPETENCY_SERVICE: Exception type: {type(e)}")
            import traceback
            logger.error(f"❌ COMPETENCY_SERVICE: Traceback: {traceback.format_exc()}")
            
            default_subjects = ["Mathematics", "Science", "English", "Social Studies"]
            logger.info(f"🔍 COMPETENCY_SERVICE: Returning default subjects due to error: {default_subjects}")
            return default_subjects

    async def get_curriculum(self, subject: str) -> List[Dict]:
        """Get full curriculum structure for a subject from cloud storage"""
        logger.info(f"🔍 COMPETENCY_SERVICE: === GET_CURRICULUM for {subject} ===")
        
        try:
            if not self.curriculum_service:
                logger.warning(f"⚠️ COMPETENCY_SERVICE: No curriculum service available for subject {subject}")
                return []
            
            logger.info(f"🔍 COMPETENCY_SERVICE: Calling curriculum_service.get_curriculum({subject})...")
            curriculum = await self.curriculum_service.get_curriculum(subject)
            
            logger.info(f"✅ COMPETENCY_SERVICE: Curriculum service returned {len(curriculum)} units for {subject}")
            if curriculum:
                logger.info(f"🔍 COMPETENCY_SERVICE: First unit preview: {curriculum[0] if curriculum else 'None'}")
            
            return curriculum
            
        except Exception as e:
            logger.error(f"❌ COMPETENCY_SERVICE: Error getting curriculum for {subject}: {str(e)}")
            logger.error(f"❌ COMPETENCY_SERVICE: Exception type: {type(e)}")
            import traceback
            logger.error(f"❌ COMPETENCY_SERVICE: Traceback: {traceback.format_exc()}")
            return []

    async def get_detailed_objectives(self, subject: str, subskill_id: str) -> Dict[str, Any]:
        """Get detailed objectives for a subskill from cloud storage"""
        logger.info(f"🔍 COMPETENCY_SERVICE: === GET_DETAILED_OBJECTIVES ===")
        logger.info(f"🔍 COMPETENCY_SERVICE: Subject: {subject}, Subskill: {subskill_id}")
        
        try:
            if not self.curriculum_service:
                logger.warning(f"⚠️ COMPETENCY_SERVICE: No curriculum service available for objectives {subject}/{subskill_id}")
                default_objective = {
                    'ConceptGroup': 'General',
                    'DetailedObjective': 'Develop core skills',
                    'SubskillDescription': 'General skill development'
                }
                logger.info(f"✅ COMPETENCY_SERVICE: Returning default objective: {default_objective}")
                return default_objective
            
            logger.info(f"🔍 COMPETENCY_SERVICE: Calling curriculum_service.get_detailed_objectives...")
            objectives = await self.curriculum_service.get_detailed_objectives(subject, subskill_id)
            
            logger.info(f"✅ COMPETENCY_SERVICE: Objectives received: {objectives}")
            return objectives
            
        except Exception as e:
            logger.error(f"❌ COMPETENCY_SERVICE: Error getting detailed objectives: {str(e)}")
            logger.error(f"❌ COMPETENCY_SERVICE: Exception type: {type(e)}")
            import traceback
            logger.error(f"❌ COMPETENCY_SERVICE: Traceback: {traceback.format_exc()}")
            
            default_objective = {
                'ConceptGroup': 'General',
                'DetailedObjective': 'Develop core skills',
                'SubskillDescription': 'General skill development'
            }
            logger.info(f"🔍 COMPETENCY_SERVICE: Returning default objective due to error: {default_objective}")
            return default_objective
    
    async def get_all_objectives(self, subject: str, subskill_id: str) -> List[Dict]:
        """Get ALL detailed objectives for a subskill"""
        logger.info(f"🔍 COMPETENCY_SERVICE: === GET_ALL_OBJECTIVES ===")
        logger.info(f"🔍 COMPETENCY_SERVICE: Subject: {subject}, Subskill: {subskill_id}")
        
        try:
            if not self.curriculum_service:
                logger.warning(f"⚠️ COMPETENCY_SERVICE: No curriculum service available for all objectives {subject}/{subskill_id}")
                return []
            
            logger.info(f"🔍 COMPETENCY_SERVICE: Calling curriculum_service.get_all_objectives...")
            objectives = await self.curriculum_service.get_all_objectives(subject, subskill_id)
            
            logger.info(f"✅ COMPETENCY_SERVICE: All objectives received: {len(objectives)} items")
            return objectives
            
        except Exception as e:
            logger.error(f"❌ COMPETENCY_SERVICE: Error getting all objectives: {str(e)}")
            logger.error(f"❌ COMPETENCY_SERVICE: Exception type: {type(e)}")
            import traceback
            logger.error(f"❌ COMPETENCY_SERVICE: Traceback: {traceback.format_exc()}")
            return []

    async def get_subskill_types(self, subject: str) -> List[str]:
        """Get list of all problem types (subskills) available"""
        logger.info(f"🔍 COMPETENCY_SERVICE: === GET_SUBSKILL_TYPES ===")
        logger.info(f"🔍 COMPETENCY_SERVICE: Subject: {subject}")
        
        try:
            if not self.curriculum_service:
                logger.warning(f"⚠️ COMPETENCY_SERVICE: No curriculum service available for subskill types {subject}")
                return []
            
            logger.info(f"🔍 COMPETENCY_SERVICE: Calling curriculum_service.get_subskill_types...")
            subskill_types = await self.curriculum_service.get_subskill_types(subject)
            
            logger.info(f"✅ COMPETENCY_SERVICE: Subskill types received: {len(subskill_types)} items")
            logger.info(f"🔍 COMPETENCY_SERVICE: Subskill types preview: {subskill_types[:5] if subskill_types else 'None'}")
            return subskill_types
            
        except Exception as e:
            logger.error(f"❌ COMPETENCY_SERVICE: Error getting subskill types: {str(e)}")
            logger.error(f"❌ COMPETENCY_SERVICE: Exception type: {type(e)}")
            import traceback
            logger.error(f"❌ COMPETENCY_SERVICE: Traceback: {traceback.format_exc()}")
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
        logger.info(f"🔍 COMPETENCY_SERVICE: === UPDATE_COMPETENCY_FROM_PROBLEM ===")
        logger.info(f"🔍 COMPETENCY_SERVICE: Student: {student_id}, Subject: {subject}, Skill: {skill_id}, Subskill: {subskill_id}")
        
        try:
            # Check if cosmos_db is available
            if not self.cosmos_db:
                logger.error(f"❌ COMPETENCY_SERVICE: CosmosDB service not initialized")
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
                
            logger.info(f"🔍 COMPETENCY_SERVICE: Extracted score: {score}")
                
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
                
            logger.info(f"🔍 COMPETENCY_SERVICE: Extracted feedback length: {len(feedback)}")
                
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
            
            logger.info(f"🔍 COMPETENCY_SERVICE: Extracted analysis length: {len(analysis)}")
            
            # Save the attempt
            logger.info(f"🔍 COMPETENCY_SERVICE: Saving attempt to cosmos_db...")
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
            logger.info(f"🔍 COMPETENCY_SERVICE: Getting student attempts...")
            attempts = await self.cosmos_db.get_student_attempts(
                student_id=student_id,
                subject=subject,
                skill_id=skill_id,
                subskill_id=subskill_id
            )
            
            logger.info(f"🔍 COMPETENCY_SERVICE: Found {len(attempts)} attempts")
            
            # Move calculations to a thread since they're CPU bound
            from asyncio import to_thread
            def calculate_scores():
                average_score = sum(attempt["score"] for attempt in attempts) / len(attempts)
                credibility = min(1.0, math.sqrt(len(attempts) / self.full_credibility_standard))
                blended_score = (average_score * credibility) + (self.default_score * (1 - credibility))
                return blended_score, credibility
            
            blended_score, credibility = await to_thread(calculate_scores)
            logger.info(f"🔍 COMPETENCY_SERVICE: Calculated scores - blended: {blended_score}, credibility: {credibility}")

            # Update competency
            logger.info(f"🔍 COMPETENCY_SERVICE: Updating competency...")
            result = await self.cosmos_db.update_competency(
                student_id=student_id,
                subject=subject,
                skill_id=skill_id,
                subskill_id=subskill_id,
                score=blended_score,
                credibility=credibility,
                total_attempts=len(attempts)
            )
            
            logger.info(f"✅ COMPETENCY_SERVICE: Competency update successful")
            return result
                
        except Exception as e:
            logger.error(f"❌ COMPETENCY_SERVICE: Error updating competency: {str(e)}")
            logger.error(f"❌ COMPETENCY_SERVICE: Exception type: {type(e)}")
            import traceback
            logger.error(f"❌ COMPETENCY_SERVICE: Traceback: {traceback.format_exc()}")
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
        logger.info(f"🔍 COMPETENCY_SERVICE: === GET_COMPETENCY ===")
        logger.info(f"🔍 COMPETENCY_SERVICE: Student: {student_id}, Subject: {subject}, Skill: {skill_id}, Subskill: {subskill_id}")
        
        try:
            # Check if cosmos_db is available
            if not self.cosmos_db:
                logger.error(f"❌ COMPETENCY_SERVICE: CosmosDB service not initialized")
                default_result = {
                    "current_score": self.default_score,
                    "credibility": 0.0,
                    "total_attempts": 0
                }
                logger.info(f"🔍 COMPETENCY_SERVICE: Returning default result: {default_result}")
                return default_result
                
            logger.info(f"🔍 COMPETENCY_SERVICE: Calling cosmos_db.get_competency...")
            result = await self.cosmos_db.get_competency(
                student_id=student_id,
                subject=subject,
                skill_id=skill_id,
                subskill_id=subskill_id
            )
            
            if not result:
                logger.info(f"🔍 COMPETENCY_SERVICE: No competency found, returning default")
                default_result = {
                    "current_score": self.default_score,
                    "credibility": 0.0,
                    "total_attempts": 0
                }
                return default_result
            
            logger.info(f"✅ COMPETENCY_SERVICE: Competency found: {result}")
            return result
            
        except Exception as e:
            logger.error(f"❌ COMPETENCY_SERVICE: Error getting competency: {str(e)}")
            logger.error(f"❌ COMPETENCY_SERVICE: Exception type: {type(e)}")
            import traceback
            logger.error(f"❌ COMPETENCY_SERVICE: Traceback: {traceback.format_exc()}")
            
            default_result = {
                "current_score": self.default_score,
                "credibility": 0.0,
                "total_attempts": 0
            }
            logger.info(f"🔍 COMPETENCY_SERVICE: Returning default result due to error: {default_result}")
            return default_result

    # Keep all other existing methods with similar logging patterns...
    async def get_subject_competency(self, student_id: int, subject: str) -> Dict[str, Any]:
        """Get aggregated competency for entire subject"""
        logger.info(f"🔍 COMPETENCY_SERVICE: === GET_SUBJECT_COMPETENCY ===")
        logger.info(f"🔍 COMPETENCY_SERVICE: Student: {student_id}, Subject: {subject}")
        
        try:
            # Check if cosmos_db is available
            if not self.cosmos_db:
                logger.error(f"❌ COMPETENCY_SERVICE: CosmosDB service not initialized")
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
                logger.info(f"🔍 COMPETENCY_SERVICE: No subject competencies found")
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
            
            result = {
                "student_id": student_id,
                "subject": subject,
                "current_score": blended_score,
                "credibility": credibility,
                "total_attempts": total_attempts
            }
            
            logger.info(f"✅ COMPETENCY_SERVICE: Subject competency calculated: {result}")
            return result
            
        except Exception as e:
            logger.error(f"❌ COMPETENCY_SERVICE: Error calculating subject competency: {str(e)}")
            logger.error(f"❌ COMPETENCY_SERVICE: Exception type: {type(e)}")
            import traceback
            logger.error(f"❌ COMPETENCY_SERVICE: Traceback: {traceback.format_exc()}")
            
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
        logger.info(f"🔍 COMPETENCY_SERVICE: === GET_DETAILED_PROBLEM_REVIEWS ===")
        logger.info(f"🔍 COMPETENCY_SERVICE: Student: {student_id}, Subject: {subject}, Skill: {skill_id}, Subskill: {subskill_id}, Limit: {limit}")
        
        try:
            # Check if cosmos_db is available
            if not self.cosmos_db:
                logger.error(f"❌ COMPETENCY_SERVICE: CosmosDB service not initialized")
                return []
                
            # Get reviews from cosmos_db
            logger.info(f"🔍 COMPETENCY_SERVICE: Calling cosmos_db.get_problem_reviews...")
            reviews = await self.cosmos_db.get_problem_reviews(
                student_id=student_id,
                subject=subject,
                skill_id=skill_id,
                subskill_id=subskill_id,
                limit=limit
            )
            
            logger.info(f"✅ COMPETENCY_SERVICE: Got {len(reviews)} reviews from cosmos_db")
            
            # Format the reviews to include the structured components
            formatted_reviews = []
            for i, review in enumerate(reviews):
                logger.debug(f"🔍 COMPETENCY_SERVICE: Processing review {i+1}/{len(reviews)} with ID: {review.get('id', 'No ID')}")
                
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
            
            logger.info(f"✅ COMPETENCY_SERVICE: Returning {len(formatted_reviews)} formatted reviews")
            return formatted_reviews
            
        except Exception as e:
            logger.error(f"❌ COMPETENCY_SERVICE: Error getting detailed problem reviews: {str(e)}")
            logger.error(f"❌ COMPETENCY_SERVICE: Exception type: {type(e)}")
            import traceback
            logger.error(f"❌ COMPETENCY_SERVICE: Traceback: {traceback.format_exc()}")
            return []

    async def health_check(self) -> Dict[str, Any]:
        """Check service health including curriculum storage"""
        logger.info(f"🔍 COMPETENCY_SERVICE: === HEALTH_CHECK ===")
        
        try:
            curriculum_health = {"status": "not_available"}
            subjects = []
            
            if self.curriculum_service:
                logger.info(f"🔍 COMPETENCY_SERVICE: Checking curriculum service health...")
                curriculum_health = await self.curriculum_service.health_check()
                logger.info(f"🔍 COMPETENCY_SERVICE: Curriculum health: {curriculum_health}")
                
                logger.info(f"🔍 COMPETENCY_SERVICE: Getting available subjects...")
                subjects = await self.get_available_subjects()
                logger.info(f"🔍 COMPETENCY_SERVICE: Available subjects: {subjects}")
            else:
                logger.warning(f"⚠️ COMPETENCY_SERVICE: No curriculum service available for health check")
            
            health_result = {
                "status": "healthy" if curriculum_health.get("status") == "healthy" else "degraded",
                "curriculum_storage": curriculum_health,
                "available_subjects": subjects,
                "subjects_count": len(subjects),
                "cosmos_db_connected": self.cosmos_db is not None,
                "curriculum_service_available": self.curriculum_service is not None,
                "timestamp": datetime.now().isoformat()
            }
            
            logger.info(f"✅ COMPETENCY_SERVICE: Health check complete: {health_result}")
            return health_result
            
        except Exception as e:
            logger.error(f"❌ COMPETENCY_SERVICE: Health check failed: {str(e)}")
            logger.error(f"❌ COMPETENCY_SERVICE: Exception type: {type(e)}")
            import traceback
            logger.error(f"❌ COMPETENCY_SERVICE: Traceback: {traceback.format_exc()}")
            
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }