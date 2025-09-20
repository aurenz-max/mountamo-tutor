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

        # Debug logging
        logger.info(f"Problem type detection - problem_id: {submission.problem.get('id')}")
        logger.info(f"Problem structure keys: {list(submission.problem.keys())}")
        logger.info(f"Problem data keys: {list(problem_data.keys()) if problem_data else 'None'}")
        logger.info(f"Full problem data keys: {list(full_problem_data.keys()) if full_problem_data else 'None'}")

        try:
            # First check if we have explicit problem_type in the top-level problem
            problem_type = submission.problem.get('problem_type')
            if problem_type:
                logger.info(f"Found explicit problem_type: {problem_type}")
                if problem_type == "multiple_choice":
                    logger.info("Processing multiple choice problem by explicit type")
                    return await self._handle_structured_mcq(submission, user_context)
                elif problem_type == "true_false":
                    logger.info("Processing true/false problem by explicit type")
                    return await self._handle_structured_true_false(submission, user_context)
                elif problem_type == "categorization_activity":
                    logger.info("Processing categorization problem by explicit type")
                    return await self._handle_categorization(submission, user_context)
                elif problem_type == "fill_in_blanks":
                    logger.info("Processing fill-in-blanks problem by explicit type")
                    return await self._handle_structured_problem(submission, user_context, "fill-in-the-blank")
                elif problem_type == "matching_activity":
                    logger.info("Processing matching problem by explicit type")
                    return await self._handle_structured_problem(submission, user_context, "matching")

            # Fallback to structure-based detection for legacy problems
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
                return await self._handle_structured_true_false(submission, user_context)

            elif self._is_categorization(full_problem_data, submission.problem):
                logger.info("Processing categorization problem submission")
                return await self._handle_categorization(submission, user_context)

            # Check for interactive problem
            elif self._is_interactive(submission):
                logger.info("Processing interactive problem submission")
                return await self._handle_interactive(submission, user_context)

            # Default to drawing problem
            else:
                logger.info("Processing drawing-based problem submission")
                logger.info(f"No detection match found - falling back to drawing handler")
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

    def _is_categorization(self, full_problem_data: dict, problem: dict) -> bool:
        """Check if problem is categorization"""
        is_cat = (problem.get('problem_type') == 'categorization_activity' or
                bool(full_problem_data.get('categorization_items') and full_problem_data.get('categories')) or
                bool(problem.get('categorization_items') and problem.get('categories')))

        if is_cat:
            logger.info(f"Detected categorization problem: type={problem.get('problem_type')}, items={bool(problem.get('categorization_items'))}")

        return is_cat

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

        # For assessment problems, data is at top level. For practice problems, it's nested.
        if submission.problem.get('problem_type') == 'multiple_choice':
            # Assessment problem structure - data at top level
            source_data = submission.problem
            logger.info("Using top-level assessment MCQ structure")
        else:
            # Practice problem structure - data in full_problem_data
            source_data = full_problem_data
            logger.info("Using nested practice MCQ structure")

        # Convert to MCQ format
        mcq_data = MCQResponse(
            id=submission.problem.get('id', 'mcq_package'),
            subject=submission.problem.get('subject', 'Unknown'),
            unit_id=submission.problem.get('unit_id', 'default_unit'),
            skill_id=submission.problem.get('skill_id', 'default_skill'),
            subskill_id=submission.problem.get('subskill_id', 'default_subskill'),
            difficulty=source_data.get('difficulty', 'medium'),
            question=source_data.get('question', ''),
            options=[MCQOption(id=opt['id'], text=opt['text']) for opt in source_data.get('options', [])],
            correct_option_id=source_data.get('correct_option_id', 'A'),
            rationale=source_data.get('rationale', ''),
            metadata=source_data.get('metadata', {})
        )
        
        # Extract selected option ID from primitive_response
        if submission.primitive_response and isinstance(submission.primitive_response, dict):
            selected_option_id = submission.primitive_response.get('selected_option_id')
        else:
            selected_option_id = submission.student_answer

        if not selected_option_id:
            raise ValueError("No option selected - primitive_response.selected_option_id is required for MCQ submissions")
        
        # Evaluate MCQ
        is_correct = selected_option_id == mcq_data.correct_option_id
        selected_option = next((opt for opt in mcq_data.options if opt.id == selected_option_id), None)
        correct_option = next((opt for opt in mcq_data.options if opt.id == mcq_data.correct_option_id), None)

        if not selected_option:
            raise ValueError(f"Selected option ID '{selected_option_id}' not found in available options")
        if not correct_option:
            raise ValueError(f"Correct option ID '{mcq_data.correct_option_id}' not found in available options")
        
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

    async def _handle_structured_true_false(
        self,
        submission: ProblemSubmission,
        user_context: dict
    ) -> SubmissionResult:
        """Handle structured true/false problems"""
        student_id = user_context["student_id"]
        problem_data = submission.problem.get('problem_data', {})
        full_problem_data = problem_data.get('full_problem_data', {})

        # For assessment problems, data is at top level. For practice problems, it's nested.
        if submission.problem.get('problem_type') == 'true_false':
            # Assessment problem structure - data at top level
            source_data = submission.problem
            logger.info("Using top-level assessment True/False structure")
        else:
            # Practice problem structure - data in full_problem_data
            source_data = full_problem_data
            logger.info("Using nested practice True/False structure")

        # Extract selected answer from primitive_response
        if submission.primitive_response and isinstance(submission.primitive_response, dict):
            selected_answer = submission.primitive_response.get('selected_answer')
        else:
            selected_answer = submission.student_answer

        if selected_answer is None:
            raise ValueError("No answer selected - primitive_response.selected_answer is required for True/False submissions")

        # Convert string to boolean if needed
        if isinstance(selected_answer, str):
            selected_answer = selected_answer.lower() in ('true', 't', '1', 'yes')

        # Get correct answer
        correct_answer = source_data.get('correct')
        if correct_answer is None:
            raise ValueError("No correct answer found in problem data")

        # Evaluate correctness
        is_correct = selected_answer == correct_answer

        # Create review
        review = {
            "evaluation": {"score": 10 if is_correct else 3},
            "feedback": {
                "praise": "Excellent work!" if is_correct else "Good effort!",
                "guidance": source_data.get('rationale', 'Review the concept') if not is_correct else "You got it right!"
            },
            "correct": is_correct,
            "score": 10 if is_correct else 3,
            "selected_answer": selected_answer,
            "correct_answer": correct_answer,
            "explanation": submission.primitive_response.get('explanation', '') if submission.primitive_response else ''
        }

        # Update competency
        competency_result = await self._update_competency(
            student_id,
            source_data.get('skill_id', 'default_skill'),
            source_data.get('subskill_id', 'default_subskill'),
            is_correct
        )

        # Save both attempt and review to CosmosDB
        if self.cosmos_db:
            await self._save_attempt_and_review(
                submission, user_context, review, source_data
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

        # For assessment problems, data is at top level. For practice problems, it's nested.
        if submission.problem.get('problem_type') in ['true_false', 'fill_in_blanks', 'matching_activity']:
            # Assessment problem structure - data at top level
            source_data = submission.problem
            logger.info(f"Using top-level assessment {problem_type} structure")
        else:
            # Practice problem structure - data in full_problem_data
            source_data = full_problem_data
            logger.info(f"Using nested practice {problem_type} structure")

        # Build problem context
        problem_context = self._build_problem_context(source_data, problem_type)
        
        # Get review using existing service
        image_data = self._extract_image_data(submission.solution_image)
        # Build problem dict for review service
        problem_dict = {
            'problem': problem_context,
            'answer': str(source_data.get('correct_answer', source_data.get('correct', 'See problem context'))),
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
                submission, user_context, review, source_data
            )
        
        return SubmissionResult(
            review=review,
            competency=competency_result,
            student_id=student_id,
            user_id=user_context["firebase_uid"],
            points_earned=10 if is_correct else 3,
            encouraging_message="Great job!" if is_correct else "Keep practicing!"
        )

    async def _handle_categorization(
        self,
        submission: ProblemSubmission,
        user_context: dict
    ) -> SubmissionResult:
        """Handle categorization activity problems"""
        student_id = user_context["student_id"]
        problem_data = submission.problem.get('problem_data', {})
        full_problem_data = problem_data.get('full_problem_data', {})

        # If full_problem_data is empty, try to get data from top level problem
        if not full_problem_data:
            full_problem_data = submission.problem

        # Try to get categorization items from multiple possible locations
        categorization_items = (full_problem_data.get('categorization_items') or
                              submission.problem.get('categorization_items', []))

        # Extract student categorization from primitive_response
        student_categorization = {}
        if submission.primitive_response and isinstance(submission.primitive_response, dict):
            # Try both formats: with and without 'student_categorization' wrapper
            student_categorization = (submission.primitive_response.get('student_categorization') or
                                    submission.primitive_response)

        # Evaluate correctness
        correct_count = 0
        total_items = len(categorization_items)

        for item in categorization_items:
            item_text = item.get('item_text')
            correct_category = item.get('correct_category')
            student_category = student_categorization.get(item_text)

            if student_category == correct_category:
                correct_count += 1

        is_correct = correct_count == total_items and total_items > 0
        score = 10 if is_correct else 3

        # Create detailed review
        review = {
            "observation": {
                "canvas_description": "No canvas work for this categorization question",
                "selected_answer": str(student_categorization),
                "work_shown": "Student categorized items into provided categories"
            },
            "analysis": {
                "understanding": "Good understanding demonstrated" if is_correct else "Student needs additional practice with this concept.",
                "approach": "Student attempted to answer the question." if student_categorization else "No approach shown",
                "accuracy": "Correct answer" if is_correct else "Incorrect answer",
                "creativity": "Standard categorization response"
            },
            "evaluation": {
                "score": score,
                "justification": f"Student correctly categorized {correct_count} out of {total_items} items"
            },
            "feedback": {
                "praise": "Good work!" if is_correct else "Good effort on this question!",
                "guidance": full_problem_data.get('rationale', 'Review the concept') if not is_correct else "Well done!",
                "encouragement": "Keep practicing!" if not is_correct else "Excellent!",
                "next_steps": "Continue to next question" if is_correct else "Review this topic"
            },
            "skill_id": submission.skill_id or full_problem_data.get('skill_id') or submission.problem.get('skill_id', 'unknown'),
            "subject": submission.subject or full_problem_data.get('subject') or submission.problem.get('subject', 'unknown'),
            "subskill_id": submission.subskill_id or full_problem_data.get('subskill_id') or submission.problem.get('subskill_id', 'unknown'),
            "score": score,
            "correct": is_correct,
            "accuracy_percentage": 100 if is_correct else 30,
            "selected_answer_text": str(student_categorization) if student_categorization else "Not answered"
        }

        # Update competency
        competency_result = await self._update_competency(
            student_id,
            submission.skill_id or full_problem_data.get('skill_id') or submission.problem.get('skill_id', 'default_skill'),
            submission.subskill_id or full_problem_data.get('subskill_id') or submission.problem.get('subskill_id', 'default_subskill'),
            is_correct,
            submission.subject or submission.problem.get('subject', 'math')
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
    
    def _build_problem_context(self, problem_data: dict, problem_type: str) -> str:
        """Build context string for structured problems"""
        context = f"This is a {problem_type} problem.\n"

        # For true/false problems, use 'statement' field, otherwise use 'question'
        question_text = problem_data.get('statement', '') or problem_data.get('question', '')
        context += f"Problem: {question_text}\n"

        if problem_type == "fill-in-the-blank":
            context += f"Text with blanks: {problem_data.get('text_with_blanks', '')}\n"
            context += f"Expected answers: {problem_data.get('blanks', {})}\n"
        elif problem_type == "matching":
            context += f"Left items: {problem_data.get('left_items', [])}\n"
            context += f"Right items: {problem_data.get('right_items', [])}\n"
            context += f"Correct matches: {problem_data.get('correct_matches', {})}\n"
        elif problem_type == "true/false":
            context += f"Statement: {problem_data.get('statement', '')}\n"
            context += f"Correct answer: {problem_data.get('correct')}\n"

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