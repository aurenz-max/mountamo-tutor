"""
Rebuild a student's two-layer learner state (app/services/learner_model) from
L0. The submission paths keep the state current; this is the rebuild contract
(roadmap P1.3): the same answers, replayed in order through the SAME
`LearnerStateService.observe`, give the same state. Dry-run by default.

    venv/Scripts/python -m scripts.backfill_learner_state --student 1004
    venv/Scripts/python -m scripts.backfill_learner_state --student 1004 --subjects MATHEMATICS --apply

Source: attempts (lesson + Pulse; Pulse attempts exist since R2, 10-12). An
attempt contributes its `first_try` when it carries one (R3, 10-12), else the
first-try results found on its joined review (older lesson attempts), else its
final score. Diagnostic attempts never fed the learner state and are skipped.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import time
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

from app.db.firestore_service import FirestoreService
from app.services.curriculum_scope import subject_key
from app.services.learner_graph import get_learner_graph
from app.services.learner_model.service import LearnerStateService, first_try_from_response


class _MemStore:
    def __init__(self, grade: Optional[str]):
        self.grade = grade
        self.state: Dict[str, dict] = {}
        self.grids: Dict[tuple, dict] = {}
        self.events: List[dict] = []

    async def get_student_planning_fields(self, student_id):
        return {"grade_level": self.grade}

    async def get_learner_state(self, student_id, subject):
        return self.state.get(subject)

    async def get_learner_grid(self, student_id, subject, key):
        return self.grids.get((subject, key))

    async def save_learner_update(self, student_id, subject, summary, grids, event):
        self.state[subject] = summary
        for k, g in grids.items():
            self.grids[(subject, k)] = g
        self.events.append(event)


def _as_dict(v) -> dict:
    if isinstance(v, str):
        try:
            v = json.loads(v)
        except ValueError:
            return {}
    return v if isinstance(v, dict) else {}


def _ts(v) -> str:
    if isinstance(v, datetime):
        return v.isoformat()
    return str(v or "")


def review_first_try(r: dict) -> Optional[List[bool]]:
    """Per-challenge first-try results recorded on a review's student work."""
    md = _as_dict(_as_dict(r.get("full_review")).get("metadata"))
    pc = _as_dict(r.get("problem_content"))
    return first_try_from_response({"student_work": _as_dict(pc.get("student_work")), "metrics": _as_dict(md.get("metrics"))})


def attempt_to_observation(a: dict, review_ft: Optional[List[bool]] = None) -> Optional[dict]:
    """An attempt doc -> observe() kwargs, the ones its submission path passed."""
    sid, subject = a.get("subskill_id"), a.get("subject")
    source = a.get("source") or "practice"
    if not sid or not subject or source == "diagnostic":
        return None
    try:
        score = float(a.get("score"))
    except (TypeError, ValueError):
        return None
    first = a.get("first_try") or review_ft
    return {"subject": subject, "subskill_id": sid, "score": score,
            "primitive_type": a.get("primitive_type"), "eval_mode": a.get("eval_mode"),
            "first_try": [bool(x) for x in first] if first else None,
            "evidence_parts": int(a.get("evidence_parts") or 1),
            "grade": a.get("lesson_grade"), "source": source,
            "attempt_id": a.get("id"),
            "timestamp": _ts(a.get("answered_at") or a.get("timestamp"))}


def observations(attempts: Iterable[dict], reviews: Iterable[dict], subjects: Optional[List[str]] = None) -> List[dict]:
    """Attempts in answer order as observe() kwargs; reviews only supply
    first-try results the attempt itself lacks."""
    ft = {r["attempt_id"]: review_first_try(r) for r in reviews if r.get("attempt_id")}
    obs = [o for o in (attempt_to_observation(a, ft.get(a.get("id"))) for a in attempts)
           if o and (subjects is None or subject_key(o["subject"]) in subjects)]
    obs.sort(key=lambda o: o["timestamp"])
    return obs


async def replay(student, obs: List[dict], graph_source, grade: Optional[str]) -> "_MemStore":
    """observe() every answer into a fresh in-memory store."""
    mem = _MemStore(grade)
    svc = LearnerStateService(mem, graph_source=graph_source, background=False)
    for o in obs:
        await svc.observe(student_id=student, **o)
    return mem


async def run(student: int, subjects: List[str], apply: bool) -> None:
    fs = FirestoreService()
    grade = (await fs.get_student_planning_fields(student) or {}).get("grade_level")
    t0 = time.time()
    root = fs._student_doc(student)
    attempts = [{"id": d.id, **d.to_dict()} for d in root.collection("attempts").stream()]
    reviews = [d.to_dict() for d in root.collection("reviews").stream()]
    obs = observations(attempts, reviews, subjects)
    by_src = Counter(o["source"] for o in obs)
    print(f"student {student} (grade {grade}): {len(attempts)} attempts ({dict(by_src)} in {subjects}), "
          f"{sum(1 for o in obs if o['first_try'])} with first-try ({time.time() - t0:.0f}s read)")

    mem = _MemStore(grade)
    svc = LearnerStateService(mem, graph_source=lambda s: get_learner_graph(fs, s), background=False)
    used, skipped, evidence = Counter(), Counter(), Counter()
    t0 = time.time()
    for o in obs:
        ev = await svc.observe(student_id=student, **o)
        s = subject_key(o["subject"])
        if ev is None:
            skipped[s] += 1
        else:
            used[s] += 1
            evidence[ev["cause"]["evidence"]] += 1
    print(f"replayed in {time.time() - t0:.0f}s: used {dict(used)}, not on graph/ambiguous {dict(skipped)}, evidence {dict(evidence)}")
    for s, summary in mem.state.items():
        prof = await LearnerStateService(_Frozen(summary), graph_source=lambda x: get_learner_graph(fs, x)).profile(student, s, top=5)
        c = prof["counts"]
        print(f"  {s}: {summary['n_obs']} answers, seen {c['seen']}, mastered {c['mastered']} ({c['mastered_seen']} seen), "
              f"ready {c['ready']}, phi {summary['phi_mean']:.2f} +- {summary['phi_sd']:.2f}, state {len(summary['state_json']) / 1024:.0f} KB")
        for r in prof["ready"][:5]:
            print(f"     ready {r['p_ready']:.2f}  P(right) {r['p_right']:.2f}  {r['key']}  {r['label'][:60]}")
    if not apply:
        print(f"dry run: would write {len(mem.state)} summaries, {len(mem.grids)} grids, {len(mem.events)} events (--apply to write)")
        return
    c = fs.client
    root = fs._student_doc(student)
    ops = []
    for s, summary in mem.state.items():
        ops.append((root.collection("learner_state").document(s), summary))
    for (s, k), g in mem.grids.items():
        ops.append((root.collection("learner_state").document(s).collection("grids").document(k), g))
    for e in mem.events:
        ops.append((root.collection("learner_events").document(e["event_id"]), e))
    for i in range(0, len(ops), 400):
        b = c.batch()
        for ref, data in ops[i:i + 400]:
            b.set(ref, data)
        b.commit()
    print(f"wrote {len(ops)} docs")


class _Frozen:
    """Read-only store over one summary, for printing its profile."""
    def __init__(self, summary):
        self.summary = summary

    async def get_learner_state(self, student_id, subject):
        return self.summary


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--student", type=int, required=True)
    ap.add_argument("--subjects", nargs="+", default=["MATHEMATICS", "LANGUAGE_ARTS", "SCIENCE", "SOCIAL_STUDIES"])
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    asyncio.run(run(a.student, [subject_key(s) for s in a.subjects], a.apply))


if __name__ == "__main__":
    main()
