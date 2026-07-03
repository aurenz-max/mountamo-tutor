#!/usr/bin/env python3
"""Rebuild students/{sid}/daily_rollups and profile/summary from attempts (L0).

The L2 read model (daily_rollups counter docs + profile summary) is maintained
incrementally by FirestoreService.apply_attempt_rollup on every attempt write.
This script is the replay half of that contract: it recomputes every rollup
doc and the profile summary deterministically from the attempts subcollection
and OVERWRITES what's there (set without merge), so it can also repair drift.

Run it once per student before trusting the rollup-served endpoints
(engagement-metrics, score-trends) — students with history but no rollups
fall back to the legacy scans until then.

Usage:
    python scripts/backfill_daily_rollups.py --student 1004        # dry run, one student
    python scripts/backfill_daily_rollups.py --all                 # dry run, every student
    python scripts/backfill_daily_rollups.py --student 1004 --apply  # write
"""

import argparse
import sys
from collections import defaultdict
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv

load_dotenv(backend_dir / ".env")


def get_service():
    # Reuse the app's own Firestore initialization (settings-driven
    # credentials) — hand-rolled clients here have hit 403s.
    from app.db.firestore_service import FirestoreService

    return FirestoreService()


def aggregate_student(fs, student_id: int):
    """Return (rollups: {day: doc}, profile: doc, attempt_count) from attempts."""
    rollups = {}
    profile = {
        "student_id": student_id,
        "total_attempts": 0,
        "sum_score": 0.0,
        "last_activity_at": None,
        "last_subject": None,
        "last_subskill_id": None,
        "subjects": {},
    }
    subskill_sets = defaultdict(lambda: defaultdict(set))  # day -> scope -> set

    count = 0
    for doc in fs._attempts_subcollection(student_id).stream():
        a = doc.to_dict() or {}
        ts = a.get("timestamp") or a.get("created_at") or ""
        if len(ts) < 10:
            continue
        day = ts[:10]
        subject = a.get("subject") or ""
        subskill_id = a.get("subskill_id") or ""
        try:
            score = float(a.get("score", 0))
        except (TypeError, ValueError):
            score = 0.0
        subj_key = fs.rollup_subject_key(subject)
        count += 1

        r = rollups.setdefault(day, {
            "date": day,
            "student_id": student_id,
            "attempts": 0,
            "sum_score": 0.0,
            "subjects": {},
            "updated_at": ts,
        })
        r["attempts"] += 1
        r["sum_score"] += score
        r["updated_at"] = max(r["updated_at"], ts)
        subskill_sets[day]["__all__"].add(subskill_id)
        subskill_sets[day][subj_key].add(subskill_id)

        s = r["subjects"].setdefault(subj_key, {"name": subject, "attempts": 0, "sum_score": 0.0})
        s["attempts"] += 1
        s["sum_score"] += score

        profile["total_attempts"] += 1
        profile["sum_score"] += score
        p = profile["subjects"].setdefault(
            subj_key, {"name": subject, "attempts": 0, "sum_score": 0.0, "last_activity_at": ts}
        )
        p["attempts"] += 1
        p["sum_score"] += score
        if ts > (p["last_activity_at"] or ""):
            p["last_activity_at"] = ts
        if ts > (profile["last_activity_at"] or ""):
            profile["last_activity_at"] = ts
            profile["last_subject"] = subject
            profile["last_subskill_id"] = subskill_id

    for day, r in rollups.items():
        r["subskills"] = sorted(subskill_sets[day]["__all__"])
        for subj_key, s in r["subjects"].items():
            s["subskills"] = sorted(subskill_sets[day][subj_key])

    profile["updated_at"] = profile["last_activity_at"]
    return rollups, profile, count


def backfill_student(fs, student_id: int, apply: bool) -> None:
    rollups, profile, count = aggregate_student(fs, student_id)
    if count == 0:
        print(f"student {student_id}: no attempts, skipping")
        return

    days = sorted(rollups.keys())
    subj_summary = ", ".join(
        f"{k}={v['attempts']}" for k, v in sorted(profile["subjects"].items())
    )
    print(
        f"student {student_id}: {count} attempts -> {len(rollups)} rollup days "
        f"({days[0]}..{days[-1]}), avg score "
        f"{profile['sum_score'] / max(profile['total_attempts'], 1):.2f}  [{subj_summary}]"
    )
    if not apply:
        return

    batch = fs.client.batch()
    pending = 0
    for day, r in rollups.items():
        batch.set(fs._daily_rollups_subcollection(student_id).document(day), r)
        pending += 1
        if pending >= 400:  # Firestore batch limit is 500 writes
            batch.commit()
            batch = fs.client.batch()
            pending = 0
    batch.set(fs._profile_summary_ref(student_id), profile)
    batch.commit()
    print(f"  WROTE {len(rollups)} rollup docs + profile summary")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--student", type=int, action="append", help="Student id (repeatable)")
    parser.add_argument("--all", action="store_true", help="Backfill every student doc")
    parser.add_argument("--apply", action="store_true", help="Write docs (default: dry run)")
    args = parser.parse_args()

    if not args.student and not args.all:
        parser.error("pass --student N (repeatable) or --all")

    fs = get_service()

    if args.all:
        student_ids = sorted(
            int(doc.id) for doc in fs.client.collection("students").stream() if doc.id.isdigit()
        )
        print(f"{len(student_ids)} student docs found")
    else:
        student_ids = args.student

    for sid in student_ids:
        backfill_student(fs, sid, apply=args.apply)

    if not args.apply:
        print("\nDRY RUN - nothing written. Re-run with --apply to write rollups.")


if __name__ == "__main__":
    main()
