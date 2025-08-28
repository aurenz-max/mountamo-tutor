"""
Problem Library Data Models

Backend models that align with the frontend primitive system.
Matches the TypeScript interfaces defined in PrimitiveTypes.ts
"""

from typing import Optional, Dict, List, Any, Literal, Union
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum


class SkillDomain(str, Enum):
    """Available skill domains - matches frontend"""
    MATH = "math"
    SCIENCE = "science"  
    BIOLOGY = "biology"
    ASTRONOMY = "astronomy"
    ELA = "ela"
    SOCIAL_STUDIES = "social_studies"


class ProblemType(str, Enum):
    """Available problem types - matches frontend ProblemTemplate.type"""
    VISUAL = "visual"
    TEXT = "text"
    MULTIPLE_CHOICE = "multiple_choice"
    CANVAS = "canvas"


class PrimitiveComponent(str, Enum):
    """Available primitive components - matches frontend component names"""
    # Math primitives
    NUMBER_LINE = "NumberLine"
    FRACTION_BARS = "FractionBars"
    AREA_MODEL = "AreaModel"
    
    # Biology primitives
    DIAGRAM_LABELER = "DiagramLabeler"
    PART_FUNCTION_MATCHER = "PartFunctionMatcher"
    
    # Astronomy primitives
    MOON_PHASE_SELECTOR = "MoonPhaseSelector"
    ORBIT_PANEL = "OrbitPanel"
    
    # ELA primitives
    EVIDENCE_HIGHLIGHTER = "EvidenceHighlighter"
    PARTS_OF_SPEECH_TAGGER = "PartsOfSpeechTagger"
    
    # Social Studies primitives
    MAP_LABELER = "MapLabeler"
    TIMELINE_BUILDER = "TimelineBuilder"


class GradingType(str, Enum):
    """Grading configuration types - matches frontend"""
    EXACT_MATCH = "exact_match"
    FUZZY_MATCH = "fuzzy_match"
    RANGE_MATCH = "range_match"
    CUSTOM = "custom"


# Core Models

class Skill(BaseModel):
    """Skill model - integrates with existing curriculum system"""
    id: str = Field(..., description="Unique skill identifier")
    name: str = Field(..., description="Human-readable skill name")
    grade: int = Field(..., ge=0, le=12, description="Grade level (0=K, 1-12)")
    domain: SkillDomain = Field(..., description="Subject domain")
    objective: str = Field(..., description="Learning objective description")
    prerequisites: List[str] = Field(default=[], description="List of prerequisite skill IDs")
    tags: List[str] = Field(default=[], description="Searchable tags")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class PrimitiveAnswer(BaseModel):
    """Matches frontend PrimitiveAnswer interface"""
    type: str = Field(..., description="Type of primitive answer")
    value: Any = Field(..., description="The answer value")
    metadata: Dict[str, Any] = Field(default={}, description="Additional metadata")


class PrimitiveConfig(BaseModel):
    """Matches frontend PrimitiveConfig interface"""
    component: PrimitiveComponent = Field(..., description="Component name to render")
    props: Dict[str, Any] = Field(..., description="Props to pass to the component")


class GradingConfig(BaseModel):
    """Matches frontend GradingConfig interface"""
    type: GradingType = Field(..., description="Type of grading")
    tolerance: Optional[float] = Field(None, description="Tolerance for range matching")
    custom_grader: Optional[str] = Field(None, description="Custom grader function name")


class TemplateMetadata(BaseModel):
    """Matches frontend TemplateMetadata interface"""
    difficulty: int = Field(..., ge=1, le=5, description="Difficulty rating 1-5")
    estimated_time_minutes: int = Field(..., ge=1, description="Estimated completion time")
    tags: List[str] = Field(default=[], description="Searchable tags")
    accessibility_notes: Optional[str] = Field(None, description="Accessibility requirements")
    i18n_keys: List[str] = Field(default=[], description="Internationalization keys")


class ProblemTemplate(BaseModel):
    """
    Problem template model - matches frontend ProblemTemplate interface
    This is the main template that defines how problems are generated
    """
    id: str = Field(..., description="Unique template identifier")
    type: ProblemType = Field(..., description="Type of problem")
    subject: str = Field(..., description="Subject area")
    skill_id: str = Field(..., description="Associated skill ID")
    primitive: Optional[PrimitiveConfig] = Field(None, description="Primitive component config")
    problem_text: str = Field(..., description="Problem text with templating")
    params: Dict[str, Any] = Field(..., description="Template parameters")
    answer_key: Any = Field(..., description="Correct answer template")
    grading_config: GradingConfig = Field(..., description="How to grade this problem")
    metadata: TemplateMetadata = Field(..., description="Template metadata")
    
    # Additional fields for backend processing
    version: str = Field(default="1.0.0", description="Template version")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    active: bool = Field(default=True, description="Whether template is active")


class DomainPack(BaseModel):
    """Domain-specific data and assets"""
    id: str = Field(..., description="Unique domain pack identifier")
    name: str = Field(..., description="Human-readable pack name")
    domain: SkillDomain = Field(..., description="Subject domain")
    version: str = Field(default="1.0.0", description="Semantic version")
    
    # Data contents
    facts: Dict[str, Any] = Field(default={}, description="Factual data for the domain")
    svg_assets: Dict[str, str] = Field(default={}, description="SVG asset definitions")
    images: Dict[str, str] = Field(default={}, description="Image asset URLs")
    
    # Metadata
    description: str = Field(..., description="Pack description")
    tags: List[str] = Field(default=[], description="Searchable tags")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ProblemInstance(BaseModel):
    """
    Generated problem instance - matches what frontend expects
    This represents a specific generated problem from a template
    """
    id: str = Field(..., description="Unique problem instance identifier")
    template_id: str = Field(..., description="Source template ID")
    skill_id: str = Field(..., description="Associated skill ID")
    
    # Instance data that matches frontend problem structure
    problem_id: str = Field(..., description="Matches frontend problem_id field")
    type: str = Field(..., description="Matches frontend type field")
    subject: str = Field(..., description="Subject area")
    subskill_id: Optional[str] = Field(None, description="Subskill identifier")
    difficulty: int = Field(..., description="Difficulty level")
    timestamp: str = Field(..., description="Creation timestamp")
    
    # Problem data that matches frontend structure
    problem_data: Dict[str, Any] = Field(..., description="Complete problem data matching frontend interface")
    
    # Generation metadata
    generation_seed: Optional[str] = Field(None, description="Random seed for reproducibility")
    generator_type: Literal["rule_based", "llm_assisted"] = Field(..., description="How it was generated")
    template_version: str = Field(..., description="Template version used")
    
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ProblemAttempt(BaseModel):
    """Student's attempt at a problem"""
    id: str = Field(..., description="Unique attempt identifier")
    problem_instance_id: str = Field(..., description="Problem instance ID")
    student_id: str = Field(..., description="Student identifier")
    
    # Attempt data
    user_response: Any = Field(..., description="Student's response")
    is_correct: bool = Field(..., description="Whether the response was correct")
    partial_credit: Optional[float] = Field(None, ge=0, le=1, description="Partial credit score")
    
    # Visual problem specific fields
    canvas_data: Optional[str] = Field(None, description="Canvas drawing data")
    primitive_answer: Optional[PrimitiveAnswer] = Field(None, description="Primitive component answer")
    
    # Performance metrics
    time_spent_seconds: int = Field(..., ge=0, description="Time spent on problem")
    hints_requested: int = Field(default=0, description="Number of hints used")
    attempts_made: int = Field(default=1, description="Number of attempts made")
    
    # Feedback
    feedback: Optional[Dict[str, Any]] = Field(None, description="Grading feedback")
    score: Optional[float] = Field(None, description="Numerical score")
    
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TelemetryEvent(BaseModel):
    """Telemetry event for tracking usage and performance"""
    id: str = Field(..., description="Unique event identifier")
    event_type: Literal[
        "render", "attempt", "correct", "incorrect", 
        "hint_requested", "time_spent", "primitive_interaction"
    ] = Field(..., description="Type of event")
    
    # Context
    student_id: str = Field(..., description="Student identifier")
    problem_instance_id: Optional[str] = Field(None, description="Problem instance ID")
    skill_id: Optional[str] = Field(None, description="Skill ID")
    template_id: Optional[str] = Field(None, description="Template ID")
    
    # Event data
    event_data: Dict[str, Any] = Field(default={}, description="Event-specific data")
    
    # Session context
    session_id: Optional[str] = Field(None, description="Learning session ID")
    device_type: Optional[str] = Field(None, description="Device type (mobile/desktop)")
    
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# API Request/Response Models

class SkillListRequest(BaseModel):
    """Request for listing skills"""
    domain: Optional[SkillDomain] = None
    grade: Optional[int] = Field(None, ge=0, le=12)
    tags: Optional[List[str]] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class SkillListResponse(BaseModel):
    """Response for listing skills"""
    skills: List[Skill]
    total_count: int
    page: int
    page_size: int


class TemplateListRequest(BaseModel):
    """Request for listing templates"""
    skill_id: Optional[str] = None
    type: Optional[ProblemType] = None
    subject: Optional[str] = None
    difficulty: Optional[int] = Field(None, ge=1, le=5)
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class TemplateListResponse(BaseModel):
    """Response for listing templates"""
    templates: List[ProblemTemplate]
    total_count: int
    page: int
    page_size: int


class GenerateProblemRequest(BaseModel):
    """Request to generate a problem instance"""
    template_id: str
    student_id: Optional[str] = None  # For personalization
    seed: Optional[str] = None
    custom_params: Optional[Dict[str, Any]] = None
    count: int = Field(default=1, ge=1, le=10)  # Generate multiple problems


class GenerateProblemResponse(BaseModel):
    """Response for problem generation"""
    problems: List[ProblemInstance]
    generated_count: int


class RenderProblemRequest(BaseModel):
    """Request to render a problem instance"""
    problem_instance_id: str
    include_answer_key: bool = False
    student_context: Optional[Dict[str, Any]] = None


class RenderProblemResponse(BaseModel):
    """Response for problem rendering"""
    rendered_problem: Dict[str, Any]  # Matches frontend problem structure
    metadata: Dict[str, Any]


class GradeProblemRequest(BaseModel):
    """Request to grade a student response - matches frontend submission"""
    student_id: str
    problem_instance_id: str
    user_response: Any
    canvas_data: Optional[str] = None
    primitive_answer: Optional[PrimitiveAnswer] = None
    time_spent_seconds: Optional[int] = None


class GradeProblemResponse(BaseModel):
    """Response for problem grading - matches frontend expectations"""
    is_correct: bool
    score: float = Field(..., ge=0, le=10)  # 0-10 scale to match frontend
    partial_credit: Optional[float] = None
    feedback: Dict[str, Any]  # Structured feedback matching frontend format
    competency_update: Optional[Dict[str, Any]] = None


class TelemetryEventRequest(BaseModel):
    """Request to submit telemetry event"""
    event_type: str
    problem_instance_id: Optional[str] = None
    skill_id: Optional[str] = None
    event_data: Dict[str, Any] = {}
    session_id: Optional[str] = None


class TelemetryBatchRequest(BaseModel):
    """Request to submit multiple telemetry events"""
    events: List[TelemetryEventRequest]
    student_id: str


# Specific primitive parameter models (for type safety)

class NumberLineParams(BaseModel):
    """Parameters for NumberLine primitive"""
    min: float
    max: float
    step: float
    tick_density: Literal["sparse", "normal", "dense"] = "normal"
    target_value: Optional[float] = None
    show_labels: bool = True
    highlight_zones: List[Dict[str, Any]] = Field(default=[])


class DiagramLabelerParams(BaseModel):
    """Parameters for DiagramLabeler primitive"""
    diagram_id: str
    hotspots: List[Dict[str, Any]]
    label_options: List[str]
    svg_content: Optional[str] = None


class MoonPhaseSelectorParams(BaseModel):
    """Parameters for MoonPhaseSelector primitive"""
    phase_options: List[Dict[str, Any]]
    show_earth_sun: bool = True


class EvidenceHighlighterParams(BaseModel):
    """Parameters for EvidenceHighlighter primitive"""
    passage_text: str
    max_selections: Optional[int] = None
    highlight_color: str = "#ffeb3b"
    show_line_numbers: bool = False


class TimelineBuilderParams(BaseModel):
    """Parameters for TimelineBuilder primitive"""
    events: List[Dict[str, Any]]
    time_range: Dict[str, str]
    supports_bce: bool = False