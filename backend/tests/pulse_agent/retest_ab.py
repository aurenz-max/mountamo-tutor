"""Lifecycle retests vs memory-model reviews: the same children, with and without
the planner's retest lessons, judged against the truth model's own forgetting.

    python -m tests.pulse_agent.retest_ab reports/ab-retest

expects <dir>/<arm>-s<seed>/G1/loop_*.json for arms on (lifecycle retests),
off (`--no-retests`: the day shrinks) and fill (`--no-retests`, the freed slots
given to the selector's learning picks, so both arms practise as much). Truth P(right) on a subskill is the
child's true theta for its skill on the subskill's typical item (a = TYPICAL_A),
read from each evening's truth_snapshot.

    learned    served subskills whose truth P reached 0.8 on some evening
    kept       learned subskills still at 0.8+ on the last evening
    lapse-days evenings a learned subskill spent below 0.8 after it was learned
    kept7      learned subskills at 0.8+ on the delayed posttest (truth after 7 more
               days without practice: what the month left the child with)
    late P     mean delayed-posttest truth P over every served subskill
    end P      mean truth P on every served subskill on the last evening
    unrecovered  sum over served subskills of (best evening P - last evening P):
               forgetting no review put back
    lapses     a learned subskill falling below 0.8; "unreviewed" = no item on it
               (any channel) before the run ended
    review     lesson items planned as retest/review + Pulse confirm items
    wasted     review items on a subskill the truth already had at 0.9+
"""
from __future__ import annotations

import json
import statistics as st
import sys
from collections import defaultdict
from pathlib import Path

from app.services.calibration_engine import p_correct
from app.services.learner_model.engine import TYPICAL_A

from .common_sense import check
from .scorecard import score
from .truth_model import TRUTH_PARAMS

ARMS = ("on", "off", "fill", "fillinf", "fillk")
KNOWN, SOLID = 0.8, 0.9   # the truth's ceiling is 1 - slip (gifted 0.95)


def measure(path: Path) -> dict:
    d = json.loads(path.read_text(encoding="utf-8"))
    pr = TRUTH_PARAMS[d["archetype"]]
    nodes = (d.get("learner_final") or {}).get("nodes") or {}

    def truth(sid, snap):
        n = nodes.get(sid)
        if not n or n[0] not in snap:
            return None
        return pr.guess + (1 - pr.guess - pr.slip) * p_correct(snap[n[0]], TYPICAL_A, n[1])

    served_on = defaultdict(set)
    review = wasted = lesson = pulse = retest_lesson = 0
    prev_snap: dict = {}
    for day in d["days"]:
        n = day["day_number"]
        kind = {p["subskill_id"]: p["type"] for p in day["plan_subskills"]}
        for it in day.get("lesson_log") or []:
            lesson += 1
            served_on[it["subskill_id"]].add(n)
            if kind.get(it["subskill_id"]) in ("retest", "review"):
                retest_lesson += 1
                review += 1
                t = truth(it["subskill_id"], prev_snap)
                wasted += t is not None and t >= SOLID
        for it in day["pulse_log"]:
            pulse += 1
            served_on[it["subskill_id"]].add(n)
            if it.get("kind") == "confirm":
                review += 1
                t = truth(it["subskill_id"], prev_snap)
                wasted += t is not None and t >= SOLID
        prev_snap = day.get("truth_snapshot") or {}

    learned_on, lapse_days, lapses, unreviewed, delays = {}, 0, 0, 0, []
    days = d["days"]
    for sid, on in served_on.items():
        below_since = None
        for day in days:
            n = day["day_number"]
            if n < min(on):
                continue
            t = truth(sid, day.get("truth_snapshot") or {})
            if t is None:
                continue
            if sid not in learned_on:
                if t >= KNOWN:
                    learned_on[sid] = n
                continue
            if t < KNOWN:
                lapse_days += 1
                if below_since is None:
                    below_since, lapses = n, lapses + 1
            elif below_since is not None:
                below_since = None
            # a lapse ends when the subskill is served again
            if below_since is not None and n > below_since and n in on:
                delays.append(n - below_since)
                below_since = None
        if below_since is not None and not any(x > below_since for x in on):
            unreviewed += 1
    final = d.get("truth_snapshot") or {}
    kept = [sid for sid in learned_on if (truth(sid, final) or 0) >= KNOWN]
    delayed = d.get("truth_delayed") or {}
    kept7 = sum(1 for sid in learned_on if delayed.get(sid, 0) >= KNOWN)
    end_p, unrecovered = [], 0.0
    for sid in served_on:
        ps = [t for day in days if (t := truth(sid, day.get("truth_snapshot") or {})) is not None]
        if ps:
            end_p.append(ps[-1])
            unrecovered += max(ps) - ps[-1]
    sc = score(str(path))
    rules = {r.name: r for r in check(d)}
    return {
        "child": d["profile_name"].split()[0], "seed": path.parent.parent.name.split("-s")[-1],
        "end_p": st.mean(end_p) if end_p else 0.0, "unrecovered": unrecovered,
        "learned": len(learned_on), "kept7": kept7,
        "late_p": st.mean(delayed.values()) if delayed else 0.0, "kept": len(kept), "lapse_days": lapse_days,
        "lapses": lapses, "unreviewed": unreviewed,
        "review_delay": st.mean(delays) if delays else 0.0,
        "lesson": lesson, "retest_lesson": retest_lesson, "pulse": pulse,
        "review": review, "wasted": wasted, "gain": sc["gain"], "distinct": sc["distinct"],
        "success": sc["success"],
        "drill": rules["no_drill_when_proven"].value if "no_drill_when_proven" in rules else "",
        "failed": sorted(k for k, r in rules.items() if not r.passed),
    }


def main(root: str) -> None:
    rows = defaultdict(dict)
    for arm in ARMS:
        for p in sorted(Path(root).glob(f"{arm}-s*/G1/loop_*.json")):
            m = measure(p)
            rows[(m["child"], m["seed"])][arm] = m
    cols = ["kept7", "late_p", "end_p", "unrecovered", "learned", "kept", "lapse_days", "lapses", "unreviewed", "review_delay",
            "lesson", "retest_lesson", "review", "wasted", "gain", "distinct", "success"]
    print("| child | seed | arm | " + " | ".join(cols) + " | checks failed |")
    print("|" + "---|" * (len(cols) + 4))
    for (child, seed), arms in sorted(rows.items()):
        for arm in ARMS:
            m = arms.get(arm)
            if not m:
                continue
            vals = [f"{m[c]:.2f}" if isinstance(m[c], float) else str(m[c]) for c in cols]
            print(f"| {child} | {seed} | {arm} | " + " | ".join(vals) + f" | {', '.join(m['failed'])} |")
    print("\nmean per child (" + " / ".join(ARMS) + ")")
    by_child = defaultdict(lambda: defaultdict(list))
    for (child, _), arms in rows.items():
        for arm, m in arms.items():
            for c in cols:
                by_child[child][(arm, c)].append(m[c])
    for child, v in sorted(by_child.items()):
        parts = [f"{c} " + " / ".join(f"{st.mean(v[(a, c)]):.2f}" for a in ARMS if v[(a, c)])
                 for c in cols]
        print(f"- {child}: " + "; ".join(parts))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "reports/ab-retest")
