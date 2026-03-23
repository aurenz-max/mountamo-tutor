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
from ..models.mastery_lifecycle import (
    INITIAL_STABILITY,
    TARGET_RETENTION,
    TRIVIAL_THRESHOLD,
    GateHistoryEntry,
    MasteryLifecycle,
)
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
    LEAPFROG_INFERRED_STABILITY,
    LEAPFROG_INFERRED_THETA,
    MAX_CURRENT_ITEMS_PER_SKILL,
    PRIMITIVE_HISTORY_WINDOW,
    REVIEW_BAND_PCT,
    CreatePulseSessionRequest,
    GateUpdate,
    IrtProbabilityData,
    ItemFrontierContext,
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
    SessionFrontierContext,
    SkillDetail,
    SkillUnlockProgress,
    ThetaUpdate,
    UnitProgress,
    mode_to_beta,
    theta_to_mode,
)
from ..services.calibration_engine import CalibrationEngine, item_information, p_correct
from ..services.calibration.problem_type_registry import (
    PROBLEM_TYPE_REGISTRY,
    get_item_discrimination,
    get_prior_beta,
)
from ..services.dag_analysis import DAGAnalysisEngine
from ..services.learning_paths import LearningPathsService
from ..services.lesson_group_service import LessonGroupService
from ..services.mastery_lifecycle_engine import (
    MasteryLifecycleEngine,
    derive_retention_state,
    effective_theta,
)

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
    # Max-information mode selection (replaces theta_to_mode for 2PL/3PL)
    # ------------------------------------------------------------------

    @staticmethod
    def select_best_mode(
        theta: float, primitive_type: str
    ) -> tuple[int, float, str]:
        """Select the eval mode that gives maximum Fisher information.

        Returns (mode_number, target_beta, eval_mode_name). Falls back to
        theta_to_mode() for primitives not in the registry.
        """
        modes = PROBLEM_TYPE_REGISTRY.get(primitive_type)
        if not modes:
            mode = theta_to_mode(theta)
            return mode, mode_to_beta(mode), "default"

        best_mode_num = 1
        best_beta = 3.5
        best_info = -1.0
        best_name = "default"

        # Eval modes are keyed by name; we need to map them to mode numbers.
        # Sort by beta (ascending) and assign mode 1, 2, 3, ...
        sorted_modes = sorted(modes.items(), key=lambda x: x[1].prior_beta)

        for idx, (eval_mode_name, config) in enumerate(sorted_modes, start=1):
            a, c = get_item_discrimination(primitive_type, eval_mode_name)
            info = item_information(theta, a, config.prior_beta, c)
            if info > best_info:
                best_info = info
                best_mode_num = idx
                best_beta = config.prior_beta
                best_name = eval_mode_name

        return best_mode_num, best_beta, best_name

    # ------------------------------------------------------------------
    # Session assembly
    # ------------------------------------------------------------------

    async def assemble_session(
        self,
        student_id: int,
        subject: str,
        item_count: int = DEFAULT_PULSE_ITEM_COUNT,
        now_override: Optional[datetime] = None,
    ) -> PulseSessionResponse:
        """Compose a Pulse session from 3 bands (or cold-start probes)."""
        now = now_override or datetime.now(timezone.utc)
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
        retention_map: Dict[str, str] = {}  # subskill_id → retention_state
        lifecycle_map: Dict[str, Dict] = {}
        for lc in lifecycles:
            sid = lc.get("subskill_id", "")
            gate_map[sid] = lc.get("current_gate", 0)
            rs, _ = derive_retention_state(lc)
            retention_map[sid] = rs
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
                node_map, node_ids, gate_map, retention_map, lifecycle_map,
                theta_map, now,
            )

        # 4. Compute frontier context (graph position data for the frontend)
        session_frontier_ctx = self._compute_frontier_context(
            items, all_nodes, all_edges, node_map,
            gate_map, lifecycle_map, is_cold_start, now,
        )

        # 5. Persist session
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
            frontier_context=session_frontier_ctx,
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
        retention_map: Dict[str, str],
        lifecycle_map: Dict[str, Dict],
        theta_map: Dict[str, float],
        now: datetime,
    ) -> List[PulseItemSpec]:
        """Normal 3-band assembly with adaptive proportions."""

        # --- Gather all candidates first (before allocating counts) ---

        # REVIEW candidates — stability-based (PRD §16.6A)
        review_candidates = self._gather_review_candidates(
            lifecycle_map, theta_map, node_map, subject, now,
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
            rs = retention_map.get(sid, "not_started")
            if rs == "not_started":
                frontier_skills.add(sid)
            elif rs == "active":
                # Active = initial mastery achieved but retention still building.
                learning_skills.add(sid)
        current_candidate_ids = frontier_skills | learning_skills

        # FRONTIER PROBE candidates (BFS 1-5 jumps ahead)
        # Only exclude mastered skills from BFS exploration.
        # Active skills (initial mastery, leapfrog-inferred) are still probe-eligible
        # so the BFS can reach beyond them for gifted/accelerating students.
        mastered_ids = {sid for sid, rs in retention_map.items() if rs == "mastered"}

        # BFS seed: all non-mastered known skills.
        # After leapfrogs, not_started "frontier_skills" empties because inferred
        # skills land as active. We need active skills to seed the BFS
        # so the engine keeps exploring deeper into the DAG.
        bfs_seed = set()
        for sid in unlocked:
            if sid not in node_ids:
                continue
            rs = retention_map.get(sid, "not_started")
            if rs != "mastered":
                bfs_seed.add(sid)

        probe_candidate_ids = self._gather_probe_candidates(
            bfs_seed, mastered_ids, all_edges, node_map,
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

        # --- Post-filter backfill ---
        # Trivial filtering in _select_current_items may return fewer items
        # than allocated. Redistribute empty slots to frontier probes so
        # gifted students get pushed forward instead of short sessions.
        filled = len(review_items) + len(current_items) + len(probe_items)
        backfill_needed = item_count - filled
        if backfill_needed > 0 and len(probe_candidate_ids) > frontier_count:
            extra_probe_ids = probe_candidate_ids[frontier_count:frontier_count + backfill_needed]
            extra_probes = self._select_frontier_probes_from_candidates(
                extra_probe_ids, node_map, subject,
            )
            probe_items.extend(extra_probes)
            if extra_probes:
                logger.info(
                    f"[PULSE] Backfill: added {len(extra_probes)} extra frontier "
                    f"probes to fill {backfill_needed} empty slots"
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
        now: datetime,
    ) -> List[Tuple[str, Dict, float, float, float]]:
        """
        Gather and rank review candidates by information value (PRD §16.6A).

        Returns (subskill_id, lifecycle, eff_theta, information, days_elapsed).
        Items are review candidates when their effective P(correct) drops
        below TARGET_RETENTION (0.85).
        """
        candidates = []
        for sid, lc in lifecycle_map.items():
            rs, _ = derive_retention_state(lc)
            if rs != "active":
                continue

            stability = lc.get("stability", INITIAL_STABILITY)
            last_reviewed = lc.get("last_reviewed")
            if not last_reviewed:
                continue

            try:
                last_dt = datetime.fromisoformat(last_reviewed.replace("Z", "+00:00"))
                if now.tzinfo is None:
                    now = now.replace(tzinfo=timezone.utc)
                days_elapsed = max(0.0, (now - last_dt).total_seconds() / 86400)
            except (ValueError, TypeError):
                continue

            # Compute effective theta with decay
            skill_id = lc.get("skill_id", "")
            theta_tested = theta_map.get(skill_id, DEFAULT_STUDENT_THETA)
            eff_theta = effective_theta(theta_tested, days_elapsed, stability)

            # Compute P(correct) and information from effective theta
            node = node_map.get(sid, {})
            prim_type = node.get("primitive_type", "ten-frame")
            _, beta, eval_mode_name = self.select_best_mode(eff_theta, prim_type)
            a, c = get_item_discrimination(prim_type, eval_mode_name)
            p = p_correct(eff_theta, a, beta, c)
            info = item_information(eff_theta, a, beta, c)

            if p < TARGET_RETENTION:  # 0.85 — item has decayed enough to review
                candidates.append((sid, lc, eff_theta, info, days_elapsed))

        # Sort by information value descending — most informative reviews first
        candidates.sort(key=lambda x: -x[3])
        return candidates

    def _select_review_items_from_candidates(
        self,
        candidates: List[Tuple[str, Dict, float, float, float]],
        node_map: Dict[str, Dict],
        subject: str,
        theta_map: Dict[str, float],
    ) -> List[PulseItemSpec]:
        """Build PulseItemSpec list from ranked review candidates."""
        items: List[PulseItemSpec] = []
        for sid, lc, eff_theta, info, days_elapsed in candidates:
            node = node_map.get(sid, {})
            skill_id = node.get("skill_id", lc.get("skill_id", ""))
            theta = theta_map.get(skill_id, DEFAULT_STUDENT_THETA)
            prim_type = node.get("primitive_type", "ten-frame")
            mode, beta, eval_mode = self.select_best_mode(theta, prim_type)
            items.append(PulseItemSpec(
                item_id=f"pulse-item-{len(items):03d}",
                band=PulseBand.REVIEW,
                subskill_id=sid,
                skill_id=skill_id,
                subject=subject,
                description=node.get("description", "") or node.get("label", ""),
                target_mode=mode,
                target_beta=beta,
                eval_mode_name=eval_mode if eval_mode != "default" else None,
                primitive_affinity=prim_type,
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
        # Apply trivial-item filter (PRD §16.6B): skip items where P > 0.95
        grouper_candidates = []
        trivial_skipped = 0
        for sid in candidates:
            node = node_map.get(sid, {})
            skill_id = node.get("skill_id", "")
            gate = gate_map.get(sid, 0)

            # Trivial-item filter: skip busywork items with P > TRIVIAL_THRESHOLD
            theta = theta_map.get(skill_id, DEFAULT_STUDENT_THETA)
            prim_type = node.get("primitive_type", "ten-frame")
            _, beta, eval_mode_name = self.select_best_mode(theta, prim_type)
            a, c = get_item_discrimination(prim_type, eval_mode_name)
            p = p_correct(theta, a, beta, c)
            if p > TRIVIAL_THRESHOLD:
                trivial_skipped += 1
                continue  # Skip — no pedagogical value

            grouper_candidates.append({
                "skill_id": sid,
                "subject": subject,
                "type": "new" if gate == 0 else "review",
                "mastery_gate": gate,
                "unit_title": node.get("unit_title", node.get("parent_label", "")),
                "skill_description": node.get("skill_description", node.get("parent_label", "")),
                "subskill_description": node.get("description", "") or node.get("label", ""),
            })

        if trivial_skipped > 0:
            logger.info(
                f"[PULSE] Trivial-item filter: skipped {trivial_skipped} items "
                f"with P > {TRIVIAL_THRESHOLD}"
            )

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
        skill_counts: Dict[str, int] = defaultdict(int)

        if blocks:
            # First pass: add items respecting per-skill cap
            deferred: List[tuple] = []  # (block, ss) pairs skipped due to cap
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
                    if skill_counts[skill_id] >= MAX_CURRENT_ITEMS_PER_SKILL:
                        deferred.append((block_id, ss))
                        continue
                    theta = theta_map.get(skill_id, DEFAULT_STUDENT_THETA)
                    prim_type = node.get("primitive_type", "ten-frame")
                    mode, beta, eval_mode = self.select_best_mode(theta, prim_type)
                    skill_counts[skill_id] += 1
                    items.append(PulseItemSpec(
                        item_id=f"pulse-item-{item_offset + len(items):03d}",
                        band=PulseBand.CURRENT,
                        subskill_id=ss_id,
                        skill_id=skill_id,
                        subject=subject,
                        description=node.get("description", "") or node.get("label", ""),
                        target_mode=mode,
                        target_beta=beta,
                        eval_mode_name=eval_mode if eval_mode != "default" else None,
                        primitive_affinity=prim_type,
                        lesson_group_id=block_id,
                    ))
            # Second pass: fill remaining slots from deferred items if needed
            for block_id, ss in deferred:
                if len(items) >= count:
                    break
                ss_id = ss.get("subskill_id", "") if isinstance(ss, dict) else getattr(ss, 'subskill_id', '')
                node = node_map.get(ss_id, {})
                skill_id = node.get("skill_id", "")
                theta = theta_map.get(skill_id, DEFAULT_STUDENT_THETA)
                prim_type = node.get("primitive_type", "ten-frame")
                mode, beta, eval_mode = self.select_best_mode(theta, prim_type)
                skill_counts[skill_id] += 1
                items.append(PulseItemSpec(
                    item_id=f"pulse-item-{item_offset + len(items):03d}",
                    band=PulseBand.CURRENT,
                    subskill_id=ss_id,
                    skill_id=skill_id,
                    subject=subject,
                    description=node.get("description", "") or node.get("label", ""),
                    target_mode=mode,
                    target_beta=beta,
                    eval_mode_name=eval_mode if eval_mode != "default" else None,
                    primitive_affinity=prim_type,
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
                    if skill_counts[skill_id] >= MAX_CURRENT_ITEMS_PER_SKILL:
                        continue
                    node = node_map.get(sid, {})
                    theta = theta_map.get(skill_id, DEFAULT_STUDENT_THETA)
                    prim_type = node.get("primitive_type", "ten-frame")
                    mode, beta, eval_mode = self.select_best_mode(theta, prim_type)
                    skill_counts[skill_id] += 1
                    items.append(PulseItemSpec(
                        item_id=f"pulse-item-{item_offset + len(items):03d}",
                        band=PulseBand.CURRENT,
                        subskill_id=sid,
                        skill_id=skill_id,
                        subject=subject,
                        description=node.get("description", "") or node.get("label", ""),
                        target_mode=mode,
                        target_beta=beta,
                        eval_mode_name=eval_mode if eval_mode != "default" else None,
                        primitive_affinity=prim_type,
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
        """
        BFS from frontier 1-5 edges forward on the **full knowledge graph**
        (all edge types, not just prerequisites).

        Returns (node_id, depth) sorted by:
          1. Proximity to midpoint of reachable depth range (binary-search convergence)
          2. Edge strength (prefer higher-strength connections as tiebreaker)

        Knowledge-graph awareness:
          - BFS traverses ALL edge types for broad discovery.
          - ``builds_on`` / ``applies`` edges are preferred for frontier probes
            (forward progression).
          - ``parallel`` / ``reinforces`` edges add breadth and variety.
          - Edge ``strength`` is used as a secondary sort signal: stronger
            connections are explored first within the same depth.
        """
        # Build forward adjacency with strength metadata
        # forward[source] = [(target, strength), ...]
        forward: Dict[str, List[Tuple[str, float]]] = defaultdict(list)
        for edge in all_edges:
            strength = edge.get("strength", 1.0)
            forward[edge["source"]].append((edge["target"], strength))

        # Sort each adjacency list by strength descending so BFS naturally
        # prefers higher-strength connections first
        for targets in forward.values():
            targets.sort(key=lambda t: -t[1])

        visited: Set[str] = set()
        probe_candidates: List[Tuple[str, int]] = []
        # Track max strength of the path that discovered each candidate
        candidate_strength: Dict[str, float] = {}
        queue: deque = deque()

        for fid in frontier_skills:
            for child, strength in forward.get(fid, []):
                if child not in mastered_ids and child not in frontier_skills:
                    queue.append((child, 1, strength))

        while queue:
            nid, depth, path_strength = queue.popleft()
            if nid in visited or depth > FRONTIER_MAX_JUMP:
                continue
            visited.add(nid)
            if nid not in mastered_ids and nid not in frontier_skills:
                probe_candidates.append((nid, depth))
                candidate_strength[nid] = path_strength
            if depth < FRONTIER_MAX_JUMP:
                for child, strength in forward.get(nid, []):
                    if child not in visited:
                        queue.append((child, depth + 1, strength))

        # Midpoint probing with strength-weighted tiebreaking:
        # Primary sort: distance from midpoint (binary-search convergence)
        # Secondary sort: prefer higher-strength connections
        if probe_candidates:
            max_depth = max(d for _, d in probe_candidates)
            midpoint = max(1, (max_depth + 1) // 2)
            probe_candidates.sort(
                key=lambda x: (
                    abs(x[1] - midpoint),
                    x[1],
                    -candidate_strength.get(x[0], 1.0),
                )
            )
            logger.info(
                f"[PULSE] Probe candidates: depths 1-{max_depth}, "
                f"midpoint={midpoint}, top pick depth={probe_candidates[0][1]}"
            )

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
    # Frontier context computation
    # ------------------------------------------------------------------

    def _compute_frontier_context(
        self,
        items: List[PulseItemSpec],
        all_nodes: List[Dict],
        all_edges: List[Dict],
        node_map: Dict[str, Dict],
        gate_map: Dict[str, int],
        lifecycle_map: Dict[str, Dict],
        is_cold_start: bool,
        now: datetime,
    ) -> SessionFrontierContext:
        """
        Enrich each item with graph-position context and build session summary.

        All data comes from already-loaded state — no new DB calls.
        """
        if not items:
            return SessionFrontierContext()

        # --- Pre-compute unit-level stats ---
        # Group ALL subskill nodes by skill_id (= unit)
        unit_nodes: Dict[str, List[Dict]] = defaultdict(list)
        for node in all_nodes:
            skill_id = node.get("skill_id", "")
            if skill_id:
                unit_nodes[skill_id].append(node)

        unit_stats: Dict[str, Dict] = {}
        for skill_id, nodes in unit_nodes.items():
            total = len(nodes)
            mastered = sum(
                1 for n in nodes if gate_map.get(n["id"], 0) >= 1
            )
            # Use best available label
            label = (
                nodes[0].get("skill_description", "")
                or nodes[0].get("parent_label", "")
                or nodes[0].get("unit_title", "")
                or skill_id
            )
            unit_stats[skill_id] = {
                "total": total,
                "mastered": mastered,
                "label": label,
                "remaining": total - mastered,
            }

        # --- Pre-compute forward edges for downstream lookups ---
        forward: Dict[str, List[str]] = defaultdict(list)
        for edge in all_edges:
            forward[edge["source"]].append(edge["target"])

        # --- Pre-compute topological depth ---
        topo_order = DAGAnalysisEngine.topological_sort(all_nodes, all_edges)
        metrics = DAGAnalysisEngine.compute_node_metrics(
            all_nodes, all_edges, topo_order
        )
        max_depth = max((m.depth for m in metrics.values()), default=0)

        # Frontier depth = avg depth of frontier-band items
        frontier_depths = []

        # --- Per-item context ---
        mastered_ids = {sid for sid, gate in gate_map.items() if gate >= 1}

        for item in items:
            skill_id = item.skill_id
            us = unit_stats.get(skill_id, {})
            unit_name = us.get("label", skill_id)
            unit_mastered = us.get("mastered", 0)
            unit_total = us.get("total", 0)

            ctx = ItemFrontierContext(
                unit_name=unit_name,
                unit_mastered=unit_mastered,
                unit_total=unit_total,
            )

            if item.band == PulseBand.FRONTIER:
                # Compute dag_distance from probe candidates (BFS depth)
                # Re-derive depth via node metrics
                node_metric = metrics.get(item.subskill_id)
                ctx.dag_distance = node_metric.depth if node_metric else 0
                frontier_depths.append(ctx.dag_distance)

                # Find ancestors that would be inferred on leapfrog
                if not is_cold_start:
                    ancestors = DAGAnalysisEngine.get_ancestors(
                        item.subskill_id, all_edges
                    )
                    # Filter to non-mastered ancestors (would be inferred)
                    inferable = [
                        a for a in ancestors
                        if gate_map.get(a, 0) < 2 and a in node_map
                    ]
                    ctx.ancestors_if_passed = len(inferable)
                    # Human-readable names (max 5)
                    ctx.ancestor_skill_names = [
                        node_map[a].get("description", "")
                        or node_map[a].get("label", a)
                        for a in inferable[:5]
                    ]

            elif item.band == PulseBand.CURRENT:
                # Find next downstream skill name
                children = forward.get(item.subskill_id, [])
                for child_id in children:
                    child_node = node_map.get(child_id, {})
                    child_skill = child_node.get("skill_id", "")
                    if child_skill and child_skill != skill_id:
                        child_us = unit_stats.get(child_skill, {})
                        ctx.next_skill_name = child_us.get("label", child_skill)
                        break
                    elif child_node:
                        ctx.next_skill_name = (
                            child_node.get("description", "")
                            or child_node.get("label", "")
                        )
                        break

            elif item.band == PulseBand.REVIEW:
                # Compute time-ago for last tested
                lc = lifecycle_map.get(item.subskill_id, {})
                last_tested = lc.get("last_tested_at") or lc.get("updated_at")
                if last_tested:
                    ctx.last_tested_ago = self._format_time_ago(last_tested, now)

            item.frontier_context = ctx

        # --- Session-level context ---
        total_mastered = sum(1 for gate in gate_map.values() if gate >= 1)
        total_nodes = len(all_nodes)

        # Build units_in_progress (units with at least one mastered but not all)
        units_in_progress = []
        for skill_id, stats in unit_stats.items():
            if 0 < stats["mastered"] < stats["total"]:
                units_in_progress.append(UnitProgress(
                    unit_name=stats["label"],
                    skill_id=skill_id,
                    mastered=stats["mastered"],
                    total=stats["total"],
                    branches_remaining=stats["remaining"],
                ))
        # Sort by completion ratio ascending (most work remaining first)
        units_in_progress.sort(
            key=lambda u: u.mastered / u.total if u.total > 0 else 0
        )

        frontier_depth = (
            round(sum(frontier_depths) / len(frontier_depths))
            if frontier_depths else 0
        )

        return SessionFrontierContext(
            frontier_depth=frontier_depth,
            max_depth=max_depth,
            total_mastered=total_mastered,
            total_nodes=total_nodes,
            units_in_progress=units_in_progress[:10],  # cap at 10
        )

    @staticmethod
    def _format_time_ago(iso_string: str, now: datetime) -> str:
        """Convert an ISO timestamp to a human-readable 'X ago' string."""
        try:
            dt = datetime.fromisoformat(iso_string.replace("Z", "+00:00"))
            delta = now - dt
            days = delta.days
            if days == 0:
                hours = delta.seconds // 3600
                if hours == 0:
                    return "just now"
                return f"{hours}h ago"
            if days == 1:
                return "yesterday"
            if days < 7:
                return f"{days} days ago"
            weeks = days // 7
            if weeks == 1:
                return "1 week ago"
            return f"{weeks} weeks ago"
        except (ValueError, TypeError):
            return ""

    # ------------------------------------------------------------------
    # Result processing
    # ------------------------------------------------------------------

    async def process_result(
        self,
        student_id: int,
        session_id: str,
        result: PulseResultRequest,
        now_override: Optional[datetime] = None,
    ) -> PulseResultResponse:
        """Process a single item result. Update θ, β, gates, check leapfrog."""
        now = now_override or datetime.now(timezone.utc)

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

        # 2. Pre-fetch ability + lifecycle in one pass (saves 2 duplicate reads)
        old_ability = await self.firestore.get_student_ability(student_id, skill_id)
        old_lifecycle = await self.firestore.get_mastery_lifecycle(
            student_id, subskill_id
        )

        old_theta = old_ability.get("theta", DEFAULT_STUDENT_THETA) if old_ability else DEFAULT_STUDENT_THETA
        old_gate = old_lifecycle.get("current_gate", 0) if old_lifecycle else 0

        # 3. Update IRT (θ and β) — pass pre-fetched ability to avoid re-read
        cal_result = await self.calibration.process_submission(
            student_id=student_id,
            skill_id=skill_id,
            subskill_id=subskill_id,
            primitive_type=result.primitive_type,
            eval_mode=result.eval_mode,
            score=result.score,
            source="practice",
            prefetched_ability=old_ability,
        )

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

        # 4. Update mastery gate — pass pre-fetched lifecycle to avoid re-read
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
            theta=new_theta,
            sigma=cal_result.get("sigma"),
            primitive_type=result.primitive_type,
            avg_a=cal_result.get("discrimination_a"),
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
        if irt_data:
            items[item_index]["irt"] = irt_data.model_dump()
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
            gate_progress=cal_result.get("gate_progress"),
            irt=irt_data,
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

        # Collect all candidate IDs (probed + ancestors), then batch-read
        all_ancestor_ids: Set[str] = set()
        for probed_id in probed_skills:
            all_ancestor_ids.update(DAGAnalysisEngine.get_ancestors(probed_id, all_edges))

        # Combine probed skills + ancestors for a single batch read
        candidate_ids = list(set(probed_skills) | all_ancestor_ids)
        lifecycle_batch = await self.firestore.get_mastery_lifecycles_batch(
            student_id, candidate_ids
        )

        # Filter to skills not yet active (PRD §16.8)
        inferred_skills: List[str] = []
        for sid in candidate_ids:
            existing = lifecycle_batch.get(sid)
            if existing:
                rs, _ = derive_retention_state(existing)
                if rs != "not_started":
                    continue  # Already active or mastered
            inferred_skills.append(sid)

        # Deduplicate (already unique from set, but defensive)
        inferred_skills = list(set(inferred_skills))

        if not inferred_skills:
            return LeapfrogEvent(
                lesson_group_id=lesson_group_id,
                probed_skills=probed_skills,
                inferred_skills=[],
                aggregate_score=avg_score,
            )

        # Seed mastery_lifecycle for inferred skills (PRD §16.8)
        # Inferred skills start as active with initial stability
        lifecycles_to_seed: List[Dict] = []
        for sid in inferred_skills:
            node = node_map.get(sid, {})
            lc_data = MasteryLifecycle(
                student_id=student_id,
                subskill_id=sid,
                subject=subject,
                skill_id=node.get("skill_id", ""),
                # Retention model fields
                retention_state="active",
                stability=LEAPFROG_INFERRED_STABILITY,
                last_reviewed=now.isoformat(),
                review_count=0,
                # Backward-compat gate fields
                current_gate=LEAPFROG_INFERRED_GATE,
                completion_pct=LEAPFROG_INFERRED_COMPLETION,
                lesson_eval_count=3,
                next_retest_eligible=(now + timedelta(days=LEAPFROG_INFERRED_STABILITY)).isoformat(),
                retest_interval_days=round(LEAPFROG_INFERRED_STABILITY),
                gate_mode="probability",
                theta_at_gate_entry=LEAPFROG_INFERRED_THETA,
                gate_theta_threshold=3.0,
                gate_history=[
                    GateHistoryEntry(
                        gate=LEAPFROG_INFERRED_GATE,
                        timestamp=now.isoformat(),
                        score=avg_score,
                        passed=True,
                        source="diagnostic",
                        theta=LEAPFROG_INFERRED_THETA,
                    )
                ],
            ).model_dump()
            lifecycles_to_seed.append(lc_data)

        if lifecycles_to_seed:
            await self.firestore.batch_write_mastery_lifecycles(
                student_id, lifecycles_to_seed
            )

        # Seed ability for inferred skills (batch write)
        abilities_to_seed: List[Dict] = []
        for sid in inferred_skills:
            node = node_map.get(sid, {})
            ability_skill_id = node.get("skill_id", sid)
            abilities_to_seed.append(StudentAbility(
                student_id=student_id,
                skill_id=ability_skill_id,
                theta=LEAPFROG_INFERRED_THETA,
                sigma=LEAPFROG_INFERRED_SIGMA,
                earned_level=LEAPFROG_INFERRED_THETA,
                prior_source="pulse_leapfrog",
            ).model_dump())

        if abilities_to_seed:
            await self.firestore.batch_write_student_abilities(
                student_id, abilities_to_seed
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
        try:
            graph_data = await self.learning_paths._get_graph(subject)
            if graph_data and "graph" in graph_data:
                all_nodes = graph_data["graph"].get("nodes", [])
                node_map = {n["id"]: n for n in all_nodes
                            if n.get("type", n.get("entity_type", "")) == "subskill"}
        except Exception as e:
            logger.warning(f"[PULSE] Could not load DAG for summary enrichment: {e}")

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
                actual_correct=sum(
                    1 for it in scored_items if it.get("score", 0) >= 9.0
                ),
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

    @staticmethod
    def _get_eval_source(band: str, gate: int) -> str:
        """Map Pulse band + current gate to mastery lifecycle source.

        At gate 0, all bands route to "lesson" so the probability gate
        check runs regardless of whether the item was a frontier probe,
        review, or current-band item.  After initial activation (gate >= 1),
        everything is "practice" for stability updates.
        """
        if gate == 0:
            return "lesson"
        return "practice"
