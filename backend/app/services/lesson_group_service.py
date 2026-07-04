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
import math
import random
import re

from collections import defaultdict
from datetime import date
from typing import Any, Dict, List, Optional, Union

from ..models.lesson_plan import (
    DEFAULT_DAILY_BUDGET_MINUTES,
    DEFAULT_REVIEW_CAP_PCT,
    BloomLevel,
    BloomPhase,
    BlockSubskill,
    BlockType,
    DailySessionPlan,
    LessonBlock,
    block_cost_minutes,
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
# Blocks below this size merge up into sibling groups within the same unit —
# the singleton scatter that fragmented daily plans came from skill-exact
# bucketing with no second pass.
MIN_GROUP_SIZE = 2

# The daily pulse beat holds at most this many measurement items (~4-6 min
# at the pulse cost model). Overflow keeps the normal retest/lesson path.
PULSE_BEAT_MAX_ITEMS = 4


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
            - Merge-up pass: undersized skill groups combine with siblings
              in the same unit, so singletons never ship alone when related
              work exists (skill-exact bucketing with no second pass was the
              root of daily-plan fragmentation)
            - 2–5 subskills per block; larger clusters are chunked evenly
            - Ordered by Bloom's level within each block
            - Mastery retests never merge with teaching work — a check is
              measurement, not instruction (most are absorbed upstream by
              the daily pulse beat; overflow keeps dedicated blocks)
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
            retest_pool: List[Dict[str, Any]] = []
            teach_pool: List[Dict[str, Any]] = []
            for s in skills:
                status = cls._status_from_type(
                    s.get("type", "new"), s.get("mastery_gate") or 0
                )
                (retest_pool if status == "retest" else teach_pool).append(s)

            def skill_buckets(items: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
                b: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
                for s in items:
                    b[s.get("skill_description") or unit_title].append(s)
                return b

            # Retests: per-skill chunking, no merging
            for skill_key, group in skill_buckets(retest_pool).items():
                for chunk in cls._chunk_evenly(group):
                    blocks.append(cls._build_block(chunk, subject, unit_title, skill_key))

            # Teaching work: skill buckets, then merge-up so singletons combine
            merged = cls._merge_up(list(skill_buckets(teach_pool).values()))
            for group in merged:
                # Merged groups may span skills — title falls back to the unit
                keys = {s.get("skill_description") or unit_title for s in group}
                skill_key = keys.pop() if len(keys) == 1 else unit_title
                for chunk in cls._chunk_evenly(group):
                    blocks.append(cls._build_block(chunk, subject, unit_title, skill_key))

        return blocks

    @staticmethod
    def _merge_up(groups: List[List[Dict[str, Any]]]) -> List[List[Dict[str, Any]]]:
        """
        Combine undersized sibling groups (already same subject + unit) so
        singleton blocks only survive when a subskill genuinely has no
        related work today. Best-fit-decreasing: each fragment lands in the
        fullest receiver that still has room, keeping blocks full and block
        count low; fragments that fit nowhere pool into unit-level groups.
        """
        keep = [list(g) for g in groups if len(g) >= MIN_GROUP_SIZE]
        fragments = sorted(
            (list(g) for g in groups if 0 < len(g) < MIN_GROUP_SIZE),
            key=len,
            reverse=True,
        )
        leftovers: List[Dict[str, Any]] = []
        for frag in fragments:
            receivers = [g for g in keep if len(g) + len(frag) <= MAX_GROUP_SIZE]
            if receivers:
                max(receivers, key=len).extend(frag)
            else:
                leftovers.extend(frag)
        for i in range(0, len(leftovers), MAX_GROUP_SIZE):
            keep.append(leftovers[i: i + MAX_GROUP_SIZE])
        return keep

    @staticmethod
    def _chunk_evenly(group: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
        """Split an oversized group into balanced chunks (7 → 4+3, not 5+2)."""
        if len(group) <= MAX_GROUP_SIZE:
            return [group] if group else []
        n_chunks = math.ceil(len(group) / MAX_GROUP_SIZE)
        size = math.ceil(len(group) / n_chunks)
        return [group[i: i + size] for i in range(0, len(group), size)]

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
            # Model-state verb from the IRT selector (confirm→apply,
            # learn→identify/explain) wins over keyword classification.
            selection_verb = s.get("selection_verb")
            try:
                bloom = BloomLevel(selection_verb) if selection_verb else cls.classify_bloom(desc)
            except ValueError:
                bloom = cls.classify_bloom(desc)
            gate = s.get("mastery_gate") or 0
            item_type = s.get("type", "new")
            status = cls._status_from_type(item_type, gate)

            subskills.append(BlockSubskill(
                subskill_id=s.get("skill_id", ""),
                skill_id=s.get("parent_skill_id") or "",
                subject=s.get("subject", ""),
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

        # Linear cost model: base + marginal × n, so a merged 5-pack and a
        # genuine singleton are priced by what they actually contain.
        duration = block_cost_minutes(block_type, len(subskills))

        minutes_per_phase = max(1, round(duration / max(1, len(subskills))))

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

    # ------------------------------------------------------------------
    # 2b. Daily pulse beat — the measurement half of the evidence economy
    # ------------------------------------------------------------------

    @classmethod
    def split_pulse_candidates(
        cls,
        candidates: List[Dict[str, Any]],
    ) -> tuple:
        """
        Divert measurement work into the daily pulse beat: due mastery
        retests (most overdue first), then the IRT selector's "confirm"
        targets — subskills the model already believes are ready, where the
        block's only job is to produce the gate-advancing evidence.

        Returns (pulse_items, remaining). Overflow beyond
        PULSE_BEAT_MAX_ITEMS keeps the normal retest/lesson block path;
        "learn" targets are never diverted — they are instruction, not
        measurement.
        """
        retests = [
            c for c in candidates
            if cls._status_from_type(c.get("type", "new"), c.get("mastery_gate") or 0) == "retest"
        ]
        retests.sort(key=lambda c: -c.get("days_overdue", 0))
        confirms = [c for c in candidates if c.get("selection_kind") == "confirm"]

        pulse = (retests + confirms)[:PULSE_BEAT_MAX_ITEMS]
        pulse_ids = {id(c) for c in pulse}
        remaining = [c for c in candidates if id(c) not in pulse_ids]
        return pulse, remaining

    @classmethod
    def build_pulse_block(cls, items: List[Dict[str, Any]]) -> LessonBlock:
        """
        Build the day's single pulse-beat block: a ~4-min measurement beat
        scheduled first, absorbing what used to ship as singleton Mastery
        Check blocks. May span subjects — measurement follows the lifecycle
        scheduler, not the subject pacer; block.subject carries the majority
        subject for display and interleaving only.
        """
        subskills: List[BlockSubskill] = []
        for s in items:
            desc = (
                s.get("subskill_description")
                or s.get("skill_description")
                or s.get("skill_id", "")
            )
            gate = s.get("mastery_gate") or 0
            subskills.append(BlockSubskill(
                subskill_id=s.get("skill_id", ""),
                skill_id=s.get("parent_skill_id") or "",
                subject=s.get("subject", ""),
                subskill_name=desc,
                # Measurement asks the student to produce, not to meet the
                # material — every pulse item runs at the apply level.
                bloom_phase=BloomLevel.APPLY,
                gate=gate,
                status=cls._status_from_type(s.get("type", "new"), gate),
            ))

        subject_counts: Dict[str, int] = defaultdict(int)
        for s in items:
            subject_counts[s.get("subject", "")] += 1
        subject = max(subject_counts, key=subject_counts.get) if subject_counts else ""

        duration = block_cost_minutes(BlockType.PULSE, len(subskills))
        per_item = max(1, round(duration / max(1, len(subskills))))
        bloom_phases = [
            BloomPhase(
                phase=ss.bloom_phase,
                subskill_id=ss.subskill_id,
                subskill_name=ss.subskill_name,
                estimated_minutes=per_item,
            )
            for ss in subskills
        ]

        member_hash = hashlib.md5(
            ",".join(ss.subskill_id for ss in subskills).encode()
        ).hexdigest()[:6]
        max_overdue = max((s.get("days_overdue", 0) for s in items), default=0)

        return LessonBlock(
            block_id=f"lg-pulse-{member_hash}",
            block_index=0,
            type=BlockType.PULSE,
            lesson_group_id="lg-pulse",
            title="Daily Pulse",
            subject=subject,
            unit_title=None,
            estimated_minutes=duration,
            subskills=subskills,
            bloom_phases=bloom_phases,
            priority_score=2000 + max_overdue,
            celebration_message="Evidence in — your progress map just got sharper!",
        )

    @staticmethod
    def _subject_key(subject: str) -> str:
        """
        Normalize a subject for budget-map lookups (mirrors
        FirestoreService.rollup_subject_key): lifecycle docs carry original
        spellings ("Language Arts") while allocations use graph keys
        ("LANGUAGE_ARTS") — cap checks must not miss on spelling.
        """
        s = re.sub(r"[^A-Za-z0-9]+", "_", (subject or "").strip()).upper().strip("_")
        return re.sub(r"_G\d+$", "", s)

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
        subject_budgets: Optional[Dict[str, float]] = None,
    ) -> DailySessionPlan:
        """
        Fill the daily time budget with lesson blocks.

        Priority order (PRD §3.3):
          1. Retest blocks (most overdue first)
          2. Practice/review blocks (up to review_cap_pct of budget)
          3. New lesson blocks (fill remaining intro budget)

        subject_budgets (pace-aware allocation) caps how many minutes each
        subject may claim, so a subject with little remaining work can't
        crowd out one that's behind. RETEST blocks are exempt — spaced
        retention timing belongs to the mastery lifecycle, not the pacer.
        A subject with unused budget releases it in a final global pass so
        thin supply in one subject never strands total capacity.

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
        pulses    = [b for b in candidate_blocks if b.type == BlockType.PULSE]
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
        subject_used:         Dict[str, float] = defaultdict(float)
        norm_budgets: Dict[str, float] = (
            {cls._subject_key(k): v for k, v in subject_budgets.items()}
            if subject_budgets else {}
        )

        def subject_fits(block: LessonBlock) -> bool:
            if not norm_budgets:
                return True
            key = cls._subject_key(block.subject)
            cap = norm_budgets.get(key)
            if cap is None:
                return True
            return subject_used[key] + block.estimated_minutes <= cap

        # 0. The pulse beat always ships — it is the day's measurement beat
        #    (~4-6 min), counted against the review budget but never dropped
        #    and never subject-capped (it may span subjects; measurement
        #    timing belongs to the lifecycle, not the pacer).
        for block in pulses:
            selected.append(block)
            review_minutes_used += block.estimated_minutes

        # 1. Fill retests first (counted against review budget; exempt from
        #    subject caps — retention timing is lifecycle's, not the pacer's)
        for block in retests:
            if review_minutes_used + block.estimated_minutes <= review_budget:
                selected.append(block)
                review_minutes_used += block.estimated_minutes
                subject_used[cls._subject_key(block.subject)] += block.estimated_minutes

        # 2. Fill practice reviews (up to review cap, within subject budgets)
        for block in practices:
            if (review_minutes_used + block.estimated_minutes <= review_budget
                    and subject_fits(block)):
                selected.append(block)
                review_minutes_used += block.estimated_minutes
                subject_used[cls._subject_key(block.subject)] += block.estimated_minutes

        if practices and review_minutes_used >= review_budget:
            warnings.append("Review cap reached — some reviews deferred to tomorrow")

        # 3. Fill new lessons with remaining intro budget (within subject budgets)
        for block in lessons:
            if (intro_minutes_used + block.estimated_minutes <= intro_budget
                    and subject_fits(block)):
                selected.append(block)
                intro_minutes_used += block.estimated_minutes
                subject_used[cls._subject_key(block.subject)] += block.estimated_minutes

        # 3b. Release pass: if subject caps left global budget on the table
        #     (a capped subject had supply, another had none), refill ignoring
        #     subject caps. Global review-cap and intro-budget still hold.
        if subject_budgets:
            for block in practices:
                if block in selected:
                    continue
                if review_minutes_used + block.estimated_minutes <= review_budget:
                    selected.append(block)
                    review_minutes_used += block.estimated_minutes
            for block in lessons:
                if block in selected:
                    continue
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
          - Pulse beat first — the day opens on its measurement beat
          - Front-load new lessons (highest attention window)
          - Alternate subjects — never same subject back-to-back
          - Weave pattern: lesson → practice/retest → lesson → ...
        """
        if len(blocks) <= 1:
            return list(blocks)

        pulses    = [b for b in blocks if b.type == BlockType.PULSE]
        lessons   = [b for b in blocks if b.type == BlockType.LESSON]
        practices = [b for b in blocks if b.type == BlockType.PRACTICE]
        retests   = [b for b in blocks if b.type == BlockType.RETEST]

        last_subject: Optional[str] = None
        ordered: List[LessonBlock] = list(pulses)
        if ordered:
            last_subject = ordered[-1].subject

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
