from typing import Dict, Any, Optional
import logging
from .problems import ProblemService

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

class GeminiProblemIntegration:
    def __init__(self):
        self.problem_service = ProblemService()

    async def handle_problem_creation(
        self, 
        session_metadata: Dict[str, Any], 
        session_id: str,
        session_recommendation: Optional[Dict] = None,
        session_objectives: Optional[Dict] = None
    ) -> Optional[Dict[str, Any]]:
        """Handles problem creation using pre-loaded session data when available"""
        try:
            subject = session_metadata.get("subject")
            student_id = session_metadata.get("student_id")
            
            if not all([subject, student_id]):
                logger.error(f"[Session {session_id}] Missing required metadata for problem creation")
                return None

            # Use pre-loaded data if available
            if session_recommendation and session_objectives:
                problem_data = await self.problem_service.get_problem_with_session_data(
                    student_id=student_id,
                    subject=subject,
                    session_recommendation=session_recommendation,
                    session_objectives=session_objectives
                )
            else:
                # Fallback to original method
                context = {
                    "unit": session_metadata.get("unit"),
                    "skill": session_metadata.get("skill_id"),
                    "subskill": session_metadata.get("subskill_id"),
                    "competency_score": session_metadata.get("competency_score", 5.0)
                }
                problem_data = await self.problem_service.get_problem(
                    student_id=student_id,
                    subject=subject,
                    context=context
                )

            return problem_data

        except Exception as e:
            logger.error(f"Error in handle_problem_creation for session {session_id}: {str(e)}")
            return None