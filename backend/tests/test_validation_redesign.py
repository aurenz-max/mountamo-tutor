# test_validation_redesign.py
"""
Tests for the validation redesign to fix brittle option ID conversion.
These tests verify that the new ID-based validation works correctly
with various option ID formats including numeric patterns like opt_005.
"""

import pytest
from app.shared.question_types import (
    MultipleChoiceQuestion, MultipleChoiceResponse,
    QuestionType, QuestionEvaluation
)
from app.services.universal_validator import UniversalValidator
from app.services.problem_converter import ProblemConverter


class TestValidationRedesign:
    """Test suite for the validation redesign implementation"""

    def test_mcq_validation_with_numeric_option_ids(self):
        """Test MCQ validation with opt_001, opt_002 format - the core bug case"""
        question = MultipleChoiceQuestion(
            id="test_mcq",
            question_text="Which is greater: 8 ___ 2?",
            options=["<", ">", "="],
            correct_answer=1,  # Index for backward compatibility
            correct_option_id="opt_005",
            option_id_map={"opt_004": "<", "opt_005": ">", "opt_006": "="}
        )

        response = MultipleChoiceResponse(
            question_id="test_mcq",
            answer=0,  # Placeholder for backward compatibility
            selected_option_id="opt_005"
        )

        evaluation = UniversalValidator._validate_multiple_choice(question, response)

        assert evaluation.is_correct == True
        assert evaluation.score == 10.0
        assert evaluation.student_answer == ">"
        assert evaluation.correct_answer == ">"

    def test_mcq_validation_with_uuid_option_ids(self):
        """Test MCQ validation with UUID option IDs"""
        question = MultipleChoiceQuestion(
            id="test_mcq",
            question_text="What is 2+2?",
            options=["3", "4", "5"],
            correct_answer=1,  # Index for backward compatibility
            correct_option_id="550e8400-e29b-41d4-a716-446655440001",
            option_id_map={
                "550e8400-e29b-41d4-a716-446655440000": "3",
                "550e8400-e29b-41d4-a716-446655440001": "4",
                "550e8400-e29b-41d4-a716-446655440002": "5"
            }
        )

        response = MultipleChoiceResponse(
            question_id="test_mcq",
            answer=0,  # Placeholder for backward compatibility
            selected_option_id="550e8400-e29b-41d4-a716-446655440001"
        )

        evaluation = UniversalValidator._validate_multiple_choice(question, response)

        assert evaluation.is_correct == True
        assert evaluation.score == 10.0
        assert evaluation.student_answer == "4"
        assert evaluation.correct_answer == "4"

    def test_mcq_validation_with_incorrect_numeric_option_id(self):
        """Test MCQ validation with wrong numeric option ID"""
        question = MultipleChoiceQuestion(
            id="test_mcq",
            question_text="Which is greater: 8 ___ 2?",
            options=["<", ">", "="],
            correct_answer=1,
            correct_option_id="opt_005",
            option_id_map={"opt_004": "<", "opt_005": ">", "opt_006": "="}
        )

        # Student selects wrong answer
        response = MultipleChoiceResponse(
            question_id="test_mcq",
            answer=0,
            selected_option_id="opt_004"  # Wrong answer (<)
        )

        evaluation = UniversalValidator._validate_multiple_choice(question, response)

        assert evaluation.is_correct == False
        assert evaluation.score == 3.0
        assert evaluation.student_answer == "<"
        assert evaluation.correct_answer == ">"

    def test_mcq_validation_fallback_to_index_based(self):
        """Test that validation falls back to index-based for backward compatibility"""
        question = MultipleChoiceQuestion(
            id="test_mcq",
            question_text="What color is the sky?",
            options=["Red", "Blue", "Green"],
            correct_answer=1,
            correct_option_id="",  # No ID provided
            option_id_map={}  # No mapping provided
        )

        response = MultipleChoiceResponse(
            question_id="test_mcq",
            answer=1,  # Index-based answer
            selected_option_id=""  # No ID provided
        )

        evaluation = UniversalValidator._validate_multiple_choice(question, response)

        assert evaluation.is_correct == True
        assert evaluation.score == 10.0
        assert evaluation.student_answer == "Blue"
        assert evaluation.correct_answer == "Blue"

    def test_mcq_validation_with_traditional_letter_ids(self):
        """Test MCQ validation still works with traditional option_A format"""
        question = MultipleChoiceQuestion(
            id="test_mcq",
            question_text="What is 3+3?",
            options=["5", "6", "7"],
            correct_answer=1,
            correct_option_id="option_B",
            option_id_map={"option_A": "5", "option_B": "6", "option_C": "7"}
        )

        response = MultipleChoiceResponse(
            question_id="test_mcq",
            answer=0,
            selected_option_id="option_B"
        )

        evaluation = UniversalValidator._validate_multiple_choice(question, response)

        assert evaluation.is_correct == True
        assert evaluation.score == 10.0
        assert evaluation.student_answer == "6"
        assert evaluation.correct_answer == "6"

    def test_problem_converter_preserves_numeric_option_ids(self):
        """Test that problem converter preserves numeric option IDs"""
        source_data = {
            'id': 'test_problem',
            'question': 'Which symbol means greater than?',
            'options': [
                {'id': 'opt_004', 'text': '<'},
                {'id': 'opt_005', 'text': '>'},
                {'id': 'opt_006', 'text': '='}
            ],
            'correct_option_id': 'opt_005'
        }
        metadata = {'subject': 'math'}

        question = ProblemConverter._convert_multiple_choice(source_data, metadata)

        assert isinstance(question, MultipleChoiceQuestion)
        assert question.options == ['<', '>', '=']
        assert question.correct_option_id == 'opt_005'
        assert question.option_id_map == {
            'opt_004': '<',
            'opt_005': '>',
            'opt_006': '='
        }
        assert question.correct_answer == 1  # Index for backward compatibility

    def test_problem_converter_handles_legacy_string_options(self):
        """Test that problem converter handles legacy string array options"""
        source_data = {
            'id': 'test_problem',
            'question': 'What is your favorite color?',
            'options': ['Red', 'Blue', 'Green'],
            'correct_answer': 1
        }
        metadata = {'subject': 'art'}

        question = ProblemConverter._convert_multiple_choice(source_data, metadata)

        assert isinstance(question, MultipleChoiceQuestion)
        assert question.options == ['Red', 'Blue', 'Green']
        assert question.correct_option_id == 'option_B'  # Generated ID
        assert question.option_id_map == {
            'option_A': 'Red',
            'option_B': 'Blue',
            'option_C': 'Green'
        }
        assert question.correct_answer == 1

    def test_get_option_text_by_id_method(self):
        """Test the new get_option_text_by_id helper method"""
        question = MultipleChoiceQuestion(
            id="test_mcq",
            question_text="Test question",
            options=["A", "B", "C"],
            correct_answer=0,
            correct_option_id="opt_001",
            option_id_map={
                "opt_001": "Option A",
                "opt_002": "Option B",
                "opt_003": "Option C"
            }
        )

        assert question.get_option_text_by_id("opt_001") == "Option A"
        assert question.get_option_text_by_id("opt_002") == "Option B"
        assert question.get_option_text_by_id("opt_003") == "Option C"
        assert question.get_option_text_by_id("invalid_id") == "Unknown Option"

    def test_validation_with_mixed_option_id_formats(self):
        """Test validation works with mixed option ID formats in same question"""
        question = MultipleChoiceQuestion(
            id="test_mcq",
            question_text="Mixed format test",
            options=["Alpha", "Beta", "Gamma"],
            correct_answer=2,
            correct_option_id="custom_gamma_id",
            option_id_map={
                "alpha_1": "Alpha",
                "beta_uuid": "Beta",
                "custom_gamma_id": "Gamma"
            }
        )

        response = MultipleChoiceResponse(
            question_id="test_mcq",
            answer=0,
            selected_option_id="custom_gamma_id"
        )

        evaluation = UniversalValidator._validate_multiple_choice(question, response)

        assert evaluation.is_correct == True
        assert evaluation.score == 10.0
        assert evaluation.student_answer == "Gamma"
        assert evaluation.correct_answer == "Gamma"

    def test_universal_validator_response_parsing_with_numeric_ids(self):
        """Test that UniversalValidator correctly parses responses with numeric option IDs"""
        question = MultipleChoiceQuestion(
            id="test_mcq",
            question_text="Parse test",
            options=["<", ">", "="],
            correct_answer=1,
            correct_option_id="opt_005",
            option_id_map={"opt_004": "<", "opt_005": ">", "opt_006": "="}
        )

        student_response_data = {}
        primitive_response = {'selected_option_id': 'opt_005'}

        parsed_response = UniversalValidator._parse_student_response(
            question, student_response_data, primitive_response
        )

        assert isinstance(parsed_response, MultipleChoiceResponse)
        assert parsed_response.selected_option_id == 'opt_005'
        assert parsed_response.question_id == 'test_mcq'

    def test_end_to_end_validation_scenario(self):
        """Test the complete flow from problem data to validation result"""
        # Simulate the exact scenario from the spec
        llm_generated_problem = {
            'id': 'comparison_problem',
            'question': 'Which symbol represents greater than?',
            'options': [
                {'id': 'opt_004', 'text': '<'},
                {'id': 'opt_005', 'text': '>'},
                {'id': 'opt_006', 'text': '='}
            ],
            'correct_option_id': 'opt_005'
        }

        # Step 1: Convert problem to standardized format
        metadata = {'subject': 'math', 'skill_id': 'comparison'}
        question = ProblemConverter._convert_multiple_choice(llm_generated_problem, metadata)

        # Step 2: Student submits correct answer
        student_response_data = {}
        primitive_response = {'selected_option_id': 'opt_005'}

        # Step 3: Validate submission
        evaluation = UniversalValidator.validate_submission(
            question, student_response_data, primitive_response
        )

        # Step 4: Verify correct result (this was previously marked as wrong!)
        assert evaluation.is_correct == True
        assert evaluation.score == 10.0
        assert evaluation.student_answer == '>'
        assert evaluation.correct_answer == '>'
        assert 'Correct!' in evaluation.feedback


if __name__ == "__main__":
    pytest.main([__file__, "-v"])