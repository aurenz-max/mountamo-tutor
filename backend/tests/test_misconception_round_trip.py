import asyncio

from app.schemas.problem_submission import ProblemSubmission
from app.services.submission_service import SubmissionService
from tests.pulse_agent.full_loop import run_misconception_round_trip
from tests.pulse_agent.in_memory_firestore import InMemoryFirestoreService


class _TracingStore(InMemoryFirestoreService):
    def __init__(self):
        super().__init__()
        self.events = []

    async def resolve_misconception(self, student_id, primitive_type, skill_id=None):
        self.events.append("resolve")
        return await super().resolve_misconception(student_id, primitive_type, skill_id)


def _submission(score: float, primitive_tag: str, skill_tag=None) -> ProblemSubmission:
    return ProblemSubmission(
        subject="Mathematics",
        problem={
            "problem_type": "lumina_primitive",
            "id": f"remediation-{score}",
            "primitive_type": "tape-diagram",
            "skill_id": "SKILL-1",
            "subskill_id": "SUB-1",
            "metadata": {
                "remediation_for_primitive_type": primitive_tag,
                **({"remediation_for_skill_id": skill_tag} if skill_tag else {}),
            },
        },
        skill_id="SKILL-1",
        subskill_id="SUB-1",
        student_answer=f"tape-diagram - {score}%",
        canvas_used=False,
        primitive_response={
            "pre_evaluated": True,
            "success": score >= 80,
            "score": score,
            "metrics": {"type": "tape-diagram", "evalMode": "solve_comparison"},
            "eval_mode": "solve_comparison",
        },
        source="lesson",
    )


def test_in_memory_round_trip_closes_only_after_strong_matched_submit():
    async def scenario():
        store = _TracingStore()
        service = SubmissionService(
            review_service=None,
            competency_service=None,
            firestore_service=store,
        )

        async def fake_fanout(**_kwargs):
            store.events.append("fanout")
            return {"updated": True}

        service._update_competency = fake_fanout

        async def submit(score: float, tag: str):
            before = len(store.events)
            result = await service.handle_submission(
                _submission(score, "tape-diagram"),
                {
                    "firebase_uid": "synthetic-user",
                    "student_id": 990031,
                    "email": "synthetic@example.test",
                },
            )
            events = store.events[before:]
            return {
                "remediation_successful": bool(
                    result.review.get("metadata", {}).get("remediation_successful")
                ),
                "events": events,
            }

        journey = await run_misconception_round_trip(
            store,
            submit,
            student_id=990031,
            subskill_id="SUB-1",
        )
        return journey

    journey = asyncio.run(scenario())
    assert journey["status"] == "CLOSED"
    assert journey["distractor_result"]["events"] == ["fanout"]
    assert journey["strong_result"]["events"] == ["fanout", "resolve"]


def test_mismatched_tag_cannot_resolve_another_subskill():
    async def scenario():
        store = _TracingStore()
        await store.add_or_update_misconception(
            990032, "comparison-builder", "primitive", "A private diagnosis", "attempt-1",
            subskill_id="OTHER-SUB",
        )
        service = SubmissionService(None, None, firestore_service=store)

        async def fake_fanout(**_kwargs):
            store.events.append("fanout")
            return {"updated": True}

        service._update_competency = fake_fanout
        result = await service.handle_submission(
            _submission(95.0, "comparison-builder"),
            {
                "firebase_uid": "synthetic-user",
                "student_id": 990032,
                "email": "synthetic@example.test",
            },
        )
        return result, await store.get_active_misconceptions(990032)

    result, active = asyncio.run(scenario())
    assert "comparison-builder" in active
    assert not result.review["metadata"].get("remediation_successful")


def test_skill_scoped_tag_cannot_resolve_outside_skill():
    async def scenario():
        store = _TracingStore()
        await store.add_or_update_misconception(
            990033, "tape-diagram", "skill", "A private diagnosis", "attempt-1",
            subskill_id="SUB-1", skill_id="OTHER-SKILL",
        )
        service = SubmissionService(None, None, firestore_service=store)
        service._update_competency = lambda **_kwargs: asyncio.sleep(0, result={"updated": True})
        result = await service.handle_submission(
            _submission(95.0, "tape-diagram", "OTHER-SKILL"),
            {"firebase_uid": "synthetic-user", "student_id": 990033, "email": "x@test"},
        )
        return result, await store.get_active_misconceptions(990033)

    result, active = asyncio.run(scenario())
    assert "tape-diagram::OTHER-SKILL" in active
    assert not result.review["metadata"].get("remediation_successful")
