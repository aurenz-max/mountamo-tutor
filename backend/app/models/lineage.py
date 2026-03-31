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
# Data combination policy — tells the lazy migrator how to handle each
# student-data collection when migrating from old → canonical ID(s).
# ---------------------------------------------------------------------------

class DataPolicy(BaseModel):
    """Per-collection migration strategy for a lineage record."""
    competency: Literal["transfer", "merge_weighted", "drop"] = "transfer"
    mastery_lifecycle: Literal["transfer", "merge_highest_gate", "reset"] = "transfer"
    ability: Literal["transfer", "keep_both"] = "transfer"
    attempts_reviews: Literal["retag"] = "retag"


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
    canonical_id: Optional[str] = Field(
        default=None,
        description="Single canonical target (rename/retire). None for retire with no successor.",
    )
    canonical_ids: List[str] = Field(
        default_factory=list,
        description="All canonical targets (for splits → multiple; for rename → single-element list)",
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

    # Merge/split metadata
    merge_sources: List[str] = Field(
        default_factory=list,
        description="For merge: all old IDs that were combined into canonical_id",
    )
    split_targets: List[str] = Field(
        default_factory=list,
        description="For split: all new IDs the old single ID became",
    )

    # Data combination hints
    data_policy: DataPolicy = Field(default_factory=DataPolicy)

    # Audit
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
    )
    created_by: str = Field(default="auto-publish")


class LineageCreate(BaseModel):
    """Request body for creating a lineage record via API."""
    old_id: str
    canonical_id: Optional[str] = None
    canonical_ids: List[str] = Field(default_factory=list)
    operation: LineageOperation
    level: LineageLevel = "subskill"
    old_skill_id: Optional[str] = None
    canonical_skill_id: Optional[str] = None
    subject_id: str
    grade: str = ""
    description: str = ""
    merge_sources: List[str] = Field(default_factory=list)
    split_targets: List[str] = Field(default_factory=list)
    data_policy: DataPolicy = Field(default_factory=DataPolicy)


class LineageCheckResult(BaseModel):
    """Result of a pre-publish lineage validation check."""
    subject_id: str
    total_removed: int = 0
    total_added: int = 0
    covered: List[str] = Field(default_factory=list, description="Removed IDs with lineage records")
    missing: List[str] = Field(default_factory=list, description="Removed IDs WITHOUT lineage records — BLOCKING")
    is_valid: bool = Field(default=True, description="False if any missing lineage records")
