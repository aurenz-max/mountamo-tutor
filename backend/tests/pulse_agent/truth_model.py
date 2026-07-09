"""
Latent Student Truth Model (Pulse Agent v2, Phase 1)
====================================================

Ground-truth ability model that replaces scripted archetype scores with
IRT-derived responses. Each synthetic student carries a TRUE ability
(theta_true) per skill on the engine's 0-10 theta scale; every answer is
sampled from the same 3PL response model the CalibrationEngine assumes:

    P(correct) = c + (1 - c) / (1 + exp(-a * (theta_true - beta_item)))

The submitted 0-10 score is a continuous response weight around that
probability (matching CalibrationEngine's response_weight = score / 10):

    weight = clamp(guess + (1 - guess - slip) * P + N(0, noise_sd))
    score  = 10 * weight

Development is emergent, not scripted:
- LEARNING: each exposure raises theta_true toward a growth cap with
  diminishing returns:  theta += lr * (cap - theta) / cap
- FORGETTING: between sessions theta_true decays exponentially toward a
  consolidated floor (theta0 + retention * (peak - theta0)):
  theta = floor + (theta - floor) * exp(-decay_rate * gap_days)
- DRIFT: optional per-session drift models regression/motivation loss.

Because the sim knows theta_true, assertions can test what v1 never could:
does the engine's ESTIMATED theta converge to the truth, and does the
selector prioritize the skills that are genuinely weak?
"""

from __future__ import annotations

import hashlib
import math
import random
from dataclasses import dataclass, field
from typing import Dict, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .profiles import SyntheticProfile

from app.models.pulse import PulseItemSpec
from app.services.calibration_engine import p_correct

from .scenarios import ScoreStrategy

# Theta scale bounds (mirror app.models.calibration THETA_GRID_MIN/MAX)
THETA_MIN = 0.0
THETA_MAX = 10.0

# Default discrimination when an item doesn't tell us better.
# ProblemTypeRegistry priors are ~1.0; keep the truth model aligned.
DEFAULT_DISCRIMINATION_A = 1.0


# ── Truth parameters per archetype ──────────────────────────────────────────


@dataclass
class TruthParams:
    """Latent-ability parameterization of one archetype (0-10 theta scale)."""

    base_theta: float          # starting true ability for a fresh skill
    growth_cap: float          # theta_true asymptote under practice
    learning_rate: float       # per-exposure gain factor (see LatentStudent.practice)
    decay_rate: float = 0.01   # per-day exponential forgetting rate
    retention: float = 0.6     # fraction of gains consolidated (floor of decay)
    session_drift: float = 0.0 # additive per-session theta change (regression)
    noise_sd: float = 0.08     # response-weight noise (0-1 scale)
    guess: float = 0.03        # floor of response weight
    slip: float = 0.05         # ceiling loss of response weight
    skill_jitter_sd: float = 0.4   # per-skill spread around base_theta
    weak_cluster_offset: float = 0.0  # added to theta for weak-keyword skills

    def clamp_theta(self, t: float) -> float:
        return max(THETA_MIN, min(THETA_MAX, t))


# Weakness keywords per base subject (matched against item descriptions).
# Shared semantics with SelectiveWeaknessStrategy, but keyed by NORMALIZED
# subject (profile.subject is grade-suffixed at runtime, e.g. MATHEMATICS_GK).
WEAK_KEYWORDS_BY_SUBJECT: Dict[str, list] = {
    "mathematics": ["fraction", "decimal", "ratio", "percent"],
    "science": ["force", "energy", "gravity", "motion"],
    "language arts": ["grammar", "punctuation", "spelling", "tense"],
}


def normalize_subject(subject: Optional[str]) -> str:
    """MATHEMATICS_GK / Mathematics / LANGUAGE_ARTS_G1 → 'mathematics' / 'language arts'."""
    if not subject:
        return ""
    s = subject.strip().lower().replace("_", " ")
    # strip trailing grade token: "mathematics gk" → "mathematics"
    parts = s.split()
    if parts and parts[-1].startswith("g") and (
        parts[-1] == "gk" or parts[-1][1:].isdigit()
    ):
        parts = parts[:-1]
    return " ".join(parts)


TRUTH_PARAMS: Dict[str, TruthParams] = {
    # Strong, fast, retains well. High theta_true from day one.
    "gifted": TruthParams(base_theta=6.5, growth_cap=9.2, learning_rate=0.20,
                          decay_rate=0.004, noise_sd=0.06),
    # Solid middle: learns steadily, mild forgetting.
    "steady": TruthParams(base_theta=4.3, growth_cap=8.0, learning_rate=0.12,
                          decay_rate=0.010),
    # Low ability, slow gains, forgets faster than learns.
    "struggling": TruthParams(base_theta=1.8, growth_cap=5.0, learning_rate=0.05,
                              decay_rate=0.020, noise_sd=0.12),
    # Strong overall, genuinely weak on one conceptual cluster.
    "selective_weakness": TruthParams(base_theta=5.8, growth_cap=8.5,
                                      learning_rate=0.12, weak_cluster_offset=-3.2),
    # Unknown quantity — middling truth, first session ever.
    "cold_start": TruthParams(base_theta=3.5, growth_cap=7.5, learning_rate=0.12,
                              noise_sd=0.12),
    # Learns fast, forgets fast: high decay, low consolidation.
    "forgetful": TruthParams(base_theta=5.0, growth_cap=8.0, learning_rate=0.18,
                             decay_rate=0.20, retention=0.35),
    # Starts weak but learning rate is the highest in the roster.
    "accelerating": TruthParams(base_theta=2.5, growth_cap=8.8, learning_rate=0.40),
    # Spiky truth: some skills genuinely strong, prerequisites genuinely weak.
    "shallow_roots": TruthParams(base_theta=5.5, growth_cap=8.5, learning_rate=0.12,
                                 skill_jitter_sd=2.2),
    # Truth itself erodes every session (motivation loss / disruption).
    "regressing": TruthParams(base_theta=6.5, growth_cap=8.0, learning_rate=0.06,
                              session_drift=-0.28, retention=0.9),
    # Ability is fine; measurement is drowned in response noise.
    "volatile": TruthParams(base_theta=4.5, growth_cap=7.5, learning_rate=0.10,
                            noise_sd=0.30, slip=0.10),
    # Fast ramp into a LOW cap — consistent mediocrity forever after.
    "plateau": TruthParams(base_theta=3.0, growth_cap=5.6, learning_rate=0.35),
    # Steady-like learner; the 7-day profile gap is what stresses decay.
    "bursty": TruthParams(base_theta=5.0, growth_cap=8.0, learning_rate=0.14,
                          decay_rate=0.06),
}


# ── Latent student ──────────────────────────────────────────────────────────


class LatentStudent:
    """Ground-truth ability state for one synthetic student."""

    def __init__(self, params: TruthParams, subject: Optional[str],
                 rng: random.Random):
        self.params = params
        self.rng = rng
        self.subject_key = normalize_subject(subject)
        self.weak_keywords = WEAK_KEYWORDS_BY_SUBJECT.get(self.subject_key, [])

        self.theta_true: Dict[str, float] = {}
        self._theta0: Dict[str, float] = {}   # initial truth per skill
        self._peak: Dict[str, float] = {}     # highest truth reached per skill
        self.exposures: Dict[str, int] = {}

    # -- initialization ------------------------------------------------------

    def _is_weak(self, skill_id: str, description: str) -> bool:
        """Weak-cluster membership. Keyword match where the curriculum has
        matching content (e.g. 'fraction' in G3+ math); otherwise a
        deterministic structural pick (~25% of skills via md5 — NOT
        Python's hash(), which is randomized per process) so the archetype
        produces a separable weak cluster on ANY subject/grade."""
        desc = (description or "").lower()
        if self.weak_keywords and any(kw in desc for kw in self.weak_keywords):
            return True
        digest = int(hashlib.md5(skill_id.encode("utf-8")).hexdigest(), 16)
        return digest % 4 == 0

    def theta_for(self, skill_id: str, description: str = "") -> float:
        """Get (lazily initializing) true theta for a skill."""
        if skill_id not in self.theta_true:
            p = self.params
            t = p.base_theta + self.rng.gauss(0.0, p.skill_jitter_sd)
            if p.weak_cluster_offset and self._is_weak(skill_id, description):
                t += p.weak_cluster_offset
            t = p.clamp_theta(t)
            self.theta_true[skill_id] = t
            self._theta0[skill_id] = t
            self._peak[skill_id] = t
            self.exposures[skill_id] = 0
        return self.theta_true[skill_id]

    # -- response model ------------------------------------------------------

    def answer(self, item: PulseItemSpec) -> float:
        """Answer one item: sample a 0-10 score from the 3PL truth model,
        then apply the practice (learning) effect."""
        p = self.params
        theta = self.theta_for(item.skill_id, item.description)

        prob = p_correct(theta, DEFAULT_DISCRIMINATION_A, item.target_beta)
        weight = p.guess + (1.0 - p.guess - p.slip) * prob
        weight += self.rng.gauss(0.0, p.noise_sd)
        weight = max(0.0, min(1.0, weight))

        self.practice(item.skill_id)
        return round(weight * 10.0, 1)

    def expected_weight(self, skill_id: str, beta: float) -> float:
        """Noise-free expected response weight (for reports/assertions)."""
        p = self.params
        prob = p_correct(self.theta_true.get(skill_id, p.base_theta),
                         DEFAULT_DISCRIMINATION_A, beta)
        return p.guess + (1.0 - p.guess - p.slip) * prob

    # -- development ---------------------------------------------------------

    def practice(self, skill_id: str) -> None:
        """One exposure: theta_true rises toward the cap, diminishing returns."""
        p = self.params
        t = self.theta_true[skill_id]
        gain = p.learning_rate * max(0.0, p.growth_cap - t) / max(p.growth_cap, 1e-6)
        t = p.clamp_theta(t + gain)
        self.theta_true[skill_id] = t
        self._peak[skill_id] = max(self._peak[skill_id], t)
        self.exposures[skill_id] += 1

    def sleep(self, gap_days: float) -> None:
        """Between sessions: exponential forgetting toward a consolidated floor,
        plus any per-session drift (regression archetypes)."""
        p = self.params
        for skill_id, t in self.theta_true.items():
            theta0 = self._theta0[skill_id]
            peak = self._peak[skill_id]
            floor = theta0 + p.retention * max(0.0, peak - theta0)
            if p.decay_rate > 0 and gap_days > 0 and t > floor:
                t = floor + (t - floor) * math.exp(-p.decay_rate * gap_days)
            if p.session_drift:
                t += p.session_drift
            self.theta_true[skill_id] = p.clamp_theta(t)

    # -- introspection -------------------------------------------------------

    def snapshot(self) -> Dict[str, float]:
        """Current true theta per skill (rounded for serialization)."""
        return {k: round(v, 3) for k, v in self.theta_true.items()}


# ── Strategy adapter — plugs into the existing runner unchanged ────────────


class TruthModelStrategy(ScoreStrategy):
    """ScoreStrategy backed by a LatentStudent instead of a script."""

    def __init__(self, profile: "SyntheticProfile", seed: Optional[int] = None):
        super().__init__(profile, seed)
        archetype = profile.archetype
        params = TRUTH_PARAMS.get(archetype)
        if params is None:
            raise ValueError(
                f"No truth params for archetype '{archetype}'. "
                f"Available: {sorted(TRUTH_PARAMS)}"
            )
        self.student = LatentStudent(params, profile.subject, self.rng)
        self._gap_days = profile.session_gap_days or 1.0

    def advance_session(self) -> None:
        # Session 1 starts fresh; sleep applies BETWEEN sessions.
        if self.session_number >= 1:
            self.student.sleep(self._gap_days)
        super().advance_session()

    def score_item(self, item: PulseItemSpec) -> float:
        return self.student.answer(item)

    @property
    def truth_thetas(self) -> Dict[str, float]:
        """Read by the runner to stamp truth snapshots onto the timeline."""
        return self.student.snapshot()

    @property
    def truth_meta(self) -> Dict[str, float]:
        """Response-model params — lets assertions correct for known
        guess/slip compression when judging estimator convergence."""
        p = self.student.params
        return {
            "guess": p.guess,
            "slip": p.slip,
            "noise_sd": p.noise_sd,
            "discrimination_a": DEFAULT_DISCRIMINATION_A,
            "session_drift": p.session_drift,
        }


def get_truth_strategy(profile: "SyntheticProfile",
                       seed: Optional[int] = None) -> TruthModelStrategy:
    return TruthModelStrategy(profile, seed=seed)
