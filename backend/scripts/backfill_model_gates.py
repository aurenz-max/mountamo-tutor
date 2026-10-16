"""
Set every mastery lifecycle doc's gate from the learner model (C14). Since C13
the model writes gates, but only for subskills an answer moves, so docs written
before then keep their IRT/retest gates until the child practises them again.
This applies the same verdict (`LearnerStateService.regate`) to every doc of
every subject with a stored learner state. Dry-run by default.

`--rebuild` first replays the child's answers into a fresh learner state
(scripts.backfill_learner_state) and gates from that. Use it for any state
stored before 10-16: those carry no memory stability, so every mastered
retention state would fall to active. With `--apply` the rebuilt state is
written too.

    venv/Scripts/python -m scripts.backfill_model_gates --student 1004 --rebuild
    venv/Scripts/python -m scripts.backfill_model_gates --all --rebuild
    venv/Scripts/python -m scripts.backfill_model_gates --student 1004 --rebuild --apply
"""

from __future__ import annotations

import argparse
import asyncio
from collections import Counter
from typing import List

from app.db.firestore_service import FirestoreService
from app.services.curriculum_scope import subject_key
from app.services.learner_graph import get_learner_graph
from app.services.learner_model.service import LearnerStateService
from app.services.mastery_lifecycle_engine import MasteryLifecycleEngine
from scripts.backfill_learner_state import observations, replay, write_state

SUBJECTS = ["MATHEMATICS", "LANGUAGE_ARTS", "SCIENCE", "SOCIAL_STUDIES"]


def _gates(docs) -> str:
    c = Counter(int(d.get("current_gate") or 0) for d in docs)
    return " ".join(f"g{g}:{c[g]}" for g in range(5))


async def rebuilt_state(fs, sid: int, subjects: List[str], apply: bool) -> dict:
    """subject -> the learner state replayed from the child's answers (written when apply)."""
    root = fs._student_doc(sid)
    attempts = [{"id": d.id, **d.to_dict()} for d in root.collection("attempts").stream()]
    reviews = [d.to_dict() for d in root.collection("reviews").stream()]
    grade = (await fs.get_student_planning_fields(sid) or {}).get("grade_level")
    mem = await replay(sid, observations(attempts, reviews, subjects), lambda s: get_learner_graph(fs, s), grade)
    print(f"student {sid}: replayed {len(mem.events)} answers into {sorted(mem.state)}")
    if apply and mem.state:
        print(f"    wrote {write_state(fs, sid, mem)} learner-state docs")
    return mem.state


async def run(students: List[int], subjects: List[str], apply: bool, rebuild: bool) -> None:
    fs = FirestoreService()
    svc = LearnerStateService(fs, background=False)
    svc.lifecycle_engine = MasteryLifecycleEngine(firestore_service=fs)
    total_changed = total_written = 0
    for sid in students:
        rebuilt = await rebuilt_state(fs, sid, subjects, apply) if rebuild else {}
        for subject in subjects:
            if rebuild and subject not in rebuilt:
                continue
            out = await svc.regate(sid, subject, apply=apply, doc=rebuilt.get(subject))
            if not out or not out["updates"]:
                continue
            ups = out["updates"]
            changed = [u for u in ups if (u["doc"].get("current_gate"), u["doc"].get("retention_state"))
                       != (u["gate"], u["retention_state"])]
            moves = Counter((int(u["doc"].get("current_gate") or 0), u["gate"]) for u in changed)
            after = [{"current_gate": u["gate"]} for u in ups]
            print(f"student {sid} {subject}: {len(ups)} docs, {len(changed)} change gate/state")
            print(f"    before {_gates([u['doc'] for u in ups])}")
            print(f"    after  {_gates(after)}   mastered (retention) "
                  f"{sum(u['doc'].get('retention_state') == 'mastered' for u in ups)} -> "
                  f"{sum(u['retention_state'] == 'mastered' for u in ups)}")
            if moves:
                print("    moves  " + ", ".join(f"{a}->{b}: {n}" for (a, b), n in sorted(moves.items())))
            total_changed += len(changed)
            total_written += out["written"]
    if apply:
        print(f"wrote {total_written} lifecycle docs")
    else:
        print(f"dry run: {total_changed} docs would change (--apply to write)")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--student", type=int, action="append")
    ap.add_argument("--all", action="store_true", help="every student doc")
    ap.add_argument("--subjects", nargs="+", default=SUBJECTS)
    ap.add_argument("--rebuild", action="store_true", help="replay answers into a fresh learner state first")
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    if not a.student and not a.all:
        ap.error("pass --student N (repeatable) or --all")
    if a.all:
        students = sorted(int(d.id) for d in FirestoreService().client.collection("students").stream() if d.id.isdigit())
    else:
        students = a.student
    asyncio.run(run(students, [subject_key(s) for s in a.subjects], a.apply, a.rebuild))


if __name__ == "__main__":
    main()
