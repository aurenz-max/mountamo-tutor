"""Does "mastered" mean the child gets the problems right? Per practised
subskill at the end of a loop run, the learner model's call (P(mastered) >=
MASTERED) and the lifecycle's (gate 4) against the truth's P(right) on the
subskill's typical item, at 80% (the mastery criterion the model is built on)
and at 90%.

    python -m tests.pulse_agent.mastery_check reports/<run>/*/G1/loop_*.json

    precision  of the subskills called mastered, the share the child truly has
    recall     of the subskills the child truly has, the share called mastered
    pc error   mean |model P(right) - truth P(right)| on the typical item
"""
from __future__ import annotations

import json
import statistics as st
import sys
from collections import defaultdict
from pathlib import Path

from app.services.calibration_engine import p_correct
from app.services.learner_model.engine import TYPICAL_A
from app.services.learner_model.service import MASTERED

from .truth_model import TRUTH_PARAMS


def calls(d: dict) -> list:
    """[(truth P, model pm, model pc, gate)] per practised subskill."""
    pr = TRUTH_PARAMS[d["archetype"]]
    lf = d.get("learner_final") or {}
    nodes, ro = lf.get("nodes") or {}, lf.get("readout") or {}
    final = d.get("truth_snapshot") or {}
    gates = {sid: v.get("current_gate", 0) for sid, v in (d.get("mastery_final") or {}).items()}
    out = []
    for sid, (pm, pc, _n) in ro.items():
        nd = nodes.get(sid)
        if not nd or nd[0] not in final:
            continue
        truth = pr.guess + (1 - pr.guess - pr.slip) * p_correct(final[nd[0]], TYPICAL_A, nd[1])
        out.append((truth, pm, pc, gates.get(sid, 0)))
    return out


def pr_rc(rows, called, bar):
    tp = sum(1 for r in rows if called(r) and r[0] >= bar)
    c = sum(1 for r in rows if called(r))
    t = sum(1 for r in rows if r[0] >= bar)
    return (tp / c if c else float("nan")), (tp / t if t else float("nan")), c, t


def main(paths):
    by_child = defaultdict(list)
    for p in paths:
        d = json.loads(Path(p).read_text(encoding="utf-8"))
        if (d.get("learner_final") or {}).get("readout"):
            by_child[d["profile_name"].split()[0]].extend(calls(d))
    print("| child | subskills | truth >= | model precision / recall (called) | gate 4 precision / recall (called) | truly have | pc error |")
    print("|---|---|---|---|---|---|---|")
    for child, rows in sorted(by_child.items()):
        err = st.mean(abs(r[2] - r[0]) for r in rows)
        for bar in (0.8, 0.9):
            mp, mr, mc, t = pr_rc(rows, lambda r: r[1] >= MASTERED, bar)
            gp, gr, gc, _ = pr_rc(rows, lambda r: r[3] >= 4, bar)
            print(f"| {child} | {len(rows)} | {bar} | {mp:.2f} / {mr:.2f} ({mc}) | {gp:.2f} / {gr:.2f} ({gc}) | {t} | {err:.3f} |")


if __name__ == "__main__":
    main(sys.argv[1:])
