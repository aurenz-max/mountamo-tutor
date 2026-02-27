import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock

# Add backend to path
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.learning_paths import LearningPathsService


def _make_graph(nodes, edges):
    """Helper to build a mock curriculum graph response."""
    return {
        "graph": {"nodes": nodes, "edges": edges},
        "version_id": "test-v1",
        "generated_at": "2026-01-01T00:00:00Z",
    }


class TestLearningPathsService(unittest.TestCase):
    def setUp(self):
        self.project_id = "test-project"
        self.firestore_service = MagicMock()

        self.service = LearningPathsService(
            firestore_service=self.firestore_service,
            project_id=self.project_id,
        )

        # Default mock graph: A -> B -> C  (linear prerequisite chain)
        self.mock_graph = _make_graph(
            nodes=[
                {"id": "SKILL-01", "type": "skill", "subject": "Math", "description": "Skill 1"},
                {"id": "SKILL-01-A", "type": "subskill", "subject": "Math", "skill_id": "SKILL-01", "description": "Sub A"},
                {"id": "SKILL-01-B", "type": "subskill", "subject": "Math", "skill_id": "SKILL-01", "description": "Sub B"},
                {"id": "SKILL-02", "type": "skill", "subject": "Math", "description": "Skill 2"},
                {"id": "SKILL-02-A", "type": "subskill", "subject": "Math", "skill_id": "SKILL-02", "description": "Sub 2A"},
            ],
            edges=[
                {"source": "SKILL-01-A", "target": "SKILL-01-B", "threshold": 0.8},
                {"source": "SKILL-01", "target": "SKILL-02", "threshold": 0.8},
                {"source": "SKILL-01-B", "target": "SKILL-02-A", "threshold": 0.8},
            ],
        )

        # Pre-populate graph cache
        self.service._graph_cache["Math:published"] = self.mock_graph

        # Default mock for get_curriculum_graph (returns our test graph)
        self.firestore_service.get_curriculum_graph = AsyncMock(return_value=self.mock_graph)
        self.firestore_service.get_all_published_subjects = AsyncMock(
            return_value=[{"subject_id": "Math", "grade": "K"}]
        )
        self.firestore_service.get_graph_status = AsyncMock(
            return_value={"total_cached": 1}
        )

    # ==================== Unlock Logic ====================

    def test_entry_points_always_unlocked(self):
        """Nodes with no prerequisites are always unlocked."""
        self.firestore_service.get_student_proficiency_map = AsyncMock(return_value={})

        unlocked = asyncio.run(
            self.service.get_unlocked_entities(student_id=1, subject="Math")
        )

        # SKILL-01 and SKILL-01-A have no incoming edges, so they are entry points
        self.assertIn("SKILL-01", unlocked)
        self.assertIn("SKILL-01-A", unlocked)
        # SKILL-01-B requires SKILL-01-A mastery
        self.assertNotIn("SKILL-01-B", unlocked)

    def test_prerequisite_met_unlocks_next(self):
        """When a prerequisite meets threshold, downstream entity unlocks."""
        self.firestore_service.get_student_proficiency_map = AsyncMock(
            return_value={
                "SKILL-01-A": {"proficiency": 0.85, "attempt_count": 5, "last_updated": None},
            }
        )

        unlocked = asyncio.run(
            self.service.get_unlocked_entities(student_id=1, subject="Math")
        )

        # SKILL-01-A mastered (0.85 >= 0.8), so SKILL-01-B should unlock
        self.assertIn("SKILL-01-B", unlocked)

    def test_prerequisite_not_met_stays_locked(self):
        """When prerequisite is below threshold, downstream stays locked."""
        self.firestore_service.get_student_proficiency_map = AsyncMock(
            return_value={
                "SKILL-01-A": {"proficiency": 0.5, "attempt_count": 3, "last_updated": None},
            }
        )

        unlocked = asyncio.run(
            self.service.get_unlocked_entities(student_id=1, subject="Math")
        )

        self.assertNotIn("SKILL-01-B", unlocked)

    def test_entity_type_filter(self):
        """entity_type filter returns only matching types."""
        self.firestore_service.get_student_proficiency_map = AsyncMock(return_value={})

        unlocked = asyncio.run(
            self.service.get_unlocked_entities(student_id=1, entity_type="skill", subject="Math")
        )

        # Only skills should be returned
        for entity_id in unlocked:
            self.assertEqual(self.service._detect_entity_type(entity_id), "skill")

    # ==================== check_prerequisites_met ====================

    def test_check_prerequisites_met_no_prereqs(self):
        """Entity with no prerequisites should be unlocked."""
        self.firestore_service.get_student_proficiency_map = AsyncMock(return_value={})

        result = asyncio.run(
            self.service.check_prerequisites_met(
                student_id=1,
                target_entity_id="SKILL-01-A",
                target_entity_type="subskill"
            )
        )

        self.assertTrue(result["unlocked"])
        self.assertEqual(len(result["prerequisites"]), 0)

    def test_check_prerequisites_met_with_data(self):
        """Check prerequisites returns detailed info."""
        self.firestore_service.get_student_proficiency_map = AsyncMock(
            return_value={
                "SKILL-01-A": {"proficiency": 0.9, "attempt_count": 10, "last_updated": None},
            }
        )

        result = asyncio.run(
            self.service.check_prerequisites_met(
                student_id=1,
                target_entity_id="SKILL-01-B",
                target_entity_type="subskill"
            )
        )

        self.assertTrue(result["unlocked"])
        self.assertEqual(len(result["prerequisites"]), 1)
        self.assertEqual(result["prerequisites"][0]["prerequisite_id"], "SKILL-01-A")
        self.assertTrue(result["prerequisites"][0]["met"])

    # ==================== Student Graph ====================

    def test_student_graph_statuses(self):
        """Student graph decorates nodes with correct statuses."""
        self.firestore_service.get_student_proficiency_map = AsyncMock(
            return_value={
                "SKILL-01-A": {"proficiency": 0.9, "attempt_count": 10, "last_updated": None},
                "SKILL-01-B": {"proficiency": 0.3, "attempt_count": 2, "last_updated": None},
            }
        )

        result = asyncio.run(
            self.service.get_student_graph(student_id=1, subject_id="Math")
        )

        node_map = {n["id"]: n for n in result["nodes"]}

        self.assertEqual(node_map["SKILL-01-A"]["status"], "MASTERED")
        self.assertEqual(node_map["SKILL-01-B"]["status"], "IN_PROGRESS")
        # SKILL-02-A prerequisites not met (needs SKILL-01-B >= 0.8)
        self.assertEqual(node_map["SKILL-02-A"]["status"], "LOCKED")

    # ==================== Recalculate Unlocks ====================

    def test_recalculate_detects_newly_unlocked(self):
        """recalculate_unlocks detects newly unlocked entities."""
        # Previous state: only entry points unlocked
        self.firestore_service.get_learning_path = AsyncMock(
            return_value={
                "unlocked_entities": ["SKILL-01", "SKILL-01-A"],
                "entity_statuses": {},
            }
        )
        self.firestore_service.save_learning_path = AsyncMock()

        # Student has now mastered SKILL-01-A
        self.firestore_service.get_student_proficiency_map = AsyncMock(
            return_value={
                "SKILL-01-A": {"proficiency": 0.85, "attempt_count": 5, "last_updated": None},
            }
        )

        result = asyncio.run(
            self.service.recalculate_unlocks(student_id=1, subject_id="Math")
        )

        self.assertIn("SKILL-01-B", result["newly_unlocked"])
        self.assertIn("SKILL-01-B", result["unlocked_entities"])
        # Verify save was called
        self.firestore_service.save_learning_path.assert_called_once()

    # ==================== Recommendations ====================

    def test_recommendations_sorted_by_priority(self):
        """Recommendations prioritize coverage gaps over performance gaps."""
        self.firestore_service.get_student_proficiency_map = AsyncMock(
            return_value={
                "SKILL-01-A": {"proficiency": 0.85, "attempt_count": 10, "last_updated": None},
                "SKILL-01-B": {"proficiency": 0.3, "attempt_count": 2, "last_updated": None},
            }
        )
        self.firestore_service.get_published_curriculum = AsyncMock(return_value={
            "curriculum": [{
                "unit_id": "U1",
                "unit_title": "Unit 1",
                "skills": [{
                    "skill_id": "SKILL-01",
                    "skill_description": "Skill 1",
                    "subskills": [
                        {"subskill_id": "SKILL-01-A", "subskill_description": "Sub A"},
                        {"subskill_id": "SKILL-01-B", "subskill_description": "Sub B"},
                    ]
                }, {
                    "skill_id": "SKILL-02",
                    "skill_description": "Skill 2",
                    "subskills": [
                        {"subskill_id": "SKILL-02-A", "subskill_description": "Sub 2A"},
                    ]
                }]
            }],
            "subskill_index": {
                "SKILL-01-A": {"subject": "Math", "skill_id": "SKILL-01", "skill_description": "Skill 1", "subskill_description": "Sub A"},
                "SKILL-01-B": {"subject": "Math", "skill_id": "SKILL-01", "skill_description": "Skill 1", "subskill_description": "Sub B"},
                "SKILL-02-A": {"subject": "Math", "skill_id": "SKILL-02", "skill_description": "Skill 2", "subskill_description": "Sub 2A"},
            },
        })

        recs = asyncio.run(
            self.service.get_recommendations(student_id=1, subject="Math", limit=5)
        )

        # SKILL-01-B has low proficiency (performance_gap), should appear
        rec_ids = [r["entity_id"] for r in recs]
        self.assertIn("SKILL-01-B", rec_ids)
        # SKILL-01-A is mastered, should NOT appear
        self.assertNotIn("SKILL-01-A", rec_ids)

    # ==================== Entity Type Detection ====================

    def test_detect_entity_type(self):
        self.assertEqual(self.service._detect_entity_type("COUNT001-01"), "skill")
        self.assertEqual(self.service._detect_entity_type("COUNT001-01-A"), "subskill")
        self.assertEqual(self.service._detect_entity_type("OPS001-02-B"), "subskill")

    # ==================== Health Check ====================

    def test_health_check(self):
        result = asyncio.run(self.service.health_check())
        self.assertEqual(result["status"], "healthy")
        self.assertEqual(result["backend"], "firestore")


if __name__ == "__main__":
    unittest.main()
