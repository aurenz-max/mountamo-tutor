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
DEFAULT_PULSE_ITEM_COUNT = 6

# Frontier probe settings (PRD §2.1)
FRONTIER_PROBE_MODE = 3          # mid-range probe (pictorial, reduced prompts)
FRONTIER_PASS_THRESHOLD = 7.5    # ≥75% on 0-10 scale
FRONTIER_MAX_JUMP = 5            # max DAG edges ahead

# Primitive history: rolling window size (number of recent entries to keep)
PRIMITIVE_HISTORY_WINDOW = 30

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

class ItemFrontierContext(BaseModel):
    """Per-item graph context for frontier visibility during practice."""
    dag_distance: int = 0                          # edges from current frontier (frontier band)
    ancestors_if_passed: int = 0                   # skills that would be inferred on leapfrog
    ancestor_skill_names: List[str] = Field(default_factory=list)  # human-readable (max 5)
    unit_name: str = ""                            # parent skill/unit name
    unit_mastered: int = 0                         # subskills mastered in this unit
    unit_total: int = 0                            # total subskills in this unit
    next_skill_name: str = ""                      # downstream skill (current band)
    last_tested_ago: str = ""                      # "2 days ago" (review band)


class UnitProgress(BaseModel):
    """Per-unit mastery summary for session-level context."""
    unit_name: str
    skill_id: str
    mastered: int = 0
    total: int = 0
    branches_remaining: int = 0


class SessionFrontierContext(BaseModel):
    """Session-level graph position summary."""
    frontier_depth: int = 0
    max_depth: int = 0
    total_mastered: int = 0
    total_nodes: int = 0
    units_in_progress: List[UnitProgress] = Field(default_factory=list)


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
    eval_mode_name: Optional[str] = None
    lesson_group_id: str = ""
    primitive_affinity: Optional[str] = None
    frontier_context: Optional[ItemFrontierContext] = None


class CreatePulseSessionRequest(BaseModel):
    """Request body for POST /api/pulse/sessions."""
    subject: str
    item_count: int = Field(default=DEFAULT_PULSE_ITEM_COUNT, ge=5, le=30)


class RecentPrimitive(BaseModel):
    """A recently-served primitive for diversity tracking."""
    primitive_type: str
    eval_mode: str
    score: float
    subskill_id: str


class PulseSessionResponse(BaseModel):
    """Returned from POST /api/pulse/sessions."""
    session_id: str
    student_id: int
    subject: str
    is_cold_start: bool = False
    items: List[PulseItemSpec]
    recent_primitives: List[RecentPrimitive] = Field(default_factory=list)
    session_meta: Dict[str, Any] = Field(default_factory=dict)
    frontier_context: Optional[SessionFrontierContext] = None


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
    sigma: Optional[float] = None
    earned_level: float


class SkillDetail(BaseModel):
    """Minimal metadata for a subskill reference in summaries."""
    subskill_id: str
    skill_id: str = ""
    skill_description: str = ""


class GateUpdate(BaseModel):
    """Gate change for a single subskill after one item."""
    subskill_id: str
    old_gate: int
    new_gate: int
    skill_id: str = ""
    skill_description: str = ""


class LeapfrogEvent(BaseModel):
    """Triggered when a frontier probe lesson group passes ≥75%."""
    lesson_group_id: str
    probed_skills: List[str]
    inferred_skills: List[str]
    aggregate_score: float
    probed_details: List[SkillDetail] = Field(default_factory=list)
    inferred_details: List[SkillDetail] = Field(default_factory=list)


class SkillUnlockProgress(BaseModel):
    """Per-skill subskill unlock progress for the knowledge map."""
    skill_id: str
    skill_description: str
    total_subskills: int = 0
    unlocked_subskills: int = 0


class IrtProbabilityData(BaseModel):
    """IRT probability data for a single item result."""
    p_correct: float = Field(description="P(correct) at current theta")
    item_information: float = Field(description="Fisher information at current theta")
    discrimination_a: float = Field(description="Item discrimination parameter")
    guessing_c: float = Field(default=0.0, description="Guessing floor")


class PulseResultResponse(BaseModel):
    """Returned after each item result."""
    item_id: str
    theta_update: ThetaUpdate
    gate_update: Optional[GateUpdate] = None
    leapfrog: Optional[LeapfrogEvent] = None
    gate_progress: Optional[Dict[str, Any]] = None
    irt: Optional[IrtProbabilityData] = None
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


class SessionIrtSummary(BaseModel):
    """Session-level IRT summary — sigma reduction, accuracy vs predicted."""
    start_sigma: float = 0.0
    end_sigma: float = 0.0
    sigma_reduction: float = 0.0
    predicted_correct: float = 0.0   # sum of P(correct) for all items
    actual_correct: int = 0          # count of items scored >= 9.0
    total_items: int = 0
    avg_information: float = 0.0     # mean item information across session


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
    skill_progress: List[SkillUnlockProgress] = Field(default_factory=list)
    irt_summary: Optional[SessionIrtSummary] = None


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
