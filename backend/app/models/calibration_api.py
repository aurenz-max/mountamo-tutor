"""
Calibration Display API — Response Models (Phase 2)

Pydantic models for the calibration REST endpoints.
Separate from the storage models in calibration.py.
"""

from typing import List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Student Ability responses
# ---------------------------------------------------------------------------

class ThetaHistoryPoint(BaseModel):
    """Single point in the EL trajectory (for charting)."""
    theta: float
    earned_level: float
    timestamp: str
    primitive_type: Optional[str] = None
    eval_mode: Optional[str] = None
    score: Optional[float] = None


class ContextualMessage(BaseModel):
    """Contextual progress message (PRD §6.4)."""
    phase: str  # first_assessment | early_growth | steady_climb | plateau | near_target | mastery_achieved
    message: str
    previous_el: Optional[float] = None
    current_el: float
    mastery_threshold: float = 9.0


class SkillAbilityResponse(BaseModel):
    """Single skill's ability data with trajectory and messaging."""
    skill_id: str
    theta: float
    sigma: float
    earned_level: float
    total_items_seen: int
    prior_source: str
    theta_history: List[ThetaHistoryPoint] = Field(default_factory=list)
    contextual_message: Optional[ContextualMessage] = None
    created_at: str
    updated_at: str


class StudentAbilitySummaryResponse(BaseModel):
    """All ability data for a student."""
    student_id: int
    abilities: List[SkillAbilityResponse] = Field(default_factory=list)
    count: int = 0
    queried_at: str


# ---------------------------------------------------------------------------
# Item Calibration responses (admin)
# ---------------------------------------------------------------------------

class ItemCalibrationResponse(BaseModel):
    """Single item calibration document for admin display."""
    item_key: str
    primitive_type: str
    eval_mode: str
    prior_beta: float
    empirical_beta: Optional[float] = None
    calibrated_beta: float
    total_observations: int
    total_correct: int
    credibility_z: float
    convergence_delta: Optional[float] = None  # |calibrated - prior|
    created_at: str
    updated_at: str


class ItemCalibrationListResponse(BaseModel):
    """All item calibrations (admin view)."""
    items: List[ItemCalibrationResponse] = Field(default_factory=list)
    count: int = 0
    queried_at: str
