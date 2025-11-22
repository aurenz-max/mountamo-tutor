"""
Pydantic models for practice problems and evaluations
"""

from typing import List, Optional, Dict, Any, Literal, Union
from pydantic import BaseModel, Field
from datetime import datetime


# ============================================================================
# PROBLEM TYPES (matching main backend schemas)
# ============================================================================

class ProblemOption(BaseModel):
    """Option for multiple choice questions"""
    id: str
    text: str
    visual_data: Optional[Dict[str, Any]] = None


class VisualData(BaseModel):
    """Visual representation for problems"""
    type: str  # 'object-collection', 'scene', 'diagram', etc.
    data: Dict[str, Any]


class BaseProblem(BaseModel):
    """Base fields for all problem types"""
    id: str
    problem_type: str
    difficulty: Literal["easy", "medium", "hard"]
    grade_level: str
    rationale: str
    teaching_note: Optional[str] = None
    success_criteria: List[str]
    metadata: Optional[Dict[str, Any]] = None


class MultipleChoiceProblem(BaseProblem):
    """Multiple choice question"""
    problem_type: Literal["multiple_choice"] = "multiple_choice"
    question: str
    options: List[ProblemOption]
    correct_option_id: str
    question_visual_data: Optional[VisualData] = None
    question_visual_intent: Optional[str] = None


class TrueFalseProblem(BaseProblem):
    """True/False question"""
    problem_type: Literal["true_false"] = "true_false"
    statement: str
    correct_answer: bool
    statement_visual_data: Optional[VisualData] = None
    statement_visual_intent: Optional[str] = None


class FillInBlankProblem(BaseProblem):
    """Fill in the blank question"""
    problem_type: Literal["fill_in_blanks"] = "fill_in_blanks"
    sentence_template: str
    blanks: List[Dict[str, Any]]
    sentence_visual_data: Optional[VisualData] = None


class MatchingActivity(BaseProblem):
    """Matching pairs activity"""
    problem_type: Literal["matching_activity"] = "matching_activity"
    instruction: str
    pairs: List[Dict[str, str]]
    left_column_visual_data: Optional[VisualData] = None
    right_column_visual_data: Optional[VisualData] = None


class SequencingActivity(BaseProblem):
    """Sequencing/ordering activity"""
    problem_type: Literal["sequencing_activity"] = "sequencing_activity"
    instruction: str
    items: List[Dict[str, Any]]
    correct_order: List[str]
    items_visual_data: Optional[VisualData] = None


class CategorizationActivity(BaseProblem):
    """Categorization/sorting activity"""
    problem_type: Literal["categorization_activity"] = "categorization_activity"
    instruction: str
    categories: List[str]
    items: List[Dict[str, Any]]
    correct_categorization: Dict[str, List[str]]
    items_visual_data: Optional[VisualData] = None


class ScenarioQuestion(BaseProblem):
    """Scenario-based question"""
    problem_type: Literal["scenario_question"] = "scenario_question"
    scenario_text: str
    question: str
    options: List[ProblemOption]
    correct_option_id: str
    scenario_visual_data: Optional[VisualData] = None


class ShortAnswerProblem(BaseProblem):
    """Short answer question"""
    problem_type: Literal["short_answer"] = "short_answer"
    question: str
    sample_answers: List[str]
    grading_criteria: List[str]
    question_visual_data: Optional[VisualData] = None


# Union type for all problem types
Problem = Union[
    MultipleChoiceProblem,
    TrueFalseProblem,
    FillInBlankProblem,
    MatchingActivity,
    SequencingActivity,
    CategorizationActivity,
    ScenarioQuestion,
    ShortAnswerProblem
]


# ============================================================================
# PROBLEM GENERATION METADATA
# ============================================================================

class GenerationMetadata(BaseModel):
    """Metadata about how a problem was generated"""
    generation_prompt: Optional[str] = None
    generation_model: Optional[str] = None
    generation_temperature: Optional[float] = None
    generation_timestamp: Optional[datetime] = None
    generation_duration_ms: Optional[int] = None


class EditHistoryEntry(BaseModel):
    """Single edit to a problem"""
    timestamp: datetime
    user: str
    changes: Dict[str, Any]  # Field name -> old/new value


# ============================================================================
# PROBLEM CRUD MODELS
# ============================================================================

class ProblemCreate(BaseModel):
    """Create a new problem"""
    subskill_id: str
    version_id: str
    problem_type: str
    problem_json: Dict[str, Any]
    generation_metadata: Optional[GenerationMetadata] = None
    is_draft: bool = True


class ProblemUpdate(BaseModel):
    """Update an existing problem"""
    problem_json: Optional[Dict[str, Any]] = None
    is_draft: Optional[bool] = None
    is_active: Optional[bool] = None


class ProblemInDB(BaseModel):
    """Problem as stored in database"""
    problem_id: str
    subskill_id: str
    version_id: str
    problem_type: str
    problem_json: Dict[str, Any]

    # Generation metadata
    generation_prompt: Optional[str] = None
    generation_model: Optional[str] = None
    generation_temperature: Optional[float] = None
    generation_timestamp: Optional[datetime] = None
    generation_duration_ms: Optional[int] = None
    generation_metadata: Optional[Dict[str, Any]] = None  # Extended metadata from phases

    # Status
    is_draft: bool
    is_active: bool

    # Metadata
    created_at: datetime
    updated_at: datetime
    last_edited_by: Optional[str] = None
    edit_history: Optional[List[EditHistoryEntry]] = None


class ProblemGenerationRequest(BaseModel):
    """Request to generate problems for a subskill"""
    subskill_id: str
    version_id: str
    count: int = Field(default=5, ge=1, le=20)
    problem_types: Optional[List[str]] = None  # If None, generate variety
    temperature: float = Field(default=0.7, ge=0.0, le=1.0)
    auto_evaluate: bool = True  # Automatically run evaluation after generation


# ============================================================================
# EVALUATION MODELS
# ============================================================================

class StructuralValidationResult(BaseModel):
    """Tier 1: Structural validation results"""
    passed: bool
    issues: List[str] = []
    required_fields_present: bool
    valid_enums: bool
    valid_types: bool
    visual_intent_valid: Optional[bool] = None


class VisualCoherence(BaseModel):
    """Visual coherence checks for UI rendering"""
    passes_constraints: bool
    max_char_count: int
    longest_word_length: int
    max_line_breaks: int
    has_overflow_risk: bool
    has_forbidden_content: bool
    issues: List[str] = []


class HeuristicValidationResult(BaseModel):
    """Tier 2: Heuristic validation results"""
    passed: bool
    readability_score: Optional[float] = None
    readability_appropriate: bool = True
    has_placeholders: bool = False
    total_char_count: int
    word_count: int
    visual_coherence: VisualCoherence
    warnings: List[str] = []
    failures: List[str] = []


class LLMJudgment(BaseModel):
    """Tier 3: LLM-based pedagogical evaluation"""
    reasoning: str

    # 5 Evaluation Dimensions (1-10 scale)
    pedagogical_approach_score: int = Field(ge=1, le=10)
    pedagogical_approach_justification: str

    alignment_score: int = Field(ge=1, le=10)
    alignment_justification: str

    clarity_score: int = Field(ge=1, le=10)
    clarity_justification: str

    correctness_score: int = Field(ge=1, le=10)
    correctness_justification: str

    bias_score: int = Field(ge=1, le=10)
    bias_justification: str

    # Overall assessment
    overall_quality: Literal["excellent", "good", "needs_revision", "unacceptable"]
    recommended_action: Literal["approve", "approve_with_suggestions", "revise", "reject"]
    improvement_suggestions: List[str]

    # Metadata
    evaluation_prompt: Optional[str] = None
    evaluation_model: str
    evaluation_temperature: float
    evaluation_timestamp: str


class ProblemEvaluationResult(BaseModel):
    """Complete evaluation result for a problem"""
    evaluation_id: str
    problem_id: str
    evaluation_timestamp: datetime

    # Tier 1: Structural
    tier1_passed: bool
    tier1_issues: List[str]

    # Tier 2: Heuristics
    tier2_passed: bool
    readability_score: Optional[float] = None
    visual_coherence_passed: bool
    tier2_issues: List[str]

    # Tier 3: LLM Judge
    pedagogical_approach_score: Optional[int] = None
    alignment_score: Optional[int] = None
    clarity_score: Optional[int] = None
    correctness_score: Optional[int] = None
    bias_score: Optional[int] = None
    llm_reasoning: Optional[str] = None
    llm_suggestions: Optional[List[str]] = None

    # Final results
    final_recommendation: Literal["approve", "revise", "reject"]
    overall_score: float  # 0-10

    # Full reports
    structural_result: StructuralValidationResult
    heuristic_result: HeuristicValidationResult
    llm_judgment: Optional[LLMJudgment] = None


class ProblemEvaluationInDB(ProblemEvaluationResult):
    """Evaluation result as stored in database"""
    evaluation_report_json: Dict[str, Any]  # Complete serialized report


# ============================================================================
# CONTENT EVALUATION MODELS
# ============================================================================

class SectionReadability(BaseModel):
    """Readability score for a single section"""
    section_id: str
    readability_score: float
    appropriate: bool
    issues: List[str] = []


class SectionWordCount(BaseModel):
    """Word count compliance for a section"""
    section_id: str
    section_type: str
    word_count: int
    target_min: int
    target_max: int
    compliant: bool


class ContentHeuristicResult(BaseModel):
    """Tier 2: Content quality heuristics"""
    passed: bool
    section_word_counts: List[SectionWordCount]
    primitive_count: int
    visual_snippet_count: int
    min_primitives_met: bool
    issues: List[str] = []


class ContentLLMJudgment(BaseModel):
    """Tier 3: LLM pedagogical assessment of reading content"""
    reasoning: str

    # 5 Evaluation Dimensions for Content (1-10 scale)
    coverage_score: int = Field(ge=1, le=10)
    coverage_justification: str

    engagement_score: int = Field(ge=1, le=10)
    engagement_justification: str

    coherence_score: int = Field(ge=1, le=10)
    coherence_justification: str

    accuracy_score: int = Field(ge=1, le=10)
    accuracy_justification: str

    inclusivity_score: int = Field(ge=1, le=10)
    inclusivity_justification: str

    # Overall assessment
    overall_quality: Literal["excellent", "good", "needs_revision", "unacceptable"]
    recommended_action: Literal["approve", "approve_with_suggestions", "revise", "reject"]
    improvement_suggestions: List[str]

    # Metadata
    evaluation_prompt: Optional[str] = None
    evaluation_model: str
    evaluation_temperature: float
    evaluation_timestamp: str


class ContentEvaluationResult(BaseModel):
    """Complete evaluation result for reading content"""
    evaluation_id: str
    subskill_id: str
    version_id: str
    evaluation_timestamp: datetime

    # Tier 1: Readability
    tier1_passed: bool
    avg_readability_score: float
    grade_level_appropriate: bool
    section_readability_scores: List[SectionReadability]

    # Tier 2: Content Heuristics
    tier2_passed: bool
    heuristic_result: ContentHeuristicResult

    # Tier 3: LLM Pedagogical Assessment
    coverage_score: Optional[int] = None
    engagement_score: Optional[int] = None
    coherence_score: Optional[int] = None
    accuracy_score: Optional[int] = None
    inclusivity_score: Optional[int] = None
    llm_reasoning: Optional[str] = None
    llm_suggestions: Optional[List[str]] = None

    # Final results
    final_recommendation: Literal["approve", "revise", "reject"]
    overall_score: float  # 0-10

    # Full judgment
    llm_judgment: Optional[ContentLLMJudgment] = None


class ContentEvaluationInDB(ContentEvaluationResult):
    """Content evaluation as stored in database"""
    content_package_id: Optional[str] = None
    evaluation_report_json: Dict[str, Any]


# ============================================================================
# PROMPT TEMPLATE MODELS
# ============================================================================

class PromptTemplateCreate(BaseModel):
    """Create a new prompt template"""
    template_name: str
    template_type: Literal["problem_generation", "content_generation", "problem_evaluation", "content_evaluation"]
    template_text: str
    template_variables: List[str]  # List of required variables
    version: int = 1
    is_active: bool = False
    change_notes: Optional[str] = None


class PromptTemplateUpdate(BaseModel):
    """Update an existing prompt template"""
    template_text: Optional[str] = None
    template_variables: Optional[List[str]] = None
    is_active: Optional[bool] = None
    change_notes: Optional[str] = None


class PerformanceMetrics(BaseModel):
    """Performance metrics for a prompt template"""
    avg_evaluation_score: Optional[float] = None
    approval_rate: Optional[float] = None
    avg_pedagogical_score: Optional[float] = None
    avg_alignment_score: Optional[float] = None
    avg_clarity_score: Optional[float] = None
    avg_correctness_score: Optional[float] = None
    avg_bias_score: Optional[float] = None
    total_generations: int = 0
    total_approvals: int = 0
    total_revisions: int = 0
    total_rejections: int = 0


class PromptTemplateInDB(BaseModel):
    """Prompt template as stored in database"""
    template_id: str
    template_name: str
    template_type: str
    template_text: str
    template_variables: List[str]
    version: int
    is_active: bool

    # Performance tracking
    usage_count: int = 0
    performance_metrics: Optional[PerformanceMetrics] = None

    # Metadata
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    change_notes: Optional[str] = None


class PromptTemplatePerformanceSummary(BaseModel):
    """Summary of prompt template performance"""
    template_name: str
    template_type: str
    active_version: int
    total_versions: int
    best_performing_version: int
    best_score: float
    current_usage_count: int
    current_approval_rate: float
