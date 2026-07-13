import asyncio

from app.api.endpoints import student_profile


class _FakeFirestore:
    def __init__(self, misconceptions):
        self.misconceptions = misconceptions
        self.requested_subskills = None

    async def get_mastery_lifecycles_batch(self, _student_id, subskill_ids):
        return {sid: None for sid in subskill_ids}

    async def get_active_misconceptions(self, _student_id, subskill_ids=None):
        self.requested_subskills = subskill_ids
        return self.misconceptions

    async def get_student_ability(self, _student_id, _skill_id):
        return None


class _FakeCompetencyService:
    async def get_competency(self, **_kwargs):
        return None


class _UnusedMappingService:
    retrieval_matcher = None


def _request():
    return student_profile.GenerationContextRequest(
        student_id=1004,
        topic="Comparing quantities",
        grade_level="1",
        subject="Mathematics",
        include_persona=False,
        objectives=[student_profile.ObjectiveIn(
            id="obj-compare",
            text="Compare two quantities and find the difference",
            verb="apply",
            subskill_id="SUB-1",
            skill_id="SKILL-1",
        )],
    )


def _run(monkeypatch, misconceptions):
    firestore = _FakeFirestore(misconceptions)
    monkeypatch.setattr(student_profile, "get_firestore_service", lambda: firestore)
    result = asyncio.run(student_profile.get_generation_context(
        _request(),
        user_context={},
        competency_service=_FakeCompetencyService(),
        mapping_service=_UnusedMappingService(),
    ))
    return result, firestore


def test_generation_context_exposes_active_misconception(monkeypatch):
    result, firestore = _run(monkeypatch, {
        "tape-diagram": {
            "misconception_text": "The student treats the smaller quantity as the difference.",
            "last_detected_at": "2026-07-10T12:00:00+00:00",
            "source_attempt_id": "attempt-123",
            "primitive_type": "tape-diagram",
            "scope": "primitive",
            "skill_id": None,
            "subskill_id": "SUB-1",
            "misconception_key": "tape-diagram",
        },
    })

    assert firestore.requested_subskills == ["SUB-1"]
    assert result["activeMisconceptions"][0] == {
        "text": "The student treats the smaller quantity as the difference.",
        "detectedAt": "2026-07-10T12:00:00+00:00",
        "sourceAttemptId": "attempt-123",
        "primitiveType": "tape-diagram",
        "scope": "primitive",
        "skillId": None,
        "subskillId": "SUB-1",
        "misconceptionKey": "tape-diagram",
    }


def test_generation_context_omits_field_without_active_misconception(monkeypatch):
    result, _ = _run(monkeypatch, {})
    assert result["activeMisconceptions"] == []
