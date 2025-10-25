import asyncio
import os
import unittest
from unittest.mock import AsyncMock, MagicMock

from google.cloud import bigquery

# Add backend to path
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.learning_paths import LearningPathsService

class TestLearningPathsService(unittest.TestCase):
    def setUp(self):
        self.project_id = "test-project"
        self.dataset_id = "test-dataset"
        self.analytics_service = MagicMock()
        self.firestore_service = MagicMock()

        self.service = LearningPathsService(
            analytics_service=self.analytics_service,
            firestore_service=self.firestore_service,
            project_id=self.project_id,
            dataset_id=self.dataset_id,
        )
        self.service.client = MagicMock()

    def test_get_recommendations_sorted_sequentially(self):
        student_id = 123
        subject = "Math"
        limit = 5

        mock_results = [
            {
                "subskill_id": "SUB1", "unit_order": 1, "skill_order": 1, "subskill_order": 1, 
                "subskill_description": "Subskill 1", "subject": "Math", "skill_id": "SKILL1", 
                "skill_description": "Skill 1", "proficiency": 0.1, "prerequisites": []
            },
            {
                "subskill_id": "SUB3", "unit_order": 1, "skill_order": 2, "subskill_order": 1, 
                "subskill_description": "Subskill 3", "subject": "Math", "skill_id": "SKILL2", 
                "skill_description": "Skill 2", "proficiency": 0.2, "prerequisites": []
            },
            {
                "subskill_id": "SUB2", "unit_order": 1, "skill_order": 1, "subskill_order": 2, 
                "subskill_description": "Subskill 2", "subject": "Math", "skill_id": "SKILL1", 
                "skill_description": "Skill 1", "proficiency": 0.3, "prerequisites": []
            },
        ]

        # Mock the async query runner
        self.service._run_query_async = AsyncMock(return_value=mock_results)

        # Run the function
        recommendations = asyncio.run(self.service.get_recommendations(student_id, subject, limit))

        # Check that the recommendations are sorted correctly
        self.assertEqual(len(recommendations), 3)
        self.assertEqual(recommendations[0]["entity_id"], "SUB1")
        self.assertEqual(recommendations[1]["entity_id"], "SUB2")
        self.assertEqual(recommendations[2]["entity_id"], "SUB3")

if __name__ == "__main__":
    unittest.main()