"""C18/C15: Pulse reports the learner model's gate moves; the lifecycle engine writes no gate."""

import asyncio

from app.services.mastery_lifecycle_engine import MasteryLifecycleEngine
from app.services.pulse_engine import PulseEngine

START = "2026-10-16T15:00:00+00:00"


def _hist(*entries):
    return [{"gate": g, "timestamp": ts, "score": 5.0, "passed": False, "source": "learner_model"}
            for g, ts in entries]


class _Store:
    def __init__(self, docs):
        self.docs = docs
        self.writes = []

    async def get_mastery_lifecycles_batch(self, sid, ids):
        return {i: self.docs.get(i) for i in ids}

    async def get_mastery_lifecycle(self, sid, ssid):
        return self.docs.get(ssid)

    async def get_global_practice_pass_rate(self, sid):
        return {"global_practice_pass_rate": 0.8}

    async def upsert_mastery_lifecycle(self, sid, ssid, data):
        self.writes.append((ssid, data))
        return data


class _Learner:
    drained = False

    async def drain(self):
        self.drained = True


def _changes(docs, ids):
    engine = PulseEngine.__new__(PulseEngine)
    engine.firestore = _Store(docs)
    engine.learner_state = _Learner()
    out = asyncio.run(engine._gate_changes(1, START, ids, {}))
    assert engine.learner_state.drained  # the answers' background syncs land first
    return {g.subskill_id: (g.old_gate, g.new_gate) for g in out}


def test_fall_is_reported_as_a_fall_not_an_advance():
    # Gate 3 before the session (the max of its history is 4, from an older
    # entry): the latest entry before the start is the gate in force.
    docs = {"A": {"current_gate": 2, "gate_history": _hist(
        (4, "2026-10-10T10:00:00+00:00"), (3, "2026-10-12T10:00:00+00:00"),
        (2, "2026-10-16T15:05:00+00:00"))}}
    assert _changes(docs, ["A"]) == {"A": (3, 2)}


def test_advance_unchanged_and_new_subskill():
    docs = {
        "A": {"current_gate": 3, "gate_history": _hist((1, "2026-10-15T10:00:00+00:00"),
                                                        (3, "2026-10-16T15:02:00+00:00"))},
        "B": {"current_gate": 2, "gate_history": _hist((2, "2026-10-14T10:00:00+00:00"))},
        "C": {"current_gate": 1, "gate_history": _hist((1, "2026-10-16T15:03:00+00:00"))},
    }
    # B did not move; C was first seen this session (before = gate 0)
    assert _changes(docs, ["A", "B", "C", "D"]) == {"A": (1, 3), "C": (0, 1)}


def test_eval_record_never_touches_the_gate():
    doc = {"student_id": 1, "subskill_id": "A", "current_gate": 3, "retention_state": "active",
           "stability": 12.0, "gate_history": _hist((3, "2026-10-12T10:00:00+00:00")),
           "next_retest_eligible": "2026-10-13T00:00:00+00:00", "passes": 1.0, "fails": 1.0}
    store = _Store({"A": doc})
    asyncio.run(MasteryLifecycleEngine(store).process_eval_result(
        student_id=1, subskill_id="A", subject="MATHEMATICS", skill_id="S",
        score=10.0, source="practice", timestamp=START))
    (ssid, written), = store.writes
    assert ssid == "A" and written["passes"] == 2.0
    for k in ("current_gate", "retention_state", "stability", "gate_history",
              "next_retest_eligible", "retest_interval_days"):
        assert k not in written


def test_first_answer_creates_the_doc_at_gate_0():
    store = _Store({})
    asyncio.run(MasteryLifecycleEngine(store).process_eval_result(
        student_id=1, subskill_id="A", subject="MATHEMATICS", skill_id="S",
        score=9.5, source="lesson", timestamp=START))
    (_, written), = store.writes
    assert written["current_gate"] == 0 and written["gate_history"] == []
    assert written["lesson_eval_count"] == 1 and "next_retest_eligible" not in written
