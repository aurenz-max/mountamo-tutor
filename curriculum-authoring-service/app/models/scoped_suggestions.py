"""
Pydantic models for scoped edge suggestion during curriculum authoring.

Lightweight alternative to the bulk suggestion pipeline — runs 1-2
targeted Gemini calls against a narrow, author-defined scope instead
of 5 phases across the entire subject graph.

See docs/prds/GRAPH_AWARE_AUTHORING.md for full design.
"""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field

from app.models.edges import RelationshipType, EntityType


# ------------------------------------------------------------------ #
#  Request Models
# ------------------------------------------------------------------ #

class ScopedSuggestionScope(BaseModel):
    """Defines the scope of nodes to analyze."""
    skill_ids: List[str] = []
    subskill_ids: List[str] = []
    include_existing_graph: bool = True
    cross_grade_subject_ids: List[str] = []


class ScopedSuggestionOptions(BaseModel):
    """Options for scoped suggestion generation."""
    relationship_types: List[RelationshipType] = [
        "prerequisite", "builds_on", "reinforces", "parallel", "applies"
    ]
    max_suggestions: int = Field(default=10, ge=1, le=50)
    depth: Literal["skill", "subskill"] = "subskill"


class ScopedSuggestionRequest(BaseModel):
    """Request body for POST /api/ai/suggest-edges."""
    subject_id: str
    scope: ScopedSuggestionScope
    options: ScopedSuggestionOptions = ScopedSuggestionOptions()


class ConnectSkillsRequest(BaseModel):
    """Request body for POST /api/ai/connect-skills."""
    source_skill_id: str
    source_subject_id: str
    target_skill_id: str
    target_subject_id: str
    relationship_types: List[RelationshipType] = [
        "prerequisite", "builds_on", "reinforces", "parallel", "applies"
    ]


class AcceptScopedSuggestionsRequest(BaseModel):
    """Request body for POST /api/ai/suggest-edges/accept."""
    suggestion_ids: List[str]
    subject_id: str


# ------------------------------------------------------------------ #
#  Response Models
# ------------------------------------------------------------------ #

class ScopedEdgeSuggestion(BaseModel):
    """A single edge suggestion from the scoped service."""
    suggestion_id: str
    source_entity_id: str
    source_entity_type: EntityType
    source_label: str = ""
    source_context: str = ""
    target_entity_id: str
    target_entity_type: EntityType
    target_label: str = ""
    target_context: str = ""
    relationship: RelationshipType
    strength: float = Field(default=0.8, ge=0.0, le=1.0)
    is_prerequisite: bool = False
    rationale: str
    confidence: float = Field(default=0.7, ge=0.0, le=1.0)


class ScopeSummary(BaseModel):
    """Metadata about the scoped suggestion run."""
    source_nodes_analyzed: int = 0
    target_nodes_analyzed: int = 0
    cross_grade_nodes_included: int = 0
    gemini_calls: int = 0
    elapsed_ms: int = 0


class ScopedSuggestionResponse(BaseModel):
    """Response for POST /api/ai/suggest-edges."""
    suggestions: List[ScopedEdgeSuggestion] = []
    scope_summary: ScopeSummary = ScopeSummary()


class SkillConnection(BaseModel):
    """A single connection between two subskills from connect-skills."""
    source_subskill_id: str
    source_label: str = ""
    target_subskill_id: str
    target_label: str = ""
    relationship: RelationshipType
    strength: float = Field(default=0.8, ge=0.0, le=1.0)
    is_prerequisite: bool = False
    rationale: str
    confidence: float = Field(default=0.7, ge=0.0, le=1.0)


class SkillConnectionSummary(BaseModel):
    """Metadata about the connect-skills run."""
    source_subskills: int = 0
    target_subskills: int = 0
    connections_found: int = 0
    gemini_calls: int = 0
    elapsed_ms: int = 0


class ConnectSkillsResponse(BaseModel):
    """Response for POST /api/ai/connect-skills."""
    connections: List[SkillConnection] = []
    skill_summary: SkillConnectionSummary = SkillConnectionSummary()


class AcceptScopedSuggestionsResponse(BaseModel):
    """Response for POST /api/ai/suggest-edges/accept."""
    accepted: int = 0
    edge_ids: List[str] = []
