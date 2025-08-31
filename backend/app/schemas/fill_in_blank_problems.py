from typing import Dict, List, Optional
from pydantic import BaseModel, Field, validator
from datetime import datetime


class BlankAnswer(BaseModel):
    """Model for individual fill-in-the-blank answer"""
    id: str = Field(..., description="Stable ID for the blank, e.g. 'B1', 'B2'")
    correct_answers: List[str] = Field(
        ..., description="List of acceptable answers (case-insensitive match)"
    )
    case_sensitive: bool = Field(
        default=False, description="Whether answer matching is case sensitive"
    )
    tolerance: Optional[float] = Field(
        None, description="Numeric tolerance if answer is numeric (e.g., ±0.01)"
    )
    hint: Optional[str] = Field(
        None, description="Optional hint for the blank (not always shown to student)"
    )

    @validator("id")
    def id_must_be_valid_format(cls, v):
        if not v or not v.startswith('B'):
            raise ValueError("Blank ID must start with 'B' (e.g., 'B1', 'B2')")
        return v


class FillInBlankPayload(BaseModel):
    """Request model for Fill-in-the-blank generation"""
    subject: str = Field(..., examples=["Biology", "Math", "Language Arts"])
    unit_id: Optional[str] = Field(None, description="Specific unit ID to focus on")
    skill_id: Optional[str] = Field(None, description="Specific skill ID to focus on")
    subskill_id: Optional[str] = Field(None, description="Specific subskill ID to focus on")
    difficulty: Optional[str] = Field(default="medium", description="easy|medium|hard")
    blank_style: Optional[str] = Field(
        default="standard",
        description="standard | numeric | short-answer | single-word"
    )
    
    @validator("difficulty")
    def validate_difficulty(cls, v):
        if v not in {"easy", "medium", "hard"}:
            raise ValueError("difficulty must be one of: easy|medium|hard")
        return v

    @validator("blank_style")
    def validate_blank_style(cls, v):
        valid_styles = {"standard", "numeric", "short-answer", "single-word"}
        if v not in valid_styles:
            raise ValueError(f"blank_style must be one of: {', '.join(valid_styles)}")
        return v


class FillInBlankResponse(BaseModel):
    """Complete Fill-in-the-blank response model"""
    id: str = Field(..., description="Deterministic content hash or UUID.")
    subject: str
    unit_id: str
    skill_id: str
    subskill_id: str
    difficulty: str
    text_with_blanks: str = Field(
        ...,
        description=(
            "Question text with placeholders like {{B1}}, {{B2}} where blanks go. "
            "E.g. 'The capital of France is {{B1}}.'"
        ),
    )
    blanks: List[BlankAnswer] = Field(..., description="Answer key for each blank")
    rationale: str = Field(..., description="Explanation of why answers are correct")
    metadata: dict = Field(default_factory=dict)

    @validator("text_with_blanks")
    def validate_blanks_in_text(cls, v, values):
        blanks = values.get("blanks", [])
        if blanks:
            blank_ids_in_text = []
            import re
            # Find all {{...}} patterns
            matches = re.findall(r'\{\{([^}]+)\}\}', v)
            blank_ids_in_text = matches
            
            blank_ids_in_blanks = [blank.id for blank in blanks]
            
            # Check that all blanks referenced in text exist in blanks list
            for blank_id in blank_ids_in_text:
                if blank_id not in blank_ids_in_blanks:
                    raise ValueError(f"Blank '{blank_id}' referenced in text but not defined in blanks")
        return v


class StudentBlankAnswer(BaseModel):
    """Student's answer for a specific blank"""
    blank_id: str = Field(..., description="ID of the blank being answered")
    answer: str = Field(..., description="Student's answer for this blank")


class FillInBlankSubmission(BaseModel):
    """Fill-in-the-blank submission model with full problem object"""
    fill_in_blank: FillInBlankResponse = Field(..., description="Complete fill-in-the-blank object being submitted")
    student_answers: List[StudentBlankAnswer] = Field(..., description="Student's answers for all blanks")
    submitted_at: datetime = Field(default_factory=datetime.utcnow)


class BlankEvaluation(BaseModel):
    """Evaluation result for a single blank"""
    blank_id: str
    student_answer: str
    correct_answers: List[str]
    is_correct: bool
    partial_credit: float = Field(default=0.0, ge=0.0, le=1.0)
    feedback: str


class FillInBlankReview(BaseModel):
    """Fill-in-the-blank review/feedback model"""
    overall_correct: bool
    total_score: float = Field(..., ge=0.0, le=10.0)
    blank_evaluations: List[BlankEvaluation]
    explanation: str
    percentage_correct: float = Field(..., ge=0.0, le=100.0)
    metadata: Dict = Field(default_factory=dict)


class FillInBlankGenerationRequest(BaseModel):
    """Internal request for Fill-in-the-blank generation service"""
    subject: str
    unit_id: str
    skill_id: str
    subskill_id: str
    difficulty: str
    blank_style: str
    description: str
    concept_group: str
    detailed_objective: str