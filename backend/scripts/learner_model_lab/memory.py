"""
Memory layer (C-plan step 1): will the child recall a subskill TODAY, given
what they can do and when they last practised it.

Knowledge (the layered engine's P_know) says what the child can do; memory
says whether they can retrieve it now. Per subskill:

    S   stability, in days: the gap at which recall falls to 0.9
    R   retrievability after t days:  R = (1 + F t / S) ** D
        D = -0.5, F = 19/81, so R(S) = 0.9. This is the power-law curve that a
        gamma mixture of exponential (Poisson) forgetting rates produces, in
        the form FSRS fits on large review logs.
    P(right) = P_know * (c + (1 - c) * R)
        c: share of a forgotten skill the child rebuilds on the spot

Review update (the spacing effect):
    success   S <- S * (1 + G + A * (1 - R))   a successful day adds a base gain G,
                                          plus more the further recall had faded
    failure   S <- max(S0, B * S)
    first     S = S0 after the first review
    S changes once per day per subskill (the day's first review), as in FSRS:
    same-session repeats are predicted at R ~ 1 and do not build stability

  record  run the layered engine over a real student's reviews once and save
          every challenge with its subskill, time, P_know and first-try result
  fit     score memory parameters on that stream (no engine re-run): log loss
          on all challenges and on challenges after a gap of an hour or more

Usage (from backend/):
  venv/Scripts/python -m scripts.learner_model_lab.memory record
  venv/Scripts/python -m scripts.learner_model_lab.memory fit
"""

from __future__ import annotations

import argparse
import itertools
import json
import math
from datetime import datetime
from typing import Dict, List, Tuple

from .evidence import load_reviews
from .graph import load
from .layered import LayeredEngine
from .replay import LAB, REVIEWS_1004, n_eff, xent

D, F = -0.5, 19.0 / 81.0
STREAM = LAB / "memory-stream-1004.json"
GAP_DAYS = 1.0 / 24


def retrievability(t_days: float, s: float) -> float:
    return (1.0 + F * max(0.0, t_days) / s) ** D


def _days(ts: str) -> float:
    return datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp() / 86400.0


def record(subject: str) -> None:
    g = load(subject)
    ev = load_reviews(REVIEWS_1004, g)
    eng = LayeredEngine(g, seed=0)
    rows = []
    for e in ev:
        it = g.make_item(e.node, e.primitive, e.mode)
        p = eng.predict(it)
        rows.append({"node": e.node, "t": _days(e.ts), "p": p, "y": [bool(y) for y in e.first]})
        eng.observe(it, 10.0 * sum(e.first) / len(e.first), n_eff(len(e.first)))
    STREAM.write_text(json.dumps(rows), encoding="utf-8")
    print(f"{len(rows)} reviews, {sum(len(r['y']) for r in rows)} challenges -> {STREAM}")


def score(rows: List[dict], s0: float, a: float, b: float, c: float, g: float = 0.0) -> Dict[str, float]:
    """Per-challenge log loss with memory on (P_know x recall) and the gap subset."""
    state: Dict[int, Tuple[float, float]] = {}      # node -> (S, last t)
    updated: Dict[int, int] = {}                     # node -> day of the last S update
    tot, n, gtot, gn = 0.0, 0, 0.0, 0
    for r in rows:
        k, t, p_know = r["node"], r["t"], r["p"]
        if k in state:
            s, last = state[k]
            gap = t - last
            rec = retrievability(gap, s)
        else:
            s, gap, rec = None, None, 1.0
        p = p_know * (c + (1.0 - c) * rec)
        for y in r["y"]:
            l = xent(y, p)
            tot += l
            n += 1
            if gap is not None and gap >= GAP_DAYS:
                gtot += l
                gn += 1
        ok = sum(r["y"]) / len(r["y"]) >= 0.5
        day = int(t)
        if s is None:
            s = s0
        elif updated.get(k) != day:
            s = s * (1.0 + g + a * (1.0 - rec)) if ok else max(s0, b * s)
        updated[k] = day
        state[k] = (s, t)
    return {"loss": tot / n, "gap_loss": gtot / gn if gn else float("nan"), "n": n, "gap_n": gn}


def fit() -> None:
    rows = json.loads(STREAM.read_text(encoding="utf-8"))
    none = score(rows, 1.0, 0.0, 1.0, 1.0)          # c = 1: memory off, P = P_know
    print(f"no memory:  loss {none['loss']:.4f}  gap loss {none['gap_loss']:.4f}  "
          f"({none['n']} challenges, {none['gap_n']} after a gap >= 1 h)")
    grid = itertools.product([0.25, 0.5, 1, 2, 4, 8, 16], [0, 1, 2, 4, 8], [0.2, 0.5], [0.0, 0.3, 0.6, 0.9],
                             [0.0, 0.5, 1.0, 2.0, 4.0])
    res = sorted(((score(rows, *pr), pr) for pr in grid), key=lambda x: x[0]["loss"])
    print("best by overall loss (S0, A, B, c, G):")
    for r, pr in res[:8]:
        print(f"  {pr}: loss {r['loss']:.4f}  gap loss {r['gap_loss']:.4f}")
    # FSRS-like defaults as the prior: first stability ~3 days (FSRS "good"), c = 0.3
    d = score(rows, 3.0, 2.0, 0.5, 0.3)
    print(f"prior (S0 3 d, A 2, B 0.5, c 0.3): loss {d['loss']:.4f}  gap loss {d['gap_loss']:.4f}")


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("record")
    r.add_argument("--subject", default="MATHEMATICS")
    sub.add_parser("fit")
    a = ap.parse_args()
    record(a.subject) if a.cmd == "record" else fit()


if __name__ == "__main__":
    main()
