"""C14: regate sets every lifecycle doc from a learner state, not only the ones an answer moved."""

import asyncio
import json

from app.services.learner_model.service import LearnerStateService


class _Graph:
    subject = "MATHEMATICS"
    version = "v1"
    nodes = {"K:A": {"subskill_id": "A"}, "K:B": {"subskill_id": "B"}, "K:C": {"subskill_id": "C"}}


class _Store:
    def __init__(self, state):
        self.state = state

    async def get_student_planning_fields(self, sid):
        return {"grade_level": "K"}

    async def get_learner_state(self, sid, subject):
        return self.state

    async def get_all_mastery_lifecycles(self, sid):
        return [{"subskill_id": s, "current_gate": 1, "retention_state": "active"} for s in ("A", "B", "C")]


class _Engine:
    def __init__(self):
        self.calls = []

    async def apply_model_states(self, sid, updates):
        self.calls.append(updates)
        return len(updates)


def _svc(state):
    svc = LearnerStateService(_Store(state), graph_source=lambda s: _async(_Graph()), background=False)
    svc._graph = lambda s: _async((_Graph(), None))
    svc._canonical = lambda sid: _async(sid)
    svc.lifecycle_engine = _Engine()
    return svc


async def _async(v):
    return v


READOUT = {"K:A": [0.95, 0.97, 1.0], "K:B": [0.3, 0.72, 1.0], "K:C": [0.1, 0.2, 0.5]}


def test_regate_sets_every_doc_and_dry_run_writes_nothing():
    state = {"readout_json": json.dumps(READOUT),
             "state_json": json.dumps({"touched": {"K:A": {"S": 400.0}}})}
    svc = _svc(state)
    out = asyncio.run(svc.regate(1, "MATHEMATICS"))
    by = {u["doc"]["subskill_id"]: u for u in out["updates"]}
    assert by["A"]["gate"] == 4 and by["A"]["retention_state"] == "mastered"
    assert by["C"]["gate"] == 1 and by["C"]["retention_state"] == "active"
    assert out["written"] == 0 and svc.lifecycle_engine.calls == []
    assert asyncio.run(svc.regate(1, "MATHEMATICS", apply=True))["written"] == 3


def test_regate_without_memory_stability_drops_mastered_unless_rebuilt():
    # a state stored before 10-16 has no S: the backfill must rebuild first (--rebuild)
    old = {"readout_json": json.dumps(READOUT), "state_json": json.dumps({"touched": {"K:A": {}}})}
    svc = _svc(old)
    a = next(u for u in asyncio.run(svc.regate(1, "MATHEMATICS"))["updates"] if u["doc"]["subskill_id"] == "A")
    assert a["gate"] == 4 and a["retention_state"] == "active"
    rebuilt = {"readout_json": json.dumps(READOUT), "state_json": json.dumps({"touched": {"K:A": {"S": 400.0}}})}
    a = next(u for u in asyncio.run(svc.regate(1, "MATHEMATICS", doc=rebuilt))["updates"]
             if u["doc"]["subskill_id"] == "A")
    assert a["retention_state"] == "mastered"


def test_no_learner_state_is_none():
    assert asyncio.run(_svc({}).regate(1, "MATHEMATICS")) is None
