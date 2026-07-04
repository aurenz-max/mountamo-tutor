"""
Probe the ForecastService (skill-level forward projection).

Runs the real get-or-create path — today's forecast is MATERIALIZED to
students/{id}/forecasts/{date} exactly as the endpoint would — and prints
per-subject rates, unit ETAs, retention triage, and drift vs the prior doc.
Use --dry to build in memory without persisting.

Usage (Windows, py311env):
    set PYTHONIOENCODING=utf-8
    python scripts/probe_forecast.py --student 1004
    python scripts/probe_forecast.py --student 1004 --refresh
    python scripts/probe_forecast.py --student 1004 --dry
"""

import argparse
import asyncio
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings  # noqa: E402
from app.db.firestore_service import FirestoreService  # noqa: E402
from app.services.curriculum_service import CurriculumService  # noqa: E402
from app.services.firestore_analytics import FirestoreAnalyticsService  # noqa: E402
from app.services.forecast_service import ForecastService  # noqa: E402
from app.services.learning_paths import LearningPathsService  # noqa: E402


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--student", type=int, required=True)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--dry", action="store_true", help="build in memory, don't persist")
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
    svc = ForecastService(fs, curriculum, analytics)

    if args.dry:
        today = datetime.now(timezone.utc).date().isoformat()
        f = await svc._build_forecast(args.student, today)
    else:
        f = await svc.get_student_forecast(args.student, force_refresh=args.refresh)

    print(f"\n=== Forecast — student {args.student} · {f.date}"
          f"{' (dry, not persisted)' if args.dry else ''} ===")
    print(f"year {f.year_start} → {f.year_end} | {f.weeks_remaining} instructional weeks"
          f" | budget {f.budget_minutes}m | required {f.required_minutes_per_day} min/day"
          f" (ASSUMED {f.assumed_min_per_subskill}m/subskill)")
    if f.warnings:
        print("warnings:", "; ".join(f.warnings))

    for s in f.subjects:
        print(f"\n--- {s.subject} — {s.remaining_subskills}/{s.total_subskills} remaining"
              f" · {s.allocated_minutes_per_day}m/day"
              f" · {s.weekly_rate.best}/wk (opt {s.weekly_rate.optimistic}"
              f" / pess {s.weekly_rate.pessimistic})"
              f" · finish {s.projected_finish.best} ---")
        rl = s.review_load
        print(f"    reviews/wk {rl.due_per_week}: subsumed {rl.subsumed}"
              f" + riders {rl.riders} + blocks {rl.dedicated_blocks}"
              f" (graph coverage {rl.graph_coverage})")
        for u in s.units[:12]:
            flag = " ⚠ past year end" if u.past_year_end else ""
            print(f"    [{u.order_basis:>8}] {u.eta_start} → {u.eta_end.best:<12}"
                  f" {u.unit_title} ({u.subskills}){flag}")
        if len(s.units) > 12:
            print(f"    … {len(s.units)-12} more units")
        head = [e for e in s.subskill_etas if e.order_basis == "selector"][:3]
        for e in head:
            print(f"      next: {e.eta_week}  {e.description[:60]}  [{e.subskill_id}]")

    if f.drift and f.drift.units:
        print(f"\n--- Drift vs {f.drift.compared_to} ---")
        for d in f.drift.units[:10]:
            sign = "+" if d.delta_days > 0 else ""
            print(f"    {d.subject} / {d.unit_title}: {d.previous_eta} → "
                  f"{d.current_eta} ({sign}{d.delta_days}d)")
    elif f.drift:
        print(f"\n(no unit moved ≥7 days vs {f.drift.compared_to})")


if __name__ == "__main__":
    asyncio.run(main())
