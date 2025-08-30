# backend/app/schemas/composable_problems.py

from typing import Dict, Any, List, Optional, Union, Literal
from pydantic import BaseModel, Field
from enum import Enum

# ============================================================================
# PRIMITIVE SCHEMAS - Define all supported primitive types
# ============================================================================

class PrimitiveType(str, Enum):
    """Supported primitive types for composable problems"""
    STATIC_TEXT = "StaticText"
    DRAG_AND_DROP_ZONE = "DragAndDropZone" 
    NUMBER_TRACING = "NumberTracing"
    MULTIPLE_CHOICE = "MultipleChoice"
    OBJECT_COUNTER = "ObjectCounter"
    NUMBER_LINE = "NumberLine"
    NUMBER_INPUT = "NumberInput"

class StaticTextParameters(BaseModel):
    """Parameters for StaticText primitive"""
    content: str = Field(..., description="Text content, supports Markdown")
    text_align: Literal["left", "center", "right"] = "left"
    font_weight: Literal["normal", "bold"] = "normal"
    font_size: Literal["small", "medium", "large"] = "medium"

class DragAndDropItem(BaseModel):
    """Item that can be dragged"""
    id: str
    image_url: str
    label: Optional[str] = None

class DropZone(BaseModel):
    """Zone where items can be dropped"""
    id: str
    image_url: str
    label: Optional[str] = None
    max_items: Optional[int] = None

class SolutionRule(BaseModel):
    """Rules for evaluating drag and drop solutions"""
    type: Literal["count", "specific_ids", "any"] = "count"
    value: Union[int, List[str]] = Field(..., description="Count for 'count' type, list of IDs for 'specific_ids'")

class DragAndDropParameters(BaseModel):
    """Parameters for DragAndDropZone primitive"""
    prompt: str = Field(..., description="Instructions for the student")
    draggable_items: List[DragAndDropItem]
    drop_zone: DropZone
    solution_rule: SolutionRule

class NumberTracingParameters(BaseModel):
    """Parameters for NumberTracing primitive"""
    prompt: str = Field(..., description="Instructions for the student")
    number_to_trace: int = Field(..., ge=0, le=100)
    show_stroke_guides: bool = True
    allow_multiple_attempts: bool = True

class MultipleChoiceOption(BaseModel):
    """Option for multiple choice questions"""
    id: str
    text: str
    image_url: Optional[str] = None

class MultipleChoiceParameters(BaseModel):
    """Parameters for MultipleChoice primitive"""
    prompt: str = Field(..., description="Question text")
    options: List[MultipleChoiceOption]
    correct_option_id: str
    randomize_options: bool = False

class ObjectCounterParameters(BaseModel):
    """Parameters for ObjectCounter primitive (tap to add objects)"""
    prompt: str = Field(..., description="Instructions for counting")
    object_image_url: str = Field(..., description="Image of the object to count")
    max_count: int = Field(default=20, ge=1, le=100)
    target_count: Optional[int] = None

class NumberLineParameters(BaseModel):
    """Parameters for NumberLine primitive"""
    prompt: str = Field(..., description="Instructions for the number line task")
    min_value: int = 0
    max_value: int = 10
    step: int = 1
    target_numbers: List[int] = Field(..., description="Numbers student should place on line")
    show_labels: bool = True

class NumberInputParameters(BaseModel):
    """Parameters for NumberInput primitive"""
    prompt: str = Field(..., description="Instructions for number input")
    placeholder: str = "Enter a number"
    min_value: Optional[int] = None
    max_value: Optional[int] = None
    correct_answer: Union[int, float]

# ============================================================================
# STATE DEPENDENCIES
# ============================================================================

class StateDependency(BaseModel):
    """Defines when a primitive should be shown/hidden based on another primitive's state"""
    target_id: str = Field(..., description="ID of the primitive to check")
    required_state: Literal["complete", "incomplete", "correct", "incorrect"] = "complete"
    action: Literal["show", "hide", "enable", "disable"] = "show"

# ============================================================================
# PRIMITIVE DEFINITION
# ============================================================================

class Primitive(BaseModel):
    """A single primitive component in a composable problem"""
    primitive_id: str = Field(..., description="Unique identifier for this primitive instance")
    primitive_type: PrimitiveType
    parameters: Dict[str, Any] = Field(..., description="Primitive-specific parameters")
    state_dependencies: Optional[List[StateDependency]] = []
    visible: bool = True
    enabled: bool = True

# ============================================================================
# LAYOUT SYSTEM
# ============================================================================

class Container(BaseModel):
    """Container for organizing primitives"""
    id: Literal["main", "left", "right", "top", "bottom"]
    primitives: List[Primitive]

class Layout(BaseModel):
    """Layout configuration for the problem"""
    type: Literal["single-column", "two-column", "three-column"] = "single-column"
    containers: List[Container]

# ============================================================================
# EVALUATION LOGIC
# ============================================================================

class EvaluationCriterion(BaseModel):
    """Single evaluation criterion"""
    primitive_id: str
    criterion_type: Literal["exact_match", "count_match", "partial_credit", "completion"]
    weight: float = Field(default=1.0, ge=0.0, le=1.0)
    required_value: Optional[Union[str, int, float]] = None

class EvaluationLogic(BaseModel):
    """Defines how to evaluate student responses"""
    criteria: List[EvaluationCriterion]
    passing_score: float = Field(default=0.7, ge=0.0, le=1.0)
    partial_credit_enabled: bool = True

# ============================================================================
# MAIN PROBLEM SCHEMA
# ============================================================================

class ComposableProblem(BaseModel):
    """Complete composable problem definition"""
    problem_id: str = Field(..., description="Unique problem identifier") 
    learning_objective: str = Field(..., description="What the student should learn")
    layout: Layout
    evaluation_logic: EvaluationLogic
    metadata: Optional[Dict[str, Any]] = {}
    
    # Compatibility fields with existing system
    problem_type: str = "composable"
    subject: str = ""
    grade_level: str = ""
    difficulty: float = 5.0

# ============================================================================
# REQUEST/RESPONSE SCHEMAS
# ============================================================================

class ProblemGenerationRequest(BaseModel):
    """Request for generating a new composable problem"""
    skill_id: str = Field(..., description="Target skill identifier")
    user_id: str = Field(..., description="Student user ID") 
    session_id: Optional[str] = None
    difficulty_preference: Optional[float] = None
    primitive_preferences: Optional[List[PrimitiveType]] = None
    metadata: Optional[Dict[str, Any]] = Field(None, description="Rich metadata from ProblemService including skill descriptions, objectives, etc.")

class ProblemGenerationResponse(BaseModel):
    """Response containing generated composable problem"""
    problem: ComposableProblem
    generated_at: str
    cache_key: Optional[str] = None

class StudentResponse(BaseModel):
    """Student's response to a primitive"""
    primitive_id: str
    response_type: str
    response_value: Any
    timestamp: str
    attempt_number: int = 1

class ProblemSubmission(BaseModel):
    """Complete student submission for a composable problem"""
    problem_id: str
    student_responses: List[StudentResponse]
    canvas_data: Optional[str] = None  # Base64 encoded canvas if used
    submission_time: str

class EvaluationResult(BaseModel):
    """Result of evaluating a student submission"""
    problem_id: str
    total_score: float = Field(..., ge=0.0, le=1.0)
    primitive_scores: Dict[str, float]
    passed: bool
    feedback_text: str
    next_steps: List[str]
    competency_delta: Optional[float] = None

# ============================================================================
# PRIMITIVE MANIFEST FOR LLM
# ============================================================================

class PrimitiveManifestEntry(BaseModel):
    """Manifest entry describing a primitive to the LLM"""
    primitive_type: str
    description: str
    use_cases: List[str]
    parameters_schema: Dict[str, Any]
    example_usage: Dict[str, Any]

class PrimitiveManifest(BaseModel):
    """Complete manifest of available primitives for LLM context"""
    version: str = "1.0"
    primitives: List[PrimitiveManifestEntry]
    layout_options: List[str]
    best_practices: List[str]

# ============================================================================
# NEW SIMPLIFIED SCHEMA - INTERACTIVE PROBLEM
# ============================================================================

class Interaction(BaseModel):
    """Defines the interactive part of the problem."""
    type: PrimitiveType
    parameters: Dict[str, Any] = Field(..., description="Parameters for the interactive component")

class InteractiveProblem(BaseModel):
    """A simplified, self-contained, interactive problem definition."""
    problem_id: str
    learning_objective: str
    prompt: str = Field(..., description="The full problem text/question for the student.")
    interaction: Interaction
    metadata: Dict[str, Any] = {}
    
    # Keep compatibility fields
    problem_type: str = "interactive"
    subject: str
    grade_level: str
    difficulty: float

class InteractiveProblemGenerationResponse(BaseModel):
    """Response containing generated interactive problem"""
    problem: InteractiveProblem
    generated_at: str
    cache_key: Optional[str] = None