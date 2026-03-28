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
    """First session of a cold-start student should be mostly frontier probes.

    With the unified selector, cold-start students have maximum σ on all skills,
    so utility is dominated by urgency — frontier items naturally dominate.
    """
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


def assert_inferred_skills_tested(
    timeline: JourneyTimeline,
    min_inferred_test_pct: float = 0.10,
) -> AssertionResult:
    """Check that leapfrog-unlocked skills eventually appear in sessions.

    Leapfrog now only seeds competency docs for unlock propagation — inferred
    skills stay ``not_started`` (no fabricated lifecycle docs) until tested.
    The unified selector should naturally pick them up because their high σ
    (uncertainty) produces high utility = information(θ,a,b) × urgency(σ).

    This assertion tracks:
    - frontier_subskills: subskills the student actually faced as frontier probes
    - inferred_subskills: subskills that appear in mastery snapshots but were
      never served as frontier probes (they were unlocked via leapfrog)
    - tested_inferred: unlocked subskills that later appeared as session items

    The assertion passes if >= min_inferred_test_pct of unlocked skills were
    eventually selected by the unified utility scorer.
    """
    # Collect subskills seen as frontier probes (directly tested)
    frontier_subskills: set = set()
    # Collect all subskills seen as current/review (directly practiced)
    practiced_subskills: set = set()

    for session in timeline.sessions:
        for item in session.items:
            if item.band == "frontier":
                frontier_subskills.add(item.subskill_id)
            else:
                practiced_subskills.add(item.subskill_id)

    # Inferred = in final mastery snapshot but never served as frontier
    all_known = set(timeline.latest_mastery().keys())
    inferred_subskills = all_known - frontier_subskills

    if not inferred_subskills:
        return AssertionResult(
            name="inferred_skills_tested",
            passed=True,
            message="No inferred skills to validate (no leapfrogs occurred)",
        )

    # How many inferred skills were eventually served as current/review?
    tested_inferred = inferred_subskills & practiced_subskills
    test_pct = len(tested_inferred) / len(inferred_subskills)

    return AssertionResult(
        name="inferred_skills_tested",
        passed=test_pct >= min_inferred_test_pct,
        message=(
            f"Inferred skills tested: {len(tested_inferred)}/{len(inferred_subskills)} "
            f"({test_pct:.0%}, expected >= {min_inferred_test_pct:.0%})"
        ),
        details={
            "total_known": len(all_known),
            "frontier_tested": len(frontier_subskills),
            "inferred_count": len(inferred_subskills),
            "inferred_tested": len(tested_inferred),
            "test_pct": test_pct,
        },
    )


def assert_prereq_gap_detection(
    timeline: JourneyTimeline,
    max_consecutive_inferred_fails: int = 3,
) -> AssertionResult:
    """Check whether the unified selector naturally deprioritises weak roots.

    When a student consistently fails on leapfrog-unlocked skills, the unified
    utility function should self-correct: θ drops on those skills → lower
    Fisher information at current difficulty → utility falls → selector
    shifts toward higher-information items (including frontier probes on
    genuinely uncertain prerequisites).

    This assertion fails if:
    - The student fails >= max_consecutive_inferred_fails unlocked items in a
      row (score < 7.0 on items that were never frontier-probed) WITHOUT the
      engine responding by presenting frontier probes in subsequent sessions.
    """
    # Track frontier subskills
    frontier_subskills: set = set()
    consecutive_inferred_fails = 0
    max_seen = 0
    frontier_response_detected = False

    for session in timeline.sessions:
        session_frontier_count = session.band_counts.get("frontier", 0)

        for item in session.items:
            if item.band == "frontier":
                frontier_subskills.add(item.subskill_id)
                continue

            # Current or review item that was never a frontier probe
            if item.subskill_id not in frontier_subskills:
                if item.score < 7.0:
                    consecutive_inferred_fails += 1
                    max_seen = max(max_seen, consecutive_inferred_fails)
                else:
                    consecutive_inferred_fails = 0

        # After seeing failures, check if next session adds more frontier probes
        if max_seen >= max_consecutive_inferred_fails and session_frontier_count > 0:
            frontier_response_detected = True

    if max_seen < max_consecutive_inferred_fails:
        return AssertionResult(
            name="prereq_gap_detection",
            passed=True,
            message=(
                f"No sustained prereq gaps detected "
                f"(max consecutive inferred fails: {max_seen})"
            ),
            details={"max_consecutive_fails": max_seen},
        )

    return AssertionResult(
        name="prereq_gap_detection",
        passed=frontier_response_detected,
        message=(
            f"Prereq gap {'detected and addressed' if frontier_response_detected else 'NOT addressed'}: "
            f"{max_seen} consecutive inferred fails, "
            f"frontier response={'yes' if frontier_response_detected else 'no'}"
        ),
        details={
            "max_consecutive_fails": max_seen,
            "frontier_response": frontier_response_detected,
        },
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
        results.append(assert_leapfrog_count(timeline, min_leapfrogs=0, max_leapfrogs=50))
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

    elif archetype == "forgetful":
        results.append(assert_leapfrog_count(timeline, min_leapfrogs=0, max_leapfrogs=50))
        results.append(assert_gate_progression(timeline, min_gate_advances=1))
        results.append(assert_theta_trend(timeline, direction="increasing"))

    elif archetype == "selective_weakness":
        results.append(assert_theta_trend(timeline, direction="increasing"))

    elif archetype == "shallow_roots":
        # Leapfrogs should still fire (frontier scores are high)
        results.append(assert_leapfrog_count(timeline, min_leapfrogs=1))
        # The key test: does the engine validate inferred skills?
        # With 20 sessions, at least 10% of inferred skills should be tested.
        results.append(assert_inferred_skills_tested(timeline, min_inferred_test_pct=0.10))
        # Does the engine detect the weak-roots pattern and respond?
        results.append(assert_prereq_gap_detection(timeline, max_consecutive_inferred_fails=3))
        # Gate progression should still happen (the student IS learning)
        results.append(assert_gate_progression(timeline, min_gate_advances=3))

    elif archetype == "regressing":
        # θ should decline as scores drop
        results.append(assert_theta_trend(timeline, direction="decreasing", tolerance=0.3))
        # Few leapfrogs — early sessions are strong but decline cuts them off
        results.append(assert_leapfrog_count(timeline, min_leapfrogs=0, max_leapfrogs=10))
        # Some early gate advances before decline sets in
        results.append(assert_gate_progression(timeline, min_gate_advances=1))

    elif archetype == "volatile":
        # θ should stay roughly stable — high and low sessions cancel out
        results.append(assert_theta_trend(timeline, direction="stable", tolerance=1.5))
        # Should still touch multiple skills despite thrashing
        results.append(assert_skill_diversity(timeline, min_unique_skills=3))

    elif archetype == "plateau":
        # θ should increase initially then stabilize
        results.append(assert_theta_trend(timeline, direction="increasing", tolerance=0.5))
        # Some gate advances (G0→G1, maybe G1→G2) but limited
        results.append(assert_gate_progression(timeline, min_gate_advances=1))
        # Few leapfrogs — plateau scores (~7.5) occasionally pass frontier checks
        results.append(assert_leapfrog_count(timeline, min_leapfrogs=0, max_leapfrogs=10))

    elif archetype == "bursty":
        # Despite 7-day gaps, strong learner should still progress
        results.append(assert_theta_trend(timeline, direction="increasing"))
        results.append(assert_gate_progression(timeline, min_gate_advances=1))

    else:
        logger.warning(f"No assertion suite for archetype '{archetype}'")

    return results
