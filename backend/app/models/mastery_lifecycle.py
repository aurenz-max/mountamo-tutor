"""
Mastery Lifecycle Data Models

Implements the 4-gate mastery lifecycle model from the Competency–Planner
Integration PRD.  Each subskill follows a lifecycle:

  Gate 0 (Not Started)
    → Gate 1 (Initial Mastery — 3 lesson evals ≥ 90%)
    → Gate 2 (Retest 1 — practice eval ≥ 90% after 3-day interval)
    → Gate 3 (Retest 2 — practice eval ≥ 90% after 7-day interval)
    → Gate 4 (Retest 3 — practice eval ≥ 90% after 14-day interval)

A student at Gate 4 with 100% completion has **durable mastery**.
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

    # Practice-mode pass/fail accounting (Gates 2-4 only)
    passes: int = Field(default=0, ge=0)
    fails: int = Field(default=0, ge=0)
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

# Reference difficulty fraction within the primitive's beta range
GATE_REF_FRACTIONS = {
    1: 0.0,   # Easiest mode (min β)
    2: 0.5,   # Mid difficulty
    3: 0.8,   # 80th percentile β
    4: 1.0,   # Hardest mode (max β)
}
