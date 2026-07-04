"""
Write config/schoolYear to Firestore (the pace signal's calendar).

Without this doc, PlanningService falls back to a hardcoded prior-year
calendar (ends 2026-05-29), which makes weeks_remaining = 0 and zeroes the
allocation's required_minutes_per_day. Run once per school year.

Note: _school_weeks_remaining counts calendar weeks from TODAY to end_date
minus breaks — it does not read start_date. The pre-year summer gap is
therefore modeled as a break, so running this in July still yields an
honest weeks count.

Usage (Windows, py311env):
    python scripts/set_school_year_config.py                # 2026-27 defaults
    python scripts/set_school_year_config.py --start 2026-09-01 --end 2027-06-11
"""

import argparse
import asyncio
import os
import sys
from datetime import date

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.firestore_service import FirestoreService  # noqa: E402
from app.models.planning import SchoolBreak, SchoolYearConfig  # noqa: E402
from app.services.planning_service import PlanningService  # noqa: E402


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", type=str, default="2026-08-24")
    parser.add_argument("--end", type=str, default="2027-05-28")
    args = parser.parse_args()

    start = date.fromisoformat(args.start)
    config = SchoolYearConfig(
        start_date=args.start,
        end_date=args.end,
        breaks=[
            # Pre-year gap: keeps weeks_remaining honest when computed
            # before the first day of school (the calculator has no
            # concept of start_date — only end_date minus breaks).
            SchoolBreak(name="Summer (pre-year)", start="2026-06-01",
                        end=(start.isoformat())),
            SchoolBreak(name="Thanksgiving", start="2026-11-25", end="2026-11-28"),
            SchoolBreak(name="Winter break", start="2026-12-21", end="2027-01-02"),
            SchoolBreak(name="Spring break", start="2027-03-15", end="2027-03-20"),
        ],
        school_days_per_week=5,
    )

    fs = FirestoreService()  # scripts MUST reuse this client (hand-rolled clients 403)
    await fs.set_school_year_config(config.model_dump())

    weeks = PlanningService._school_weeks_remaining(
        date.today(), date.fromisoformat(config.end_date), config.breaks
    )
    print(f"config/schoolYear written: {config.start_date} → {config.end_date}, "
          f"{len(config.breaks)} breaks")
    print(f"weeks_remaining as of today ({date.today()}): {weeks}")


if __name__ == "__main__":
    asyncio.run(main())
