"""Calibrate the credibility constant K of the child's forgetting fit
(learner_model/memory.py `multiplier`) on loop traces.

    python -m tests.pulse_agent.forgetting_fit reports/ab-retest/*-s*/G1/loop_*.json

Each trace is replayed day by day: a subskill's first answer of the day
(first-try share) updates its memory trace as the engine does, and a Pulse
practice (it logs the model's P(right) on the served item) a day or more after
the last is a recall test. Every recall test is first
PREDICTED with the multiplier the child had at that moment (prequential), then
added to the fit. A K is good when it predicts the next review best: mean log
loss over every review of every child. K = inf is the defaults alone; K = 0
trusts the child's own maximum from the first review.
"""
from __future__ import annotations

import json
import math
import sys
from collections import defaultdict
from pathlib import Path

from app.services.learner_model import memory

KS = [0.0, 2.0, 5.0, 10.0, 20.0, 40.0, 80.0, math.inf]


def days_of(d: dict):
    """[(day, {sid: (x, pc)})]: each subskill's first answer per day."""
    out = []
    for day in d["days"]:
        first = {}
        for it in (day.get("lesson_log") or []) + day["pulse_log"]:
            ft = it.get("first_try")
            if not ft or it["subskill_id"] in first:
                continue
            p = it.get("p_served")
            first[it["subskill_id"]] = (sum(ft) / len(ft), len(ft), p, float(it.get("p_right") or memory.GOOD_P))
        out.append((day["date"], first))
    return out


def replay(d: dict, k: float):
    fit, touched, loss, n = memory.new_fit(), {}, 0.0, 0
    for day, first in days_of(d):
        m = 1.0 if k == math.inf else memory.multiplier(fit, k)
        for sid, (x, nc, p, pc) in first.items():
            t = touched.get(sid, {})
            gap = memory.gap_days(t.get("mem_day"), day)
            if p is not None and t.get("S") is not None and gap and gap >= 1:
                # predictive P(each challenge right) under today's m, scored per challenge
                r = memory.retrievability(gap, float(t["S"]) * m)
                q = min(max(r * p + (1 - r) * memory.FORGOT_P, 1e-4), 1 - 1e-4)
                loss -= x * math.log(q) + (1 - x) * math.log(1 - q)
                n += 1
                memory.observe_recall(fit, t, day, x, nc, p)
            touched[sid] = {**t, **memory.update(t, day, x, pc, m)}
    return loss, n, memory.multiplier(fit, k if k != math.inf else 1e12), memory.multiplier(fit, 0.0), fit["n"]


def main(paths):
    tot = defaultdict(lambda: [0.0, 0])
    per_child = defaultdict(list)
    for p in paths:
        d = json.loads(Path(p).read_text(encoding="utf-8"))
        child = d["profile_name"].split()[0]
        for k in KS:
            loss, n, m_k, m_hat, nf = replay(d, k)
            tot[k][0] += loss
            tot[k][1] += n
            if k == 10.0:
                per_child[child].append((m_hat, m_k, nf, sum(1 for _ in [0])))
    print("| K | mean log loss per review | reviews |")
    print("|---|---|---|")
    for k in KS:
        print(f"| {k} | {tot[k][0] / max(1, tot[k][1]):.4f} | {tot[k][1]} |")
    print("\nchild: own estimate m_hat (0 = defaults) per trace, reviews")
    for child, rows in sorted(per_child.items()):
        print(f"- {child}: " + ", ".join(f"m_hat {a:.2f} ({c} reviews)" for a, _, c, _ in rows))


if __name__ == "__main__":
    main(sys.argv[1:])
