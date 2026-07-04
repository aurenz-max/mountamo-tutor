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
    # Parent skill id from the curriculum hierarchy (empty if unresolved)
    skill_id:      str = ""
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
# Time ledger — observed block durations (the minutes currency, measured)
# ---------------------------------------------------------------------------

class BlockTimeEntry(BaseModel):
    """
    Observed timestamps for one block on one day's plan.

    `starts` is append-only (a re-launch after abandoning appends another
    entry), `completed_at` is stamped once at completion. Actual duration =
    completed_at − last start; total engagement ≈ completed_at − first start.
    This ledger is what eventually replaces the invented per-type durations
    in BLOCK_DURATION_MINUTES with telemetry-fit costs.
    """
    starts:       List[str] = Field(default_factory=list)  # ISO timestamps
    completed_at: Optional[str] = None


# ---------------------------------------------------------------------------
# Pace-aware allocation metadata
# ---------------------------------------------------------------------------

class SubjectPace(BaseModel):
    """Per-subject pace state + the minute share it earned today."""
    subject:             str
    total_subskills:     int
    remaining_subskills: int   # subskill nodes not mastered/inferred
    weight:              float # remaining / Σ remaining
    allocated_minutes:   float
    selector_count:      int   # targets requested from the IRT selector


class PlanAllocation(BaseModel):
    """
    How today's minute budget was split across subjects.

    Policy 'pace_proportional': minutes ∝ remaining work, so the furthest-
    behind subject owns the widest share and nearly-done subjects taper off
    instead of idling. required_minutes_per_day uses an ASSUMED per-subskill
    cost until the block time ledger calibrates a real one — the field name
    carries that caveat on purpose.
    """
    policy:                   str = "pace_proportional"
    weeks_remaining:          int = 0
    assumed_min_per_subskill: int = 0
    required_minutes_per_day: float = 0.0
    subjects:                 List[SubjectPace] = Field(default_factory=list)


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
    # Block ids the student has finished today — persisted on the day's plan
    # doc so progress survives navigation and device switches.
    completed_block_ids:     List[str] = Field(default_factory=list)
    # Observed start/complete timestamps per block_id (the time ledger).
    block_times:             Dict[str, BlockTimeEntry] = Field(default_factory=dict)
    # Pace-aware minute allocation that shaped this plan (None on legacy
    # plans and when the analytics service is unavailable).
    allocation:              Optional[PlanAllocation] = None
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

# ASSUMED cost to take one subskill through its gate ladder. This number is
# NOT measured anywhere yet — it exists only to translate remaining work into
# a "required minutes/day" pace signal. The block time ledger (BlockTimeEntry)
# is what will replace it with an observed value; do not build new logic on it.
ASSUMED_MIN_PER_SUBSKILL: int = 30
