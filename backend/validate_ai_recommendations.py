#!/usr/bin/env python3
"""
Validation script for AI recommendations functionality
Run this to test if the AI recommendations are working or falling back to BigQuery

Usage:
    python validate_ai_recommendations.py --student-id 123
    python validate_ai_recommendations.py --student-id 123 --debug
"""

import asyncio
import argparse
import logging
import sys
import os
from typing import Dict, Any

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.ai_recommendations import AIRecommendationService
from app.services.daily_activities import DailyActivitiesService
from app.db.cosmos_db import CosmosDBService


class AIRecommendationsValidator:
    """Validator for AI recommendations functionality"""

    def __init__(self, debug: bool = False):
        self.debug = debug
        self.setup_logging()

    def setup_logging(self):
        """Setup logging configuration"""
        level = logging.DEBUG if self.debug else logging.INFO
        logging.basicConfig(
            level=level,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.StreamHandler(sys.stdout)
            ]
        )

        # Set specific logger levels for our services
        logging.getLogger('app.services.ai_recommendations').setLevel(logging.DEBUG)
        logging.getLogger('app.services.daily_activities').setLevel(logging.DEBUG)

    async def validate_ai_service_health(self) -> Dict[str, Any]:
        """Test AI recommendation service health"""
        print("🔍 Testing AI Recommendation Service Health...")

        try:
            ai_service = AIRecommendationService(
                project_id=os.getenv('GOOGLE_CLOUD_PROJECT', 'claude-tutor-dev'),
                dataset_id="analytics"
            )

            health = await ai_service.health_check()

            if health['status'] == 'healthy':
                print("✅ AI Recommendation Service is healthy")
                print(f"   - BigQuery: {health['bigquery_connection']}")
                print(f"   - Gemini: {health['gemini_connection']}")
                print(f"   - Model: {health['model']}")
            else:
                print("❌ AI Recommendation Service is unhealthy")
                print(f"   - Status: {health['status']}")
                if 'error' in health:
                    print(f"   - Error: {health['error']}")

            return health

        except Exception as e:
            print(f"❌ Failed to test AI service health: {e}")
            return {'status': 'error', 'error': str(e)}

    async def validate_student_data(self, student_id: int) -> Dict[str, Any]:
        """Test if student data is available in BigQuery"""
        print(f"🔍 Testing Student Data Availability for ID {student_id}...")

        try:
            ai_service = AIRecommendationService(
                project_id=os.getenv('GOOGLE_CLOUD_PROJECT', 'claude-tutor-dev'),
                dataset_id="analytics"
            )

            student_summary = await ai_service._get_student_summary(student_id)

            if student_summary:
                subjects = student_summary.get('subjects', [])
                print(f"✅ Student data found")
                print(f"   - Subjects: {len(subjects)}")
                for subject in subjects:
                    subskills = len(subject.get('available_subskills', []))
                    velocity = subject.get('velocity_status', 'Unknown')
                    print(f"   - {subject.get('subject')}: {velocity} ({subskills} subskills)")
                return {'status': 'success', 'subjects': len(subjects)}
            else:
                print("❌ No student data found in BigQuery")
                print("   This will cause fallback to BigQuery recommendations")
                return {'status': 'no_data'}

        except Exception as e:
            print(f"❌ Failed to retrieve student data: {e}")
            return {'status': 'error', 'error': str(e)}

    async def validate_assessment_feedback(self, student_id: int) -> Dict[str, Any]:
        """Test assessment feedback retrieval"""
        print(f"🔍 Testing Assessment Feedback for Student {student_id}...")

        try:
            cosmos_service = CosmosDBService()
            daily_service = DailyActivitiesService(cosmos_db_service=cosmos_service)

            feedback = await daily_service._get_recent_assessment_feedback_by_subject(student_id)

            if feedback:
                print(f"✅ Assessment feedback found")
                print(f"   - Subjects with feedback: {len(feedback)}")
                for subject, data in feedback.items():
                    insights_count = len(data.get('insights', {}).get('insights', []))
                    score = data.get('insights', {}).get('score_percentage', 0)
                    print(f"   - {subject}: {insights_count} insights, {score}% score")
                return {'status': 'success', 'subjects': len(feedback)}
            else:
                print("⚠️ No recent assessment feedback found")
                print("   AI recommendations will use velocity data only")
                return {'status': 'no_feedback'}

        except Exception as e:
            print(f"❌ Failed to retrieve assessment feedback: {e}")
            return {'status': 'error', 'error': str(e)}

    async def validate_ai_playlist_generation(self, student_id: int) -> Dict[str, Any]:
        """Test AI playlist generation directly"""
        print(f"🔍 Testing AI Playlist Generation for Student {student_id}...")

        try:
            ai_service = AIRecommendationService(
                project_id=os.getenv('GOOGLE_CLOUD_PROJECT', 'claude-tutor-dev'),
                dataset_id="analytics"
            )

            # Test with assessment feedback
            cosmos_service = CosmosDBService()
            daily_service = DailyActivitiesService(cosmos_db_service=cosmos_service)
            assessment_feedback = await daily_service._get_recent_assessment_feedback_by_subject(student_id)

            playlist = await ai_service.generate_daily_playlist(
                student_id=student_id,
                target_activities=6,
                assessment_feedback_map=assessment_feedback if assessment_feedback else None
            )

            if playlist and playlist.get('activities'):
                activities = playlist.get('activities', [])
                print(f"✅ AI playlist generated successfully")
                print(f"   - Activities: {len(activities)}")
                print(f"   - Theme: {playlist.get('daily_theme', 'N/A')}")
                print(f"   - Assessment feedback used: {len(assessment_feedback) > 0}")

                # Show activity types
                activity_types = {}
                for activity in activities:
                    act_type = activity.get('activity_type', 'unknown')
                    activity_types[act_type] = activity_types.get(act_type, 0) + 1

                print(f"   - Activity breakdown: {activity_types}")
                return {'status': 'success', 'activities': len(activities)}
            else:
                print("❌ AI playlist generation failed")
                print(f"   - Result: {playlist}")
                print("   This will cause fallback to BigQuery recommendations")
                return {'status': 'failed', 'result': playlist}

        except Exception as e:
            print(f"❌ AI playlist generation failed with error: {e}")
            return {'status': 'error', 'error': str(e)}

    async def validate_daily_plan_flow(self, student_id: int) -> Dict[str, Any]:
        """Test complete daily plan generation flow"""
        print(f"🔍 Testing Complete Daily Plan Flow for Student {student_id}...")

        try:
            # Setup services
            ai_service = AIRecommendationService(
                project_id=os.getenv('GOOGLE_CLOUD_PROJECT', 'claude-tutor-dev'),
                dataset_id="analytics"
            )
            cosmos_service = CosmosDBService()
            daily_service = DailyActivitiesService(
                ai_recommendation_service=ai_service,
                cosmos_db_service=cosmos_service
            )

            # Generate daily plan
            daily_plan = await daily_service.get_or_generate_daily_plan(
                student_id=student_id,
                force_refresh=True
            )

            source = daily_plan.personalization_source
            activities_count = len(daily_plan.activities)

            if source == 'ai_recommendations':
                print("✅ Daily plan generated using AI recommendations")
                print(f"   - Activities: {activities_count}")
                print(f"   - Session plan available: {daily_plan.session_plan is not None}")

                # Check for assessment feedback usage
                has_assessment_data = any(
                    activity.metadata.get('assessment_informed', False)
                    for activity in daily_plan.activities
                )
                print(f"   - Assessment feedback used: {has_assessment_data}")

                return {'status': 'success', 'source': 'ai', 'activities': activities_count}

            elif source == 'bigquery_recommendations':
                print("⚠️ Daily plan fell back to BigQuery recommendations")
                print(f"   - Activities: {activities_count}")
                print("   - This indicates AI recommendations failed")
                return {'status': 'fallback', 'source': 'bigquery', 'activities': activities_count}

            elif source == 'fallback':
                print("❌ Daily plan fell back to static activities")
                print(f"   - Activities: {activities_count}")
                print("   - This indicates both AI and BigQuery failed")
                return {'status': 'fallback', 'source': 'static', 'activities': activities_count}

        except Exception as e:
            print(f"❌ Daily plan generation failed: {e}")
            return {'status': 'error', 'error': str(e)}

    async def run_validation(self, student_id: int) -> Dict[str, Any]:
        """Run complete validation"""
        print("🚀 Starting AI Recommendations Validation")
        print("=" * 50)

        results = {}

        # Test 1: AI Service Health
        results['health'] = await self.validate_ai_service_health()
        print()

        # Test 2: Student Data
        results['student_data'] = await self.validate_student_data(student_id)
        print()

        # Test 3: Assessment Feedback
        results['assessment_feedback'] = await self.validate_assessment_feedback(student_id)
        print()

        # Test 4: AI Playlist Generation
        results['ai_playlist'] = await self.validate_ai_playlist_generation(student_id)
        print()

        # Test 5: Complete Flow
        results['daily_plan'] = await self.validate_daily_plan_flow(student_id)
        print()

        # Summary
        print("📊 VALIDATION SUMMARY")
        print("=" * 50)

        if results['daily_plan'].get('source') == 'ai':
            print("✅ SUCCESS: AI recommendations are working correctly")
        elif results['daily_plan'].get('source') == 'bigquery':
            print("⚠️ WARNING: Falling back to BigQuery recommendations")
            print("   Check AI service health and student data availability")
        elif results['daily_plan'].get('source') == 'static':
            print("❌ CRITICAL: Both AI and BigQuery are failing")
            print("   Check all service configurations")
        else:
            print("❌ ERROR: Unable to generate daily plan")

        return results


async def main():
    """Main validation function"""
    parser = argparse.ArgumentParser(description='Validate AI recommendations functionality')
    parser.add_argument('--student-id', type=int, required=True, help='Student ID to test')
    parser.add_argument('--debug', action='store_true', help='Enable debug logging')

    args = parser.parse_args()

    validator = AIRecommendationsValidator(debug=args.debug)
    results = await validator.run_validation(args.student_id)

    # Exit with appropriate code
    if results['daily_plan'].get('source') == 'ai':
        sys.exit(0)  # Success
    elif results['daily_plan'].get('source') in ['bigquery', 'static']:
        sys.exit(1)  # Warning/Error
    else:
        sys.exit(2)  # Critical error


if __name__ == '__main__':
    asyncio.run(main())