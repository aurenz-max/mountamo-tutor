# backend/app/services/universal_validator.py
"""
Universal Validator Service

Provides type-safe validation for all standardized question formats.
Eliminates the need for type-specific validation logic.
"""

import logging
import json
from typing import Dict, Any, Optional, List
from ..shared.question_types import (
    Question, StudentResponse, QuestionEvaluation, QuestionType,
    MultipleChoiceQuestion, TrueFalseQuestion, CategorizationQuestion,
    SequencingQuestion, ShortAnswerQuestion, ScenarioQuestion,
    FillInBlanksQuestion, MatchingQuestion,
    MultipleChoiceResponse, TrueFalseResponse, CategorizationResponse,
    SequencingResponse, ShortAnswerResponse, ScenarioResponse,
    FillInBlanksResponse, MatchingResponse
)

logger = logging.getLogger(__name__)

class UniversalValidator:
    """Universal validator for all standardized question types"""

    @staticmethod
    def validate_submission(
        question: Question,
        student_response_data: Dict[str, Any],
        primitive_response: Optional[Dict[str, Any]] = None
    ) -> QuestionEvaluation:
        """
        Validate a student submission against a standardized question.

        Args:
            question: Standardized question object
            student_response_data: Raw student response data
            primitive_response: Optional primitive response data

        Returns:
            QuestionEvaluation with score, feedback, and correctness
        """
        logger.info(f"[UNIVERSAL_VALIDATOR] Starting validation for question {question.id} of type {question.type}")
        logger.debug(f"[UNIVERSAL_VALIDATOR] Student response data keys: {list(student_response_data.keys())}")
        logger.debug(f"[UNIVERSAL_VALIDATOR] Primitive response: {primitive_response}")

        try:
            # Parse student response based on question type
            logger.info(f"[UNIVERSAL_VALIDATOR] Parsing student response for {question.type}")
            student_response = UniversalValidator._parse_student_response(
                question, student_response_data, primitive_response
            )

            if not student_response:
                logger.error(f"[UNIVERSAL_VALIDATOR] Failed to parse student response for question {question.id}")
                return UniversalValidator._create_error_evaluation(
                    question, "Could not parse student response"
                )

            logger.info(f"[UNIVERSAL_VALIDATOR] Successfully parsed {student_response.__class__.__name__}")

            # Route to type-specific validator
            validator_map = {
                QuestionType.MULTIPLE_CHOICE: UniversalValidator._validate_multiple_choice,
                QuestionType.TRUE_FALSE: UniversalValidator._validate_true_false,
                QuestionType.CATEGORIZATION: UniversalValidator._validate_categorization,
                QuestionType.SEQUENCING: UniversalValidator._validate_sequencing,
                QuestionType.SHORT_ANSWER: UniversalValidator._validate_short_answer,
                QuestionType.SCENARIO: UniversalValidator._validate_scenario,
                QuestionType.FILL_IN_BLANKS: UniversalValidator._validate_fill_in_blanks,
                QuestionType.MATCHING: UniversalValidator._validate_matching,
            }

            validator = validator_map.get(question.type)
            if not validator:
                logger.error(f"[UNIVERSAL_VALIDATOR] No validator found for question type: {question.type}")
                return UniversalValidator._create_error_evaluation(
                    question, f"No validator for question type: {question.type}"
                )

            logger.info(f"[UNIVERSAL_VALIDATOR] Running {question.type} validator")
            evaluation = validator(question, student_response)
            logger.info(f"[UNIVERSAL_VALIDATOR] Validation complete - Score: {evaluation.score}, Correct: {evaluation.is_correct}")

            return evaluation

        except Exception as e:
            logger.error(f"[UNIVERSAL_VALIDATOR] Error validating submission: {str(e)}")
            import traceback
            logger.error(f"[UNIVERSAL_VALIDATOR] Traceback: {traceback.format_exc()}")
            return UniversalValidator._create_error_evaluation(
                question, f"Validation error: {str(e)}"
            )

    @staticmethod
    def _parse_student_response(
        question: Question,
        student_response_data: Dict[str, Any],
        primitive_response: Optional[Dict[str, Any]]
    ) -> Optional[StudentResponse]:
        """Parse raw student response data into standardized format"""
        logger.debug(f"[UNIVERSAL_VALIDATOR] Parsing response for {question.type} question {question.id}")

        try:
            question_id = question.id
            question_type = question.type

            # Extract answer from primitive_response or student_response_data
            if primitive_response:
                logger.debug(f"[UNIVERSAL_VALIDATOR] Processing primitive_response: {primitive_response}")

                if question_type == QuestionType.MULTIPLE_CHOICE:
                    selected_option_id = primitive_response.get('selected_option_id')
                    logger.debug(f"[UNIVERSAL_VALIDATOR] MCQ selected_option_id: {selected_option_id}")
                    if selected_option_id:
                        logger.info(f"[UNIVERSAL_VALIDATOR] MCQ using direct option ID: {selected_option_id}")
                        return MultipleChoiceResponse(
                            question_id=question_id,
                            answer=0,  # Placeholder for backward compatibility
                            selected_option_id=selected_option_id  # No conversion needed!
                        )

                elif question_type == QuestionType.TRUE_FALSE:
                    selected_answer = primitive_response.get('selected_answer')
                    logger.debug(f"[UNIVERSAL_VALIDATOR] TF selected_answer: {selected_answer}")
                    if selected_answer is not None:
                        if isinstance(selected_answer, str):
                            answer = selected_answer.lower() in ('true', 't', '1', 'yes')
                        else:
                            answer = bool(selected_answer)
                        logger.info(f"[UNIVERSAL_VALIDATOR] TF converted answer to: {answer}")
                        return TrueFalseResponse(
                            question_id=question_id,
                            answer=answer
                        )

                elif question_type == QuestionType.CATEGORIZATION:
                    student_categorization = (
                        primitive_response.get('student_categorization') or
                        primitive_response.get('answer') or
                        primitive_response
                    )
                    logger.debug(f"[UNIVERSAL_VALIDATOR] Categorization answer: {student_categorization}")
                    if isinstance(student_categorization, dict):
                        logger.info(f"[UNIVERSAL_VALIDATOR] Categorization processed {len(student_categorization)} items")
                        return CategorizationResponse(
                            question_id=question_id,
                            answer=student_categorization
                        )

                elif question_type == QuestionType.SEQUENCING:
                    sequencing_answer = (
                        primitive_response.get('sequence') or
                        primitive_response.get('answer') or
                        primitive_response.get('items')
                    )
                    logger.debug(f"[UNIVERSAL_VALIDATOR] Sequencing answer: {sequencing_answer}")
                    if isinstance(sequencing_answer, list):
                        logger.info(f"[UNIVERSAL_VALIDATOR] Sequencing processed {len(sequencing_answer)} items")
                        return SequencingResponse(
                            question_id=question_id,
                            answer=sequencing_answer
                        )

                elif question_type == QuestionType.FILL_IN_BLANKS:
                    fill_answer = (
                        primitive_response.get('blanks') or
                        primitive_response.get('answers') or
                        primitive_response.get('answer')
                    )
                    logger.debug(f"[UNIVERSAL_VALIDATOR] Fill-in-blanks answer: {fill_answer}")
                    if isinstance(fill_answer, list):
                        logger.info(f"[UNIVERSAL_VALIDATOR] Fill-in-blanks processed {len(fill_answer)} blanks")
                        return FillInBlanksResponse(
                            question_id=question_id,
                            answer=fill_answer
                        )

                elif question_type == QuestionType.MATCHING:
                    matching_answer = (
                        primitive_response.get('matches') or
                        primitive_response.get('answer') or
                        primitive_response.get('mappings')
                    )

                    # Handle student_matches format
                    if not matching_answer and 'student_matches' in primitive_response:
                        student_matches = primitive_response.get('student_matches', [])
                        logger.debug(f"[UNIVERSAL_VALIDATOR] Processing student_matches: {student_matches}")

                        # Convert student_matches list to dict format expected by MatchingResponse
                        # We need to convert IDs to text values to match the format used by the question
                        matching_dict = {}
                        for match in student_matches:
                            if isinstance(match, dict) and 'left_id' in match and 'right_id' in match:
                                left_id = match['left_id']
                                right_id = match['right_id']

                                # Convert IDs to text values using the question's items
                                if isinstance(question, MatchingQuestion):
                                    left_text = UniversalValidator._find_matching_text(left_id, question.metadata.get('original_problem_data', {}).get('left_items', []))
                                    right_text = UniversalValidator._find_matching_text(right_id, question.metadata.get('original_problem_data', {}).get('right_items', []))

                                    if left_text and right_text:
                                        matching_dict[left_text] = right_text
                                        logger.debug(f"[UNIVERSAL_VALIDATOR] Mapped {left_id}->'{left_text}' to {right_id}->'{right_text}'")
                                    else:
                                        logger.warning(f"[UNIVERSAL_VALIDATOR] Could not find text for IDs: {left_id}, {right_id}")

                        if matching_dict:
                            matching_answer = matching_dict
                            logger.info(f"[UNIVERSAL_VALIDATOR] Converted student_matches to matching dict: {matching_answer}")

                    logger.debug(f"[UNIVERSAL_VALIDATOR] Matching answer: {matching_answer}")
                    if isinstance(matching_answer, dict):
                        logger.info(f"[UNIVERSAL_VALIDATOR] Matching processed {len(matching_answer)} pairs")
                        return MatchingResponse(
                            question_id=question_id,
                            answer=matching_answer
                        )

                elif question_type in [QuestionType.SHORT_ANSWER, QuestionType.SCENARIO]:
                    text_answer = (
                        primitive_response.get('answer') or
                        primitive_response.get('text') or
                        primitive_response.get('response')
                    )
                    logger.debug(f"[UNIVERSAL_VALIDATOR] Text answer: {text_answer}")
                    if text_answer is not None:
                        logger.info(f"[UNIVERSAL_VALIDATOR] Text answer processed")
                        response_class = ScenarioResponse if question_type == QuestionType.SCENARIO else ShortAnswerResponse
                        return response_class(
                            question_id=question_id,
                            answer=str(text_answer)
                        )

            # Fallback to student_response_data
            logger.debug(f"[UNIVERSAL_VALIDATOR] Falling back to student_response_data")
            student_answer = student_response_data.get('student_answer')
            logger.debug(f"[UNIVERSAL_VALIDATOR] Fallback student_answer: {student_answer}")
            if student_answer is not None:
                if question_type == QuestionType.MULTIPLE_CHOICE:
                    if isinstance(student_answer, int):
                        logger.info(f"[UNIVERSAL_VALIDATOR] MCQ fallback - using int answer: {student_answer}")
                        return MultipleChoiceResponse(
                            question_id=question_id,
                            answer=student_answer,
                            selected_option_id=""  # No ID available in fallback
                        )
                    elif isinstance(student_answer, str):
                        # Handle string answers like "A", "B", etc.
                        if student_answer.isalpha() and len(student_answer) == 1:
                            answer_index = ord(student_answer.upper()) - ord('A')
                            logger.info(f"[UNIVERSAL_VALIDATOR] MCQ fallback - converted '{student_answer}' to index {answer_index}")
                            return MultipleChoiceResponse(
                                question_id=question_id,
                                answer=answer_index,
                                selected_option_id=""  # No ID available in fallback
                            )
                elif question_type == QuestionType.TRUE_FALSE:
                    if isinstance(student_answer, str):
                        answer = student_answer.lower() in ('true', 't', '1', 'yes')
                    else:
                        answer = bool(student_answer)
                    logger.info(f"[UNIVERSAL_VALIDATOR] TF fallback - converted to: {answer}")
                    return TrueFalseResponse(
                        question_id=question_id,
                        answer=answer
                    )
                elif question_type in [QuestionType.SHORT_ANSWER, QuestionType.SCENARIO]:
                    logger.info(f"[UNIVERSAL_VALIDATOR] Short answer fallback")
                    response_class = ScenarioResponse if question_type == QuestionType.SCENARIO else ShortAnswerResponse
                    return response_class(
                        question_id=question_id,
                        answer=str(student_answer)
                    )
                elif question_type == QuestionType.CATEGORIZATION:
                    # Try to parse student_answer as JSON for categorization
                    try:
                        if isinstance(student_answer, str):
                            cat_data = json.loads(student_answer)
                        elif isinstance(student_answer, dict):
                            cat_data = student_answer
                        else:
                            cat_data = {}
                        logger.info(f"[UNIVERSAL_VALIDATOR] Categorization fallback parsed")
                        return CategorizationResponse(
                            question_id=question_id,
                            answer=cat_data
                        )
                    except:
                        logger.warning(f"[UNIVERSAL_VALIDATOR] Could not parse categorization data: {student_answer}")
                elif question_type == QuestionType.SEQUENCING:
                    # Try to parse student_answer as list for sequencing
                    try:
                        if isinstance(student_answer, str):
                            seq_data = json.loads(student_answer)
                        elif isinstance(student_answer, list):
                            seq_data = student_answer
                        else:
                            seq_data = []
                        logger.info(f"[UNIVERSAL_VALIDATOR] Sequencing fallback parsed")
                        return SequencingResponse(
                            question_id=question_id,
                            answer=seq_data
                        )
                    except:
                        logger.warning(f"[UNIVERSAL_VALIDATOR] Could not parse sequencing data: {student_answer}")
                elif question_type == QuestionType.FILL_IN_BLANKS:
                    # Try to parse student_answer as list for fill-in-blanks
                    try:
                        if isinstance(student_answer, str):
                            fill_data = json.loads(student_answer)
                        elif isinstance(student_answer, list):
                            fill_data = student_answer
                        else:
                            fill_data = []
                        logger.info(f"[UNIVERSAL_VALIDATOR] Fill-in-blanks fallback parsed")
                        return FillInBlanksResponse(
                            question_id=question_id,
                            answer=fill_data
                        )
                    except:
                        logger.warning(f"[UNIVERSAL_VALIDATOR] Could not parse fill-in-blanks data: {student_answer}")
                elif question_type == QuestionType.MATCHING:
                    # Try to parse student_answer as dict for matching
                    try:
                        if isinstance(student_answer, str):
                            match_data = json.loads(student_answer)
                        elif isinstance(student_answer, dict):
                            match_data = student_answer
                        else:
                            match_data = {}
                        logger.info(f"[UNIVERSAL_VALIDATOR] Matching fallback parsed")
                        return MatchingResponse(
                            question_id=question_id,
                            answer=match_data
                        )
                    except:
                        logger.warning(f"[UNIVERSAL_VALIDATOR] Could not parse matching data: {student_answer}")

            logger.warning(f"[UNIVERSAL_VALIDATOR] Could not parse any response format for {question_type}")
            return None

        except Exception as e:
            logger.error(f"Error parsing student response: {str(e)}")
            return None

    @staticmethod
    def _validate_multiple_choice(
        question: MultipleChoiceQuestion,
        response: MultipleChoiceResponse
    ) -> QuestionEvaluation:
        """Validate multiple choice response using direct ID comparison"""

        # Use ID-based validation if available, fall back to index-based for compatibility
        if response.selected_option_id and question.correct_option_id:
            student_option_id = response.selected_option_id
            correct_option_id = question.correct_option_id

            # Direct ID comparison - no brittle conversion!
            is_correct = student_option_id == correct_option_id
            score = 10.0 if is_correct else 3.0

            # Get display texts for feedback
            student_text = question.get_option_text_by_id(student_option_id)
            correct_text = question.get_option_text_by_id(correct_option_id)

            logger.debug(f"[UNIVERSAL_VALIDATOR] MCQ Validation Details:")
            logger.debug(f"[UNIVERSAL_VALIDATOR]   Student option ID: {student_option_id}")
            logger.debug(f"[UNIVERSAL_VALIDATOR]   Correct option ID: {correct_option_id}")
            logger.debug(f"[UNIVERSAL_VALIDATOR]   Student selected: '{student_text}'")
            logger.debug(f"[UNIVERSAL_VALIDATOR]   Correct answer: '{correct_text}'")

            logger.info(f"[UNIVERSAL_VALIDATOR] MCQ Result: {'CORRECT' if is_correct else 'INCORRECT'} - Score: {score}")
            logger.info(f"[UNIVERSAL_VALIDATOR] Student: {student_text} | Correct: {correct_text}")

            return QuestionEvaluation(
                question_id=question.id,
                question_type=question.type,
                is_correct=is_correct,
                score=score,
                feedback=question.rationale if not is_correct else "Correct! Well done!",
                student_answer=student_text,
                correct_answer=correct_text,
                explanation=question.teaching_note
            )

        else:
            # Fallback to index-based validation for backward compatibility
            logger.debug(f"[UNIVERSAL_VALIDATOR] MCQ Fallback to index-based validation")
            logger.debug(f"[UNIVERSAL_VALIDATOR]   Student answer index: {response.answer}")
            logger.debug(f"[UNIVERSAL_VALIDATOR]   Correct answer index: {question.correct_answer}")
            logger.debug(f"[UNIVERSAL_VALIDATOR]   Total options: {len(question.options)}")

            is_correct = response.answer == question.correct_answer
            score = 10.0 if is_correct else 3.0

            student_answer_text = ""
            correct_answer_text = ""

            if 0 <= response.answer < len(question.options):
                student_answer_text = question.options[response.answer]
                logger.debug(f"[UNIVERSAL_VALIDATOR]   Student selected: '{student_answer_text}' (index {response.answer})")

            if 0 <= question.correct_answer < len(question.options):
                correct_answer_text = question.options[question.correct_answer]
                logger.debug(f"[UNIVERSAL_VALIDATOR]   Correct answer: '{correct_answer_text}' (index {question.correct_answer})")

            logger.info(f"[UNIVERSAL_VALIDATOR] MCQ Result: {'CORRECT' if is_correct else 'INCORRECT'} - Score: {score}")
            logger.info(f"[UNIVERSAL_VALIDATOR] Student: {student_answer_text} | Correct: {correct_answer_text}")

            return QuestionEvaluation(
                question_id=question.id,
                question_type=question.type,
                is_correct=is_correct,
                score=score,
                feedback=question.rationale if not is_correct else "Correct! Well done!",
                student_answer=student_answer_text,
                correct_answer=correct_answer_text,
                explanation=question.teaching_note
            )

    @staticmethod
    def _validate_true_false(
        question: TrueFalseQuestion,
        response: TrueFalseResponse
    ) -> QuestionEvaluation:
        """Validate true/false response"""
        is_correct = response.answer == question.correct_answer
        score = 10.0 if is_correct else 3.0

        feedback = question.rationale if not is_correct else "Correct! Well done!"

        return QuestionEvaluation(
            question_id=question.id,
            question_type=question.type,
            is_correct=is_correct,
            score=score,
            feedback=feedback,
            student_answer=str(response.answer),
            correct_answer=str(question.correct_answer),
            explanation=question.teaching_note
        )

    @staticmethod
    def _validate_categorization(
        question: CategorizationQuestion,
        response: CategorizationResponse
    ) -> QuestionEvaluation:
        """Validate categorization response"""
        logger.debug(f"[UNIVERSAL_VALIDATOR] Categorization Validation Details:")
        logger.debug(f"[UNIVERSAL_VALIDATOR]   Student answer: {response.answer}")
        logger.debug(f"[UNIVERSAL_VALIDATOR]   Correct answer: {question.correct_answer}")

        correct_count = 0
        total_items = len(question.items)

        for item in question.items:
            student_category = response.answer.get(item, "")
            correct_category = question.correct_answer.get(item, "")
            is_item_correct = student_category == correct_category
            if is_item_correct:
                correct_count += 1
            logger.debug(f"[UNIVERSAL_VALIDATOR]   '{item}' -> Student: '{student_category}' | Correct: '{correct_category}' | {'✓' if is_item_correct else '✗'}")

        is_correct = correct_count == total_items and total_items > 0
        score = 10.0 if is_correct else max(3.0, (correct_count / total_items) * 10) if total_items > 0 else 3.0

        logger.info(f"[UNIVERSAL_VALIDATOR] Categorization Result: {correct_count}/{total_items} correct - {'CORRECT' if is_correct else 'INCORRECT'} - Score: {score}")

        feedback = (
            f"You correctly categorized {correct_count} out of {total_items} items. "
            + (question.rationale if not is_correct else "Excellent work!")
        )

        return QuestionEvaluation(
            question_id=question.id,
            question_type=question.type,
            is_correct=is_correct,
            score=score,
            feedback=feedback,
            student_answer=str(response.answer),
            correct_answer=str(question.correct_answer),
            explanation=question.teaching_note
        )

    @staticmethod
    def _validate_sequencing(
        question: SequencingQuestion,
        response: SequencingResponse
    ) -> QuestionEvaluation:
        """Validate sequencing response"""
        is_correct = response.answer == question.correct_answer

        # Calculate partial credit based on correct positions
        correct_positions = 0
        if len(response.answer) == len(question.correct_answer):
            for i, item in enumerate(response.answer):
                if i < len(question.correct_answer) and item == question.correct_answer[i]:
                    correct_positions += 1

        score = 10.0 if is_correct else max(3.0, (correct_positions / len(question.correct_answer)) * 10)

        feedback = question.rationale if not is_correct else "Perfect sequence! Well done!"

        return QuestionEvaluation(
            question_id=question.id,
            question_type=question.type,
            is_correct=is_correct,
            score=score,
            feedback=feedback,
            student_answer=str(response.answer),
            correct_answer=str(question.correct_answer),
            explanation=question.teaching_note
        )

    @staticmethod
    def _validate_short_answer(
        question: ShortAnswerQuestion,
        response: ShortAnswerResponse
    ) -> QuestionEvaluation:
        """Validate short answer response"""
        student_answer = response.answer.strip().lower()
        correct_answer = question.correct_answer.strip().lower()

        # Simple string matching for now - could be enhanced with fuzzy matching
        is_correct = student_answer == correct_answer

        # Partial credit for close answers if enabled
        if not is_correct and question.accept_partial:
            if correct_answer in student_answer or student_answer in correct_answer:
                score = 7.0
                is_correct = True  # Consider partial matches as correct
            else:
                score = 3.0
        else:
            score = 10.0 if is_correct else 3.0

        feedback = question.rationale if not is_correct else "Great answer!"

        return QuestionEvaluation(
            question_id=question.id,
            question_type=question.type,
            is_correct=is_correct,
            score=score,
            feedback=feedback,
            student_answer=response.answer,
            correct_answer=question.correct_answer,
            explanation=question.teaching_note
        )

    @staticmethod
    def _validate_scenario(
        question: ScenarioQuestion,
        response: ScenarioResponse
    ) -> QuestionEvaluation:
        """Validate scenario response"""
        # For now, use simple string matching - could be enhanced with AI evaluation
        student_answer = response.answer.strip().lower()
        correct_answer = question.correct_answer.strip().lower()

        is_correct = correct_answer in student_answer or student_answer in correct_answer
        score = 10.0 if is_correct else 3.0

        feedback = question.rationale if not is_correct else "Excellent reasoning!"

        return QuestionEvaluation(
            question_id=question.id,
            question_type=question.type,
            is_correct=is_correct,
            score=score,
            feedback=feedback,
            student_answer=response.answer,
            correct_answer=question.correct_answer,
            explanation=question.teaching_note
        )

    @staticmethod
    def _validate_fill_in_blanks(
        question: FillInBlanksQuestion,
        response: FillInBlanksResponse
    ) -> QuestionEvaluation:
        """Validate fill-in-blanks response"""
        correct_count = 0
        total_blanks = len(question.correct_answers)

        for i, student_answer in enumerate(response.answer):
            if i < len(question.correct_answers):
                correct_answer = question.correct_answers[i]
                if question.case_sensitive:
                    is_blank_correct = student_answer.strip() == correct_answer.strip()
                else:
                    is_blank_correct = student_answer.strip().lower() == correct_answer.strip().lower()

                if is_blank_correct:
                    correct_count += 1

        is_correct = correct_count == total_blanks and total_blanks > 0
        score = 10.0 if is_correct else max(3.0, (correct_count / total_blanks) * 10) if total_blanks > 0 else 3.0

        feedback = (
            f"You filled {correct_count} out of {total_blanks} blanks correctly. "
            + (question.rationale if not is_correct else "Perfect!")
        )

        return QuestionEvaluation(
            question_id=question.id,
            question_type=question.type,
            is_correct=is_correct,
            score=score,
            feedback=feedback,
            student_answer=str(response.answer),
            correct_answer=str(question.correct_answers),
            explanation=question.teaching_note
        )

    @staticmethod
    def _validate_matching(
        question: MatchingQuestion,
        response: MatchingResponse
    ) -> QuestionEvaluation:
        """Validate matching response"""
        logger.debug(f"[UNIVERSAL_VALIDATOR] Matching Validation Details:")
        logger.debug(f"[UNIVERSAL_VALIDATOR]   Student answer: {response.answer}")
        logger.debug(f"[UNIVERSAL_VALIDATOR]   Correct answer: {question.correct_answer}")

        correct_count = 0
        total_matches = len(question.correct_answer)

        for left_item, correct_right_item in question.correct_answer.items():
            student_right_item = response.answer.get(left_item, "")
            is_match_correct = student_right_item == correct_right_item
            if is_match_correct:
                correct_count += 1
            logger.debug(f"[UNIVERSAL_VALIDATOR]   '{left_item}' -> Student: '{student_right_item}' | Correct: '{correct_right_item}' | {'✓' if is_match_correct else '✗'}")

        is_correct = correct_count == total_matches and total_matches > 0
        score = 10.0 if is_correct else max(3.0, (correct_count / total_matches) * 10) if total_matches > 0 else 3.0

        logger.info(f"[UNIVERSAL_VALIDATOR] Matching Result: {correct_count}/{total_matches} correct - {'CORRECT' if is_correct else 'INCORRECT'} - Score: {score}")

        feedback = (
            f"You matched {correct_count} out of {total_matches} pairs correctly. "
            + (question.rationale if not is_correct else "Excellent matching!")
        )

        return QuestionEvaluation(
            question_id=question.id,
            question_type=question.type,
            is_correct=is_correct,
            score=score,
            feedback=feedback,
            student_answer=str(response.answer),
            correct_answer=str(question.correct_answer),
            explanation=question.teaching_note
        )

    @staticmethod
    def _find_matching_text(item_id: str, items: List[Dict[str, Any]]) -> Optional[str]:
        """Helper to find item text by ID for matching questions"""
        for item in items:
            if isinstance(item, dict) and item.get('id') == item_id:
                return item.get('text', '')
        return None

    @staticmethod
    def _create_error_evaluation(question: Question, error_message: str) -> QuestionEvaluation:
        """Create an error evaluation for failed validations"""
        return QuestionEvaluation(
            question_id=question.id,
            question_type=question.type,
            is_correct=False,
            score=0.0,
            feedback=f"Error: {error_message}",
            student_answer="Error processing response",
            correct_answer="Error processing question",
            explanation="Please try again or contact support"
        )