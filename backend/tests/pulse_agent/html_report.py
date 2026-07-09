"""Self-contained HTML dashboard for full-loop journeys.

Renders `loop_report_template.html` with a compact data payload extracted from
a LoopTimeline — one file, no external assets, openable straight from disk.
Written alongside the markdown report on every `--loop` run.
"""

from __future__ import annotations

import json
from collections import Counter
from dataclasses import asdict, is_dataclass
from datetime import date
from pathlib import Path
from typing import Any, Dict, List

TEMPLATE_PATH = Path(__file__).parent / "loop_report_template.html"
DATA_PLACEHOLDER = "/*__DATA__*/"


def _subject_tag(t: Dict[str, Any]) -> str:
    """Filename tag: the subject id, or MULTI_G<grade> for multi-subject runs."""
    subjects = t.get("subjects") or []
    if len(subjects) > 1:
        return f"MULTI_G{t.get('grade', '')}"
    return t.get("subject", "")


def build_loop_report_data(timeline: Any, results: List[Any]) -> Dict[str, Any]:
    """Compact, JSON-serializable payload the template's JS renders from."""
    t = asdict(timeline) if is_dataclass(timeline) else dict(timeline)

    days = []
    for day in t.get("days") or []:
        learn = [
            x["subskillId"] for x in (day.get("targets") or [])
            if x.get("kind") == "learn" and x.get("subskillId")
        ]
        days.append({
            "d": day["day_number"],
            "date": day["date"],
            "avg": round(day["avg_score"], 2),
            "gates": day["gate_advances"],
            "lesson": day["lesson_items"],
            "pulse": day["pulse_items"],
            "targets": learn,
        })

    ability = t.get("ability_final") or {}
    truth = t.get("truth_snapshot") or {}

    # Per-day θ series (estimate + truth) for the small-multiples chart.
    series: Dict[str, Dict[str, list]] = {}
    for skill_id in ability:
        est, tru = [], []
        for day in t.get("days") or []:
            e = (day.get("theta_snapshot") or {}).get(skill_id)
            v = (day.get("truth_snapshot") or {}).get(skill_id)
            est.append(round(e, 2) if e is not None else None)
            tru.append(round(v, 2) if v is not None else None)
        series[skill_id] = {"est": est, "true": tru}

    final = {
        skill_id: {
            "est": round(ab["theta"], 2),
            "sigma": round(ab["sigma"], 2),
            "n": ab["total_items_seen"],
            "true": round(truth[skill_id], 2) if skill_id in truth else None,
        }
        for skill_id, ab in ability.items()
    }

    gates = Counter(
        m.get("current_gate", 0) for m in (t.get("mastery_final") or {}).values()
    )

    assertions = [
        {
            "name": r.name,
            "passed": bool(r.passed),
            "skipped": str(r.message).startswith("Skipped"),
            "message": str(r.message),
        }
        for r in results
    ]

    name = str(t.get("profile_name", "")).replace(" ", "_")
    subject = _subject_tag(t)
    return {
        "meta": {
            "profile": t.get("profile_name"),
            "archetype": t.get("archetype"),
            "subject": ", ".join(t.get("subjects") or []) or t.get("subject", ""),
            "grade": t.get("grade"),
            "student": t.get("student_id"),
            "seeded_from": t.get("seeded_from"),
            "generated": date.today().isoformat(),
            "command": f"--profile {t.get('archetype')} --loop",
            "json_file": f"loop_{name}_{subject}.json",
            "md_file": f"loop_report_{name}_{subject}.md",
        },
        "assertions": assertions,
        "days": days,
        "series": series,
        "final": final,
        "gates": {str(k): v for k, v in sorted(gates.items())},
        "n_subskills": len(t.get("mastery_final") or {}),
    }


def render_loop_html(timeline: Any, results: List[Any]) -> str:
    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    if DATA_PLACEHOLDER not in template:
        raise ValueError(f"{TEMPLATE_PATH.name} is missing the {DATA_PLACEHOLDER} placeholder")
    payload = json.dumps(
        build_loop_report_data(timeline, results),
        separators=(",", ":"), ensure_ascii=False, default=str,
    )
    return template.replace(DATA_PLACEHOLDER + ";", payload + ";")


def generate_loop_html(timeline: Any, results: List[Any], output_dir: Path) -> Path:
    """Write loop_report_<name>_<subject>.html next to the markdown report."""
    t = asdict(timeline) if is_dataclass(timeline) else dict(timeline)
    output_dir.mkdir(parents=True, exist_ok=True)
    name = str(t.get("profile_name", "")).replace(" ", "_")
    path = output_dir / f"loop_report_{name}_{_subject_tag(t)}.html"
    path.write_text(render_loop_html(timeline, results), encoding="utf-8")
    return path
