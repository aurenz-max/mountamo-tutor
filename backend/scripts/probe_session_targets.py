"""
Probe the session-scope selector (Lesson Entry Contract fill mode #3).

Prints, for one student+subject, what the next recommended lesson would
target and why — learn/confirm kind, P(correct) vs gate threshold, verb —
so selection quality can be eyeballed against the progress dashboard
before any UI is wired.

Usage (Windows, py311env):
    python scripts/probe_session_targets.py --student 1004 --subject Mathematics
    python scripts/probe_session_targets.py --student 1004 --subject Mathematics --grade Kindergarten --count 4
"""

import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings  # noqa: E402
from app.db.firestore_service import FirestoreService  # noqa: E402
from app.services.curriculum_service import CurriculumService  # noqa: E402
from app.services.firestore_analytics import FirestoreAnalyticsService  # noqa: E402
from app.services.learning_paths import LearningPathsService  # noqa: E402


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--student", type=int, required=True)
    parser.add_argument("--subject", type=str, required=True)
    parser.add_argument("--grade", type=str, default=None)
    parser.add_argument("--count", type=int, default=4)
    args = parser.parse_args()

    fs = FirestoreService()  # scripts MUST reuse this client (hand-rolled clients 403)
    learning_paths = LearningPathsService(
        firestore_service=fs, project_id=settings.GCP_PROJECT_ID
    )
    curriculum = CurriculumService(firestore_service=fs)  # Firestore-only, like dependencies.py
    await curriculum.initialize()
    analytics = FirestoreAnalyticsService(
        firestore_service=fs,
        curriculum_service=curriculum,
        learning_paths_service=learning_paths,
    )

    result = await analytics.select_session_targets(
        args.student, args.subject, grade=args.grade, count=args.count
    )

    pools = result["pool_sizes"]
    print(
        f"\nstudent {args.student} | {args.subject}"
        + (f" | grade {args.grade}" if args.grade else "")
    )
    print(
        f"candidate pools: confirm={pools['confirm']} learn={pools['learn']} "
        f"cold_start={pools['cold_start']}\n"
    )

    if not result["objectives"]:
        print("No eligible targets — student may have no unlocked, unmastered nodes.")
        return

    for i, o in enumerate(result["objectives"], 1):
        p = f"{o['pCorrect']:.2f}" if o["pCorrect"] is not None else "  — "
        print(f"{i}. [{o['kind']:>10}] [{o['verb']:>8}] p={p} gate={o['currentGate']}")
        print(f"   {o['subskillId']} ({o['skillId']}) | unit: {o['unitTitle'] or o['unitId'] or '?'}")
        print(f"   {o['text']}")
        print(f"   why: {o['reason']}\n")


if __name__ == "__main__":
    asyncio.run(main())
