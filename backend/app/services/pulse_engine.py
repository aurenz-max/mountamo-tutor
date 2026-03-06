"""
Lumina Pulse Engine — Adaptive Learning Loop

Unified session assembly + result processing orchestrator.
Composes existing services (CalibrationEngine, MasteryLifecycleEngine,
LearningPathsService, LessonGroupService) into one adaptive loop.

See: Lumina_PRD_Pulse.md §5-6
"""

from __future__ import annotations

import logging
import math
import uuid
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from ..db.firestore_service import FirestoreService
from ..models.calibration import DEFAULT_STUDENT_THETA, StudentAbility
from ..models.mastery_lifecycle import GateHistoryEntry, MasteryLifecycle
from ..models.pulse import (
    CURRENT_BAND_PCT,
    DEFAULT_PULSE_ITEM_COUNT,
    FRONTIER_BAND_PCT,
    FRONTIER_MAX_JUMP,
    FRONTIER_PASS_THRESHOLD,
    FRONTIER_PROBE_MODE,
    LEAPFROG_INFERRED_COMPLETION,
    LEAPFROG_INFERRED_GATE,
    LEAPFROG_INFERRED_SIGMA,
    LEAPFROG_INFERRED_THETA,
    LEAPFROG_RETEST_DAYS,
    PRIMITIVE_HISTORY_WINDOW,
    REVIEW_BAND_PCT,
    CreatePulseSessionRequest,
    GateUpdate,
    LeapfrogEvent,
    PulseBand,
    PulseBandSummary,
    PulseItemSpec,
    PulseResultRequest,
    PulseResultResponse,
    PulseSessionResponse,
    PulseSessionSummary,
    RecentPrimitive,
    ThetaUpdate,
    mode_to_beta,
    theta_to_mode,
)
from ..services.calibration_engine import CalibrationEngine
from ..services.dag_analysis import DAGAnalysisEngine
from ..services.learning_paths import LearningPathsService
from ..services.lesson_group_service import LessonGroupService
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
        logger.info("PulseEngine initialized")

    # ------------------------------------------------------------------
    # Session assembly
    # ------------------------------------------------------------------

    async def assemble_session(
        self,
        student_id: int,
        subject: str,
        item_count: int = DEFAULT_PULSE_ITEM_COUNT,
    ) -> PulseSessionResponse:
        """Compose a Pulse session from 3 bands (or cold-start probes)."""
        now = datetime.now(timezone.utc)
        session_id = f"pulse-{uuid.uuid4().hex[:12]}"

        logger.info(
            f"[PULSE] Assembling session {session_id} for student {student_id}, "
            f"subject={subject}, items={item_count}"
        )

        # 1. Load student state
        lifecycles = await self.firestore.get_all_mastery_lifecycles(
            student_id, subject=subject
        )
        abilities = await self.firestore.get_all_student_abilities(student_id)

        # Load primitive history for diversity tracking
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

        # Build lookup maps
        gate_map: Dict[str, int] = {}
        lifecycle_map: Dict[str, Dict] = {}
        for lc in lifecycles:
            sid = lc.get("subskill_id", "")
            gate_map[sid] = lc.get("current_gate", 0)
            lifecycle_map[sid] = lc

        theta_map: Dict[str, float] = {}
        for ab in abilities:
            theta_map[ab.get("skill_id", "")] = ab.get("theta", DEFAULT_STUDENT_THETA)

        # 2. Load DAG
        graph_data = await self.learning_paths._get_graph(subject)
        if not graph_data or "graph" not in graph_data:
            logger.warning(f"[PULSE] No graph found for subject {subject}")
            return PulseSessionResponse(
                session_id=session_id,
                student_id=student_id,
                subject=subject,
                is_cold_start=True,
                items=[],
                session_meta={"error": "no_graph"},
            )

        graph = graph_data["graph"]
        all_nodes = [n for n in graph.get("nodes", []) if n.get("type", n.get("entity_type", "")) == "subskill"]
        all_edges = graph.get("edges", [])
        node_map = {n["id"]: n for n in all_nodes}
        node_ids = set(node_map.keys())

        # 3. Cold start check
        is_cold_start = len(lifecycles) == 0

        if is_cold_start:
            items = self._assemble_cold_start(
                all_nodes, all_edges, node_map, subject, item_count
            )
        else:
            items = await self._assemble_normal(
                student_id, subject, item_count, all_nodes, all_edges,
                node_map, node_ids, gate_map, lifecycle_map, theta_map, now,
            )

        # 4. Persist session
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
            "leapfrogs": [],
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "completed_at": None,
        }
        await self.firestore.save_pulse_session(session_id, session_doc)

        logger.info(
            f"[PULSE] Session {session_id} assembled: "
            f"{len(items)} items, cold_start={is_cold_start}, "
            f"bands={band_counts}"
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
                "total_nodes_in_subject": len(all_nodes),
            },
        )

    def _assemble_cold_start(
        self,
        all_nodes: List[Dict],
        all_edges: List[Dict],
        node_map: Dict[str, Dict],
        subject: str,
        item_count: int,
    ) -> List[PulseItemSpec]:
        """Cold start: 100% frontier probes at topological midpoints."""
        logger.info("[PULSE] Cold start mode — all items are frontier probes")

        # Use DAGAnalysisEngine to compute metrics and select midpoints
        topo_order = DAGAnalysisEngine.topological_sort(all_nodes, all_edges)
        metrics = DAGAnalysisEngine.compute_node_metrics(
            all_nodes, all_edges, topo_order
        )

        # Select midpoints of independent chains
        probes = DAGAnalysisEngine.select_initial_probes(
            metrics, all_nodes, all_edges, max_probes=item_count,
        )

        items: List[PulseItemSpec] = []
        for i, probe in enumerate(probes):
            node = node_map.get(probe.subskill_id, {})
            items.append(PulseItemSpec(
                item_id=f"pulse-item-{i:03d}",
                band=PulseBand.FRONTIER,
                subskill_id=probe.subskill_id,
                skill_id=node.get("skill_id", probe.skill_id),
                subject=subject,
                description=probe.description or node.get("description", ""),
                target_mode=FRONTIER_PROBE_MODE,
                target_beta=mode_to_beta(FRONTIER_PROBE_MODE),
                lesson_group_id=f"cold-{i:03d}",
            ))

        return items

    async def _assemble_normal(
        self,
        student_id: int,
        subject: str,
        item_count: int,
        all_nodes: List[Dict],
        all_edges: List[Dict],
        node_map: Dict[str, Dict],
        node_ids: Set[str],
        gate_map: Dict[str, int],
        lifecycle_map: Dict[str, Dict],
        theta_map: Dict[str, float],
        now: datetime,
    ) -> List[PulseItemSpec]:
        """Normal 3-band assembly with adaptive proportions."""
        now_iso = now.isoformat()

        # --- Gather all candidates first (before allocating counts) ---

        # REVIEW candidates
        review_candidates = self._gather_review_candidates(
            lifecycle_map, theta_map, node_map, subject, now_iso,
        )

        # CURRENT candidates
        unlocked = await self.learning_paths.get_unlocked_entities(
            student_id, entity_type="subskill", subject=subject,
        )
        frontier_skills = set()
        learning_skills = set()
        for sid in unlocked:
            if sid not in node_ids:
                continue
            gate = gate_map.get(sid, 0)
            if gate == 0:
                frontier_skills.add(sid)
            elif gate == 1:
                lc = lifecycle_map.get(sid, {})
                if lc.get("lesson_eval_count", 0) < 3:
                    learning_skills.add(sid)
        current_candidate_ids = frontier_skills | learning_skills

        # FRONTIER PROBE candidates (BFS 1-5 jumps ahead)
        mastered_ids = {sid for sid, gate in gate_map.items() if gate >= 1}
        probe_candidate_ids = self._gather_probe_candidates(
            frontier_skills, mastered_ids, all_edges, node_map,
        )

        # --- Adaptive allocation (PRD §5.2) ---
        review_avail = len(review_candidates)
        current_avail = len(current_candidate_ids)
        probe_avail = len(probe_candidate_ids)

        review_target = max(1, math.ceil(item_count * REVIEW_BAND_PCT))
        frontier_target = max(1, math.ceil(item_count * FRONTIER_BAND_PCT))
        current_target = item_count - review_target - frontier_target

        # Cap each band to available candidates
        review_count = min(review_target, review_avail)
        frontier_count = min(frontier_target, probe_avail)
        current_count = min(current_target, current_avail)

        # Redistribute surplus slots (from bands with too few candidates)
        surplus = item_count - (review_count + frontier_count + current_count)
        if surplus > 0:
            # Priority: current > frontier > review
            extra_current = min(surplus, current_avail - current_count)
            current_count += extra_current
            surplus -= extra_current

            extra_frontier = min(surplus, probe_avail - frontier_count)
            frontier_count += extra_frontier
            surplus -= extra_frontier

            extra_review = min(surplus, review_avail - review_count)
            review_count += extra_review

        logger.info(
            f"[PULSE] Adaptive allocation: review={review_count}/{review_avail}, "
            f"current={current_count}/{current_avail}, frontier={frontier_count}/{probe_avail}"
        )

        # --- Select items from candidates ---
        review_items = self._select_review_items_from_candidates(
            review_candidates[:review_count], node_map, subject, theta_map,
        )

        current_items = self._select_current_items(
            current_candidate_ids, gate_map, theta_map, node_map,
            subject, current_count,
        )

        probe_items = self._select_frontier_probes_from_candidates(
            probe_candidate_ids[:frontier_count], node_map, subject,
        )

        all_items = review_items + current_items + probe_items
        if not all_items:
            logger.warning("[PULSE] No items available for any band")
            return []

        # Interleave
        return self._interleave(current_items, probe_items, review_items)

    # ------------------------------------------------------------------
    # Band selection helpers
    # ------------------------------------------------------------------

    def _gather_review_candidates(
        self,
        lifecycle_map: Dict[str, Dict],
        theta_map: Dict[str, float],
        node_map: Dict[str, Dict],
        subject: str,
        now_iso: str,
    ) -> List[Tuple[str, Dict, int, int]]:
        """Gather and rank review candidates (subskill_id, lifecycle, gate, days_overdue)."""
        candidates = []
        for sid, lc in lifecycle_map.items():
            gate = lc.get("current_gate", 0)
            if gate < 1 or gate > 3:
                continue
            retest = lc.get("next_retest_eligible")
            if not retest or retest > now_iso:
                continue
            days_overdue = 0
            try:
                retest_dt = datetime.fromisoformat(retest.replace("Z", "+00:00"))
                now_dt = datetime.fromisoformat(now_iso.replace("Z", "+00:00"))
                days_overdue = max(0, (now_dt - retest_dt).days)
            except (ValueError, TypeError):
                pass
            candidates.append((sid, lc, gate, days_overdue))

        # Sort: most overdue first, then lowest gate
        candidates.sort(key=lambda x: (-x[3], x[2]))
        return candidates

    def _select_review_items_from_candidates(
        self,
        candidates: List[Tuple[str, Dict, int, int]],
        node_map: Dict[str, Dict],
        subject: str,
        theta_map: Dict[str, float],
    ) -> List[PulseItemSpec]:
        """Build PulseItemSpec list from ranked review candidates."""
        items: List[PulseItemSpec] = []
        for sid, lc, gate, _ in candidates:
            node = node_map.get(sid, {})
            skill_id = node.get("skill_id", lc.get("skill_id", ""))
            theta = theta_map.get(skill_id, DEFAULT_STUDENT_THETA)
            mode = theta_to_mode(theta)
            items.append(PulseItemSpec(
                item_id=f"pulse-item-{len(items):03d}",
                band=PulseBand.REVIEW,
                subskill_id=sid,
                skill_id=skill_id,
                subject=subject,
                description=node.get("description", "") or node.get("label", ""),
                target_mode=mode,
                target_beta=mode_to_beta(mode),
                lesson_group_id=f"review-{skill_id}",
            ))
        return items

    def _select_current_items(
        self,
        candidates: Set[str],
        gate_map: Dict[str, int],
        theta_map: Dict[str, float],
        node_map: Dict[str, Dict],
        subject: str,
        count: int,
    ) -> List[PulseItemSpec]:
        """Select frontier/learning items grouped via LessonGroupService."""
        # Build candidate dicts for LessonGroupService
        grouper_candidates = []
        for sid in candidates:
            node = node_map.get(sid, {})
            skill_id = node.get("skill_id", "")
            gate = gate_map.get(sid, 0)
            grouper_candidates.append({
                "skill_id": sid,
                "subject": subject,
                "type": "new" if gate == 0 else "review",
                "mastery_gate": gate,
                "unit_title": node.get("unit_title", node.get("parent_label", "")),
                "skill_description": node.get("skill_description", node.get("parent_label", "")),
                "subskill_description": node.get("description", "") or node.get("label", ""),
            })

        if not grouper_candidates:
            return []

        # Group into lesson blocks (Bloom's sorted, 2-5 per block)
        try:
            blocks = LessonGroupService.group_subskills_into_blocks(grouper_candidates)
        except Exception as e:
            logger.warning(f"[PULSE] LessonGroupService failed, falling back: {e}")
            blocks = []

        items: List[PulseItemSpec] = []
        item_offset = 100

        if blocks:
            for block in blocks:
                if len(items) >= count:
                    break
                block_id = f"current-{block.block_id}" if hasattr(block, 'block_id') else f"current-{len(items)}"
                for ss in getattr(block, 'subskills', []):
                    if len(items) >= count:
                        break
                    ss_id = ss.get("subskill_id", "") if isinstance(ss, dict) else getattr(ss, 'subskill_id', '')
                    node = node_map.get(ss_id, {})
                    skill_id = node.get("skill_id", "")
                    theta = theta_map.get(skill_id, DEFAULT_STUDENT_THETA)
                    mode = theta_to_mode(theta)
                    items.append(PulseItemSpec(
                        item_id=f"pulse-item-{item_offset + len(items):03d}",
                        band=PulseBand.CURRENT,
                        subskill_id=ss_id,
                        skill_id=skill_id,
                        subject=subject,
                        description=node.get("description", "") or node.get("label", ""),
                        target_mode=mode,
                        target_beta=mode_to_beta(mode),
                        lesson_group_id=block_id,
                    ))
        else:
            # Fallback: group by parent skill
            skill_groups: Dict[str, List[str]] = defaultdict(list)
            for sid in candidates:
                node = node_map.get(sid, {})
                skill_id = node.get("skill_id", "")
                skill_groups[skill_id].append(sid)

            for skill_id, subskills in skill_groups.items():
                if len(items) >= count:
                    break
                for sid in subskills:
                    if len(items) >= count:
                        break
                    node = node_map.get(sid, {})
                    theta = theta_map.get(skill_id, DEFAULT_STUDENT_THETA)
                    mode = theta_to_mode(theta)
                    items.append(PulseItemSpec(
                        item_id=f"pulse-item-{item_offset + len(items):03d}",
                        band=PulseBand.CURRENT,
                        subskill_id=sid,
                        skill_id=skill_id,
                        subject=subject,
                        description=node.get("description", "") or node.get("label", ""),
                        target_mode=mode,
                        target_beta=mode_to_beta(mode),
                        lesson_group_id=f"current-{skill_id}",
                    ))

        return items

    def _gather_probe_candidates(
        self,
        frontier_skills: Set[str],
        mastered_ids: Set[str],
        all_edges: List[Dict],
        node_map: Dict[str, Dict],
    ) -> List[Tuple[str, int]]:
        """BFS from frontier 1-5 edges forward. Returns (node_id, depth) sorted by depth."""
        forward: Dict[str, List[str]] = defaultdict(list)
        for edge in all_edges:
            forward[edge["source"]].append(edge["target"])

        visited: Set[str] = set()
        probe_candidates: List[Tuple[str, int]] = []
        queue: deque = deque()

        for fid in frontier_skills:
            for child in forward.get(fid, []):
                if child not in mastered_ids and child not in frontier_skills:
                    queue.append((child, 1))

        while queue:
            nid, depth = queue.popleft()
            if nid in visited or depth > FRONTIER_MAX_JUMP:
                continue
            visited.add(nid)
            if nid not in mastered_ids and nid not in frontier_skills:
                probe_candidates.append((nid, depth))
            if depth < FRONTIER_MAX_JUMP:
                for child in forward.get(nid, []):
                    if child not in visited:
                        queue.append((child, depth + 1))

        probe_candidates.sort(key=lambda x: x[1])
        return probe_candidates

    def _select_frontier_probes_from_candidates(
        self,
        candidates: List[Tuple[str, int]],
        node_map: Dict[str, Dict],
        subject: str,
    ) -> List[PulseItemSpec]:
        """Build PulseItemSpec list from ranked probe candidates."""
        items: List[PulseItemSpec] = []
        item_offset = 200

        for nid, depth in candidates:
            node = node_map.get(nid, {})
            skill_id = node.get("skill_id", "")
            items.append(PulseItemSpec(
                item_id=f"pulse-item-{item_offset + len(items):03d}",
                band=PulseBand.FRONTIER,
                subskill_id=nid,
                skill_id=skill_id,
                subject=subject,
                description=node.get("description", "") or node.get("label", ""),
                target_mode=FRONTIER_PROBE_MODE,
                target_beta=mode_to_beta(FRONTIER_PROBE_MODE),
                lesson_group_id=f"probe-{skill_id}",
            ))

        return items

    def _interleave(
        self,
        current: List[PulseItemSpec],
        frontier: List[PulseItemSpec],
        review: List[PulseItemSpec],
    ) -> List[PulseItemSpec]:
        """
        Interleave items: current → probe → current → review → ...

        Front-load current work, space probes and reviews evenly.
        """
        result: List[PulseItemSpec] = []
        ci, fi, ri = 0, 0, 0
        cycle = 0

        while ci < len(current) or fi < len(frontier) or ri < len(review):
            # 2-3 current items
            for _ in range(min(3, len(current) - ci)):
                if ci < len(current):
                    result.append(current[ci])
                    ci += 1

            # 1 frontier probe
            if fi < len(frontier):
                result.append(frontier[fi])
                fi += 1

            # 1-2 more current
            for _ in range(min(2, len(current) - ci)):
                if ci < len(current):
                    result.append(current[ci])
                    ci += 1

            # 1 review
            if ri < len(review):
                result.append(review[ri])
                ri += 1

            cycle += 1

        # Re-number item IDs sequentially
        for i, item in enumerate(result):
            item.item_id = f"pulse-item-{i:03d}"

        return result

    # ------------------------------------------------------------------
    # Result processing
    # ------------------------------------------------------------------

    async def process_result(
        self,
        student_id: int,
        session_id: str,
        result: PulseResultRequest,
    ) -> PulseResultResponse:
        """Process a single item result. Update θ, β, gates, check leapfrog."""
        now = datetime.now(timezone.utc)

        # 1. Load session
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
        skill_id = item_spec["skill_id"]
        subject = session["subject"]

        # 2. Get old θ
        old_ability = await self.firestore.get_student_ability(student_id, skill_id)
        old_theta = old_ability.get("theta", DEFAULT_STUDENT_THETA) if old_ability else DEFAULT_STUDENT_THETA

        # 3. Update IRT (θ and β)
        cal_result = await self.calibration.process_submission(
            student_id=student_id,
            skill_id=skill_id,
            subskill_id=subskill_id,
            primitive_type=result.primitive_type,
            eval_mode=result.eval_mode,
            score=result.score,
            source="practice",
        )

        new_theta = cal_result.get("student_theta", old_theta)
        earned_level = cal_result.get("earned_level", round(new_theta, 1))

        theta_update = ThetaUpdate(
            skill_id=skill_id,
            old_theta=old_theta,
            new_theta=new_theta,
            earned_level=earned_level,
        )

        # 4. Update mastery gate
        gate_update = None
        old_lifecycle = await self.firestore.get_mastery_lifecycle(
            student_id, subskill_id
        )
        old_gate = old_lifecycle.get("current_gate", 0) if old_lifecycle else 0

        eval_source = self._get_eval_source(band, old_gate)

        mastery_result = await self.mastery.process_eval_result(
            student_id=student_id,
            subskill_id=subskill_id,
            subject=subject,
            skill_id=skill_id,
            score=result.score,
            source=eval_source,
        )

        new_gate = mastery_result.get("current_gate", old_gate)
        if new_gate != old_gate:
            gate_update = GateUpdate(
                subskill_id=subskill_id,
                old_gate=old_gate,
                new_gate=new_gate,
            )

        # 5. Leapfrog check (frontier band only)
        leapfrog = None
        if band == PulseBand.FRONTIER.value:
            leapfrog = await self._check_leapfrog(
                student_id, session_id, session, item_spec,
                result.score, subject, now,
            )

        # 6. Update session doc
        items[item_index]["score"] = result.score
        items[item_index]["primitive_type"] = result.primitive_type
        items[item_index]["eval_mode"] = result.eval_mode
        items[item_index]["duration_ms"] = result.duration_ms
        items[item_index]["completed_at"] = now.isoformat()
        items[item_index]["theta_update"] = theta_update.model_dump()
        if gate_update:
            items[item_index]["gate_update"] = gate_update.model_dump()

        completed_count = sum(1 for it in items if it.get("score") is not None)
        total_count = len(items)
        is_complete = completed_count >= total_count

        update_data = {
            "items": items,
            "items_completed": completed_count,
            "updated_at": now.isoformat(),
        }
        if is_complete:
            update_data["status"] = "completed"
            update_data["completed_at"] = now.isoformat()
        if leapfrog:
            leapfrogs = session.get("leapfrogs", [])
            leapfrogs.append(leapfrog.model_dump())
            update_data["leapfrogs"] = leapfrogs

        await self.firestore.save_pulse_session(session_id, update_data)

        # Record primitive usage in rolling history
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
            session_progress={
                "items_completed": completed_count,
                "items_total": total_count,
                "is_complete": is_complete,
                "bands_summary": bands_summary,
            },
        )

    async def _check_leapfrog(
        self,
        student_id: int,
        session_id: str,
        session: Dict,
        item_spec: Dict,
        score: float,
        subject: str,
        now: datetime,
    ) -> Optional[LeapfrogEvent]:
        """Check if a frontier probe triggers leapfrog inference."""
        lesson_group_id = item_spec.get("lesson_group_id", "")

        # Find all items in this lesson group
        group_items = [
            it for it in session.get("items", [])
            if it.get("lesson_group_id") == lesson_group_id
            and it.get("band") == PulseBand.FRONTIER.value
        ]

        # Check if all items in the group are now scored
        # (current item hasn't been updated in the session doc yet,
        # so we count it manually)
        scored_items = []
        for it in group_items:
            if it.get("item_id") == item_spec.get("item_id"):
                scored_items.append(score)
            elif it.get("score") is not None:
                scored_items.append(it["score"])

        if len(scored_items) < len(group_items):
            return None  # Group not complete yet

        # Compute aggregate score
        avg_score = sum(scored_items) / len(scored_items)
        if avg_score < FRONTIER_PASS_THRESHOLD:
            logger.info(
                f"[PULSE] Frontier group {lesson_group_id} failed: "
                f"avg={avg_score:.1f} < {FRONTIER_PASS_THRESHOLD}"
            )
            return None

        # Leapfrog triggered!
        probed_skills = [it.get("subskill_id", "") for it in group_items]
        logger.info(
            f"[PULSE] LEAPFROG! Group {lesson_group_id} passed: "
            f"avg={avg_score:.1f}, probed={probed_skills}"
        )

        # Load graph for inference
        graph_data = await self.learning_paths._get_graph(subject)
        if not graph_data or "graph" not in graph_data:
            return None

        all_edges = graph_data["graph"].get("edges", [])
        all_nodes = graph_data["graph"].get("nodes", [])
        node_map = {n["id"]: n for n in all_nodes}

        # Walk upstream: find all ancestors of probed skills
        # that aren't already mastered
        inferred_skills: List[str] = []
        for probed_id in probed_skills:
            ancestors = DAGAnalysisEngine.get_ancestors(probed_id, all_edges)
            for ancestor_id in ancestors:
                existing = await self.firestore.get_mastery_lifecycle(
                    student_id, ancestor_id
                )
                current_gate = existing.get("current_gate", 0) if existing else 0
                if current_gate < LEAPFROG_INFERRED_GATE:
                    inferred_skills.append(ancestor_id)

        # Deduplicate
        inferred_skills = list(set(inferred_skills))

        if not inferred_skills:
            return LeapfrogEvent(
                lesson_group_id=lesson_group_id,
                probed_skills=probed_skills,
                inferred_skills=[],
                aggregate_score=avg_score,
            )

        # Seed mastery_lifecycle for inferred skills
        retest_date = (now + timedelta(days=LEAPFROG_RETEST_DAYS)).isoformat()
        lifecycles_to_seed: List[Dict] = []
        for sid in inferred_skills:
            node = node_map.get(sid, {})
            lc_data = MasteryLifecycle(
                student_id=student_id,
                subskill_id=sid,
                subject=subject,
                skill_id=node.get("skill_id", ""),
                current_gate=LEAPFROG_INFERRED_GATE,
                completion_pct=LEAPFROG_INFERRED_COMPLETION,
                lesson_eval_count=3,
                next_retest_eligible=retest_date,
                retest_interval_days=LEAPFROG_RETEST_DAYS,
                gate_history=[
                    GateHistoryEntry(
                        gate=LEAPFROG_INFERRED_GATE,
                        timestamp=now.isoformat(),
                        score=avg_score,
                        passed=True,
                        source="diagnostic",
                    )
                ],
            ).model_dump()
            lifecycles_to_seed.append(lc_data)

        if lifecycles_to_seed:
            await self.firestore.batch_write_mastery_lifecycles(
                student_id, lifecycles_to_seed
            )

        # Seed ability for inferred skills
        for sid in inferred_skills:
            node = node_map.get(sid, {})
            ability_skill_id = node.get("skill_id", sid)
            ability = StudentAbility(
                student_id=student_id,
                skill_id=ability_skill_id,
                theta=LEAPFROG_INFERRED_THETA,
                sigma=LEAPFROG_INFERRED_SIGMA,
                earned_level=LEAPFROG_INFERRED_THETA,
                prior_source="pulse_leapfrog",
            )
            await self.firestore.upsert_student_ability(
                student_id, ability_skill_id, ability.model_dump()
            )

        # Refresh frontier
        await self.learning_paths.recalculate_unlocks(student_id, subject)

        logger.info(
            f"[PULSE] Leapfrog seeded {len(inferred_skills)} skills: "
            f"{inferred_skills[:5]}..."
        )

        return LeapfrogEvent(
            lesson_group_id=lesson_group_id,
            probed_skills=probed_skills,
            inferred_skills=inferred_skills,
            aggregate_score=avg_score,
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

        # Aggregate θ changes and gate updates from scored items
        theta_changes: List[ThetaUpdate] = []
        skills_advanced: List[GateUpdate] = []
        for it in scored_items:
            tu = it.get("theta_update")
            if tu:
                theta_changes.append(ThetaUpdate(**tu))
            gu = it.get("gate_update")
            if gu:
                skills_advanced.append(GateUpdate(**gu))

        # Leapfrogs
        leapfrogs = [
            LeapfrogEvent(**lf)
            for lf in session.get("leapfrogs", [])
        ]
        all_inferred = set()
        for lf in leapfrogs:
            all_inferred.update(lf.inferred_skills)

        # Celebration message
        n_leapfrogs = len(leapfrogs)
        n_inferred = len(all_inferred)
        if n_leapfrogs > 0:
            msg = f"You jumped ahead {n_inferred} skills with {n_leapfrogs} leapfrog{'s' if n_leapfrogs > 1 else ''}!"
        elif len(scored_items) >= len(items):
            msg = "Session complete — great work building your skills!"
        else:
            msg = "Keep going — you're making progress!"

        return PulseSessionSummary(
            session_id=session_id,
            subject=session.get("subject", ""),
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

    @staticmethod
    def _get_eval_source(band: str, gate: int) -> str:
        """Map Pulse band + current gate to mastery lifecycle source."""
        if band == PulseBand.REVIEW.value:
            return "practice"
        if band == PulseBand.FRONTIER.value:
            return "practice"
        # CURRENT band
        if gate == 0:
            return "lesson"
        return "practice"
