# backend/app/models/parent_portal.py
"""
Pydantic models for Parent Portal
Supports parent visibility, insights, and collaborative learning planning
"""

from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, Dict, Any, List


# ============================================================================
# PARENT ACCOUNT MODELS
# ============================================================================

class ParentAccount(BaseModel):
    """Parent account profile"""
    parent_uid: str = Field(..., description="Firebase UID of parent")
    email: str = Field(..., description="Parent's email address")
    display_name: Optional[str] = Field(None, description="Parent's display name")
    linked_student_ids: List[int] = Field(default_factory=list, description="Student IDs linked to this parent")
    preferences: Dict[str, Any] = Field(default_factory=dict, description="Parent preferences (notifications, digest frequency, etc.)")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Account creation timestamp")
    last_login: Optional[datetime] = Field(None, description="Last login timestamp")
    email_verified: bool = Field(False, description="Whether email is verified")
    onboarding_completed: bool = Field(False, description="Whether parent has completed onboarding flow")
    notification_preferences: Dict[str, bool] = Field(
        default_factory=lambda: {
            "weekly_digest": True,
            "daily_summary": False,
            "milestone_alerts": True,
            "struggle_alerts": True
        },
        description="Notification subscription preferences"
    )


class ParentStudentLink(BaseModel):
    """Link between parent and student accounts"""
    link_id: str = Field(..., description="Unique link identifier")
    parent_uid: str = Field(..., description="Firebase UID of parent")
    student_id: int = Field(..., description="Student ID")
    relationship: str = Field(..., description="Relationship type: parent, guardian, tutor, etc.")
    access_level: str = Field(default="full", description="Access level: full, read_only, limited")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Link creation timestamp")
    verified: bool = Field(False, description="Whether the link is verified")

    @validator('relationship')
    def validate_relationship(cls, v):
        """Validate relationship type"""
        valid_relationships = ['parent', 'guardian', 'tutor', 'teacher', 'mentor']
        if v not in valid_relationships:
            raise ValueError(f'Relationship must be one of: {", ".join(valid_relationships)}')
        return v

    @validator('access_level')
    def validate_access_level(cls, v):
        """Validate access level"""
        valid_levels = ['full', 'read_only', 'limited']
        if v not in valid_levels:
            raise ValueError(f'Access level must be one of: {", ".join(valid_levels)}')
        return v


# ============================================================================
# DASHBOARD RESPONSE MODELS
# ============================================================================

class TodaysPlanSummary(BaseModel):
    """Summary of student's daily plan for parent dashboard"""
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    total_activities: int = Field(..., description="Total activities planned")
    completed_activities: int = Field(..., description="Activities completed")
    estimated_total_time: int = Field(..., description="Estimated total time in minutes")
    subjects_covered: List[str] = Field(..., description="List of subjects in today's plan")
    activities_preview: List[Dict[str, Any]] = Field(..., description="Preview of activities (simplified)")


class WeeklySummaryMetrics(BaseModel):
    """Weekly summary metrics for parent dashboard"""
    week_start_date: str = Field(..., description="Week start date YYYY-MM-DD")
    week_end_date: str = Field(..., description="Week end date YYYY-MM-DD")
    total_time_spent_minutes: int = Field(..., description="Total learning time in minutes")
    problems_completed: int = Field(..., description="Number of problems completed")
    average_mastery: float = Field(..., description="Average mastery across all subjects (0-100)")
    subjects_progress: List[Dict[str, Any]] = Field(..., description="Progress breakdown by subject")
    streak_days: int = Field(..., description="Current learning streak")
    top_skill: Optional[str] = Field(None, description="Skill with most progress")


class KeyInsight(BaseModel):
    """AI-generated insight for parents"""
    insight_type: str = Field(..., description="Type: progress, struggle, milestone, recommendation")
    priority: str = Field(..., description="Priority: high, medium, low")
    title: str = Field(..., description="Short insight title")
    message: str = Field(..., description="Parent-friendly insight message")
    subject: Optional[str] = Field(None, description="Related subject")
    action_items: List[str] = Field(default_factory=list, description="Suggested action items")

    @validator('insight_type')
    def validate_insight_type(cls, v):
        valid_types = ['progress', 'struggle', 'milestone', 'recommendation']
        if v not in valid_types:
            raise ValueError(f'Insight type must be one of: {", ".join(valid_types)}')
        return v


class ParentDashboard(BaseModel):
    """Complete parent dashboard response"""
    student_id: int = Field(..., description="Student ID")
    student_name: str = Field(..., description="Student display name")
    todays_plan: TodaysPlanSummary = Field(..., description="Today's learning plan summary")
    weekly_summary: WeeklySummaryMetrics = Field(..., description="Past 7 days summary")
    key_insights: List[KeyInsight] = Field(..., description="Top 3-5 AI insights")
    generated_at: datetime = Field(default_factory=datetime.utcnow, description="Dashboard generation timestamp")


# ============================================================================
# WAYS TO HELP MODELS (Phase 2)
# ============================================================================

class FamilyActivity(BaseModel):
    """Off-platform activity suggestion for parents"""
    activity_id: str = Field(..., description="Unique activity ID")
    title: str = Field(..., description="Activity title")
    description: str = Field(..., description="Activity description")
    estimated_time: str = Field(..., description="Estimated time (e.g., '15-20 minutes')")
    materials_needed: List[str] = Field(default_factory=list, description="Materials needed")
    instructions: str = Field(..., description="Step-by-step instructions")
    learning_goal: str = Field(..., description="What the child will learn")
    subskill_id: str = Field(..., description="Related subskill ID")
    subject: str = Field(..., description="Subject area")


class ConversationStarter(BaseModel):
    """Discussion prompt for parents"""
    question: str = Field(..., description="Open-ended question")
    context: str = Field(..., description="Why this question is valuable")
    follow_up_ideas: List[str] = Field(default_factory=list, description="Follow-up question ideas")
    subskill_id: str = Field(..., description="Related subskill ID")


class WaysToHelpResponse(BaseModel):
    """Complete 'Ways to Help' response for parents"""
    student_id: int = Field(..., description="Student ID")
    catch_up_recommendations: List[Dict[str, Any]] = Field(..., description="Skills needing reinforcement")
    family_activities: List[FamilyActivity] = Field(..., description="Offline activities")
    conversation_starters: List[ConversationStarter] = Field(..., description="Discussion prompts")
    generated_at: datetime = Field(default_factory=datetime.utcnow, description="Generation timestamp")


# ============================================================================
# WEEKLY EXPLORER MODELS (Phase 3)
# ============================================================================

class ReadyLearningItem(BaseModel):
    """Upcoming learning item the student is ready for"""
    subskill_id: str = Field(..., description="Subskill ID")
    subskill_description: str = Field(..., description="Subskill description")
    subject: str = Field(..., description="Subject")
    unit_title: str = Field(..., description="Unit title")
    skill_description: str = Field(..., description="Skill description")
    readiness_status: str = Field(..., description="Readiness status from analytics")
    priority_order: int = Field(..., description="Priority ranking")
    parent_starred: bool = Field(default=False, description="Whether parent starred this item")


class ExplorerProject(BaseModel):
    """Curated off-platform project for deeper learning"""
    project_id: str = Field(..., description="Unique project ID")
    title: str = Field(..., description="Project title")
    description: str = Field(..., description="Project description")
    subject: str = Field(..., description="Subject area")
    skill_id: Optional[str] = Field(None, description="Related skill ID")
    subskill_id: Optional[str] = Field(None, description="Related subskill ID")
    learning_goals: List[str] = Field(..., description="Learning objectives")
    materials_list: List[str] = Field(..., description="Required materials")
    instructions_pdf_url: Optional[str] = Field(None, description="PDF instructions URL")
    estimated_time: str = Field(..., description="Time estimate (e.g., '45-60 minutes')")
    project_type: str = Field(..., description="Type: science_experiment, writing_assignment, creative_project, field_trip")
    difficulty_level: str = Field(..., description="Difficulty: beginner, intermediate, advanced")
    age_range: str = Field(..., description="Suggested age range (e.g., '8-10 years')")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Project creation timestamp")

    @validator('project_type')
    def validate_project_type(cls, v):
        valid_types = ['science_experiment', 'writing_assignment', 'creative_project', 'field_trip', 'math_activity', 'reading_activity']
        if v not in valid_types:
            raise ValueError(f'Project type must be one of: {", ".join(valid_types)}')
        return v


class ProjectCompletion(BaseModel):
    """Record of completed explorer project"""
    completion_id: str = Field(..., description="Unique completion ID")
    student_id: int = Field(..., description="Student ID")
    project_id: str = Field(..., description="Completed project ID")
    completed_at: datetime = Field(default_factory=datetime.utcnow, description="Completion timestamp")
    photo_url: Optional[str] = Field(None, description="Photo of completed project")
    parent_notes: Optional[str] = Field(None, description="Parent's notes about the experience")
    student_enjoyed: Optional[bool] = Field(None, description="Whether student enjoyed it")
    xp_awarded: int = Field(50, description="XP awarded for completion")


class WeeklyExplorerResponse(BaseModel):
    """Weekly Explorer planning view for parents"""
    student_id: int = Field(..., description="Student ID")
    week_start_date: str = Field(..., description="Week start date")
    ready_items: List[ReadyLearningItem] = Field(..., description="Skills ready to learn")
    suggested_projects: List[ExplorerProject] = Field(..., description="Relevant explorer projects")
    generated_at: datetime = Field(default_factory=datetime.utcnow, description="Generation timestamp")


# ============================================================================
# SESSION SUMMARY MODELS (Phase 4)
# ============================================================================

class SessionSummary(BaseModel):
    """Summary of a tutoring session for parent transparency"""
    session_id: str = Field(..., description="Unique session ID")
    student_id: int = Field(..., description="Student ID")
    session_type: str = Field(..., description="Type: practice_tutor, education_package, read_along")
    topic_covered: str = Field(..., description="Main topic covered")
    subject: str = Field(..., description="Subject area")
    skill_description: Optional[str] = Field(None, description="Skill description")
    subskill_description: Optional[str] = Field(None, description="Subskill description")
    duration_minutes: int = Field(..., description="Session duration in minutes")
    key_concepts: List[str] = Field(..., description="Key concepts discussed")
    student_engagement_score: str = Field(..., description="Engagement level: low, medium, high")
    problems_attempted: Optional[int] = Field(None, description="Number of problems attempted")
    problems_correct: Optional[int] = Field(None, description="Number of problems correct")
    tutor_feedback: Optional[str] = Field(None, description="AI tutor's summary feedback")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Summary creation timestamp")

    @validator('student_engagement_score')
    def validate_engagement(cls, v):
        valid_levels = ['low', 'medium', 'high']
        if v not in valid_levels:
            raise ValueError(f'Engagement score must be one of: {", ".join(valid_levels)}')
        return v


class SessionHistoryResponse(BaseModel):
    """List of recent session summaries"""
    student_id: int = Field(..., description="Student ID")
    sessions: List[SessionSummary] = Field(..., description="Recent sessions")
    total_sessions: int = Field(..., description="Total number of sessions")
    date_range: Dict[str, str] = Field(..., description="Date range covered")
    generated_at: datetime = Field(default_factory=datetime.utcnow, description="Generation timestamp")


# ============================================================================
# WEEKLY DIGEST MODEL
# ============================================================================

class WeeklyDigest(BaseModel):
    """Weekly email digest data for parents"""
    digest_id: str = Field(..., description="Unique digest ID")
    parent_uid: str = Field(..., description="Parent Firebase UID")
    student_id: int = Field(..., description="Student ID")
    week_start_date: str = Field(..., description="Week start date")
    week_end_date: str = Field(..., description="Week end date")
    summary_metrics: WeeklySummaryMetrics = Field(..., description="Weekly metrics")
    key_insights: List[KeyInsight] = Field(..., description="Top insights for the week")
    recommended_actions: List[str] = Field(..., description="Action items for parent")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Digest creation timestamp")
    sent_at: Optional[datetime] = Field(None, description="Email send timestamp")
    opened_at: Optional[datetime] = Field(None, description="Email open timestamp")
