"""P1.4: an answer recorded under a retired subskill id lands on its successor."""
import asyncio

from app.services.learner_graph import LearnerGraph
from app.services.learner_model.service import LearnerStateService
from app.services import subskill_id_resolver as resolver_mod
from tests.pulse_agent.in_memory_firestore import InMemoryFirestoreService


def _graph() -> LearnerGraph:
    node = lambda sid: {"label": sid, "subskill_id": sid, "beta": 2.0, "parents": []}
    return LearnerGraph(subject="MATHEMATICS", version="v1", validation={}, nodes={
        "Kindergarten:COUNT001-01-A": node("COUNT001-01-A"),
        "Kindergarten:COUNT001-01-B": node("COUNT001-01-B"),
    })


def test_retired_id_is_keyed_by_its_successor(monkeypatch):
    async def resolve(sid):
        return {"COUNT001-01-a": "COUNT001-01-A"}.get(sid, sid)
    monkeypatch.setattr(resolver_mod.subskill_id_resolver, "resolve", resolve)

    async def source(_subject):
        return _graph()
    svc = LearnerStateService(InMemoryFirestoreService(), graph_source=source, background=False)
    event = asyncio.run(svc.observe(
        student_id=1, subject="MATHEMATICS", subskill_id="COUNT001-01-a",
        score=10, grade="K",
    ))
    assert event is not None
    assert "Kindergarten:COUNT001-01-A" in str(event)


def test_unknown_id_is_still_skipped(monkeypatch):
    async def resolve(sid):
        return sid
    monkeypatch.setattr(resolver_mod.subskill_id_resolver, "resolve", resolve)

    async def source(_subject):
        return _graph()
    svc = LearnerStateService(InMemoryFirestoreService(), graph_source=source, background=False)
    assert asyncio.run(svc.observe(
        student_id=1, subject="MATHEMATICS", subskill_id="NOPE-01", score=10, grade="K",
    )) is None
