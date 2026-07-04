"""
Probe the pace-aware daily session plan (velocity allocator slice).

Builds today's plan IN MEMORY via PlanningService._build_daily_session_plan —
nothing is persisted — and prints the allocation (per-subject minute shares,
remaining work, required-minutes-per-day pace signal) plus the resulting
blocks, so allocator behavior can be eyeballed against real student state.

Usage (Windows, py311env):
    set PYTHONIOENCODING=utf-8
    python scripts/probe_daily_plan.py --student 1004
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
from app.services.planning_service import PlanningService  # noqa: E402


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--student", type=int, required=True)
    args = parser.parse_args()

    fs = FirestoreService()  # scripts MUST reuse this client (hand-rolled clients 403)
    learning_paths = LearningPathsService(
        firestore_service=fs, project_id=settings.GCP_PROJECT_ID
    )
    curriculum = CurriculumService(firestore_service=fs)
    await curriculum.initialize()
    analytics = FirestoreAnalyticsService(
        firestore_service=fs,
        curriculum_service=curriculum,
        learning_paths_service=learning_paths,
    )
    planning = PlanningService(
        firestore_service=fs,
        curriculum_service=curriculum,
        learning_paths_service=learning_paths,
        analytics_service=analytics,
    )

    plan = await planning._build_daily_session_plan(args.student)

    print(f"\n=== Daily plan (in-memory, NOT persisted) — student {args.student} ===")
    print(f"budget {plan.budget_minutes}m | estimated {plan.estimated_total_minutes}m "
          f"| {len(plan.blocks)} blocks | {plan.total_subskills} subskills "
          f"({plan.new_subskills} new / {plan.review_subskills} review)")

    if plan.allocation:
        a = plan.allocation
        print(f"\n--- Allocation [{a.policy}] ---")
        print(f"weeks remaining: {a.weeks_remaining} | required to finish: "
              f"{a.required_minutes_per_day} min/day "
              f"(at ASSUMED {a.assumed_min_per_subskill} min/subskill)")
        for p in sorted(a.subjects, key=lambda s: -s.allocated_minutes):
            print(f"  {p.subject:<20} {p.allocated_minutes:>6.1f}m  "
                  f"weight {p.weight:.2f}  "
                  f"remaining {p.remaining_subskills}/{p.total_subskills}  "
                  f"selector_count {p.selector_count}")
    else:
        print("\n(no allocation — analytics service missing or no graphs)")

    print("\n--- Blocks ---")
    for b in plan.blocks:
        subs = ", ".join(s.subskill_id for s in b.subskills)
        print(f"{b.block_index}. [{b.type.value:>8}] [{b.subject:<16}] "
              f"{b.estimated_minutes:>2}m  {b.title}  ({len(b.subskills)} subskills: {subs})")

    if plan.warnings:
        print("\nwarnings:", "; ".join(plan.warnings))

    # Per-subject minutes actually landed vs allocated (normalized keys —
    # retest blocks carry lifecycle spellings like "Language Arts")
    if plan.allocation:
        used: dict = {}
        for b in plan.blocks:
            k = FirestoreService.rollup_subject_key(b.subject)
            used[k] = used.get(k, 0) + b.estimated_minutes
        print("\n--- Allocated vs filled ---")
        for p in sorted(plan.allocation.subjects, key=lambda s: -s.allocated_minutes):
            key = FirestoreService.rollup_subject_key(p.subject)
            print(f"  {p.subject:<20} allocated {p.allocated_minutes:>6.1f}m -> "
                  f"filled {used.get(key, 0):>3}m")


if __name__ == "__main__":
    asyncio.run(main())
