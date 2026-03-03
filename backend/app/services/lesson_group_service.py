# backend/app/services/lesson_group_service.py
"""
Lesson Group Service — PRD Daily Learning Experience, Sections 2 & 3.

Responsibilities:
  1. Bloom's classification  — verb analysis on subskill description text
  2. Lesson group assembly   — clusters enriched subskills into 2–5 subskill LessonBlocks
  3. Session plan builder    — fills a daily time budget with lesson blocks (PRD §3.3)
"""

import hashlib
import logging
import random
import re

from collections import defaultdict
from datetime import date
from typing import Any, Dict, List, Optional, Union

from ..models.lesson_plan import (
    BLOCK_DURATION_MINUTES,
    DEFAULT_DAILY_BUDGET_MINUTES,
    DEFAULT_REVIEW_CAP_PCT,
    BloomLevel,
    BloomPhase,
    BlockSubskill,
    BlockType,
    DailySessionPlan,
    LessonBlock,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Bloom's Taxonomy Verb Banks — PRD §6.1
# ---------------------------------------------------------------------------

_BLOOM_VERBS: Dict[str, List[str]] = {
    BloomLevel.IDENTIFY: [
        "recognize", "identify", "name", "recall", "list", "define",
        "locate", "select", "match", "choose", "label", "point",
        "distinguish", "detect", "find", "notice",
    ],
    BloomLevel.EXPLAIN: [
        "explain", "describe", "compare", "contrast", "classify",
        "summarize", "interpret", "discuss", "differentiate", "sort",
        "categorize", "paraphrase", "illustrate", "predict", "infer",
    ],
    BloomLevel.APPLY: [
        "apply", "produce", "create", "use", "demonstrate", "construct",
        "solve", "generate", "perform", "write", "build", "show", "make",
        "complete", "compute", "calculate", "blend", "segment", "map",
    ],
}

# Ordinal position for sorting within a lesson group
_BLOOM_ORDER = {BloomLevel.IDENTIFY: 0, BloomLevel.EXPLAIN: 1, BloomLevel.APPLY: 2}

# Subject-specific celebration messages — PRD §4.6
_CELEBRATIONS: Dict[str, List[str]] = {
    "ELA": [
        "You're a reading star! ⭐",
        "Words are your superpower!",
        "You're becoming a storyteller!",
        "Phonics pro right here!",
    ],
    "Math": [
        "Numbers are your thing!",
        "Math master in the making!",
        "You crushed those numbers!",
        "Math genius!",
    ],
    "_default": [
        "Amazing work!",
        "You've got this!",
        "Incredible job!",
        "You're on fire!",
    ],
}

MAX_GROUP_SIZE = 5


class LessonGroupService:
    """
    Stateless service that groups candidate subskills into lesson blocks
    and assembles a time-budget-bounded daily session plan.

    All methods are classmethods — no constructor or Firestore dependency.
    The caller (PlanningService) owns data fetching.
    """

    # ------------------------------------------------------------------
    # 1. Bloom's classification
    # ------------------------------------------------------------------

    @staticmethod
    def classify_bloom(description: str) -> BloomLevel:
        """
        Assign a Bloom's level to a subskill by scanning its description text
        for taxonomy verbs.  Priority: IDENTIFY > EXPLAIN > APPLY.
        Defaults to APPLY for unknown or empty descriptions.
        """
        if not description:
            return BloomLevel.APPLY

        text = description.lower()

        for level in [BloomLevel.IDENTIFY, BloomLevel.EXPLAIN, BloomLevel.APPLY]:
            for verb in _BLOOM_VERBS[level]:
                if re.search(rf"\b{re.escape(verb)}\b", text):
                    return level

        return BloomLevel.APPLY

    # ------------------------------------------------------------------
    # 2. Lesson group assembly (the grouper) — PRD §2.2 / §6.1
    # ------------------------------------------------------------------

    @classmethod
    def group_subskills_into_blocks(
        cls,
        candidates: List[Dict[str, Any]],
    ) -> List[LessonBlock]:
        """
        Take a flat list of enriched candidate dicts and return LessonBlock objects.

        Each candidate dict is expected to have:
            skill_id, subject, type ("new"|"review"), mastery_gate,
            unit_title, skill_description, subskill_description,
            days_overdue (optional), completion_factor (optional)

        Grouping rules (PRD §2.2):
            - Same domain (unit_title) → same group
            - Further clustered by parent skill_description
            - 2–5 subskills per block; larger clusters are chunked
            - Ordered by Bloom's level within each block
        """
        if not candidates:
            return []

        # First-level bucket: (subject, unit_title)
        domain_buckets: Dict[tuple, List[Dict[str, Any]]] = defaultdict(list)
        for c in candidates:
            key = (
                c.get("subject", ""),
                c.get("unit_title") or "General",
            )
            domain_buckets[key].append(c)

        blocks: List[LessonBlock] = []

        for (subject, unit_title), skills in domain_buckets.items():
            # Second-level bucket: parent skill_description
            skill_buckets: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
            for s in skills:
                skill_key = s.get("skill_description") or unit_title
                skill_buckets[skill_key].append(s)

            for skill_key, skill_group in skill_buckets.items():
                # Chunk into groups of MAX_GROUP_SIZE
                for i in range(0, len(skill_group), MAX_GROUP_SIZE):
                    chunk = skill_group[i: i + MAX_GROUP_SIZE]
                    block = cls._build_block(chunk, subject, unit_title, skill_key)
                    blocks.append(block)

        return blocks

    @classmethod
    def _build_block(
        cls,
        skills: List[Dict[str, Any]],
        subject: str,
        unit_title: str,
        skill_key: str,
    ) -> LessonBlock:
        """Build a single LessonBlock from a group of related skills."""

        # Classify Bloom's level for each skill and build BlockSubskill list
        subskills: List[BlockSubskill] = []
        for s in skills:
            desc = (
                s.get("subskill_description")
                or s.get("skill_description")
                or s.get("skill_id", "")
            )
            bloom = cls.classify_bloom(desc)
            gate = s.get("mastery_gate") or 0
            item_type = s.get("type", "new")
            status = cls._status_from_type(item_type, gate)

            subskills.append(BlockSubskill(
                subskill_id=s.get("skill_id", ""),
                subskill_name=desc,
                bloom_phase=bloom,
                gate=gate,
                status=status,
            ))

        # Sort subskills by Bloom's level: Identify → Explain → Apply
        subskills.sort(key=lambda x: _BLOOM_ORDER.get(x.bloom_phase, 2))

        # Determine block type
        has_retest = any(s.status == "retest" for s in subskills)
        all_review  = all(s.status in ("review", "retest") for s in subskills)
        block_type  = (
            BlockType.RETEST   if has_retest  else
            BlockType.PRACTICE if all_review  else
            BlockType.LESSON
        )

        duration = BLOCK_DURATION_MINUTES[block_type]

        # Per-phase duration
        minutes_per_phase = (
            6 if block_type == BlockType.LESSON   else
            3 if block_type == BlockType.PRACTICE else
            2
        )

        bloom_phases = [
            BloomPhase(
                phase=ss.bloom_phase,
                subskill_id=ss.subskill_id,
                subskill_name=ss.subskill_name,
                estimated_minutes=minutes_per_phase,
            )
            for ss in subskills
        ]

        # Stable lesson group ID (hash of domain + skill key)
        group_id = f"lg-{hashlib.md5(f'{subject}:{skill_key}'.encode()).hexdigest()[:8]}"

        # Block ID: group + hash of member IDs (changes if membership changes)
        member_hash = hashlib.md5(
            ",".join(s.subskill_id for s in subskills).encode()
        ).hexdigest()[:6]
        block_id = f"{group_id}-{member_hash}"

        # Human-readable title
        title = cls._make_title(skill_key, unit_title)

        # Priority score: retests > reviews > new; more overdue = higher priority
        max_overdue = max((s.get("days_overdue", 0) for s in skills), default=0)
        priority = (
            1000 + max_overdue if block_type == BlockType.RETEST   else
             500 + max_overdue if block_type == BlockType.PRACTICE else
             0
        )

        return LessonBlock(
            block_id=block_id,
            block_index=0,   # assigned by build_session_plan
            type=block_type,
            lesson_group_id=group_id,
            title=title,
            subject=subject,
            unit_title=unit_title,
            estimated_minutes=duration,
            subskills=subskills,
            bloom_phases=bloom_phases,
            priority_score=priority,
            celebration_message=cls._pick_celebration(subject, block_type),
        )

    @staticmethod
    def _status_from_type(item_type: str, gate: int) -> str:
        if gate >= 4:
            return "mastered"
        if item_type == "review":
            return "retest" if gate >= 1 else "review"
        return "new"

    @staticmethod
    def _make_title(skill_key: str, unit_title: str) -> str:
        """Produce a clean block title from the skill description."""
        text = skill_key if skill_key != unit_title else unit_title
        if len(text) > 42:
            text = text[:39] + "..."
        return text.strip().title() if text else "Learning Block"

    @staticmethod
    def _pick_celebration(subject: str, block_type: BlockType) -> str:
        messages = _CELEBRATIONS.get(subject, _CELEBRATIONS["_default"])
        return random.choice(messages)

    # ------------------------------------------------------------------
    # 3. Daily session plan builder — fills the time budget (PRD §3.3)
    # ------------------------------------------------------------------

    @classmethod
    def build_session_plan(
        cls,
        student_id: Union[int, str],
        candidate_blocks: List[LessonBlock],
        budget_minutes: int = DEFAULT_DAILY_BUDGET_MINUTES,
        review_cap_pct: float = DEFAULT_REVIEW_CAP_PCT,
    ) -> DailySessionPlan:
        """
        Fill the daily time budget with lesson blocks.

        Priority order (PRD §3.3):
          1. Retest blocks (most overdue first)
          2. Practice/review blocks (up to review_cap_pct of budget)
          3. New lesson blocks (fill remaining intro budget)

        Returns a DailySessionPlan with 4–5 blocks shaped per PRD §3.4.
        """
        today = date.today()
        day_names = [
            "Monday", "Tuesday", "Wednesday", "Thursday",
            "Friday", "Saturday", "Sunday",
        ]

        review_budget = round(budget_minutes * review_cap_pct)
        intro_budget  = budget_minutes - review_budget

        # Partition and sort by priority
        retests   = sorted(
            [b for b in candidate_blocks if b.type == BlockType.RETEST],
            key=lambda b: -b.priority_score,
        )
        practices = sorted(
            [b for b in candidate_blocks if b.type == BlockType.PRACTICE],
            key=lambda b: -b.priority_score,
        )
        lessons   = sorted(
            [b for b in candidate_blocks if b.type == BlockType.LESSON],
            key=lambda b: b.priority_score,   # lower = newer / higher priority
        )

        selected:             List[LessonBlock] = []
        review_minutes_used:  int = 0
        intro_minutes_used:   int = 0
        warnings:             List[str] = []

        # 1. Fill retests first (counted against review budget)
        for block in retests:
            if review_minutes_used + block.estimated_minutes <= review_budget:
                selected.append(block)
                review_minutes_used += block.estimated_minutes

        # 2. Fill practice reviews (up to review cap)
        for block in practices:
            if review_minutes_used + block.estimated_minutes <= review_budget:
                selected.append(block)
                review_minutes_used += block.estimated_minutes

        if practices and review_minutes_used >= review_budget:
            warnings.append("Review cap reached — some reviews deferred to tomorrow")

        # 3. Fill new lessons with remaining intro budget
        for block in lessons:
            if intro_minutes_used + block.estimated_minutes <= intro_budget:
                selected.append(block)
                intro_minutes_used += block.estimated_minutes

        # 4. Shape the session for cognitive variety (PRD §3.4)
        ordered = cls._shape_session(selected)

        # 5. Assign block indices and break prompts (PRD §4.3)
        elapsed = 0
        for i, block in enumerate(ordered):
            block.block_index = i + 1
            elapsed += block.estimated_minutes
            # Offer a break after every 2nd block when elapsed >= 25 min
            block.insert_break_after = (
                (i + 1) % 2 == 0
                and elapsed >= 25
                and i < len(ordered) - 1
            )

        total_minutes   = sum(b.estimated_minutes for b in ordered)
        total_subskills = sum(len(b.subskills)     for b in ordered)
        new_subs        = sum(
            sum(1 for s in b.subskills if s.status == "new")
            for b in ordered
        )

        return DailySessionPlan(
            student_id=str(student_id),
            date=today.isoformat(),
            day_of_week=day_names[today.weekday()],
            budget_minutes=budget_minutes,
            review_budget_minutes=review_budget,
            intro_budget_minutes=intro_budget,
            estimated_total_minutes=total_minutes,
            blocks=ordered,
            total_subskills=total_subskills,
            new_subskills=new_subs,
            review_subskills=total_subskills - new_subs,
            warnings=warnings,
        )

    @staticmethod
    def _shape_session(blocks: List[LessonBlock]) -> List[LessonBlock]:
        """
        Interleave blocks for cognitive variety (PRD §3.4):
          - Front-load new lessons (highest attention window)
          - Alternate subjects — never same subject back-to-back
          - Weave pattern: lesson → practice/retest → lesson → ...
        """
        if len(blocks) <= 1:
            return list(blocks)

        lessons   = [b for b in blocks if b.type == BlockType.LESSON]
        practices = [b for b in blocks if b.type == BlockType.PRACTICE]
        retests   = [b for b in blocks if b.type == BlockType.RETEST]

        last_subject: Optional[str] = None
        ordered: List[LessonBlock] = []

        def pop_different(lst: List[LessonBlock]) -> Optional[LessonBlock]:
            nonlocal last_subject
            for i, b in enumerate(lst):
                if b.subject != last_subject:
                    return lst.pop(i)
            return lst.pop(0) if lst else None

        # Pool of non-lesson blocks: retests first (mid-session placement),
        # then practices
        others = list(retests) + list(practices)

        while lessons or others:
            # Add a new lesson if available (front-load)
            if lessons:
                b = pop_different(lessons)
                if b:
                    ordered.append(b)
                    last_subject = b.subject

            # Add one review/retest block
            if others:
                b = pop_different(others)
                if b:
                    ordered.append(b)
                    last_subject = b.subject

        return ordered
