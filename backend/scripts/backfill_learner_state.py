"""
One-time replay of a student's reviews into the two-layer learner state
(app/services/learner_model). After this the submission paths keep the state
current, so nothing replays history on read.

Runs the SAME `LearnerStateService.observe` the submission paths call, against
an in-memory store, then writes the final summary, the grids and one event per
answer. Dry-run by default (prints what it would write).

    venv/Scripts/python -m scripts.backfill_learner_state --student 1004
    venv/Scripts/python -m scripts.backfill_learner_state --student 1004 --subjects MATHEMATICS --apply

A review contributes its per-challenge first-try results when it has them
(the same rule as the submission hook), else its final score.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import time
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional

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


def review_to_observation(r: dict) -> Optional[dict]:
    """A review doc -> observe() kwargs (the fields the submission hook passes)."""
    sid, subject = r.get("subskill_id"), r.get("subject")
    if not sid or not subject:
        return None
    md = _as_dict(_as_dict(r.get("full_review")).get("metadata"))
    pc = _as_dict(r.get("problem_content"))
    first = first_try_from_response({"student_work": _as_dict(pc.get("student_work")), "metrics": _as_dict(md.get("metrics"))})
    try:
        score = float(r.get("score"))
    except (TypeError, ValueError):
        return None
    return {"subject": subject, "subskill_id": sid, "score": score,
            "primitive_type": md.get("primitive_type"), "eval_mode": md.get("eval_mode"),
            "first_try": first, "source": md.get("eval_source") or md.get("source") or "practice",
            "attempt_id": r.get("attempt_id") or r.get("id"), "timestamp": _ts(r.get("timestamp"))}


async def run(student: int, subjects: List[str], apply: bool) -> None:
    fs = FirestoreService()
    grade = (await fs.get_student_planning_fields(student) or {}).get("grade_level")
    t0 = time.time()
    reviews = [d.to_dict() for d in fs._student_doc(student).collection("reviews").stream()]
    obs = [o for o in (review_to_observation(r) for r in reviews) if o and subject_key(o["subject"]) in subjects]
    obs.sort(key=lambda o: o["timestamp"])
    print(f"student {student} (grade {grade}): {len(reviews)} reviews, {len(obs)} in {subjects} ({time.time() - t0:.0f}s read)")

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
