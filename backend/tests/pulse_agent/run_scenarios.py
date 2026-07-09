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
from tests.pulse_agent.assertions import (
    run_assertions_for_archetype,
    run_truth_assertions,
)
from tests.pulse_agent.journey_recorder import JourneyRecorder
from tests.pulse_agent.truth_model import get_truth_strategy
from tests.pulse_agent.reports import (
    generate_journey_report,
    generate_graph_report,
    generate_comparison_report,
    generate_truth_report,
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


async def build_engine_in_memory(
    subjects: list[str] | None = None,
    grade: str | None = None,
    load_published: bool = False,
) -> tuple:
    """Instantiate PulseEngine backed by in-memory storage.

    Fetches curriculum graphs from Firestore ONCE per subject, then runs
    everything in-memory. A 15-item session completes in <100ms vs 10-30s
    with Firestore.

    Args:
        subjects: Grade-prefixed subject IDs to pre-load (e.g. ["MATHEMATICS_GK"]).
                  Default: ["MATHEMATICS_GK"]

    Returns:
        (pulse_engine, in_memory_firestore_service)
    """
    if not subjects:
        subjects = ["MATHEMATICS_GK"]

    # Fetch graphs from real Firestore (one-time bootstrap)
    real_fs = FirestoreService()
    mem_fs = InMemoryFirestoreService()

    for subject_id in subjects:
        graph_data = await real_fs.get_curriculum_graph(
            subject_id=subject_id, version_type="published"
        )
        if not graph_data:
            raise ValueError(
                f"No published curriculum graph for {subject_id} in Firestore. "
                f"The in-memory engine needs a real graph to run against."
            )
        mem_fs.load_curriculum_graph(subject_id, graph_data)
        node_count = len(graph_data.get("graph", {}).get("nodes", []))
        logger.info(f"[InMemory] Loaded {subject_id}: {node_count} nodes")

        # Full-loop mode also needs the published curriculum doc (hierarchy
        # + subskill_index) for CurriculumService / planning / rollup
        # subject resolution. One extra read per subject at bootstrap.
        if load_published:
            import re as _re
            base_id = _re.sub(r"_G\w+$", "", subject_id)
            doc = None
            for candidate in (base_id, subject_id):
                doc = await real_fs.get_published_curriculum(candidate, grade=grade)
                if doc:
                    mem_fs.load_published_curriculum(candidate, doc)
                    break
            if not doc:
                logger.warning(
                    f"[InMemory] No published curriculum found for "
                    f"{base_id}/{subject_id} (grade={grade}) — planning may be degraded"
                )

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

    logger.info(
        f"[InMemory] Engine ready: {len(subjects)} subject(s) loaded, "
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
    truth: bool = False,
) -> None:
    """Run one profile and print results."""

    if clean:
        await runner.cleanup_student(profile.student_id)

    strategy_override = get_truth_strategy(profile, seed=runner.seed) if truth else None
    timeline = await runner.run_profile(
        profile, strategy_override=strategy_override, session_limit=session_limit
    )

    # Run assertions (truth-model journeys get the estimator-validity suite)
    if truth:
        results = run_truth_assertions(timeline, profile.archetype)
    else:
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

        # Truth-model runs get the Truth vs Estimate section
        if timeline.truth_mode:
            truth_section = generate_truth_report(timeline)
            if truth_section:
                report += "\n\n" + truth_section

        # Append graph analysis if requested
        if include_graph:
            print("  Fetching curriculum graph...")
            graph = await runner.fetch_graph(profile.subject)
            graph_section = generate_graph_report(graph, timeline)
            report += "\n\n" + graph_section
            print(f"  Graph: {len(graph['nodes'])} nodes, {len(graph['edges'])} edges")

        save_report(report, output_dir, profile.name.replace(" ", "_"), subject=profile.subject or "")
        JourneyRecorder.save_timeline(timeline, output_dir)


async def run_all_profiles(
    runner: PulseAgentRunner,
    session_limit: int | None = None,
    clean: bool = False,
    output_dir: Path | None = None,
    include_graph: bool = False,
    truth: bool = False,
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

        strategy_override = get_truth_strategy(profile, seed=runner.seed) if truth else None
        timeline = await runner.run_profile(
            profile, strategy_override=strategy_override, session_limit=session_limit
        )
        timelines.append(timeline)

        if truth:
            results = run_truth_assertions(timeline, profile.archetype)
        else:
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
            if timeline.truth_mode:
                results = run_truth_assertions(timeline, timeline.archetype)
            else:
                results = run_assertions_for_archetype(timeline, timeline.archetype)
            report = generate_journey_report(timeline, results)

            if timeline.truth_mode:
                truth_section = generate_truth_report(timeline)
                if truth_section:
                    report += "\n\n" + truth_section

            if include_graph:
                graph = await runner.fetch_graph(timeline.subject)
                graph_section = generate_graph_report(graph, timeline)
                report += "\n\n" + graph_section

            save_report(report, output_dir, timeline.profile_name.replace(" ", "_"), subject=timeline.subject)
            JourneyRecorder.save_timeline(timeline, output_dir)

        # Use subject from first timeline for the comparison filename
        comp_subject = timelines[0].subject if timelines else ""
        comp_tag = f"_{comp_subject}" if comp_subject else ""
        comp_path = output_dir / f"comparison_report{comp_tag}.md"
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
        "--truth",
        action="store_true",
        help=(
            "Drive scores from the LatentStudent truth model (2PL vs item β, "
            "learning + forgetting) instead of scripted archetype scores. "
            "Enables estimator-validity assertions (θ_est vs θ_true)."
        ),
    )
    parser.add_argument(
        "--loop",
        action="store_true",
        help=(
            "Full student-data-loop journey: each virtual day fetches the "
            "daily plan + selector targets, does the work through the REAL "
            "submission fan-out (attempts → rollups → profile), and audits "
            "the canonical profile serve. Implies --in-memory and the truth "
            "model. Verifies the L2 rebuild contract at journey end."
        ),
    )
    parser.add_argument(
        "--days",
        type=int,
        default=20,
        help="Number of virtual days for --loop mode (default: 20)",
    )
    parser.add_argument(
        "--seed-from",
        type=int,
        default=None,
        help=(
            "Mid-year persona: ONE batched Firestore read of this real "
            "student's docs (ability/lifecycle/attempts/rollups/profile) "
            "seeds the in-memory store, then the journey diverges privately "
            "— zero writes back. Loop mode only."
        ),
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List available profiles and exit",
    )
    parser.add_argument(
        "--subject",
        type=str,
        action="append",
        default=None,
        help=(
            "Base subject name(s) (repeatable). "
            "Examples: --subject Mathematics --subject Science. "
            "Default: Mathematics. "
            "Combined with --grade to form Firestore subject_id "
            "(e.g. Mathematics + grade 1 → MATHEMATICS_G1)."
        ),
    )
    parser.add_argument(
        "--grade",
        type=str,
        default="K",
        help=(
            "Grade level. Combined with --subject to form the Firestore "
            "subject_id. Examples: K → MATHEMATICS_GK, 1 → MATHEMATICS_G1. "
            "Default: K (kindergarten)"
        ),
    )

    args = parser.parse_args()

    # Normalise subjects — default to Mathematics for backward compat
    if not args.subject:
        args.subject = ["Mathematics"]

    # Build grade-prefixed subject IDs matching Firestore flat cache naming:
    #   Kindergarten/K → _GK,  1 → _G1,  2 → _G2
    grade_raw = args.grade.strip()
    if grade_raw.lower() in ("k", "kindergarten"):
        grade_suffix = "_GK"
    else:
        grade_suffix = f"_G{grade_raw}"

    # Construct full Firestore subject_ids (e.g. "MATHEMATICS_GK", "SCIENCE_G1")
    args.subject_ids = [
        s.upper().replace(" ", "_") + grade_suffix for s in args.subject
    ]

    if args.list:
        print("\nAvailable profiles:")
        print("-" * 60)
        for name, p in ALL_PROFILES.items():
            print(f"  {name:20s} — {p.description}")
        print(f"\nGrade: {grade_raw} (suffix: {grade_suffix})")
        print(f"Subject(s): {', '.join(args.subject_ids)}")
        print("  Use --subject <name> --grade <N> to change")
        return

    if not args.profile and not args.all:
        parser.error("Specify --profile <name> or --all")

    # Full-loop mode is in-memory ONLY (a loop day fans each attempt into
    # ~6 doc writes — real Firestore I/O would be absurd and slow).
    if args.loop:
        args.in_memory = True

    # Build output dir with grade subfolder: reports/GK/, reports/G1/, etc.
    output_dir = Path(args.output) / grade_suffix.lstrip("_") if args.output else None

    # Build engine
    if args.in_memory:
        subjects_str = ", ".join(args.subject_ids)
        print(f"[InMemory] Bootstrapping — fetching graph(s) for: {subjects_str}...")
        pulse_engine, firestore_service = asyncio.run(
            build_engine_in_memory(
                subjects=args.subject_ids,
                grade=grade_raw,
                load_published=args.loop,
            )
        )
        # In-memory mode: always clean (start fresh) and skip Firestore cleanup
        args.clean = False
        print("[InMemory] Ready — all subsequent operations are in-memory\n")
    else:
        pulse_engine, firestore_service = build_engine()

    # ── Full-loop mode dispatch ──────────────────────────────────────────
    if args.loop:
        from tests.pulse_agent.full_loop import (
            FullLoopRunner,
            generate_loop_report,
            run_loop_assertions,
            save_loop_timeline,
            seed_from_student,
        )
        from tests.pulse_agent.html_report import generate_loop_html

        loop_runner = FullLoopRunner(firestore_service, pulse_engine, seed=args.seed)
        profiles = (
            list(ALL_PROFILES.values()) if args.all else [ALL_PROFILES[args.profile]]
        )

        # ONE journey per profile across ALL subjects — a real daily session
        # spans 3-4 subjects; the planner allocates each day across them.
        subject_tag = (
            args.subject_ids[0] if len(args.subject_ids) == 1
            else "MULTI" + grade_suffix
        )
        for profile in profiles:
            profile.subject = args.subject_ids[0]
            print(f"\n{'─'*60}")
            print(f"  Loop journey: {profile.name} — "
                  f"{', '.join(args.subject_ids)}, {args.days} days")
            print(f"{'─'*60}")

            if args.seed_from:
                print(f"  Seeding from real student {args.seed_from} (one batched read)...")
                real_fs = FirestoreService()
                counts = asyncio.run(seed_from_student(
                    real_fs, firestore_service, args.seed_from, profile.student_id
                ))
                print(f"  Seeded: {counts}")

            timeline = asyncio.run(loop_runner.run_profile(
                profile,
                days=args.days,
                grade=grade_raw,
                seeded_from=args.seed_from,
                subjects=args.subject_ids,
            ))

            results = run_loop_assertions(timeline)
            print(f"\n  {profile.name}: {timeline.total_items} items over {len(timeline.days)} days")
            all_passed = True
            for r in results:
                icon = "PASS" if r.passed else "FAIL"
                print(f"  [{icon}] {r.name}: {r.message}")
                all_passed = all_passed and r.passed
            print(f"\n  >> {'ALL LOOP ASSERTIONS PASSED' if all_passed else 'SOME LOOP ASSERTIONS FAILED'}")

            if output_dir:
                report = generate_loop_report(timeline, results)
                output_dir.mkdir(parents=True, exist_ok=True)
                name = profile.name.replace(" ", "_")
                path = output_dir / f"loop_report_{name}_{subject_tag}.md"
                path.write_text(report, encoding="utf-8")
                save_loop_timeline(timeline, output_dir)
                html_path = generate_loop_html(timeline, results, output_dir)
                print(f"  Report: {path}")
                print(f"  HTML:   {html_path}")

            firestore_service.clear_student(profile.student_id)
        return

    runner = PulseAgentRunner(
        pulse_engine, firestore_service,
        seed=args.seed,
        session_gap_days=args.gap,
    )

    # Run each subject_id independently so reports are per-subject
    for subject_id in args.subject_ids:
        if len(args.subject_ids) > 1:
            print(f"\n{'━'*60}")
            print(f"  Subject: {subject_id}")
            print(f"{'━'*60}")

        if args.all:
            for p in ALL_PROFILES.values():
                p.subject = subject_id
            asyncio.run(run_all_profiles(
                runner, args.sessions, args.clean, output_dir,
                include_graph=args.graph, truth=args.truth,
            ))
        else:
            profile = ALL_PROFILES[args.profile]
            profile.subject = subject_id
            asyncio.run(
                run_single_profile(
                    runner, profile, args.sessions, args.clean, output_dir,
                    include_graph=args.graph, truth=args.truth,
                )
            )


if __name__ == "__main__":
    main()
