"""
Calibration Data Models

Implements the 2PL/3PL IRT item calibration and student ability estimation
models from the Difficulty Calibration PRD §5–6 and the Pulse IRT
Probability System project plan.

Item calibration: item_calibration/{primitive_type}_{eval_mode}  (top-level, shared)
Student ability:  students/{student_id}/ability/{skill_id}       (per-student)
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Score threshold for treating a response as "correct" in IRT (0–10 scale)
IRT_CORRECT_THRESHOLD = 9.0

# Full-credibility threshold for item calibration (PRD §5.2)
# An item reaches Z=1.0 (purely empirical β) after this many observations.
ITEM_CREDIBILITY_STANDARD = 200

# Default student θ prior for new students on a new skill (PRD §6.1)
DEFAULT_STUDENT_THETA = 3.0

# Default σ for the θ prior (standard deviation of initial belief)
DEFAULT_THETA_SIGMA = 2.0

# Grid parameters for EAP estimation (PRD §6.2)
THETA_GRID_MIN = 0.0
THETA_GRID_MAX = 10.0
THETA_GRID_STEP = 0.1

# Process noise τ for dynamic θ model (Kalman-style drift).
# Before each update: σ_prior = √(σ² + τ²)
# This allows old observations to lose weight over time, so recovery
# from failures happens faster. τ=0.1 means ~0.32 accumulated drift
# over 10 items — enough to let 8 correct answers overcome 4 earlier failures.
THETA_PROCESS_NOISE = 0.1

# Maximum θ history entries per ability document
MAX_THETA_HISTORY = 100

# Per-primitive gate threshold parameters (PRD §6.5.4)
MIN_GATE_SPREAD = 2.5
GATE_PROPORTIONS = (0.20, 0.45, 0.75, 1.00)  # G1, G2, G3, G4


# ---------------------------------------------------------------------------
# Item Calibration Document
# ---------------------------------------------------------------------------

class ItemCalibration(BaseModel):
    """
    Calibration document for a single problem-type (primitive_type + eval_mode).

    Stored at: item_calibration/{primitive_type}_{eval_mode}
    This is a top-level collection (shared across all students).
    """

    # Identity
    primitive_type: str
    eval_mode: str

    # Prior (from ProblemTypeRegistry, set at creation)
    prior_beta: float = Field(..., ge=0.0, le=10.0)

    # Empirical tracking
    empirical_beta: Optional[float] = None
    total_observations: int = Field(default=0, ge=0)
    total_correct: int = Field(default=0, ge=0)
    sum_respondent_theta: float = Field(
        default=0.0,
        description="Running sum of θ values of all students who attempted this item",
    )
    sum_correct_theta: float = Field(
        default=0.0,
        description="Running sum of θ for correct responses only (for empirical a)",
    )
    sum_theta_squared: float = Field(
        default=0.0,
        description="Running sum of θ² for variance computation (for empirical a)",
    )

    # Credibility blending (PRD §5.2)
    credibility_z: float = Field(default=0.0, ge=0.0, le=1.0)
    calibrated_beta: float = Field(..., ge=0.0, le=10.0)

    # IRT 2PL/3PL parameters (Pulse IRT Probability System)
    discrimination_a: float = Field(
        default=1.4,
        description="Item discrimination — how sharply this item separates mastery levels",
    )
    guessing_c: float = Field(
        default=0.0, ge=0.0, le=1.0,
        description="Guessing floor — P(correct) by pure chance (0 for constructed response)",
    )
    a_source: str = Field(
        default="categorical_prior",
        description="Source of current a value: categorical_prior | empirical",
    )
    a_credibility: float = Field(
        default=0.0, ge=0.0, le=1.0,
        description="Credibility weight for empirical a (0 = pure prior, 1 = pure empirical)",
    )

    # Timestamps
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
    )
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
    )


# ---------------------------------------------------------------------------
# Student Ability Document
# ---------------------------------------------------------------------------

class ThetaHistoryEntry(BaseModel):
    """A single θ update event in the student's trajectory."""

    theta: float = Field(..., ge=0.0, le=10.0)
    earned_level: float = Field(..., ge=0.0, le=10.0)
    timestamp: str
    primitive_type: Optional[str] = None
    eval_mode: Optional[str] = None
    score: Optional[float] = None


class StudentAbility(BaseModel):
    """
    Per-student, per-skill ability estimate.

    Stored at: students/{student_id}/ability/{skill_id}
    """

    # Identity
    skill_id: str
    student_id: int

    # Ability estimate (PRD §6.1–6.3)
    theta: float = Field(default=DEFAULT_STUDENT_THETA, ge=0.0, le=10.0)
    sigma: float = Field(default=DEFAULT_THETA_SIGMA, ge=0.01, le=5.0)
    earned_level: float = Field(default=DEFAULT_STUDENT_THETA, ge=0.0, le=10.0)

    # Tracking
    total_items_seen: int = Field(default=0, ge=0)
    prior_source: str = Field(default="default")

    # History (capped at MAX_THETA_HISTORY)
    theta_history: List[ThetaHistoryEntry] = Field(default_factory=list)

    # Timestamps
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
    )
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
    )


# ---------------------------------------------------------------------------
# Per-Primitive Gate Thresholds (PRD §6.5.4)
# ---------------------------------------------------------------------------

class GateThresholds(BaseModel):
    """Gate thresholds for a specific primitive's beta range."""
    g1: float
    g2: float
    g3: float
    g4: float


class PrimitiveGateProgress(BaseModel):
    """Student's gate progress on a specific primitive."""
    primitive_type: str
    current_gate: int = Field(ge=0, le=4)
    thresholds: GateThresholds
    theta: float
    next_gate: Optional[int] = None
    next_gate_theta: Optional[float] = None
    min_beta: float
    max_beta: float


def compute_gate_thresholds(min_beta: float, max_beta: float) -> GateThresholds:
    """
    Compute gate thresholds from a primitive's beta range.

    Uses proportional placement with MIN_GATE_SPREAD floor to ensure
    monotonically increasing gates and meaningful evidence requirements.
    See PRD §6.5.4.
    """
    raw_spread = max_beta + 1.0 - min_beta
    spread = max(MIN_GATE_SPREAD, raw_spread)
    g1, g2, g3, g4 = (
        round(min_beta + spread * p, 2) for p in GATE_PROPORTIONS
    )
    return GateThresholds(g1=g1, g2=g2, g3=g3, g4=g4)


def compute_gate_from_theta(theta: float, thresholds: GateThresholds) -> int:
    """Determine which gate a theta value has reached."""
    if theta >= thresholds.g4:
        return 4
    if theta >= thresholds.g3:
        return 3
    if theta >= thresholds.g2:
        return 2
    if theta >= thresholds.g1:
        return 1
    return 0
