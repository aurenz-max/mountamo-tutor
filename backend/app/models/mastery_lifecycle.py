"""
Mastery Lifecycle Data Models

Implements the stability-based retention model (PRD §16), replacing Gates 1-4
with continuous forgetting + spaced review.  Each subskill follows:

  not_started  (Gate 0 — student hasn't been introduced)
    → active   (Gate 1 — initial mastery achieved, retention tracked via stability)
    → mastered (stability > 30 days — long-term retention verified)

Gate 0→1 transition preserved for initial mastery verification.
Reviews surface by information value (P < 0.85), never blocking progression.
Stability grows with successful reviews (×2.5/×1.5/×0.5).
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import IntEnum
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class MasteryGate(IntEnum):
    """The four mastery gates (plus not-started)."""
    NOT_STARTED = 0
    INITIAL_MASTERY = 1
    RETEST_1 = 2
    RETEST_2 = 3
    RETEST_3 = 4


# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------

class GateHistoryEntry(BaseModel):
    """A single evaluation event within the mastery lifecycle."""
    gate: int = Field(..., ge=0, le=4, description="Gate being attempted")
    timestamp: str = Field(..., description="ISO-8601 timestamp")
    score: float = Field(..., ge=0, le=10, description="Score on 0-10 scale")
    passed: bool = Field(..., description="Whether the score met the threshold")
    source: Literal["lesson", "practice", "diagnostic"] = Field(
        ..., description="Eval source: lesson-mode, practice-mode, or diagnostic-mode"
    )
    # Theta-based gate tracking (populated when gate_mode="theta")
    theta: Optional[float] = Field(default=None, description="Student theta at eval time")
    sigma: Optional[float] = Field(default=None, description="Student sigma at eval time")


# ---------------------------------------------------------------------------
# Core document
# ---------------------------------------------------------------------------

class MasteryLifecycle(BaseModel):
    """
    Per-student, per-subskill mastery lifecycle document.

    Stored at:  students/{student_id}/mastery_lifecycle/{subskill_id}
    """

    # Identity
    student_id: int
    subskill_id: str
    subject: str = ""
    skill_id: str = ""

    # Gate state
    current_gate: int = Field(
        default=MasteryGate.NOT_STARTED,
        ge=0, le=4,
        description="Current mastery gate (0-4)",
    )

    # Completion factor (actuarial model — PRD Section 4)
    completion_pct: float = Field(default=0.0, ge=0.0, le=1.0)

    # Practice-mode pass/fail accounting — continuous weights (score/10)
    passes: float = Field(default=0.0, ge=0.0)
    fails: float = Field(default=0.0, ge=0.0)
    subskill_pass_rate: float = Field(default=0.0, ge=0.0, le=1.0)
    blended_pass_rate: float = Field(default=0.0, ge=0.0, le=1.0)
    credit_per_pass: float = Field(default=0.25, ge=0.0, le=0.25)

    # Workload forecast
    estimated_remaining_attempts: int = Field(default=4, ge=0)

    # Retest scheduling
    next_retest_eligible: Optional[str] = Field(
        default=None,
        description="ISO-8601 timestamp — earliest the planner may schedule a retest",
    )
    retest_interval_days: int = Field(default=3, ge=0)

    # Gate 1 lesson eval tracking (requires 3 lesson evals ≥ 90%)
    lesson_eval_count: int = Field(
        default=0, ge=0,
        description="Count of lesson-mode evals scoring ≥ 90% for this subskill",
    )

    # Theta-based gate tracking (ADAPT model — replaces score-based gates)
    gate_mode: str = Field(
        default="legacy",
        description="Gate advancement mode: 'legacy' (3-evals-at-9.0) or 'theta' (confidence-based)",
    )
    theta_at_gate_entry: Optional[float] = Field(
        default=None, description="Student theta when gate was last advanced",
    )
    sigma_at_gate_entry: Optional[float] = Field(
        default=None, description="Student sigma when gate was last advanced",
    )
    gate_theta_threshold: Optional[float] = Field(
        default=None, description="Skill beta median used for gate threshold computation",
    )

    # Retention model (PRD §16 — replaces Gates 1-4)
    retention_state: str = Field(
        default="not_started",
        description="Retention state: 'not_started' | 'active' | 'mastered'",
    )
    stability: float = Field(
        default=0.0, ge=0.0,
        description="Memory strength in days — how long before P drops below target",
    )
    last_reviewed: Optional[str] = Field(
        default=None,
        description="ISO-8601 timestamp of last stability-updating review",
    )
    review_count: int = Field(
        default=0, ge=0,
        description="Number of stability-updating reviews completed",
    )

    # History
    gate_history: List[GateHistoryEntry] = Field(default_factory=list)

    # Timestamps
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
    )
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
    )


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Mastery threshold: score ≥ 9.0/10 = 90%
MASTERY_THRESHOLD = 9.0

# Minimum lesson evals required to clear Gate 1
GATE_1_MIN_LESSON_EVALS = 3

# Credibility standard for blending (PRD 4.3)
CREDIBILITY_STANDARD = 10

# Spaced retest intervals (PRD 5.1)
RETEST_INTERVALS = {
    # gate_transition: (base_interval_days, failed_reset_days)
    (1, 2): (3, 3),
    (2, 3): (7, 3),
    (3, 4): (14, 7),
}

# ---------------------------------------------------------------------------
# Theta-based gate constants (ADAPT model — legacy theta-offset mode)
# ---------------------------------------------------------------------------

# Sigma thresholds per gate — confidence requirement tightens at higher gates.
# Lower sigma = more confident estimate. Must have sigma BELOW this value to advance.
GATE_SIGMA_THRESHOLDS = {
    1: 1.5,   # Gate 0→1: "probably passes easy items"
    2: 1.2,   # Gate 1→2: "likely passes medium items"
    3: 1.0,   # Gate 2→3: "strong chance at hard items"
    4: 0.8,   # Gate 3→4: "near-certain at everything"
}

# Theta must exceed skill_beta_median + offset for each gate.
# (Legacy mode — replaced by P(correct) thresholds in probability mode)
GATE_THETA_OFFSETS = {
    1: 0.0,   # Gate 0→1: theta > skill beta median
    2: 0.0,   # Gate 1→2: retention check (same threshold)
    3: 0.5,   # Gate 2→3: slightly above median
    4: 0.5,   # Gate 3→4: same as G3
}

# ---------------------------------------------------------------------------
# Probability-based gate constants (2PL/3PL ADAPT model)
#
# Gate pass: P(correct | ref_b, avg_a) >= p_threshold AND sigma <= sigma_max
# ref_b = min_beta + (max_beta - min_beta) * ref_fraction
# ---------------------------------------------------------------------------

# P(correct) thresholds per gate
GATE_P_THRESHOLDS = {
    1: 0.70,  # Gate 0→1: 70% chance at easiest mode
    2: 0.75,  # Gate 1→2: 75% chance at mid difficulty
    3: 0.80,  # Gate 2→3: 80% chance at hard difficulty
    4: 0.90,  # Gate 3→4: 90% chance at hardest mode
}

# Credibility constant for blending empirical P with IRT P in gate checks.
# Z = n / (n + K).  At K=10: Z=0.5 after 10 observations, Z=0.75 after 30.
# Matches CREDIBILITY_STANDARD used in the actuarial completion factor.
GATE_CREDIBILITY_K = 10

# Reference difficulty fraction within the primitive's beta range
GATE_REF_FRACTIONS = {
    1: 0.0,   # Easiest mode (min β)
    2: 0.5,   # Mid difficulty
    3: 0.8,   # 80th percentile β
    4: 1.0,   # Hardest mode (max β)
}

# ---------------------------------------------------------------------------
# Retention model constants (PRD §16 — replaces Gates 1-4)
# ---------------------------------------------------------------------------

# Initial memory stability after first mastery (Gate 0→1 cleared)
INITIAL_STABILITY = 3.0  # days

# Forgetting function: effective_theta = θ - DECAY_RATE * √(t / S)
# Calibrated so at t=S days, θ=7.0 drops to P≈0.85
DECAY_RATE = 1.5

# Posterior diffusion: σ grows when a skill is not observed.
# eff_σ = √(σ² + SIGMA_DIFFUSION_RATE² × days_since)
# At 0.08/day, a skill at σ=0.25 untested for 10 days → σ≈0.30.
# Tuned via pulse-agent sweep: 0.06 too weak (plateau persists),
# 0.10 too aggressive (scatters focus).  Capped at DEFAULT_THETA_SIGMA.
SIGMA_DIFFUSION_RATE = 0.08

# Review trigger: items with P(correct) below this become review candidates
TARGET_RETENTION = 0.85

# Current-band filter: items above this P are trivial busywork — skip them
TRIVIAL_THRESHOLD = 0.95

# Stability growth multipliers based on review score
STABILITY_GROWTH_STRONG = 2.5   # score >= 9.0 — strong recall
STABILITY_GROWTH_PARTIAL = 1.5  # score >= 7.0 — partial recall
STABILITY_SHRINK_FAIL = 0.5     # score < 7.0 — failed recall, review sooner

# Ability-aware fast-track: if the model predicts P(correct) >= this threshold
# on the hardest available mode, the student demonstrably knows the material.
# Skip intermediate stability gates by flooring stability at FAST_TRACK_STABILITY.
# Path: S=3.0 → 18.75 → 46.9 (mastered) — 3 evals instead of 4.
FAST_TRACK_P_THRESHOLD = 0.95
FAST_TRACK_STABILITY = 18.75    # gate 3 equivalent (skips gates 1→2→3)
FAST_TRACK_SIGMA_MAX = 1.0      # σ must be below this for fast-track to fire;
                                # leapfrog-inferred skills start at σ=1.5 and
                                # need real practice to shrink below 1.0

# Stability above this → mastered (equivalent to old Gate 4)
MASTERY_STABILITY_THRESHOLD = 30.0  # days

# Never decay effective_theta below this fraction of tested theta
THETA_DECAY_FLOOR_FACTOR = 0.5

# Gate-to-stability migration mapping for existing Firestore docs
GATE_TO_STABILITY = {
    0: 0.0,     # not_started
    1: 3.0,     # just cleared initial mastery
    2: 7.5,     # survived one retest
    3: 18.75,   # survived two retests
    4: 47.0,    # fully verified
}
