# app/schemas/true_false_problems.py
from __future__ import annotations
from typing import Optional, Dict, List
from pydantic import BaseModel, Field
from datetime import datetime

class TrueFalseProblem(BaseModel):
    id: str
    subject: str
    skill_id: str
    subskill_id: Optional[str] = None
    difficulty: str  # easy | medium | hard
    statement: str = Field(..., description="A single, clear, unambiguous claim.")
    correct: bool = Field(..., description="True if the statement is correct; otherwise False.")
    prompt: str = Field(
        default="Decide whether the statement is True or False.",
        description="Instruction shown to the student."
    )
    rationale: str = Field(
        ..., description="1–3 sentences explaining why the statement is true or false."
    )
    allow_explain_why: bool = Field(
        default=False, description="If True, UI should also collect a brief student explanation."
    )
    trickiness: Optional[str] = Field(
        default=None, description="Optional: none | negation | absolute_terms | subtle_detail"
    )
    metadata: Dict[str, str] = Field(default_factory=dict)

class TrueFalsePayload(BaseModel):
    """Payload for generating true/false problems"""
    subject: str
    unit_id: Optional[str] = None
    skill_id: Optional[str] = None
    subskill_id: Optional[str] = None
    difficulty: Optional[str] = "medium"
    allow_explain_why: bool = Field(default=False, description="Whether to ask students to explain their answer")
    trickiness: Optional[str] = Field(default="none", description="Level of trickiness: none | negation | absolute_terms | subtle_detail")

class TrueFalseResponse(TrueFalseProblem):
    """Response model for true/false problem generation"""
    pass

class TrueFalseSubmission(BaseModel):
    """Student submission for true/false problems"""
    true_false: TrueFalseResponse
    selected_answer: bool = Field(..., description="Student's true/false selection")
    explanation: Optional[str] = Field(default=None, description="Optional student explanation if allow_explain_why is True")
    submitted_at: datetime = Field(default_factory=datetime.utcnow)

class TrueFalseReview(BaseModel):
    """Review result for true/false submissions"""
    is_correct: bool
    selected_answer: bool
    correct_answer: bool
    explanation: str = Field(..., description="Explanation of the correct answer")
    student_explanation: Optional[str] = None
    explanation_feedback: Optional[str] = Field(default=None, description="Feedback on student's explanation if provided")
    metadata: Dict[str, str] = Field(default_factory=dict)

class TFGenPayload(BaseModel):
    """Internal payload for true/false generation"""
    subject: str
    skill: str
    difficulty: str
    allow_explain_why: bool = False
    trickiness: str = "none"