"""
Tests for Live Interaction Problem Type

This test suite validates the full integration of the live_interaction problem type:
- Problem conversion from raw data to LiveInteractionQuestion
- Response parsing from student submissions
- Validation logic for correct and incorrect target selection
- Edge cases and error handling
"""

import pytest
from app.services.problem_converter import ProblemConverter
from app.services.universal_validator import UniversalValidator
from app.shared.question_types import (
    QuestionType,
    LiveInteractionQuestion,
    LiveInteractionResponse,
    QuestionEvaluation
)


# Sample live_interaction problem data (mimics content_schemas.py structure)
SAMPLE_LIVE_INTERACTION_PROBLEM = {
    "id": "live_int_001",
    "problem_type": "live_interaction",
    "difficulty": "easy",
    "grade_level": "Kindergarten",
    "prompt": {
        "system": "You are a helpful tutor guiding the student to identify shapes.",
        "first_message": "Can you click on the circle?",
        "session_intro": "Let's practice identifying shapes!"
    },
    "visual_content": {
        "type": "card-grid",
        "data": {
            "cards": [
                {"id": "shape_1", "shape": "circle", "color": "red"},
                {"id": "shape_2", "shape": "square", "color": "blue"},
                {"id": "shape_3", "shape": "triangle", "color": "green"}
            ]
        }
    },
    "interaction_config": {
        "mode": "click",
        "targets": [
            {
                "id": "shape_1",
                "is_correct": True,
                "description": "Red circle - correct!"
            },
            {
                "id": "shape_2",
                "is_correct": False,
                "description": "Blue square - try again"
            },
            {
                "id": "shape_3",
                "is_correct": False,
                "description": "Green triangle - try again"
            }
        ]
    },
    "evaluation": {
        "success_criteria": ["Correctly identify the circle"],
        "feedback": {
            "correct": {
                "audio": "Great job! That's the circle!",
                "visual_effect": "success_animation"
            },
            "incorrect": {
                "audio": "Not quite. Look for the round shape!",
                "hint": "A circle is round with no corners.",
                "visual_effect": "try_again"
            }
        }
    },
    "rationale": "Circles are round shapes with no straight edges.",
    "teaching_note": "Help students identify circles by their lack of corners.",
    "subject": "math",
    "skill_id": "shape_recognition",
    "subskill_id": "identify_circles"
}


class TestLiveInteractionConversion:
    """Test conversion of live_interaction problems to standard format"""

    def test_convert_live_interaction_to_question(self):
        """Test that live_interaction problem converts correctly"""
        question = ProblemConverter.convert_to_standard_question(
            SAMPLE_LIVE_INTERACTION_PROBLEM
        )

        assert question is not None
        assert isinstance(question, LiveInteractionQuestion)
        assert question.type == QuestionType.LIVE_INTERACTION
        assert question.id == "live_int_001"
        assert question.question_text == "Can you click on the circle?"

    def test_correct_targets_extracted(self):
        """Test that correct target IDs are extracted from interaction_config"""
        question = ProblemConverter.convert_to_standard_question(
            SAMPLE_LIVE_INTERACTION_PROBLEM
        )

        assert question.correct_target_ids == ["shape_1"]

    def test_interaction_config_preserved(self):
        """Test that interaction_config is preserved in conversion"""
        question = ProblemConverter.convert_to_standard_question(
            SAMPLE_LIVE_INTERACTION_PROBLEM
        )

        assert question.interaction_config is not None
        assert question.interaction_config["mode"] == "click"
        assert len(question.interaction_config["targets"]) == 3

    def test_visual_content_preserved(self):
        """Test that visual_content is preserved"""
        question = ProblemConverter.convert_to_standard_question(
            SAMPLE_LIVE_INTERACTION_PROBLEM
        )

        assert question.visual_content is not None
        assert question.visual_content["type"] == "card-grid"

    def test_evaluation_config_preserved(self):
        """Test that evaluation config is preserved"""
        question = ProblemConverter.convert_to_standard_question(
            SAMPLE_LIVE_INTERACTION_PROBLEM
        )

        assert question.evaluation is not None
        assert "feedback" in question.evaluation
        assert "correct" in question.evaluation["feedback"]
        assert "incorrect" in question.evaluation["feedback"]

    def test_metadata_included(self):
        """Test that metadata is properly extracted"""
        question = ProblemConverter.convert_to_standard_question(
            SAMPLE_LIVE_INTERACTION_PROBLEM
        )

        assert question.metadata["subject"] == "math"
        assert question.metadata["skill_id"] == "shape_recognition"
        assert question.metadata["subskill_id"] == "identify_circles"


class TestLiveInteractionValidation:
    """Test validation of live_interaction responses"""

    @pytest.fixture
    def sample_question(self):
        """Fixture providing a converted question"""
        return ProblemConverter.convert_to_standard_question(
            SAMPLE_LIVE_INTERACTION_PROBLEM
        )

    def test_validate_correct_response(self, sample_question):
        """Test validation of correct target selection"""
        student_response_data = {
            "student_answer": "shape_1",
            "subject": "math"
        }
        primitive_response = {
            "selected_target_id": "shape_1",
            "interaction_mode": "click"
        }

        evaluation = UniversalValidator.validate_submission(
            question=sample_question,
            student_response_data=student_response_data,
            primitive_response=primitive_response
        )

        assert evaluation.is_correct is True
        assert evaluation.score == 10.0
        assert "Great job" in evaluation.feedback
        assert "shape_1" in evaluation.student_answer

    def test_validate_incorrect_response(self, sample_question):
        """Test validation of incorrect target selection"""
        student_response_data = {
            "student_answer": "shape_2",
            "subject": "math"
        }
        primitive_response = {
            "selected_target_id": "shape_2",
            "interaction_mode": "click"
        }

        evaluation = UniversalValidator.validate_submission(
            question=sample_question,
            student_response_data=student_response_data,
            primitive_response=primitive_response
        )

        assert evaluation.is_correct is False
        assert evaluation.score == 3.0
        assert "Not quite" in evaluation.feedback or "Hint" in evaluation.feedback

    def test_detailed_results_included(self, sample_question):
        """Test that detailed_results contains live_interaction metadata"""
        student_response_data = {
            "student_answer": "shape_1",
            "subject": "math"
        }
        primitive_response = {
            "selected_target_id": "shape_1",
            "interaction_mode": "click"
        }

        evaluation = UniversalValidator.validate_submission(
            question=sample_question,
            student_response_data=student_response_data,
            primitive_response=primitive_response
        )

        assert "detailed_results" in evaluation.__dict__
        assert evaluation.detailed_results["selected_target_id"] == "shape_1"
        assert evaluation.detailed_results["interaction_mode"] == "click"
        assert "visual_effect" in evaluation.detailed_results

    def test_fallback_to_student_answer(self, sample_question):
        """Test that validator falls back to student_answer if primitive_response is missing"""
        student_response_data = {
            "student_answer": "shape_1",
            "subject": "math"
        }
        primitive_response = None

        evaluation = UniversalValidator.validate_submission(
            question=sample_question,
            student_response_data=student_response_data,
            primitive_response=primitive_response
        )

        assert evaluation.is_correct is True
        assert evaluation.score == 10.0


class TestLiveInteractionEdgeCases:
    """Test edge cases and error handling"""

    def test_multiple_correct_targets(self):
        """Test problem with multiple correct targets"""
        problem_data = SAMPLE_LIVE_INTERACTION_PROBLEM.copy()
        problem_data["interaction_config"]["targets"][1]["is_correct"] = True

        question = ProblemConverter.convert_to_standard_question(problem_data)

        assert len(question.correct_target_ids) == 2
        assert "shape_1" in question.correct_target_ids
        assert "shape_2" in question.correct_target_ids

    def test_missing_first_message_fallback(self):
        """Test fallback when first_message is missing from prompt"""
        problem_data = SAMPLE_LIVE_INTERACTION_PROBLEM.copy()
        problem_data["prompt"] = {"system": "Tutor"}  # No first_message

        question = ProblemConverter.convert_to_standard_question(problem_data)

        assert question is not None
        assert "card-grid" in question.question_text  # Falls back to visual type

    def test_invalid_target_id(self):
        """Test validation with non-existent target ID"""
        question = ProblemConverter.convert_to_standard_question(
            SAMPLE_LIVE_INTERACTION_PROBLEM
        )

        student_response_data = {
            "student_answer": "shape_999",  # Non-existent
            "subject": "math"
        }
        primitive_response = {
            "selected_target_id": "shape_999",
            "interaction_mode": "click"
        }

        evaluation = UniversalValidator.validate_submission(
            question=question,
            student_response_data=student_response_data,
            primitive_response=primitive_response
        )

        assert evaluation.is_correct is False
        assert evaluation.score == 3.0

    def test_different_interaction_modes(self):
        """Test problems with different interaction modes"""
        for mode in ["click", "speech", "drag", "trace"]:
            problem_data = SAMPLE_LIVE_INTERACTION_PROBLEM.copy()
            problem_data["interaction_config"]["mode"] = mode

            question = ProblemConverter.convert_to_standard_question(problem_data)
            assert question.interaction_config["mode"] == mode


class TestLiveInteractionIntegration:
    """Integration tests for the full submission flow"""

    def test_end_to_end_correct_submission(self):
        """Test complete flow from problem generation to validation (correct answer)"""
        # 1. Convert problem
        question = ProblemConverter.convert_to_standard_question(
            SAMPLE_LIVE_INTERACTION_PROBLEM
        )

        # 2. Student selects correct target
        submission_data = {
            "student_answer": "shape_1",
            "subject": "math",
            "skill_id": "shape_recognition",
            "subskill_id": "identify_circles"
        }
        primitive_response = {
            "selected_target_id": "shape_1",
            "interaction_mode": "click"
        }

        # 3. Validate
        evaluation = UniversalValidator.validate_submission(
            question=question,
            student_response_data=submission_data,
            primitive_response=primitive_response
        )

        # 4. Verify results
        assert evaluation.question_id == "live_int_001"
        assert evaluation.question_type == QuestionType.LIVE_INTERACTION
        assert evaluation.is_correct is True
        assert evaluation.score == 10.0
        assert "Great job" in evaluation.feedback
        assert evaluation.detailed_results["visual_effect"] == "success_animation"

    def test_end_to_end_incorrect_submission(self):
        """Test complete flow from problem generation to validation (incorrect answer)"""
        # 1. Convert problem
        question = ProblemConverter.convert_to_standard_question(
            SAMPLE_LIVE_INTERACTION_PROBLEM
        )

        # 2. Student selects incorrect target
        submission_data = {
            "student_answer": "shape_3",
            "subject": "math",
            "skill_id": "shape_recognition",
            "subskill_id": "identify_circles"
        }
        primitive_response = {
            "selected_target_id": "shape_3",
            "interaction_mode": "click"
        }

        # 3. Validate
        evaluation = UniversalValidator.validate_submission(
            question=question,
            student_response_data=submission_data,
            primitive_response=primitive_response
        )

        # 4. Verify results include hint
        assert evaluation.is_correct is False
        assert evaluation.score == 3.0
        assert "Hint" in evaluation.feedback or "round" in evaluation.feedback.lower()
        assert evaluation.detailed_results["visual_effect"] == "try_again"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
