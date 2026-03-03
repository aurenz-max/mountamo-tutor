# backend/app/models/lesson_plan.py
"""
Lesson plan data models — PRD Daily Learning Experience.

Covers: lesson groups, session blocks, and the structured daily session plan.
PRD Sections 2 (Lesson Architecture), 3 (Planning Engine), 4 (Session Runner).
"""

from __future__ import annotations

from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class BloomLevel(str, Enum):
    IDENTIFY = "identify"
    EXPLAIN  = "explain"
    APPLY    = "apply"


class BlockType(str, Enum):
    LESSON   = "lesson"    # New introduction — full Bloom's cycle (~18 min)
    PRACTICE = "practice"  # Review at practice depth (~10 min)
    RETEST   = "retest"    # Mastery gate assessment (~5 min)


# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------

class BlockSubskill(BaseModel):
    """One subskill within a lesson block."""
    subskill_id:   str
    subskill_name: str
    bloom_phase:   BloomLevel
    gate:          int = 0   # Current mastery gate (0–4)
    status:        str = "new"  # "new" | "review" | "retest" | "mastered"


class BloomPhase(BaseModel):
    """One Bloom's phase within a lesson block (PRD §2.3)."""
    phase:              BloomLevel
    subskill_id:        str
    subskill_name:      str
    estimated_minutes:  int = 6   # 6 min/phase × 3 phases = 18 min lesson


# ---------------------------------------------------------------------------
# Lesson block — the atom of the session runner
# ---------------------------------------------------------------------------

class LessonBlock(BaseModel):
    """
    A scheduled lesson group instance in today's session plan.

    Corresponds to one 'block' in the PRD §4 session structure:
      - LESSON  → full 3-phase Bloom's cycle  (~18 min)
      - PRACTICE → review at reduced depth     (~10 min)
      - RETEST  → mastery gate check           (~5 min)
    """
    block_id:          str
    block_index:       int            # 1-based display order
    type:              BlockType
    lesson_group_id:   str            # Stable key for this subskill grouping
    title:             str            # Human-readable: "Rhyming Sounds"
    subject:           str
    unit_title:        Optional[str] = None
    estimated_minutes: int
    subskills:         List[BlockSubskill] = Field(default_factory=list)
    bloom_phases:      List[BloomPhase]   = Field(default_factory=list)
    priority_score:    int  = 0
    insert_break_after: bool = False   # Offer break after this block
    celebration_message: str = ""


# ---------------------------------------------------------------------------
# Session-level plan
# ---------------------------------------------------------------------------

class DailySessionPlan(BaseModel):
    """
    The full structured session plan for one student on one day.
    Produced by LessonGroupService.build_session_plan() (PRD §3).
    """
    student_id:              str
    date:                    str   # YYYY-MM-DD
    day_of_week:             str
    budget_minutes:          int = 75   # Configurable daily time budget
    review_budget_minutes:   int = 0    # 50% cap on reviews (PRD §3.3)
    intro_budget_minutes:    int = 0    # Guaranteed budget for new material
    estimated_total_minutes: int = 0    # Sum of selected block estimates
    blocks:                  List[LessonBlock] = Field(default_factory=list)
    total_subskills:         int = 0
    new_subskills:           int = 0
    review_subskills:        int = 0
    warnings:                List[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Default primitive time assumptions — PRD §3.2 (calibrated from telemetry over time)
PRIMITIVE_TIME_DEFAULTS: Dict[str, float] = {
    "phonics_blender":  2.5,
    "story_map":        7.0,
    "rhyme_studio":     3.0,
    "knowledge_check":  4.0,
    "fast_fact":        3.0,
    "decodable_reader": 5.0,
    "ten_frame":        2.5,
    "counting_board":   3.0,
    "number_line":      3.5,
    "function_machine": 4.0,
    "pattern_builder":  3.0,
}

# Duration (minutes) per block type — PRD §3.2
BLOCK_DURATION_MINUTES: Dict[str, int] = {
    BlockType.LESSON:   18,
    BlockType.PRACTICE: 10,
    BlockType.RETEST:   5,
}

DEFAULT_DAILY_BUDGET_MINUTES: int = 75
DEFAULT_REVIEW_CAP_PCT: float = 0.50   # PRD §3.3
