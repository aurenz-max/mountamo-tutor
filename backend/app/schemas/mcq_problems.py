from typing import Dict, List, Optional
from pydantic import BaseModel, Field, validator
from datetime import datetime


class MCQOption(BaseModel):
    """Model for individual multiple choice option"""
    id: str = Field(..., description="Stable ID for the option, e.g., 'A', 'B', 'C', 'D'.")
    text: str = Field(..., description="Option text, student-facing, 10-120 chars.")

    @validator("id")
    def id_must_be_alphabetical(cls, v):
        if not (v and v.lower() in ["a", "b", "c", "d", "e", "f"]):
            raise ValueError("Option ID must be A-F (case insensitive)")
        return v.upper()


class MCQPayload(BaseModel):
    """Request model for MCQ generation"""
    subject: str = Field(..., examples=["Biology", "Math", "Language Arts"])
    unit_id: Optional[str] = Field(None, description="Specific unit ID to focus on")
    skill_id: Optional[str] = Field(None, description="Specific skill ID to focus on")
    subskill_id: Optional[str] = Field(None, description="Specific subskill ID to focus on")
    difficulty: Optional[str] = Field(default="medium", description="easy|medium|hard")
    distractor_style: Optional[str] = Field(
        default="plausible",
        description="plausible | humorous-but-educational | common-misconception"
    )
    count: int = Field(
        default=1, 
        ge=1, 
        le=10, 
        description="Number of questions to generate. Defaults to 1."
    )

    @validator("difficulty")
    def validate_difficulty(cls, v):
        if v not in {"easy", "medium", "hard"}:
            raise ValueError("difficulty must be one of: easy|medium|hard")
        return v

    @validator("distractor_style")
    def validate_distractor_style(cls, v):
        valid_styles = {"plausible", "humorous-but-educational", "common-misconception"}
        if v not in valid_styles:
            raise ValueError(f"distractor_style must be one of: {', '.join(valid_styles)}")
        return v


class MCQResponse(BaseModel):
    """Complete MCQ response model"""
    id: str = Field(..., description="Deterministic content hash or UUID.")
    subject: str
    unit_id: str
    skill_id: str
    subskill_id: str
    difficulty: str
    question: str = Field(..., description="One clear question, 15-200 chars.")
    options: List[MCQOption] = Field(..., min_items=4, max_items=6)
    correct_option_id: str = Field(..., description="Must match one of options[].id")
    rationale: str = Field(..., description="Explain why correct is correct; 1-3 sentences.")
    metadata: Dict = Field(default_factory=dict, description="Concept group, learning objectives, etc.")

    @validator("correct_option_id")
    def validate_correct_option(cls, v, values):
        options = values.get("options", [])
        if options and v not in {opt.id for opt in options}:
            raise ValueError("correct_option_id must exist in options[].id")
        return v


class MCQSubmission(BaseModel):
    """MCQ submission model with full MCQ object"""
    mcq: MCQResponse = Field(..., description="Complete MCQ object being submitted")
    selected_option_id: str
    submitted_at: datetime = Field(default_factory=datetime.utcnow)


class MCQReview(BaseModel):
    """MCQ review/feedback model"""
    is_correct: bool
    selected_option_id: str
    correct_option_id: str
    explanation: str
    selected_option_text: str
    correct_option_text: str
    metadata: Dict = Field(default_factory=dict)


class MCQGenerationRequest(BaseModel):
    """Internal request for MCQ generation service"""
    subject: str
    unit_id: str
    skill_id: str
    subskill_id: str
    difficulty: str
    distractor_style: str
    description: str
    concept_group: str
    detailed_objective: str


class MCQResponseBatch(BaseModel):
    """Complete MCQ batch response model"""
    questions: List[MCQResponse] = Field(..., description="A list of generated multiple-choice questions.")
    metadata: Dict = Field(default_factory=dict, description="Shared metadata for the batch, e.g., request parameters.")
