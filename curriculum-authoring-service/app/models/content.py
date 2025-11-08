"""
Pydantic models for reading content and visual snippets
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


# ============================================================================
# INTERACTIVE PRIMITIVES
# ============================================================================

class Alert(BaseModel):
    """Alert/callout box for important information"""
    type: str = "alert"
    style: str = Field(description="Alert style: info, warning, success, tip")
    title: str
    content: str


class Expandable(BaseModel):
    """Expandable section for optional deeper information"""
    type: str = "expandable"
    title: str
    content: str


class Quiz(BaseModel):
    """Quick knowledge check question"""
    type: str = "quiz"
    question: str
    answer: str
    explanation: Optional[str] = None


class Definition(BaseModel):
    """Inline term definition"""
    type: str = "definition"
    term: str
    definition: str


class Checklist(BaseModel):
    """Progress tracking checklist item"""
    type: str = "checklist"
    text: str
    completed: bool = False


class Table(BaseModel):
    """Structured data table"""
    type: str = "table"
    headers: List[str]
    rows: List[List[str]]


class KeyValue(BaseModel):
    """Key-value pair for facts and statistics"""
    type: str = "keyvalue"
    key: str
    value: str


class TimelineEvent(BaseModel):
    """Event in a timeline"""
    date: str
    title: str
    description: str


class InteractiveTimeline(BaseModel):
    """Interactive timeline visualization"""
    type: str = "interactive_timeline"
    title: str
    events: List[TimelineEvent]


class CarouselItem(BaseModel):
    """Item in a carousel"""
    image_url: str
    alt_text: str
    caption: Optional[str] = None
    description: Optional[str] = None


class Carousel(BaseModel):
    """Carousel/slider for images or cards"""
    type: str = "carousel"
    title: Optional[str] = None
    items: List[CarouselItem]


class FlipCard(BaseModel):
    """Interactive flip card"""
    type: str = "flip_card"
    front_content: str
    back_content: str


class CategorizationItem(BaseModel):
    """Item to be categorized"""
    item_text: str
    correct_category: str


class CategorizationActivity(BaseModel):
    """Activity for sorting items into categories"""
    type: str = "categorization"
    instruction: str
    categories: List[str]
    items: List[CategorizationItem]


class FillInTheBlank(BaseModel):
    """Fill-in-the-blank exercise"""
    type: str = "fill_in_the_blank"
    sentence: str
    correct_answer: str
    hint: Optional[str] = None


class ScenarioQuestion(BaseModel):
    """Scenario-based question"""
    type: str = "scenario_question"
    scenario: str
    question: str
    answer_options: Optional[List[str]] = None
    correct_answer: str
    explanation: Optional[str] = None


# Union type for all interactive primitives
InteractivePrimitive = Alert | Expandable | Quiz | Definition | Checklist | Table | KeyValue | InteractiveTimeline | Carousel | FlipCard | CategorizationActivity | FillInTheBlank | ScenarioQuestion


# ============================================================================
# READING CONTENT SECTION
# ============================================================================

class ReadingSection(BaseModel):
    """A section of reading content with optional interactive primitives"""
    section_id: str = Field(description="Unique identifier for this section")
    section_order: int = Field(description="Order position in the content")
    heading: str = Field(description="Section heading/title")
    content_text: str = Field(description="Main section content text")
    key_terms: List[str] = Field(default_factory=list, description="Key terms used in this section")
    concepts_covered: List[str] = Field(default_factory=list, description="Core concepts covered")

    # Interactive primitives (stored as JSON in BigQuery)
    interactive_primitives: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="List of interactive primitive objects (alerts, quizzes, etc.)"
    )

    # Visual snippet reference
    has_visual_snippet: bool = Field(default=False, description="Whether this section has an associated visual snippet")

    created_at: datetime
    updated_at: datetime


# ============================================================================
# READING CONTENT PACKAGE
# ============================================================================

class ReadingContentPackage(BaseModel):
    """Complete reading content for a subskill"""
    subskill_id: str
    version_id: str
    title: str = Field(description="Title of the reading content")
    sections: List[ReadingSection] = Field(description="Ordered list of reading sections")

    generation_status: str = Field(
        default="generated",
        description="Status: 'pending', 'generated', 'edited'"
    )
    is_draft: bool = Field(default=True, description="Whether this is a draft version")

    created_at: datetime
    updated_at: datetime
    last_edited_by: Optional[str] = None


# ============================================================================
# VISUAL SNIPPET
# ============================================================================

class VisualSnippet(BaseModel):
    """Interactive HTML visual snippet for a section"""
    snippet_id: str = Field(description="Unique identifier for the snippet")
    subskill_id: str
    section_id: str = Field(description="Associated reading section ID")

    html_content: str = Field(description="Complete HTML file with embedded CSS/JS")
    generation_prompt: Optional[str] = Field(
        default=None,
        description="Prompt used to generate this visual"
    )

    created_at: datetime
    updated_at: datetime
    last_edited_by: Optional[str] = None


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class GenerateReadingContentRequest(BaseModel):
    """Request to generate reading content for a subskill"""
    subskill_id: str
    version_id: str
    use_foundations: bool = Field(
        default=True,
        description="Whether to use saved foundations for generation"
    )


class RegenerateSectionRequest(BaseModel):
    """Request to regenerate a specific section"""
    section_id: str
    custom_prompt: Optional[str] = Field(
        default=None,
        description="Optional custom instructions for regeneration"
    )


class UpdateSectionRequest(BaseModel):
    """Request to update a section"""
    heading: Optional[str] = None
    content_text: Optional[str] = None
    key_terms: Optional[List[str]] = None
    concepts_covered: Optional[List[str]] = None
    interactive_primitives: Optional[List[Dict[str, Any]]] = None
    has_visual_snippet: Optional[bool] = None


class GenerateVisualSnippetRequest(BaseModel):
    """Request to generate a visual snippet for a section"""
    section_id: str
    custom_prompt: Optional[str] = Field(
        default=None,
        description="Optional custom instructions for visual generation"
    )


class UpdateVisualSnippetRequest(BaseModel):
    """Request to update a visual snippet"""
    html_content: str


class ReadingContentResponse(BaseModel):
    """Response containing reading content"""
    success: bool
    data: Optional[ReadingContentPackage] = None
    message: Optional[str] = None


class ReadingSectionResponse(BaseModel):
    """Response containing a single reading section"""
    success: bool
    data: Optional[ReadingSection] = None
    message: Optional[str] = None


class VisualSnippetResponse(BaseModel):
    """Response containing a visual snippet"""
    success: bool
    data: Optional[VisualSnippet] = None
    message: Optional[str] = None
