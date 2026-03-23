"""
Pydantic models for curriculum knowledge graph edges.

Extends the original prerequisite-only model with typed relationships,
strength signals, and authorship tracking. Prerequisite gating is now
a property of an edge (is_prerequisite), not the only kind of edge.

Relationship types:
  - prerequisite: A must be mastered before B (gates unlock)
  - builds_on:    B extends A's concepts (no gate unless is_prerequisite)
  - reinforces:   Practicing A strengthens B (review pairing)
  - parallel:     A and B are peers at similar difficulty (breadth)
  - applies:      A is abstract, B is applied context (transfer)

All relationship types are navigable by Pulse for discovery BFS.
Only edges with is_prerequisite=True enforce mastery gates.
"""

from typing import Optional, List, Literal
from datetime import datetime
from pydantic import BaseModel, Field


EntityType = Literal["skill", "subskill"]
RelationshipType = Literal[
    "prerequisite", "builds_on", "reinforces", "parallel", "applies"
]
AuthoredBy = Literal["human", "agent"]
SuggestionStatus = Literal["pending", "accepted", "rejected", "modified"]


class CurriculumEdgeCreate(BaseModel):
    """Model for creating a new curriculum edge (subject_id resolved by API)."""
    source_entity_id: str
    source_entity_type: EntityType
    target_entity_id: str
    target_entity_type: EntityType
    relationship: RelationshipType = "prerequisite"
    strength: float = Field(default=1.0, ge=0.0, le=1.0)
    is_prerequisite: bool = True
    min_proficiency_threshold: Optional[float] = Field(default=0.8, ge=0.0, le=1.0)
    rationale: Optional[str] = None
    authored_by: AuthoredBy = "human"
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class CurriculumEdgeBase(CurriculumEdgeCreate):
    """Full edge model with server-assigned fields."""
    subject_id: str


class CurriculumEdge(CurriculumEdgeBase):
    """Complete edge model as stored in BigQuery."""
    edge_id: str
    version_id: str
    is_draft: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    pair_id: Optional[str] = None  # Links reverse edges for parallel relationships

    class Config:
        from_attributes = True


class EntityEdges(BaseModel):
    """All edges for a specific entity (both directions)."""
    entity_id: str
    entity_type: EntityType
    outgoing: List[CurriculumEdge] = []   # Edges where this entity is source
    incoming: List[CurriculumEdge] = []   # Edges where this entity is target


class CurriculumGraph(BaseModel):
    """Graph representation with enriched edges."""
    nodes: List[dict] = []
    edges: List[dict] = []
