#!/usr/bin/env python3
"""Rebuild students/{sid}/component_mastery/{kind} from attempts (L0).

The component tallies are incremented by FirestoreService.apply_component_evidence
on every attempt write that carries `component_evidence`. This script is the
replay half: it recomputes each kind's doc from the attempts subcollection and
OVERWRITES it (set without merge), so it also repairs drift. A kind with a doc
but no evidence left in the attempts is deleted.

Usage:
    python scripts/backfill_component_mastery.py --student 1004          # dry run
    python scripts/backfill_component_mastery.py --all                   # dry run, every student
    python scripts/backfill_component_mastery.py --student 1004 --apply  # write
"""

import argparse
import asyncio
import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv

load_dotenv(backend_dir / ".env")


def get_service():
    # The app's own Firestore initialization; hand-rolled clients have hit 403s.
    from app.db.firestore_service import FirestoreService

    return FirestoreService()


def rebuild(attempts):
    """{kind: doc-without-student-id} from attempt dicts, oldest first."""
    from app.services.component_mastery import clean_component_evidence

    docs = {}
    for attempt in sorted(attempts, key=lambda a: a.get("timestamp") or ""):
        ts = attempt.get("timestamp")
        for row in clean_component_evidence(attempt.get("component_evidence")):
            doc = docs.setdefault(row["kind"], {"kind": row["kind"], "components": {}, "updated_at": ts})
            entry = doc["components"].setdefault(row["id"], {"attempts": 0, "correct": 0, "last_at": ts})
            entry["attempts"] += row["attempts"]
            entry["correct"] += row["correct"]
            entry["last_at"] = ts
            doc["updated_at"] = ts
    return docs


async def backfill_student(fs, student_id: int, apply: bool) -> None:
    student = fs.client.collection("students").document(str(student_id))
    attempts = [d.to_dict() or {} for d in student.collection("attempts").stream()]
    docs = rebuild(attempts)
    existing = {d.id for d in student.collection("component_mastery").stream()}
    with_evidence = sum(1 for a in attempts if a.get("component_evidence"))
    print(f"student {student_id}: {len(attempts)} attempts, {with_evidence} with component evidence")
    for kind, doc in docs.items():
        total = sum(c["attempts"] for c in doc["components"].values())
        print(f"  {kind}: {len(doc['components'])} components, {total} observations")
        if apply:
            student.collection("component_mastery").document(kind).set({**doc, "student_id": student_id})
    for stale in sorted(existing - set(docs)):
        print(f"  {stale}: no evidence left in attempts -> {'deleted' if apply else 'would delete'}")
        if apply:
            student.collection("component_mastery").document(stale).delete()


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--student", type=int)
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--apply", action="store_true", help="write (default is a dry run)")
    args = parser.parse_args()
    if not args.student and not args.all:
        parser.error("pass --student N or --all")
    fs = get_service()
    ids = [args.student] if args.student else [int(d.id) for d in fs.client.collection("students").stream() if d.id.isdigit()]
    for student_id in ids:
        await backfill_student(fs, student_id, args.apply)
    print("applied" if args.apply else "dry run: nothing written (pass --apply)")


if __name__ == "__main__":
    asyncio.run(main())
