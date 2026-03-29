"""
Score Strategies (Scenarios)
============================

A ScoreStrategy decides what score (0-10) a synthetic student gives for each
Pulse item, based on the item's band, subskill, mode, and the student's profile.

Strategies are stateful — they can track session number to model improvement
or fatigue over time.
"""

from __future__ import annotations

import random
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .profiles import SyntheticProfile

from app.models.pulse import PulseBand, PulseItemSpec


class ScoreStrategy(ABC):
    """Base class for score generation strategies."""

    def __init__(self, profile: SyntheticProfile, seed: Optional[int] = None):
        self.profile = profile
        self.rng = random.Random(seed or profile.student_id)
        self.session_number: int = 0

    def advance_session(self) -> None:
        """Called at the start of each new session."""
        self.session_number += 1

    @abstractmethod
    def score_item(self, item: PulseItemSpec) -> float:
        """Return a score in [0.0, 10.0] for the given item."""
        ...

    def _clamp(self, score: float) -> float:
        return max(0.0, min(10.0, round(score, 1)))

    def _jitter(self, base: float, spread: float = 0.5) -> float:
        """Add random noise around a base score."""
        return self._clamp(base + self.rng.uniform(-spread, spread))


class GiftedStrategy(ScoreStrategy):
    """Consistently high scores (9.0-10.0). Frontier probes also pass."""

    def score_item(self, item: PulseItemSpec) -> float:
        if item.band == PulseBand.FRONTIER:
            # Still strong on frontier, but slightly lower
            return self._jitter(9.0, spread=0.8)
        return self._jitter(9.5, spread=0.4)


class SteadyStrategy(ScoreStrategy):
    """Scores centred around 9.0 with difficulty-aware variance.

    Frontier items are harder (base 8.5, wider spread) so some miss the
    mastery threshold; current/review items pass more reliably.  Overall
    the student progresses — just slower than gifted.
    """

    def score_item(self, item: PulseItemSpec) -> float:
        base = {
            PulseBand.FRONTIER: 8.5,     # Harder — sometimes misses 9.0
            PulseBand.CURRENT: 9.0,
            PulseBand.REVIEW: 9.2,       # Retention is solid
        }[item.band]
        spread = {
            PulseBand.FRONTIER: 1.2,     # Wider variance on new material
            PulseBand.CURRENT: 1.0,
            PulseBand.REVIEW: 0.8,
        }[item.band]
        return self._jitter(base, spread=spread)


class StrugglingStrategy(ScoreStrategy):
    """Low scores (3.0-6.0). Fails most gate checks."""

    def score_item(self, item: PulseItemSpec) -> float:
        base = {
            PulseBand.FRONTIER: 3.0,
            PulseBand.CURRENT: 5.0,
            PulseBand.REVIEW: 5.5,
        }[item.band]
        return self._jitter(base, spread=1.5)


class SelectiveWeaknessStrategy(ScoreStrategy):
    """Strong in most areas, weak in skills matching subject-specific keywords.

    Weakness keywords are chosen per subject so the strategy works across
    Mathematics, Science, Language Arts, etc.  Falls back to a generic
    "every 4th skill is weak" heuristic if the subject has no keyword list.
    """

    WEAKNESS_KEYWORDS_BY_SUBJECT: Dict[str, list[str]] = {
        "Mathematics": ["fraction", "decimal", "ratio", "percent"],
        "Science": ["force", "energy", "gravity", "motion"],
        "Language Arts": ["grammar", "punctuation", "spelling", "tense"],
    }

    def _is_weak_skill(self, item: PulseItemSpec) -> bool:
        subject = (self.profile.subject or "").strip()
        keywords = self.WEAKNESS_KEYWORDS_BY_SUBJECT.get(subject)
        if keywords:
            desc_lower = item.description.lower()
            return any(kw in desc_lower for kw in keywords)
        # Fallback: deterministic weakness based on subskill_id hash
        return hash(item.subskill_id) % 4 == 0

    def score_item(self, item: PulseItemSpec) -> float:
        if self._is_weak_skill(item):
            base = {
                PulseBand.FRONTIER: 2.5,
                PulseBand.CURRENT: 4.5,
                PulseBand.REVIEW: 5.0,
            }[item.band]
        else:
            base = {
                PulseBand.FRONTIER: 8.5,
                PulseBand.CURRENT: 9.0,
                PulseBand.REVIEW: 9.0,
            }[item.band]
        return self._jitter(base, spread=0.8)


class ColdStartStrategy(ScoreStrategy):
    """First session ever — scores are middling (frontier-heavy session)."""

    def score_item(self, item: PulseItemSpec) -> float:
        # Cold start gets all frontier probes; score at ~6-7 to test DAG inference
        return self._jitter(6.5, spread=1.5)


class ForgetfulStrategy(ScoreStrategy):
    """Similar to Steady (~9.0 base) but 20% chance of forgetting review items.

    When forgetting triggers, review scores drop to 4-6 range, simulating
    a student who learns well but has poor retention.
    """

    FORGET_CHANCE = 0.20

    def score_item(self, item: PulseItemSpec) -> float:
        if item.band == PulseBand.REVIEW and self.rng.random() < self.FORGET_CHANCE:
            # Forgot — score craters
            return self._jitter(5.0, spread=1.0)

        base = {
            PulseBand.FRONTIER: 8.5,
            PulseBand.CURRENT: 9.0,
            PulseBand.REVIEW: 9.2,
        }[item.band]
        spread = {
            PulseBand.FRONTIER: 1.2,
            PulseBand.CURRENT: 1.0,
            PulseBand.REVIEW: 0.8,
        }[item.band]
        return self._jitter(base, spread=spread)


class AcceleratingStrategy(ScoreStrategy):
    """Starts weak, improves ~0.3 per session. Models a student gaining fluency."""

    def score_item(self, item: PulseItemSpec) -> float:
        # Base improves from 5.0 toward 9.5 over ~15 sessions
        improvement = min(self.session_number * 0.3, 4.5)
        base = {
            PulseBand.FRONTIER: 4.0 + improvement,
            PulseBand.CURRENT: 5.0 + improvement,
            PulseBand.REVIEW: 5.5 + improvement,
        }[item.band]
        return self._jitter(base, spread=0.8)


class ShallowRootsStrategy(ScoreStrategy):
    """Aces frontier probes but fails on leapfrog-unlocked prerequisites.

    Models a student who "gets the hard stuff" but has gaps in foundational
    knowledge. Like learning quantum mechanics by answering one double-slit
    question right — doesn't mean you understand wave functions.

    Behavior:
    - Frontier probes: scores 9-10 (triggers leapfrog, seeds competency docs)
    - Directly-tested subskills (seen as frontier): scores 8.5-10 on review
    - Unlocked subskills (never directly tested): 60% chance of scoring 4-6,
      simulating the "weak roots" — prerequisites the student never actually learned

    With the unified selector (utility = information × urgency), unlocked skills
    have high σ → high urgency → they get selected. After failures, θ drops →
    Fisher information shifts → the selector naturally deprioritizes them in
    favour of frontier probes on genuinely uncertain prerequisites.
    """

    # Probability that an unlocked (never directly tested) skill fails
    INFERRED_FAIL_CHANCE = 0.60

    def __init__(self, profile: "SyntheticProfile", seed: Optional[int] = None):
        super().__init__(profile, seed)
        # Track subskills this student has directly encountered as frontier probes
        self._directly_tested: set = set()

    def score_item(self, item: PulseItemSpec) -> float:
        if item.band == PulseBand.FRONTIER:
            # Record this as directly tested — the student actually faced it
            self._directly_tested.add(item.subskill_id)
            # Ace frontier probes — this triggers leapfrog
            return self._jitter(9.5, spread=0.5)

        # Current or review band — check if the student actually learned this
        if item.subskill_id in self._directly_tested:
            # Directly tested before — genuine knowledge, strong retention
            return self._jitter(9.0, spread=0.8)

        # Unlocked skill (leapfrog-seeded, never directly tested)
        # 60% chance: the student has a gap here — weak roots
        if self.rng.random() < self.INFERRED_FAIL_CHANCE:
            return self._jitter(4.5, spread=1.5)  # Fails badly
        else:
            # 40% chance: the prerequisite was genuinely understood
            return self._jitter(8.5, spread=1.0)

    @property
    def directly_tested_count(self) -> int:
        return len(self._directly_tested)


class RegressingStrategy(ScoreStrategy):
    """Starts strong (9-10), declines ~0.4 per session toward 3-4.

    Models a student who loses motivation, encounters life disruptions, or
    hits a conceptual wall.  Tests whether θ actually declines and whether
    IRT-derived gates regress when P(correct) drops below thresholds.
    """

    def score_item(self, item: PulseItemSpec) -> float:
        # Decline from 9.5 → ~3.5 over ~15 sessions
        decline = min(self.session_number * 0.4, 6.0)
        base = {
            PulseBand.FRONTIER: 9.0 - decline,
            PulseBand.CURRENT: 9.5 - decline,
            PulseBand.REVIEW: 9.5 - decline,
        }[item.band]
        return self._jitter(max(base, 2.0), spread=0.8)


class VolatileStrategy(ScoreStrategy):
    """Alternates between high (9-10) and low (2-4) sessions.

    Models an inconsistent learner — great one day, bombed the next.
    Tests whether σ stays high under noisy data and whether the selector
    thrashes on the same skills or maintains diversity.
    """

    def score_item(self, item: PulseItemSpec) -> float:
        # Odd sessions: strong.  Even sessions: weak.
        is_strong_session = self.session_number % 2 == 1
        if is_strong_session:
            base = {
                PulseBand.FRONTIER: 8.5,
                PulseBand.CURRENT: 9.5,
                PulseBand.REVIEW: 9.5,
            }[item.band]
            return self._jitter(base, spread=0.5)
        else:
            base = {
                PulseBand.FRONTIER: 2.5,
                PulseBand.CURRENT: 3.5,
                PulseBand.REVIEW: 3.0,
            }[item.band]
            return self._jitter(base, spread=1.0)


class PlateauStrategy(ScoreStrategy):
    """Ramps quickly to ~7.5 then flatlines indefinitely.

    Models the most common real-world pattern: a student who "gets it" enough
    to pass basic checks but never pushes into mastery territory.  Tests
    whether the engine keeps serving useful items or gets stuck in a loop
    at G1-G2 forever.
    """

    def score_item(self, item: PulseItemSpec) -> float:
        # Quick ramp over first 5 sessions: 5.0 → 7.5, then plateau
        ramp = min(self.session_number * 0.5, 2.5)
        base = {
            PulseBand.FRONTIER: 5.0 + ramp,
            PulseBand.CURRENT: 5.5 + ramp,
            PulseBand.REVIEW: 5.5 + ramp,
        }[item.band]
        # Tight variance — the student is consistently mediocre
        return self._jitter(base, spread=0.6)


class BurstyStrategy(ScoreStrategy):
    """Good scores (~9) but designed to be run with large session gaps (7+ days).

    The score generation is similar to Steady, but the profile sets
    session_gap_days=7.0 so the effective_theta decay formula
    (θ - 1.5 × √(days/stability)) is exercised heavily.  Tests whether
    review items resurface appropriately after long absences and whether
    the decay floor (θ × 0.5) prevents catastrophic regression.
    """

    def score_item(self, item: PulseItemSpec) -> float:
        # Strong learner when present — the challenge is the time gaps
        base = {
            PulseBand.FRONTIER: 8.0,
            PulseBand.CURRENT: 9.0,
            PulseBand.REVIEW: 8.5,  # Slightly lower on review due to rust
        }[item.band]
        spread = {
            PulseBand.FRONTIER: 1.2,
            PulseBand.CURRENT: 0.8,
            PulseBand.REVIEW: 1.5,  # Wider variance — sometimes remembers, sometimes doesn't
        }[item.band]
        return self._jitter(base, spread=spread)


# ── Strategy registry ──────────────────────────────────────────────────────

STRATEGY_MAP: Dict[str, type] = {
    "gifted": GiftedStrategy,
    "steady": SteadyStrategy,
    "struggling": StrugglingStrategy,
    "selective_weakness": SelectiveWeaknessStrategy,
    "cold_start": ColdStartStrategy,
    "forgetful": ForgetfulStrategy,
    "accelerating": AcceleratingStrategy,
    "shallow_roots": ShallowRootsStrategy,
    "regressing": RegressingStrategy,
    "volatile": VolatileStrategy,
    "plateau": PlateauStrategy,
    "bursty": BurstyStrategy,
}


def get_strategy(profile: SyntheticProfile, seed: Optional[int] = None) -> ScoreStrategy:
    """Look up and instantiate the right ScoreStrategy for a profile."""
    cls = STRATEGY_MAP.get(profile.archetype)
    if cls is None:
        raise ValueError(
            f"Unknown archetype '{profile.archetype}'. "
            f"Available: {list(STRATEGY_MAP.keys())}"
        )
    return cls(profile, seed=seed)
