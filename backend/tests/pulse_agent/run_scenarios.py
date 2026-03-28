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
from tests.pulse_agent.in_memory_firestore import InMemoryFirestoreService
from tests.pulse_agent.profiles import ALL_PROFILES, SyntheticProfile
from tests.pulse_agent.assertions import run_assertions_for_archetype
from tests.pulse_agent.journey_recorder import JourneyRecorder
from tests.pulse_agent.reports import (
    generate_journey_report,
    generate_graph_report,
    generate_comparison_report,
    save_report,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
# Suppress noisy Firestore update logs so pulse agent output is readable
logging.getLogger("app.db.firestore_service").setLevel(logging.WARNING)
logging.getLogger("app.services.calibration_engine").setLevel(logging.WARNING)
logging.getLogger("app.services.mastery_lifecycle_engine").setLevel(logging.WARNING)
logger = logging.getLogger("pulse_agent")


def build_engine() -> tuple:
    """Instantiate PulseEngine and its dependencies from config (Firestore)."""
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


async def build_engine_in_memory(subject: str = "Mathematics") -> tuple:
    """Instantiate PulseEngine backed by in-memory storage.

    Fetches the curriculum graph from Firestore ONCE, then runs everything
    in-memory. A 15-item session completes in <100ms vs 10-30s with Firestore.

    Args:
        subject: Subject to pre-load the graph for (default: "Mathematics")

    Returns:
        (pulse_engine, in_memory_firestore_service)
    """
    # Fetch graph from real Firestore (one-time bootstrap)
    real_fs = FirestoreService()
    subject_id = subject.upper().replace(" ", "_")
    graph_data = await real_fs.get_curriculum_graph(
        subject_id=subject_id, version_type="published"
    )
    if not graph_data:
        raise ValueError(
            f"No published curriculum graph for {subject_id} in Firestore. "
            f"The in-memory engine needs a real graph to run against."
        )

    # Build in-memory store with the graph pre-loaded
    mem_fs = InMemoryFirestoreService()
    mem_fs.load_curriculum_graph(subject_id, graph_data)

    # Wire up all services with the in-memory store
    calibration_engine = CalibrationEngine(mem_fs)
    mastery_lifecycle_engine = MasteryLifecycleEngine(mem_fs)
    learning_paths_service = LearningPathsService(
        mem_fs, project_id="in-memory"
    )
    pulse_engine = PulseEngine(
        firestore_service=mem_fs,
        calibration_engine=calibration_engine,
        mastery_lifecycle_engine=mastery_lifecycle_engine,
        learning_paths_service=learning_paths_service,
    )

    node_count = len(graph_data.get("graph", {}).get("nodes", []))
    logger.info(
        f"[InMemory] Engine ready: {node_count} nodes for {subject_id}, "
        f"0 Firestore calls from here on"
    )

    return pulse_engine, mem_fs


async def run_single_profile(
    runner: PulseAgentRunner,
    profile: SyntheticProfile,
    session_limit: int | None = None,
    clean: bool = False,
    output_dir: Path | None = None,
    include_graph: bool = False,
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

        # Append graph analysis if requested
        if include_graph:
            print("  Fetching curriculum graph...")
            graph = await runner.fetch_graph(profile.subject)
            graph_section = generate_graph_report(graph, timeline)
            report += "\n\n" + graph_section
            print(f"  Graph: {len(graph['nodes'])} nodes, {len(graph['edges'])} edges")

        save_report(report, output_dir, profile.name.replace(" ", "_"))
        JourneyRecorder.save_timeline(timeline, output_dir)


async def run_all_profiles(
    runner: PulseAgentRunner,
    session_limit: int | None = None,
    clean: bool = False,
    output_dir: Path | None = None,
    include_graph: bool = False,
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

            if include_graph:
                graph = await runner.fetch_graph(timeline.subject)
                graph_section = generate_graph_report(graph, timeline)
                report += "\n\n" + graph_section

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
        "--graph",
        action="store_true",
        help="Include curriculum DAG analysis in the report (nodes, edges, traversal)",
    )
    parser.add_argument(
        "--gap",
        type=float,
        default=1.0,
        help="Simulated days between sessions (default: 1.0)",
    )
    parser.add_argument(
        "--in-memory",
        action="store_true",
        help="Use in-memory storage (fetches graph once, then 0 Firestore calls). ~100x faster.",
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
    if args.in_memory:
        print("[InMemory] Bootstrapping — fetching graph from Firestore once...")
        pulse_engine, firestore_service = asyncio.run(
            build_engine_in_memory(subject="Mathematics")
        )
        # In-memory mode: always clean (start fresh) and skip Firestore cleanup
        args.clean = False
        print("[InMemory] Ready — all subsequent operations are in-memory\n")
    else:
        pulse_engine, firestore_service = build_engine()

    runner = PulseAgentRunner(
        pulse_engine, firestore_service,
        seed=args.seed,
        session_gap_days=args.gap,
    )

    # Run
    if args.all:
        asyncio.run(run_all_profiles(
            runner, args.sessions, args.clean, output_dir,
            include_graph=args.graph,
        ))
    else:
        profile = ALL_PROFILES[args.profile]
        asyncio.run(
            run_single_profile(
                runner, profile, args.sessions, args.clean, output_dir,
                include_graph=args.graph,
            )
        )


if __name__ == "__main__":
    main()
