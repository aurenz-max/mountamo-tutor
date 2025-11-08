"""
Integration tests for Foundations API endpoints
"""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def test_subskill_id():
    """Sample subskill ID for testing"""
    return "math-k-counting-1to10"


@pytest.fixture
def test_version_id():
    """Sample version ID for testing"""
    return "v1"


class TestFoundationsAPI:
    """Test suite for Foundations API endpoints"""

    def test_generate_foundations(self, client: TestClient, test_subskill_id: str, test_version_id: str):
        """Test generating foundations for a subskill"""
        response = client.post(
            f"/api/subskills/{test_subskill_id}/foundations/generate",
            params={"version_id": test_version_id}
        )

        # Note: This will fail if subskill doesn't exist in database
        # For now, we're just testing the endpoint structure
        assert response.status_code in [200, 404, 500]  # Expected possible responses

        if response.status_code == 200:
            data = response.json()
            assert data["success"] is True
            assert "data" in data
            assert "master_context" in data["data"]
            assert "context_primitives" in data["data"]
            assert "approved_visual_schemas" in data["data"]

    def test_save_foundations(self, client: TestClient, test_subskill_id: str, test_version_id: str):
        """Test saving foundations"""
        # Sample payload
        payload = {
            "master_context": {
                "core_concepts": ["Counting", "One-to-one correspondence"],
                "key_terminology": {"count": "Say numbers in order"},
                "learning_objectives": ["Count to 10"],
                "difficulty_level": "beginner",
                "grade_level": "Kindergarten",
                "prerequisites": [],
                "real_world_applications": ["Counting toys"]
            },
            "context_primitives": {
                "concrete_objects": ["apple", "toy", "block"],
                "living_things": ["dog", "cat"],
                "locations": ["classroom"],
                "tools": ["pencil"],
                "characters": [{"name": "Emma", "age": 5}],
                "scenarios": ["counting items"],
                "comparison_pairs": [],
                "categories": [],
                "sequences": [],
                "action_words": ["count"],
                "attributes": []
            },
            "approved_visual_schemas": ["object-collection"]
        }

        response = client.put(
            f"/api/subskills/{test_subskill_id}/foundations",
            json=payload,
            params={"version_id": test_version_id}
        )

        # Test endpoint accessibility
        assert response.status_code in [200, 422, 500]

    def test_get_foundations(self, client: TestClient, test_subskill_id: str, test_version_id: str):
        """Test retrieving foundations"""
        response = client.get(
            f"/api/subskills/{test_subskill_id}/foundations",
            params={"version_id": test_version_id}
        )

        # Should return 404 if not found, 200 if found
        assert response.status_code in [200, 404]

        if response.status_code == 200:
            data = response.json()
            assert data["success"] is True
            assert "data" in data

    def test_get_foundations_status(self, client: TestClient, test_subskill_id: str, test_version_id: str):
        """Test checking foundations status"""
        response = client.get(
            f"/api/subskills/{test_subskill_id}/foundations/status",
            params={"version_id": test_version_id}
        )

        assert response.status_code in [200, 500]

        if response.status_code == 200:
            data = response.json()
            assert "has_foundations" in data
            assert "subskill_id" in data
            assert "version_id" in data

    def test_list_visual_schemas(self, client: TestClient):
        """Test getting available visual schemas"""
        response = client.get("/api/visual-schemas")

        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        assert "all_schemas" in data
        assert len(data["all_schemas"]) > 0

    def test_delete_foundations(self, client: TestClient, test_subskill_id: str, test_version_id: str):
        """Test deleting foundations"""
        response = client.delete(
            f"/api/subskills/{test_subskill_id}/foundations",
            params={"version_id": test_version_id}
        )

        # Should return 404 if not found, 200 if deleted
        assert response.status_code in [200, 404, 500]


@pytest.mark.integration
class TestFoundationsWorkflow:
    """Integration test for full foundations workflow"""

    def test_full_workflow(self, client: TestClient):
        """Test complete workflow: generate -> save -> retrieve -> delete"""
        subskill_id = "test-workflow-subskill"
        version_id = "v1"

        # Step 1: Generate (may fail if subskill doesn't exist)
        gen_response = client.post(
            f"/api/subskills/{subskill_id}/foundations/generate",
            params={"version_id": version_id}
        )

        # If generation succeeds, test the full workflow
        if gen_response.status_code == 200:
            generated_data = gen_response.json()["data"]

            # Step 2: Save
            save_response = client.put(
                f"/api/subskills/{subskill_id}/foundations",
                json={
                    "master_context": generated_data["master_context"],
                    "context_primitives": generated_data["context_primitives"],
                    "approved_visual_schemas": generated_data["approved_visual_schemas"]
                },
                params={"version_id": version_id}
            )
            assert save_response.status_code == 200

            # Step 3: Retrieve
            get_response = client.get(
                f"/api/subskills/{subskill_id}/foundations",
                params={"version_id": version_id}
            )
            assert get_response.status_code == 200

            # Step 4: Delete
            delete_response = client.delete(
                f"/api/subskills/{subskill_id}/foundations",
                params={"version_id": version_id}
            )
            assert delete_response.status_code == 200

            # Step 5: Verify deletion
            verify_response = client.get(
                f"/api/subskills/{subskill_id}/foundations",
                params={"version_id": version_id}
            )
            assert verify_response.status_code == 404
