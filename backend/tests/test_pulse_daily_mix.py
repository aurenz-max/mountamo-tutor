"""Daily-mix Pulse: items split across subjects by the daily plan's weights."""

import asyncio

from app.services.pulse_engine import PulseEngine


class FakeLearnerState:
    def __init__(self, pools):
        self.pools = pools
        self.calls = []

    async def select(self, student_id, subject, count, confirm_share=0.5, grade=None):
        self.calls.append((subject, grade))
        if subject not in self.pools:
            return None
        picks = [{"subskill_id": f"{subject}-{i}"} for i in range(min(count, self.pools[subject]))]
        return {"picks": picks, "observations": 1, "student_grade": "K",
                "graph_version": "v", "pool_sizes": {}}


def mix(pools, weights, n):
    engine = PulseEngine.__new__(PulseEngine)
    engine.learner_state = FakeLearnerState(pools)
    sel = asyncio.run(engine._select_daily_mix(1, n, weights))
    return engine, sel


def test_quota_follows_weights_and_interleaves():
    _, sel = mix({"MATH": 10, "SCI": 10}, {"MATH": {"weight": 30.0, "grade": "K"},
                                          "SCI": {"weight": 10.0, "grade": "1"}}, 8)
    assert sel["subject_quota"] == {"MATH": 6, "SCI": 2}
    assert [p["subject"] for p in sel["picks"][:4]] == ["MATH", "SCI", "MATH", "SCI"]
    assert len(sel["picks"]) == 8


def test_short_subject_passes_its_slots_on_and_grades_reach_select():
    engine, sel = mix({"MATH": 10, "SCI": 1}, {"MATH": {"weight": 1.0, "grade": "K"},
                                              "SCI": {"weight": 1.0, "grade": "1"},
                                              "ELA": {"weight": 1.0, "grade": "K"}}, 6)
    assert sel["subject_quota"] == {"MATH": 5, "SCI": 1}
    assert ("SCI", "1") in engine.learner_state.calls


def test_no_graph_anywhere_is_none():
    assert mix({}, {"MATH": {"weight": 1.0}}, 6)[1] is None
    assert mix({"MATH": 3}, {}, 6)[1] is None
