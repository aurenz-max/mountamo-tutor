"""
Lumina Pulse — Data Models

Request/response models for the adaptive learning loop.
See: Lumina_PRD_Pulse.md §7
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Band allocation targets (PRD §2, §5.2)
FRONTIER_BAND_PCT = 0.20
CURRENT_BAND_PCT = 0.65
REVIEW_BAND_PCT = 0.15

# Default session size
DEFAULT_PULSE_ITEM_COUNT = 15

# Frontier probe settings (PRD §2.1)
FRONTIER_PROBE_MODE = 3          # mid-range probe (pictorial, reduced prompts)
FRONTIER_PASS_THRESHOLD = 7.5    # ≥75% on 0-10 scale
FRONTIER_MAX_JUMP = 5            # max DAG edges ahead

# Leapfrog seeding (PRD §3.3) — matches diagnostic inference
LEAPFROG_INFERRED_GATE = 2
LEAPFROG_INFERRED_COMPLETION = 0.5
LEAPFROG_INFERRED_THETA = 7.0
LEAPFROG_INFERRED_SIGMA = 1.5
LEAPFROG_RETEST_DAYS = 3

# θ → mode mapping thresholds (PRD §3.1)
THETA_TO_MODE = [
    (2.0, 1),           # θ < 2.0  → mode 1 (concrete, β ≈ 1.5)
    (3.0, 2),           # θ < 3.0  → mode 2 (pictorial + prompts, β ≈ 2.5)
    (4.5, 3),           # θ < 4.5  → mode 3 (pictorial reduced, β ≈ 3.5)
    (6.0, 4),           # θ < 6.0  → mode 4 (transitional, β ≈ 5.0)
    (7.5, 5),           # θ < 7.5  → mode 5 (symbolic, β ≈ 6.5)
    (float("inf"), 6),  # θ ≥ 7.5  → mode 6 (multi-step, β ≈ 8.0)
]

# Prior β per mode (from ProblemTypeRegistry, for quick lookup)
MODE_PRIOR_BETA = {1: 1.5, 2: 2.5, 3: 3.5, 4: 5.0, 5: 6.5, 6: 8.0}


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class PulseBand(str, Enum):
    FRONTIER = "frontier"
    CURRENT = "current"
    REVIEW = "review"


# ---------------------------------------------------------------------------
# Session Assembly Models
# ---------------------------------------------------------------------------

class PulseItemSpec(BaseModel):
    """Single item the frontend needs to generate and render."""
    item_id: str
    band: PulseBand
    subskill_id: str
    skill_id: str
    subject: str
    description: str
    target_mode: int = Field(ge=1, le=6)
    target_beta: float = Field(ge=0.0, le=10.0)
    lesson_group_id: str = ""
    primitive_affinity: Optional[str] = None


class CreatePulseSessionRequest(BaseModel):
    """Request body for POST /api/pulse/sessions."""
    subject: str
    item_count: int = Field(default=DEFAULT_PULSE_ITEM_COUNT, ge=5, le=30)


class PulseSessionResponse(BaseModel):
    """Returned from POST /api/pulse/sessions."""
    session_id: str
    student_id: int
    subject: str
    is_cold_start: bool = False
    items: List[PulseItemSpec]
    session_meta: Dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Result Processing Models
# ---------------------------------------------------------------------------

class PulseResultRequest(BaseModel):
    """Frontend submits per-item result."""
    item_id: str
    score: float = Field(ge=0.0, le=10.0)
    primitive_type: str
    eval_mode: str
    duration_ms: int = Field(ge=0)


class ThetaUpdate(BaseModel):
    """θ change for a single skill after one item."""
    skill_id: str
    old_theta: float
    new_theta: float
    earned_level: float


class GateUpdate(BaseModel):
    """Gate change for a single subskill after one item."""
    subskill_id: str
    old_gate: int
    new_gate: int


class LeapfrogEvent(BaseModel):
    """Triggered when a frontier probe lesson group passes ≥75%."""
    lesson_group_id: str
    probed_skills: List[str]
    inferred_skills: List[str]
    aggregate_score: float


class PulseResultResponse(BaseModel):
    """Returned after each item result."""
    item_id: str
    theta_update: ThetaUpdate
    gate_update: Optional[GateUpdate] = None
    leapfrog: Optional[LeapfrogEvent] = None
    session_progress: Dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Session Summary Models
# ---------------------------------------------------------------------------

class PulseBandSummary(BaseModel):
    """Stats for one band within a session."""
    band: PulseBand
    items_total: int = 0
    items_completed: int = 0
    avg_score: float = 0.0


class PulseSessionSummary(BaseModel):
    """Returned from GET /api/pulse/sessions/{id}/summary."""
    session_id: str
    subject: str
    is_cold_start: bool = False
    items_completed: int = 0
    items_total: int = 0
    duration_ms: int = 0
    bands: Dict[str, PulseBandSummary] = Field(default_factory=dict)
    skills_advanced: List[GateUpdate] = Field(default_factory=list)
    theta_changes: List[ThetaUpdate] = Field(default_factory=list)
    leapfrogs: List[LeapfrogEvent] = Field(default_factory=list)
    frontier_expanded: bool = False
    celebration_message: str = "Great work!"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def theta_to_mode(theta: float) -> int:
    """Map student ability θ to scaffolding mode 1-6."""
    for threshold, mode in THETA_TO_MODE:
        if theta < threshold:
            return mode
    return 6


def mode_to_beta(mode: int) -> float:
    """Get the prior β for a given mode."""
    return MODE_PRIOR_BETA.get(mode, 3.5)
