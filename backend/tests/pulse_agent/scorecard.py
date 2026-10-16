"""Selector scorecard: the same numbers for every loop timeline, so a learner-model
or selector change is judged on all of them at once, not on one profile's story.

    python -m tests.pulse_agent.scorecard reports/<run>/G1/loop_*.json [more ...]

Columns (one row per timeline):
    bias / MAE     model P(right) minus truth P(right) on each seen subskill's typical item
    lag            bias on subskills with >= 10 answers (the model trailing a learner who improved)
    true>=.8 read<.8  seen subskills the child has at 0.8+ that the model reads below 0.8
    gate>=3 / gate4   lifecycle gates at the end
    max days       most days any one subskill was in Pulse
    repeat         share of Pulse items whose subskill was also in yesterday's Pulse
    miss run       longest run of days one learn pick was served and missed (day mean < 7)
    success        Pulse items scored >= 5
    distinct       subskills served in Pulse
    true gain      sum over skills of the child's TRUE theta, last day minus the first day the
                   skill appears (what the month taught, by the truth model's own learning rule;
                   neither truth model has a spacing effect, so it cannot reward rotation)
"""
from __future__ import annotations

import json
import statistics as st
import sys
from pathlib import Path


def score(path: str) -> dict:
    d = json.loads(Path(path).read_text(encoding="utf-8"))
    days = d["days"]
    pairs = (d.get("learner_final") or {}).get("pairs") or []
    diff = [a - b for a, b, _ in pairs]
    lag = [a - b for a, b, n in pairs if n >= 10]
    gates = [v.get("current_gate", 0) for v in (d.get("mastery_final") or {}).values()]
    served_days: dict = {}
    repeat = total = ok = 0
    prev: set = set()
    run: dict = {}
    worst = 0
    for day in days:
        today = {it["subskill_id"] for it in day["pulse_log"]}
        for it in day["pulse_log"]:
            total += 1
            ok += it["score"] >= 5.0
            repeat += it["subskill_id"] in prev
        for s in today:
            served_days[s] = served_days.get(s, 0) + 1
        learn: dict = {}
        for it in day["pulse_log"]:
            if it.get("kind") == "learn":
                learn.setdefault(it["subskill_id"], []).append(it["score"])
        missed = {s for s, v in learn.items() if st.mean(v) < 7.0}
        run = {s: run.get(s, 0) + 1 for s in missed}
        worst = max([worst, *run.values()])
        prev = today
    first: dict = {}
    for day in days:
        for sk, th in (day.get("truth_snapshot") or {}).items():
            first.setdefault(sk, th)
    final = d.get("truth_snapshot") or {}
    gain = sum(final[sk] - th for sk, th in first.items() if sk in final)
    return {
        "gain": gain,
        "run": f"{Path(path).parent.parent.name}/{d['profile_name'].split()[0]}",
        "days": len(days),
        "bias": st.mean(diff) if diff else float("nan"),
        "mae": st.mean(abs(x) for x in diff) if diff else float("nan"),
        "lag": st.mean(lag) if lag else float("nan"),
        "hidden": sum(1 for a, b, _ in pairs if b >= 0.8 and a < 0.8),
        "seen": len(pairs),
        "g3": sum(g >= 3 for g in gates), "g4": sum(g >= 4 for g in gates),
        "max_days": max(served_days.values(), default=0),
        "repeat": repeat / max(1, total),
        "miss_run": worst,
        "success": ok / max(1, total),
        "distinct": len(served_days),
    }


def table(rows: list) -> str:
    out = ["| run | days | bias | MAE | lag (n>=10) | true>=.8 read<.8 | gate>=3 | gate4 | max days | repeat | miss run | success | distinct | true gain |",
           "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for r in rows:
        out.append(f"| {r['run']} | {r['days']} | {r['bias']:+.3f} | {r['mae']:.3f} | {r['lag']:+.3f} | "
                   f"{r['hidden']}/{r['seen']} | {r['g3']} | {r['g4']} | {r['max_days']} | {r['repeat']:.0%} | "
                   f"{r['miss_run']} | {r['success']:.0%} | {r['distinct']} | {r['gain']:.1f} |")
    return "\n".join(out)


if __name__ == "__main__":
    print(table([score(p) for p in sys.argv[1:]]))
