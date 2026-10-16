"""A learn pick missed day after day ranks below its easier form on value alone
(memory.value, 10-15; was the T6 rest rule); the memory maths; one good day
clears the miss record."""
import asyncio
from datetime import datetime, timedelta, timezone

from app.services.learner_graph import LearnerGraph
from app.services.learner_model import memory
from app.services.learner_model.engine import MISS_DAYS, _day_record, miss_days
from app.services.learner_model.service import LearnerStateService
from app.services import subskill_id_resolver as resolver_mod
from tests.pulse_agent.in_memory_firestore import InMemoryFirestoreService

EASY, HARD, OTHER = "Kindergarten:OPS-A", "Kindergarten:OPS-B", "Kindergarten:CNT-A"


def _graph() -> LearnerGraph:
    def node(sid, beta, parents=()):
        return {"label": sid, "subskill_id": sid, "grade": "Kindergarten", "skill_id": sid[:3],
                "beta": beta, "parents": list(parents)}
    easier = {"key": EASY, "in_model": True, "score": 0.6, "step": 0.2, "easier_form": 0.9}
    return LearnerGraph(subject="MATHEMATICS", version="v1", validation={}, nodes={
        EASY: node("OPS-A", 2.0), HARD: node("OPS-B", 5.0, [easier]), OTHER: node("CNT-A", 3.0),
    })


def _service(monkeypatch):
    async def resolve(sid):
        return sid
    monkeypatch.setattr(resolver_mod.subskill_id_resolver, "resolve", resolve)

    async def source(_subject):
        return _graph()
    fs = InMemoryFirestoreService()
    return fs, LearnerStateService(fs, graph_source=source, background=False)


def _miss_hard_on(fs, svc, days):
    start = datetime(2026, 9, 1, 15, tzinfo=timezone.utc)
    for d in days:
        fs.virtual_now = start + timedelta(days=d)
        for _ in range(2):
            asyncio.run(svc.observe(student_id=1, subject="MATHEMATICS", subskill_id="OPS-B",
                                    score=2.0, grade="K"))
    return start


def _picks(fs, svc, when):
    fs.virtual_now = when
    sel = asyncio.run(svc.select(1, "MATHEMATICS", count=3, grade="K"))
    return sel["picks"]


def test_missed_pick_ranks_below_its_easier_form(monkeypatch):
    fs, svc = _service(monkeypatch)
    start = _miss_hard_on(fs, svc, range(MISS_DAYS))
    keys = [p["key"] for p in _picks(fs, svc, start + timedelta(days=MISS_DAYS))]
    assert EASY in keys
    assert HARD not in keys or keys.index(EASY) < keys.index(HARD), keys


def test_spaced_success_builds_more_stability_than_massed():
    t = memory.update({}, "2026-09-01", 1.0)
    assert t["S"] == memory.S0
    assert memory.update(t, "2026-09-01", 1.0)["S"] == memory.S0          # same day: nothing built
    nxt = memory.update(t, "2026-09-02", 1.0)["S"]
    later = memory.update(t, "2026-09-08", 1.0)["S"]
    assert memory.S0 < nxt < later
    assert memory.update(t, "2026-09-08", 0.0)["S"] < memory.S0           # a failed day loses stability


def test_overlearned_material_is_stable_longer():
    easy = memory.update({}, "2026-09-01", 1.0, pc=0.99)["S"]
    hard = memory.update({}, "2026-09-01", 0.75, pc=0.99)["S"]     # passed with a miss
    assert easy > 4 * hard


def test_review_value_grows_with_time_since_practice():
    t = memory.update({}, "2026-09-01", 1.0)
    v = [memory.value(t, f"2026-09-{d:02d}", pm=0.95, pc=0.9, dpm=0.0)["retain"] for d in (2, 5, 15)]
    assert v[0] < v[1] < v[2]
    assert v[0] < 0.5 * v[2]


def test_good_day_clears_the_run():
    t = {}
    for day, x in [("2026-09-01", 0.2), ("2026-09-02", 0.3), ("2026-09-03", 0.9)]:
        t.update(_day_record(t, day, x))
    assert miss_days(t) == 0
    t.update(_day_record(t, "2026-09-04", 0.5))
    assert miss_days(t) == 1
    t.update(_day_record(t, "2026-09-04", 0.9))   # same day: the day's mean decides
    assert miss_days(t) == 0


def test_first_try_rule_reads_workspace_outcomes():
    from app.services.learner_model.service import first_try_from_response
    resp = {"student_work": {"challengeResults": [
        {"id": "a", "solved": True, "attempts": 1, "assisted": False},
        {"id": "b", "solved": False, "attempts": 1, "assisted": False},   # missed once, never solved
        {"id": "c", "solved": True, "attempts": 1, "assisted": True},     # help lever pulled
        {"id": "d", "solved": True, "attempts": 1, "uncertain": True},    # left out
        {"challengeId": "e", "correct": True, "attempts": 1},            # useChallengeProgress shape
        {"challengeId": "f", "correct": True, "attempts": 2},
    ]}}
    assert first_try_from_response(resp) == [True, False, False, True, False]


def test_success_on_harder_form_refreshes_easier_forms_memory(monkeypatch):
    fs, svc = _service(monkeypatch)
    start = datetime(2026, 9, 1, 15, tzinfo=timezone.utc)
    fs.virtual_now = start
    asyncio.run(svc.observe(student_id=1, subject="MATHEMATICS", subskill_id="OPS-A", score=10.0, grade="K"))
    fs.virtual_now = start + timedelta(days=5)
    asyncio.run(svc.observe(student_id=1, subject="MATHEMATICS", subskill_id="OPS-B", score=10.0, grade="K"))
    import json
    touched = json.loads(asyncio.run(fs.get_learner_state(1, "MATHEMATICS"))["state_json"])["touched"]
    assert touched[EASY]["mem_day"] == "2026-09-06"
    assert touched[EASY]["S"] > memory.S0
