"""
Assessment-specific review schemas based on PROBLEM_REVIEW_SCHEMA
These match the structure from the provided JSON example
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime

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