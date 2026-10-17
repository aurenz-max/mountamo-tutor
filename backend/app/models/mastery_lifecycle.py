"""
Mastery Lifecycle Data Models

One doc per student and subskill. The learner model writes the gate, retention
state and memory stability (`MasteryLifecycleEngine.apply_model_states`, C13
10-16); `process_eval_result` keeps the practice record beside them. Retests
and the IRT gate derivation are retired (C15, 10-16): old docs still carry
`next_retest_eligible` / `retest_interval_days` / `gate_mode`, which nothing
writes or reads (extra fields are ignored on load).

  not_started  (gate 0 — no answer yet)
    → active   (gates 1-4 — the model's P(right) rung, 4 at P(mastered) >= 0.8)
    → mastered (gate 4 and memory stability >= MASTERY_STABILITY_THRESHOLD days)
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------

class GateHistoryEntry(BaseModel):
    """A single evaluation event within the mastery lifecycle."""
    gate: int = Field(..., ge=0, le=4, description="Gate being attempted")
    timestamp: str = Field(..., description="ISO-8601 timestamp")
    score: float = Field(..., ge=0, le=10, description="Score on 0-10 scale")
    passed: bool = Field(..., description="Whether the score met the threshold")
    source: Literal["lesson", "practice", "diagnostic", "learner_model"] = Field(
        ..., description="Eval source: lesson-mode, practice-mode, diagnostic-mode, or the "
                         "learner model's gate verdict (score = 10 x its P(right))"
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
        default=0,
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

    # Passed lesson evals (the curriculum map's "lessons" column)
    lesson_eval_count: int = Field(
        default=0, ge=0,
        description="Count of lesson-mode evals scoring ≥ 90% for this subskill",
    )

    # Retention state + memory stability (written by the learner model)
    retention_state: str = Field(
        default="not_started",
        description="Retention state: 'not_started' | 'active' | 'mastered'",
    )
    stability: float = Field(
        default=0.0, ge=0.0,
        description="The learner model's memory stability in days",
    )
    last_reviewed: Optional[str] = Field(
        default=None,
        description="ISO-8601 timestamp of the last answer on this subskill",
    )
    review_count: int = Field(
        default=0, ge=0,
        description="Number of answers recorded on this subskill",
    )
    evidence_n: float = Field(
        default=0.0, ge=0.0,
        description=(
            "Accumulated EFFECTIVE observation count for this subskill "
            "(multi-part primitives contribute >1 per submission via the "
            "testlet discount)."
        ),
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

# Credibility standard for blending (PRD 4.3)
CREDIBILITY_STANDARD = 10

# ---------------------------------------------------------------------------
# The learner model's gate rungs: gates 1-3 are the highest P(right) rung the
# model's P(right) on the typical item clears (LearnerStateService._gate_updates).
# ---------------------------------------------------------------------------

# P(right) per gate (the model sets gate 4 from P(mastered) >= 0.8)
GATE_P_THRESHOLDS = {
    1: 0.70,
    2: 0.75,
    3: 0.80,
    4: 0.90,
}

# ---------------------------------------------------------------------------
# Retention model constants
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

# Assumed strong-recall growth per review, for the mastery ETA projection
STABILITY_GROWTH_STRONG = 2.5

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
