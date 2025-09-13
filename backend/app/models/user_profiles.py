# backend/app/models/user_profiles.py
"""
Pydantic models for User Profiles, Onboarding, Activities, and Stats
"""

from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, Dict, Any, List


# ============================================================================
# ONBOARDING MODELS
# ============================================================================

class OnboardingData(BaseModel):
    """Onboarding data structure collected during user setup"""
    selectedSubjects: List[str] = Field(..., min_items=1, description="Subject IDs user selected")
    selectedPackages: List[str] = Field(..., min_items=1, description="Package IDs user selected")
    learningGoals: List[str] = Field(..., min_items=1, description="Learning goal IDs user selected")
    preferredLearningStyle: List[str] = Field(..., min_items=1, description="Learning style IDs user selected")
    onboardingCompleted: bool = Field(True, description="Onboarding completion status")
    completedAt: str = Field(..., description="ISO timestamp of completion")
    
    @validator('learningGoals')
    def validate_learning_goals(cls, v):
        """Validate learning goals against allowed values"""
        valid_goals = ['improve-grades', 'homework-help', 'test-prep', 'learn-ahead', 'review-concepts', 'have-fun']
        for goal in v:
            if goal not in valid_goals:
                raise ValueError(f'Invalid learning goal: {goal}. Must be one of: {", ".join(valid_goals)}')
        return v
    
    @validator('preferredLearningStyle')
    def validate_learning_styles(cls, v):
        """Validate learning styles against allowed values"""
        valid_styles = ['visual', 'audio', 'reading', 'hands-on']
        for style in v:
            if style not in valid_styles:
                raise ValueError(f'Invalid learning style: {style}. Must be one of: {", ".join(valid_styles)}')
        return v


# ============================================================================
# USER PROFILE MODELS
# ============================================================================

class UserProfile(BaseModel):
    """Complete user profile model"""
    uid: str
    student_id: int
    email: str
    display_name: Optional[str] = None
    grade_level: Optional[str] = None
    email_verified: bool = False
    created_at: datetime
    last_login: Optional[datetime] = None
    last_activity: Optional[datetime] = None
    # XP and Progression System fields
    total_xp: int = 0  # Renamed from total_points to match PRD
    current_level: int = 1  # Renamed from level to match PRD
    xp_for_next_level: int = 100  # New field to track XP needed for next level
    current_streak: int = 0
    longest_streak: int = 0
    last_activity_date: Optional[datetime] = None  # New field for streak tracking
    badges: List[str] = []
    preferences: Dict[str, Any] = {}
    onboarding_completed: bool = False
    onboarding_completed_at: Optional[datetime] = None


class UserProfileUpdate(BaseModel):
    """Model for updating user profile"""
    display_name: Optional[str] = None
    grade_level: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None
    
    @validator('grade_level')
    def validate_grade_level(cls, v):
        """Validate grade level if provided"""
        if v is not None:
            valid_grades = [
                'K', '1st', '2nd', '3rd', '4th', '5th', 
                '6th', '7th', '8th', '9th', '10th', '11th', '12th'
            ]
            if v not in valid_grades:
                raise ValueError(f'Grade level must be one of: {", ".join(valid_grades)}')
        return v


# ============================================================================
# ACTIVITY MODELS
# ============================================================================

class ActivityLog(BaseModel):
    """Model for logging user activities"""
    activity_type: str  # "lesson", "problem", "quiz", "login", "onboarding_completion", etc.
    activity_id: Optional[str] = None
    activity_name: Optional[str] = None
    points_earned: int = 0  # Deprecated - kept for backward compatibility
    xp_earned: int = 0  # New XP field as per PRD
    duration_seconds: Optional[int] = None
    accuracy_percentage: Optional[float] = Field(None, ge=0, le=100)
    difficulty_level: Optional[str] = None  # "easy", "medium", "hard"
    success: bool = True
    metadata: Optional[Dict[str, Any]] = {}


class ActivityResponse(BaseModel):
    """Response model for activity logging with complete engagement transaction data"""
    activity_id: str
    points_earned: int  # Deprecated - kept for backward compatibility
    xp_earned: int  # Total XP earned (base + bonus)
    base_xp: Optional[int] = None  # Base XP from activity
    streak_bonus_xp: Optional[int] = None  # Bonus XP from streak
    total_xp: int  # User's new total XP
    level_up: bool = False
    new_level: Optional[int] = None  # New level after this activity
    previous_level: Optional[int] = None  # Previous level before activity
    current_streak: Optional[int] = None  # New streak count
    previous_streak: Optional[int] = None  # Previous streak count
    badges_earned: List[str] = []


# ============================================================================
# STATISTICS MODELS
# ============================================================================

class UserStats(BaseModel):
    """Comprehensive user statistics model"""
    total_points: int  # Deprecated - kept for backward compatibility
    total_xp: int  # New XP field as per PRD
    current_streak: int
    longest_streak: int
    level: int  # Deprecated - kept for backward compatibility
    current_level: int  # New field as per PRD
    xp_for_next_level: int  # New field as per PRD
    today_points: int  # Deprecated - kept for backward compatibility
    today_xp: int  # New XP field as per PRD
    week_points: int  # Deprecated - kept for backward compatibility
    week_xp: int  # New XP field as per PRD
    month_points: int  # Deprecated - kept for backward compatibility
    month_xp: int  # New XP field as per PRD
    total_activities: int
    activities_by_type: Dict[str, int]
    average_accuracy: Optional[float] = None


class DashboardResponse(BaseModel):
    """Complete dashboard response model"""
    profile: UserProfile
    stats: UserStats
    recent_activities: List[Dict[str, Any]]
    badges: List[str]
    recommendations: List[Dict[str, str]]


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class OnboardingStatusResponse(BaseModel):
    """Response model for onboarding status check"""
    completed: bool
    completed_at: Optional[str] = None
    redirect_to: str
    preferences: Optional[Dict[str, Any]] = None


class OnboardingCompletionResponse(BaseModel):
    """Response model for onboarding completion"""
    message: str
    points_earned: int
    badges_earned: List[str]
    level_up: bool
    redirect_to: str


class OnboardingPreferencesResponse(BaseModel):
    """Response model for getting onboarding preferences"""
    onboarding_data: Dict[str, Any]
    completed_at: Optional[str] = None


class ActivityHistoryResponse(BaseModel):
    """Response model for activity history"""
    activities: List[Dict[str, Any]]
    count: int


class HealthCheckResponse(BaseModel):
    """Response model for health check"""
    status: str
    service: str
    cosmos_db_connected: bool
    containers: List[str]
    auth_method: str
    onboarding_support: str
    features: List[str]
    error: Optional[str] = None