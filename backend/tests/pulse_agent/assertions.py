"""
Progression Assertions
======================

Validation rules that check whether a synthetic student's journey makes sense.
Each assertion returns a pass/fail result with an explanation.

Run after a journey completes to flag unexpected behavior in the Pulse engine.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

from .journey_recorder import JourneyTimeline

logger = logging.getLogger(__name__)


@dataclass
class AssertionResult:
    """Result of a single assertion check."""
    name: str
    passed: bool
    message: str
    details: Dict[str, Any] = field(default_factory=dict)


# ── Assertion functions ─────────────────────────────────────────────────────


def assert_leapfrog_count(
    timeline: JourneyTimeline,
    min_leapfrogs: int = 0,
    max_leapfrogs: Optional[int] = None,
) -> AssertionResult:
    """Check that leapfrog count is within expected range."""
    actual = timeline.total_leapfrogs
    in_range = actual >= min_leapfrogs
    if max_leapfrogs is not None:
        in_range = in_range and actual <= max_leapfrogs

    return AssertionResult(
        name="leapfrog_count",
        passed=in_range,
        message=(
            f"Leapfrogs: {actual} "
            f"(expected {min_leapfrogs}-{max_leapfrogs or 'inf'})"
        ),
        details={"actual": actual, "min": min_leapfrogs, "max": max_leapfrogs},
    )


def assert_gate_progression(
    timeline: JourneyTimeline,
    min_gate_advances: int = 0,
) -> AssertionResult:
    """Check that at least N gate advances occurred."""
    actual = timeline.total_gate_advances
    return AssertionResult(
        name="gate_progression",
        passed=actual >= min_gate_advances,
        message=f"Gate advances: {actual} (expected >= {min_gate_advances})",
        details={"actual": actual, "min": min_gate_advances},
    )


def assert_theta_trend(
    timeline: JourneyTimeline,
    direction: str = "increasing",  # "increasing" | "decreasing" | "stable"
    tolerance: float = 0.5,
) -> AssertionResult:
    """
    Check that the average θ across all tracked skills trends in the
    expected direction over the journey.
    """
    if len(timeline.sessions) < 2:
        return AssertionResult(
            name="theta_trend",
            passed=True,
            message="Not enough sessions to check trend",
        )

    # Compute avg θ per session
    avg_thetas = []
    for session in timeline.sessions:
        thetas = [
            ab["theta"] for ab in session.ability_snapshot.values()
            if "theta" in ab
        ]
        if thetas:
            avg_thetas.append(sum(thetas) / len(thetas))

    if len(avg_thetas) < 2:
        return AssertionResult(
            name="theta_trend",
            passed=True,
            message="Not enough θ data to check trend",
        )

    first_half = avg_thetas[: len(avg_thetas) // 2]
    second_half = avg_thetas[len(avg_thetas) // 2 :]
    first_avg = sum(first_half) / len(first_half)
    second_avg = sum(second_half) / len(second_half)
    delta = second_avg - first_avg

    if direction == "increasing":
        passed = delta > -tolerance  # Allow small dips
    elif direction == "decreasing":
        passed = delta < tolerance
    else:  # stable
        passed = abs(delta) < tolerance

    return AssertionResult(
        name="theta_trend",
        passed=passed,
        message=(
            f"θ trend: {direction}, Δ={delta:+.2f} "
            f"(first half avg={first_avg:.2f}, second half avg={second_avg:.2f})"
        ),
        details={
            "direction": direction,
            "delta": delta,
            "first_half_avg": first_avg,
            "second_half_avg": second_avg,
        },
    )


def assert_no_stuck_skills(
    timeline: JourneyTimeline,
    max_sessions_at_gate_0: int = 10,
) -> AssertionResult:
    """
    Check that no subskill stays at gate 0 for more than N sessions
    after being first encountered.
    """
    # Track when each subskill was first seen and its gate per session
    first_seen: Dict[str, int] = {}
    stuck_skills: List[str] = []

    for session in timeline.sessions:
        for subskill_id, lc in session.mastery_snapshot.items():
            sn = session.session_number
            if subskill_id not in first_seen:
                first_seen[subskill_id] = sn

            gate = lc.get("current_gate", 0)
            sessions_since = sn - first_seen[subskill_id]
            if gate == 0 and sessions_since >= max_sessions_at_gate_0:
                if subskill_id not in stuck_skills:
                    stuck_skills.append(subskill_id)

    return AssertionResult(
        name="no_stuck_skills",
        passed=len(stuck_skills) == 0,
        message=(
            f"Stuck at gate 0 for >{max_sessions_at_gate_0} sessions: "
            f"{len(stuck_skills)} skills"
            + (f" ({', '.join(stuck_skills[:5])})" if stuck_skills else "")
        ),
        details={"stuck_skills": stuck_skills},
    )


def assert_cold_start_frontier_heavy(
    timeline: JourneyTimeline,
) -> AssertionResult:
    """First session of a cold-start student should be mostly frontier probes."""
    if not timeline.sessions:
        return AssertionResult(
            name="cold_start_frontier",
            passed=False,
            message="No sessions recorded",
        )

    first = timeline.sessions[0]
    if not first.is_cold_start:
        return AssertionResult(
            name="cold_start_frontier",
            passed=True,
            message="Not a cold-start session, skipping",
        )

    frontier_count = first.band_counts.get("frontier", 0)
    total = sum(first.band_counts.values())
    pct = frontier_count / total if total > 0 else 0

    return AssertionResult(
        name="cold_start_frontier",
        passed=pct >= 0.8,
        message=(
            f"Cold start frontier %: {pct:.0%} "
            f"({frontier_count}/{total}, expected ≥80%)"
        ),
        details={"frontier_count": frontier_count, "total": total, "pct": pct},
    )


def assert_struggling_no_leapfrog(
    timeline: JourneyTimeline,
) -> AssertionResult:
    """Struggling students should never leapfrog (scores too low)."""
    actual = timeline.total_leapfrogs
    return AssertionResult(
        name="struggling_no_leapfrog",
        passed=actual == 0,
        message=f"Struggling student leapfrogs: {actual} (expected 0)",
        details={"actual": actual},
    )


def assert_skill_diversity(
    timeline: JourneyTimeline,
    min_unique_skills: int = 3,
) -> AssertionResult:
    """Check that the student encountered a minimum number of distinct skills."""
    actual = timeline.unique_skills_touched
    return AssertionResult(
        name="skill_diversity",
        passed=actual >= min_unique_skills,
        message=f"Unique skills touched: {actual} (expected >= {min_unique_skills})",
        details={"actual": actual, "min": min_unique_skills},
    )


# ── Assertion suites per archetype ──────────────────────────────────────────


def run_assertions_for_archetype(
    timeline: JourneyTimeline,
    archetype: str,
) -> List[AssertionResult]:
    """Run the appropriate assertion suite for a given archetype."""
    results: List[AssertionResult] = []

    # Universal assertions
    results.append(assert_skill_diversity(timeline, min_unique_skills=2))

    if archetype == "gifted":
        results.append(assert_leapfrog_count(timeline, min_leapfrogs=1))
        results.append(assert_gate_progression(timeline, min_gate_advances=3))
        results.append(assert_theta_trend(timeline, direction="increasing"))

    elif archetype == "steady":
        results.append(assert_leapfrog_count(timeline, min_leapfrogs=0, max_leapfrogs=2))
        results.append(assert_gate_progression(timeline, min_gate_advances=1))
        results.append(assert_theta_trend(timeline, direction="increasing"))

    elif archetype == "struggling":
        results.append(assert_struggling_no_leapfrog(timeline))
        results.append(assert_theta_trend(timeline, direction="stable", tolerance=1.5))

    elif archetype == "cold_start":
        results.append(assert_cold_start_frontier_heavy(timeline))

    elif archetype == "accelerating":
        results.append(assert_theta_trend(timeline, direction="increasing"))
        results.append(assert_gate_progression(timeline, min_gate_advances=2))

    elif archetype == "selective_weakness":
        results.append(assert_theta_trend(timeline, direction="increasing"))

    else:
        logger.warning(f"No assertion suite for archetype '{archetype}'")

    return results
