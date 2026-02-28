# backend/app/models/planning.py
"""
Data models for the Lumina planning engine.

Covers: skill review pipeline, completion factor model, school year config,
and weekly/daily plan response schemas (PRD Sections 3-6).
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
    TIGHT_LOOP_RECOVERY = "tight_loop_recovery"
    SCHEDULED_REVIEW = "scheduled_review"
    BEHIND_PACE = "behind_pace"
    NEXT_IN_SEQUENCE = "next_in_sequence"


# ---------------------------------------------------------------------------
# Review pipeline (PRD Section 3 / Firestore Section 6.2)
# ---------------------------------------------------------------------------

class ReviewEntry(BaseModel):
    """A single review session result."""
    date: str  # ISO date string
    score: float  # 0.0 – 1.0
    session: int  # 1-indexed review session number
    passed: bool  # score >= 0.9


class SkillStatus(BaseModel):
    """
    Full lifecycle state for one skill in the review pipeline.
    Stored at: students/{studentId}/skill_status/{skillId}
    """
    skill_id: str
    subject: str
    skill_name: str = ""

    status: SkillLifecycleStatus = SkillLifecycleStatus.NOT_STARTED
    first_introduced: Optional[str] = None  # ISO timestamp
    initial_mastery_date: Optional[str] = None  # ISO timestamp

    # Review tracking
    review_history: List[ReviewEntry] = Field(default_factory=list)
    sessions_completed: int = 0  # includes initial mastery session
    estimated_ultimate: int = 4  # starts at 4, +1 per failure
    completion_factor: float = 0.0  # sessions_completed / estimated_ultimate

    # Scheduling
    next_review_date: Optional[str] = None  # ISO date
    in_tight_loop: bool = False
    tight_loop_passes_needed: int = 0  # 90%+ passes remaining before normal intervals

    # Closure
    closed_date: Optional[str] = None  # set when completion_factor reaches 1.0


# ---------------------------------------------------------------------------
# Student-level planning fields (PRD Section 6.1)
# Stored on: students/{studentId} document
# ---------------------------------------------------------------------------

class DevelopmentPattern(BaseModel):
    """Per-subject historical pattern of skill closures."""
    average_ultimate: float = 4.0
    skills_closed: int = 0
    total_sessions: int = 0


class AggregateMetrics(BaseModel):
    """Student-wide review burden metrics."""
    total_review_reserve: int = 0
    projected_daily_review_load: float = 0.0
    sustainable_new_per_day: float = 0.0
    last_recalculated: Optional[str] = None  # ISO timestamp


class StudentPlanningFields(BaseModel):
    """Planning-specific fields on the student document."""
    daily_session_capacity: int = 25
    development_patterns: Dict[str, DevelopmentPattern] = Field(default_factory=dict)
    aggregate_metrics: AggregateMetrics = Field(default_factory=AggregateMetrics)


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
# Weekly plan response (PRD Section 4.5)
# ---------------------------------------------------------------------------

class SubjectWeeklyStats(BaseModel):
    total_skills: int = 0
    closed: int = 0
    in_review: int = 0
    not_started: int = 0
    expected_by_now: float = 0.0
    behind_by: float = 0.0
    weekly_new_target: int = 0
    review_reserve: int = 0
    avg_ultimate: float = 4.0


class WeeklyPlanResponse(BaseModel):
    student_id: str
    week_of: str  # YYYY-MM-DD (Monday of the week)
    school_year: Dict  # {start, end, fractionElapsed, weeksRemaining}
    daily_session_capacity: int = 25
    sustainable_new_per_day: float = 0.0
    subjects: Dict[str, SubjectWeeklyStats] = Field(default_factory=dict)
    warnings: List[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Daily plan response (PRD Section 5.5)
# ---------------------------------------------------------------------------

class ReviewSessionItem(BaseModel):
    """A review skill in today's daily plan."""
    skill_id: str
    subject: str
    skill_name: str
    type: str = "review"
    reason: SessionReason
    priority: int
    review_session: int  # which review session number
    estimated_ultimate: int
    completion_factor: float
    days_overdue: int = 0
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
