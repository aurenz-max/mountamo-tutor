# backend/app/models/skill_progress.py
"""
Data models for the Skill Progress panel — "crafting-inspired"
prerequisite projection UI.

Three layers:
  1. Crafting Now     — 1-2 skills the student is actively working toward
  2. Almost Ready     — 2-3 skills at 50%+ prerequisite readiness
  3. Progress Overview — per-subject mastery summary bars
"""
from __future__ import annotations

from typing import Dict, List
from pydantic import BaseModel, Field


class PrerequisiteStatus(BaseModel):
    """One prerequisite subskill for a target skill."""
    subskill_id: str
    name: str
    current_gate: int = Field(ge=0, le=4)
    target_gate: int = Field(default=4, ge=0, le=4)
    completion_pct: float = Field(default=0.0, ge=0.0, le=1.0)
    met: bool = False


class CraftingNowItem(BaseModel):
    """Layer 1: A skill the student is currently working toward."""
    skill_id: str
    skill_name: str
    subject: str
    prerequisites: List[PrerequisiteStatus] = Field(default_factory=list)
    overall_readiness: float = Field(default=0.0, ge=0.0, le=1.0)


class AlmostReadyItem(BaseModel):
    """Layer 2: A skill approaching prerequisite readiness."""
    skill_id: str
    skill_name: str
    subject: str
    blockers: List[PrerequisiteStatus] = Field(default_factory=list)
    readiness: float = Field(default=0.0, ge=0.0, le=1.0)


class SubjectProgressSummary(BaseModel):
    """Layer 3: Per-subject mastery bar."""
    total: int = 0
    mastered: int = 0
    in_progress: int = 0
    not_started: int = 0


class SkillProgressResponse(BaseModel):
    """Aggregated 3-layer skill progress response."""
    student_id: str
    crafting_now: List[CraftingNowItem] = Field(default_factory=list)
    almost_ready: List[AlmostReadyItem] = Field(default_factory=list)
    progress_overview: Dict[str, SubjectProgressSummary] = Field(default_factory=dict)
    generated_at: str
