from typing import Dict, List, Optional
from pydantic import BaseModel, Field, validator
from datetime import datetime


class AssocItem(BaseModel):
    """Model for individual matching item (left or right side)"""
    id: str = Field(..., description="Stable ID, e.g., 'L1' or 'R3'")
    text: str = Field(..., description="Student-facing text label")
    image_url: Optional[str] = Field(
        None, description="Optional image for the item (diagram, icon, etc.)"
    )
    metadata: Dict[str, str] = Field(default_factory=dict)


class LeftToRightMapping(BaseModel):
    """Model for correct answer mappings from left to right items"""
    left_id: str = Field(..., description="Must match an id in left_items")
    right_ids: List[str] = Field(
        ..., description="One or more right-side ids that correctly match this left id"
    )
    rationale: Optional[str] = Field(
        None, description="Brief explanation for why these are correct"
    )

    @validator("right_ids")
    def _non_empty(cls, v):
        if not v:
            raise ValueError("right_ids must contain at least one id")
        return v


class MatchingPayload(BaseModel):
    """Request model for matching problem generation"""
    subject: str = Field(..., examples=["Biology", "Math", "Language Arts"])
    unit_id: Optional[str] = Field(None, description="Specific unit ID to focus on")
    skill_id: Optional[str] = Field(None, description="Specific skill ID to focus on")
    subskill_id: Optional[str] = Field(None, description="Specific subskill ID to focus on")
    difficulty: Optional[str] = Field(default="medium", description="easy|medium|hard")
    matching_style: Optional[str] = Field(
        default="one_to_one",
        description="one_to_one | one_to_many | with_distractors"
    )
    count: int = Field(
        default=1, 
        ge=1, 
        le=10, 
        description="Number of matching problems to generate. Defaults to 1."
    )

    @validator("difficulty")
    def validate_difficulty(cls, v):
        if v not in {"easy", "medium", "hard"}:
            raise ValueError("difficulty must be one of: easy|medium|hard")
        return v

    @validator("matching_style")
    def validate_matching_style(cls, v):
        valid_styles = {"one_to_one", "one_to_many", "with_distractors"}
        if v not in valid_styles:
            raise ValueError(f"matching_style must be one of: {', '.join(valid_styles)}")
        return v


class MatchingResponse(BaseModel):
    """Complete matching problem response model"""
    id: str = Field(..., description="Deterministic content hash or UUID.")
    subject: str
    unit_id: str
    skill_id: str
    subskill_id: str
    difficulty: str
    prompt: str = Field(
        ...,
        description="Instruction shown to the student, e.g., 'Match each term to its definition.'"
    )
    left_items: List[AssocItem] = Field(
        ..., min_items=2, description="Typically terms, causes, words, images to be matched FROM"
    )
    right_items: List[AssocItem] = Field(
        ..., min_items=2, description="Typically definitions, effects, categories, labels TO match"
    )
    mappings: List[LeftToRightMapping] = Field(
        ..., description="Ground truth mapping. Supports one-to-one OR one-to-many."
    )
    allow_many_to_one: bool = Field(
        default=True,
        description="If True, multiple left items may map to the same right item."
    )
    include_distractors: bool = Field(
        default=False,
        description="If True, some right_items will not map to any left item."
    )
    shuffle_left: bool = Field(default=True)
    shuffle_right: bool = Field(default=True)
    rationale_global: Optional[str] = Field(
        None, description="Optional overall explanation or teaching note"
    )
    metadata: Dict[str, str] = Field(default_factory=dict)

    @validator("mappings")
    def _left_ids_exist(cls, v, values):
        left_ids = {li.id for li in values.get("left_items", [])}
        right_ids = {ri.id for ri in values.get("right_items", [])}
        for m in v:
            if m.left_id not in left_ids:
                raise ValueError(f"Mapping references unknown left_id '{m.left_id}'")
            for rid in m.right_ids:
                if rid not in right_ids:
                    raise ValueError(f"Mapping references unknown right_id '{rid}'")
        return v


class StudentMatching(BaseModel):
    """Model for student's matching pair"""
    left_id: str = Field(..., description="Left item ID student selected")
    right_id: str = Field(..., description="Right item ID student matched to")


class MatchingSubmission(BaseModel):
    """Matching submission model with full matching object"""
    matching: MatchingResponse = Field(..., description="Complete matching object being submitted")
    student_matches: List[StudentMatching] = Field(
        ..., description="Student's matching pairs"
    )
    submitted_at: datetime = Field(default_factory=datetime.utcnow)


class MatchingEvaluation(BaseModel):
    """Individual matching pair evaluation"""
    left_id: str
    right_id: str
    is_correct: bool
    expected_right_ids: List[str]
    feedback: Optional[str] = None


class MatchingReview(BaseModel):
    """Matching review/feedback model"""
    overall_correct: bool
    total_score: float = Field(..., description="Score out of 10")
    match_evaluations: List[MatchingEvaluation] = Field(
        ..., description="Per-match evaluation details"
    )
    explanation: str = Field(..., description="Overall explanation and feedback")
    percentage_correct: float = Field(..., description="Percentage of matches correct")
    metadata: Dict = Field(default_factory=dict)


class MatchingGenerationRequest(BaseModel):
    """Internal request for matching generation service"""
    subject: str
    unit_id: str
    skill_id: str
    subskill_id: str
    difficulty: str
    matching_style: str
    description: str
    concept_group: str
    detailed_objective: str


class MatchingResponseBatch(BaseModel):
    """Complete matching batch response model"""
    problems: List[MatchingResponse] = Field(..., description="A list of generated matching problems.")
    metadata: Dict = Field(default_factory=dict, description="Shared metadata for the batch, e.g., request parameters.")