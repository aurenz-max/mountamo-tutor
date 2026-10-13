"""
Lumina Pulse Engine — Adaptive Learning Loop

Session assembly (the learner model chooses: LearnerStateService.select) +
result processing orchestrator.
Composes existing services (CalibrationEngine, MasteryLifecycleEngine,
LearningPathsService) into one adaptive loop.

See: Lumina_PRD_Pulse.md §5-6
"""

from __future__ import annotations

import asyncio
import logging
import math
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

from ..db.firestore_service import FirestoreService
from ..models.calibration import DEFAULT_STUDENT_THETA
from ..models.pulse import (
    DAILY_MIX_SUBJECT,
    DEFAULT_PULSE_ITEM_COUNT,
    PRIMITIVE_HISTORY_WINDOW,
    PULSE_CONFIRM_SHARE,
    GateUpdate,
    IrtProbabilityData,
    SessionIrtSummary,
    LeapfrogEvent,
    PulseBand,
    PulseBandSummary,
    PulseItemSpec,
    PulseResultRequest,
    PulseResultResponse,
    PulseSessionResponse,
    PulseSessionSummary,
    RecentPrimitive,
    SkillDetail,
    SkillUnlockProgress,
    ThetaUpdate,
    theta_to_mode,
)
from ..services.calibration_engine import CalibrationEngine, item_information
from ..services.calibration.problem_type_registry import (
    get_item_key,
)
from ..services.learning_paths import LearningPathsService

from ..services.mastery_lifecycle_engine import MasteryLifecycleEngine

logger = logging.getLogger(__name__)



class PulseEngine:
    """
    Unified session assembly + result processing orchestrator.

    Composes existing services — does not replace them.
    """

    def __init__(
        self,
        firestore_service: FirestoreService,
        calibration_engine: CalibrationEngine,
        mastery_lifecycle_engine: MasteryLifecycleEngine,
        learning_paths_service: LearningPathsService,
    ):
        self.firestore = firestore_service
        self.calibration = calibration_engine
        self.mastery = mastery_lifecycle_engine
        self.learning_paths = learning_paths_service
        self.learner_state = None  # LearnerStateService, shadow (set by dependency injection)
        logger.info("PulseEngine initialized")

    # ------------------------------------------------------------------
    # Session assembly — the learner model chooses (WORKSTREAMS 7.4, user 10-12)
    # ------------------------------------------------------------------

    async def assemble_session(
        self,
        student_id: int,
        subject: Optional[str],
        item_count: int = DEFAULT_PULSE_ITEM_COUNT,
        now_override: Optional[datetime] = None,
        subject_weights: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> PulseSessionResponse:
        """Compose a Pulse session from the two-layer learner model.

        `LearnerStateService.select` is the one selection brain (the session
        planner's targets come from the same call): teach picks by P(right) x
        teaching value over the Jev learner graph, confirm picks where the
        model believes mastery the lifecycle has not recorded yet. Each item
        names a subskill and the target_beta of its typical item; the frontend
        picks the primitive and mode (7.5). Cold start needs no special path:
        an empty state is the graph's prior, and confirm picks check what it
        infers. The published curriculum graph, Fisher x sigma^2 utility and
        leapfrog probes are retired.

        With no subject the session is the daily mix: `subject_weights` (the
        daily plan's pace allocation, PlanningService.daily_subject_weights)
        divides the items across subjects, each subject's picks coming from
        the same select call, interleaved so no subject runs in a block."""
        now = now_override or datetime.now(timezone.utc)
        session_id = f"pulse-{uuid.uuid4().hex[:12]}"

        logger.info(
            f"[PULSE] Assembling session {session_id} for student {student_id}, "
            f"subject={subject}, items={item_count}"
        )

        if self.learner_state is None:
            raise RuntimeError("PulseEngine needs the learner model (LearnerStateService)")
        if subject:
            sel = await self.learner_state.select(
                student_id, subject, count=item_count, confirm_share=PULSE_CONFIRM_SHARE,
            )
            if sel is not None:
                sel["picks"] = [{**p, "subject": subject} for p in sel["picks"]]
        else:
            subject = DAILY_MIX_SUBJECT
            sel = await self._select_daily_mix(student_id, item_count, subject_weights or {})
        if sel is None:
            logger.warning(f"[PULSE] No learner graph for subject {subject}")
            return PulseSessionResponse(
                session_id=session_id, student_id=student_id, subject=subject,
                is_cold_start=True, items=[], session_meta={"error": "no_learner_graph"},
            )

        is_cold_start = sel.get("observations", 0) == 0
        items: List[PulseItemSpec] = []
        for i, p in enumerate(sel["picks"]):
            items.append(PulseItemSpec(
                item_id=f"pulse-item-{i:03d}",
                band=PulseBand.CURRENT if p["seen"] else PulseBand.FRONTIER,
                subskill_id=p["subskill_id"],
                skill_id=p["skill_id"],
                subject=p["subject"],
                description=p["description"] or p["label"],
                target_mode=theta_to_mode(p["target_beta"]),
                target_beta=p["target_beta"],
                lesson_group_id=f"{p['kind']}-{p['skill_id']}",
                selection_kind=p["kind"],
                selection_reason=p["reason"],
                p_right=p["p_right"],
                grade=p.get("grade"),
            ))

        # Load primitive history for diversity tracking (frontend rotation)
        prim_history_doc = await self.firestore.get_pulse_primitive_history(student_id)
        recent_entries: List[Dict] = (
            prim_history_doc.get("entries", []) if prim_history_doc else []
        )
        recent_primitives = [
            RecentPrimitive(
                primitive_type=e.get("primitive_type", ""),
                eval_mode=e.get("eval_mode", ""),
                score=e.get("score", 0.0),
                subskill_id=e.get("subskill_id", ""),
            )
            for e in recent_entries[-PRIMITIVE_HISTORY_WINDOW:]
        ]

        band_counts = {b.value: 0 for b in PulseBand}
        for item in items:
            band_counts[item.band.value] += 1

        session_doc = {
            "session_id": session_id,
            "student_id": student_id,
            "subject": subject,
            "status": "in_progress",
            "is_cold_start": is_cold_start,
            "items": [item.model_dump() for item in items],
            "band_counts": band_counts,
            "items_completed": 0,
            "items_total": len(items),
            "student_grade": sel.get("student_grade"),
            "leapfrogs": [],
            "selector": {"engine": "learner_model", "graph_version": sel.get("graph_version"),
                         "pool_sizes": sel.get("pool_sizes")},
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "completed_at": None,
        }
        await self.firestore.save_pulse_session(session_id, session_doc)

        logger.info(
            f"[PULSE] Session {session_id} assembled by the learner model: "
            f"{len(items)} items, cold_start={is_cold_start}, pools={sel.get('pool_sizes')}"
        )

        return PulseSessionResponse(
            session_id=session_id,
            student_id=student_id,
            subject=subject,
            is_cold_start=is_cold_start,
            items=items,
            recent_primitives=recent_primitives,
            session_meta={
                "band_counts": band_counts,
                "total_items": len(items),
                "selector": "learner_model",
                "pool_sizes": sel.get("pool_sizes"),
                "student_grade": sel.get("student_grade"),
                **({"subject_quota": sel["subject_quota"]} if "subject_quota" in sel else {}),
            },
        )

    async def _select_daily_mix(self, student_id: int, item_count: int,
                                subject_weights: Dict[str, Dict[str, Any]]) -> Optional[dict]:
        """Daily-mix picks: each subject's quota of `item_count` follows its
        weight (largest remainder), and select runs at that quota so its own
        confirm/learn split and per-skill cap apply per subject. A subject
        whose graph offers fewer picks than its quota passes the rest to the
        heaviest subject that still has picks. Picks are dealt round-robin by
        subject. None when no subject has a learner graph."""
        order = sorted((s for s, w in subject_weights.items() if w.get("weight", 0) > 0),
                       key=lambda s: -subject_weights[s]["weight"])
        if not order:
            return None
        total = sum(subject_weights[s]["weight"] for s in order)
        exact = {s: item_count * subject_weights[s]["weight"] / total for s in order}
        quota = {s: int(exact[s]) for s in order}
        for s in sorted(order, key=lambda s: -(exact[s] - quota[s]))[:item_count - sum(quota.values())]:
            quota[s] += 1

        async def pick(s: str, n: int) -> Optional[dict]:
            return await self.learner_state.select(student_id, s, count=n,
                                                   confirm_share=PULSE_CONFIRM_SHARE,
                                                   grade=subject_weights[s].get("grade"))

        sel_by = dict(zip(order, await asyncio.gather(*(
            pick(s, quota[s]) if quota[s] else asyncio.sleep(0, None) for s in order))))
        got = {s: len((sel_by[s] or {}).get("picks", [])) for s in order}
        exhausted = {s for s in order if quota[s] and got[s] < quota[s]}
        short = item_count - sum(got.values())
        for s in order:
            if short <= 0:
                break
            if s in exhausted:
                continue
            sel = await pick(s, got[s] + short)
            if sel is None:
                continue
            short -= len(sel["picks"]) - got[s]
            sel_by[s], got[s] = sel, len(sel["picks"])
        order = [s for s in order if got[s]]
        if not order:
            return None
        quota = {s: got[s] for s in order}
        lanes = [[{**p, "subject": s} for p in sel_by[s]["picks"]] for s in order]
        picks = [lane[i] for i in range(max(map(len, lanes))) for lane in lanes if i < len(lane)]
        return {
            "picks": picks,
            "observations": sum(sel_by[s].get("observations", 0) for s in order),
            "student_grade": sel_by[order[0]].get("student_grade"),
            "graph_version": {s: sel_by[s].get("graph_version") for s in order},
            "pool_sizes": {s: sel_by[s].get("pool_sizes") for s in order},
            "subject_quota": quota,
        }

    # ------------------------------------------------------------------
    # Result processing
    # ------------------------------------------------------------------

    # A review keeps the problem the student saw; past this size only its
    # top-level keys are kept (Firestore docs cap at 1 MiB).
    MAX_PROBLEM_CONTENT_CHARS = 200_000

    async def _write_l0(self, student_id, subject, skill_id, subskill_id, result, item_spec,
                        session_id, attempt_id, eval_source, band, now) -> None:
        """Attempt + review for one Pulse answer. Best-effort: the IRT, gate and
        learner-state updates above already ran, so a failed write is logged and
        repaired by replay, never raised into the student's session."""
        import json as _json
        score = float(result.score)
        first_try = [bool(x) for x in result.first_try] if result.first_try else None
        success = (all(first_try) if first_try else score >= 9.0)
        extra = {
            "source": "pulse", "eval_source": eval_source,
            "primitive_type": result.primitive_type, "eval_mode": result.eval_mode,
            "success": success, "duration_ms": result.duration_ms,
            "pulse_session_id": session_id, "pulse_item_id": result.item_id, "band": band,
            "selection_kind": item_spec.get("kind") or item_spec.get("selection_kind"),
            "target_beta": item_spec.get("target_beta"),
            # the selector's prediction, to set against the outcome
            "p_right_predicted": item_spec.get("p_right"),
            "subskill_grade": item_spec.get("grade") or item_spec.get("subskill_grade"),
            # the attempt's own clock (the pulse-agent store runs a virtual one)
            "answered_at": now.isoformat(),
        }
        if first_try:
            extra["first_try"] = first_try
            extra["evidence_parts"] = len(first_try)
        extra = {k: v for k, v in extra.items() if v is not None}
        try:
            await self.firestore.save_attempt(
                student_id=student_id, subject=subject, skill_id=skill_id, subskill_id=subskill_id,
                score=score, analysis="", feedback="", additional_data=extra, attempt_id=attempt_id,
            )
        except Exception as e:
            logger.warning(f"[PULSE_L0] attempt write failed for {attempt_id}: {e}")
            return
        save_review = getattr(self.firestore, "save_problem_review", None)
        if save_review is None:
            return
        problem = result.problem_content
        if problem is not None:
            try:
                if len(_json.dumps(problem, default=str)) > self.MAX_PROBLEM_CONTENT_CHARS:
                    problem = {"truncated": True, "keys": sorted(problem.keys())}
            except Exception:
                problem = {"unserializable": True}
        review = {
            "score": score, "correct": success, "accuracy_percentage": score * 10,
            "skill_description": item_spec.get("description", ""),
            "metadata": {
                "source": "pulse", "eval_source": eval_source,
                "primitive_type": result.primitive_type, "eval_mode": result.eval_mode,
                "metrics": result.metrics, "duration_ms": result.duration_ms,
                "first_try": first_try, "pulse_session_id": session_id, "band": band,
                "target_beta": item_spec.get("target_beta"),
            },
        }
        try:
            await save_review(
                student_id=student_id, subject=subject, skill_id=skill_id, subskill_id=subskill_id,
                problem_id=attempt_id, review_data=review,
                problem_content={"primitive_type": result.primitive_type, "problem": problem,
                                 "metrics": result.metrics, "student_work": result.student_work},
                attempt_id=attempt_id,
            )
        except Exception as e:
            logger.warning(f"[PULSE_L0] review write failed for {attempt_id}: {e}")

    async def process_result(
        self,
        student_id: int,
        session_id: str,
        result: PulseResultRequest,
        now_override: Optional[datetime] = None,
        *,
        prefetched_session: Optional[Dict] = None,
        defer_session_save: bool = False,
        defer_primitive_history: bool = False,
        defer_competency: bool = False,
        prefetched_global_pass_rate: Optional[float] = None,
        item_calibration_cache: Optional[Dict[str, Dict]] = None,
    ) -> PulseResultResponse:
        """Process a single item result. Update θ, β, gates, check leapfrog.

        Performance options (for batch callers like Pulse Agent):
            prefetched_session: In-memory session dict — skips Firestore read.
                The dict is mutated in place so the caller can reuse it for
                subsequent items and save once at the end.
            defer_session_save: When True, updates the in-memory session dict
                but skips the Firestore write. Caller must call
                save_deferred_session() after all items are processed.
            defer_primitive_history: When True, skips per-item primitive
                history read+write. Caller should call
                flush_primitive_history() after all items.
            defer_competency: When True, skips per-item competency write.
                Caller should call flush_competency_writes() after all items.
            prefetched_global_pass_rate: Pre-loaded global practice pass rate,
                threaded through to MasteryLifecycleEngine to skip a read per item.
            item_calibration_cache: Shared dict keyed by item_key. On cache miss,
                the fetched doc is stored; on hit, the cached doc is passed to
                CalibrationEngine to skip a Firestore read. Mutated in place.
        """
        now = now_override or datetime.now(timezone.utc)

        # 1. Load session (or use prefetched)
        session = prefetched_session
        if session is None:
            session = await self.firestore.get_pulse_session(session_id)
            if not session:
                raise ValueError(f"Pulse session {session_id} not found")

        items = session.get("items", [])
        item_spec = None
        item_index = -1
        for i, it in enumerate(items):
            if it.get("item_id") == result.item_id:
                item_spec = it
                item_index = i
                break

        if item_spec is None:
            raise ValueError(f"Item {result.item_id} not found in session {session_id}")

        if item_spec.get("score") is not None:
            raise ValueError(f"Item {result.item_id} already scored")

        band = item_spec.get("band", "current")
        subskill_id = item_spec["subskill_id"]
        skill_id = item_spec.get("skill_id", "")
        # Guard: some graph nodes have empty skill_id — derive from subskill
        if not skill_id and subskill_id:
            # Standard pattern: "SKILL-XX-Y" → "SKILL-XX"
            parts = subskill_id.rsplit("-", 1)
            skill_id = parts[0] if len(parts) > 1 else subskill_id
        # A daily-mix session spans subjects; each item carries its own.
        subject = item_spec.get("subject") or session["subject"]

        # 2. Pre-fetch ability + lifecycle in parallel (saves a sequential round-trip)
        old_ability, old_lifecycle = await asyncio.gather(
            self.firestore.get_student_ability(student_id, skill_id),
            self.firestore.get_mastery_lifecycle(student_id, subskill_id),
        )

        old_theta = old_ability.get("theta", DEFAULT_STUDENT_THETA) if old_ability else DEFAULT_STUDENT_THETA
        old_gate = old_lifecycle.get("current_gate", 0) if old_lifecycle else 0

        # 3. Update IRT (θ and β) — pass pre-fetched ability + cached item cal
        item_key = get_item_key(result.primitive_type, result.eval_mode)
        cached_item_cal = (
            item_calibration_cache.get(item_key)
            if item_calibration_cache is not None else None
        )

        cal_result = await self.calibration.process_submission(
            student_id=student_id,
            skill_id=skill_id,
            subskill_id=subskill_id,
            primitive_type=result.primitive_type,
            eval_mode=result.eval_mode,
            score=result.score,
            source="practice",
            first_try=result.first_try,
            prefetched_ability=old_ability,
            prefetched_item_calibration=cached_item_cal,
        )

        # Update the cache with the freshly-written doc for next item
        if item_calibration_cache is not None:
            item_calibration_cache[item_key] = cal_result.get("item_calibration_doc")

        new_theta = cal_result.get("student_theta", old_theta)
        earned_level = cal_result.get("earned_level", round(new_theta, 1))

        theta_update = ThetaUpdate(
            skill_id=skill_id,
            old_theta=old_theta,
            new_theta=new_theta,
            sigma=cal_result.get("sigma"),
            earned_level=earned_level,
        )

        # Build IRT probability data from calibration result
        irt_data = None
        if cal_result.get("p_correct") is not None:
            irt_data = IrtProbabilityData(
                p_correct=cal_result["p_correct"],
                item_information=cal_result.get("item_information", 0.0),
                discrimination_a=cal_result.get("discrimination_a", 1.4),
                guessing_c=cal_result.get("guessing_c", 0.0),
            )

        # 4. Update mastery gate — pass pre-fetched lifecycle + ability to avoid re-reads
        gate_update = None
        eval_source = self._get_eval_source(band, old_gate)

        mastery_result = await self.mastery.process_eval_result(
            student_id=student_id,
            subskill_id=subskill_id,
            subject=subject,
            skill_id=skill_id,
            score=result.score,
            source=eval_source,
            timestamp=now.isoformat(),
            prefetched_lifecycle=old_lifecycle,
            prefetched_ability=cal_result.get("ability_doc"),
            prefetched_global_pass_rate=prefetched_global_pass_rate,
            theta=new_theta,
            sigma=cal_result.get("sigma"),
            item_beta=cal_result.get("calibrated_beta"),
            primitive_type=result.primitive_type,
            avg_a=cal_result.get("discrimination_a"),
            gate_reference_beta=item_spec.get("gate_reference_beta"),
        )

        # Attach blended-P context to IRT data (from gate derivation)
        if irt_data is not None:
            irt_data.p_blended = mastery_result.get("_last_irt_p")
            irt_data.empirical_p = mastery_result.get("_last_empirical_p")

        new_gate = mastery_result.get("current_gate", old_gate)
        if new_gate != old_gate:
            gate_update = GateUpdate(
                subskill_id=subskill_id,
                old_gate=old_gate,
                new_gate=new_gate,
            )

        # 4b. Learner state: the model that chooses the next items (never raises).
        # Leapfrog is retired: the graph infers ancestors of a shown subskill
        # itself, and confirm picks check what it infers.
        attempt_id = f"{session_id}:{result.item_id}"
        if self.learner_state is not None:
            await self.learner_state.submit(
                student_id=student_id, subject=subject, subskill_id=subskill_id, score=result.score,
                primitive_type=result.primitive_type, eval_mode=result.eval_mode,
                first_try=result.first_try, source="pulse", attempt_id=attempt_id,
                timestamp=now.isoformat(),
            )
        leapfrog = None

        # 4c. L0 (user ruling R2): one attempt + one review per item under the
        # learner event's id, so rollups, the profile, the activity history and
        # the learner-state rebuild see Pulse like any lesson answer.
        await self._write_l0(student_id, subject, skill_id, subskill_id, result, item_spec,
                             session_id, attempt_id, eval_source, band, now)

        # 6. Update session doc (always mutate in-memory)
        items[item_index]["score"] = result.score
        items[item_index]["primitive_type"] = result.primitive_type
        items[item_index]["eval_mode"] = result.eval_mode
        items[item_index]["duration_ms"] = result.duration_ms
        items[item_index]["completed_at"] = now.isoformat()
        items[item_index]["theta_update"] = theta_update.model_dump()
        if irt_data:
            items[item_index]["irt"] = irt_data.model_dump()
        if gate_update:
            items[item_index]["gate_update"] = gate_update.model_dump()

        completed_count = sum(1 for it in items if it.get("score") is not None)
        total_count = len(items)
        is_complete = completed_count >= total_count

        # Apply metadata to in-memory session (needed for leapfrog checks
        # on subsequent items in the same session)
        session["items_completed"] = completed_count
        session["updated_at"] = now.isoformat()
        if is_complete:
            session["status"] = "completed"
            session["completed_at"] = now.isoformat()
        if leapfrog:
            leapfrogs = session.get("leapfrogs", [])
            leapfrogs.append(leapfrog.model_dump())
            session["leapfrogs"] = leapfrogs

        if not defer_session_save:
            save_coros = [
                self.firestore.save_pulse_session(session_id, {
                    "items": items,
                    "items_completed": completed_count,
                    "updated_at": now.isoformat(),
                    **({"status": "completed", "completed_at": now.isoformat()} if is_complete else {}),
                    **({"leapfrogs": session["leapfrogs"]} if leapfrog else {}),
                }),
            ]
            # Flush pending unlock recalculations on session complete
            if is_complete:
                for subj in session.pop("_pending_unlock_refresh", set()):
                    save_coros.append(
                        self.learning_paths.recalculate_unlocks(student_id, subj)
                    )
            await asyncio.gather(*save_coros)

        # 6b. Update competency for prerequisite-unlock propagation.
        # Without this write, get_student_proficiency_map() returns 0 for
        # all subskills → depth-1+ children in the curriculum graph never
        # unlock → students get stuck at root subskills only.
        # Routed through apply_competency_eval — the unified incremental
        # writer shared with the practice path (same count basis + blend
        # math), so pulse and practice writes compose instead of clobbering
        # each other with conflicting credibility formulas.
        competency_entry = {
            "student_id": student_id,
            "subject": subject,
            "skill_id": skill_id,
            "subskill_id": subskill_id,
            "score": result.score,
        }
        if defer_competency:
            session.setdefault("_pending_competency_writes", []).append(
                competency_entry
            )
        else:
            await self.firestore.apply_competency_eval(**competency_entry)

        # Record primitive usage in rolling history
        if not defer_primitive_history:
            await self._record_primitive_usage(
                student_id=student_id,
                primitive_type=result.primitive_type,
                eval_mode=result.eval_mode,
                score=result.score,
                subskill_id=subskill_id,
            )

        # Band summary
        bands_summary = {}
        for b in PulseBand:
            band_items = [it for it in items if it.get("band") == b.value]
            scored = [it for it in band_items if it.get("score") is not None]
            bands_summary[b.value] = {
                "total": len(band_items),
                "completed": len(scored),
                "avg_score": (
                    sum(it["score"] for it in scored) / len(scored)
                    if scored else 0
                ),
            }

        return PulseResultResponse(
            item_id=result.item_id,
            theta_update=theta_update,
            gate_update=gate_update,
            leapfrog=leapfrog,
            gate_progress=cal_result.get("gate_progress"),
            irt=irt_data,
            session_progress={
                "items_completed": completed_count,
                "items_total": total_count,
                "is_complete": is_complete,
                "bands_summary": bands_summary,
            },
        )

    # ------------------------------------------------------------------
    # Session queries
    # ------------------------------------------------------------------

    async def get_session(self, session_id: str) -> Dict[str, Any]:
        """Get session state for resume."""
        session = await self.firestore.get_pulse_session(session_id)
        if not session:
            raise ValueError(f"Pulse session {session_id} not found")
        return session

    async def get_session_summary(self, session_id: str) -> PulseSessionSummary:
        """Aggregate completed session results into summary."""
        session = await self.firestore.get_pulse_session(session_id)
        if not session:
            raise ValueError(f"Pulse session {session_id} not found")

        items = session.get("items", [])
        scored_items = [it for it in items if it.get("score") is not None]
        subject = session.get("subject", "")
        student_id = session.get("student_id")

        # Band summaries
        bands: Dict[str, PulseBandSummary] = {}
        for b in PulseBand:
            band_items = [it for it in items if it.get("band") == b.value]
            scored = [it for it in band_items if it.get("score") is not None]
            bands[b.value] = PulseBandSummary(
                band=b,
                items_total=len(band_items),
                items_completed=len(scored),
                avg_score=(
                    sum(it["score"] for it in scored) / len(scored)
                    if scored else 0.0
                ),
            )

        # Duration
        total_ms = sum(it.get("duration_ms", 0) for it in scored_items)

        # Load DAG for skill descriptions
        node_map: Dict[str, Dict] = {}
        for subj in sorted({it.get("subject") or subject for it in items}):
            try:
                graph_data = await self.learning_paths._student_graph(student_id, subj)
                if graph_data and "graph" in graph_data:
                    all_nodes = graph_data["graph"].get("nodes", [])
                    node_map.update({n["id"]: n for n in all_nodes
                                     if n.get("type", n.get("entity_type", "")) == "subskill"})
            except Exception as e:
                logger.warning(f"[PULSE] Could not load DAG for {subj} summary enrichment: {e}")

        def _skill_detail(subskill_id: str) -> SkillDetail:
            node = node_map.get(subskill_id, {})
            return SkillDetail(
                subskill_id=subskill_id,
                skill_id=node.get("skill_id", ""),
                skill_description=node.get("skill_description", node.get("parent_label", "")),
            )

        # Aggregate θ changes and gate updates from scored items
        theta_changes: List[ThetaUpdate] = []
        skills_advanced: List[GateUpdate] = []
        for it in scored_items:
            tu = it.get("theta_update")
            if tu:
                theta_changes.append(ThetaUpdate(**tu))
            gu = it.get("gate_update")
            if gu:
                node = node_map.get(gu.get("subskill_id", ""), {})
                skills_advanced.append(GateUpdate(
                    subskill_id=gu["subskill_id"],
                    old_gate=gu["old_gate"],
                    new_gate=gu["new_gate"],
                    skill_id=node.get("skill_id", ""),
                    skill_description=node.get("skill_description", node.get("parent_label", "")),
                ))

        # Leapfrogs — enrich with skill details
        leapfrogs: List[LeapfrogEvent] = []
        all_inferred: Set[str] = set()
        for lf_raw in session.get("leapfrogs", []):
            probed = lf_raw.get("probed_skills", [])
            inferred = lf_raw.get("inferred_skills", [])
            all_inferred.update(inferred)
            leapfrogs.append(LeapfrogEvent(
                lesson_group_id=lf_raw.get("lesson_group_id", ""),
                probed_skills=probed,
                inferred_skills=inferred,
                aggregate_score=lf_raw.get("aggregate_score", 0.0),
                probed_details=[_skill_detail(sid) for sid in probed],
                inferred_details=[_skill_detail(sid) for sid in inferred],
            ))

        # Skill progress — group unlocked subskills by parent skill
        skill_progress: List[SkillUnlockProgress] = []
        touched_skill_ids: Set[str] = set()
        for gu in skills_advanced:
            if gu.skill_id:
                touched_skill_ids.add(gu.skill_id)
        for sid in all_inferred:
            node = node_map.get(sid, {})
            sk = node.get("skill_id", "")
            if sk:
                touched_skill_ids.add(sk)

        if touched_skill_ids and node_map and student_id:
            # Count total subskills per touched skill from DAG
            skill_totals: Dict[str, int] = defaultdict(int)
            skill_names: Dict[str, str] = {}
            for node in node_map.values():
                sk = node.get("skill_id", "")
                if sk in touched_skill_ids:
                    skill_totals[sk] += 1
                    if sk not in skill_names:
                        skill_names[sk] = node.get(
                            "skill_description",
                            node.get("parent_label", sk),
                        )

            # Count unlocked subskills (gate >= 1) per touched skill
            try:
                all_subskill_ids = [
                    n_id for n_id, n in node_map.items()
                    if n.get("skill_id", "") in touched_skill_ids
                ]
                lifecycle_batch = await self.firestore.get_mastery_lifecycles_batch(
                    student_id, all_subskill_ids
                )
                skill_unlocked: Dict[str, int] = defaultdict(int)
                for ss_id, lc in lifecycle_batch.items():
                    if lc and lc.get("current_gate", 0) >= 1:
                        node = node_map.get(ss_id, {})
                        sk = node.get("skill_id", "")
                        if sk in touched_skill_ids:
                            skill_unlocked[sk] += 1

                for sk in touched_skill_ids:
                    if skill_totals.get(sk, 0) > 0:
                        skill_progress.append(SkillUnlockProgress(
                            skill_id=sk,
                            skill_description=skill_names.get(sk, sk),
                            total_subskills=skill_totals[sk],
                            unlocked_subskills=skill_unlocked.get(sk, 0),
                        ))
                skill_progress.sort(key=lambda sp: sp.skill_id)
            except Exception as e:
                logger.warning(f"[PULSE] Could not compute skill progress: {e}")

        # Celebration message
        n_leapfrogs = len(leapfrogs)
        n_inferred = len(all_inferred)
        if n_leapfrogs > 0:
            msg = f"You jumped ahead {n_inferred} skills with {n_leapfrogs} leapfrog{'s' if n_leapfrogs > 1 else ''}!"
        elif len(scored_items) >= len(items):
            msg = "Session complete — great work building your skills!"
        else:
            msg = "Keep going — you're making progress!"

        # Compute IRT session summary from per-item IRT data
        irt_summary = None
        irt_items = [it for it in scored_items if it.get("irt")]
        if irt_items:
            sigmas = [
                tu.get("sigma", 0) for it in scored_items
                if (tu := it.get("theta_update")) and tu.get("sigma") is not None
            ]
            irt_summary = SessionIrtSummary(
                start_sigma=sigmas[0] if sigmas else 0.0,
                end_sigma=sigmas[-1] if sigmas else 0.0,
                sigma_reduction=round((sigmas[0] - sigmas[-1]), 3) if len(sigmas) >= 2 else 0.0,
                predicted_correct=round(
                    sum(it["irt"].get("p_correct", 0) for it in irt_items), 2
                ),
                actual_correct=round(sum(
                    it.get("score", 0) / 10.0 for it in scored_items
                ), 2),
                total_items=len(scored_items),
                avg_information=round(
                    sum(it["irt"].get("item_information", 0) for it in irt_items) / len(irt_items), 4
                ) if irt_items else 0.0,
            )

        return PulseSessionSummary(
            session_id=session_id,
            subject=subject,
            is_cold_start=session.get("is_cold_start", False),
            items_completed=len(scored_items),
            items_total=len(items),
            duration_ms=total_ms,
            bands=bands,
            skills_advanced=skills_advanced,
            theta_changes=theta_changes,
            leapfrogs=leapfrogs,
            frontier_expanded=n_inferred > 0,
            celebration_message=msg,
            skill_progress=skill_progress,
            irt_summary=irt_summary,
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _record_primitive_usage(
        self,
        student_id: int,
        primitive_type: str,
        eval_mode: str,
        score: float,
        subskill_id: str,
    ) -> None:
        """Append a primitive usage entry to the student's rolling history."""
        try:
            doc = await self.firestore.get_pulse_primitive_history(student_id)
            entries: List[Dict] = doc.get("entries", []) if doc else []

            entries.append({
                "primitive_type": primitive_type,
                "eval_mode": eval_mode,
                "score": score,
                "subskill_id": subskill_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

            # Trim to rolling window
            if len(entries) > PRIMITIVE_HISTORY_WINDOW:
                entries = entries[-PRIMITIVE_HISTORY_WINDOW:]

            await self.firestore.save_pulse_primitive_history(student_id, {
                "entries": entries,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception as e:
            logger.warning(f"[PULSE] Failed to record primitive usage: {e}")

    async def save_deferred_session(
        self, session_id: str, session: Dict,
        student_id: Optional[int] = None,
    ) -> None:
        """Persist a session that was updated in-memory via deferred saves.

        Call this once after processing all items with defer_session_save=True.
        Also flushes any pending unlock recalculations and competency writes
        that accumulated during the session.
        """
        # Clean up transient session state (not serializable to Firestore)
        session.pop("_session_inferred_skills", None)

        # Flush pending unlock recalculations (debounced from leapfrogs)
        pending_subjects: set = session.pop("_pending_unlock_refresh", set())
        unlock_coros = []
        if pending_subjects and student_id is not None:
            for subj in pending_subjects:
                unlock_coros.append(
                    self.learning_paths.recalculate_unlocks(student_id, subj)
                )

        # Flush pending competency writes. Leapfrog seeds are independent
        # overwrites (parallel-safe); eval writes are incremental
        # read-modify-writes via apply_competency_eval, so they run
        # sequentially — the same subskill can appear more than once in a
        # session and concurrent increments would lose updates.
        pending_competency: List[Dict] = session.pop("_pending_competency_writes", [])
        pending_seeds: List[Dict] = session.pop("_pending_competency_seeds", [])
        seed_coros = [
            self.firestore.update_competency(**entry)
            for entry in pending_seeds
        ]

        async def _apply_evals_sequentially() -> None:
            for entry in pending_competency:
                await self.firestore.apply_competency_eval(**entry)

        # Run session save + unlock refreshes + competency writes in parallel
        await asyncio.gather(
            self.firestore.save_pulse_session(session_id, {
                "items": session["items"],
                "items_completed": session.get("items_completed", 0),
                "updated_at": session.get("updated_at", datetime.now(timezone.utc).isoformat()),
                "status": session.get("status", "in_progress"),
                **({"completed_at": session["completed_at"]} if "completed_at" in session else {}),
                **({"leapfrogs": session["leapfrogs"]} if "leapfrogs" in session else {}),
            }),
            *unlock_coros,
            *seed_coros,
            _apply_evals_sequentially(),
        )
        if pending_competency or pending_seeds:
            logger.info(
                f"[PULSE] Flushed {len(pending_competency)} deferred competency "
                f"evals + {len(pending_seeds)} leapfrog seeds"
            )

    async def flush_primitive_history(
        self,
        student_id: int,
        new_entries: List[Dict],
    ) -> None:
        """Write accumulated primitive history entries in one batch.

        Call this once after processing all items with defer_primitive_history=True.
        """
        if not new_entries:
            return
        try:
            doc = await self.firestore.get_pulse_primitive_history(student_id)
            entries: List[Dict] = doc.get("entries", []) if doc else []
            entries.extend(new_entries)
            if len(entries) > PRIMITIVE_HISTORY_WINDOW:
                entries = entries[-PRIMITIVE_HISTORY_WINDOW:]
            await self.firestore.save_pulse_primitive_history(student_id, {
                "entries": entries,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception as e:
            logger.warning(f"[PULSE] Failed to flush primitive history: {e}")

    async def flush_competency_writes(
        self,
        session: Dict,
    ) -> None:
        """Write accumulated competency updates in one parallel batch.

        Call this once after processing all items with defer_competency=True.
        Writes are independent so all go out concurrently.
        """
        pending: List[Dict] = session.pop("_pending_competency_writes", [])
        pending_seeds: List[Dict] = session.pop("_pending_competency_seeds", [])
        if not pending and not pending_seeds:
            return
        # Seeds overwrite independent docs — safe in parallel. Eval writes are
        # incremental read-modify-writes on possibly-repeated subskills, so
        # they run sequentially to avoid losing increments.
        if pending_seeds:
            await asyncio.gather(*(
                self.firestore.update_competency(**entry)
                for entry in pending_seeds
            ))
        for entry in pending:
            await self.firestore.apply_competency_eval(**entry)
        logger.info(
            f"[PULSE] Flushed {len(pending)} deferred competency evals "
            f"+ {len(pending_seeds)} leapfrog seeds"
        )

    @staticmethod
    def _get_eval_source(band: str, gate: int) -> str:
        """All evals route to "practice" — the unified handler manages
        both activation (not_started → active) and gate advancement."""
        return "practice"
