"""
Trajectory readout over `--loop` journeys: does the sequence a child actually
lives through make sense at days 7, 14, 21 and 28?

    venv/Scripts/python -m tests.pulse_agent.trajectory reports/trajectory-2026-10-12/GK/loop_*.json

Per checkpoint window (days 1-7, 8-14, ...): items per day, success, what kind
of work was served (new teaching / confirm / retest), the grade of the
subskills served, lifecycle mastery and the learner model's seen/mastered
counts, the latent truth's mean ability (is the child actually learning), and
the order check: a subskill taught for the first time whose model
prerequisites (R = a required step, E = its easier form) were neither served
earlier nor already within the child's true ability counts as "out of order".
"""

from __future__ import annotations

import asyncio
import glob
import json
import sys
from typing import Dict, List

from app.services.calibration_engine import p_correct

from .full_loop import _published_learner_graph
from .truth_model import DEFAULT_DISCRIMINATION_A

CHECKPOINTS = (7, 14, 21, 28)
PREREQ_IN_REACH = 0.6   # truth P(right) on a prerequisite's typical item


def _served(day: dict) -> List[dict]:
    """Every subskill served today: [{sid, kind, source, score?}]."""
    out = [{"sid": p["subskill_id"], "kind": p.get("type") or "lesson", "source": "plan"}
           for p in day.get("plan_subskills", [])]
    out += [{"sid": p["subskill_id"], "kind": p.get("kind") or "pulse", "source": "pulse", "score": p.get("score")}
            for p in day.get("pulse_log", [])]
    return out


async def readout(path: str) -> str:
    d = json.load(open(path, encoding="utf-8"))
    days = d["days"]
    subject = (d.get("subjects") or [d["subject"]])[0].split("_G")[0]
    lg = await _published_learner_graph(subject)
    by_sid: Dict[str, List[str]] = {}
    for key, nd in (lg.nodes if lg else {}).items():
        by_sid.setdefault(nd.get("subskill_id"), []).append(key)
    grade = d.get("grade") or ""
    gkey = "Kindergarten" if grade.upper().startswith("K") else grade

    def node(sid):
        keys = by_sid.get(sid) or []
        if len(keys) == 1:
            return keys[0]
        return f"{gkey}:{sid}" if f"{gkey}:{sid}" in (lg.nodes if lg else {}) else None

    first_day: Dict[str, int] = {}
    rows = []
    start = 0
    for cp in CHECKPOINTS:
        window = [x for x in days if start < x["day_number"] <= cp]
        if not window:
            break
        kinds: Dict[str, int] = {}
        grades: Dict[str, int] = {}
        pulse_scores, new_first, out_of_order = [], 0, []
        for day in window:
            truth = day.get("truth_snapshot") or {}
            for s in _served(day):
                kinds[s["kind"]] = kinds.get(s["kind"], 0) + 1
                key = node(s["sid"])
                g = key.split(":", 1)[0] if key else "?"
                grades[g] = grades.get(g, 0) + 1
                if s.get("score") is not None:
                    pulse_scores.append(s["score"])
                if s["sid"] in first_day:
                    continue
                first_day[s["sid"]] = day["day_number"]
                if s["kind"] in ("confirm", "retest", "review"):
                    continue    # checks of something already shown, not teaching
                new_first += 1
                for par in (lg.prerequisites(key) if lg and key else []):
                    pn = lg.nodes.get(par["key"], {})
                    psid = pn.get("subskill_id")
                    if psid in first_day and first_day[psid] <= day["day_number"]:
                        continue
                    th = truth.get(pn.get("skill_id"))
                    if th is not None and p_correct(th, DEFAULT_DISCRIMINATION_A, float(pn.get("beta") or 3.0)) >= PREREQ_IN_REACH:
                        continue
                    out_of_order.append((par.get("relation"), f"d{day['day_number']} {s['sid']} before {psid} ({par.get('relation')})"))
        last = window[-1]
        lp = next(iter((last.get("learner_profile") or {}).values()), {})
        truth = last.get("truth_snapshot") or {}
        items = sum(x["lesson_items"] + x["pulse_items"] for x in window)
        rows.append({
            "days": f"{start + 1}-{cp}",
            "items/day": round(items / len(window), 1),
            "lesson avg": round(sum(x["avg_score"] for x in window) / len(window), 1),
            "pulse success": (f"{sum(1 for v in pulse_scores if v >= 5)}/{len(pulse_scores)}" if pulse_scores else "-"),
            "served": ", ".join(f"{k} {v}" for k, v in sorted(kinds.items(), key=lambda kv: -kv[1])),
            "grades": ", ".join(f"{k} {v}" for k, v in sorted(grades.items())),
            "first taught": new_first,
            "out of order (step / easier or related)": f"{sum(1 for r, _ in out_of_order if r == 'R')} / {sum(1 for r, _ in out_of_order if r != 'R')}",
            "gate-4 (lifecycle)": sum((last.get("mastered_by_subject") or {}).values()),
            "model seen / mastered": f"{lp.get('seen', '-')} / {lp.get('mastered', '-')}",
            "grown past -> reach": (f"{'+'.join(lp.get('grown_past') or []) or '-'} -> {lp.get('reach_grade')}"
                                    if "reach_grade" in lp else "-"),
            "truth mean θ": round(sum(truth.values()) / len(truth), 2) if truth else "-",
            "_ooo": [t for _, t in out_of_order][:4],
        })
        start = cp
    cols = [c for c in rows[0] if not c.startswith("_")] if rows else []
    lines = [f"### {d['profile_name']} ({d['archetype']}), {d['subject']}, {len(days)} days", "",
             "| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)]
    lines += ["| " + " | ".join(str(r[c]) for c in cols) + " |" for r in rows]
    ooo = [o for r in rows for o in r["_ooo"]]
    if ooo:
        lines += ["", "Out of order (first few): " + "; ".join(ooo)]
    return "\n".join(lines)


async def main(paths: List[str]) -> None:
    for p in paths:
        print(await readout(p))
        print()


if __name__ == "__main__":
    files = [f for a in sys.argv[1:] for f in sorted(glob.glob(a))]
    asyncio.run(main(files))
