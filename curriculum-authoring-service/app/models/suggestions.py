"""
Pydantic models for the agentic graph analysis layer.

Covers:
  - Edge suggestions (agent-proposed connections)
  - Graph health reports (structural metrics + anomalies)
  - Impact projections (before/after deltas)
"""

from typing import List, Optional, Literal
from datetime import datetime
from pydantic import BaseModel, Field

from app.models.edges import RelationshipType


# ------------------------------------------------------------------ #
#  Impact & Metrics
# ------------------------------------------------------------------ #

class SuggestionImpact(BaseModel):
    """Projected impact of accepting one or more edge suggestions."""
    bfs_reach_delta: float = 0.0       # Change in avg BFS reach from roots
    component_count_delta: int = 0     # Change in number of connected components
    cross_unit_ratio_delta: float = 0.0
    health_score_delta: float = 0.0


class GraphHealthMetrics(BaseModel):
    """Structural metrics for a curriculum knowledge graph."""
    node_count: int = 0
    edge_count: int = 0
    edge_density: float = 0.0          # edges / nodes
    component_count: int = 0
    cross_unit_ratio: float = 0.0      # fraction of edges crossing units
    avg_bfs_reach: float = 0.0         # avg nodes reachable in 5 hops from roots
    dead_end_ratio: float = 0.0        # fraction of nodes with no outgoing edges
    orphan_count: int = 0              # nodes with no edges at all
    bottleneck_nodes: List[str] = []   # nodes that are sole prereq for 3+ dependents


class GraphAnomaly(BaseModel):
    """A structural issue detected in the graph."""
    type: Literal["orphan", "isolated_unit", "bottleneck", "dead_end_cluster", "staleness"]
    severity: Literal["info", "warning", "critical"]
    entity_ids: List[str] = []
    description: str


# ------------------------------------------------------------------ #
#  Health Report
# ------------------------------------------------------------------ #

class GraphHealthReport(BaseModel):
    """Full structural analysis of a subject's knowledge graph."""
    subject_id: str
    health_score: float = Field(ge=0.0, le=10.0)
    metrics: GraphHealthMetrics
    anomalies: List[GraphAnomaly] = []
    suggestions_count: int = 0
    computed_at: datetime


# ------------------------------------------------------------------ #
#  Edge Suggestion
# ------------------------------------------------------------------ #

class EdgeSuggestion(BaseModel):
    """An agent-proposed edge for the knowledge graph."""
    suggestion_id: str
    subject_id: str
    source_entity_id: str
    source_label: str = ""             # For display
    target_entity_id: str
    target_label: str = ""             # For display
    relationship: RelationshipType
    strength: float = Field(default=0.8, ge=0.0, le=1.0)
    is_prerequisite: bool = False
    threshold: Optional[float] = None
    rationale: str                     # Agent-generated explanation
    confidence: float = Field(ge=0.0, le=1.0)
    impact: SuggestionImpact = SuggestionImpact()
    status: Literal["pending", "accepted", "rejected", "modified"] = "pending"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None
