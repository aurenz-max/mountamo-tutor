# backend/app/services/problem_converter.py
"""
Problem Converter Service

Converts all PRACTICE_PROBLEMS_SCHEMA primitives to standardized question format.
Eliminates the need for type-specific detection and handling logic.
"""

import logging
from typing import Dict, Any, Optional, List
from ..shared.question_types import (
    Question, QuestionType,
    MultipleChoiceQuestion, TrueFalseQuestion, CategorizationQuestion,
    SequencingQuestion, ShortAnswerQuestion, ScenarioQuestion,
    FillInBlanksQuestion, MatchingQuestion
)

logger = logging.getLogger(__name__)

class ProblemConverter:
    """Converts problem primitives to standardized question format"""

    @staticmethod
    def convert_to_standard_question(problem_data: Dict[str, Any]) -> Optional[Question]:
        """
        Convert any problem primitive to standardized question format.

        Args:
            problem_data: Raw problem data from any source (assessment, practice, etc.)

        Returns:
            Standardized Question object or None if conversion fails
        """
        logger.info(f"[PROBLEM_CONVERTER] Starting conversion for problem with keys: {list(problem_data.keys())}")

        try:
            # Determine the problem type and data location
            problem_type, source_data = ProblemConverter._extract_problem_type_and_data(problem_data)

            if not problem_type or not source_data:
                logger.error(f"[PROBLEM_CONVERTER] Could not determine problem type from: {list(problem_data.keys())}")
                logger.debug(f"[PROBLEM_CONVERTER] Problem structure: {problem_data}")
                return None

            logger.info(f"[PROBLEM_CONVERTER] Detected problem type: {problem_type}")
            logger.debug(f"[PROBLEM_CONVERTER] Source data keys: {list(source_data.keys())}")

            # Extract common metadata
            metadata = ProblemConverter._extract_metadata(problem_data, source_data)
            logger.debug(f"[PROBLEM_CONVERTER] Extracted metadata: {metadata}")

            # Route to specific converter based on type
            converter_map = {
                "multiple_choice": ProblemConverter._convert_multiple_choice,
                "true_false": ProblemConverter._convert_true_false,
                "categorization_activity": ProblemConverter._convert_categorization,
                "sequencing_activity": ProblemConverter._convert_sequencing,
                "short_answer": ProblemConverter._convert_short_answer,
                "scenario_question": ProblemConverter._convert_scenario,
                "fill_in_blanks": ProblemConverter._convert_fill_in_blanks,
                "matching_activity": ProblemConverter._convert_matching,
            }

            converter = converter_map.get(problem_type)
            if not converter:
                logger.error(f"[PROBLEM_CONVERTER] No converter found for problem type: {problem_type}")
                return None

            logger.info(f"[PROBLEM_CONVERTER] Running {problem_type} converter")
            result = converter(source_data, metadata)
            logger.info(f"[PROBLEM_CONVERTER] Successfully converted to {result.__class__.__name__}")

            return result

        except Exception as e:
            logger.error(f"[PROBLEM_CONVERTER] Error converting problem to standard format: {str(e)}")
            import traceback
            logger.error(f"[PROBLEM_CONVERTER] Traceback: {traceback.format_exc()}")
            return None

    @staticmethod
    def _extract_problem_type_and_data(problem_data: Dict[str, Any]) -> tuple[Optional[str], Optional[Dict[str, Any]]]:
        """
        Extract problem type and source data from various problem structures.
        Handles both assessment (top-level) and practice (nested) formats.
        """
        # Check for explicit problem_type at top level (assessment format)
        if problem_data.get('problem_type'):
            return problem_data['problem_type'], problem_data

        # Check nested structure (practice format)
        nested_data = problem_data.get('problem_data', {}).get('full_problem_data', {})
        if nested_data:
            # Try to detect type from structure - order matters for specificity
            if nested_data.get('text_with_blanks') and nested_data.get('blanks'):
                return "fill_in_blanks", nested_data
            elif nested_data.get('left_items') and nested_data.get('right_items') and nested_data.get('mappings'):
                return "matching_activity", nested_data
            elif nested_data.get('categorization_items') and nested_data.get('categories'):
                return "categorization_activity", nested_data
            elif nested_data.get('items') and nested_data.get('instruction') and not nested_data.get('categories'):
                return "sequencing_activity", nested_data
            elif nested_data.get('scenario') and nested_data.get('scenario_question'):
                return "scenario_question", nested_data
            elif nested_data.get('statement') and nested_data.get('correct') is not None:
                return "true_false", nested_data
            elif nested_data.get('options') and isinstance(nested_data.get('options'), list):
                if nested_data['options'] and isinstance(nested_data['options'][0], dict):
                    return "multiple_choice", nested_data
            elif nested_data.get('question') and not any([
                nested_data.get('options'), nested_data.get('statement'),
                nested_data.get('scenario'), nested_data.get('items')
            ]):
                return "short_answer", nested_data

        # Fallback: try to detect from top-level structure (direct problem data)
        if problem_data.get('text_with_blanks') and problem_data.get('blanks'):
            return "fill_in_blanks", problem_data
        elif problem_data.get('left_items') and problem_data.get('right_items') and problem_data.get('mappings'):
            return "matching_activity", problem_data
        elif problem_data.get('categorization_items') and problem_data.get('categories'):
            return "categorization_activity", problem_data
        elif problem_data.get('items') and problem_data.get('instruction') and not problem_data.get('categories'):
            return "sequencing_activity", problem_data
        elif problem_data.get('scenario') and problem_data.get('scenario_question'):
            return "scenario_question", problem_data
        elif problem_data.get('statement') and problem_data.get('correct') is not None:
            return "true_false", problem_data
        elif problem_data.get('options') and isinstance(problem_data.get('options'), list):
            if problem_data['options'] and isinstance(problem_data['options'][0], dict):
                return "multiple_choice", problem_data
            elif problem_data['options'] and isinstance(problem_data['options'][0], str):
                # Legacy MCQ with string array options
                return "multiple_choice", problem_data
        elif problem_data.get('question') and not any([
            problem_data.get('options'), problem_data.get('statement'),
            problem_data.get('scenario'), problem_data.get('items')
        ]):
            return "short_answer", problem_data

        # Check if this is a problem generated directly from problems.py (rich schema format)
        # These come as arrays by type
        problem_types = ["multiple_choice", "true_false", "fill_in_blanks", "matching_activity",
                        "sequencing_activity", "categorization_activity", "scenario_question", "short_answer"]

        for problem_type in problem_types:
            if problem_type in problem_data and problem_data[problem_type]:
                # Take the first problem of this type
                first_problem = problem_data[problem_type][0]
                return problem_type, first_problem

        return None, None

    @staticmethod
    def _extract_metadata(problem_data: Dict[str, Any], source_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract common metadata from problem data"""
        return {
            "subject": problem_data.get('subject', source_data.get('subject', 'Unknown')),
            "skill_id": problem_data.get('skill_id', source_data.get('skill_id', 'default_skill')),
            "subskill_id": problem_data.get('subskill_id', source_data.get('subskill_id', 'default_subskill')),
            "difficulty": source_data.get('difficulty', 'medium'),
            "grade_level": source_data.get('grade_level', 'Kindergarten'),
            "original_problem_data": problem_data
        }

    @staticmethod
    def _convert_multiple_choice(source_data: Dict[str, Any], metadata: Dict[str, Any]) -> MultipleChoiceQuestion:
        """Convert multiple choice primitive to standard format with ID preservation"""
        options = source_data.get('options', [])
        logger.debug(f"[PROBLEM_CONVERTER] MCQ options: {options}")

        # Build display texts and ID mapping
        option_texts = []
        option_id_map = {}
        correct_option_id = ""
        correct_index = 0

        # Handle both structured options (with id/text) and simple string arrays
        if options and isinstance(options[0], dict):
            # Structured options with id/text
            correct_option_id = source_data.get('correct_option_id', 'A')

            for i, opt in enumerate(options):
                option_id = opt['id']
                option_text = opt['text']
                option_texts.append(option_text)
                option_id_map[option_id] = option_text

                # Find correct index for backward compatibility
                if option_id == correct_option_id:
                    correct_index = i

            logger.debug(f"[PROBLEM_CONVERTER] MCQ option_texts: {option_texts}")
            logger.debug(f"[PROBLEM_CONVERTER] MCQ correct_option_id: {correct_option_id}")
            logger.info(f"[PROBLEM_CONVERTER] MCQ ID mapping: {option_id_map}")
            logger.info(f"[PROBLEM_CONVERTER] Correct option: '{correct_option_id}' -> '{option_id_map.get(correct_option_id)}'")

        elif options and isinstance(options[0], str):
            # Legacy string array options - generate IDs for consistency
            correct_answer = source_data.get('correct_answer', source_data.get('answer', 0))
            correct_index = correct_answer if isinstance(correct_answer, int) else 0

            for i, option_text in enumerate(options):
                option_id = f"option_{chr(65 + i)}"  # A, B, C...
                option_texts.append(option_text)
                option_id_map[option_id] = option_text

                # Set correct option ID
                if i == correct_index:
                    correct_option_id = option_id

            logger.debug(f"[PROBLEM_CONVERTER] MCQ legacy format - correct_index: {correct_index}")
            logger.info(f"[PROBLEM_CONVERTER] Legacy format ID mapping: {option_id_map}")
        else:
            # Fallback
            option_texts = []
            option_id_map = {}
            correct_option_id = "option_A"
            correct_index = 0
            logger.warning(f"[PROBLEM_CONVERTER] MCQ fallback used - no valid options found")

        logger.info(f"[PROBLEM_CONVERTER] MCQ Final - {len(option_texts)} options, correct at index {correct_index}")
        logger.debug(f"[PROBLEM_CONVERTER] MCQ Option mapping: {[(i, text) for i, text in enumerate(option_texts)]}")

        return MultipleChoiceQuestion(
            id=source_data.get('id', 'mc_question'),
            question_text=source_data.get('question', ''),
            options=option_texts,
            correct_answer=correct_index,  # Keep for compatibility
            correct_option_id=correct_option_id,  # NEW
            option_id_map=option_id_map,  # NEW
            metadata=metadata,
            rationale=source_data.get('rationale', ''),
            teaching_note=source_data.get('teaching_note', ''),
            success_criteria=source_data.get('success_criteria', [])
        )

    @staticmethod
    def _convert_true_false(source_data: Dict[str, Any], metadata: Dict[str, Any]) -> TrueFalseQuestion:
        """Convert true/false primitive to standard format"""
        return TrueFalseQuestion(
            id=source_data.get('id', 'tf_question'),
            question_text=source_data.get('statement', source_data.get('question', '')),
            correct_answer=source_data.get('correct', True),
            metadata=metadata,
            rationale=source_data.get('rationale', ''),
            teaching_note=source_data.get('teaching_note', ''),
            success_criteria=source_data.get('success_criteria', [])
        )

    @staticmethod
    def _convert_categorization(source_data: Dict[str, Any], metadata: Dict[str, Any]) -> CategorizationQuestion:
        """Convert categorization primitive to standard format"""
        categorization_items = source_data.get('categorization_items', [])
        categories = source_data.get('categories', [])

        logger.debug(f"[PROBLEM_CONVERTER] Categorization categories: {categories}")
        logger.debug(f"[PROBLEM_CONVERTER] Categorization items: {categorization_items}")

        # Extract items and build correct answer mapping
        items = [item.get('item_text', str(item)) for item in categorization_items]
        correct_answer = {}

        for item in categorization_items:
            if isinstance(item, dict):
                item_text = item.get('item_text', '')
                correct_category = item.get('correct_category', '')
                if item_text and correct_category:
                    correct_answer[item_text] = correct_category
                    logger.debug(f"[PROBLEM_CONVERTER] Categorization mapping: '{item_text}' -> '{correct_category}'")

        logger.info(f"[PROBLEM_CONVERTER] Categorization Final - {len(items)} items, {len(categories)} categories")
        logger.info(f"[PROBLEM_CONVERTER] Categorization correct_answer mapping: {correct_answer}")

        return CategorizationQuestion(
            id=source_data.get('id', 'cat_question'),
            question_text=source_data.get('instruction', 'Categorize the following items:'),
            items=items,
            categories=categories,
            correct_answer=correct_answer,
            instruction=source_data.get('instruction', ''),
            metadata=metadata,
            rationale=source_data.get('rationale', ''),
            teaching_note=source_data.get('teaching_note', ''),
            success_criteria=source_data.get('success_criteria', [])
        )

    @staticmethod
    def _convert_sequencing(source_data: Dict[str, Any], metadata: Dict[str, Any]) -> SequencingQuestion:
        """Convert sequencing primitive to standard format"""
        return SequencingQuestion(
            id=source_data.get('id', 'seq_question'),
            question_text=source_data.get('instruction', 'Put the following items in the correct order:'),
            items=source_data.get('items', []),
            correct_answer=source_data.get('items', []),  # Items are provided in correct order
            instruction=source_data.get('instruction', ''),
            metadata=metadata,
            rationale=source_data.get('rationale', ''),
            teaching_note=source_data.get('teaching_note', ''),
            success_criteria=source_data.get('success_criteria', [])
        )

    @staticmethod
    def _convert_short_answer(source_data: Dict[str, Any], metadata: Dict[str, Any]) -> ShortAnswerQuestion:
        """Convert short answer primitive to standard format"""
        return ShortAnswerQuestion(
            id=source_data.get('id', 'sa_question'),
            question_text=source_data.get('question', ''),
            correct_answer=source_data.get('correct_answer', source_data.get('answer', '')),
            metadata=metadata,
            rationale=source_data.get('rationale', ''),
            teaching_note=source_data.get('teaching_note', ''),
            success_criteria=source_data.get('success_criteria', [])
        )

    @staticmethod
    def _convert_scenario(source_data: Dict[str, Any], metadata: Dict[str, Any]) -> ScenarioQuestion:
        """Convert scenario primitive to standard format"""
        scenario_text = source_data.get('scenario', '')
        question_text = source_data.get('scenario_question', source_data.get('question', ''))
        full_question = f"{scenario_text}\n\n{question_text}" if scenario_text else question_text

        return ScenarioQuestion(
            id=source_data.get('id', 'scenario_question'),
            question_text=full_question,
            scenario_text=scenario_text,
            correct_answer=source_data.get('scenario_answer', source_data.get('correct_answer', '')),
            metadata=metadata,
            rationale=source_data.get('rationale', ''),
            teaching_note=source_data.get('teaching_note', ''),
            success_criteria=source_data.get('success_criteria', [])
        )

    @staticmethod
    def _convert_fill_in_blanks(source_data: Dict[str, Any], metadata: Dict[str, Any]) -> FillInBlanksQuestion:
        """Convert fill-in-blanks primitive to standard format"""
        blanks = source_data.get('blanks', [])
        correct_answers = []
        case_sensitive = False

        # Extract correct answers from blanks structure
        for blank in blanks:
            if isinstance(blank, dict):
                blank_answers = blank.get('correct_answers', [])
                if blank_answers:
                    correct_answers.append(blank_answers[0])  # Take first correct answer
                case_sensitive = blank.get('case_sensitive', False)
            else:
                correct_answers.append(str(blank))

        return FillInBlanksQuestion(
            id=source_data.get('id', 'fib_question'),
            question_text=source_data.get('text_with_blanks', ''),
            text_with_blanks=source_data.get('text_with_blanks', ''),
            correct_answers=correct_answers,
            case_sensitive=case_sensitive,
            metadata=metadata,
            rationale=source_data.get('rationale', ''),
            teaching_note=source_data.get('teaching_note', ''),
            success_criteria=source_data.get('success_criteria', [])
        )

    @staticmethod
    def _convert_matching(source_data: Dict[str, Any], metadata: Dict[str, Any]) -> MatchingQuestion:
        """Convert matching primitive to standard format"""
        left_items = []
        right_items = []
        correct_answer = {}

        logger.debug(f"[PROBLEM_CONVERTER] Matching left_items: {source_data.get('left_items', [])}")
        logger.debug(f"[PROBLEM_CONVERTER] Matching right_items: {source_data.get('right_items', [])}")
        logger.debug(f"[PROBLEM_CONVERTER] Matching mappings: {source_data.get('mappings', [])}")

        # Extract items
        for item in source_data.get('left_items', []):
            if isinstance(item, dict):
                left_items.append(item.get('text', str(item)))
            else:
                left_items.append(str(item))

        for item in source_data.get('right_items', []):
            if isinstance(item, dict):
                right_items.append(item.get('text', str(item)))
            else:
                right_items.append(str(item))

        logger.debug(f"[PROBLEM_CONVERTER] Extracted left_items: {left_items}")
        logger.debug(f"[PROBLEM_CONVERTER] Extracted right_items: {right_items}")

        # Build correct mappings
        for mapping in source_data.get('mappings', []):
            if isinstance(mapping, dict):
                left_id = mapping.get('left_id', '')
                right_ids = mapping.get('right_ids', [])
                if left_id and right_ids:
                    # Find the actual text for these IDs
                    left_text = ProblemConverter._find_item_text(left_id, source_data.get('left_items', []))
                    right_text = ProblemConverter._find_item_text(right_ids[0], source_data.get('right_items', []))
                    logger.debug(f"[PROBLEM_CONVERTER] Mapping {left_id} -> {right_ids[0]}: '{left_text}' -> '{right_text}'")
                    if left_text and right_text:
                        correct_answer[left_text] = right_text

        logger.info(f"[PROBLEM_CONVERTER] Matching Final - {len(left_items)} left items, {len(right_items)} right items")
        logger.info(f"[PROBLEM_CONVERTER] Matching correct_answer mapping: {correct_answer}")

        return MatchingQuestion(
            id=source_data.get('id', 'match_question'),
            question_text=source_data.get('prompt', 'Match the items:'),
            left_items=left_items,
            right_items=right_items,
            correct_answer=correct_answer,
            instruction=source_data.get('prompt', ''),
            metadata=metadata,
            rationale=source_data.get('rationale', ''),
            teaching_note=source_data.get('teaching_note', ''),
            success_criteria=source_data.get('success_criteria', [])
        )

    @staticmethod
    def _find_item_text(item_id: str, items: List[Dict[str, Any]]) -> Optional[str]:
        """Helper to find item text by ID"""
        for item in items:
            if isinstance(item, dict) and item.get('id') == item_id:
                return item.get('text', '')
        return None