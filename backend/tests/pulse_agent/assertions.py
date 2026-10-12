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


def assert_items_from_learner_model(timeline: JourneyTimeline) -> AssertionResult:
    """Every Pulse item was chosen by the learner model (user 10-12: one brain)."""
    items = [it for s in timeline.sessions for it in s.items]
    bad = sum(1 for it in items if it.selection_kind not in ("learn", "confirm"))
    return AssertionResult(
        name="items_from_learner_model",
        passed=bool(items) and bad == 0,
        message=f"Items without a learner-model kind: {bad}/{len(items)}",
        details={"total": len(items), "unlabelled": bad},
    )


def assert_discovery(timeline: JourneyTimeline, min_items: int = 1) -> AssertionResult:
    """Capable students get confirm items on subskills they never practised:
    the graph's inference is checked (what leapfrog probes used to do)."""
    n = sum(1 for s in timeline.sessions for it in s.items
            if it.selection_kind == "confirm" and it.band == "frontier")
    return AssertionResult(
        name="discovery",
        passed=n >= min_items,
        message=f"Confirm items on never-practised subskills: {n} (expected >= {min_items})",
        details={"actual": n},
    )


def assert_miss_streak(timeline: JourneyTimeline, max_streak: int = 3) -> AssertionResult:
    """No child sits through a long run of misses (score < 5)."""
    streak = worst = 0
    for s in timeline.sessions:
        for it in s.items:
            streak = streak + 1 if it.score < 5.0 else 0
            worst = max(worst, streak)
    return AssertionResult(
        name="miss_streak",
        passed=worst <= max_streak,
        message=f"Longest run of misses: {worst} (expected <= {max_streak})",
        details={"worst": worst},
    )


def run_assertions_for_archetype(
    timeline: JourneyTimeline,
    archetype: str,
) -> List[AssertionResult]:
    """Run the appropriate assertion suite for a given archetype."""
    results: List[AssertionResult] = []

    # Universal assertions
    results.append(assert_skill_diversity(timeline, min_unique_skills=2))
    results.append(assert_items_from_learner_model(timeline))

    if archetype == "gifted":
        results.append(assert_discovery(timeline, min_items=1))
        results.append(assert_gate_progression(timeline, min_gate_advances=3))
        results.append(assert_theta_trend(timeline, direction="increasing"))

    elif archetype == "steady":
        results.append(assert_gate_progression(timeline, min_gate_advances=1))
        results.append(assert_theta_trend(timeline, direction="increasing"))

    elif archetype == "struggling":
        results.append(assert_theta_trend(timeline, direction="stable", tolerance=1.5))

    elif archetype == "cold_start":
        results.append(assert_cold_start_frontier_heavy(timeline))

    elif archetype == "accelerating":
        results.append(assert_theta_trend(timeline, direction="increasing"))
        results.append(assert_gate_progression(timeline, min_gate_advances=2))

    elif archetype == "forgetful":
        results.append(assert_gate_progression(timeline, min_gate_advances=1))
        results.append(assert_theta_trend(timeline, direction="increasing"))

    elif archetype == "selective_weakness":
        results.append(assert_theta_trend(timeline, direction="increasing"))

    elif archetype == "shallow_roots":
        # inferred subskills get checked, not trusted
        results.append(assert_discovery(timeline, min_items=1))
        # Gate progression should still happen (the student IS learning)
        results.append(assert_gate_progression(timeline, min_gate_advances=3))

    elif archetype == "regressing":
        # θ should decline as scores drop
        results.append(assert_theta_trend(timeline, direction="decreasing", tolerance=0.3))
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

    elif archetype == "bursty":
        # Despite 7-day gaps, strong learner should still progress
        results.append(assert_theta_trend(timeline, direction="increasing"))
        results.append(assert_gate_progression(timeline, min_gate_advances=1))

    else:
        logger.warning(f"No assertion suite for archetype '{archetype}'")

    return results


# ── Truth-model assertions (Pulse Agent v2, Phase 1) ────────────────────────
#
# These only run when the journey was driven by the LatentStudent truth model
# (timeline.truth_mode). They validate the ESTIMATOR against ground truth —
# something scripted scores can never do.


def _truth_pairs(
    timeline: JourneyTimeline,
    min_items_seen: int = 5,
) -> List[tuple]:
    """(skill_id, theta_true, theta_est) for skills with enough evidence."""
    truth = timeline.truth_snapshot
    abilities = timeline.latest_abilities()
    pairs = []
    for skill_id, t_true in truth.items():
        ab = abilities.get(skill_id)
        if not ab:
            continue
        if ab.get("total_items_seen", 0) < min_items_seen:
            continue
        pairs.append((skill_id, t_true, ab.get("theta", 3.0)))
    return pairs


def _effective_truth(
    timeline: JourneyTimeline,
    skill_id: str,
    theta_true: float,
) -> float:
    """Compression-corrected convergence target for one skill.

    The LatentStudent emits weights w = g + (1-g-s)·P(θ_true, β), so even a
    perfect estimator converges not to θ_true but to the θ whose model
    probability equals that compressed weight at the items' mean β:

        θ_eff = β̄ + ln(w / (1 - w)) / a

    Judging against θ_eff isolates estimator quality from the (known,
    intentional) response-model compression.
    """
    import math as _math

    meta = timeline.truth_meta or {}
    g = float(meta.get("guess", 0.0))
    s = float(meta.get("slip", 0.0))
    a = float(meta.get("discrimination_a", 1.0)) or 1.0

    betas = [
        item.target_beta
        for sess in timeline.sessions
        for item in sess.items
        if item.skill_id == skill_id
    ]
    if not betas:
        return theta_true

    beta_bar = sum(betas) / len(betas)
    p_true = 1.0 / (1.0 + _math.exp(-max(-20.0, min(20.0, a * (theta_true - beta_bar)))))
    w = g + (1.0 - g - s) * p_true
    w = max(0.005, min(0.995, w))
    theta_eff = beta_bar + _math.log(w / (1.0 - w)) / a
    return max(0.0, min(10.0, theta_eff))


def assert_truth_convergence(
    timeline: JourneyTimeline,
    sigma_k: float = 2.5,
    floor: float = 0.8,
    min_coverage: float = 0.7,
    min_items_seen: int = 5,
) -> AssertionResult:
    """Coverage test: is the (compression-corrected) truth inside the
    engine's own confidence interval?

    For each well-evidenced skill, pass if |θ_eff - θ_est| <= max(k·σ, floor),
    where σ is the engine's posterior uncertainty for that skill. This is
    the statistically honest claim — with 3-6 items per skill some absolute
    error is expected (prior anchoring at 3.0), but the engine must not be
    confidently wrong. Requires >= min_coverage of skills within bound.
    """
    truth = timeline.truth_snapshot
    abilities = timeline.latest_abilities()

    rows = []  # (skill, theta_eff, theta_est, sigma, within)
    for skill_id, t_true in truth.items():
        ab = abilities.get(skill_id)
        if not ab or ab.get("total_items_seen", 0) < min_items_seen:
            continue
        t_eff = _effective_truth(timeline, skill_id, t_true)
        t_est = ab.get("theta", 3.0)
        sigma = ab.get("sigma", 2.0)
        bound = max(sigma_k * sigma, floor)
        rows.append((skill_id, t_eff, t_est, sigma, abs(t_eff - t_est) <= bound))

    if not rows:
        return AssertionResult(
            name="truth_convergence",
            passed=True,
            message=f"No skills with >= {min_items_seen} items — skipped",
            details={"pairs": 0},
        )

    covered = sum(1 for r in rows if r[4])
    coverage = covered / len(rows)
    mae = sum(abs(r[2] - r[1]) for r in rows) / len(rows)
    bias = sum(r[2] - r[1] for r in rows) / len(rows)
    worst = max(rows, key=lambda r: abs(r[2] - r[1]))

    return AssertionResult(
        name="truth_convergence",
        passed=coverage >= min_coverage,
        message=(
            f"Coverage {coverage:.0%} ({covered}/{len(rows)} skills within "
            f"{sigma_k}σ of θ_eff; need >= {min_coverage:.0%}); "
            f"MAE {mae:.2f}, bias {bias:+.2f}; worst: {worst[0]} "
            f"eff={worst[1]:.2f} est={worst[2]:.2f} σ={worst[3]:.2f}"
        ),
        details={
            "coverage": coverage, "pairs": len(rows),
            "mae_vs_eff": mae, "bias_vs_eff": bias,
        },
    )


def assert_truth_rank_agreement(
    timeline: JourneyTimeline,
    min_concordance: float = 0.6,
    min_items_seen: int = 5,
    truth_gap: float = 0.5,
    min_comparable_pairs: int = 6,
) -> AssertionResult:
    """Pairwise order agreement between theta_true and theta_est.

    The pedagogically load-bearing claim: the engine ranks the student's
    skills the way the truth ranks them (weak skills look weak), even if
    absolute values are attenuated. Only meaningful when the truth itself
    is heterogeneous — pairs whose true thetas differ by < truth_gap carry
    no ranking signal, and fewer than min_comparable_pairs of them is a
    coin-flip sample, so homogeneous archetypes (e.g. gifted, where every
    skill is uniformly strong) skip this check.
    """
    pairs = _truth_pairs(timeline, min_items_seen)

    concordant = 0
    total = 0
    for i in range(len(pairs)):
        for j in range(i + 1, len(pairs)):
            _, true_i, est_i = pairs[i]
            _, true_j, est_j = pairs[j]
            if abs(true_i - true_j) < truth_gap:
                continue  # truth ties carry no ranking signal
            total += 1
            if (true_i - true_j) * (est_i - est_j) > 0:
                concordant += 1

    if total < min_comparable_pairs:
        return AssertionResult(
            name="truth_rank_agreement",
            passed=True,
            message=(
                f"Only {total} comparable pairs (truth gap >= {truth_gap}, "
                f"need {min_comparable_pairs}) — truth too homogeneous, skipped"
            ),
            details={"comparable_pairs": total},
        )

    rate = concordant / total
    return AssertionResult(
        name="truth_rank_agreement",
        passed=rate >= min_concordance,
        message=(
            f"Rank concordance {rate:.0%} ({concordant}/{total} pairs, "
            f"need >= {min_concordance:.0%})"
        ),
        details={"concordance": rate, "pairs": total},
    )


def assert_weak_cluster_detected(
    timeline: JourneyTimeline,
    truth_gap: float = 1.5,
    min_items_seen: int = 3,
) -> AssertionResult:
    """For selective-weakness truth runs: skills that are TRULY weak
    (bottom cluster of theta_true) must be ESTIMATED weaker than the rest."""
    pairs = _truth_pairs(timeline, min_items_seen)
    if len(pairs) < 3:
        return AssertionResult(
            name="weak_cluster_detected",
            passed=True,
            message=f"Only {len(pairs)} evidenced skills — skipped",
            details={"pairs": len(pairs)},
        )

    mean_true = sum(p[1] for p in pairs) / len(pairs)
    weak = [p for p in pairs if p[1] <= mean_true - truth_gap / 2]
    strong = [p for p in pairs if p[1] >= mean_true + truth_gap / 2]
    if not weak or not strong:
        return AssertionResult(
            name="weak_cluster_detected",
            passed=True,
            message="Truth thetas form no separable clusters — skipped",
            details={"weak": len(weak), "strong": len(strong)},
        )

    est_weak = sum(p[2] for p in weak) / len(weak)
    est_strong = sum(p[2] for p in strong) / len(strong)

    return AssertionResult(
        name="weak_cluster_detected",
        passed=est_weak < est_strong,
        message=(
            f"Estimated θ: weak cluster {est_weak:.2f} ({len(weak)} skills) "
            f"vs strong cluster {est_strong:.2f} ({len(strong)} skills)"
        ),
        details={"est_weak": est_weak, "est_strong": est_strong},
    )


# Per-archetype σ multipliers: archetypes whose truth MOVES between
# measurement and snapshot (decay, drift) or drowns in response noise get a
# wider band — the lag is the archetype's point, not an estimator failure.
_TRUTH_SIGMA_K: Dict[str, float] = {
    "volatile": 3.5,
    "forgetful": 3.0,
    "regressing": 3.0,
    "bursty": 3.0,
    "struggling": 3.0,
}


def run_truth_assertions(
    timeline: JourneyTimeline,
    archetype: str,
) -> List[AssertionResult]:
    """Assertion suite for truth-model journeys: estimator validity first,
    then the qualitative archetype expectations that remain meaningful."""
    results: List[AssertionResult] = []

    results.append(assert_skill_diversity(timeline, min_unique_skills=2))
    results.append(assert_items_from_learner_model(timeline))
    results.append(assert_miss_streak(timeline, max_streak=3 if archetype != "volatile" else 5))
    results.append(assert_truth_convergence(
        timeline, sigma_k=_TRUTH_SIGMA_K.get(archetype, 2.5)
    ))

    # Rank agreement compares FINAL truth to estimates made at different
    # times. When truth drifts every session (regressing), estimates are
    # stale by construction and ranking reflects measurement timing, not
    # estimator quality — skip it there.
    drift = abs(float((timeline.truth_meta or {}).get("session_drift", 0.0)))
    if drift < 1e-9:
        results.append(assert_truth_rank_agreement(timeline))

    if archetype in ("gifted", "steady", "accelerating", "forgetful", "bursty"):
        results.append(assert_theta_trend(timeline, direction="increasing"))
        results.append(assert_gate_progression(timeline, min_gate_advances=1))
    elif archetype == "regressing":
        results.append(assert_theta_trend(timeline, direction="decreasing", tolerance=0.3))
    elif archetype == "volatile":
        results.append(assert_theta_trend(timeline, direction="stable", tolerance=1.5))
    elif archetype == "cold_start":
        results.append(assert_cold_start_frontier_heavy(timeline))
    elif archetype == "selective_weakness":
        results.append(assert_weak_cluster_detected(timeline))
    elif archetype == "plateau":
        results.append(assert_theta_trend(timeline, direction="increasing", tolerance=0.5))

    return results
