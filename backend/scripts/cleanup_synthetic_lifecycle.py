"""
Retire mastery_lifecycle docs whose subskill_id has no curriculum home.

Old free-form lessons wrote synthetic subskill ids (e.g.
LANGUAGE_ARTS-U1759890612122-...) into mastery_lifecycle. Those docs can
never resolve a description, pollute review/retest scheduling forever, and
(pre-2026-07-03) surfaced raw ids in the daily session plan. A subskill id
is "synthetic" iff it appears in NO published curriculum doc's
subskill_index — the same grade-aware criterion the session planner now
filters on.

Dry-run by default; pass --apply to delete.

Usage:
    python scripts/cleanup_synthetic_lifecycle.py --student 1004
    python scripts/cleanup_synthetic_lifecycle.py --student 1004 --apply
"""

import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.firestore_service import FirestoreService  # noqa: E402


async def collect_valid_subskill_ids(fs: FirestoreService) -> set:
    """Union of subskill_index keys across ALL published grade docs."""
    valid: set = set()
    published = await fs.get_all_published_subjects()
    for entry in published:
        subject_id = entry.get("subject_id", "")
        grade = entry.get("grade")
        doc = await fs.get_published_curriculum(subject_id, grade=grade)
        if doc and "subskill_index" in doc:
            valid.update(doc["subskill_index"].keys())
    print(f"valid subskill ids across all published docs: {len(valid)}")
    return valid


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--student", type=int, required=True)
    parser.add_argument("--apply", action="store_true", help="Actually delete (default: dry-run)")
    args = parser.parse_args()

    fs = FirestoreService()  # scripts MUST reuse this client (hand-rolled clients 403)
    valid = await collect_valid_subskill_ids(fs)
    if not valid:
        print("ABORT: no valid subskill ids loaded — refusing to treat everything as synthetic.")
        return

    lifecycle_ref = (
        fs.client.collection("students")
        .document(str(args.student))
        .collection("mastery_lifecycle")
    )
    docs = list(lifecycle_ref.stream())
    synthetic = []
    for d in docs:
        data = d.to_dict() or {}
        sid = data.get("subskill_id") or d.id
        if sid not in valid:
            synthetic.append((d, sid, data.get("subject", ""), data.get("current_gate", 0)))

    print(f"\nstudent {args.student}: {len(docs)} lifecycle docs, {len(synthetic)} synthetic")
    for _, sid, subject, gate in synthetic:
        print(f"  [{subject:14}] gate={gate} {sid}")

    if not synthetic:
        return
    if not args.apply:
        print("\nDRY RUN — rerun with --apply to delete these docs.")
        return

    for doc, sid, _, _ in synthetic:
        doc.reference.delete()
    print(f"\nDeleted {len(synthetic)} synthetic lifecycle docs.")


if __name__ == "__main__":
    asyncio.run(main())
