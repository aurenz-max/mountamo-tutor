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
    """Strong in most areas, weak in skills matching bias keywords."""

    WEAKNESS_KEYWORDS = ["fraction", "decimal", "ratio", "percent"]

    def score_item(self, item: PulseItemSpec) -> float:
        desc_lower = item.description.lower()
        is_weak = any(kw in desc_lower for kw in self.WEAKNESS_KEYWORDS)

        if is_weak:
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


# ── Strategy registry ──────────────────────────────────────────────────────

STRATEGY_MAP: Dict[str, type] = {
    "gifted": GiftedStrategy,
    "steady": SteadyStrategy,
    "struggling": StrugglingStrategy,
    "selective_weakness": SelectiveWeaknessStrategy,
    "cold_start": ColdStartStrategy,
    "forgetful": ForgetfulStrategy,
    "accelerating": AcceleratingStrategy,
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
