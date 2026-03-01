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
    passed: bool = Field(..., description="Whether the score met the 9.0 threshold")
    source: Literal["lesson", "practice"] = Field(
        ..., description="Eval source: lesson-mode or practice-mode"
    )


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
