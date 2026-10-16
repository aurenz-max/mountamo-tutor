"""The common-sense checker's own maths and one rule on a hand-built trace."""
from tests.pulse_agent.common_sense import check, p_above


def test_beta_tail():
    assert abs(p_above(0.8, 13, 0) - (1 - 0.8 ** 14)) < 1e-9   # 13 straight passes: proven
    assert p_above(0.8, 10, 0) < 0.95                          # 10 is not yet enough
    assert p_above(0.8, 40, 2) > 0.95


def _day(n, lesson=(), pulse=()):
    return {"day_number": n, "lesson_log": list(lesson), "pulse_log": list(pulse)}


def _item(sid, ft, pm=None, kind="learn", p_right=None):
    return {"subskill_id": sid, "first_try": ft, "score": 10 * sum(ft) / len(ft),
            "p_mastered": pm, "kind": kind, "p_right": p_right}


def test_drill_and_massed_flagged():
    days = [_day(n, pulse=[_item("A", [True] * 4, pm=0.3)]) for n in range(1, 8)]
    rules = {r.name: r for r in check({"days": days})}
    assert not rules["not_massed"].passed                 # 7 days running
    assert not rules["no_drill_when_proven"].passed       # proven by day 4, still served daily
    assert not rules["model_not_underconfident"].passed   # model said 0.3 on a proven subskill


def test_records_split_by_item_difficulty():
    """Struggling COUNT001-01-A, 10-15: half right on hard lesson items, mostly right
    on its own-level Pulse items. Pooled, that read as failing and flagged a
    model at P(mastered) 0.85 as overconfident."""
    days = []
    for n in range(1, 11):
        lesson = [{"subskill_id": "A", "first_try": [True, False, True, False], "score": 5, "beta": 4.5}] * 4
        pulse = [dict(_item("A", [True, True, True, False], pm=0.85), target_beta=1.5)]
        days.append(_day(n, lesson=lesson, pulse=pulse))
    rules = {r.name: r for r in check({"days": days})}
    assert rules["model_not_overconfident"].passed
