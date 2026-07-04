"""
Set the planning-side grade of record on a Firestore student document.

Backend services (planner, selector, forecast, KG progress) read
students/{id}.grade_level to scope curriculum-graph lookups. Without it the
bare-subject resolution scans grade docs first-doc-wins (lexicographic:
"1" beats "Kindergarten") and serves the wrong grade's curriculum.

The user-facing grade lives on the Cosmos user profile and is written
through automatically on PUT /user-profiles/profile — this script exists
for students created before the write-through (or test students).

Usage (Windows, py311env):
    python scripts/set_student_grade.py --student 1004 --grade K
"""

import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.firestore_service import FirestoreService  # noqa: E402


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--student", type=int, required=True)
    parser.add_argument("--grade", type=str, required=True,
                        help='e.g. "K", "1st", "2", "Pre-K"')
    args = parser.parse_args()

    fs = FirestoreService()  # scripts MUST reuse this client (hand-rolled clients 403)

    suffix = fs.grade_to_subject_suffix(args.grade)
    if not suffix:
        print(f"WARNING: grade {args.grade!r} does not resolve to a curriculum "
              f"suffix — graph lookups will still fall back to the ambiguous scan.")

    ok = await fs.set_student_grade_level(args.student, args.grade)
    if not ok:
        sys.exit(1)

    stored = await fs.get_student_planning_fields(args.student)
    print(f"students/{args.student}.grade_level = {stored.get('grade_level')!r}"
          f" (curriculum suffix: {suffix or 'NONE'})")


if __name__ == "__main__":
    asyncio.run(main())
