"""
Assessment-specific review schemas based on PROBLEM_REVIEW_SCHEMA
These match the structure from the provided JSON example
Enhanced with Assessment Focus Tags and Performance Labels per PRD requirements
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

class AssessmentFocusTag(str, Enum):
    """Assessment focus categories with emoji icons for visual identification"""
    WEAK_SPOT = "🎯 Weak Spot"
    RECENT_PRACTICE = "📈 Recent Practice"
    FOUNDATIONAL_REVIEW = "🔄 Foundational Review"
    NEW_FRONTIER = "✨ New Frontier"
    GENERAL = "📚 General"

class PerformanceLabel(str, Enum):
    """4-tier performance classification system"""
    MASTERED = "Mastered"
    PROFICIENT = "Proficient"
    DEVELOPING = "Developing"
    NEEDS_REVIEW = "Needs Review"

class NextStepAction(BaseModel):
    """Next step recommendation with action text and link"""
    text: str = Field(..., description="Action-oriented text (e.g., 'Learn the Basics', 'Practice More')")
    link: str = Field(..., description="URL to appropriate learning resource")
    action_type: str = Field(..., description="Type of action: 'learn', 'practice', 'challenge', 'review'")

class AssessmentReviewObservation(BaseModel):
    """Observation section for assessment reviews"""
    canvas_description: str = Field(..., description="Description of visual work (if any)")
    selected_answer: str = Field(..., description="The answer selected/provided by student")
    work_shown: str = Field(..., description="Description of work or reasoning shown")

class AssessmentReviewAnalysis(BaseModel):
    """Analysis section for assessment reviews"""
    understanding: str = Field(..., description="Analysis of student's conceptual understanding")
    approach: str = Field(..., description="Student's problem-solving approach")
    accuracy: str = Field(..., description="Accuracy of student's response")
    creativity: str = Field(..., description="Note any creative or alternative solutions")

class AssessmentReviewEvaluation(BaseModel):
    """Evaluation section for assessment reviews"""
    score: int = Field(..., ge=0, le=10, description="Numerical score from 0-10")
    justification: str = Field(..., description="Explanation of the score")

class AssessmentReviewFeedback(BaseModel):
    """Feedback section for assessment reviews"""
    praise: str = Field(..., description="Specific praise for student's work")
    guidance: str = Field(..., description="Guidance for improvement")
    encouragement: str = Field(..., description="Encouraging message")
    next_steps: str = Field(..., description="Actionable next steps")

class AssessmentProblemReview(BaseModel):
    """Complete assessment problem review matching PROBLEM_REVIEW_SCHEMA"""
    observation: AssessmentReviewObservation
    analysis: AssessmentReviewAnalysis
    evaluation: AssessmentReviewEvaluation
    feedback: AssessmentReviewFeedback

    # Assessment-specific metadata
    skill_id: str
    subject: str
    subskill_id: str
    score: int = Field(..., ge=0, le=10)
    correct: bool
    accuracy_percentage: int = Field(..., ge=0, le=100)

class AssessmentReviewDocument(BaseModel):
    """
    Complete assessment review document matching the provided JSON example structure
    This is the canonical format for assessment problem reviews
    """
    # Core identification
    id: str
    student_id: int
    subject: str
    skill_id: str
    subskill_id: str
    problem_id: str
    timestamp: str

    # Problem content (the original assessment problem)
    problem_content: Dict[str, Any]  # Will contain AssessmentProblemType data

    # Complete review structure
    full_review: AssessmentProblemReview

    # Flattened top-level fields (matching JSON example)
    observation: AssessmentReviewObservation
    analysis: AssessmentReviewAnalysis
    evaluation: AssessmentReviewEvaluation
    feedback: AssessmentReviewFeedback
    score: int

    # Additional metadata
    firebase_uid: str
    created_at: str

    # Cosmos DB fields (optional)
    _rid: Optional[str] = None
    _self: Optional[str] = None
    _etag: Optional[str] = None
    _attachments: Optional[str] = None
    _ts: Optional[int] = None

class AssessmentSubmissionAnswer(BaseModel):
    """Schema for individual assessment answers"""
    problem_id: str
    student_answer: Optional[str] = None
    selected_option_id: Optional[str] = None  # For MCQ
    selected_options: Optional[Dict[str, str]] = None  # For matching, etc.
    answer_data: Optional[Dict[str, Any]] = None  # For complex answer types

class AssessmentSubmissionRequest(BaseModel):
    """Schema for complete assessment submission"""
    assessment_id: str
    student_id: int
    answers: Dict[str, Any]  # Maps problem_id to answer data
    time_taken_minutes: Optional[int] = None
    submitted_at: Optional[str] = None

class SubskillDetail(BaseModel):
    """Subskill performance detail within a skill analysis"""
    subskill_id: str
    subskill_description: str
    questions: int
    correct: int

class EnhancedSkillAnalysis(BaseModel):
    """Enhanced skill analysis with contextual insights per PRD requirements"""
    skill_id: str  # The skill identifier (aggregated level)
    skill_name: str  # The skill description
    total_questions: int  # Aggregated across all subskills
    correct_count: int   # Aggregated across all subskills

    # Core enhancements from PRD - updated to match service output
    assessment_focus_tag: Optional[AssessmentFocusTag] = Field(None, description="Visual focus category tag")
    performance_label: Optional[PerformanceLabel] = Field(None, description="4-tier performance classification")
    insight_text: Optional[str] = Field(None, description="Context-aware insight combining focus and performance")
    next_step: Optional[NextStepAction] = Field(None, description="Actionable next step recommendation")

    # Additional context data
    percentage: Optional[int] = Field(None, description="Performance percentage for this skill")
    category: Optional[str] = Field(None, description="Internal category from assessment blueprint")

    # Hierarchical metadata
    unit_id: Optional[str] = Field(None, description="Unit identifier")
    unit_title: Optional[str] = Field(None, description="Unit title")

    # Subskill details for targeted recommendations
    subskills: Optional[List[SubskillDetail]] = Field(None, description="Details of subskills tested within this skill")

    # Legacy fields for backward compatibility
    assessment_focus: Optional[str] = Field(None, description="Assessment focus category (legacy)")
    next_step_text: Optional[str] = Field(None, description="Next step text (legacy)")

# Response models that match the new assessment service structure
class AssessmentSummaryData(BaseModel):
    """Summary data from the refactored assessment service"""
    correct_count: int
    total_questions: int
    score_percentage: float
    performance_by_problem_type: Dict[str, Any]
    performance_by_category: Dict[str, Any]
    detailed_metrics: Dict[str, Any]

class AssessmentSkillAnalysisItem(BaseModel):
    """Skill analysis item from the refactored assessment service"""
    skill_id: str
    skill_name: str
    category: str
    total_questions: int
    correct_count: int
    percentage: float
    unit_id: str
    unit_title: str

    # Enhanced fields that match Cosmos DB structure
    assessment_focus_tag: Optional[str] = None
    performance_label: Optional[str] = None
    insight_text: Optional[str] = None
    next_step: Optional[NextStepAction] = None
    subskills: Optional[List[SubskillDetail]] = None

class AssessmentProblemReviewItem(BaseModel):
    """Problem review item from the refactored assessment service"""
    problem_id: str
    is_correct: bool
    score: int
    student_answer_text: str
    correct_answer_text: str
    skill_id: str
    skill_name: str
    subskill_id: str
    subskill_name: str
    unit_id: str
    unit_title: str
    problem_type: str

class AssessmentAIInsights(BaseModel):
    """AI insights from the refactored assessment service"""
    ai_summary: str
    performance_quote: str
    skill_insights: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    common_misconceptions: Optional[List[str]] = Field(default_factory=list)
    problem_insights: Optional[List[Dict[str, Any]]] = Field(default_factory=list)

class EnhancedAssessmentSummaryResponse(BaseModel):
    """Response model for enhanced assessment summary with AI insights - updated for new service structure"""
    assessment_id: str
    student_id: int
    subject: str

    # Summary data (from new structure)
    summary: Optional[AssessmentSummaryData] = None

    # Legacy fields for backward compatibility (marked as optional)
    total_questions: Optional[int] = None
    correct_count: Optional[int] = None
    score_percentage: Optional[float] = None
    time_taken_minutes: Optional[int] = None
    skill_breakdown: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    submitted_at: Optional[str] = None

    # Enhanced fields from new structure
    skill_analysis: Optional[List[AssessmentSkillAnalysisItem]] = Field(default_factory=list)
    problem_reviews: Optional[List[AssessmentProblemReviewItem]] = Field(default_factory=list)
    ai_insights: Optional[AssessmentAIInsights] = None

    # Legacy AI fields (marked as optional for backward compatibility)
    ai_summary: Optional[str] = None
    performance_quote: Optional[str] = None
    common_misconceptions: Optional[List[str]] = Field(default_factory=list)
    review_items: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    ai_summary_generated_at: Optional[str] = None