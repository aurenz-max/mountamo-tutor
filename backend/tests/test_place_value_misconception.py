"""Synthetic in-memory scope journey; does not claim browser capture."""
import asyncio
from tests.test_misconception_round_trip import _TracingStore, _submission
from tests.test_misconception_generation_context import _run
from app.services.submission_service import SubmissionService


def test_place_value_scope_resolution():
    async def run():
        store = _TracingStore()
        await store.add_or_update_misconception(990040, "place-value-chart", "skill",
            "The student gives a bare digit for its worth.", "synthetic-failure",
            subskill_id="SUB-1", skill_id="SKILL-1")
        assert "place-value-chart::SKILL-1" in await store.get_active_misconceptions(990040)
        service = SubmissionService(None, None, firestore_service=store)
        async def fanout(**_kwargs):
            store.events.append("fanout")
            return {"updated": True}
        service._update_competency = fanout
        for score, primitive, skill in [(50, "place-value-chart", "SKILL-1"),
                (95, "tape-diagram", "SKILL-1"), (95, "place-value-chart", "OTHER-SKILL")]:
            await service.handle_submission(_submission(score, primitive, skill, primitive_type=primitive),
                {"firebase_uid": "synthetic", "student_id": 990040, "email": "synthetic@example.test"})
            assert "place-value-chart::SKILL-1" in await store.get_active_misconceptions(990040)
        before = len(store.events)
        await service.handle_submission(_submission(90, "place-value-chart", "SKILL-1", primitive_type="place-value-chart"),
            {"firebase_uid": "synthetic", "student_id": 990040, "email": "synthetic@example.test"})
        assert store.events[before:] == ["fanout", "resolve"]
        assert not await store.get_active_misconceptions(990040)
    asyncio.run(run())


def test_place_value_generation_identity(monkeypatch):
    result, _ = _run(monkeypatch, {"place-value-chart::SKILL-1": {
        "misconception_text": "The student gives the bare digit for worth.",
        "last_detected_at": "2026-09-12T12:00:00+00:00", "source_attempt_id": "synthetic-failure",
        "primitive_type": "place-value-chart", "scope": "skill", "skill_id": "SKILL-1",
        "subskill_id": "SUB-1", "misconception_key": "place-value-chart::SKILL-1",
    }})
    record = result["activeMisconceptions"][0]
    assert record["misconceptionKey"] == "place-value-chart::SKILL-1"
    assert record["skillId"] == "SKILL-1"
    assert record["subskillId"] == "SUB-1"
