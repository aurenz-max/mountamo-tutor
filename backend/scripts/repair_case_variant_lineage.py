#!/usr/bin/env python3
"""Repair dead-end lineage records for case-variant subskill IDs.

Problem (diagnosed 2026-07-02 on student 1004): subskill IDs collide across
grades by suffix case — Kindergarten publishes OPS001-01-A while Grade 1
publishes OPS001-01-a. When the lowercase IDs were deprecated, their
curriculum_lineage records were written with canonical_ids: [] (a rename with
no target), so SubskillIdResolver._follow_chain returns the old ID unchanged
and student docs stored under the retired ID never merge into the live one.

Fix strategy: complete the lineage records, don't rewrite student data. The
read-side loaders (_load_competency_map / _load_lifecycle_map) and the write
paths (update_competency / upsert_student_ability / upsert_mastery_lifecycle)
all resolve through lineage, so once each dead-end record points at its
case-variant successor, history merges at read time and new writes land on the
canonical doc.

Usage:
    python scripts/repair_case_variant_lineage.py               # dry run
    python scripts/repair_case_variant_lineage.py --student 1004  # + stray-doc report
    python scripts/repair_case_variant_lineage.py --apply       # write the fixes
"""

import argparse
import os
import sys
from collections import defaultdict
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv

load_dotenv(backend_dir / ".env")


def get_client():
    # Reuse the app's own Firestore initialization (settings-driven
    # firebase-admin credentials + FIREBASE_PROJECT_ID) — hand-rolled clients
    # here have hit 403s from credential/project mismatches.
    from app.db.firestore_service import FirestoreService

    return FirestoreService().client


def load_published_subskill_ids(client) -> dict:
    """Return {subskill_id: [(grade, subject_id), ...]} for every published subskill."""
    live = defaultdict(list)
    for grade_doc in client.collection("curriculum_published").stream():
        grade = grade_doc.id
        for subj_doc in grade_doc.reference.collection("subjects").stream():
            data = subj_doc.to_dict() or {}
            index = data.get("subskill_index") or {}
            ids = list(index.keys())
            if not ids:
                # Fall back to walking the hierarchy
                for unit in data.get("hierarchy", []) or []:
                    for skill in unit.get("skills", []) or []:
                        for sub in skill.get("subskills", []) or []:
                            if sub.get("id"):
                                ids.append(sub["id"])
            for sid in ids:
                live[sid].append((grade, subj_doc.id))
    return live


def find_dead_end_records(client) -> list:
    """Lineage records at subskill level with no canonical target."""
    dead = []
    for doc in client.collection("curriculum_lineage").stream():
        data = doc.to_dict() or {}
        if data.get("level", "subskill") != "subskill":
            continue
        targets = data.get("canonical_ids") or []
        if not targets and not data.get("canonical_id"):
            dead.append((doc.id, data))
    return dead


def report_student_strays(client, student_id: int, live_ids: dict) -> None:
    """Report student docs stored under subskill IDs that are not published
    but have a case-variant that is."""
    live_lower = defaultdict(list)
    for sid in live_ids:
        live_lower[sid.lower()].append(sid)

    print(f"\n--- Stray-doc report for student {student_id} ---")
    student_ref = client.collection("students").document(str(student_id))
    for coll in ("competencies", "mastery_lifecycle", "attempts", "reviews"):
        counts = defaultdict(int)
        for doc in student_ref.collection(coll).stream():
            sid = (doc.to_dict() or {}).get("subskill_id")
            if sid:
                counts[sid] += 1
        strays = {
            sid: n for sid, n in counts.items()
            if sid not in live_ids and any(v != sid for v in live_lower.get(sid.lower(), []))
        }
        if strays:
            print(f"  {coll}:")
            for sid, n in sorted(strays.items()):
                variants = [v for v in live_lower[sid.lower()] if v != sid]
                print(f"    {sid}  ({n} docs)  → live case-variant(s): {', '.join(variants)}")
        else:
            print(f"  {coll}: no case-variant strays")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Write fixes (default: dry run)")
    parser.add_argument("--student", type=int, help="Also report stray docs for this student")
    args = parser.parse_args()

    client = get_client()

    print("Loading published subskill IDs across all grades…")
    live_ids = load_published_subskill_ids(client)
    print(f"  {len(live_ids)} live subskill IDs")

    live_lower = defaultdict(list)
    for sid in live_ids:
        live_lower[sid.lower()].append(sid)

    print("Scanning curriculum_lineage for dead-end subskill records…")
    dead = find_dead_end_records(client)
    print(f"  {len(dead)} records with no canonical target")

    proposals = []
    for doc_id, data in dead:
        old_id = data.get("old_id", doc_id)
        if old_id in live_ids:
            # Still published — record is stale, not a rename. Skip.
            continue
        variants = [v for v in live_lower.get(old_id.lower(), []) if v != old_id]
        if len(variants) == 1:
            proposals.append((doc_id, old_id, variants[0]))
        elif len(variants) > 1:
            print(f"  AMBIGUOUS: {old_id} matches multiple live IDs {variants} — skipping, resolve manually")

    print(f"\n{len(proposals)} repairable dead-end records:")
    for doc_id, old_id, target in proposals:
        print(f"  {old_id}  → canonical_ids: ['{target}']  (doc {doc_id})")

    if not args.apply:
        if args.student:
            report_student_strays(client, args.student, live_ids)
        print("\nDRY RUN — nothing written. Re-run with --apply to update the lineage records.")
        return

    for doc_id, old_id, target in proposals:
        client.collection("curriculum_lineage").document(doc_id).update(
            {"canonical_ids": [target], "repair_note": "case-variant successor filled by repair_case_variant_lineage.py"}
        )
        print(f"  UPDATED {doc_id}: {old_id} → {target}")
    print(f"\nDone — {len(proposals)} lineage records completed.")
    print("Note: the resolver caches lineage for a few minutes; restart the backend or wait for the cache TTL.")

    if args.student:
        report_student_strays(client, args.student, live_ids)


if __name__ == "__main__":
    main()
