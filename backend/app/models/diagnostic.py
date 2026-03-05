"""
Diagnostic Placement Engine — Data Models

Implements the adaptive diagnostic assessment system from the Diagnostic &
Placement PRD.  The engine binary-searches the prerequisite DAG to identify
a student's knowledge boundary in O(log N) probes per chain.

Key concepts:
  - **Probe**: a 3-5 item assessment of a single subskill (score ≥ 75% = PASS)
  - **Inference**: PASS → all ancestors inferred mastered;
                   FAIL → all descendants inferred not-mastered
  - **Knowledge Profile**: per-subskill classification produced by the diagnostic
  - **Seeding**: maps the profile to mastery lifecycle gates so the planner
                 starts teaching at the right level
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class DiagnosticStatus(str, Enum):
    """Per-subskill classification during / after a diagnostic session."""
    UNKNOWN = "unknown"
    PROBED_MASTERED = "probed_mastered"
    PROBED_NOT_MASTERED = "probed_not_mastered"
    INFERRED_MASTERED = "inferred_mastered"
    INFERRED_NOT_MASTERED = "inferred_not_mastered"


class DiagnosticSessionState(str, Enum):
    """Lifecycle of a diagnostic session."""
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------

class NodeMetrics(BaseModel):
    """Topological metrics for a single DAG node."""
    node_id: str
    depth: int = Field(
        ..., ge=0,
        description="Longest path from any root to this node",
    )
    height: int = Field(
        ..., ge=0,
        description="Longest path from this node to any leaf",
    )
    chain_length: int = Field(
        ..., ge=0,
        description="depth + height — longest chain passing through this node",
    )


class ProbeRequest(BaseModel):
    """A single probe point returned to the frontend."""
    subskill_id: str
    subject: str
    skill_id: str = ""
    skill_description: str = ""
    description: str = ""
    items_needed: int = Field(
        default=3, ge=1, le=5,
        description="How many assessment items to present for this probe",
    )
    depth: int = 0
    chain_length: int = 0
    reason: str = Field(
        ...,
        description="Human-readable explanation: why this skill was selected",
    )


class SubskillClassification(BaseModel):
    """Per-subskill status in the knowledge profile."""
    subskill_id: str
    subject: str = ""
    skill_id: str = ""
    skill_description: str = ""
    description: str = ""
    status: DiagnosticStatus = DiagnosticStatus.UNKNOWN
    score: Optional[float] = Field(
        default=None,
        description="Probe score (0-1), only set for directly probed nodes",
    )
    items_completed: Optional[int] = None
    probed_at: Optional[str] = Field(
        default=None,
        description="ISO-8601 timestamp of when this node was probed",
    )
    inferred_from: Optional[str] = Field(
        default=None,
        description="subskill_id of the probe that caused this inference",
    )


class SubjectSummary(BaseModel):
    """Aggregate stats for one subject in the knowledge profile."""
    subject: str
    total_skills: int = 0
    mastered: int = 0
    not_mastered: int = 0
    unknown: int = 0
    mastery_pct: float = 0.0
    frontier_skills: List[str] = Field(default_factory=list)


class InferenceMade(BaseModel):
    """Record of a single inference event (for transparency / debugging)."""
    source_probe: str
    direction: str  # "upward" or "downward"
    affected_node: str
    new_status: DiagnosticStatus


# ---------------------------------------------------------------------------
# Core session document
# ---------------------------------------------------------------------------

class DiagnosticSession(BaseModel):
    """
    Full diagnostic session document.

    Stored at: diagnostic_sessions/{session_id}
    """
    # Identity
    session_id: str
    student_id: int
    state: DiagnosticSessionState = DiagnosticSessionState.IN_PROGRESS
    subjects: List[str] = Field(default_factory=list)

    # Knowledge profile — the core output
    classifications: Dict[str, SubskillClassification] = Field(
        default_factory=dict,
        description="subskill_id → SubskillClassification",
    )

    # Metrics
    total_nodes: int = 0
    classified_count: int = 0
    probed_count: int = 0
    coverage_pct: float = 0.0

    # Probe history (ordered list of probe results)
    probe_history: List[Dict] = Field(default_factory=list)

    # Grade level at session creation (e.g., "K", "1st", "2nd")
    grade_level: Optional[str] = Field(
        default=None,
        description="Student's grade level at session creation time",
    )

    # Timestamps
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
    )
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
    )
    completed_at: Optional[str] = None


# ---------------------------------------------------------------------------
# API request/response models
# ---------------------------------------------------------------------------

class CreateDiagnosticSessionRequest(BaseModel):
    """Request body for POST /api/diagnostic/sessions."""
    subjects: Optional[List[str]] = Field(
        default=None,
        description="Subjects to assess. None = all available subjects.",
    )


class ProbeResultRequest(BaseModel):
    """Request body for POST /api/diagnostic/sessions/{id}/probe-result."""
    subskill_id: str
    score: float = Field(
        ..., ge=0.0, le=1.0,
        description="Aggregate probe score (0-1). >= 0.75 = PASS.",
    )
    items_completed: int = Field(default=3, ge=1)


class ProbeResultResponse(BaseModel):
    """Response for probe-result endpoint."""
    status: str  # "continue" or "complete"
    classified_count: int
    total_count: int
    coverage_pct: float
    probes: List[ProbeRequest] = Field(default_factory=list)
    inferences_made: List[InferenceMade] = Field(default_factory=list)


class KnowledgeProfileResponse(BaseModel):
    """Response for knowledge-profile endpoint."""
    session_id: str
    student_id: int
    state: DiagnosticSessionState
    total_probed: int
    total_inferred: int
    total_classified: int
    coverage_pct: float
    by_subject: Dict[str, SubjectSummary] = Field(default_factory=dict)
    frontier_skills: List[str] = Field(default_factory=list)


class CompletionResponse(BaseModel):
    """Response for complete-session endpoint."""
    session_id: str
    student_id: int
    seeded_count: int
    frontier_skills: List[str] = Field(default_factory=list)
    knowledge_profile: KnowledgeProfileResponse


class DiagnosticSessionSummary(BaseModel):
    """Lightweight session list item (strips classifications/metrics/edges)."""
    session_id: str
    student_id: int
    state: str
    subjects: List[str] = Field(default_factory=list)
    total_nodes: int = 0
    classified_count: int = 0
    probed_count: int = 0
    coverage_pct: float = 0.0
    created_at: str = ""
    completed_at: Optional[str] = None


class EnrichedSessionResponse(BaseModel):
    """GET /sessions/{id} response — session state + computed fields for resume."""
    session_id: str
    student_id: int
    state: str
    subjects: List[str] = Field(default_factory=list)
    total_nodes: int = 0
    classified_count: int = 0
    probed_count: int = 0
    coverage_pct: float = 0.0
    created_at: str = ""
    updated_at: str = ""
    completed_at: Optional[str] = None
    # Computed fields (populated by the service layer)
    probes: List[ProbeRequest] = Field(
        default_factory=list,
        description="Next probes for in_progress sessions",
    )
    knowledge_profile: Optional[KnowledgeProfileResponse] = Field(
        default=None,
        description="Profile for completed sessions",
    )


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Probe pass threshold (75% — PRD §2.2)
DIAGNOSTIC_PASS_THRESHOLD = 0.75

# Coverage target to auto-complete (90% — PRD §2.2)
DIAGNOSTIC_COVERAGE_TARGET = 0.90

# Default items per probe
DEFAULT_PROBE_ITEMS = 3

# Maps diagnostic status → mastery gate for seeding (PRD §3.2)
DIAGNOSTIC_GATE_MAP: Dict[DiagnosticStatus, int] = {
    DiagnosticStatus.PROBED_MASTERED: 4,        # CLOSED (fully mastered)
    DiagnosticStatus.INFERRED_MASTERED: 2,      # RETEST_1 (skip to practice)
    DiagnosticStatus.PROBED_NOT_MASTERED: 0,    # NOT_STARTED (needs lessons)
    DiagnosticStatus.INFERRED_NOT_MASTERED: 0,  # NOT_STARTED
    DiagnosticStatus.UNKNOWN: 0,                # NOT_STARTED
}

# Maps diagnostic status → completion_pct for seeding
DIAGNOSTIC_COMPLETION_MAP: Dict[DiagnosticStatus, float] = {
    DiagnosticStatus.PROBED_MASTERED: 1.0,
    DiagnosticStatus.INFERRED_MASTERED: 0.5,
    DiagnosticStatus.PROBED_NOT_MASTERED: 0.0,
    DiagnosticStatus.INFERRED_NOT_MASTERED: 0.0,
    DiagnosticStatus.UNKNOWN: 0.0,
}

# Maps user profile grade codes → curriculum_published document IDs.
GRADE_TO_CURRICULUM_MAP: Dict[str, str] = {
    "K": "Kindergarten",
}
