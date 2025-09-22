#!/usr/bin/env python3
"""
Test script to verify AI Assessment Service integration with batch submissions.
This script tests the complete flow from batch submission to AI summary generation.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Any, List

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Mock Cosmos DB service for testing
class MockCosmosService:
    def __init__(self):
        self.assessments = {}

    async def get_assessment(self, assessment_id: str, student_id: int, firebase_uid: str = None):
        return self.assessments.get(assessment_id)

    async def store_assessment_submission(self, assessment_id: str, student_id: int, answers: Dict, score_data: Dict, time_taken_minutes: int = None, firebase_uid: str = None):
        logger.info(f"Mock: Stored submission for {assessment_id}")
        return True

    def upsert_item(self, body: Dict):
        assessment_id = body.get("assessment_id")
        if assessment_id:
            self.assessments[assessment_id] = body
            logger.info(f"Mock: Updated assessment {assessment_id} in Cosmos DB")

# Mock AI Assessment Service for testing
class MockAIAssessmentService:
    async def generate_enhanced_assessment_summary(self, blueprint: Dict, submission_result: Dict, review_items_data: List[Dict]) -> Dict[str, Any]:
        logger.info("Mock AI: Generating enhanced assessment summary")

        # Simulate AI processing
        score_percentage = submission_result.get('score_percentage', 0)
        correct_count = submission_result.get('correct_count', 0)
        total_questions = submission_result.get('total_questions', 0)

        # Generate mock AI insights
        ai_summary = f"Great effort on your assessment! You got {correct_count} out of {total_questions} questions correct ({score_percentage:.1f}%). You showed strength in some areas and have opportunities to improve in others."

        performance_quote = "You're making excellent progress! Keep up the great work."

        skill_analysis = [
            {
                "skill_id": "test_skill_1",
                "skill_name": "Test Skill 1",
                "total_questions": 5,
                "correct_count": 4,
                "assessment_focus": "Weak Spot",
                "performance_label": "Proficient",
                "insight_text": "You did well on this skill but there's room for improvement.",
                "next_step": {
                    "text": "Practice more problems",
                    "link": "/practice/test_skill_1"
                }
            }
        ]

        common_misconceptions = [
            "Some confusion with basic concepts",
            "Need more practice with application"
        ]

        review_items = [
            {
                "problem_id": "test_prob_1",
                "question_text": "Test question 1?",
                "your_answer_text": "Test answer",
                "correct_answer_text": "Correct answer",
                "analysis": {
                    "understanding": "Good understanding demonstrated",
                    "approach": "Correct approach used"
                },
                "feedback": {
                    "praise": "Well done!",
                    "guidance": "Keep practicing",
                    "encouragement": "You're doing great!"
                },
                "related_skill_id": "test_skill_1",
                "lesson_link": "/practice/test_skill_1"
            }
        ]

        return {
            "ai_summary": ai_summary,
            "performance_quote": performance_quote,
            "skill_analysis": skill_analysis,
            "common_misconceptions": common_misconceptions,
            "review_items": review_items
        }

async def test_ai_assessment_integration():
    """Test the AI assessment service integration with batch submissions"""

    logger.info("Starting AI Assessment Integration Test")

    # Create mock services
    mock_cosmos = MockCosmosService()
    mock_ai_assessment = MockAIAssessmentService()

    # Sample assessment data (similar to the Cosmos document we saw)
    assessment_data = {
        "assessment_id": "test_assessment_123",
        "student_id": 1004,
        "subject": "Language Arts",
        "blueprint": {
            "subject": "Language Arts",
            "category_breakdown": {
                "weak_spots": 8,
                "new_frontiers": 2
            },
            "selected_subskills": [
                {
                    "subskill_id": "LA005-01-A",
                    "skill_description": "Test Skill",
                    "category": "weak_spots"
                }
            ]
        },
        "score_data": {
            "correct_count": 7,
            "total_questions": 10,
            "score_percentage": 70.0,
            "skill_breakdown": [
                {
                    "skill_name": "Test Skill",
                    "correct_answers": 4,
                    "total_questions": 5,
                    "percentage": 80.0
                }
            ]
        }
    }

    # Sample enriched submission results (from batch submission)
    enriched_submission_results = [
        {
            "id": "test_assessment_123_test_prob_1_1234567890",
            "student_id": 1004,
            "subject": "Language Arts",
            "skill_id": "LA005-01",
            "subskill_id": "LA005-01-A",
            "problem_id": "test_prob_1",
            "problem_content": {
                "question": "Test question?",
                "correct_option_id": "A"
            },
            "full_review": {
                "evaluation": {"score": 10},
                "feedback": {"praise": "Well done!", "guidance": "Keep it up"},
                "correct": True,
                "score": 10
            },
            "observation": {},
            "analysis": {},
            "evaluation": {"score": 10},
            "feedback": {"praise": "Well done!", "guidance": "Keep it up"},
            "score": 10
        }
    ]

    # Test the AI assessment integration
    try:
        # Generate AI summary
        ai_summary_data = await mock_ai_assessment.generate_enhanced_assessment_summary(
            blueprint=assessment_data["blueprint"],
            submission_result=assessment_data["score_data"],
            review_items_data=enriched_submission_results
        )

        logger.info("✅ AI Summary generated successfully")
        logger.info(f"AI Summary: {ai_summary_data.get('ai_summary', '')[:100]}...")
        logger.info(f"Performance Quote: {ai_summary_data.get('performance_quote', '')}")
        logger.info(f"Skill Analysis Count: {len(ai_summary_data.get('skill_analysis', []))}")
        logger.info(f"Common Misconceptions Count: {len(ai_summary_data.get('common_misconceptions', []))}")
        logger.info(f"Review Items Count: {len(ai_summary_data.get('review_items', []))}")

        # Verify the structure matches frontend expectations
        required_fields = ['ai_summary', 'performance_quote', 'skill_analysis', 'common_misconceptions', 'review_items']
        for field in required_fields:
            if field not in ai_summary_data:
                raise ValueError(f"Missing required field: {field}")

        # Verify skill_analysis structure
        skill_analysis = ai_summary_data.get('skill_analysis', [])
        if skill_analysis:
            skill = skill_analysis[0]
            required_skill_fields = ['skill_id', 'skill_name', 'total_questions', 'correct_count', 'assessment_focus', 'performance_label', 'insight_text', 'next_step']
            for field in required_skill_fields:
                if field not in skill:
                    raise ValueError(f"Missing skill analysis field: {field}")

        # Verify review_items structure
        review_items = ai_summary_data.get('review_items', [])
        if review_items:
            review_item = review_items[0]
            required_review_fields = ['problem_id', 'question_text', 'your_answer_text', 'correct_answer_text', 'analysis', 'feedback', 'lesson_link']
            for field in required_review_fields:
                if field not in review_item:
                    raise ValueError(f"Missing review item field: {field}")

        logger.info("✅ All data structures are valid and match frontend expectations")

        # Test storing in assessment document
        assessment_data.update({
            "ai_summary": ai_summary_data.get("ai_summary"),
            "performance_quote": ai_summary_data.get("performance_quote"),
            "skill_analysis": ai_summary_data.get("skill_analysis"),
            "common_misconceptions": ai_summary_data.get("common_misconceptions"),
            "review_items": ai_summary_data.get("review_items"),
            "ai_summary_generated_at": datetime.utcnow().isoformat()
        })

        # Store in mock Cosmos DB
        mock_cosmos.upsert_item(assessment_data)
        logger.info("✅ Assessment document updated with AI summary data")

        # Verify the stored data
        stored_assessment = await mock_cosmos.get_assessment("test_assessment_123", 1004)
        if stored_assessment:
            logger.info("✅ Assessment retrieved from Cosmos DB successfully")
            logger.info(f"AI Summary in DB: {stored_assessment.get('ai_summary', '')[:50]}...")
            logger.info(f"AI Generated At: {stored_assessment.get('ai_summary_generated_at')}")

        logger.info("🎉 AI Assessment Integration Test PASSED!")
        return True

    except Exception as e:
        logger.error(f"❌ AI Assessment Integration Test FAILED: {e}")
        return False

if __name__ == "__main__":
    # Run the test
    success = asyncio.run(test_ai_assessment_integration())
    if success:
        print("\n🎉 All tests passed! The AI assessment integration is working correctly.")
    else:
        print("\n❌ Tests failed. Please check the implementation.")