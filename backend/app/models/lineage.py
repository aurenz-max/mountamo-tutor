"""
Curriculum Lineage Data Models

Tracks subskill/skill ID changes across curriculum versions so that
student data (competencies, mastery_lifecycle, ability, attempts, reviews)
can be transparently resolved to canonical IDs after curriculum iteration.

Stored at: curriculum_lineage/{old_subskill_id}
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Core lineage record
# ---------------------------------------------------------------------------

LineageOperation = Literal["rename", "merge", "split", "retire"]
LineageLevel = Literal["subskill", "skill"]


class LineageRecord(BaseModel):
    """
    Maps a deprecated subskill_id (or skill_id) to its canonical successor(s).

    Firestore doc ID = old_id for O(1) lookup.
    """

    # Identity
    old_id: str = Field(..., description="The deprecated subskill_id (or skill_id)")
    canonical_ids: List[str] = Field(
        default_factory=list,
        description="Canonical targets (single-element for rename, multiple for split, empty for retire)",
    )
    operation: LineageOperation = Field(..., description="Type of curriculum change")
    level: LineageLevel = Field(default="subskill", description="Whether this is a subskill or skill lineage")

    # Skill-level context
    old_skill_id: Optional[str] = Field(default=None, description="Skill ID before change")
    canonical_skill_id: Optional[str] = Field(default=None, description="Skill ID after change")

    # Curriculum context
    subject_id: str = Field(..., description="Subject this lineage belongs to")
    grade: str = Field(default="", description="Grade code (e.g. 'K', '1')")
    version_id: str = Field(default="", description="Publish version that created this record")
    description: str = Field(default="", description="Human-readable summary of the change")

    # Audit
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
    )
    created_by: str = Field(default="auto-publish")


class LineageCreate(BaseModel):
    """Request body for creating a lineage record via API."""
    old_id: str
    canonical_ids: List[str] = Field(default_factory=list)
    operation: LineageOperation
    level: LineageLevel = "subskill"
    old_skill_id: Optional[str] = None
    canonical_skill_id: Optional[str] = None
    subject_id: str
    grade: str = ""
    description: str = ""


class LineageCheckResult(BaseModel):
    """Result of a pre-publish lineage validation check."""
    subject_id: str
    total_removed: int = 0
    total_added: int = 0
    covered: List[str] = Field(default_factory=list, description="Removed IDs with lineage records")
    missing: List[str] = Field(default_factory=list, description="Removed IDs WITHOUT lineage records — BLOCKING")
    is_valid: bool = Field(default=True, description="False if any missing lineage records")
