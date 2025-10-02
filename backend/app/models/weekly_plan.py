# backend/app/models/weekly_plan.py
"""
Pydantic models for Proactive Weekly Learning Planner
Represents a student's week-long learning roadmap with adaptive daily assembly
"""

from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum


# ============================================================================
# ENUMS
# ============================================================================

class ActivityStatus(str, Enum):
    """Status of a planned activity in the weekly plan"""
    PENDING = "pending"  # Not yet assigned to a daily plan
    ASSIGNED = "assigned"  # Assigned to today's daily plan
    COMPLETED = "completed"  # Student completed the activity
    DEFERRED = "deferred"  # Activity was deferred due to higher-priority activity (e.g., from assessment)
    SKIPPED = "skipped"  # Activity was skipped (e.g., student caught up)


class ActivityPriority(str, Enum):
    """Priority level for activities"""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ActivityType(str, Enum):
    """Type of learning activity"""
    PRACTICE = "practice"
    PACKAGES = "packages"
    REVIEW = "review"
    TUTORING = "tutoring"
    ASSESSMENT = "assessment"


# ============================================================================
# PLANNED ACTIVITY MODEL
# ============================================================================

class PlannedActivity(BaseModel):
    """A single activity planned for the week"""
    activity_uid: str = Field(..., description="Unique identifier for this activity instance")
    subskill_id: str = Field(..., description="Curriculum subskill ID")
    subskill_description: str = Field(..., description="Human-readable subskill description")
    subject: str = Field(..., description="Subject area (e.g., Mathematics, Science)")
    skill_id: str = Field(..., description="Parent skill ID (e.g., SS001-04)")
    skill_description: Optional[str] = Field(None, description="Parent skill description")
    unit_id: str = Field(..., description="Curriculum unit ID (e.g., SS001)")
    unit_title: Optional[str] = Field(None, description="Curriculum unit title")

    activity_type: ActivityType = Field(..., description="Type of activity")
    planned_day: int = Field(..., description="Intended day (0=Monday, 1=Tuesday, ..., 4=Friday)", ge=0, le=6)
    status: ActivityStatus = Field(default=ActivityStatus.PENDING, description="Current status")
    priority: ActivityPriority = Field(default=ActivityPriority.MEDIUM, description="Priority level")

    # LLM reasoning and metadata
    llm_reasoning: str = Field(..., description="AI explanation for including this activity")
    estimated_time_minutes: int = Field(default=12, description="Estimated completion time", ge=1, le=60)

    # Curriculum metadata (from BigQuery)
    difficulty_start: Optional[int] = Field(None, description="Starting difficulty level")
    target_difficulty: Optional[int] = Field(None, description="Target difficulty level")
    grade: Optional[str] = Field(None, description="Grade level")

    # Tracking
    assigned_date: Optional[str] = Field(None, description="Date activity was assigned (YYYY-MM-DD)")
    completed_date: Optional[str] = Field(None, description="Date activity was completed (YYYY-MM-DD)")

    # Assessment-driven activity tracking (FR3)
    source_assessment_id: Optional[str] = Field(None, description="Assessment ID if activity was driven by assessment feedback")
    substituted_for_uid: Optional[str] = Field(None, description="UID of activity this replaced (for DEFERRED tracking)")

    @validator('planned_day')
    def validate_planned_day(cls, v):
        """Ensure planned_day is within Monday-Sunday range"""
        if v < 0 or v > 6:
            raise ValueError('planned_day must be 0-6 (0=Monday, 6=Sunday)')
        return v


# ============================================================================
# WEEKLY PLAN MODEL
# ============================================================================

class WeeklyPlan(BaseModel):
    """Complete weekly learning plan for a student"""
    # Identifiers
    student_id: int = Field(..., description="Student ID")
    week_start_date: str = Field(..., description="Week start date (Monday, YYYY-MM-DD)")
    plan_id: str = Field(..., description="Unique plan identifier (student_id_week_start_date)")

    # AI-generated content
    weekly_theme: str = Field(..., description="Engaging weekly learning theme")
    weekly_objectives: List[str] = Field(..., description="High-level learning goals for the week")

    # Analytics snapshot used for generation
    source_analytics_snapshot: Dict[str, Any] = Field(
        ...,
        description="Student velocity metrics and available subskills at generation time"
    )

    # The core plan: activities distributed across the week
    planned_activities: List[PlannedActivity] = Field(
        ...,
        description="All activities planned for the week"
    )

    # Metadata
    generated_at: str = Field(..., description="Plan generation timestamp (ISO format)")
    last_updated_at: str = Field(..., description="Last update timestamp (ISO format)")
    generation_model: str = Field(default="gemini-2.5-flash", description="LLM model used")

    # Parent interaction (Phase 3)
    parent_starred_activities: List[str] = Field(
        default_factory=list,
        description="Activity UIDs starred by parent for emphasis"
    )

    # Status tracking
    total_activities: int = Field(..., description="Total number of activities planned")
    completed_activities: int = Field(default=0, description="Number of completed activities")
    assigned_activities: int = Field(default=0, description="Number of currently assigned activities")

    @validator('week_start_date')
    def validate_week_start_date(cls, v):
        """Ensure week_start_date is a Monday"""
        try:
            date = datetime.strptime(v, '%Y-%m-%d')
            if date.weekday() != 0:  # 0 = Monday
                raise ValueError('week_start_date must be a Monday')
        except ValueError as e:
            raise ValueError(f'Invalid date format or not a Monday: {e}')
        return v

    @validator('planned_activities')
    def validate_activity_distribution(cls, v):
        """Ensure reasonable activity distribution across the week"""
        if len(v) < 5:
            raise ValueError('Weekly plan must have at least 5 activities')
        if len(v) > 30:
            raise ValueError('Weekly plan cannot exceed 30 activities')
        return v

    def get_activities_for_day(self, day: int) -> List[PlannedActivity]:
        """Get all activities planned for a specific day (0=Monday)"""
        return [act for act in self.planned_activities if act.planned_day == day]

    def get_pending_activities_for_day(self, day: int) -> List[PlannedActivity]:
        """Get pending activities for a specific day"""
        return [
            act for act in self.planned_activities
            if act.planned_day == day and act.status == ActivityStatus.PENDING
        ]

    def get_catch_up_activities(self, current_day: int) -> List[PlannedActivity]:
        """Get activities from previous days that are still pending or assigned"""
        return [
            act for act in self.planned_activities
            if act.planned_day < current_day and act.status in [ActivityStatus.PENDING, ActivityStatus.ASSIGNED]
        ]

    def get_accelerate_activities(self, current_day: int, count: int = 2) -> List[PlannedActivity]:
        """Get activities from future days for students who are ahead"""
        future_activities = [
            act for act in self.planned_activities
            if act.planned_day > current_day and act.status == ActivityStatus.PENDING
        ]
        # Sort by planned_day, then by priority
        future_activities.sort(key=lambda x: (x.planned_day, x.priority.value))
        return future_activities[:count]

    def update_activity_status(self, activity_uid: str, new_status: ActivityStatus) -> bool:
        """Update the status of a specific activity"""
        for activity in self.planned_activities:
            if activity.activity_uid == activity_uid:
                activity.status = new_status
                if new_status == ActivityStatus.COMPLETED:
                    activity.completed_date = datetime.utcnow().strftime('%Y-%m-%d')
                elif new_status == ActivityStatus.ASSIGNED:
                    activity.assigned_date = datetime.utcnow().strftime('%Y-%m-%d')

                # Update counters
                self._recalculate_status_counts()
                self.last_updated_at = datetime.utcnow().isoformat()
                return True
        return False

    def _recalculate_status_counts(self):
        """Recalculate completed and assigned activity counts"""
        self.completed_activities = sum(
            1 for act in self.planned_activities if act.status == ActivityStatus.COMPLETED
        )
        self.assigned_activities = sum(
            1 for act in self.planned_activities if act.status == ActivityStatus.ASSIGNED
        )

    def get_progress_percentage(self) -> float:
        """Calculate overall progress percentage"""
        if self.total_activities == 0:
            return 0.0
        return (self.completed_activities / self.total_activities) * 100


# ============================================================================
# WEEKLY PLAN GENERATION REQUEST
# ============================================================================

class WeeklyPlanGenerationRequest(BaseModel):
    """Request model for generating a weekly plan"""
    student_id: int = Field(..., description="Student ID")
    week_start_date: str = Field(..., description="Week start date (Monday, YYYY-MM-DD)")
    target_activities: int = Field(default=20, description="Target number of activities", ge=10, le=30)
    force_regenerate: bool = Field(default=False, description="Force regeneration even if plan exists")


# ============================================================================
# WEEKLY PLAN RESPONSE MODELS (for API)
# ============================================================================

class WeeklyPlanSummary(BaseModel):
    """Simplified weekly plan summary for API responses"""
    student_id: int
    week_start_date: str
    weekly_theme: str
    total_activities: int
    completed_activities: int
    assigned_activities: int
    progress_percentage: float
    generated_at: str


class DayPlanSummary(BaseModel):
    """Summary of activities for a specific day"""
    day_of_week: int  # 0=Monday
    day_name: str  # "Monday", "Tuesday", etc.
    date: str  # YYYY-MM-DD
    total_activities: int
    completed_activities: int
    pending_activities: int
    subjects: List[str]
