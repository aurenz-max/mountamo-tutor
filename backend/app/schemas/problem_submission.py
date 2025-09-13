"""
Problem Submission Schemas

This module contains Pydantic schemas for problem submission and result handling.
Used by the SubmissionService to validate submission data and return structured results.
"""

from pydantic import BaseModel
from typing import Dict, Any, List, Optional


class ProblemSubmission(BaseModel):
    """Schema for problem submission requests"""
    subject: str
    problem: Dict[str, Any]
    solution_image: Optional[str] = None  # Optional for interactive problems
    skill_id: str
    subskill_id: Optional[str] = None
    student_answer: Optional[str] = ""
    canvas_used: bool = True
    primitive_response: Optional[Dict[str, Any]] = None  # For interactive problems


class SubmissionResult(BaseModel):
    """Schema for problem submission results"""
    review: Dict[str, Any]
    competency: Dict[str, Any]
    points_earned: int = 0
    encouraging_message: str = ""
    next_recommendations: List[str] = []
    student_id: Optional[int] = None
    user_id: Optional[str] = None
    
    # Engagement system fields
    xp_earned: Optional[int] = None
    base_xp: Optional[int] = None
    streak_bonus_xp: Optional[int] = None
    total_xp: Optional[int] = None
    level_up: Optional[bool] = None
    new_level: Optional[int] = None
    previous_level: Optional[int] = None
    current_streak: Optional[int] = None
    previous_streak: Optional[int] = None