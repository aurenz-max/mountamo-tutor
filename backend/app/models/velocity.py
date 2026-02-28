# backend/app/models/velocity.py
"""
Data models for the Mastery Velocity metric (PRD Section 15).

Velocity answers "Is the student on track?" by comparing earned mastery
(closed skills at 1.0 + in-review skills at their completion factor)
against pipeline-adjusted expected mastery.
"""

from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class VelocityDecomposition(BaseModel):
    """Three drivers that explain why velocity is where it is."""
    introductionVelocity: float  # Are new skills being introduced on pace?
    passThroughVelocity: float   # Are in-review skills advancing on schedule?
    closureVelocity: float       # Are skills actually closing?


class PrimaryDriver(BaseModel):
    """The single biggest factor driving velocity up or down."""
    component: str  # "introduction" | "pass_through" | "closure" | "all_healthy"
    value: Optional[float] = None
    explanation: str


class SubjectVelocity(BaseModel):
    """Velocity breakdown for a single subject."""
    totalSkills: int
    closed: int
    inReviewEarned: float  # Σ completion_factor for in-review/learning skills
    earnedMastery: float
    adjustedExpectedMastery: float
    velocity: float
    trend: List[float] = Field(default_factory=list)  # last 8 weekly snapshots + current
    decomposition: VelocityDecomposition
    primaryDriver: PrimaryDriver


class SchoolYearProgress(BaseModel):
    """Where we are in the school year."""
    fractionElapsed: float
    weeksCompleted: int
    weeksRemaining: int


class AggregateVelocity(BaseModel):
    """Velocity across all subjects combined."""
    earnedMastery: float
    adjustedExpectedMastery: float
    velocity: float
    trend: List[float] = Field(default_factory=list)


class VelocityResponse(BaseModel):
    """
    Full velocity response for GET /api/velocity/{studentId}.

    Contains aggregate velocity plus per-subject breakdowns with
    decomposition and trend data.
    """
    studentId: str
    asOfDate: str  # YYYY-MM-DD
    schoolYear: SchoolYearProgress
    aggregate: AggregateVelocity
    subjects: Dict[str, SubjectVelocity] = Field(default_factory=dict)
