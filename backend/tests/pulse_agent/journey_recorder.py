"""
Journey Recorder
================

Captures a full timeline of a synthetic student's progression through Pulse.
After each session, snapshots the student's mastery lifecycles, abilities (θ),
leapfrog events, and frontier position into an in-memory timeline.

The timeline can then be serialized to JSON or passed to reports/assertions.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ── Data classes for journey snapshots ──────────────────────────────────────


@dataclass
class ItemResult:
    """One item within a session."""
    item_id: str
    band: str
    subskill_id: str
    skill_id: str
    description: str
    target_mode: int
    target_beta: float
    score: float
    theta_before: float
    theta_after: float
    gate_before: int
    gate_after: int
    leapfrog_triggered: bool = False
    inferred_skills: List[str] = field(default_factory=list)

    # IRT result data (from calibration after scoring)
    p_correct: Optional[float] = None
    item_information: Optional[float] = None
    discrimination_a: Optional[float] = None
    p_blended: Optional[float] = None       # credibility-blended P used for gate checks
    empirical_p: Optional[float] = None     # empirical pass rate (score/10 weighted)

    # Frontier context (from session assembly — why was this item chosen?)
    dag_distance: Optional[int] = None
    ancestors_if_passed: Optional[int] = None
    lesson_group_id: str = ""


@dataclass
class SessionSnapshot:
    """State captured after one complete Pulse session."""
    session_number: int
    session_id: str
    is_cold_start: bool
    items: List[ItemResult]
    band_counts: Dict[str, int]

    # Aggregate stats
    avg_score: float = 0.0
    total_leapfrogs: int = 0
    total_gate_advances: int = 0

    # Post-session mastery state
    mastery_snapshot: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    # {subskill_id: {current_gate, completion_pct, passes, fails, ...}}

    ability_snapshot: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    # {skill_id: {theta, sigma, earned_level, total_items_seen}}

    timestamp: str = ""


@dataclass
class JourneyTimeline:
    """Full journey for one synthetic student."""
    student_id: int
    profile_name: str
    archetype: str
    subject: str
    sessions: List[SessionSnapshot] = field(default_factory=list)
    started_at: str = ""
    completed_at: str = ""
    total_curriculum_nodes: int = 0  # total subskill nodes in the DAG

    @property
    def total_sessions(self) -> int:
        return len(self.sessions)

    @property
    def total_items(self) -> int:
        return sum(len(s.items) for s in self.sessions)

    @property
    def total_leapfrogs(self) -> int:
        return sum(s.total_leapfrogs for s in self.sessions)

    @property
    def total_gate_advances(self) -> int:
        return sum(s.total_gate_advances for s in self.sessions)

    @property
    def unique_skills_touched(self) -> int:
        skills = set()
        for s in self.sessions:
            for item in s.items:
                skills.add(item.skill_id)
        return len(skills)

    @property
    def unique_subskills_touched(self) -> int:
        subskills = set()
        for s in self.sessions:
            for item in s.items:
                subskills.add(item.subskill_id)
        return len(subskills)

    def latest_mastery(self) -> Dict[str, Dict[str, Any]]:
        """Return the most recent mastery snapshot."""
        if self.sessions:
            return self.sessions[-1].mastery_snapshot
        return {}

    def latest_abilities(self) -> Dict[str, Dict[str, Any]]:
        """Return the most recent ability snapshot."""
        if self.sessions:
            return self.sessions[-1].ability_snapshot
        return {}

    def theta_progression(self, skill_id: str) -> List[float]:
        """Track θ for a skill across sessions."""
        thetas = []
        for s in self.sessions:
            ability = s.ability_snapshot.get(skill_id)
            if ability:
                thetas.append(ability.get("theta", 0.0))
        return thetas

    def gate_progression(self, subskill_id: str) -> List[int]:
        """Track gate level for a subskill across sessions."""
        gates = []
        for s in self.sessions:
            lifecycle = s.mastery_snapshot.get(subskill_id)
            if lifecycle:
                gates.append(lifecycle.get("current_gate", 0))
        return gates


# ── Recorder class ──────────────────────────────────────────────────────────


class JourneyRecorder:
    """
    Records journey timelines by snapshotting Firestore state after each session.
    """

    def __init__(self, firestore_service: Any):
        self.firestore = firestore_service

    async def create_timeline(
        self,
        student_id: int,
        profile_name: str,
        archetype: str,
        subject: str,
    ) -> JourneyTimeline:
        """Start a new journey timeline."""
        return JourneyTimeline(
            student_id=student_id,
            profile_name=profile_name,
            archetype=archetype,
            subject=subject,
            started_at=datetime.now(timezone.utc).isoformat(),
        )

    async def snapshot_session(
        self,
        timeline: JourneyTimeline,
        session_number: int,
        session_id: str,
        is_cold_start: bool,
        item_results: List[ItemResult],
        band_counts: Dict[str, int],
    ) -> SessionSnapshot:
        """
        Capture post-session state from Firestore and append to timeline.
        """
        student_id = timeline.student_id

        # Fetch current mastery lifecycles
        lifecycles = await self.firestore.get_all_mastery_lifecycles(
            student_id, subject=timeline.subject
        )
        mastery_snap = {}
        for lc in lifecycles:
            sid = lc.get("subskill_id", "")
            mastery_snap[sid] = {
                "current_gate": lc.get("current_gate", 0),
                "completion_pct": lc.get("completion_pct", 0.0),
                "passes": lc.get("passes", 0),
                "fails": lc.get("fails", 0),
                "lesson_eval_count": lc.get("lesson_eval_count", 0),
                "next_retest_eligible": lc.get("next_retest_eligible"),
                "gate_mode": lc.get("gate_mode", ""),
            }

        # Fetch current abilities
        abilities = await self.firestore.get_all_student_abilities(student_id)
        ability_snap = {}
        for ab in abilities:
            skill = ab.get("skill_id", "")
            ability_snap[skill] = {
                "theta": ab.get("theta", 3.0),
                "sigma": ab.get("sigma", 2.0),
                "earned_level": ab.get("earned_level", 3.0),
                "total_items_seen": ab.get("total_items_seen", 0),
            }

        # Compute aggregates
        scores = [r.score for r in item_results]
        avg_score = sum(scores) / len(scores) if scores else 0.0
        total_leapfrogs = sum(1 for r in item_results if r.leapfrog_triggered)
        total_gate_advances = sum(
            1 for r in item_results if r.gate_after > r.gate_before
        )

        snapshot = SessionSnapshot(
            session_number=session_number,
            session_id=session_id,
            is_cold_start=is_cold_start,
            items=item_results,
            band_counts=band_counts,
            avg_score=avg_score,
            total_leapfrogs=total_leapfrogs,
            total_gate_advances=total_gate_advances,
            mastery_snapshot=mastery_snap,
            ability_snapshot=ability_snap,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

        timeline.sessions.append(snapshot)
        return snapshot

    @staticmethod
    def save_timeline(timeline: JourneyTimeline, output_dir: Path) -> Path:
        """Serialize a timeline to JSON."""
        output_dir.mkdir(parents=True, exist_ok=True)
        subject_tag = f"_{timeline.subject}" if timeline.subject else ""
        filename = f"journey_{timeline.profile_name}{subject_tag}_{timeline.student_id}.json"
        path = output_dir / filename

        data = asdict(timeline)
        with open(path, "w") as f:
            json.dump(data, f, indent=2, default=str)

        logger.info(f"Saved journey to {path}")
        return path

    @staticmethod
    def load_timeline(path: Path) -> Dict[str, Any]:
        """Load a saved timeline from JSON."""
        with open(path) as f:
            return json.load(f)
