"""
Comprehensive tests for AI recommendations and daily activities integration
Tests the functionality that was causing fallback to BigQuery recommendations
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, Mock, patch
from datetime import datetime, timedelta
import json

from app.services.ai_recommendations import AIRecommendationService
from app.services.daily_activities import DailyActivitiesService
from app.services.assessment_service import AssessmentService


class TestAIRecommendationsIntegration:
    """Test the complete AI recommendations flow that integrates with daily activities"""

    @pytest.fixture
    def mock_bigquery_client(self):
        """Mock BigQuery client"""
        mock_client = Mock()
        return mock_client

    @pytest.fixture
    def mock_gemini_client(self):
        """Mock Gemini AI client"""
        mock_client = Mock()
        mock_aio = Mock()
        mock_models = Mock()
        mock_client.aio.models = mock_models

        # Mock successful response
        mock_response = Mock()
        mock_response.text = json.dumps({
            "daily_theme": "Learning Adventure",
            "learning_objectives": ["Practice number recognition", "Build phonics skills"],
            "activities": [
                {
                    "subject": "Mathematics",
                    "subskill_id": "MATH001-01",
                    "activity_type": "warm_up",
                    "reason": "Build confidence with familiar concepts",
                    "estimated_time": 5
                },
                {
                    "subject": "Mathematics",
                    "subskill_id": "MATH001-02",
                    "activity_type": "core_challenge",
                    "reason": "Focus on weak areas identified in assessment",
                    "estimated_time": 8
                }
            ],
            "session_plan": {
                "session_focus": "Number recognition and phonics",
                "estimated_time_minutes": 15,
                "difficulty_balance": "medium"
            }
        })

        mock_models.generate_content = AsyncMock(return_value=mock_response)
        return mock_client

    @pytest.fixture
    def mock_cosmos_db_service(self):
        """Mock Cosmos DB service for assessment feedback"""
        mock_service = Mock()

        # Mock recent assessments with feedback
        mock_assessments = [
            {
                "assessment_id": "assess_123",
                "subject": "Mathematics",
                "completed_at": (datetime.utcnow() - timedelta(days=1)).isoformat(),
                "results": {
                    "ai_insights": {
                        "skill_insights": [
                            {
                                "skill_id": "MATH001",
                                "skill_name": "Number Recognition",
                                "assessment_focus_tag": "🎯 Weak Spot",
                                "performance_label": "Needs Review",
                                "insight_text": "Student needs practice with number recognition"
                            },
                            {
                                "skill_id": "MATH002",
                                "skill_name": "Counting Skills",
                                "assessment_focus_tag": "Recent Practice",
                                "performance_label": "Developing",
                                "insight_text": "Making good progress with counting"
                            }
                        ]
                    },
                    "summary": {
                        "score_percentage": 65,
                        "total_questions": 10,
                        "correct_count": 6
                    }
                }
            }
        ]

        mock_service.get_recent_completed_assessments = AsyncMock(return_value=mock_assessments)
        return mock_service

    @pytest.fixture
    def ai_recommendation_service(self, mock_bigquery_client, mock_gemini_client):
        """AI recommendation service with mocked dependencies"""
        with patch('app.services.ai_recommendations.bigquery.Client', return_value=mock_bigquery_client):
            service = AIRecommendationService(project_id="test-project")
            service.gemini_client = mock_gemini_client
            return service

    @pytest.fixture
    def daily_activities_service(self, ai_recommendation_service, mock_cosmos_db_service):
        """Daily activities service with AI recommendations"""
        service = DailyActivitiesService(
            ai_recommendation_service=ai_recommendation_service,
            cosmos_db_service=mock_cosmos_db_service
        )
        return service

    @pytest.fixture
    def mock_student_summary(self):
        """Mock student summary from BigQuery"""
        return {
            "student_id": 123,
            "subjects": [
                {
                    "subject": "Mathematics",
                    "velocity_status": "Behind",
                    "velocity_percentage": 75,
                    "days_ahead_behind": -5,
                    "recommendation_priority": 1,
                    "avg_mastery": 65.0,
                    "total_skills": 10,
                    "available_subskills": [
                        {
                            "subskill_id": "MATH001-01",
                            "subskill_description": "Number recognition 0-10",
                            "skill_description": "Basic number concepts",
                            "subskill_mastery_pct": 45.0,
                            "unlock_score": 80,
                            "difficulty_start": 1,
                            "readiness_status": "Ready"
                        },
                        {
                            "subskill_id": "MATH001-02",
                            "subskill_description": "Counting forward",
                            "skill_description": "Counting skills",
                            "subskill_mastery_pct": 60.0,
                            "unlock_score": 85,
                            "difficulty_start": 2,
                            "readiness_status": "Ready"
                        }
                    ]
                },
                {
                    "subject": "Language Arts",
                    "velocity_status": "On Track",
                    "velocity_percentage": 95,
                    "days_ahead_behind": 2,
                    "recommendation_priority": 2,
                    "avg_mastery": 85.0,
                    "total_skills": 8,
                    "available_subskills": [
                        {
                            "subskill_id": "LA001-01",
                            "subskill_description": "Letter recognition A-M",
                            "skill_description": "Letter identification",
                            "subskill_mastery_pct": 80.0,
                            "unlock_score": 90,
                            "difficulty_start": 1,
                            "readiness_status": "Ready"
                        }
                    ]
                }
            ]
        }

    @pytest.mark.asyncio
    async def test_successful_ai_recommendations_flow(
        self,
        ai_recommendation_service,
        daily_activities_service,
        mock_student_summary
    ):
        """Test successful AI recommendations flow without fallback"""

        # Mock the student summary query
        with patch.object(ai_recommendation_service, '_get_student_summary', return_value=mock_student_summary):
            with patch.object(ai_recommendation_service, '_run_query_async', return_value=[]):

                # Test the daily activities service
                daily_plan = await daily_activities_service.get_or_generate_daily_plan(
                    student_id=123,
                    force_refresh=True
                )

                # Verify we got AI recommendations (not BigQuery fallback)
                assert daily_plan.personalization_source == 'ai_recommendations'
                assert len(daily_plan.activities) > 0
                assert daily_plan.session_plan is not None

                # Verify activities have AI-generated content
                activity = daily_plan.activities[0]
                assert activity.metadata.get('from_ai_recommendations') is True
                assert activity.metadata.get('assessment_informed') is True

    @pytest.mark.asyncio
    async def test_ai_recommendations_with_assessment_feedback(
        self,
        ai_recommendation_service,
        daily_activities_service,
        mock_student_summary
    ):
        """Test AI recommendations properly integrate assessment feedback"""

        with patch.object(ai_recommendation_service, '_get_student_summary', return_value=mock_student_summary):
            with patch.object(ai_recommendation_service, '_run_query_async', return_value=[]):

                # Call the internal method that includes assessment feedback
                ai_result = await daily_activities_service._get_ai_recommendations_with_session_plan(123)

                # Verify assessment feedback was included
                assert ai_result is not None
                assert ai_result['assessment_feedback_used'] is True
                assert 'Mathematics' in ai_result['subjects_with_feedback']

                # Verify recommendations include assessment-informed activities
                recommendations = ai_result['recommendations']
                assert len(recommendations) > 0
                assert any(rec.get('assessment_informed') for rec in recommendations)

    @pytest.mark.asyncio
    async def test_fallback_when_no_student_data(
        self,
        ai_recommendation_service,
        daily_activities_service
    ):
        """Test fallback to BigQuery when no student data available"""

        # Mock empty student summary (no data in BigQuery)
        with patch.object(ai_recommendation_service, '_get_student_summary', return_value=None):
            with patch.object(daily_activities_service, '_get_recommendations', return_value=[]):

                daily_plan = await daily_activities_service.get_or_generate_daily_plan(
                    student_id=999,  # Non-existent student
                    force_refresh=True
                )

                # Should fallback to static activities
                assert daily_plan.personalization_source == 'fallback'
                assert len(daily_plan.activities) > 0

    @pytest.mark.asyncio
    async def test_fallback_when_gemini_fails(
        self,
        ai_recommendation_service,
        daily_activities_service,
        mock_student_summary
    ):
        """Test fallback when Gemini API fails"""

        # Mock Gemini failure
        ai_recommendation_service.gemini_client.aio.models.generate_content.side_effect = Exception("Gemini API error")

        with patch.object(ai_recommendation_service, '_get_student_summary', return_value=mock_student_summary):
            with patch.object(daily_activities_service, '_get_recommendations', return_value=[]):

                daily_plan = await daily_activities_service.get_or_generate_daily_plan(
                    student_id=123,
                    force_refresh=True
                )

                # Should fallback to static activities due to AI failure
                assert daily_plan.personalization_source == 'fallback'

    @pytest.mark.asyncio
    async def test_assessment_feedback_extraction(
        self,
        daily_activities_service
    ):
        """Test assessment feedback extraction from Cosmos DB"""

        feedback = await daily_activities_service._get_recent_assessment_feedback_by_subject(123)

        # Verify feedback was extracted correctly
        assert 'Mathematics' in feedback
        math_feedback = feedback['Mathematics']
        assert math_feedback['subject'] == 'Mathematics'
        assert len(math_feedback['insights']['insights']) == 2
        assert math_feedback['insights']['score_percentage'] == 65

    @pytest.mark.asyncio
    async def test_assessment_feedback_context_building(
        self,
        ai_recommendation_service
    ):
        """Test assessment feedback context building for LLM prompt"""

        # Mock assessment feedback
        assessment_feedback = {
            'Mathematics': {
                'subject': 'Mathematics',
                'completed_at': datetime.utcnow().isoformat(),
                'insights': {
                    'insights': [
                        {
                            'skill_id': 'MATH001',
                            'skill_name': 'Number Recognition',
                            'assessment_focus_tag': '🎯 Weak Spot',
                            'performance_label': 'Needs Review',
                            'insight_text': 'Student struggles with numbers 6-10'
                        }
                    ]
                }
            }
        }

        context_summary = {
            'available_options': {
                'Mathematics': ['MATH001-01', 'MATH001-02'],
                'Language Arts': ['LA001-01']
            }
        }

        context = ai_recommendation_service._build_assessment_feedback_context(
            assessment_feedback, context_summary
        )

        # Verify context includes assessment information
        assert 'CRITICAL FEEDBACK FROM LAST ASSESSMENT' in context
        assert 'Mathematics' in context
        assert 'WEAK_SPOT / NEEDS_REVIEW' in context
        assert 'Number Recognition' in context

    @pytest.mark.asyncio
    async def test_empty_assessment_feedback_handling(
        self,
        ai_recommendation_service,
        daily_activities_service,
        mock_student_summary
    ):
        """Test handling when no assessment feedback is available"""

        # Mock empty assessment feedback
        with patch.object(daily_activities_service, '_get_recent_assessment_feedback_by_subject', return_value={}):
            with patch.object(ai_recommendation_service, '_get_student_summary', return_value=mock_student_summary):
                with patch.object(ai_recommendation_service, '_run_query_async', return_value=[]):

                    ai_result = await daily_activities_service._get_ai_recommendations_with_session_plan(123)

                    # Should still work without assessment feedback
                    assert ai_result is not None
                    assert ai_result['assessment_feedback_used'] is False
                    assert len(ai_result['subjects_with_feedback']) == 0

    def test_session_structure_creation(
        self,
        ai_recommendation_service,
        mock_student_summary
    ):
        """Test session structure creation based on velocity data"""

        session_structure = ai_recommendation_service._create_session_structure(
            mock_student_summary, target_activities=6
        )

        # Verify structure includes pedagogical flow
        assert 'pedagogical_flow' in session_structure
        assert 'subject_allocations' in session_structure
        assert 'focus_subjects' in session_structure

        # Verify focus subjects prioritize "Behind" subjects
        focus_subjects = session_structure['focus_subjects']
        assert 'Mathematics' in focus_subjects  # Behind subject should be prioritized

        # Verify pedagogical flow has correct structure
        pedagogical_flow = session_structure['pedagogical_flow']
        activity_types = [flow['activity_type'] for flow in pedagogical_flow]
        assert 'warm_up' in activity_types
        assert 'core_challenge' in activity_types
        assert 'practice_reinforcement' in activity_types
        assert 'cool_down' in activity_types

    @pytest.mark.asyncio
    async def test_bigquery_fallback_integration(
        self,
        daily_activities_service
    ):
        """Test integration with BigQuery recommendations when AI fails"""

        # Mock AI service failure
        with patch.object(daily_activities_service, '_get_ai_recommendations_with_session_plan', return_value=None):

            # Mock BigQuery recommendations
            mock_recommendations = [
                {
                    'subskill_id': 'BQ_MATH001',
                    'subskill_description': 'Basic counting',
                    'subject': 'Mathematics',
                    'skill_id': 'MATH001',
                    'skill_description': 'Number concepts',
                    'priority': 'high',
                    'mastery': 0.4,
                    'readiness_status': 'Ready'
                }
            ]

            with patch.object(daily_activities_service, '_get_recommendations', return_value=mock_recommendations):

                daily_plan = await daily_activities_service.get_or_generate_daily_plan(
                    student_id=123,
                    force_refresh=True
                )

                # Should use BigQuery recommendations
                assert daily_plan.personalization_source == 'bigquery_recommendations'
                assert len(daily_plan.activities) > 0

                # Verify activities don't have AI-specific metadata
                activity = daily_plan.activities[0]
                assert activity.metadata.get('from_ai_recommendations') is False
                assert activity.id.startswith('rec-BQ_MATH001')


class TestAIRecommendationsServiceMethods:
    """Test individual methods of the AI recommendations service"""

    @pytest.fixture
    def service(self):
        with patch('app.services.ai_recommendations.bigquery.Client'):
            with patch('app.services.ai_recommendations.genai.Client'):
                service = AIRecommendationService(project_id="test-project")
                return service

    @pytest.mark.asyncio
    async def test_empty_playlist_response(self, service):
        """Test empty playlist response format"""

        response = service._empty_playlist_response()

        assert response['daily_theme'] == 'Learning Break'
        assert response['learning_objectives'] == []
        assert response['activities'] == []
        assert response['session_plan']['session_focus'] == 'no_data'
        assert 'generated_at' in response

    @pytest.mark.asyncio
    async def test_health_check(self, service):
        """Test AI service health check"""

        # Mock successful BigQuery and Gemini responses
        with patch.object(service, '_run_query_async', return_value=[{'test_value': 1}]):

            mock_response = Mock()
            mock_response.text = '{"test": "success"}'
            service.gemini_client.aio.models.generate_content = AsyncMock(return_value=mock_response)

            health = await service.health_check()

            assert health['status'] == 'healthy'
            assert health['bigquery_connection'] == 'healthy'
            assert health['gemini_connection'] == 'healthy'
            assert health['model'] == 'gemini-2.5-flash'

    @pytest.mark.asyncio
    async def test_health_check_failure(self, service):
        """Test health check when services fail"""

        # Mock BigQuery failure
        with patch.object(service, '_run_query_async', side_effect=Exception("BigQuery error")):

            health = await service.health_check()

            assert health['status'] == 'unhealthy'
            assert 'error' in health


if __name__ == '__main__':
    pytest.main([__file__, '-v'])