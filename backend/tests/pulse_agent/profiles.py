"""
Synthetic Student Profiles
==========================

Each profile defines a student archetype with a unique student_id namespace
(900_000+) so agent data never collides with real students.

Profiles carry metadata that scenarios use to generate realistic score patterns.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Optional


@dataclass
class SyntheticProfile:
    """A synthetic student used by the agent runner."""

    student_id: int
    name: str
    description: str
    subject: str = "Mathematics"

    # Scenario hint — scenarios inspect this to pick a ScoreStrategy
    archetype: str = "steady"

    # Optional per-skill overrides for scenarios (skill_id -> bias)
    # Positive bias = stronger, negative = weaker
    skill_biases: Dict[str, float] = field(default_factory=dict)

    # How many Pulse sessions to run
    target_sessions: int = 10

    # Items per session (default matches Pulse default)
    items_per_session: int = 6


# ── Pre-built profiles ─────────────────────────────────────────────────────

GIFTED_STUDENT = SyntheticProfile(
    student_id=900_001,
    name="Gifted Grace",
    description="Aces everything. Should leapfrog rapidly through the DAG.",
    archetype="gifted",
    target_sessions=15,
)

STEADY_LEARNER = SyntheticProfile(
    student_id=900_002,
    name="Steady Sam",
    description="Scores ~9 with variance. Steady gate progression, rare leapfrogs.",
    archetype="steady",
    target_sessions=20,
)

STRUGGLING_STUDENT = SyntheticProfile(
    student_id=900_003,
    name="Struggling Sofia",
    description="Scores 4-6. Should stall at gate 0-1, slow theta growth.",
    archetype="struggling",
    target_sessions=15,
)

FRACTION_WEAKNESS = SyntheticProfile(
    student_id=900_004,
    name="Fraction-Weak Finn",
    description="Strong everywhere except fraction-related skills.",
    archetype="selective_weakness",
    skill_biases={
        # These will be matched by substring against skill descriptions
    },
    target_sessions=20,
)

FORGETFUL_STUDENT = SyntheticProfile(
    student_id=900_007,
    name="Forgetful Fred",
    description="Learns well (~9 scores) but 20% chance of forgetting review items. Tests retention/stability model.",
    archetype="forgetful",
    target_sessions=15,
)

COLD_START = SyntheticProfile(
    student_id=900_005,
    name="Cold-Start Cleo",
    description="Brand new student, zero history. Should get 100% frontier probes.",
    archetype="cold_start",
    target_sessions=5,
    items_per_session=6,
)

ACCELERATOR = SyntheticProfile(
    student_id=900_006,
    name="Accelerator Alex",
    description="Starts weak (score ~5) but improves rapidly each session.",
    archetype="accelerating",
    target_sessions=20,
)

SHALLOW_ROOTS = SyntheticProfile(
    student_id=900_008,
    name="Shallow-Roots Ravi",
    description=(
        "Aces hard frontier probes but fails on leapfrog-unlocked prerequisites. "
        "Leapfrog seeds competency docs (not_started) — the unified selector "
        "should prioritize them via high σ (uncertainty). Tests whether utility "
        "scoring naturally fills gaps in wide-prerequisite branches."
    ),
    archetype="shallow_roots",
    target_sessions=20,
)


# Registry for CLI lookup
ALL_PROFILES: Dict[str, SyntheticProfile] = {
    "gifted": GIFTED_STUDENT,
    "steady": STEADY_LEARNER,
    "struggling": STRUGGLING_STUDENT,
    "fraction_weakness": FRACTION_WEAKNESS,
    "cold_start": COLD_START,
    "forgetful": FORGETFUL_STUDENT,
    "accelerating": ACCELERATOR,
    "shallow_roots": SHALLOW_ROOTS,
}
