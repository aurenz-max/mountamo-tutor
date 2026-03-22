"""
Pulse Agent — CLI Entry Point
==============================

Run synthetic student journeys through the Pulse adaptive loop.

Usage:
    # Run a single profile
    python -m tests.pulse_agent.run_scenarios --profile gifted

    # Run all profiles
    python -m tests.pulse_agent.run_scenarios --all

    # Run with custom session count
    python -m tests.pulse_agent.run_scenarios --profile steady --sessions 5

    # Clean up synthetic student data before running
    python -m tests.pulse_agent.run_scenarios --profile gifted --clean

    # Save reports to a directory
    python -m tests.pulse_agent.run_scenarios --all --output ./reports
"""

from __future__ import annotations

import argparse
import asyncio
import io
import logging
import sys
from pathlib import Path

# Force UTF-8 output on Windows to handle θ and other Unicode symbols
if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# Ensure backend is on the path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app.db.firestore_service import FirestoreService
from app.services.calibration_engine import CalibrationEngine
from app.services.mastery_lifecycle_engine import MasteryLifecycleEngine
from app.services.learning_paths import LearningPathsService
from app.services.pulse_engine import PulseEngine
from app.core.config import settings

from tests.pulse_agent.agent import PulseAgentRunner
from tests.pulse_agent.profiles import ALL_PROFILES, SyntheticProfile
from tests.pulse_agent.assertions import run_assertions_for_archetype
from tests.pulse_agent.journey_recorder import JourneyRecorder
from tests.pulse_agent.reports import (
    generate_journey_report,
    generate_comparison_report,
    save_report,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("pulse_agent")


def build_engine() -> tuple:
    """Instantiate PulseEngine and its dependencies from config."""
    firestore_service = FirestoreService()
    calibration_engine = CalibrationEngine(firestore_service)
    mastery_lifecycle_engine = MasteryLifecycleEngine(firestore_service)
    learning_paths_service = LearningPathsService(
        firestore_service, project_id=settings.FIREBASE_PROJECT_ID
    )
    pulse_engine = PulseEngine(
        firestore_service=firestore_service,
        calibration_engine=calibration_engine,
        mastery_lifecycle_engine=mastery_lifecycle_engine,
        learning_paths_service=learning_paths_service,
    )
    return pulse_engine, firestore_service


async def run_single_profile(
    runner: PulseAgentRunner,
    profile: SyntheticProfile,
    session_limit: int | None = None,
    clean: bool = False,
    output_dir: Path | None = None,
) -> None:
    """Run one profile and print results."""

    if clean:
        await runner.cleanup_student(profile.student_id)

    timeline = await runner.run_profile(profile, session_limit=session_limit)

    # Run assertions
    results = run_assertions_for_archetype(timeline, profile.archetype)

    # Print summary
    print(f"\n{'='*60}")
    print(f"  {profile.name} ({profile.archetype})")
    print(f"{'='*60}")
    print(f"  Sessions: {timeline.total_sessions}")
    print(f"  Items:    {timeline.total_items}")
    print(f"  Leapfrogs: {timeline.total_leapfrogs}")
    print(f"  Gate advances: {timeline.total_gate_advances}")
    print(f"  Skills touched: {timeline.unique_skills_touched}")
    print()

    # Print assertions
    all_passed = True
    for r in results:
        icon = "PASS" if r.passed else "FAIL"
        print(f"  [{icon}] {r.name}: {r.message}")
        if not r.passed:
            all_passed = False
    print()

    if all_passed:
        print("  >> ALL ASSERTIONS PASSED")
    else:
        print("  >> SOME ASSERTIONS FAILED")

    # Save reports
    if output_dir:
        report = generate_journey_report(timeline, results)
        save_report(report, output_dir, profile.name.replace(" ", "_"))
        JourneyRecorder.save_timeline(timeline, output_dir)


async def run_all_profiles(
    runner: PulseAgentRunner,
    session_limit: int | None = None,
    clean: bool = False,
    output_dir: Path | None = None,
) -> None:
    """Run all profiles and generate a comparison report."""
    from .journey_recorder import JourneyTimeline

    timelines = []

    for name, profile in ALL_PROFILES.items():
        print(f"\n{'─'*60}")
        print(f"  Running: {profile.name}")
        print(f"{'─'*60}")

        if clean:
            await runner.cleanup_student(profile.student_id)

        timeline = await runner.run_profile(profile, session_limit=session_limit)
        timelines.append(timeline)

        results = run_assertions_for_archetype(timeline, profile.archetype)
        passed = sum(1 for r in results if r.passed)
        total = len(results)
        print(f"  Assertions: {passed}/{total} passed")

    # Comparison report
    print(f"\n{'='*60}")
    print("  COMPARISON SUMMARY")
    print(f"{'='*60}")
    comparison = generate_comparison_report(timelines)
    print(comparison)

    if output_dir:
        # Save individual + comparison reports
        for timeline in timelines:
            results = run_assertions_for_archetype(timeline, timeline.archetype)
            report = generate_journey_report(timeline, results)
            save_report(report, output_dir, timeline.profile_name.replace(" ", "_"))
            JourneyRecorder.save_timeline(timeline, output_dir)

        comp_path = output_dir / "comparison_report.md"
        comp_path.write_text(comparison, encoding="utf-8")
        print(f"\nComparison report saved to {comp_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Pulse Agent — Synthetic student journey simulator"
    )
    parser.add_argument(
        "--profile",
        choices=list(ALL_PROFILES.keys()),
        help="Run a single profile",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Run all profiles",
    )
    parser.add_argument(
        "--sessions",
        type=int,
        default=None,
        help="Override number of sessions per profile",
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Clean up synthetic student data before running",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Directory for reports and journey JSON files",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducible runs (default: 42)",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List available profiles and exit",
    )

    args = parser.parse_args()

    if args.list:
        print("\nAvailable profiles:")
        print("-" * 50)
        for name, p in ALL_PROFILES.items():
            print(f"  {name:20s} — {p.description}")
        return

    if not args.profile and not args.all:
        parser.error("Specify --profile <name> or --all")

    output_dir = Path(args.output) if args.output else None

    # Build engine
    pulse_engine, firestore_service = build_engine()
    runner = PulseAgentRunner(pulse_engine, firestore_service, seed=args.seed)

    # Run
    if args.all:
        asyncio.run(run_all_profiles(runner, args.sessions, args.clean, output_dir))
    else:
        profile = ALL_PROFILES[args.profile]
        asyncio.run(
            run_single_profile(runner, profile, args.sessions, args.clean, output_dir)
        )


if __name__ == "__main__":
    main()
