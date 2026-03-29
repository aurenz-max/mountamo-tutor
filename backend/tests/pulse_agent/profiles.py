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
    """A synthetic student used by the agent runner.

    The ``subject`` field is set at runtime by the CLI (``--subject`` flag).
    Profiles are subject-agnostic by default — the same archetype can run
    against Mathematics, Science, Language Arts, etc.
    """

    student_id: int
    name: str
    description: str

    # Set at runtime by the CLI — no hardcoded default.
    # Use set_subject() or assign directly before running.
    subject: Optional[str] = None

    # Scenario hint — scenarios inspect this to pick a ScoreStrategy
    archetype: str = "steady"

    # Optional per-skill overrides for scenarios (skill_id -> bias)
    # Positive bias = stronger, negative = weaker
    skill_biases: Dict[str, float] = field(default_factory=dict)

    # How many Pulse sessions to run
    target_sessions: int = 10

    # Items per session (default matches Pulse default)
    items_per_session: int = 6

    # Simulated days between sessions (None = use runner default of 1.0)
    session_gap_days: Optional[float] = None


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
    name="Selective-Weakness Finn",
    description="Strong everywhere except a subject-specific skill cluster (fractions/forces/grammar).",
    archetype="selective_weakness",
    skill_biases={
        # Weakness keywords are chosen per subject in SelectiveWeaknessStrategy
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

REGRESSING = SyntheticProfile(
    student_id=900_009,
    name="Regressing Rita",
    description=(
        "Starts strong (9-10) then declines to 3-4. Tests θ decline over "
        "multiple sessions and whether IRT-derived gates regress when "
        "P(correct) drops below thresholds."
    ),
    archetype="regressing",
    target_sessions=20,
)

VOLATILE = SyntheticProfile(
    student_id=900_010,
    name="Volatile Vic",
    description=(
        "Alternates between high (9-10) and low (2-4) sessions. Tests σ "
        "convergence under noisy data and whether the selector thrashes "
        "on the same skills or maintains diversity."
    ),
    archetype="volatile",
    target_sessions=20,
)

PLATEAU = SyntheticProfile(
    student_id=900_011,
    name="Plateau Pat",
    description=(
        "Ramps to ~7.5 then flatlines. The most common real-world pattern. "
        "Tests mid-gate stall (G1-G2 permanently) and whether the engine "
        "keeps serving useful items or loops."
    ),
    archetype="plateau",
    target_sessions=25,
)

BURSTY = SyntheticProfile(
    student_id=900_012,
    name="Bursty Bea",
    description=(
        "Good scores (~9) but 7-day gaps between sessions. Tests "
        "effective_theta decay formula (θ - 1.5 × √(days/stability)) "
        "and whether review items resurface after long absences."
    ),
    archetype="bursty",
    target_sessions=20,
    session_gap_days=7.0,
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
    "regressing": REGRESSING,
    "volatile": VOLATILE,
    "plateau": PLATEAU,
    "bursty": BURSTY,
}
