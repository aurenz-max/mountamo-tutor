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

logger = logging.getLogger(__name__)


class SubmissionService:
    """Universal problem submission handler"""
    
    def __init__(self, review_service: ReviewService, competency_service: CompetencyService, cosmos_db=None):
        self.review_service = review_service
        self.competency_service = competency_service
        self.cosmos_db = cosmos_db
    
    async def handle_submission(
        self, 
        submission: ProblemSubmission, 
        user_context: dict
    ) -> SubmissionResult:
        """
        Universal submission handler that detects problem type and routes appropriately
        """
        firebase_uid = user_context["firebase_uid"]
        student_id = user_context["student_id"]
        
        logger.info(f"User {user_context['email']} submitting problem for student {student_id}")
        
        # STEP 1: Detect problem type and route to appropriate handler
        problem_data = submission.problem.get('problem_data', {})
        full_problem_data = problem_data.get('full_problem_data', {})
        
        try:
            # Check for structured MCQ problem (has options with id/text structure)
            if self._is_structured_mcq(full_problem_data):
                logger.info("Processing structured MCQ problem submission")
                return await self._handle_structured_mcq(submission, user_context)
            
            # Check for legacy MCQ problem (string array options)
            elif self._is_legacy_mcq(problem_data):
                logger.info("Processing legacy MCQ problem submission")
                return await self._handle_legacy_mcq(submission, user_context)
            
            # Check for other structured problem types
            elif self._is_fill_in_blank(full_problem_data):
                logger.info("Processing fill-in-blank problem submission")
                return await self._handle_structured_problem(submission, user_context, "fill-in-the-blank")
            
            elif self._is_matching(full_problem_data):
                logger.info("Processing matching problem submission")
                return await self._handle_structured_problem(submission, user_context, "matching")
            
            elif self._is_true_false(full_problem_data):
                logger.info("Processing true/false problem submission")
                return await self._handle_structured_problem(submission, user_context, "true/false")
            
            # Check for interactive problem
            elif self._is_interactive(submission):
                logger.info("Processing interactive problem submission")
                return await self._handle_interactive(submission, user_context)
            
            # Default to drawing problem
            else:
                logger.info("Processing drawing-based problem submission")
                return await self._handle_drawing(submission, user_context)
                
        except Exception as e:
            logger.error(f"Error processing submission: {str(e)}")
            raise
    
    # ============================================================================
    # PROBLEM TYPE DETECTION
    # ============================================================================
    
    def _is_structured_mcq(self, full_problem_data: dict) -> bool:
        """Check if problem is structured MCQ (options with id/text objects)"""
        options = full_problem_data.get('options')
        if not options or not isinstance(options, list) or len(options) == 0:
            return False
        return isinstance(options[0], dict) and 'id' in options[0] and 'text' in options[0]
    
    def _is_legacy_mcq(self, problem_data: dict) -> bool:
        """Check if problem is legacy MCQ (string array options)"""
        options = problem_data.get('options')
        if not options or not isinstance(options, list) or len(options) == 0:
            return False
        return isinstance(options[0], str)
    
    def _is_fill_in_blank(self, full_problem_data: dict) -> bool:
        """Check if problem is fill-in-the-blank"""
        return bool(full_problem_data.get('text_with_blanks') and full_problem_data.get('blanks'))
    
    def _is_matching(self, full_problem_data: dict) -> bool:
        """Check if problem is matching"""
        return bool(full_problem_data.get('left_items') and full_problem_data.get('right_items'))
    
    def _is_true_false(self, full_problem_data: dict) -> bool:
        """Check if problem is true/false"""
        return bool(full_problem_data.get('statement') and full_problem_data.get('correct') is not None)
    
    def _is_interactive(self, submission: ProblemSubmission) -> bool:
        """Check if problem is interactive"""
        return (submission.problem.get('problem_type') == 'interactive' or 
                submission.primitive_response is not None)
    
    # ============================================================================
    # SUBMISSION HANDLERS
    # ============================================================================
    
    async def _handle_structured_mcq(
        self, 
        submission: ProblemSubmission, 
        user_context: dict
    ) -> SubmissionResult:
        """Handle structured MCQ problems (with id/text option objects)"""
        student_id = user_context["student_id"]
        problem_data = submission.problem.get('problem_data', {})
        full_problem_data = problem_data.get('full_problem_data', {})
        
        # Convert to MCQ format
        mcq_data = MCQResponse(
            id=submission.problem.get('id', 'mcq_package'),
            subject=submission.problem.get('subject', 'Unknown'),
            unit_id=submission.problem.get('unit_id', 'default_unit'),
            skill_id=submission.problem.get('skill_id', 'default_skill'),
            subskill_id=submission.problem.get('subskill_id', 'default_subskill'),
            difficulty=full_problem_data.get('difficulty', 'medium'),
            question=full_problem_data.get('question', ''),
            options=[MCQOption(id=opt['id'], text=opt['text']) for opt in full_problem_data['options']],
            correct_option_id=full_problem_data.get('correct_option_id', 'A'),
            rationale=full_problem_data.get('rationale', ''),
            metadata=full_problem_data.get('metadata', {})
        )
        
        # Extract selected option ID from student_answer
        selected_option_id = submission.student_answer or 'A'
        
        # Evaluate MCQ
        is_correct = selected_option_id == mcq_data.correct_option_id
        selected_option = next((opt for opt in mcq_data.options if opt.id == selected_option_id), mcq_data.options[0])
        correct_option = next((opt for opt in mcq_data.options if opt.id == mcq_data.correct_option_id), mcq_data.options[0])
        
        # Create review
        review = {
            "evaluation": {"score": 10 if is_correct else 3},
            "feedback": {
                "praise": "Excellent work!" if is_correct else "Good effort!",
                "guidance": mcq_data.rationale if not is_correct else "You got it right!"
            },
            "correct": is_correct,
            "score": 10 if is_correct else 3,
            "selected_option_id": selected_option_id,
            "correct_option_id": mcq_data.correct_option_id,
            "selected_option_text": selected_option.text,
            "correct_option_text": correct_option.text
        }
        
        # Update competency
        competency_result = await self._update_competency(
            student_id, mcq_data.skill_id, mcq_data.subskill_id, is_correct
        )
        
        # Save both attempt and review to CosmosDB
        if self.cosmos_db:
            await self._save_attempt_and_review(
                submission, user_context, review, mcq_data.dict()
            )
        
        return SubmissionResult(
            review=review, 
            competency=competency_result,
            student_id=student_id,
            user_id=user_context["firebase_uid"],
            points_earned=10 if is_correct else 3,
            encouraging_message="Great job!" if is_correct else "Keep practicing!"
        )
    
    async def _handle_legacy_mcq(
        self, 
        submission: ProblemSubmission, 
        user_context: dict
    ) -> SubmissionResult:
        """Handle legacy MCQ problems (string array options)"""
        student_id = user_context["student_id"]
        problem_data = submission.problem.get('problem_data', {})
        
        correct_answer = problem_data.get('correct_answer') or problem_data.get('answer')
        student_answer = submission.student_answer
        is_correct = student_answer == correct_answer
        
        # Use existing review service for evaluation
        image_data = self._extract_image_data(submission.solution_image)
        review = await self.review_service.review_problem(
            student_id=student_id,
            subject=submission.subject,
            problem=problem_data,
            solution_image_base64=image_data,
            skill_id=submission.skill_id,
            subskill_id=submission.subskill_id,
            student_answer=student_answer,
            canvas_used=submission.canvas_used
        )
        
        # Update competency
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
            encouraging_message="Great job!" if is_correct else "Keep practicing!"
        )
    
    async def _handle_structured_problem(
        self, 
        submission: ProblemSubmission, 
        user_context: dict, 
        problem_type: str
    ) -> SubmissionResult:
        """Generic handler for structured problems (fill-in-blank, matching, true/false)"""
        student_id = user_context["student_id"]
        problem_data = submission.problem.get('problem_data', {})
        full_problem_data = problem_data.get('full_problem_data', {})
        
        # Build problem context
        problem_context = self._build_problem_context(full_problem_data, problem_type)
        
        # Get review using existing service
        image_data = self._extract_image_data(submission.solution_image)
        # Build problem dict for review service
        problem_dict = {
            'problem': problem_context,
            'answer': str(full_problem_data.get('correct_answer', 'See problem context')),
            'id': submission.problem.get('id', 'structured_problem')
        }
        review = await self.review_service.review_problem(
            student_id=student_id,
            subject=submission.subject,
            problem=problem_dict,
            solution_image_base64=image_data,
            skill_id=submission.skill_id,
            subskill_id=submission.subskill_id,
            student_answer=submission.student_answer or "No written answer provided",
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
                submission, user_context, review, full_problem_data
            )
        
        return SubmissionResult(
            review=review, 
            competency=competency_result,
            student_id=student_id,
            user_id=user_context["firebase_uid"],
            points_earned=10 if is_correct else 3,
            encouraging_message="Great job!" if is_correct else "Keep practicing!"
        )
    
    async def _handle_interactive(
        self, 
        submission: ProblemSubmission, 
        user_context: dict
    ) -> SubmissionResult:
        """Handle interactive problems"""
        # Mock success response for now - TODO: implement real evaluation
        review = {
            "evaluation": {"score": 9.5},
            "feedback": {"praise": "Excellent work on the interactive problem!", "guidance": "You correctly identified the answer."},
            "correct": True,
            "score": 9.5,
        }
        
        # Update competency
        student_id = user_context["student_id"]
        competency_result = await self._update_competency(
            student_id,
            submission.problem.get('skill_id', 'default_skill'),
            submission.problem.get('subskill_id', 'default_subskill'),
            True
        )
        
        # Save both attempt and review to CosmosDB
        if self.cosmos_db:
            await self._save_attempt_and_review(
                submission, user_context, review, {"problem_type": "interactive"}
            )
        
        return SubmissionResult(
            review=review, 
            competency=competency_result,
            student_id=student_id,
            user_id=user_context["firebase_uid"],
            points_earned=10,
            encouraging_message="Excellent work on the interactive problem!"
        )
    
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
    
    def _build_problem_context(self, full_problem_data: dict, problem_type: str) -> str:
        """Build context string for structured problems"""
        context = f"This is a {problem_type} problem.\n"
        context += f"Problem: {full_problem_data.get('question', '')}\n"
        
        if problem_type == "fill-in-the-blank":
            context += f"Text with blanks: {full_problem_data.get('text_with_blanks', '')}\n"
            context += f"Expected answers: {full_problem_data.get('blanks', {})}\n"
        elif problem_type == "matching":
            context += f"Left items: {full_problem_data.get('left_items', [])}\n"
            context += f"Right items: {full_problem_data.get('right_items', [])}\n"
            context += f"Correct matches: {full_problem_data.get('correct_matches', {})}\n"
        elif problem_type == "true/false":
            context += f"Statement: {full_problem_data.get('statement', '')}\n"
            context += f"Correct answer: {full_problem_data.get('correct')}\n"
        
        return context
    
    def _build_composable_context(self, submission: ProblemSubmission) -> str:
        """Build enhanced context for composable problems"""
        try:
            import json
            primitive_responses = {}
            if submission.student_answer:
                primitive_responses = json.loads(submission.student_answer)
            
            context = "COMPOSABLE PROBLEM CONTEXT:\n"
            context += f"Template: {submission.problem.get('template', 'Unknown')}\n"
            context += f"Primitive responses: {primitive_responses}\n"
            context += "Please consider both the canvas drawing and any interactive primitive responses when evaluating."
            return context
        except:
            return "This is a composable problem with interactive elements."
    
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