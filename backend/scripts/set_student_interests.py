"""
Set a learner's free-form interests on the Firestore student document.

The generation-context persona block reads students/{id}.interests and passes
them to the curator brief (which may theme THE HOOK) and the manifest (which
may theme at most two component intents). Words only — interests never change
counts, scope, or which primitives are selected.

Onboarding does not collect interests (pilot onboarding CLOSED 2026-08-14), and
the Cosmos profile PUT replaces the whole preferences dict, so this script is
how interests get set today.

Usage (Windows, venv):
    venv/Scripts/python scripts/set_student_interests.py --student <student_id> \
        "excavators" "dump trucks" "trash trucks"

    venv/Scripts/python scripts/set_student_interests.py --student <student_id> --clear
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
    parser.add_argument("--clear", action="store_true",
                        help="Set interests to [] instead of writing new ones.")
    parser.add_argument("interests", nargs="*",
                        help='e.g. "excavators" "dump trucks"')
    args = parser.parse_args()

    if not args.clear and not args.interests:
        parser.error("give at least one interest, or pass --clear")

    fs = FirestoreService()  # scripts MUST reuse this client (hand-rolled clients 403)

    ok = await fs.set_student_interests(args.student, [] if args.clear else args.interests)
    if not ok:
        sys.exit(1)

    stored = await fs.get_student_interests(args.student)
    print(f"students/{args.student}.interests = {stored!r}")


if __name__ == "__main__":
    asyncio.run(main())
