"""
Tests for assessment feedback integration with daily activities
This tests the specific functionality described in the product manager's requirements
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, Mock, patch
from datetime import datetime, timedelta
import json

from app.services.daily_activities import DailyActivitiesService
from app.services.assessment_service import AssessmentService


class TestAssessmentFeedbackIntegration:
    """Test assessment feedback storage and retrieval for daily plans"""

    @pytest.fixture
    def mock_cosmos_db_service(self):
        """Mock Cosmos DB service with realistic assessment data"""
        mock_service = Mock()

        # Mock recent assessments that match the PRD structure
        mock_assessments = [
            {
                "assessment_id": "assess_123_math_1234567890",
                "student_id": 123,
                "subject": "Mathematics",
                "status": "completed",
                "completed_at": (datetime.utcnow() - timedelta(hours=2)).isoformat(),
                "results": {
                    "summary": {
                        "correct_count": 8,
                        "total_questions": 12,
                        "score_percentage": 66.7
                    },
                    "ai_insights": {
                        "skill_insights": [
                            {
                                "skill_id": "MATH001",
                                "skill_name": "Number Recognition",
                                "assessment_focus_tag": "🎯 Weak Spot",
                                "performance_label": "Needs Review",
                                "insight_text": "This topic has been tricky for you. Let's break it down step by step.",
                                "next_step": {"text": "Learn the Basics"}
                            },
                            {
                                "skill_id": "MATH002",
                                "skill_name": "Counting Skills",
                                "assessment_focus_tag": "Recent Practice",
                                "performance_label": "Developing",
                                "insight_text": "You're so close! Your recent practice shows you understand the basics.",
                                "next_step": {"text": "Practice More"}
                            },
                            {
                                "skill_id": "MATH003",
                                "skill_name": "Basic Addition",
                                "assessment_focus_tag": "Foundational Review",
                                "performance_label": "Mastered",
                                "insight_text": "Perfect! You've maintained your mastery of this important foundational skill.",
                                "next_step": {"text": "Keep It Sharp"}
                            }
                        ]
                    }
                }
            },
            {
                "assessment_id": "assess_123_ela_1234567891",
                "student_id": 123,
                "subject": "Language Arts",
                "status": "completed",
                "completed_at": (datetime.utcnow() - timedelta(days=1)).isoformat(),
                "results": {
                    "summary": {
                        "correct_count": 10,
                        "total_questions": 15,
                        "score_percentage": 66.7
                    },
                    "ai_insights": {
                        "skill_insights": [
                            {
                                "skill_id": "ELA001",
                                "skill_name": "Phonological Awareness",
                                "assessment_focus_tag": "🎯 Weak Spot",
                                "performance_label": "Needs Review",
                                "insight_text": "This topic has been tricky for you. Let's break it down step by step."
                            },
                            {
                                "skill_id": "ELA002",
                                "skill_name": "Letter Recognition",
                                "assessment_focus_tag": "Recent Practice",
                                "performance_label": "Developing",
                                "insight_text": "You're so close! Your recent practice shows you understand the basics."
                            }
                        ]
                    }
                }
            }
        ]

        mock_service.get_recent_completed_assessments = AsyncMock(return_value=mock_assessments)
        return mock_service

    @pytest.fixture
    def mock_ai_recommendation_service(self):
        """Mock AI recommendation service that can use assessment feedback"""
        mock_service = Mock()

        # Mock successful playlist generation
        mock_playlist = {
            "daily_theme": "Assessment-Informed Learning",
            "learning_objectives": [
                "Focus on weak spots identified in recent assessments",
                "Reinforce developing skills"
            ],
            "activities": [
                {
                    "subject": "Mathematics",
                    "subskill_id": "MATH001-01",
                    "activity_type": "warm_up",
                    "reason": "Build confidence before tackling weak spots",
                    "estimated_time": 5
                },
                {
                    "subject": "Mathematics",
                    "subskill_id": "MATH001-02",
                    "activity_type": "core_challenge",
                    "reason": "Address the weak spot in number recognition from yesterday's assessment",
                    "estimated_time": 8
                },
                {
                    "subject": "Mathematics",
                    "subskill_id": "MATH002-01",
                    "activity_type": "core_challenge",
                    "reason": "Continue developing counting skills that showed progress",
                    "estimated_time": 8
                },
                {
                    "subject": "Language Arts",
                    "subskill_id": "ELA001-01",
                    "activity_type": "practice_reinforcement",
                    "reason": "Practice phonological awareness that needs review",
                    "estimated_time": 6
                },
                {
                    "subject": "Language Arts",
                    "subskill_id": "ELA002-01",
                    "activity_type": "practice_reinforcement",
                    "reason": "Reinforce developing letter recognition skills",
                    "estimated_time": 6
                },
                {
                    "subject": "Mathematics",
                    "subskill_id": "MATH003-01",
                    "activity_type": "cool_down",
                    "reason": "Review mastered addition skills for confidence",
                    "estimated_time": 4
                }
            ],
            "session_plan": {
                "session_focus": "Assessment-driven learning with focus on weak spots",
                "estimated_time_minutes": 37,
                "difficulty_balance": "balanced with support for struggling areas"
            }
        }

        mock_service.generate_daily_playlist = AsyncMock(return_value=mock_playlist)
        return mock_service

    @pytest.fixture
    def daily_activities_service(self, mock_ai_recommendation_service, mock_cosmos_db_service):
        """Daily activities service with mocked dependencies"""
        return DailyActivitiesService(
            ai_recommendation_service=mock_ai_recommendation_service,
            cosmos_db_service=mock_cosmos_db_service
        )

    @pytest.mark.asyncio
    async def test_assessment_feedback_retrieval(self, daily_activities_service):
        """Test that assessment feedback is correctly retrieved and structured"""

        feedback = await daily_activities_service._get_recent_assessment_feedback_by_subject(123)

        # Verify we got feedback for both subjects
        assert len(feedback) == 2
        assert 'Mathematics' in feedback
        assert 'Language Arts' in feedback

        # Verify Mathematics feedback structure
        math_feedback = feedback['Mathematics']
        assert math_feedback['subject'] == 'Mathematics'
        assert math_feedback['assessment_id'] == 'assess_123_math_1234567890'
        assert len(math_feedback['insights']['insights']) == 3

        # Verify skill categorization
        insights = math_feedback['insights']
        assert len(insights['weak_spot_skills']) == 1  # MATH001
        assert len(insights['developing_skills']) == 1  # MATH002
        assert 'MATH001' in insights['priority_skills']
        assert 'MATH002' in insights['priority_skills']

        # Verify Language Arts feedback
        ela_feedback = feedback['Language Arts']
        assert ela_feedback['subject'] == 'Language Arts'
        assert len(ela_feedback['insights']['insights']) == 2

    @pytest.mark.asyncio
    async def test_assessment_feedback_passed_to_ai_service(self, daily_activities_service, mock_ai_recommendation_service):
        """Test that assessment feedback is correctly passed to AI service"""

        ai_result = await daily_activities_service._get_ai_recommendations_with_session_plan(123)

        # Verify AI service was called with assessment feedback
        mock_ai_recommendation_service.generate_daily_playlist.assert_called_once()
        call_args = mock_ai_recommendation_service.generate_daily_playlist.call_args

        # Check that assessment_feedback_map was passed
        assert 'assessment_feedback_map' in call_args.kwargs
        feedback_map = call_args.kwargs['assessment_feedback_map']

        assert len(feedback_map) == 2
        assert 'Mathematics' in feedback_map
        assert 'Language Arts' in feedback_map

        # Verify the result indicates assessment feedback was used
        assert ai_result['assessment_feedback_used'] is True
        assert 'Mathematics' in ai_result['subjects_with_feedback']
        assert 'Language Arts' in ai_result['subjects_with_feedback']

    @pytest.mark.asyncio
    async def test_no_assessment_feedback_available(self, mock_ai_recommendation_service, daily_activities_service):
        """Test behavior when no assessment feedback is available"""

        # Mock empty assessment feedback
        with patch.object(daily_activities_service, '_get_recent_assessment_feedback_by_subject', return_value={}):

            ai_result = await daily_activities_service._get_ai_recommendations_with_session_plan(123)

            # Verify AI service was still called but without feedback
            mock_ai_recommendation_service.generate_daily_playlist.assert_called_once()
            call_args = mock_ai_recommendation_service.generate_daily_playlist.call_args

            # Should not have assessment_feedback_map or it should be empty
            if 'assessment_feedback_map' in call_args.kwargs:
                assert len(call_args.kwargs['assessment_feedback_map']) == 0

            # Verify the result indicates no assessment feedback was used
            assert ai_result['assessment_feedback_used'] is False
            assert len(ai_result['subjects_with_feedback']) == 0

    @pytest.mark.asyncio
    async def test_assessment_informed_daily_plan_generation(self, daily_activities_service):
        """Test complete daily plan generation with assessment feedback"""

        daily_plan = await daily_activities_service.get_or_generate_daily_plan(
            student_id=123,
            force_refresh=True
        )

        # Verify plan was generated with AI recommendations
        assert daily_plan.personalization_source == 'ai_recommendations'
        assert len(daily_plan.activities) == 6

        # Verify session plan includes assessment-informed focus
        assert daily_plan.session_plan is not None
        session_focus = daily_plan.session_plan.get('session_focus', '')
        assert 'assessment' in session_focus.lower() or 'weak spot' in session_focus.lower()

        # Verify activities address different assessment categories
        activity_types = [activity.metadata.get('priority_level', activity.type) for activity in daily_plan.activities]
        assert 'warm_up' in activity_types
        assert 'core_challenge' in activity_types
        assert 'practice_reinforcement' in activity_types
        assert 'cool_down' in activity_types

        # Verify activities are marked as assessment-informed
        for activity in daily_plan.activities:
            assert activity.metadata.get('from_ai_recommendations') is True
            assert activity.metadata.get('assessment_informed') is True

    def test_insight_extraction_from_assessment(self, daily_activities_service):
        """Test extraction of insights from assessment document"""

        # Mock assessment document matching the expected structure
        assessment_doc = {
            "assessment_id": "test_assess",
            "subject": "Mathematics",
            "results": {
                "ai_insights": {
                    "skill_insights": [
                        {
                            "skill_id": "MATH001",
                            "skill_name": "Number Recognition",
                            "assessment_focus_tag": "🎯 Weak Spot",
                            "performance_label": "Needs Review",
                            "insight_text": "Student struggles with numbers 6-10"
                        },
                        {
                            "skill_id": "MATH002",
                            "skill_name": "Counting",
                            "assessment_focus_tag": "Recent Practice",
                            "performance_label": "Developing",
                            "insight_text": "Making progress with counting"
                        },
                        {
                            "skill_id": "MATH003",
                            "skill_name": "Addition",
                            "assessment_focus_tag": "Foundational Review",
                            "performance_label": "Mastered",
                            "insight_text": "Strong foundation in basic addition"
                        }
                    ]
                },
                "summary": {
                    "score_percentage": 75,
                    "total_questions": 8,
                    "correct_count": 6
                }
            }
        }

        insights = daily_activities_service._extract_insights_from_assessment(assessment_doc)

        # Verify insights structure
        assert insights is not None
        assert len(insights['insights']) == 3
        assert insights['score_percentage'] == 75

        # Verify skill categorization
        assert len(insights['weak_spot_skills']) == 1
        assert 'MATH001' in insights['weak_spot_skills']

        assert len(insights['developing_skills']) == 1
        assert 'MATH002' in insights['developing_skills']

        assert len(insights['priority_skills']) == 2  # weak spot + developing
        assert 'MATH001' in insights['priority_skills']
        assert 'MATH002' in insights['priority_skills']

    def test_insight_extraction_handles_missing_data(self, daily_activities_service):
        """Test insight extraction handles missing or malformed data gracefully"""

        # Test with missing ai_insights
        assessment_no_insights = {
            "assessment_id": "test_assess",
            "subject": "Mathematics",
            "results": {
                "summary": {"score_percentage": 50}
            }
        }

        insights = daily_activities_service._extract_insights_from_assessment(assessment_no_insights)
        assert insights is None

        # Test with empty skill_insights
        assessment_empty_insights = {
            "assessment_id": "test_assess",
            "subject": "Mathematics",
            "results": {
                "ai_insights": {"skill_insights": []},
                "summary": {"score_percentage": 50}
            }
        }

        insights = daily_activities_service._extract_insights_from_assessment(assessment_empty_insights)
        assert insights is None

        # Test with malformed insights
        assessment_malformed = {
            "assessment_id": "test_assess",
            "subject": "Mathematics",
            "results": {
                "ai_insights": {
                    "skill_insights": [
                        {"skill_id": None}  # Missing required fields
                    ]
                }
            }
        }

        insights = daily_activities_service._extract_insights_from_assessment(assessment_malformed)
        # Should handle gracefully - might return empty lists or None
        assert insights is None or len(insights['priority_skills']) == 0


class TestAssessmentServiceIntegration:
    """Test integration between assessment submission and daily plan feedback"""

    @pytest.fixture
    def mock_cosmos_db_service(self):
        """Mock Cosmos DB service for assessment storage"""
        mock_service = Mock()
        mock_service.update_assessment_with_results = AsyncMock(return_value=True)
        return mock_service

    @pytest.fixture
    def assessment_service(self, mock_cosmos_db_service):
        """Assessment service with mocked dependencies"""
        mock_bigquery = Mock()
        mock_problems = Mock()
        mock_curriculum = Mock()
        mock_submission = Mock()

        return AssessmentService(
            bigquery_service=mock_bigquery,
            problem_service=mock_problems,
            curriculum_service=mock_curriculum,
            submission_service=mock_submission,
            cosmos_service=mock_cosmos_db_service
        )

    @pytest.mark.asyncio
    async def test_assessment_results_storage_format(self, assessment_service, mock_cosmos_db_service):
        """Test that assessment results are stored in the correct format for daily plan retrieval"""

        # Mock assessment data
        assessment_id = "assess_123_math_test"
        student_id = 123

        # Mock answers and processed reviews
        mock_answers = {"q1": "A", "q2": "B"}

        # Mock that we have an assessment
        mock_assessment = {
            "assessment_id": assessment_id,
            "student_id": student_id,
            "subject": "Mathematics",
            "problems": [
                {
                    "id": "q1",
                    "skill_id": "MATH001",
                    "subskill_id": "MATH001-01",
                    "problem_type": "multiple_choice"
                }
            ],
            "blueprint": {
                "selected_subskills": [
                    {
                        "skill_id": "MATH001",
                        "subskill_id": "MATH001-01",
                        "skill_description": "Number Recognition",
                        "subskill_description": "Recognize numbers 0-10",
                        "category": "weak_spots"
                    }
                ]
            }
        }

        # Mock the assessment retrieval
        with patch.object(assessment_service, 'get_assessment', return_value=mock_assessment):
            # Mock the submission service to return review data
            mock_submission_result = Mock()
            mock_submission_result.review = {
                "observation": {"selected_answer": "A"},
                "analysis": {"understanding": "Good"},
                "evaluation": {"score": 8, "justification": "Correct"},
                "feedback": {"praise": "Good job!"},
                "score": 8,
                "correct": True
            }

            with patch.object(assessment_service.submission_service, 'handle_submission', return_value=mock_submission_result):
                # Mock AI insights generation
                mock_ai_insights = {
                    "skill_insights": [
                        {
                            "skill_id": "MATH001",
                            "skill_name": "Number Recognition",
                            "assessment_focus_tag": "🎯 Weak Spot",
                            "performance_label": "Developing",
                            "insight_text": "Good progress on number recognition"
                        }
                    ]
                }

                with patch.object(assessment_service.ai_assessment, 'generate_enhanced_assessment_summary', return_value=mock_ai_insights):

                    # Score the assessment
                    result = await assessment_service.score_assessment(
                        assessment_id=assessment_id,
                        student_id=student_id,
                        answers=mock_answers
                    )

                    # Verify cosmos DB was updated with correct structure
                    mock_cosmos_db_service.update_assessment_with_results.assert_called_once()

                    call_args = mock_cosmos_db_service.update_assessment_with_results.call_args
                    results_data = call_args[0][2]  # Third argument is the results

                    # Verify results structure for daily plan consumption
                    assert 'summary' in results_data
                    assert 'ai_insights' in results_data

                    summary = results_data['summary']
                    assert 'correct_count' in summary
                    assert 'total_questions' in summary
                    assert 'score_percentage' in summary

                    ai_insights = results_data['ai_insights']
                    assert 'skill_insights' in ai_insights


if __name__ == '__main__':
    pytest.main([__file__, '-v'])