"""Self-contained HTML dashboard for full-loop journeys.

Renders `loop_report_template.html` with a compact data payload extracted from
a LoopTimeline — one file, no external assets, openable straight from disk.
Written alongside the markdown report on every `--loop` run.
"""

from __future__ import annotations

import json
import re
from collections import Counter
from dataclasses import asdict, is_dataclass
from datetime import date
from pathlib import Path
from typing import Any, Dict, List


def _base_subject(subject: str) -> str:
    """Strip the grade suffix ("MATHEMATICS_GK" → "MATHEMATICS")."""
    return re.sub(r"_G\w+$", "", (subject or "").upper())

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

    # --- Leapfrog events (flattened, chronological) ---
    leapfrogs = []
    for day in t.get("days") or []:
        for lf in day.get("leapfrogs") or []:
            leapfrogs.append({
                "day": day["day_number"],
                "date": day["date"],
                "subject": _base_subject(lf.get("subject", "")),
                "probed": lf.get("probed_skills") or [],
                "inferred": lf.get("inferred_skills") or [],
                "score": round(float(lf.get("aggregate_score") or 0), 2),
            })

    # --- Curriculum position tree + per-subject proficiency/mastery stats ---
    hierarchy = t.get("curriculum_hierarchy") or {}
    mastery = t.get("mastery_final") or {}
    inferred = set(t.get("inferred_subskills") or [])

    def _gate_of(sid: str) -> int:
        return int((mastery.get(sid) or {}).get("current_gate", 0) or 0)

    skill_subject: Dict[str, str] = {}   # skill_id → base subject (to bucket θ)
    curriculum: List[Dict[str, Any]] = []
    subject_stats: List[Dict[str, Any]] = []

    for subj, units in sorted(hierarchy.items()):
        unit_nodes = []
        s_total = s_mastered = s_inprog = 0
        for unit in units:
            skill_nodes = []
            for skill in unit.get("skills", []):
                skill_subject[skill.get("id")] = subj
                sub_nodes = []
                for ss in skill.get("subskills", []):
                    sid = ss.get("id")
                    g = _gate_of(sid)
                    sub_nodes.append({
                        "id": sid, "desc": ss.get("desc") or "",
                        "gate": g, "lf": sid in inferred,
                    })
                    s_total += 1
                    if g >= 4:
                        s_mastered += 1
                    elif g >= 1:
                        s_inprog += 1
                sm = sum(1 for x in sub_nodes if x["gate"] >= 4)
                skill_nodes.append({
                    "id": skill.get("id"), "desc": skill.get("desc") or "",
                    "mastered": sm, "total": len(sub_nodes), "subskills": sub_nodes,
                })
            unit_nodes.append({
                "id": unit.get("id"), "title": unit.get("title") or "",
                "mastered": sum(sk["mastered"] for sk in skill_nodes),
                "total": sum(sk["total"] for sk in skill_nodes),
                "skills": skill_nodes,
            })
        curriculum.append({"subject": subj, "units": unit_nodes})

        est_vals = [ab["theta"] for sk, ab in ability.items() if skill_subject.get(sk) == subj]
        true_vals = [truth[sk] for sk in truth if skill_subject.get(sk) == subj]
        subject_stats.append({
            "subject": subj,
            "total": s_total,
            "mastered": s_mastered,
            "in_progress": s_inprog,
            "not_started": s_total - s_mastered - s_inprog,
            "pct": round(100 * s_mastered / s_total) if s_total else 0,
            "avg_theta_est": round(sum(est_vals) / len(est_vals), 2) if est_vals else None,
            "avg_theta_true": round(sum(true_vals) / len(true_vals), 2) if true_vals else None,
        })

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
        "leapfrogs": leapfrogs,
        "curriculum": curriculum,
        "subject_stats": subject_stats,
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
