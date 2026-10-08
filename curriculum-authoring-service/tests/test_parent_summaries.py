"""parent_summary staleness and its path into the published subskill_index."""

from app.db.draft_curriculum_service import DraftCurriculumService
from app.services.parent_summaries import needs_summary, source_hash


def test_a_summary_goes_stale_when_its_description_changes():
    ss = {"subskill_id": "X", "subskill_description": "Count to 10"}
    assert needs_summary(ss)
    ss.update(parent_summary="Counts to 10.", parent_summary_hash=source_hash("Count to 10"))
    assert not needs_summary(ss)
    ss["subskill_description"] = "Count to 20"
    assert needs_summary(ss)


def test_the_index_carries_the_summary():
    doc = {"subject_name": "Math", "grade": "Kindergarten", "curriculum": [{
        "unit_id": "U1", "unit_title": "Counting", "status": "accepted",
        "skills": [{"skill_id": "S1", "skill_description": "Count", "subskills": [
            {"subskill_id": "A", "subskill_description": "Count to 10", "parent_summary": "Counts to 10."},
            {"subskill_id": "B", "subskill_description": "Count to 20"},
        ]}],
    }]}
    DraftCurriculumService._rebuild_subskill_index(doc)
    assert doc["subskill_index"]["A"]["parent_summary"] == "Counts to 10."
    assert "parent_summary" not in doc["subskill_index"]["B"]
