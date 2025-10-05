"""
Content Operations CLI

Main command-line interface for the content evaluation framework.
Orchestrates the three-tier evaluation pipeline and generates reports.
"""

import asyncio
import logging
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional, List
import json

import typer
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table
from rich.logging import RichHandler
from dotenv import load_dotenv

from api_client import BackendAPIClient
from evaluation.structural_validator import StructuralValidator
from evaluation.heuristics_validator import HeuristicValidator
from evaluation.llm_judge import GeminiJudge
from evaluation.rubrics import EvaluationReport

# Load environment variables
load_dotenv()

# Initialize Typer app and Rich console
app = typer.Typer(
    name="content-ops",
    help="Content Quality Evaluation Framework for Educational Content Generation"
)
console = Console()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    handlers=[RichHandler(console=console, rich_tracebacks=True)]
)
logger = logging.getLogger(__name__)


# ============================================================================
# MAIN COMMANDS
# ============================================================================

@app.command()
def test_generation(
    subject: Optional[str] = typer.Option(None, help="Subject to test (e.g., 'math')"),
    skill_id: Optional[str] = typer.Option(None, help="Specific skill ID to test"),
    subskill_id: Optional[str] = typer.Option(None, help="Specific subskill ID to test"),
    grade: Optional[str] = typer.Option(None, help="Filter by grade level (e.g., 'K', '1')"),
    max_tests: int = typer.Option(10, help="Maximum number of problems to test"),
    model: str = typer.Option("flash", help="Gemini model to use: 'flash' or 'flash-lite'"),
    skip_llm: bool = typer.Option(False, help="Skip LLM evaluation (Tier 3) for faster testing"),
    output_dir: Path = typer.Option(Path("reports"), help="Output directory for reports"),
    backend_url: Optional[str] = typer.Option(None, help="Backend API URL"),
    all_subjects: bool = typer.Option(False, help="Test all available subjects")
):
    """
    Test content generation quality across curriculum

    This command orchestrates the complete evaluation pipeline:
    1. Fetch curriculum structure from backend
    2. Generate problems for each skill/subskill
    3. Run three-tier evaluation (structural, heuristic, LLM)
    4. Export comprehensive CSV report
    """
    asyncio.run(_run_test_generation(
        subject=subject,
        skill_id=skill_id,
        subskill_id=subskill_id,
        grade=grade,
        max_tests=max_tests,
        model=model,
        skip_llm=skip_llm,
        output_dir=output_dir,
        backend_url=backend_url,
        all_subjects=all_subjects
    ))


@app.command()
def list_curriculum(
    subject: Optional[str] = typer.Option(None, help="Filter by subject"),
    backend_url: Optional[str] = typer.Option(None, help="Backend API URL")
):
    """
    List available curriculum structure from backend
    """
    asyncio.run(_run_list_curriculum(subject=subject, backend_url=backend_url))


@app.command()
def health_check(
    backend_url: Optional[str] = typer.Option(None, help="Backend API URL")
):
    """
    Check backend API connectivity
    """
    asyncio.run(_run_health_check(backend_url=backend_url))


# ============================================================================
# COMMAND IMPLEMENTATIONS
# ============================================================================

async def _run_test_generation(
    subject: Optional[str],
    skill_id: Optional[str],
    subskill_id: Optional[str],
    grade: Optional[str],
    max_tests: int,
    model: str,
    skip_llm: bool,
    output_dir: Path,
    backend_url: Optional[str],
    all_subjects: bool
):
    """Main test generation orchestration"""
    console.print("\n[bold cyan]Content Generation Quality Test[/bold cyan]\n")

    # Initialize services
    console.print("[yellow]Initializing services...[/yellow]")
    api_client = BackendAPIClient(base_url=backend_url)
    structural_validator = StructuralValidator()
    heuristic_validator = HeuristicValidator()
    llm_judge = GeminiJudge(model=model) if not skip_llm else None

    # Check backend health
    if not await api_client.health_check():
        console.print("[bold red]❌ Backend health check failed. Is the server running?[/bold red]")
        raise typer.Exit(1)

    console.print("[green]✓ Backend connected[/green]")

    # Fetch curriculum
    console.print("[yellow]Fetching curriculum structure...[/yellow]")

    if all_subjects:
        testable_nodes = await api_client.get_full_curriculum_tree()
    elif subject:
        testable_nodes = await api_client.get_full_curriculum_tree(subjects=[subject])
    else:
        console.print("[red]Error: Must specify --subject or --all-subjects[/red]")
        raise typer.Exit(1)

    # Filter by skill_id, subskill_id, grade if specified
    if skill_id:
        testable_nodes = [n for n in testable_nodes if n["skill_id"] == skill_id]
    if subskill_id:
        testable_nodes = [n for n in testable_nodes if n["subskill_id"] == subskill_id]
    if grade:
        testable_nodes = [n for n in testable_nodes if n["grade_level"] == grade]

    # Limit to max_tests
    testable_nodes = testable_nodes[:max_tests]

    console.print(f"[green]✓ Found {len(testable_nodes)} testable curriculum nodes[/green]\n")

    if len(testable_nodes) == 0:
        console.print("[yellow]No curriculum nodes match your filters.[/yellow]")
        raise typer.Exit(0)

    # Run evaluation pipeline
    evaluation_reports: List[EvaluationReport] = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console
    ) as progress:
        task = progress.add_task(
            f"Evaluating curriculum nodes...",
            total=len(testable_nodes)
        )

        for i, node in enumerate(testable_nodes):
            progress.update(
                task,
                description=f"[{i+1}/{len(testable_nodes)}] {node['subject']} - {node['subskill_id']}"
            )

            try:
                # _evaluate_single_node now returns a list of reports (one per problem)
                reports = await _evaluate_single_node(
                    node,
                    api_client,
                    structural_validator,
                    heuristic_validator,
                    llm_judge
                )
                # Flatten the list of reports into the main evaluation_reports list
                evaluation_reports.extend(reports)
                logger.info(f"Added {len(reports)} reports from {node['subskill_id']} (total: {len(evaluation_reports)})")

            except Exception as e:
                logger.error(f"Failed to evaluate {node['subskill_id']}: {str(e)}")

            progress.advance(task)

    # Generate report
    console.print(f"\n[green]✓ Evaluation complete: {len(evaluation_reports)} problems evaluated[/green]\n")

    # Display summary
    _display_summary(evaluation_reports)

    # Export to CSV
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_path = output_dir / f"eval-{timestamp}.csv"

    _export_to_csv(evaluation_reports, csv_path)
    console.print(f"\n[bold green]✓ Report exported to: {csv_path}[/bold green]")

    await api_client.close()


async def _evaluate_single_node(
    node: dict,
    api_client: BackendAPIClient,
    structural_validator: StructuralValidator,
    heuristic_validator: HeuristicValidator,
    llm_judge: Optional[GeminiJudge]
) -> List[EvaluationReport]:
    """
    Evaluate a single curriculum node through all three tiers.

    Returns a list of EvaluationReports (one per generated problem).
    When count=5, this returns 5 reports.
    """

    # Step 1: Generate problems
    start_time = datetime.now()

    try:
        problem_data = await api_client.generate_problem_for_skill(
            subject=node["subject"],
            unit_id=node["unit_id"],
            skill_id=node["skill_id"],
            subskill_id=node["subskill_id"],
            count=5
        )

        # Log the received data
        logger.info(f"Received problem_data type: {type(problem_data)}")

        # Normalize to list for uniform processing
        if isinstance(problem_data, list):
            problems = problem_data
            logger.info(f"Got list response with {len(problems)} problems")
        else:
            problems = [problem_data] if problem_data else []
            logger.info(f"Got single problem response, normalized to list")

        # Save all problems to disk for debugging
        for idx, prob in enumerate(problems):
            _save_problem_to_disk(prob, node, problem_index=idx+1)

        generation_time_ms = (datetime.now() - start_time).total_seconds() * 1000
        generation_successful = len(problems) > 0

    except Exception as e:
        logger.error(f"Problem generation failed: {str(e)}", exc_info=True)
        problems = []
        generation_time_ms = None
        generation_successful = False

    # If generation failed, create a single minimal report
    if not generation_successful:
        from evaluation.rubrics import StructuralResult, HeuristicReport, VisualCoherence
        return [EvaluationReport(
            problem_id="generation_failed",
            problem_type="unknown",
            subject=node["subject"],
            skill_id=node["skill_id"],
            subskill_id=node["subskill_id"],
            grade_level=node["grade_level"],
            generation_successful=False,
            generation_time_ms=generation_time_ms,
            structural_validation=StructuralResult(
                passed=False,
                issues=["Problem generation failed"],
                required_fields_present=False,
                valid_enums=False,
                valid_types=False
            ),
            heuristics=HeuristicReport(
                readability_score=0,
                readability_appropriate=False,
                has_placeholders=False,
                total_char_count=0,
                word_count=0,
                visual_coherence=VisualCoherence(
                    passes_constraints=False,
                    max_char_count=0,
                    longest_word_length=0,
                    max_line_breaks=0,
                    has_overflow_risk=False,
                    has_forbidden_content=False,
                    issues=[]
                ),
                passed=False,
                warnings=[],
                failures=["Problem generation failed"]
            ),
            llm_judgment=None,
            final_recommendation="reject",
            raw_problem_json=None
        )]

    # Evaluate each problem through all three tiers
    reports = []
    for idx, problem in enumerate(problems):
        logger.info(f"Evaluating problem {idx+1}/{len(problems)} for {node['subskill_id']}")

        # Log details about the problem being evaluated
        if problem:
            logger.info(f"Problem keys: {list(problem.keys())}")
            logger.info(f"Has question_visual_intent: {'question_visual_intent' in problem}")
            logger.info(f"Has statement_visual_intent: {'statement_visual_intent' in problem}")

        # Step 2: Tier 1 - Structural Validation
        structural_result = structural_validator.validate(problem)

        # Step 3: Tier 2 - Heuristic Validation
        heuristic_result = heuristic_validator.validate(problem, node["grade_level"])

        # Step 4: Tier 3 - LLM Judgment (optional)
        llm_judgment = None
        if llm_judge and structural_result.passed:
            try:
                llm_judgment = await llm_judge.evaluate_problem(problem, node)
            except Exception as e:
                logger.error(f"LLM evaluation failed for problem {idx+1}: {str(e)}")

        # Create evaluation report
        report = EvaluationReport(
            problem_id=problem.get("id", f"unknown_{idx}"),
            problem_type=_detect_problem_type(problem),
            subject=node["subject"],
            skill_id=node["skill_id"],
            subskill_id=node["subskill_id"],
            grade_level=node["grade_level"],
            generation_successful=True,
            generation_time_ms=generation_time_ms / len(problems),  # Distribute time across problems
            structural_validation=structural_result,
            heuristics=heuristic_result,
            llm_judgment=llm_judgment,
            final_recommendation="approve",  # Will be calculated
            raw_problem_json=json.dumps(problem, indent=2)
        )

        # Calculate final recommendation
        report.final_recommendation = report.determine_final_recommendation()
        report.overall_score = report.calculate_overall_score()

        reports.append(report)

    logger.info(f"Generated {len(reports)} evaluation reports for {node['subskill_id']}")
    return reports


def _detect_problem_type(problem: dict) -> str:
    """Detect problem type from structure or metadata"""
    # First check if problem_type is explicitly set in the problem dict
    if "problem_type" in problem:
        return problem.get("problem_type")

    # Fall back to structural detection
    if "options" in problem:
        return "multiple_choice"
    elif "correct" in problem:
        return "true_false"
    else:
        return "unknown"


def _save_problem_to_disk(problem: dict, node: dict, problem_index: int = None):
    """Save generated problem to disk for debugging"""
    # Create debug directory
    debug_dir = Path("debug_problems")
    debug_dir.mkdir(exist_ok=True)

    # Create filename from node info
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    index_suffix = f"_p{problem_index}" if problem_index is not None else ""
    filename = f"{timestamp}_{node['subject']}_{node['subskill_id']}{index_suffix}.json"
    filepath = debug_dir / filename

    # Save problem with metadata
    debug_data = {
        "node": node,
        "problem": problem,
        "timestamp": timestamp
    }

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(debug_data, f, indent=2, ensure_ascii=False)

    logger.info(f"Saved problem to {filepath}")


def _display_summary(reports: List[EvaluationReport]):
    """Display summary table of evaluation results"""
    table = Table(title="Evaluation Summary")

    table.add_column("Metric", style="cyan")
    table.add_column("Count", justify="right", style="green")

    total = len(reports)
    passed_structural = sum(1 for r in reports if r.structural_validation.passed)
    passed_heuristics = sum(1 for r in reports if r.heuristics.passed)
    approved = sum(1 for r in reports if r.final_recommendation == "approve")
    needs_revision = sum(1 for r in reports if r.final_recommendation == "revise")
    rejected = sum(1 for r in reports if r.final_recommendation == "reject")

    if any(r.llm_judgment for r in reports):
        avg_approach = sum(r.llm_judgment.pedagogical_approach_score for r in reports if r.llm_judgment) / sum(1 for r in reports if r.llm_judgment)
        avg_alignment = sum(r.llm_judgment.alignment_score for r in reports if r.llm_judgment) / sum(1 for r in reports if r.llm_judgment)
        avg_clarity = sum(r.llm_judgment.clarity_score for r in reports if r.llm_judgment) / sum(1 for r in reports if r.llm_judgment)
        avg_correctness = sum(r.llm_judgment.correctness_score for r in reports if r.llm_judgment) / sum(1 for r in reports if r.llm_judgment)

    table.add_row("Total Problems Evaluated", str(total))
    table.add_row("Passed Structural Validation", f"{passed_structural} ({passed_structural/total*100:.1f}%)")
    table.add_row("Passed Heuristic Validation", f"{passed_heuristics} ({passed_heuristics/total*100:.1f}%)")
    table.add_row("", "")
    table.add_row("✅ Approved", f"{approved} ({approved/total*100:.1f}%)")
    table.add_row("⚠️  Needs Revision", f"{needs_revision} ({needs_revision/total*100:.1f}%)")
    table.add_row("❌ Rejected", f"{rejected} ({rejected/total*100:.1f}%)")

    if any(r.llm_judgment for r in reports):
        table.add_row("", "")
        table.add_row("Avg Pedagogical Approach Score", f"{avg_approach:.2f}/10")
        table.add_row("Avg Alignment Score", f"{avg_alignment:.2f}/10")
        table.add_row("Avg Clarity Score", f"{avg_clarity:.2f}/10")
        table.add_row("Avg Correctness Score", f"{avg_correctness:.2f}/10")

    console.print(table)


def _export_to_csv(reports: List[EvaluationReport], output_path: Path):
    """Export evaluation reports to CSV"""
    import pandas as pd

    rows = []
    for report in reports:
        row = {
            # Curriculum
            "subject": report.subject,
            "skill_id": report.skill_id,
            "subskill_id": report.subskill_id,
            "grade_level": report.grade_level,

            # Generation
            "problem_id": report.problem_id,
            "problem_type": report.problem_type,
            "generation_successful": report.generation_successful,
            "generation_time_ms": report.generation_time_ms,

            # Tier 1
            "tier1_pass": report.structural_validation.passed,
            "tier1_issues": "; ".join(report.structural_validation.issues),

            # Tier 2
            "tier2_pass": report.heuristics.passed,
            "readability_score": report.heuristics.readability_score,
            "total_char_count": report.heuristics.total_char_count,
            "visual_coherence_pass": report.heuristics.visual_coherence.passes_constraints,
            "visual_overflow_risk": report.heuristics.visual_coherence.has_overflow_risk,
            "tier2_issues": "; ".join(report.heuristics.failures),

            # Tier 3
            "pedagogical_approach_score": report.llm_judgment.pedagogical_approach_score if report.llm_judgment else None,
            "alignment_score": report.llm_judgment.alignment_score if report.llm_judgment else None,
            "clarity_score": report.llm_judgment.clarity_score if report.llm_judgment else None,
            "correctness_score": report.llm_judgment.correctness_score if report.llm_judgment else None,
            "bias_score": report.llm_judgment.bias_score if report.llm_judgment else None,
            "overall_quality": report.llm_judgment.overall_quality if report.llm_judgment else None,
            "recommended_action": report.llm_judgment.recommended_action if report.llm_judgment else None,
            "reasoning": report.llm_judgment.reasoning if report.llm_judgment else None,
            "pedagogical_approach_justification": report.llm_judgment.pedagogical_approach_justification if report.llm_judgment else None,
            "alignment_justification": report.llm_judgment.alignment_justification if report.llm_judgment else None,

            # Final
            "final_recommendation": report.final_recommendation,
            "overall_score": report.overall_score
        }
        rows.append(row)

    df = pd.DataFrame(rows)
    df.to_csv(output_path, index=False)


async def _run_list_curriculum(subject: Optional[str], backend_url: Optional[str]):
    """List curriculum structure"""
    console.print("\n[bold cyan]Curriculum Structure[/bold cyan]\n")

    api_client = BackendAPIClient(base_url=backend_url)

    if not await api_client.health_check():
        console.print("[bold red]❌ Backend health check failed[/bold red]")
        raise typer.Exit(1)

    if subject:
        subjects = [subject]
    else:
        subjects = await api_client.get_available_subjects()

    for subj in subjects:
        curriculum = await api_client.get_curriculum(subj)
        console.print(f"\n[bold green]{subj.upper()}[/bold green]")

        for unit in curriculum:
            console.print(f"  📦 {unit['title']}")
            for skill in unit.get("skills", []):
                console.print(f"    ⚙️  {skill['description']}")
                for subskill in skill.get("subskills", []):
                    console.print(f"      • {subskill['id']}: {subskill['description']}")

    await api_client.close()


async def _run_health_check(backend_url: Optional[str]):
    """Check backend health"""
    console.print("\n[bold cyan]Backend Health Check[/bold cyan]\n")

    api_client = BackendAPIClient(base_url=backend_url)

    if await api_client.health_check():
        console.print("[bold green]✓ Backend is healthy[/bold green]")
    else:
        console.print("[bold red]❌ Backend health check failed[/bold red]")

    await api_client.close()


# ============================================================================
# ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    app()
