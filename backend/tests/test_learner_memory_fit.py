"""The child's forgetting fit (learner_model/memory.py): defaults without
evidence, shrunk toward them with little, the child's own rate with plenty, and
a miss the knowledge model expected is not read as forgetting."""
import math
import random

from app.services.learner_model import memory


def _reviews(m_true: float, n: int, p: float = 0.85, seed: int = 1) -> dict:
    rng = random.Random(seed)
    fit = memory.new_fit()
    for _ in range(n):
        s, gap = rng.choice([1.2, 3.2, 8.0]), rng.choice([1, 2, 4, 7])
        t = {"S": s, "mem_day": "2026-01-01"}
        day = f"2026-01-{1 + gap:02d}"
        r = memory.retrievability(gap, s * m_true)
        q = p if rng.random() < r else memory.FORGOT_P
        x = sum(rng.random() < q for _ in range(4)) / 4
        memory.observe_recall(fit, t, day, x, 4, p)
    return fit


def test_defaults_without_reviews():
    assert memory.multiplier(None) == 1.0
    assert memory.multiplier(memory.new_fit()) == 1.0


def test_fast_forgetter_recovered_and_shrunk():
    many = memory.multiplier(_reviews(0.1, 400), k=10)
    few = memory.multiplier(_reviews(0.1, 4), k=10)
    assert many < 0.3                      # the child's own rate
    # 4 reviews: the estimate is noise, so it moves at most Z = 4 / (4 + K) of the way
    assert abs(math.log(few)) <= 4 / (4 + 10) * abs(memory.LOG_M[0]) + 1e-9


def test_not_applied_by_default():
    # K_CRED = inf until knowledge and recall are fitted jointly (see memory.py)
    assert memory.multiplier(_reviews(0.1, 400)) == 1.0


def test_expected_misses_are_not_forgetting():
    # a child at 55% on items the model also predicts at 55% forgets nothing
    rng = random.Random(3)
    fit = memory.new_fit()
    for _ in range(300):
        t = {"S": 3.2, "mem_day": "2026-01-01"}
        x = sum(rng.random() < 0.55 for _ in range(4)) / 4
        memory.observe_recall(fit, t, "2026-01-05", x, 4, 0.55)
    assert memory.multiplier(fit, k=10) > 1.0


def test_same_day_is_not_a_recall_test():
    fit = memory.new_fit()
    memory.observe_recall(fit, {"S": 3.2, "mem_day": "2026-01-01"}, "2026-01-01", 0.0, 4, 0.9)
    assert fit["n"] == 0 and not any(fit["ll"])
    assert math.isclose(memory.multiplier(fit), 1.0)
