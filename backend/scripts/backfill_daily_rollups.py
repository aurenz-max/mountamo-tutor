#!/usr/bin/env python3
"""Rebuild students/{sid}/daily_rollups and profile/summary from attempts (L0).

The L2 read model (daily_rollups counter docs + profile summary) is maintained
incrementally by FirestoreService.apply_attempt_rollup on every attempt write.
This script is the replay half of that contract: it recomputes every rollup
doc and the profile summary deterministically from the attempts subcollection
and OVERWRITES what's there (set without merge), so it can also repair drift.

Like the live write path, it does NOT trust the subject string on the attempt
(several submission paths default it to "General" or spell it "Reading" vs
"Language Arts"). It resolves the CANONICAL subject + grade from the curriculum
via the attempt's subskill_id (lineage-aware) and stamps a per-grade breakdown;
the raw subject survives only as a fallback for a true orphan, flagged so the
read model can drop it.

Run it once per student before trusting the rollup-served endpoints
(engagement-metrics, score-trends) — students with history but no rollups
fall back to the legacy scans until then. Re-running also re-attributes any
legacy "General"/mis-labeled rows to their true subject + grade.

Usage:
    python scripts/backfill_daily_rollups.py --student 1004        # dry run, one student
    python scripts/backfill_daily_rollups.py --all                 # dry run, every student
    python scripts/backfill_daily_rollups.py --student 1004 --apply  # write
"""

import argparse
import asyncio
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


async def aggregate_student(fs, student_id: int):
    """Return (rollups: {day: doc}, profile: doc, attempt_count) from attempts.

    Subject + grade are resolved canonically per attempt (lineage → curriculum)
    to match apply_attempt_rollup, so the rebuilt read model carries the nested
    per-grade breakdown and drops phantom "General" labels.
    """
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
    # day -> scope -> set   and   day -> subj_key -> grade -> set
    subskill_sets = defaultdict(lambda: defaultdict(set))
    grade_subskill_sets = defaultdict(lambda: defaultdict(lambda: defaultdict(set)))

    count = 0
    for doc in fs._attempts_subcollection(student_id).stream():
        a = doc.to_dict() or {}
        ts = a.get("timestamp") or a.get("created_at") or ""
        if len(ts) < 10:
            continue
        day = ts[:10]
        raw_subject = a.get("subject") or ""
        subskill_id = a.get("subskill_id") or ""
        try:
            score = float(a.get("score", 0))
        except (TypeError, ValueError):
            score = 0.0

        loc = await fs.resolve_subskill_location(subskill_id)
        if loc:
            canonical_subject = loc["subject"]
            grade_key = fs.normalize_grade_code(loc.get("grade"))
            unresolved = False
        else:
            canonical_subject = raw_subject
            grade_key = "UNKNOWN"
            unresolved = True
        subj_key = fs.rollup_subject_key(canonical_subject)
        count += 1

        # --- daily rollup ---
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
        grade_subskill_sets[day][subj_key][grade_key].add(subskill_id)

        s = r["subjects"].setdefault(
            subj_key, {"name": canonical_subject, "unresolved": unresolved, "attempts": 0, "sum_score": 0.0, "grades": {}}
        )
        s["attempts"] += 1
        s["sum_score"] += score
        s["unresolved"] = s["unresolved"] and unresolved
        sg = s["grades"].setdefault(grade_key, {"attempts": 0, "sum_score": 0.0, "last_activity_at": ts})
        sg["attempts"] += 1
        sg["sum_score"] += score
        sg["last_activity_at"] = max(sg["last_activity_at"], ts)

        # --- profile summary ---
        profile["total_attempts"] += 1
        profile["sum_score"] += score
        p = profile["subjects"].setdefault(
            subj_key,
            {"name": canonical_subject, "unresolved": unresolved, "attempts": 0, "sum_score": 0.0, "last_activity_at": ts, "grades": {}},
        )
        p["attempts"] += 1
        p["sum_score"] += score
        p["unresolved"] = p["unresolved"] and unresolved
        pg = p["grades"].setdefault(grade_key, {"attempts": 0, "sum_score": 0.0, "last_activity_at": ts})
        pg["attempts"] += 1
        pg["sum_score"] += score
        if ts > (pg["last_activity_at"] or ""):
            pg["last_activity_at"] = ts
        if ts > (p["last_activity_at"] or ""):
            p["last_activity_at"] = ts
        if ts > (profile["last_activity_at"] or ""):
            profile["last_activity_at"] = ts
            profile["last_subject"] = canonical_subject
            profile["last_subskill_id"] = subskill_id

    for day, r in rollups.items():
        r["subskills"] = sorted(subskill_sets[day]["__all__"])
        for subj_key, s in r["subjects"].items():
            s["subskills"] = sorted(subskill_sets[day][subj_key])
            for grade_key, sg in s["grades"].items():
                sg["subskills"] = sorted(grade_subskill_sets[day][subj_key][grade_key])

    profile["updated_at"] = profile["last_activity_at"]
    return rollups, profile, count


async def backfill_student(fs, student_id: int, apply: bool) -> None:
    rollups, profile, count = await aggregate_student(fs, student_id)
    if count == 0:
        print(f"student {student_id}: no attempts, skipping")
        return

    days = sorted(rollups.keys())
    # Show the per-(subject, grade) shape the read model will serve.
    parts = []
    for k, v in sorted(profile["subjects"].items()):
        grades = ",".join(
            f"{gk}:{gv['attempts']}" for gk, gv in sorted(v.get("grades", {}).items())
        )
        flag = " *unresolved" if v.get("unresolved") else ""
        parts.append(f"{k}[{grades}]{flag}")
    subj_summary = "  ".join(parts)
    print(
        f"student {student_id}: {count} attempts -> {len(rollups)} rollup days "
        f"({days[0]}..{days[-1]}), avg score "
        f"{profile['sum_score'] / max(profile['total_attempts'], 1):.2f}\n"
        f"    {subj_summary}"
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


async def run(args) -> None:
    fs = get_service()

    if args.all:
        student_ids = sorted(
            int(doc.id) for doc in fs.client.collection("students").stream() if doc.id.isdigit()
        )
        print(f"{len(student_ids)} student docs found")
    else:
        student_ids = args.student

    for sid in student_ids:
        await backfill_student(fs, sid, apply=args.apply)

    if not args.apply:
        print("\nDRY RUN - nothing written. Re-run with --apply to write rollups.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--student", type=int, action="append", help="Student id (repeatable)")
    parser.add_argument("--all", action="store_true", help="Backfill every student doc")
    parser.add_argument("--apply", action="store_true", help="Write docs (default: dry run)")
    args = parser.parse_args()

    if not args.student and not args.all:
        parser.error("pass --student N (repeatable) or --all")

    asyncio.run(run(args))


if __name__ == "__main__":
    main()
