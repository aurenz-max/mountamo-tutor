"""
Pydantic models for AI-generated foundational content
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime


# ============================================================================
# MASTER CONTEXT MODELS
# ============================================================================

class MasterContext(BaseModel):
    """Foundational learning context for a subskill"""
    core_concepts: List[str] = Field(
        description="4-6 core concepts students must understand"
    )
    key_terminology: Dict[str, str] = Field(
        description="5-8 key terms with precise definitions"
    )
    learning_objectives: List[str] = Field(
        description="4-6 specific, measurable learning objectives"
    )
    difficulty_level: str = Field(
        description="Difficulty level for this content"
    )
    grade_level: Optional[str] = Field(
        default=None,
        description="Target grade level for students"
    )
    prerequisites: List[str] = Field(
        default_factory=list,
        description="Required prerequisite knowledge"
    )
    real_world_applications: List[str] = Field(
        description="3-5 real-world applications of this knowledge"
    )


# ============================================================================
# CONTEXT PRIMITIVES MODELS
# ============================================================================

class Character(BaseModel):
    """A character that can appear in problems"""
    name: str
    age: Optional[int] = None
    role: Optional[str] = None


class ComparisonPair(BaseModel):
    """A pair of items for comparison activities"""
    attribute: str
    examples: List[str]


class Category(BaseModel):
    """A category with items for sorting activities"""
    name: str
    items: List[str]


class Attribute(BaseModel):
    """An attribute with possible values"""
    name: str
    values: List[str]


class ContextPrimitives(BaseModel):
    """Context primitives that provide variety for problem generation"""
    concrete_objects: List[str] = Field(
        default_factory=list,
        description="15-20 concrete objects relevant to the subskill"
    )
    living_things: List[str] = Field(
        default_factory=list,
        description="8-12 living things (animals, plants, people)"
    )
    locations: List[str] = Field(
        default_factory=list,
        description="6-10 familiar locations/settings where this skill applies"
    )
    tools: List[str] = Field(
        default_factory=list,
        description="5-8 tools/materials used in educational contexts"
    )
    characters: List[Character] = Field(
        default_factory=list,
        description="5-8 diverse characters with names, ages, and roles"
    )
    scenarios: List[str] = Field(
        default_factory=list,
        description="8-12 realistic scenarios where this skill applies"
    )
    comparison_pairs: List[ComparisonPair] = Field(
        default_factory=list,
        description="3-5 comparison pairs with specific examples"
    )
    categories: List[Category] = Field(
        default_factory=list,
        description="3-5 categories with 4-6 items each for sorting"
    )
    sequences: List[List[str]] = Field(
        default_factory=list,
        description="2-4 sequences appropriate for the learning objective"
    )
    action_words: List[str] = Field(
        default_factory=list,
        description="8-12 action words relevant to the skill"
    )
    attributes: List[Attribute] = Field(
        default_factory=list,
        description="4-6 attributes with multiple values each"
    )


# ============================================================================
# VISUAL SCHEMAS
# ============================================================================

class VisualSchemaCategory(BaseModel):
    """A category of visual schemas"""
    category: str
    schemas: List[str]
    description: Optional[str] = None


# Available visual schema types (from content_schemas.py)
VISUAL_SCHEMA_CATEGORIES = [
    VisualSchemaCategory(
        category="foundational",
        schemas=["object-collection", "comparison-panel"],
        description="Use FIRST for K-1 content showing/counting objects"
    ),
    VisualSchemaCategory(
        category="math",
        schemas=[
            "bar-model", "number-line", "base-ten-blocks",
            "fraction-circles", "geometric-shape"
        ],
        description="Math-specific visualizations"
    ),
    VisualSchemaCategory(
        category="science",
        schemas=[
            "labeled-diagram", "cycle-diagram", "tree-diagram",
            "line-graph", "thermometer"
        ],
        description="Science-specific visualizations"
    ),
    VisualSchemaCategory(
        category="language_arts",
        schemas=[
            "sentence-diagram", "story-sequence", "word-web",
            "character-web", "venn-diagram"
        ],
        description="Language arts visualizations"
    ),
    VisualSchemaCategory(
        category="abcs",
        schemas=[
            "letter-tracing", "letter-picture", "alphabet-sequence",
            "rhyming-pairs", "sight-word-card", "sound-sort"
        ],
        description="ABC/Early literacy visualizations"
    )
]

# Flat list of all available schemas
ALL_VISUAL_SCHEMAS = [
    schema
    for category in VISUAL_SCHEMA_CATEGORIES
    for schema in category.schemas
]


# ============================================================================
# FOUNDATIONS DATA MODEL
# ============================================================================

class FoundationsData(BaseModel):
    """Complete foundational content for a subskill"""
    subskill_id: str
    version_id: str
    master_context: MasterContext
    context_primitives: ContextPrimitives
    approved_visual_schemas: List[str] = Field(
        default_factory=list,
        description="Educator-approved visual schemas for this subskill"
    )
    generation_status: str = Field(
        default="generated",
        description="Status: 'pending', 'generated', or 'edited'"
    )
    is_draft: bool = Field(
        default=True,
        description="Whether this is a draft or published version"
    )
    created_at: datetime
    updated_at: datetime
    last_edited_by: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "subskill_id": "math-k-counting-1to10",
                "version_id": "v1",
                "master_context": {
                    "core_concepts": [
                        "One-to-one correspondence",
                        "Number sequence",
                        "Cardinality"
                    ],
                    "key_terminology": {
                        "count": "Say number names in order while touching objects",
                        "quantity": "How many items there are"
                    },
                    "learning_objectives": [
                        "Count to 10 by ones",
                        "Recognize that the last number said tells how many"
                    ],
                    "difficulty_level": "beginner",
                    "grade_level": "Kindergarten",
                    "prerequisites": [],
                    "real_world_applications": [
                        "Counting toys",
                        "Setting the table"
                    ]
                },
                "context_primitives": {
                    "concrete_objects": ["apple", "toy car", "crayon", "block"],
                    "characters": [{"name": "Emma", "age": 5, "role": "student"}],
                    "scenarios": ["Emma counts her toys"]
                },
                "approved_visual_schemas": ["object-collection", "comparison-panel"],
                "generation_status": "edited",
                "is_draft": True
            }
        }


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class FoundationsGenerateRequest(BaseModel):
    """Request to generate foundations for a subskill"""
    subskill_id: str
    version_id: str


class FoundationsUpdateRequest(BaseModel):
    """Request to update foundations for a subskill"""
    master_context: MasterContext
    context_primitives: ContextPrimitives
    approved_visual_schemas: Optional[List[str]] = Field(default_factory=list, description="Deprecated - visual content is now generated per-section")


class FoundationsResponse(BaseModel):
    """Response containing foundation data"""
    success: bool
    data: Optional[FoundationsData] = None
    message: Optional[str] = None


class FoundationsStatusResponse(BaseModel):
    """Response indicating whether foundations exist for a subskill"""
    subskill_id: str
    version_id: str
    has_foundations: bool
    generation_status: Optional[str] = None
    last_updated: Optional[datetime] = None
