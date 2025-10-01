"""
Universal Problem Submission Service

This service handles all types of problem submissions in a unified way:
- Legacy package problems (string arrays)
- Structured primitive problems (MCQ, fill-in-blank, matching, etc.)
- Interactive/composable problems
- Canvas/drawing problems

Centralizes all submission logic that was previously in the problems endpoint.
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime

from ..schemas.problem_submission import ProblemSubmission, SubmissionResult
from ..schemas.mcq_problems import MCQSubmission, MCQResponse, MCQOption
from ..services.review import ReviewService
from ..services.competency import CompetencyService
from ..services.problem_converter import ProblemConverter
from ..services.universal_validator import UniversalValidator
from ..shared.question_types import Question, QuestionEvaluation

logger = logging.getLogger(__name__)


class SubmissionService:
    """Universal problem submission handler"""

    def __init__(self, review_service: ReviewService, competency_service: CompetencyService, cosmos_db=None, user_profiles_service=None):
        self.review_service = review_service
        self.competency_service = competency_service
        self.cosmos_db = cosmos_db
        self.user_profiles_service = user_profiles_service
    
    async def handle_submission(
        self,
        submission: ProblemSubmission,
        user_context: dict
    ) -> SubmissionResult:
        """
        Universal submission handler using standardized question format.
        Eliminates type detection and branching logic.
        """
        firebase_uid = user_context["firebase_uid"]
        student_id = user_context["student_id"]

        logger.info(f"🟢 [SUBMISSION_SERVICE] ========== HANDLE_SUBMISSION START ==========")
        logger.info(f"🟢 [SUBMISSION_SERVICE] User: {user_context['email']}, Student: {student_id}")
        logger.info(f"🟢 [SUBMISSION_SERVICE] Problem ID: {submission.problem.get('id')}")
        logger.info(f"🟢 [SUBMISSION_SERVICE] Firebase UID: {firebase_uid[:8]}...")

        # Check for remediation tag
        remediation_subskill_id = submission.problem.get('metadata', {}).get('remediation_for_subskill_id')
        if remediation_subskill_id:
            logger.info(f"🎯 [MISCONCEPTION_ENGINE] This submission is for a REMEDIAL problem (subskill: {remediation_subskill_id})")
        else:
            logger.info(f"📝 [SUBMISSION_SERVICE] This is a standard problem submission")

        try:
            # STEP 1: Convert problem to standardized format
            logger.info(f"[SUBMISSION_SERVICE] Converting problem to standardized format")
            standard_question = ProblemConverter.convert_to_standard_question(submission.problem)

            if not standard_question:
                logger.error(f"[SUBMISSION_SERVICE] Failed to convert problem to standard format")
                # Fallback to legacy drawing handler for unsupported formats
                return await self._handle_drawing(submission, user_context)

            logger.info(f"[SUBMISSION_SERVICE] Successfully converted to {standard_question.type} question")

            # STEP 2: Prepare response data for validation
            response_data = {
                'student_answer': submission.student_answer,
                'subject': submission.subject,
                'skill_id': submission.skill_id,
                'subskill_id': submission.subskill_id
            }

            # STEP 3: Validate using universal validator
            logger.info(f"[SUBMISSION_SERVICE] Validating {standard_question.type} submission")
            evaluation = UniversalValidator.validate_submission(
                question=standard_question,
                student_response_data=response_data,
                primitive_response=submission.primitive_response
            )

            logger.info(f"[SUBMISSION_SERVICE] Validation complete - Score: {evaluation.score}, Correct: {evaluation.is_correct}")

            # STEP 4: Convert evaluation to review format
            review = self._convert_evaluation_to_review(evaluation, standard_question)

            # STEP 5: Update competency
            competency_result = await self._update_competency(
                student_id=student_id,
                skill_id=submission.skill_id or standard_question.metadata.get('skill_id', 'default_skill'),
                subskill_id=submission.subskill_id or standard_question.metadata.get('subskill_id', 'default_subskill'),
                success=evaluation.is_correct,
                subject=submission.subject or standard_question.metadata.get('subject', 'math'),
                evaluation={'score': evaluation.score, 'correct': evaluation.is_correct}
            )

            # STEP 5.5: MISCONCEPTION-DRIVEN PRACTICE ENGINE
            # A) Resolve misconception if this was a remedial problem and submission was correct
            # B) Create new misconception if regular problem was answered incorrectly
            logger.info(f"🔍 [MISCONCEPTION_ENGINE] ========== CHECKING FOR MISCONCEPTION RESOLUTION ==========")
            logger.info(f"🔍 [MISCONCEPTION_ENGINE] Evaluation - is_correct: {evaluation.is_correct}, score: {evaluation.score}")

            remediation_successful = False
            misconception_created = False

            if evaluation.is_correct and evaluation.score >= 8:
                # ======================================================================
                # PART A: RESOLVE MISCONCEPTION (student got remedial problem correct)
                # ======================================================================
                logger.info(f"✅ [MISCONCEPTION_ENGINE] Problem answered correctly with high score - checking for remediation tag")
                remediation_subskill_id = submission.problem.get('metadata', {}).get('remediation_for_subskill_id')

                if remediation_subskill_id:
                    logger.info(f"🎯 [MISCONCEPTION_ENGINE] REMEDIATION TAG FOUND: subskill_id={remediation_subskill_id}")

                    if self.user_profiles_service:
                        logger.info(f"🔄 [MISCONCEPTION_ENGINE] Calling user_profiles_service.resolve_misconception()")
                        logger.info(f"🔄 [MISCONCEPTION_ENGINE] Parameters: uid={firebase_uid[:8]}..., subskill_id={remediation_subskill_id}")

                        resolved = await self.user_profiles_service.resolve_misconception(
                            uid=firebase_uid,
                            subskill_id=remediation_subskill_id
                        )

                        if resolved:
                            remediation_successful = True
                            logger.info(f"🎉 [MISCONCEPTION_ENGINE] ✅✅✅ MISCONCEPTION SUCCESSFULLY RESOLVED! ✅✅✅")
                            logger.info(f"🎉 [MISCONCEPTION_ENGINE] Student {student_id} has overcome misconception for subskill {remediation_subskill_id}")
                        else:
                            logger.error(f"❌ [MISCONCEPTION_ENGINE] Failed to resolve misconception - resolve_misconception returned False")
                    else:
                        logger.error(f"❌ [MISCONCEPTION_ENGINE] user_profiles_service not available - cannot resolve misconception")
                else:
                    logger.info(f"📝 [MISCONCEPTION_ENGINE] No remediation tag found - this is a standard problem")
            else:
                # ======================================================================
                # PART B: CREATE MISCONCEPTION (student got problem wrong)
                # ======================================================================
                if not evaluation.is_correct:
                    logger.info(f"❌ [MISCONCEPTION_ENGINE] Problem answered incorrectly - checking if we should identify misconception")

                    # Check if this is a remedial problem - we don't want to create misconceptions from remedial problems
                    if remediation_subskill_id:
                        logger.info(f"⏭️ [MISCONCEPTION_ENGINE] Skipping misconception creation - this is a remedial problem")
                    else:
                        # Extract subskill_id from submission
                        subskill_id = submission.subskill_id or submission.problem.get('metadata', {}).get('subskill', {}).get('id')

                        logger.info(f"🔍 [MISCONCEPTION_ENGINE] Extracted subskill_id: {subskill_id}")
                        logger.info(f"🔍 [MISCONCEPTION_ENGINE] submission.subskill_id: {submission.subskill_id}")
                        logger.info(f"🔍 [MISCONCEPTION_ENGINE] user_profiles_service available: {bool(self.user_profiles_service)}")

                        if subskill_id and subskill_id != 'unknown' and self.user_profiles_service:
                            logger.info(f"🧠 [MISCONCEPTION_ENGINE] ========== INVOKING AI MISCONCEPTION ANALYSIS ==========")
                            logger.info(f"🧠 [MISCONCEPTION_ENGINE] Standard problem answered incorrectly - analyzing root cause with AI")
                            logger.info(f"🧠 [MISCONCEPTION_ENGINE] This will identify WHY the student got it wrong (student-specific)")
                            logger.info(f"🧠 [MISCONCEPTION_ENGINE] NOT just explaining what the correct answer is (problem-specific)")

                            # Use AI to analyze the misconception
                            # Pass the standardized question + evaluation data
                            misconception_text = await self.review_service.analyze_misconception(
                                question=standard_question,
                                evaluation=evaluation
                            )

                            logger.info(f"🔙 [MISCONCEPTION_ENGINE] Returned from AI analysis")

                            if misconception_text:
                                # Store the AI-generated misconception
                                logger.info(f"💾 [MISCONCEPTION_ENGINE] AI analysis successful! Storing student-specific misconception...")
                                logger.info(f"💾 [MISCONCEPTION_ENGINE] Misconception text: \"{misconception_text[:150]}...\"")

                                try:
                                    success = await self.user_profiles_service.add_or_update_misconception(
                                        uid=firebase_uid,
                                        subskill_id=subskill_id,
                                        misconception_text=misconception_text,
                                        assessment_id="practice_session_analysis"  # New source ID for AI-driven analysis
                                    )

                                    if success:
                                        misconception_created = True
                                        logger.info(f"✅ [MISCONCEPTION_ENGINE] ========== AI-DRIVEN MISCONCEPTION STORED ==========")
                                        logger.info(f"✅ [MISCONCEPTION_ENGINE] User: {firebase_uid[:8]}..., Subskill: {subskill_id}")
                                        logger.info(f"✅ [MISCONCEPTION_ENGINE] Source: practice_session_analysis (AI-powered)")
                                        logger.info(f"✅ [MISCONCEPTION_ENGINE] Misconception captures student's thinking error, not correct answer explanation")
                                    else:
                                        logger.warning(f"⚠️ [MISCONCEPTION_ENGINE] Failed to store misconception in user profile")
                                except Exception as e:
                                    logger.error(f"❌ [MISCONCEPTION_ENGINE] Error storing misconception: {e}")
                                    import traceback
                                    logger.error(f"❌ [MISCONCEPTION_ENGINE] Traceback: {traceback.format_exc()}")
                            else:
                                # Fallback: AI analysis failed, store generic misconception
                                logger.warning(f"⚠️ [MISCONCEPTION_ENGINE] AI analysis failed. Storing generic misconception.")
                                skill_desc = submission.problem.get('metadata', {}).get('skill', {}).get('description', 'this concept')
                                fallback_text = f"Student requires further review on {skill_desc}."

                                try:
                                    success = await self.user_profiles_service.add_or_update_misconception(
                                        uid=firebase_uid,
                                        subskill_id=subskill_id,
                                        misconception_text=fallback_text,
                                        assessment_id="practice_session_fallback"
                                    )
                                    if success:
                                        misconception_created = True
                                        logger.info(f"✅ [MISCONCEPTION_ENGINE] Fallback misconception stored")
                                except Exception as e:
                                    logger.error(f"❌ [MISCONCEPTION_ENGINE] Error storing fallback misconception: {e}")
                        else:
                            if not subskill_id or subskill_id == 'unknown':
                                logger.warning(f"⚠️ [MISCONCEPTION_ENGINE] Cannot create misconception - subskill_id is missing or 'unknown'")
                            elif not self.user_profiles_service:
                                logger.warning(f"⚠️ [MISCONCEPTION_ENGINE] Cannot create misconception - user_profiles_service not available")
                elif evaluation.score < 8:
                    logger.info(f"⚠️ [MISCONCEPTION_ENGINE] Score too low ({evaluation.score}) - could track misconception in future")

            # STEP 6: Save to CosmosDB (with remediation metadata)
            if self.cosmos_db:
                # Add remediation metadata to review before saving
                review['metadata'] = review.get('metadata', {})
                if remediation_successful:
                    review['metadata']['remediation_successful'] = True
                if misconception_created:
                    review['metadata']['misconception_created'] = True

                await self._save_attempt_and_review(
                    submission, user_context, review, standard_question.dict()
                )

            # STEP 7: Return standardized result
            return SubmissionResult(
                review=review,
                competency=competency_result,
                student_id=student_id,
                user_id=firebase_uid,
                points_earned=int(evaluation.score),
                encouraging_message="Excellent work!" if evaluation.is_correct else "Keep practicing!"
            )

        except Exception as e:
            logger.error(f"[SUBMISSION_SERVICE] Error processing submission: {str(e)}")
            import traceback
            logger.error(f"[SUBMISSION_SERVICE] Traceback: {traceback.format_exc()}")
            raise
    
    def _convert_evaluation_to_review(self, evaluation: QuestionEvaluation, question: Question) -> dict:
        """
        Convert standardized evaluation to legacy review format for compatibility.
        """
        return {
            "observation": {
                "canvas_description": "Standardized question validation",
                "selected_answer": evaluation.student_answer,
                "work_shown": "Student answered using standardized interface"
            },
            "analysis": {
                "understanding": "Good understanding demonstrated" if evaluation.is_correct else "Student needs additional practice",
                "approach": "Student attempted to answer the question",
                "accuracy": "Correct answer" if evaluation.is_correct else "Incorrect answer",
                "creativity": "Standard response format"
            },
            "evaluation": {
                "score": evaluation.score,
                "justification": evaluation.feedback
            },
            "feedback": {
                "praise": "Excellent work!" if evaluation.is_correct else "Good effort!",
                "guidance": evaluation.feedback,
                "encouragement": "Keep up the great work!" if evaluation.is_correct else "Keep practicing!",
                "next_steps": "Continue to next question" if evaluation.is_correct else "Review this concept"
            },
            "skill_id": question.metadata.get('skill_id', 'unknown'),
            "subject": question.metadata.get('subject', 'unknown'),
            "subskill_id": question.metadata.get('subskill_id', 'unknown'),
            "score": evaluation.score,
            "correct": evaluation.is_correct,
            "accuracy_percentage": 100 if evaluation.is_correct else 30,
            "selected_answer_text": evaluation.student_answer,
            "question_text": question.question_text,
            "correct_answer_text": evaluation.correct_answer,
            "your_answer_text": evaluation.student_answer
        }
    
    # ============================================================================
    # LEGACY HANDLERS (for fallback only)
    # ============================================================================
    
    # Legacy handlers removed - now handled by standardized approach
    
    async def _handle_drawing(
        self, 
        submission: ProblemSubmission, 
        user_context: dict
    ) -> SubmissionResult:
        """Handle drawing/canvas problems - existing logic"""
        student_id = user_context["student_id"]
        
        if not submission.solution_image:
            raise ValueError("No image data provided for drawing problem.")
        
        image_data = self._extract_image_data(submission.solution_image)
        problem_data = submission.problem.get('problem_data', {})
        
        # Enhanced context for composable problems
        enhanced_context = ""
        if submission.problem.get('problem_type') == 'composable':
            enhanced_context = self._build_composable_context(submission)
        
        # Get review
        problem_dict = {
            'problem': problem_data.get('problem', ''),
            'answer': problem_data.get('correct_answer', problem_data.get('answer', '')),
            'id': submission.problem.get('id', 'drawing_problem')
        }
        review = await self.review_service.review_problem(
            student_id=student_id,
            subject=submission.subject,
            problem=problem_dict,
            solution_image_base64=image_data,
            skill_id=submission.skill_id,
            subskill_id=submission.subskill_id,
            student_answer=submission.student_answer or "",
            canvas_used=submission.canvas_used
        )
        
        # Update competency
        score = self._extract_score(review)
        is_correct = score >= 7
        
        competency_result = await self._update_competency(
            student_id,
            submission.problem.get('skill_id', 'default_skill'),
            submission.problem.get('subskill_id', 'default_subskill'),
            is_correct
        )
        
        # Save both attempt and review to CosmosDB
        if self.cosmos_db:
            await self._save_attempt_and_review(
                submission, user_context, review, problem_data
            )
        
        return SubmissionResult(
            review=review, 
            competency=competency_result,
            student_id=student_id,
            user_id=user_context["firebase_uid"],
            points_earned=10 if is_correct else 3,
            encouraging_message="Great work!" if is_correct else "Keep practicing!"
        )
    
    # ============================================================================
    # HELPER METHODS
    # ============================================================================
    
    def _extract_image_data(self, solution_image: Optional[str]) -> str:
        """Extract base64 image data from data URL"""
        if not solution_image:
            return ""
        return solution_image.split(',', 1)[1] if ',' in solution_image else solution_image
    
    # Legacy helper methods removed - standardized approach handles conversion
    
    def _extract_score(self, review: dict) -> float:
        """Extract numeric score from review"""
        if isinstance(review.get('evaluation'), dict):
            return review['evaluation'].get('score', 0)
        return review.get('evaluation', 0) if isinstance(review.get('evaluation'), (int, float)) else 0
    
    async def _update_competency(
        self, 
        student_id: int, 
        skill_id: str, 
        subskill_id: str, 
        success: bool,
        subject: str = "math",
        evaluation: Dict[str, Any] = None
    ) -> dict:
        """Update student competency and return result"""
        try:
            # Create a basic evaluation if none provided
            if evaluation is None:
                evaluation = {
                    "score": 10 if success else 3,
                    "correct": success
                }
            
            return await self.competency_service.update_competency_from_problem(
                student_id=student_id,
                subject=subject,
                skill_id=skill_id,
                subskill_id=subskill_id,
                evaluation=evaluation
            )
        except Exception as e:
            logger.error(f"Error updating competency: {str(e)}")
            return {}
    
    async def _save_attempt_and_review(
        self,
        submission: ProblemSubmission,
        user_context: dict,
        review: dict,
        problem_content: dict
    ) -> None:
        """Save both attempt and review to CosmosDB"""
        try:
            student_id = user_context["student_id"]
            firebase_uid = user_context["firebase_uid"]
            
            # Extract score from review
            score = self._extract_score(review)
            
            # Save attempt (simple tracking record)
            await self.cosmos_db.save_attempt(
                student_id=student_id,
                subject=submission.subject,
                skill_id=submission.skill_id,
                subskill_id=submission.subskill_id or submission.skill_id,
                score=score,
                analysis=f"Problem attempt: Score {score}",
                feedback=review.get('feedback', {}).get('guidance', ''),
                firebase_uid=firebase_uid
            )
            
            # Save detailed review
            await self.cosmos_db.save_problem_review(
                student_id=student_id,
                subject=submission.subject,
                skill_id=submission.skill_id,
                subskill_id=submission.subskill_id or submission.skill_id,
                problem_id=submission.problem.get('id', 'unknown'),
                review_data=review,
                problem_content=problem_content,
                firebase_uid=firebase_uid
            )
            
            logger.info(f"Saved attempt and review to CosmosDB for student {student_id}")
            
        except Exception as e:
            logger.error(f"Error saving to CosmosDB: {str(e)}")
            # Don't raise - submission should continue even if DB save fails