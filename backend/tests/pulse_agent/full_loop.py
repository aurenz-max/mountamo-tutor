"""
Full-Loop Runner (Pulse Agent v2, Phase 3)
==========================================

Drives a synthetic student through the ENTIRE student data loop, day by
virtual day, entirely in memory:

    morning   PlanningService.get_daily_session_plan     (daily-plan fill mode)
              FirestoreAnalyticsService.select_session_targets  (Recommended fill mode)
    daytime   student does the plan — every item submits through the REAL
              production fan-out (CompetencyService.update_competency_from_problem
              → save_attempt → apply_attempt_rollup → apply_competency_eval
              → CalibrationEngine → MasteryLifecycleEngine), plus one Pulse
              session via PulseEngine (its own production path)
    evening   FirestoreAnalyticsService.get_student_profile (canonical serve)
              + tomorrow's selector targets → recorded for assertions

Scores come from the Phase-1 LatentStudent truth model (shared between the
lesson work and the pulse session, so both measure the same ground truth).

The L2 rebuild contract is verified at journey end by replaying L0 attempts
through scripts/backfill_daily_rollups.aggregate_student (the SAME code the
production backfill runs) and diffing against the incrementally-maintained
rollups/profile.

Cosmos note: the platform is Firestore-exclusive (Cosmos deprecated);
CompetencyService runs with cosmos_db=None via the 2026-07-08 optionality
change — no stub, no emulation.
"""

from __future__ import annotations

import importlib.util
import logging
import re
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.services.calibration_engine import CalibrationEngine
from app.services.mastery_lifecycle_engine import MasteryLifecycleEngine
from app.services.competency import CompetencyService
from app.services.curriculum_service import CurriculumService
from app.services.firestore_analytics import FirestoreAnalyticsService
from app.services.planning_service import PlanningService
from app.services.pulse_engine import PulseEngine
from app.services.calibration.problem_type_registry import get_item_key, get_prior_beta
from app.models.pulse import PulseResultRequest

from .in_memory_firestore import InMemoryFirestoreService
from .profiles import SyntheticProfile
from .truth_model import TRUTH_PARAMS, LatentStudent, DEFAULT_DISCRIMINATION_A

logger = logging.getLogger(__name__)

# Lesson-work knobs: how much of the plan the student does per day.
# The student works the WHOLE served plan (the planner already sizes it to
# the session budget); the cap is a runaway backstop, not a session model —
# truncating to a fixed prefix hid "planned but never done" subskills.
MAX_LESSON_SUBSKILLS_PER_DAY = 20
ITEMS_PER_SUBSKILL = 3          # mastery-over-demo: 3+ instances per target
DEFAULT_PRIMITIVE = "ten-frame"  # fallback primitive identity for lesson items
PULSE_ITEMS_PER_DAY = 6


def base_subject_key(subject: Optional[str]) -> str:
    """Planner-side subject key for a grade-prefixed graph id.

    The curriculum graphs are keyed per grade ("MATHEMATICS_GK") while the
    published curriculum / planner iterate base subjects ("MATHEMATICS").
    """
    return re.sub(r"_G\w+$", "", (subject or "").upper())


def _trim_hierarchy(curriculum_data: Any) -> List[Dict[str, Any]]:
    """Reduce a CurriculumService hierarchy to the id/label spine the report
    needs — units → skills → subskills — dropping difficulty/primitive fields
    so the embedded JSON stays small."""
    out: List[Dict[str, Any]] = []
    for unit in curriculum_data or []:
        skills = []
        for skill in unit.get("skills", []) or []:
            subs = [
                {"id": ss.get("id"), "desc": ss.get("description") or ""}
                for ss in (skill.get("subskills", []) or [])
                if ss.get("id")
            ]
            if subs:
                skills.append({
                    "id": skill.get("id"),
                    "desc": skill.get("description") or "",
                    "subskills": subs,
                })
        if skills:
            out.append({
                "id": unit.get("id"),
                "title": unit.get("title") or "",
                "skills": skills,
            })
    return out


# ── Timeline dataclasses ─────────────────────────────────────────────────────


@dataclass
class DaySnapshot:
    """Everything observed on one simulated day."""
    day_number: int
    date: str                       # YYYY-MM-DD (virtual)

    # Morning: what the platform served
    plan_subskills: List[Dict[str, Any]] = field(default_factory=list)
    # [{subskill_id, skill_id, type, verb, subject}]
    retests_due_morning: int = 0
    targets: List[Dict[str, Any]] = field(default_factory=list)
    # selector objectives: [{subskillId, skillId, verb, kind, reason, pCorrect}]

    # Daytime: what the student did
    lesson_items: int = 0
    pulse_items: int = 0
    avg_score: float = 0.0
    gate_advances: int = 0
    lesson_items_by_subject: Dict[str, int] = field(default_factory=dict)
    pulse_subject: str = ""
    # Leapfrog unlocks fired by today's pulse session:
    # [{probed_skills, inferred_skills, aggregate_score, subject}]
    leapfrogs: List[Dict[str, Any]] = field(default_factory=list)

    # Evening: canonical profile serve
    profile_total_attempts: int = 0
    profile_avg_score: float = 0.0
    profile_active_days: int = 0
    truth_snapshot: Dict[str, float] = field(default_factory=dict)
    theta_snapshot: Dict[str, float] = field(default_factory=dict)
    # Evening lifecycle census (graph position — "how far has she gotten")
    mastered_by_subject: Dict[str, int] = field(default_factory=dict)
    active_by_subject: Dict[str, int] = field(default_factory=dict)
    mastered_subskills: List[str] = field(default_factory=list)


@dataclass
class LoopTimeline:
    """Full multi-day journey through the closed loop."""
    student_id: int
    profile_name: str
    archetype: str
    subject: str                    # primary graph id (backward compat)
    grade: str
    subjects: List[str] = field(default_factory=list)  # all graph ids in play
    seeded_from: Optional[int] = None
    initial_profile_attempts: int = 0
    days: List[DaySnapshot] = field(default_factory=list)

    final_profile: Dict[str, Any] = field(default_factory=dict)
    truth_snapshot: Dict[str, float] = field(default_factory=dict)
    parity: Dict[str, Any] = field(default_factory=dict)
    mastery_final: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    ability_final: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    # base subject key → total subskills in that curriculum (progression denominator)
    curriculum_totals: Dict[str, int] = field(default_factory=dict)
    # base subject key → trimmed hierarchy [{id,title,skills:[{id,description,
    # subskills:[{id,description}]}]}] — lets the report show WHERE the student
    # landed in the curriculum (which units/skills mastered), not just counts.
    curriculum_hierarchy: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)
    # subskills never submitted through the lesson path but mastered anyway
    # (frontier probes + leapfrog inference) — the leapfrog fingerprint
    inferred_mastery_count: int = 0
    # the actual subskill ids in that set (for badging in the report)
    inferred_subskills: List[str] = field(default_factory=list)

    @property
    def total_items(self) -> int:
        return sum(d.lesson_items + d.pulse_items for d in self.days)

    @property
    def total_leapfrogs(self) -> int:
        return sum(len(d.leapfrogs) for d in self.days)


# ── Runner ───────────────────────────────────────────────────────────────────


class FullLoopRunner:
    """Assembles the production service stack around the in-memory store
    and walks a synthetic student through N virtual days of the loop."""

    def __init__(
        self,
        mem_fs: InMemoryFirestoreService,
        pulse_engine: PulseEngine,
        seed: Optional[int] = None,
    ):
        self.fs = mem_fs
        self.engine = pulse_engine
        self.seed = seed

        # The SAME engine instances PulseEngine uses — one estimator state.
        self.calibration = CalibrationEngine(mem_fs)
        self.mastery = MasteryLifecycleEngine(mem_fs)

        self.curriculum = CurriculumService(firestore_service=mem_fs)
        self.analytics = FirestoreAnalyticsService(
            mem_fs, self.curriculum,
            learning_paths_service=pulse_engine.learning_paths,
        )
        self.planning = PlanningService(
            mem_fs, self.curriculum,
            learning_paths_service=pulse_engine.learning_paths,
            analytics_service=self.analytics,
        )

        # Production fan-out hub, Firestore-only (Cosmos deprecated)
        self.competency = CompetencyService(self.curriculum)
        self.competency.cosmos_db = None
        self.competency.firestore_service = mem_fs
        self.competency.calibration_engine = self.calibration
        self.competency.mastery_lifecycle_engine = self.mastery

    # -- item difficulty (same source the engine uses) -----------------------

    async def _item_beta(self, primitive_type: str, eval_mode: str) -> float:
        item_key = get_item_key(primitive_type, eval_mode)
        cal = await self.fs.get_item_calibration(item_key)
        if cal and cal.get("calibrated_beta") is not None:
            return float(cal["calibrated_beta"])
        try:
            return float(get_prior_beta(primitive_type, eval_mode))
        except Exception:
            return 5.0

    @staticmethod
    def _skill_for_subskill(subskill_id: str, explicit: Optional[str]) -> str:
        if explicit:
            return explicit
        # ID convention: COUNT001-01-A (subskill) → COUNT001-01 (skill)
        return subskill_id.rsplit("-", 1)[0] if "-" in subskill_id else subskill_id

    # -- one day --------------------------------------------------------------

    async def _extract_plan_subskills(self, plan: Any) -> List[Dict[str, Any]]:
        """Flatten a DailySessionPlan into [{subskill_id, skill_id, type, verb}]."""
        out: List[Dict[str, Any]] = []
        blocks = getattr(plan, "blocks", None) or []
        for block in blocks:
            subskills = getattr(block, "subskills", None)
            if subskills is None and isinstance(block, dict):
                subskills = block.get("subskills", [])
            for entry in subskills or []:
                if not isinstance(entry, dict):
                    entry = entry.model_dump() if hasattr(entry, "model_dump") else dict(entry)
                # BlockSubskill carries subskill_id + skill_id (parent);
                # raw candidate dicts carry the subskill id under skill_id.
                sid = entry.get("subskill_id") or entry.get("skill_id")
                if not sid:
                    continue
                parent = (
                    entry.get("skill_id") if entry.get("subskill_id")
                    else entry.get("parent_skill_id")
                )
                verb = (
                    entry.get("bloom_phase") or entry.get("selection_verb")
                    or entry.get("verb") or "identify"
                )
                verb = getattr(verb, "value", verb)  # BloomLevel enum → str
                out.append({
                    "subskill_id": sid,
                    "skill_id": self._skill_for_subskill(sid, parent),
                    "type": entry.get("status") or entry.get("type", "new"),
                    "verb": str(verb),
                    "subject": base_subject_key(
                        entry.get("subject")
                        or (getattr(block, "subject", None) if not isinstance(block, dict)
                            else block.get("subject"))
                    ),
                })
        return out

    async def _do_lesson_work(
        self,
        profile: SyntheticProfile,
        students: Dict[str, LatentStudent],
        work: List[Dict[str, Any]],
    ) -> tuple:
        """Submit lesson items through the production fan-out. Sequential —
        same subskill can repeat and concurrent RMW loses increments.

        `students` is keyed by base subject key; each target is answered by
        the latent student of its own subject."""
        scores: List[float] = []
        items_by_subject: Dict[str, int] = {}
        primary = base_subject_key(profile.subject)
        for target in work:
            subj_key = target.get("subject") or primary
            student = students.get(subj_key) or students[primary]
            eval_mode = target["verb"]
            beta = await self._item_beta(DEFAULT_PRIMITIVE, eval_mode)
            for _ in range(ITEMS_PER_SUBSKILL):
                theta = student.theta_for(target["skill_id"])
                # Reuse the truth response model directly (same math as pulse)
                from app.services.calibration_engine import p_correct as _p
                p = _p(theta, DEFAULT_DISCRIMINATION_A, beta)
                params = student.params
                weight = params.guess + (1.0 - params.guess - params.slip) * p
                weight += student.rng.gauss(0.0, params.noise_sd)
                weight = max(0.0, min(1.0, weight))
                score = round(weight * 10.0, 1)
                student.practice(target["skill_id"])

                await self.competency.update_competency_from_problem(
                    student_id=profile.student_id,
                    subject=subj_key,
                    skill_id=target["skill_id"],
                    subskill_id=target["subskill_id"],
                    evaluation={"score": score, "correct": score >= 7.0},
                    source="lesson",
                    primitive_type=DEFAULT_PRIMITIVE,
                    eval_mode=eval_mode,
                    attempt_id=str(uuid.uuid4()),
                )
                scores.append(score)
                items_by_subject[subj_key] = items_by_subject.get(subj_key, 0) + 1
        return len(scores), scores, items_by_subject

    async def _do_pulse_session(
        self,
        profile: SyntheticProfile,
        student: LatentStudent,
        virtual_now: datetime,
        subject_id: Optional[str] = None,
    ) -> tuple:
        """One pulse session via PulseEngine's production path.

        Returns (n_items, scores, gate_advances, leapfrogs) — leapfrog
        unlock events are the graph-jump evidence the report audits."""
        pulse_subject = subject_id or profile.subject
        session_resp = await self.engine.assemble_session(
            student_id=profile.student_id,
            subject=pulse_subject,
            item_count=PULSE_ITEMS_PER_DAY,
            now_override=virtual_now,
        )
        scores: List[float] = []
        gate_advances = 0
        leapfrogs: List[Dict[str, Any]] = []
        for item in session_resp.items:
            score = student.answer(item)
            result = await self.engine.process_result(
                student_id=profile.student_id,
                session_id=session_resp.session_id,
                result=PulseResultRequest(
                    item_id=item.item_id,
                    score=score,
                    primitive_type=item.primitive_affinity or DEFAULT_PRIMITIVE,
                    eval_mode=item.eval_mode_name or "identify",
                    duration_ms=5000,
                ),
                now_override=virtual_now,
            )
            if result.gate_update and result.gate_update.new_gate > result.gate_update.old_gate:
                gate_advances += 1
            if result.leapfrog:
                leapfrogs.append({
                    "subject": pulse_subject,
                    "probed_skills": list(result.leapfrog.probed_skills),
                    "inferred_skills": list(result.leapfrog.inferred_skills),
                    "aggregate_score": result.leapfrog.aggregate_score,
                })
            scores.append(score)
        return len(scores), scores, gate_advances, leapfrogs

    # -- journey ---------------------------------------------------------------

    async def run_profile(
        self,
        profile: SyntheticProfile,
        days: int = 20,
        grade: str = "K",
        seeded_from: Optional[int] = None,
        include_pulse: bool = True,
        subjects: Optional[List[str]] = None,
    ) -> LoopTimeline:
        """Walk one synthetic student through N virtual days.

        `subjects` — grade-prefixed graph ids (e.g. ["MATHEMATICS_GK",
        "SCIENCE_GK"]). A real daily session spans 3-4 subjects; the planner
        allocates the day across all of them and the sim follows the plan.
        Defaults to [profile.subject] (single-subject journey).
        """
        params = TRUTH_PARAMS.get(profile.archetype)
        if params is None:
            raise ValueError(f"No truth params for archetype '{profile.archetype}'")
        subjects = list(subjects or ([profile.subject] if profile.subject else []))
        if not subjects:
            raise ValueError("run_profile needs at least one subject")
        profile.subject = subjects[0]

        import random as _random
        # One latent student per subject: same archetype, per-subject weak
        # clusters, deterministic per-subject rng. Skill ids are globally
        # unique, so snapshots merge cleanly.
        base_seed = self.seed or profile.student_id
        students: Dict[str, LatentStudent] = {
            base_subject_key(s): LatentStudent(
                params, s, _random.Random(base_seed + idx)
            )
            for idx, s in enumerate(subjects)
        }
        gap_days = profile.session_gap_days or 1.0

        timeline = LoopTimeline(
            student_id=profile.student_id,
            profile_name=profile.name,
            archetype=profile.archetype,
            subject=profile.subject or "",
            grade=grade,
            subjects=subjects,
            seeded_from=seeded_from,
        )

        # Grade of record — planning-side field the planner/selector read
        await self.fs.set_student_grade_level(profile.student_id, grade)

        # CurriculumService requires async init to mark Firestore usable
        if not self.curriculum._use_firestore:
            await self.curriculum.initialize()

        # Curriculum membership per subject — progression denominators and
        # the evening census bucket lifecycles by subskill-id membership
        # (never by the subject string on the doc).
        from app.services.planning_service import PlanningService as _PS
        subject_id_sets: Dict[str, set] = {}
        for s in subjects:
            key = base_subject_key(s)
            try:
                curriculum_data = await self.curriculum.get_curriculum(key)
                subject_id_sets[key] = _PS._collect_subskill_ids(curriculum_data)
                timeline.curriculum_hierarchy[key] = _trim_hierarchy(curriculum_data)
            except Exception as e:
                logger.warning(f"No curriculum hierarchy for {key}: {e}")
                subject_id_sets[key] = set()
            timeline.curriculum_totals[key] = len(subject_id_sets[key])

        virtual_now = datetime.now(timezone.utc)

        # Baseline for serve-integrity (nonzero on seeded runs)
        initial_summary = await self.fs.get_profile_summary(profile.student_id) or {}
        timeline.initial_profile_attempts = int(initial_summary.get("total_attempts", 0) or 0)

        lesson_worked: set = set()   # subskills ever submitted via the lesson path

        for day_num in range(1, days + 1):
            self.fs.virtual_now = virtual_now
            # A new virtual day = a new real day: expire read-side caches
            # (the analytics TTL cache would otherwise serve yesterday's
            # profile, since virtual days pass in milliseconds of wall time).
            self.analytics.clear_cache()
            day = DaySnapshot(day_number=day_num, date=virtual_now.isoformat()[:10])

            # 1. MORNING — what would the platform serve today?
            try:
                due = await self.fs.get_mastery_retests_due(
                    profile.student_id, virtual_now.isoformat()
                )
                day.retests_due_morning = len(due)
            except Exception:
                pass
            try:
                plan = await self.planning.get_daily_session_plan(
                    profile.student_id, force_refresh=True
                )
                day.plan_subskills = await self._extract_plan_subskills(plan)
            except Exception as e:
                logger.warning(f"  Day {day_num}: daily plan failed: {e}")

            for subj_id in subjects:
                try:
                    targets_resp = await self.analytics.select_session_targets(
                        profile.student_id, subject=subj_id, count=4
                    )
                    day.targets.extend(
                        {**{k: o.get(k) for k in
                            ("subskillId", "skillId", "verb", "kind", "reason", "pCorrect")},
                         "subject": base_subject_key(subj_id)}
                        for o in targets_resp.get("objectives", [])
                    )
                except Exception as e:
                    logger.warning(f"  Day {day_num}: session targets failed for {subj_id}: {e}")

            # 2. DAYTIME — the student does the WHOLE served plan (the
            # planner already sized it to the session; the cap is a backstop)
            all_scores: List[float] = []
            if len(day.plan_subskills) > MAX_LESSON_SUBSKILLS_PER_DAY:
                logger.warning(
                    f"  Day {day_num}: plan has {len(day.plan_subskills)} "
                    f"subskills, trimming to {MAX_LESSON_SUBSKILLS_PER_DAY}"
                )
            work = day.plan_subskills[:MAX_LESSON_SUBSKILLS_PER_DAY]
            if not work and day.targets:
                # Planner empty (e.g. cold start) → fall back to selector picks
                work = [
                    {
                        "subskill_id": t["subskillId"],
                        "skill_id": self._skill_for_subskill(t["subskillId"], t.get("skillId")),
                        "type": t["kind"],
                        "verb": t.get("verb") or "identify",
                        "subject": t.get("subject") or base_subject_key(profile.subject),
                    }
                    for t in day.targets if t.get("subskillId")
                ]
            if work:
                n, scores, by_subject = await self._do_lesson_work(
                    profile, students, work
                )
                day.lesson_items = n
                day.lesson_items_by_subject = by_subject
                all_scores.extend(scores)
                lesson_worked.update(t["subskill_id"] for t in work)

            # … plus the daily pulse measurement beat, rotating through the
            # subjects so every curriculum gets its measurement cadence
            if include_pulse:
                pulse_subject = subjects[(day_num - 1) % len(subjects)]
                day.pulse_subject = pulse_subject
                try:
                    n, scores, adv, leapfrogs = await self._do_pulse_session(
                        profile,
                        students[base_subject_key(pulse_subject)],
                        virtual_now,
                        subject_id=pulse_subject,
                    )
                    day.pulse_items = n
                    day.gate_advances = adv
                    day.leapfrogs = leapfrogs
                    all_scores.extend(scores)
                except Exception as e:
                    logger.warning(f"  Day {day_num}: pulse session failed: {e}")

            day.avg_score = (
                round(sum(all_scores) / len(all_scores), 2) if all_scores else 0.0
            )

            # 3. EVENING — canonical profile serve + state snapshots
            try:
                prof = await self.analytics.get_student_profile(profile.student_id)
                totals = prof.get("totals", {}) or {}
                recent = prof.get("recent", {}) or {}
                day.profile_total_attempts = int(totals.get("total_attempts", 0) or 0)
                day.profile_avg_score = float(totals.get("avg_score", 0) or 0)
                day.profile_active_days = int(recent.get("active_days", 0) or 0)
                timeline.final_profile = prof
            except Exception as e:
                logger.warning(f"  Day {day_num}: profile serve failed: {e}")

            day.truth_snapshot = {}
            for st in students.values():
                day.truth_snapshot.update(st.snapshot())
            abilities = await self.fs.get_all_student_abilities(profile.student_id)
            day.theta_snapshot = {
                a.get("skill_id", ""): round(a.get("theta", 3.0), 3) for a in abilities
            }

            # Lifecycle census — graph position by subject (id membership)
            lifecycles = await self.fs.get_all_mastery_lifecycles(profile.student_id)
            for lc in lifecycles:
                sid = lc.get("subskill_id", "")
                gate = lc.get("current_gate", 0)
                for key, id_set in subject_id_sets.items():
                    if sid in id_set:
                        if gate >= 4:
                            day.mastered_by_subject[key] = day.mastered_by_subject.get(key, 0) + 1
                            day.mastered_subskills.append(sid)
                        elif gate >= 1:
                            day.active_by_subject[key] = day.active_by_subject.get(key, 0) + 1
                        break
            day.mastered_subskills.sort()

            timeline.days.append(day)
            logger.info(
                f"  Day {day_num}/{days}: plan={len(day.plan_subskills)} subskills, "
                f"did {day.lesson_items} lesson + {day.pulse_items} pulse items, "
                f"avg={day.avg_score:.1f}, mastered={sum(day.mastered_by_subject.values())}, "
                f"leapfrogs={len(day.leapfrogs)}"
            )

            # night — forgetting + next day
            for st in students.values():
                st.sleep(gap_days)
            virtual_now += timedelta(days=gap_days)

        self.fs.virtual_now = None
        timeline.truth_snapshot = {}
        for st in students.values():
            timeline.truth_snapshot.update(st.snapshot())

        lifecycles = await self.fs.get_all_mastery_lifecycles(profile.student_id)
        timeline.mastery_final = {
            lc.get("subskill_id", ""): {
                "current_gate": lc.get("current_gate", 0),
                "retention_state": lc.get("retention_state", ""),
            }
            for lc in lifecycles
        }
        timeline.inferred_subskills = sorted(
            sid for sid, m in timeline.mastery_final.items()
            if m.get("current_gate", 0) >= 4 and sid not in lesson_worked
        )
        timeline.inferred_mastery_count = len(timeline.inferred_subskills)
        abilities = await self.fs.get_all_student_abilities(profile.student_id)
        timeline.ability_final = {
            a.get("skill_id", ""): {
                "theta": a.get("theta", 3.0),
                "sigma": a.get("sigma", 2.0),
                "total_items_seen": a.get("total_items_seen", 0),
            }
            for a in abilities
        }

        # L2 rebuild contract: replay L0 through the production backfill logic
        timeline.parity = await self.check_rollup_parity(
            profile.student_id, skip=seeded_from is not None
        )
        return timeline

    # -- L2 parity oracle -------------------------------------------------------

    async def check_rollup_parity(
        self, student_id: int, skip: bool = False
    ) -> Dict[str, Any]:
        """Replay L0 attempts via scripts/backfill_daily_rollups.aggregate_student
        (the production rebuild) and diff against incrementally-kept L2 docs."""
        if skip:
            return {"checked": False, "reason": "seeded run — source rollups predate the sim"}

        script_path = (
            Path(__file__).resolve().parent.parent.parent
            / "scripts" / "backfill_daily_rollups.py"
        )
        spec = importlib.util.spec_from_file_location("backfill_daily_rollups", script_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        replay_rollups, replay_profile, replay_count = await module.aggregate_student(
            self.fs, student_id
        )

        stored_rollups = {
            d["date"]: d for d in await self.fs.get_daily_rollups(student_id)
        }
        stored_profile = await self.fs.get_profile_summary(student_id) or {}

        def _day_proj(doc: Dict[str, Any]) -> tuple:
            return (
                int(doc.get("attempts", 0)),
                round(float(doc.get("sum_score", 0.0)), 3),
                tuple(sorted(doc.get("subskills", []) or [])),
                tuple(sorted(
                    (k, int(v.get("attempts", 0)))
                    for k, v in (doc.get("subjects") or {}).items()
                )),
            )

        mismatches: List[str] = []
        for day in sorted(set(replay_rollups) | set(stored_rollups)):
            r, s = replay_rollups.get(day), stored_rollups.get(day)
            if r is None or s is None:
                mismatches.append(f"{day}: present only in {'stored' if r is None else 'replay'}")
            elif _day_proj(r) != _day_proj(s):
                mismatches.append(f"{day}: replay={_day_proj(r)} stored={_day_proj(s)}")

        def _prof_proj(doc: Dict[str, Any]) -> tuple:
            return (
                int(doc.get("total_attempts", 0)),
                round(float(doc.get("sum_score", 0.0)), 3),
                tuple(sorted(
                    (k, int(v.get("attempts", 0)))
                    for k, v in (doc.get("subjects") or {}).items()
                )),
            )

        profile_match = _prof_proj(replay_profile) == _prof_proj(stored_profile)
        if not profile_match:
            mismatches.append(
                f"profile: replay={_prof_proj(replay_profile)} stored={_prof_proj(stored_profile)}"
            )

        return {
            "checked": True,
            "attempts_replayed": replay_count,
            "days_compared": len(set(replay_rollups) | set(stored_rollups)),
            "match": not mismatches,
            "mismatches": mismatches[:10],
        }


# ── Mid-year seeding (--seed-from) ───────────────────────────────────────────


async def seed_from_student(
    real_fs: Any,
    mem_fs: InMemoryFirestoreService,
    source_student_id: int,
    target_student_id: int,
) -> Dict[str, int]:
    """ONE batched read of a real student's docs into the in-memory store.

    The journey then runs and diverges entirely in memory — zero writes back
    to Firestore. This is the only per-run Firestore access besides the
    curriculum bootstrap.
    """
    counts: Dict[str, int] = {}

    abilities = await real_fs.get_all_student_abilities(source_student_id)
    for doc in abilities:
        doc = dict(doc)
        doc["student_id"] = target_student_id
        mem_fs._abilities[target_student_id][doc.get("skill_id", "")] = doc
    counts["abilities"] = len(abilities)

    lifecycles = await real_fs.get_all_mastery_lifecycles(source_student_id)
    for doc in lifecycles:
        doc = dict(doc)
        doc["student_id"] = target_student_id
        mem_fs._mastery_lifecycles[target_student_id][doc.get("subskill_id", "")] = doc
    counts["lifecycles"] = len(lifecycles)

    competencies = await real_fs.get_all_competencies(source_student_id)
    for doc in competencies:
        doc = dict(doc)
        doc["student_id"] = target_student_id
        key = f"{doc.get('subject')}_{doc.get('skill_id')}_{doc.get('subskill_id')}"
        mem_fs._competencies[target_student_id][key] = doc
    counts["competencies"] = len(competencies)

    attempts = await real_fs.get_student_attempts(source_student_id, limit=2000)
    for doc in attempts:
        doc = dict(doc)
        doc["student_id"] = target_student_id
        mem_fs._attempts[target_student_id].append(doc)
    mem_fs._attempts[target_student_id].sort(key=lambda a: a.get("timestamp", ""))
    counts["attempts"] = len(attempts)

    rollups = await real_fs.get_daily_rollups(source_student_id)
    for doc in rollups:
        doc = dict(doc)
        doc["student_id"] = target_student_id
        mem_fs._daily_rollups[target_student_id][doc.get("date", "")] = doc
    counts["rollups"] = len(rollups)

    profile = await real_fs.get_profile_summary(source_student_id)
    if profile:
        profile = dict(profile)
        profile["student_id"] = target_student_id
        mem_fs._profile_summary[target_student_id] = profile
    counts["profile_summary"] = 1 if profile else 0

    planning_fields = await real_fs.get_student_planning_fields(source_student_id)
    if planning_fields:
        await mem_fs.update_student_planning_fields(target_student_id, planning_fields)
    counts["planning_fields"] = 1 if planning_fields else 0

    logger.info(f"[SeedFrom] {source_student_id} → {target_student_id}: {counts}")
    return counts


# ── Loop assertions ──────────────────────────────────────────────────────────


def run_loop_assertions(timeline: LoopTimeline) -> List[Any]:
    """Closed-loop validity checks. Returns assertions.AssertionResult list."""
    from .assertions import AssertionResult

    results: List[AssertionResult] = []
    days = timeline.days

    # 1. L2 rebuild contract
    parity = timeline.parity or {}
    if parity.get("checked"):
        results.append(AssertionResult(
            name="rollup_replay_parity",
            passed=bool(parity.get("match")),
            message=(
                f"Replay of {parity.get('attempts_replayed', 0)} L0 attempts vs "
                f"incremental L2 over {parity.get('days_compared', 0)} days: "
                + ("MATCH" if parity.get("match")
                   else f"MISMATCH {parity.get('mismatches')}")
            ),
        ))
    else:
        results.append(AssertionResult(
            name="rollup_replay_parity", passed=True,
            message=f"Skipped — {parity.get('reason', 'not checked')}",
        ))

    # 2. Serve integrity: profile totals reflect every LESSON attempt the sim
    # made. (Pulse results don't write L0 attempt docs — matching production:
    # PulseEngine.process_result never calls save_attempt.)
    sim_lesson_items = sum(d.lesson_items for d in days)
    served = days[-1].profile_total_attempts if days else 0
    new_served = served - timeline.initial_profile_attempts
    results.append(AssertionResult(
        name="serve_integrity",
        passed=new_served == sim_lesson_items and sim_lesson_items > 0,
        message=(
            f"Profile serve shows {new_served} new attempts; "
            f"sim submitted {sim_lesson_items} lesson items "
            f"(+{sum(d.pulse_items for d in days)} pulse items, no L0 by design)"
        ),
    ))

    # 3. The platform planned work every day — empty days are acceptable
    # only as a TERMINAL streak with high mastery (curriculum genuinely
    # exhausted: nothing to plan is the correct answer). A mid-journey
    # empty day, or an empty streak with low mastery (stuck planner —
    # "plan=0 subskills every loop day"), still fails.
    total_curriculum = sum((timeline.curriculum_totals or {}).values())
    first_terminal_empty = len(days)
    for i in range(len(days) - 1, -1, -1):
        if days[i].plan_subskills or days[i].targets:
            break
        first_terminal_empty = i
    days_with_plan = 0
    exhausted_days = 0
    for i, d in enumerate(days):
        if d.plan_subskills or d.targets:
            days_with_plan += 1
        elif (
            i >= first_terminal_empty
            and total_curriculum
            and sum(d.mastered_by_subject.values()) >= 0.7 * total_curriculum
        ):
            exhausted_days += 1
    results.append(AssertionResult(
        name="plan_every_day",
        passed=(days_with_plan + exhausted_days) == len(days) and len(days) > 0,
        message=(
            f"Plan or targets produced on {days_with_plan}/{len(days)} days"
            + (f" (+{exhausted_days} terminal empty day(s) with curriculum "
               f"≥70% mastered — exhausted)" if exhausted_days else "")
        ),
    ))

    # 4. Responsiveness: what's recommended changes as the student progresses
    if len(days) >= 5:
        target_sets = [
            frozenset(t["subskillId"] for t in d.targets if t.get("subskillId"))
            for d in days if d.targets
        ]
        distinct = len(set(target_sets))
        all_targets = set().union(*target_sets) if target_sets else set()
        first = target_sets[0] if target_sets else frozenset()
        results.append(AssertionResult(
            name="targets_responsive",
            passed=len(all_targets) > len(first) or distinct > 1,
            message=(
                f"Selector produced {distinct} distinct target sets, "
                f"{len(all_targets)} unique subskills across {len(target_sets)} days"
            ),
        ))

        # 5. MASTERED (gate 4) subskills leave the learn targets. Gate 3 is
        # deliberately still servable — the selector classifies learn/confirm
        # by P(correct) at hardest-assigned-mode β, and a gate-3 subskill can
        # legitimately need more work at its hardest mode.
        # Judged against the PREVIOUS evening's mastery: final-day targets
        # are picked that morning, before the day's own gate advances exist.
        mastered = (
            set(days[-2].mastered_subskills) if len(days) >= 2
            else {
                sid for sid, m in timeline.mastery_final.items()
                if m.get("current_gate", 0) >= 4
            }
        )
        final_learn = {
            t["subskillId"] for t in days[-1].targets
            if t.get("kind") == "learn" and t.get("subskillId")
        }
        overlap = mastered & final_learn
        if mastered:
            results.append(AssertionResult(
                name="mastered_leaves_targets",
                passed=not overlap,
                message=(
                    f"{len(mastered)} subskills at gate 4 (mastered); "
                    f"{len(overlap)} still served as learn targets on final day"
                    + (f": {sorted(overlap)[:4]}" if overlap else "")
                ),
            ))

    # 6. STALE-PLAN GUARD: a subskill mastered by yesterday evening must not
    # be served as a "new" plan item today. This is the regression gate for
    # the 2026-07-08 subject-key bug (lifecycle docs invisible to the planner
    # → the same 4 mastered subskills re-planned as "new" for 50 days).
    stale_hits: List[str] = []
    for i in range(1, len(days)):
        mastered_prev = set(days[i - 1].mastered_subskills)
        if not mastered_prev:
            continue
        for p in days[i].plan_subskills:
            if p.get("type") == "new" and p.get("subskill_id") in mastered_prev:
                stale_hits.append(f"day{days[i].day_number}:{p['subskill_id']}")
    results.append(AssertionResult(
        name="plan_not_stale",
        passed=not stale_hits,
        message=(
            "No mastered subskill re-planned as 'new'" if not stale_hits
            else f"{len(stale_hits)} stale plan entries (first 5: {stale_hits[:5]})"
        ),
    ))

    # 7. LEAPFROGGING: capable students in a grade-level curriculum should
    # jump ahead via frontier probes. Low-ability archetypes are exempt.
    from .truth_model import TRUTH_PARAMS as _TP
    theta0 = getattr(_TP.get(timeline.archetype), "base_theta", 0.0)
    lf = timeline.total_leapfrogs
    inferred = timeline.inferred_mastery_count
    expected = theta0 >= 4.5 and len(days) >= 10
    results.append(AssertionResult(
        name="leapfrogging_active",
        passed=(lf > 0 or inferred > 0) if expected else True,
        message=(
            f"{lf} leapfrog events; {inferred} subskills mastered without "
            f"lesson work (frontier/leapfrog inference)"
            + ("" if expected else " — not expected for this archetype, informational")
        ),
    ))

    # 8. REVIEWS SURFACE: when mastery retests fall due on the virtual
    # timeline, the daily plan must carry review blocks. (High-ability
    # archetypes can jump G0→G4 directly and never owe a retest — then
    # there is nothing to surface and this passes vacuously.)
    due_days = sum(1 for d in days if d.retests_due_morning > 0)
    review_days = sum(
        1 for d in days
        if any(p.get("type") in ("review", "retest") for p in d.plan_subskills)
    )
    results.append(AssertionResult(
        name="reviews_surfaced",
        passed=review_days > 0 if due_days > 0 else True,
        message=(
            f"Retests due on {due_days}/{len(days)} days; review blocks "
            f"planned on {review_days} days"
            + ("" if due_days else " — none fell due, nothing to surface")
        ),
    ))

    # 9. Weakness routing (selective_weakness only): truly-weak skills get picked
    if timeline.archetype == "selective_weakness" and timeline.truth_snapshot:
        truths = timeline.truth_snapshot
        mean_truth = sum(truths.values()) / len(truths)
        weak_skills = {k for k, v in truths.items() if v < mean_truth - 1.0}
        targeted_skills = set()
        for d in days:
            for t in d.targets:
                sid = t.get("subskillId") or ""
                targeted_skills.add(sid.rsplit("-", 1)[0] if "-" in sid else sid)
            for p in d.plan_subskills:
                targeted_skills.add(p.get("skill_id", ""))
        hit = weak_skills & targeted_skills
        if weak_skills:
            results.append(AssertionResult(
                name="weakness_routed",
                passed=bool(hit),
                message=(
                    f"{len(hit)}/{len(weak_skills)} truly-weak skills surfaced "
                    f"in plans/targets during the journey"
                ),
            ))

    return results


# ── Report ───────────────────────────────────────────────────────────────────


def generate_loop_report(timeline: LoopTimeline, results: List[Any]) -> str:
    lines: List[str] = []
    _h = lines.append

    subjects = timeline.subjects or [timeline.subject]
    _h(f"# Full-Loop Journey — {timeline.profile_name} ({timeline.archetype})")
    _h("")
    _h(f"- Student: {timeline.student_id}  |  Subjects: {', '.join(subjects)}  |  Grade: {timeline.grade}")
    _h(f"- Days: {len(timeline.days)}  |  Items: {timeline.total_items}"
       f"  |  Leapfrog events: {timeline.total_leapfrogs}"
       + (f"  |  Seeded from: {timeline.seeded_from}" if timeline.seeded_from else ""))
    _h("")

    _h("## Assertions")
    _h("")
    _h("| Assertion | Result | Detail |")
    _h("|-----------|--------|--------|")
    for r in results:
        _h(f"| {r.name} | {'PASS' if r.passed else 'FAIL'} | {r.message} |")
    _h("")

    # Curriculum progression — how far through each subject's graph
    if timeline.days and timeline.curriculum_totals:
        _h("## Curriculum Progression")
        _h("")
        _h("| Subject | Total subskills | Mastered day 1 | Mastered final | % mastered | Active final |")
        _h("|---------|-----------------|----------------|----------------|------------|--------------|")
        first, last = timeline.days[0], timeline.days[-1]
        for key, total in sorted(timeline.curriculum_totals.items()):
            m0 = first.mastered_by_subject.get(key, 0)
            m1 = last.mastered_by_subject.get(key, 0)
            act = last.active_by_subject.get(key, 0)
            pct = (100.0 * m1 / total) if total else 0.0
            _h(f"| {key} | {total} | {m0} | {m1} | {pct:.0f}% | {act} |")
        _h("")
        _h(f"- Subskills mastered WITHOUT lesson work (frontier probes + "
           f"leapfrog inference): **{timeline.inferred_mastery_count}**")
        _h("")

    _h("## Day Timeline")
    _h("")
    _h("| Day | Date | Planned | Done (lesson+pulse) | By subject | Avg | Gate adv | Leapfrogs | Mastered | Learn targets |")
    _h("|-----|------|---------|---------------------|------------|-----|----------|-----------|----------|---------------|")
    for d in timeline.days:
        learn = [t["subskillId"] for t in d.targets if t.get("kind") == "learn"]
        by_subj = " ".join(
            f"{k.split('_')[0][:4]}:{v}"
            for k, v in sorted(d.lesson_items_by_subject.items())
        ) or "-"
        _h(
            f"| {d.day_number} | {d.date} | {len(d.plan_subskills)} | "
            f"{d.lesson_items}+{d.pulse_items} | {by_subj} | {d.avg_score:.1f} | "
            f"{d.gate_advances} | {len(d.leapfrogs)} | "
            f"{sum(d.mastered_by_subject.values())} | "
            f"{', '.join(learn[:3])}{'…' if len(learn) > 3 else ''} |"
        )
    _h("")

    # Leapfrog audit — every graph jump, with what it inferred
    all_leapfrogs = [
        (d.day_number, lf) for d in timeline.days for lf in d.leapfrogs
    ]
    _h("## Leapfrog Audit")
    _h("")
    if all_leapfrogs:
        _h("| Day | Subject | Probed (frontier pass) | Inferred ancestors | Score |")
        _h("|-----|---------|------------------------|--------------------|-------|")
        for day_num, lf in all_leapfrogs[:40]:
            probed = ", ".join(lf.get("probed_skills", [])[:3])
            inferred = lf.get("inferred_skills", [])
            inf_str = ", ".join(inferred[:4]) + ("…" if len(inferred) > 4 else "")
            _h(f"| {day_num} | {lf.get('subject', '')} | {probed} | "
               f"{inf_str} ({len(inferred)}) | {lf.get('aggregate_score', 0):.1f} |")
        if len(all_leapfrogs) > 40:
            _h("")
            _h(f"…and {len(all_leapfrogs) - 40} more events.")
    else:
        _h("No leapfrog events fired this journey.")
    _h("")

    # Recommendation audit — why the selector picked what it picked
    _h("## Recommendation Audit (first/mid/last day)")
    _h("")
    audit_days = [timeline.days[i] for i in
                  sorted({0, len(timeline.days) // 2, len(timeline.days) - 1})
                  if timeline.days]
    for d in audit_days:
        _h(f"**Day {d.day_number}** ({d.date}):")
        for t in d.targets:
            _h(f"- `{t.get('subskillId')}` [{t.get('kind')}/{t.get('verb')}] "
               f"P={t.get('pCorrect')} — {t.get('reason')}")
        if not d.targets:
            _h("- (no targets)")
        _h("")

    # Truth vs estimate at journey end
    if timeline.truth_snapshot:
        _h("## Truth vs Estimate (final)")
        _h("")
        _h("| Skill | θ_true | θ_est | σ | n |")
        _h("|-------|--------|-------|---|---|")
        for skill_id in sorted(timeline.truth_snapshot):
            ab = timeline.ability_final.get(skill_id)
            if not ab:
                continue
            _h(
                f"| {skill_id} | {timeline.truth_snapshot[skill_id]:.2f} | "
                f"{ab['theta']:.2f} | {ab['sigma']:.2f} | {ab['total_items_seen']} |"
            )
        _h("")

    # L2 parity detail
    parity = timeline.parity or {}
    _h("## L2 Rebuild Contract (rollup replay parity)")
    _h("")
    if parity.get("checked"):
        _h(f"- Attempts replayed: {parity.get('attempts_replayed')}")
        _h(f"- Days compared: {parity.get('days_compared')}")
        _h(f"- Result: {'MATCH — incremental L2 == replay(L0)' if parity.get('match') else 'MISMATCH'}")
        for m in parity.get("mismatches", []):
            _h(f"  - {m}")
    else:
        _h(f"- Skipped: {parity.get('reason')}")
    _h("")

    return "\n".join(lines)


def save_loop_timeline(timeline: LoopTimeline, output_dir: Path) -> Path:
    import json
    output_dir.mkdir(parents=True, exist_ok=True)
    tag = (
        f"MULTI_G{timeline.grade}" if len(timeline.subjects) > 1
        else timeline.subject
    )
    path = output_dir / (
        f"loop_{timeline.profile_name.replace(' ', '_')}_{tag}.json"
    )
    with open(path, "w", encoding="utf-8") as f:
        json.dump(asdict(timeline), f, indent=2, default=str)
    return path
