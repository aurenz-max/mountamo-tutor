# backend/app/models/planning.py
"""
Data models for the Lumina planning engine.

Covers: mastery lifecycle integration, school year config,
and weekly/daily/monthly plan response schemas.

Data source: mastery_lifecycle collection (unified — PRD §2).
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class SkillLifecycleStatus(str, Enum):
    NOT_STARTED = "not_started"
    LEARNING = "learning"
    IN_REVIEW = "in_review"
    CLOSED = "closed"


class SessionReason(str, Enum):
    """Why a session appears in the daily plan."""
    SCHEDULED_REVIEW = "scheduled_review"
    MASTERY_RETEST = "mastery_retest"  # 4-gate mastery retest (PRD §3)
    BEHIND_PACE = "behind_pace"
    NEXT_IN_SEQUENCE = "next_in_sequence"
    BOTTLENECK_ADVANCE = "bottleneck_advance"  # Dependency bottleneck (PRD §7.2)


class SessionCategory(str, Enum):
    """Which section of the interleaved queue a session belongs to (PRD §8)."""
    INTERLEAVED = "interleaved"      # new blocks + reviews mixed
    TAIL = "tail"                    # lighter reviews in back 40%


# ---------------------------------------------------------------------------
# Student-level planning fields
# Stored on: students/{studentId} document
# ---------------------------------------------------------------------------

class StudentPlanningFields(BaseModel):
    """Planning-specific fields on the student document."""
    daily_session_capacity: int = 25


# ---------------------------------------------------------------------------
# School year config (PRD Section 6.3)
# Stored at: config/schoolYear
# ---------------------------------------------------------------------------

class SchoolBreak(BaseModel):
    name: str
    start: str  # YYYY-MM-DD
    end: str  # YYYY-MM-DD


class SchoolYearConfig(BaseModel):
    start_date: str  # YYYY-MM-DD
    end_date: str  # YYYY-MM-DD
    breaks: List[SchoolBreak] = Field(default_factory=list)
    school_days_per_week: int = 5


# ---------------------------------------------------------------------------
# Weekly plan response (PRD Section 5.4)
# ---------------------------------------------------------------------------

class SubjectWeeklyStats(BaseModel):
    total_skills: int = 0
    closed: int = 0
    in_review: int = 0
    not_started: int = 0
    learning: int = 0
    expected_by_now: float = 0.0
    behind_by: float = 0.0
    weekly_new_target: int = 0
    review_reserve: int = 0


class WeeklyPlanResponse(BaseModel):
    student_id: str
    week_of: str  # YYYY-MM-DD (Monday of the week)
    school_year: Dict  # {start, end, fractionElapsed, weeksRemaining}
    daily_session_capacity: int = 25
    sustainable_new_per_day: float = 0.0
    subjects: Dict[str, SubjectWeeklyStats] = Field(default_factory=dict)
    warnings: List[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Daily plan response (PRD Section 5.2)
# ---------------------------------------------------------------------------

class ReviewSessionItem(BaseModel):
    """A review (mastery retest) session in today's daily plan."""
    skill_id: str
    subject: str
    skill_name: str
    type: str = "review"
    reason: SessionReason
    priority: int
    completion_factor: float
    days_overdue: int = 0
    mastery_gate: Optional[int] = None  # Current gate (1-3)
    session_category: SessionCategory = SessionCategory.INTERLEAVED
    # Enrichment fields (resolved from curriculum)
    unit_title: Optional[str] = None
    skill_description: Optional[str] = None
    subskill_description: Optional[str] = None


class NewSkillSessionItem(BaseModel):
    """A new skill in today's daily plan."""
    skill_id: str
    subject: str
    skill_name: str
    type: str = "new"
    reason: SessionReason
    priority: int
    prerequisites_met: bool = True
    bottleneck: bool = False  # True when prerequisite gate < 4 (PRD §7.2)
    session_category: SessionCategory = SessionCategory.INTERLEAVED
    # Enrichment fields (resolved from curriculum)
    unit_title: Optional[str] = None
    skill_description: Optional[str] = None
    subskill_description: Optional[str] = None


class SubjectWeekProgress(BaseModel):
    new_target: int = 0
    new_completed: int = 0
    reviews_completed: int = 0


class DailyPlanResponse(BaseModel):
    student_id: str
    date: str  # YYYY-MM-DD
    day_of_week: str
    capacity: int = 25
    review_slots: int = 0
    new_slots: int = 0
    week_progress: Dict[str, SubjectWeekProgress] = Field(default_factory=dict)
    sessions: List[dict] = Field(default_factory=list)  # Union of review and new items
    warnings: List[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Monthly plan response (PRD Section 5.5)
# ---------------------------------------------------------------------------

class ConfidenceBand(BaseModel):
    """Optimistic / best-estimate / pessimistic projections."""
    optimistic: int = 0
    bestEstimate: int = 0
    pessimistic: int = 0


class WeekProjection(BaseModel):
    """One week of the forward simulation."""
    week: int
    weekOf: str  # YYYY-MM-DD (Monday of that week)
    projectedReviewsDue: int = 0
    projectedNewIntroductions: int = 0
    projectedClosures: int = 0
    projectedOpenInventory: int = 0
    cumulativeMastered: ConfidenceBand = Field(default_factory=ConfidenceBand)


class SubjectCurrentState(BaseModel):
    total: int = 0
    closed: int = 0
    inReview: int = 0
    notStarted: int = 0


class EndOfYearProjection(BaseModel):
    closed: int = 0
    remainingGap: int = 0


class EndOfYearScenarios(BaseModel):
    optimistic: EndOfYearProjection = Field(default_factory=EndOfYearProjection)
    bestEstimate: EndOfYearProjection = Field(default_factory=EndOfYearProjection)
    pessimistic: EndOfYearProjection = Field(default_factory=EndOfYearProjection)


class MonthlyWarning(BaseModel):
    type: str
    week: int
    message: str


class SubjectMonthlyProjection(BaseModel):
    currentState: SubjectCurrentState = Field(default_factory=SubjectCurrentState)
    weekByWeek: List[WeekProjection] = Field(default_factory=list)
    endOfYearProjection: EndOfYearScenarios = Field(default_factory=EndOfYearScenarios)
    warnings: List[MonthlyWarning] = Field(default_factory=list)


class MonthlyPlanResponse(BaseModel):
    studentId: str
    generatedAt: str  # ISO timestamp
    schoolYear: Dict  # {fractionElapsed, weeksRemaining}
    projections: Dict[str, SubjectMonthlyProjection] = Field(default_factory=dict)
