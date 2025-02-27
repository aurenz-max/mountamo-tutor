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
            logger.debug(f"[Session {session_id}] handle_problem_creation called with metadata keys: {list(session_metadata.keys())}")
            subject = session_metadata.get("subject")
            student_id = session_metadata.get("student_id")
            
            if not all([subject, student_id]):
                logger.error(f"[Session {session_id}] Missing required metadata for problem creation: subject={subject}, student_id={student_id}")
                return {"status": "error", "message": "Missing required metadata"}

            # Use pre-loaded data if available
            if session_recommendation and session_objectives:
                logger.info(f"[Session {session_id}] Using pre-loaded session data for problem creation")
                problem_data = await self.problem_service.get_problem_with_session_data(
                    student_id=student_id,
                    subject=subject,
                    session_recommendation=session_recommendation,
                    session_objectives=session_objectives
                )
            else:
                # Fallback to original method
                logger.info(f"[Session {session_id}] Using standard method for problem creation")
                context = {
                    "unit": session_metadata.get("unit"),
                    "skill": session_metadata.get("skill_id"),
                    "subskill": session_metadata.get("subskill_id"),
                    "competency_score": session_metadata.get("competency_score", 5.0)
                }
                logger.debug(f"[Session {session_id}] Context for problem creation: {context}")
                problem_data = await self.problem_service.get_problem(
                    student_id=student_id,
                    subject=subject,
                    context=context
                )

            if problem_data:
                logger.info(f"[Session {session_id}] Problem data created successfully with keys: {list(problem_data.keys())}")
                return {"status": "success", "data": problem_data}
            else:
                logger.error(f"[Session {session_id}] Problem creation failed - no data returned")
                return {"status": "error", "message": "Problem creation failed"}

        except Exception as e:
            logger.error(f"[Session {session_id}] Error in handle_problem_creation: {str(e)}", exc_info=True)
            return {"status": "error", "message": f"Exception in problem creation: {str(e)}"}