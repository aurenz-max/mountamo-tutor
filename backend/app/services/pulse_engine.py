"""
Lumina Pulse Engine — Adaptive Learning Loop

Unified session assembly + result processing orchestrator.
Composes existing services (CalibrationEngine, MasteryLifecycleEngine,
LearningPathsService) into one adaptive loop.

See: Lumina_PRD_Pulse.md §5-6
"""

from __future__ import annotations

import asyncio
import logging
import math
import uuid
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from ..db.firestore_service import FirestoreService
from ..models.calibration import DEFAULT_STUDENT_THETA, DEFAULT_THETA_SIGMA
from ..models.mastery_lifecycle import (
    INITIAL_STABILITY,
    SIGMA_DIFFUSION_RATE,
)
from ..models.pulse import (
    DEFAULT_PULSE_ITEM_COUNT,
    FRONTIER_MAX_JUMP,
    FRONTIER_PASS_THRESHOLD,
    FRONTIER_PROBE_MODE,
    MAX_CURRENT_ITEMS_PER_SKILL,
    PRIMITIVE_HISTORY_WINDOW,
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
from ..services.calibration_engine import CalibrationEngine, item_information
from ..services.calibration.problem_type_registry import (
    PROBLEM_TYPE_REGISTRY,
    get_item_discrimination,
    get_item_key,
)
from ..services.dag_analysis import DAGAnalysisEngine
from ..services.learning_paths import LearningPathsService

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
        sigma_map: Dict[str, float] = {}  # skill_id → σ (uncertainty)
        for ab in abilities:
            sid = ab.get("skill_id", "")
            theta_map[sid] = ab.get("theta", DEFAULT_STUDENT_THETA)
            sigma_map[sid] = ab.get("sigma", DEFAULT_THETA_SIGMA)

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
            items = await self._assemble_unified(
                student_id, subject, item_count, all_nodes, all_edges,
                node_map, node_ids, gate_map, retention_map, lifecycle_map,
                theta_map, sigma_map, now,
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

        # Topological sort requires a DAG — only prerequisite edges form a DAG.
        # Non-prerequisite edges (parallel, reinforces, builds_on, applies) can
        # have cycles by design and must be excluded from topo sort.
        prereq_edges = [
            e for e in all_edges
            if e.get("is_prerequisite", False)
            or e.get("relationship", "prerequisite") == "prerequisite"
        ]

        # Use DAGAnalysisEngine to compute metrics and select midpoints
        topo_order = DAGAnalysisEngine.topological_sort(all_nodes, prereq_edges)
        metrics = DAGAnalysisEngine.compute_node_metrics(
            all_nodes, prereq_edges, topo_order
        )

        # Select midpoints of independent chains
        probes = DAGAnalysisEngine.select_initial_probes(
            metrics, all_nodes, prereq_edges, max_probes=item_count,
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

    async def _assemble_unified(
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
        sigma_map: Dict[str, float],
        now: datetime,
    ) -> List[PulseItemSpec]:
        """IRT item selection via expected posterior variance reduction.

        Every candidate is scored by:

            utility = I(eff_θ; a, β, c) × σ²

        Fisher information I measures item informativeness. Multiplying
        by σ² (posterior variance) gives the expected reduction in
        uncertainty — the standard CAT criterion. This naturally favors
        unseen skills (high σ) over well-known ones (low σ) without
        heuristic multipliers.

        eff_θ incorporates forgetting (effective_theta decay model).

        Band labels (frontier/current/review) are derived from state for
        frontend display, not used for selection.
        """

        # 1. Gather ALL candidate skills from three sources
        unlocked = await self.learning_paths.get_unlocked_entities(
            student_id, entity_type="subskill", subject=subject,
        )
        unlocked_in_graph = {sid for sid in unlocked if sid in node_ids}
        mastered_ids = {sid for sid, rs in retention_map.items() if rs == "mastered"}

        # BFS forward to discover frontier probes (skills beyond current reach)
        bfs_seed = unlocked_in_graph - mastered_ids
        probe_ids = self._bfs_forward(
            bfs_seed, mastered_ids, all_edges, node_map,
        )

        # Promote tested frontier items to the unlocked pool.
        # Skills discovered via leapfrog may bypass prerequisite checks in
        # get_unlocked_entities(), leaving them "locked" despite having
        # lifecycle docs from prior testing.  Without this, they re-enter
        # as frontier probes every session — triggering vacuous leapfrogs
        # (0 new skills unlocked) and starving current/review items.
        promoted = set()
        for nid, _depth in probe_ids:
            if nid in lifecycle_map:
                promoted.add(nid)
                unlocked_in_graph.add(nid)
        if promoted:
            probe_ids = [(nid, d) for nid, d in probe_ids if nid not in promoted]
            logger.info(
                f"[PULSE] Promoted {len(promoted)} tested frontier items to "
                f"current pool: {sorted(promoted)[:5]}..."
            )

        # 2. Compute transfer prior: use the student's average θ across
        # known skills instead of the global default.  This lets gifted
        # students' frontier probes start near their true ability, so
        # Fisher information doesn't artificially inflate frontier utility.
        # Falls back to DEFAULT_STUDENT_THETA on cold-start / first session.
        known_thetas = list(theta_map.values())
        transfer_prior = (
            sum(known_thetas) / len(known_thetas)
            if known_thetas
            else DEFAULT_STUDENT_THETA
        )

        # Score every candidate with a single utility function
        scored: List[Tuple[float, str, str, Dict, int]] = []  # (utility, sid, band, node, depth)

        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)

        for sid in unlocked_in_graph:
            if sid in mastered_ids:
                continue
            node = node_map.get(sid, {})
            # Skip skill-level grouping nodes — only subskills are testable
            if node.get("type") == "skill":
                continue
            skill_id = node.get("skill_id", "") or sid
            rs = retention_map.get(sid, "not_started")
            lc = lifecycle_map.get(sid)

            # θ and σ for this skill
            # Truly unseen (no lifecycle doc): transfer prior + max uncertainty.
            # Gate-0 WITH lifecycle doc: student has been tested — use real
            # calibrated θ/σ so utility reflects actual measurement need.
            # Without this, gate-0 items get σ=2.0 (44× inflated utility)
            # and permanently block frontier probes via depth tie-break.
            if rs == "not_started" and not lc:
                theta = transfer_prior
                sigma = DEFAULT_THETA_SIGMA
            else:
                theta = theta_map.get(skill_id, transfer_prior)
                sigma = sigma_map.get(skill_id, DEFAULT_THETA_SIGMA)
            prim_type = node.get("primitive_type", "ten-frame")
            _, beta, eval_mode_name = self.select_best_mode(theta, prim_type)
            a, c = get_item_discrimination(prim_type, eval_mode_name)

            # Decay-adjusted theta for tested skills (forgetting model)
            eff_theta = theta
            days_since = 0.0
            stability = INITIAL_STABILITY
            has_history = lc is not None  # gate-0 or active — both have history
            if has_history:
                last_reviewed = lc.get("last_reviewed")
                stability = lc.get("stability", INITIAL_STABILITY)
                if last_reviewed:
                    try:
                        last_dt = datetime.fromisoformat(
                            last_reviewed.replace("Z", "+00:00")
                        )
                        days_since = max(0.0, (now - last_dt).total_seconds() / 86400)
                        eff_theta = effective_theta(theta, days_since, stability)
                    except (ValueError, TypeError):
                        pass

            # Posterior diffusion: σ grows without new observations.
            # Matches effective_theta decay — both θ erosion and σ growth
            # model the Bayesian reality that stale estimates are less certain.
            eff_sigma = sigma
            if has_history and days_since > 0:
                eff_sigma = math.sqrt(sigma ** 2 + SIGMA_DIFFUSION_RATE ** 2 * days_since)
                eff_sigma = min(eff_sigma, DEFAULT_THETA_SIGMA)

            # Expected posterior variance reduction: I(θ) × σ²
            # Standard CAT criterion — naturally favors high-uncertainty
            # skills (unseen/new) over well-known ones.
            info = item_information(eff_theta, a, beta, c)
            utility = info * (eff_sigma ** 2)

            # Derive band label from state
            if not has_history:
                band = PulseBand.CURRENT  # truly unseen
            elif days_since > stability * 0.5:
                band = PulseBand.REVIEW
            else:
                band = PulseBand.CURRENT

            scored.append((utility, sid, band.value, node, 0))

        # Score frontier probe candidates (not yet unlocked/observed)
        for nid, depth in probe_ids:
            if nid in mastered_ids or nid in unlocked_in_graph:
                continue
            node = node_map.get(nid)
            # Skip nodes not in the subskill graph (skill-level parents, orphans)
            if not node or node.get("type") == "skill":
                continue
            # Skip already-probed frontier items — they have lifecycle docs
            # but couldn't unlock (prerequisite constraints). Re-probing
            # provides no new information and starves consolidation.
            if nid in lifecycle_map:
                continue
            skill_id = node.get("skill_id", "") or nid
            prim_type = node.get("primitive_type", "ten-frame")

            # If this skill has been probed before, use real θ/σ from
            # the ability doc instead of defaults. Prevents frontier items
            # from permanently dominating with σ=2.0 after being tested.
            theta = theta_map.get(skill_id, transfer_prior)
            sigma = sigma_map.get(skill_id, DEFAULT_THETA_SIGMA)

            _, beta, eval_mode_name = self.select_best_mode(theta, prim_type)
            a, c = get_item_discrimination(prim_type, eval_mode_name)

            info = item_information(theta, a, beta, c)
            utility = info * (sigma ** 2)
            scored.append((utility, nid, PulseBand.FRONTIER.value, node, depth))

        # 3. Sort by utility descending, depth ascending as tie-breaker
        #    (closer frontier skills win ties over distant ones)
        scored.sort(key=lambda x: (-x[0], x[4]))

        items: List[PulseItemSpec] = []
        skill_counts: Dict[str, int] = defaultdict(int)

        for utility, sid, band_label, node, _depth in scored:
            if len(items) >= item_count:
                break
            skill_id = node.get("skill_id", "") or sid
            if skill_counts[skill_id] >= MAX_CURRENT_ITEMS_PER_SKILL:
                continue
            skill_counts[skill_id] += 1

            theta = theta_map.get(skill_id, DEFAULT_STUDENT_THETA)
            prim_type = node.get("primitive_type", "ten-frame")

            if band_label == PulseBand.FRONTIER.value:
                mode = FRONTIER_PROBE_MODE
                beta = mode_to_beta(FRONTIER_PROBE_MODE)
                eval_mode = None
            else:
                mode, beta, eval_mode_name = self.select_best_mode(theta, prim_type)
                eval_mode = eval_mode_name if eval_mode_name != "default" else None

            items.append(PulseItemSpec(
                item_id=f"pulse-item-{len(items):03d}",
                band=PulseBand(band_label),
                subskill_id=sid,
                skill_id=skill_id,
                subject=subject,
                description=node.get("description", "") or node.get("label", ""),
                target_mode=mode,
                target_beta=beta,
                eval_mode_name=eval_mode,
                primitive_affinity=prim_type,
                lesson_group_id=f"{band_label}-{skill_id}",
            ))

        if not items:
            logger.warning("[PULSE] No items available from unified selector")
            return []

        # Log band distribution (emergent, not enforced)
        band_counts = defaultdict(int)
        for item in items:
            band_counts[item.band.value] += 1
        logger.info(
            f"[PULSE] Unified selection: {len(items)} items, "
            f"bands={dict(band_counts)} (emergent from utility ranking)"
        )

        return items

    # ------------------------------------------------------------------
    # Graph exploration
    # ------------------------------------------------------------------

    def _bfs_forward(
        self,
        seed_ids: Set[str],
        mastered_ids: Set[str],
        all_edges: List[Dict],
        node_map: Dict[str, Dict],
    ) -> List[Tuple[str, int]]:
        """BFS forward from seed skills to discover frontier probe candidates.

        Traverses all edge types (not just prerequisites) for broad discovery.
        Returns (node_id, depth) sorted by proximity to depth midpoint.
        """
        forward: Dict[str, List[Tuple[str, float]]] = defaultdict(list)
        for edge in all_edges:
            strength = edge.get("strength", 1.0)
            forward[edge["source"]].append((edge["target"], strength))

        for targets in forward.values():
            targets.sort(key=lambda t: -t[1])

        visited: Set[str] = set()
        candidates: List[Tuple[str, int]] = []
        candidate_strength: Dict[str, float] = {}
        queue: deque = deque()

        # Seed from both non-mastered and mastered to bridge disconnected regions
        for fid in seed_ids | mastered_ids:
            for child, strength in forward.get(fid, []):
                if child not in mastered_ids and child not in seed_ids:
                    queue.append((child, 1, strength))

        while queue:
            nid, depth, path_strength = queue.popleft()
            if nid in visited or depth > FRONTIER_MAX_JUMP:
                continue
            visited.add(nid)
            if nid not in mastered_ids and nid not in seed_ids and nid in node_map:
                candidates.append((nid, depth))
                candidate_strength[nid] = path_strength
            if depth < FRONTIER_MAX_JUMP:
                for child, strength in forward.get(nid, []):
                    if child not in visited:
                        queue.append((child, depth + 1, strength))

        if candidates:
            max_depth = max(d for _, d in candidates)
            midpoint = max(1, (max_depth + 1) // 2)
            candidates.sort(
                key=lambda x: (
                    abs(x[1] - midpoint),
                    x[1],
                    -candidate_strength.get(x[0], 1.0),
                )
            )

        return candidates

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
        # Only prerequisite edges form a DAG; non-prerequisite edges can cycle.
        prereq_edges = [
            e for e in all_edges
            if e.get("is_prerequisite", False)
            or e.get("relationship", "prerequisite") == "prerequisite"
        ]
        topo_order = DAGAnalysisEngine.topological_sort(all_nodes, prereq_edges)
        metrics = DAGAnalysisEngine.compute_node_metrics(
            all_nodes, prereq_edges, topo_order
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
        subject = session["subject"]

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
                probe_theta=new_theta,
                defer_competency=defer_competency,
            )

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
        attempt_count = (
            (old_lifecycle.get("lesson_eval_count", 0) if old_lifecycle else 0) + 1
        )
        competency_entry = {
            "student_id": student_id,
            "subject": subject,
            "skill_id": skill_id,
            "subskill_id": subskill_id,
            "score": result.score,
            "credibility": min(1.0, attempt_count / 10.0),
            "total_attempts": attempt_count,
        }
        if defer_competency:
            session.setdefault("_pending_competency_writes", []).append(
                competency_entry
            )
        else:
            await self.firestore.update_competency(**competency_entry)

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

    async def _check_leapfrog(
        self,
        student_id: int,
        session_id: str,
        session: Dict,
        item_spec: Dict,
        score: float,
        subject: str,
        now: datetime,
        *,
        probe_theta: Optional[float] = None,
        defer_competency: bool = False,
    ) -> Optional[LeapfrogEvent]:
        """Check if a frontier probe triggers leapfrog unlock.

        When a frontier probe passes, we unlock its prerequisite ancestors
        for testing — but we don't fabricate θ, σ, lifecycle, or ability
        docs. Those are created naturally when the student is actually
        tested on each skill.

        The unified selector will see these newly-unlocked skills as
        not_started (no lifecycle, DEFAULT_STUDENT_THETA, max prior σ)
        and naturally prioritize them via high Fisher information.

        Deduplication: skills already inferred earlier in this session
        (tracked in session["_session_inferred_skills"]) are skipped,
        avoiding redundant writes when multiple probes share ancestors.
        """
        lesson_group_id = item_spec.get("lesson_group_id", "")

        # Find all items in this lesson group
        group_items = [
            it for it in session.get("items", [])
            if it.get("lesson_group_id") == lesson_group_id
            and it.get("band") == PulseBand.FRONTIER.value
        ]

        # Check if all items in the group are now scored
        scored_items = []
        for it in group_items:
            if it.get("item_id") == item_spec.get("item_id"):
                scored_items.append(score)
            elif it.get("score") is not None:
                scored_items.append(it["score"])

        if len(scored_items) < len(group_items):
            return None

        avg_score = sum(scored_items) / len(scored_items)
        if avg_score < FRONTIER_PASS_THRESHOLD:
            logger.info(
                f"[PULSE] Frontier group {lesson_group_id} failed: "
                f"avg={avg_score:.1f} < {FRONTIER_PASS_THRESHOLD}"
            )
            return None

        # Leapfrog triggered
        probed_skills = [it.get("subskill_id", "") for it in group_items]
        logger.info(
            f"[PULSE] LEAPFROG! Group {lesson_group_id} passed: "
            f"avg={avg_score:.1f}, probed={probed_skills}"
        )

        # Load graph and find ancestors
        graph_data = await self.learning_paths._get_graph(subject)
        if not graph_data or "graph" not in graph_data:
            return None

        all_edges = graph_data["graph"].get("edges", [])
        all_nodes = graph_data["graph"].get("nodes", [])
        node_map = {n["id"]: n for n in all_nodes}

        all_ancestor_ids: Set[str] = set()
        for probed_id in probed_skills:
            all_ancestor_ids.update(DAGAnalysisEngine.get_ancestors(probed_id, all_edges))

        candidate_ids = list(set(probed_skills) | all_ancestor_ids)

        # Deduplicate: skip skills already inferred earlier in this session.
        # Multiple frontier probes often share the same ancestors — no need
        # to re-check lifecycle or re-write competency for them.
        already_inferred: Set[str] = session.get("_session_inferred_skills", set())
        candidate_ids = [sid for sid in candidate_ids if sid not in already_inferred]

        if not candidate_ids:
            logger.info(
                f"[PULSE] Leapfrog {lesson_group_id}: all {len(all_ancestor_ids)} "
                f"ancestors already inferred this session — skipping"
            )
            return LeapfrogEvent(
                lesson_group_id=lesson_group_id,
                probed_skills=probed_skills,
                inferred_skills=[],
                aggregate_score=avg_score,
            )

        lifecycle_batch = await self.firestore.get_mastery_lifecycles_batch(
            student_id, candidate_ids
        )

        # Filter to skills not yet active
        inferred_skills: List[str] = []
        for sid in candidate_ids:
            existing = lifecycle_batch.get(sid)
            if existing:
                rs, _ = derive_retention_state(existing)
                if rs != "not_started":
                    continue
            inferred_skills.append(sid)

        inferred_skills = list(set(inferred_skills))

        # Track all inferred skills for dedup on subsequent leapfrogs
        if not isinstance(already_inferred, set):
            already_inferred = set(already_inferred)
        already_inferred.update(inferred_skills)
        session["_session_inferred_skills"] = already_inferred

        if not inferred_skills:
            return LeapfrogEvent(
                lesson_group_id=lesson_group_id,
                probed_skills=probed_skills,
                inferred_skills=[],
                aggregate_score=avg_score,
            )

        # Seed ONLY competency docs — just enough for unlock propagation.
        # No lifecycle, no ability, no fabricated θ/σ. The student will
        # be tested on these skills naturally via the unified selector.
        leapfrog_competency_entries = [
            {
                "student_id": student_id,
                "subject": subject,
                "skill_id": node_map.get(sid, {}).get("skill_id", sid),
                "subskill_id": sid,
                "score": avg_score,
                "credibility": 0.1,  # minimal — just enough for unlock propagation
                "total_attempts": 0,
            }
            for sid in inferred_skills
        ]

        if defer_competency:
            # Append to the same deferred batch as regular competency writes
            session.setdefault("_pending_competency_writes", []).extend(
                leapfrog_competency_entries
            )
        else:
            await asyncio.gather(*(
                self.firestore.update_competency(**entry)
                for entry in leapfrog_competency_entries
            ))

        # Mark that unlocks need refreshing — caller (process_result) will
        # flush once per session instead of once per leapfrog.
        session.setdefault("_pending_unlock_refresh", set()).add(subject)

        logger.info(
            f"[PULSE] Leapfrog unlocked {len(inferred_skills)} skills for testing: "
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

        # Flush pending competency writes (parallel batch)
        pending_competency: List[Dict] = session.pop("_pending_competency_writes", [])
        competency_coros = [
            self.firestore.update_competency(**entry)
            for entry in pending_competency
        ]

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
            *competency_coros,
        )
        if pending_competency:
            logger.info(
                f"[PULSE] Flushed {len(pending_competency)} deferred competency writes"
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
        if not pending:
            return
        await asyncio.gather(*(
            self.firestore.update_competency(**entry)
            for entry in pending
        ))
        logger.info(f"[PULSE] Flushed {len(pending)} deferred competency writes")

    @staticmethod
    def _get_eval_source(band: str, gate: int) -> str:
        """All evals route to "practice" — the unified handler manages
        both activation (not_started → active) and gate advancement."""
        return "practice"
