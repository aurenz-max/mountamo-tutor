"""
Graph Analysis Engine — Pure Structural Analysis for Knowledge Graphs

Stateless, IO-free, no LLM calls. Takes nodes + edges, returns health
metrics, anomalies, and impact projections. Used by the agentic layer
(CurriculumGraphAgentService) and the health dashboard API.

Same design philosophy as backend DAGAnalysisEngine: all static methods,
pure functions, no side effects.
"""

from __future__ import annotations

from collections import defaultdict, Counter
from typing import Dict, List, Optional, Set, Tuple

from app.models.suggestions import (
    GraphHealthMetrics, GraphAnomaly, SuggestionImpact,
)


class GraphAnalysisEngine:
    """Pure graph analysis algorithms for curriculum knowledge graphs."""

    # ------------------------------------------------------------------ #
    #  Health Metrics
    # ------------------------------------------------------------------ #

    @staticmethod
    def compute_health_metrics(
        nodes: List[Dict],
        edges: List[Dict],
    ) -> GraphHealthMetrics:
        """Compute structural health metrics for a knowledge graph."""
        node_ids = {n["id"] for n in nodes}
        node_count = len(node_ids)

        if node_count == 0:
            return GraphHealthMetrics()

        edge_count = len(edges)
        edge_density = edge_count / node_count

        # Union-Find for connected components
        parent: Dict[str, str] = {nid: nid for nid in node_ids}

        def find(x: str) -> str:
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        def union(a: str, b: str) -> None:
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[ra] = rb

        for edge in edges:
            s, t = edge["source"], edge["target"]
            if s in node_ids and t in node_ids:
                union(s, t)

        component_count = len({find(nid) for nid in node_ids})

        # Cross-unit ratio
        node_unit: Dict[str, str] = {n["id"]: n.get("unit_id", "") for n in nodes}
        cross_unit = sum(
            1 for e in edges
            if node_unit.get(e["source"], "") and node_unit.get(e["target"], "")
            and node_unit[e["source"]] != node_unit[e["target"]]
        )
        cross_unit_ratio = cross_unit / edge_count if edge_count else 0.0

        # Dead-end and orphan analysis
        has_outgoing: Set[str] = {e["source"] for e in edges}
        has_incoming: Set[str] = {e["target"] for e in edges}
        connected = has_outgoing | has_incoming

        dead_ends = node_ids - has_outgoing
        dead_end_ratio = len(dead_ends) / node_count

        orphans = node_ids - connected
        orphan_count = len(orphans)

        # Avg BFS reach from prerequisite roots
        prereq_edges = [e for e in edges if e.get("is_prerequisite", True)]
        prereq_targets = {e["target"] for e in prereq_edges}
        roots = node_ids - prereq_targets

        if roots:
            total_reach = sum(
                len(GraphAnalysisEngine._bfs_reach({r}, edges, 5))
                for r in roots
            )
            avg_bfs_reach = total_reach / len(roots)
        else:
            avg_bfs_reach = 0.0

        # Bottleneck nodes
        prereq_source_counts: Dict[str, int] = Counter(
            e["source"] for e in prereq_edges
        )
        bottleneck_nodes = [nid for nid, cnt in prereq_source_counts.items() if cnt >= 3]

        return GraphHealthMetrics(
            node_count=node_count,
            edge_count=edge_count,
            edge_density=round(edge_density, 3),
            component_count=component_count,
            cross_unit_ratio=round(cross_unit_ratio, 3),
            avg_bfs_reach=round(avg_bfs_reach, 2),
            dead_end_ratio=round(dead_end_ratio, 3),
            orphan_count=orphan_count,
            bottleneck_nodes=bottleneck_nodes,
        )

    # ------------------------------------------------------------------ #
    #  Health Score
    # ------------------------------------------------------------------ #

    @staticmethod
    def compute_health_score(metrics: GraphHealthMetrics) -> float:
        """Weighted composite health score (0-10).

        Weights:
          - Connectedness (low component ratio): 30%
          - Cross-unit connectivity: 25%
          - BFS reach: 25%
          - Low dead-end ratio: 10%
          - Low orphan ratio: 10%
        """
        if metrics.node_count == 0:
            return 0.0

        # Connectedness: 1 component = perfect, many components = bad
        # Score 0-10 where 1 component → 10, N components → ~0
        ideal_components = 1
        connect_score = max(0, 10 * (1 - (metrics.component_count - ideal_components) / max(metrics.node_count * 0.1, 1)))
        connect_score = min(10, connect_score)

        # Cross-unit: 30%+ is excellent
        cross_score = min(10, metrics.cross_unit_ratio / 0.3 * 10)

        # BFS reach: 20+ avg is excellent
        reach_score = min(10, metrics.avg_bfs_reach / 20 * 10)

        # Dead-end: lower is better (0% = 10, 50%+ = 0)
        dead_score = max(0, 10 * (1 - metrics.dead_end_ratio / 0.5))

        # Orphan: lower is better
        orphan_ratio = metrics.orphan_count / metrics.node_count
        orphan_score = max(0, 10 * (1 - orphan_ratio / 0.2))

        weighted = (
            connect_score * 0.30
            + cross_score * 0.25
            + reach_score * 0.25
            + dead_score * 0.10
            + orphan_score * 0.10
        )
        return round(min(10, max(0, weighted)), 1)

    # ------------------------------------------------------------------ #
    #  Anomaly Detection
    # ------------------------------------------------------------------ #

    @staticmethod
    def detect_anomalies(
        nodes: List[Dict],
        edges: List[Dict],
        metrics: Optional[GraphHealthMetrics] = None,
    ) -> List[GraphAnomaly]:
        """Detect structural anomalies in the knowledge graph."""
        if metrics is None:
            metrics = GraphAnalysisEngine.compute_health_metrics(nodes, edges)

        anomalies: List[GraphAnomaly] = []
        node_ids = {n["id"] for n in nodes}

        # Orphan nodes
        connected = {e["source"] for e in edges} | {e["target"] for e in edges}
        orphans = node_ids - connected
        if orphans:
            severity = "critical" if len(orphans) > metrics.node_count * 0.2 else "warning"
            anomalies.append(GraphAnomaly(
                type="orphan",
                severity=severity,
                entity_ids=sorted(orphans)[:20],
                description=f"{len(orphans)} nodes have no edges (invisible to Pulse BFS)",
            ))

        # Isolated units (units with no cross-unit edges)
        node_unit = {n["id"]: n.get("unit_id", "") for n in nodes}
        units = {u for u in node_unit.values() if u}
        unit_has_cross = set()
        for e in edges:
            su = node_unit.get(e["source"], "")
            tu = node_unit.get(e["target"], "")
            if su and tu and su != tu:
                unit_has_cross.add(su)
                unit_has_cross.add(tu)

        isolated_units = units - unit_has_cross
        if isolated_units:
            anomalies.append(GraphAnomaly(
                type="isolated_unit",
                severity="critical",
                entity_ids=sorted(isolated_units),
                description=f"{len(isolated_units)} units have no cross-unit edges (unreachable by BFS from other units)",
            ))

        # Bottleneck nodes
        if metrics.bottleneck_nodes:
            anomalies.append(GraphAnomaly(
                type="bottleneck",
                severity="warning",
                entity_ids=metrics.bottleneck_nodes[:10],
                description=f"{len(metrics.bottleneck_nodes)} nodes are sole prerequisite for 3+ dependents (single points of failure)",
            ))

        # Dead-end clusters (subtrees where all leaves are dead ends)
        if metrics.dead_end_ratio > 0.35:
            dead_ends = node_ids - {e["source"] for e in edges}
            anomalies.append(GraphAnomaly(
                type="dead_end_cluster",
                severity="warning",
                entity_ids=sorted(dead_ends)[:20],
                description=f"{len(dead_ends)} dead-end nodes ({metrics.dead_end_ratio:.0%} of graph). Pulse can't progress past these.",
            ))

        return anomalies

    # ------------------------------------------------------------------ #
    #  Impact Projection
    # ------------------------------------------------------------------ #

    @staticmethod
    def compute_impact(
        nodes: List[Dict],
        edges: List[Dict],
        proposed_edges: List[Dict],
    ) -> SuggestionImpact:
        """Compute before/after metrics delta for proposed edges."""
        before = GraphAnalysisEngine.compute_health_metrics(nodes, edges)
        before_score = GraphAnalysisEngine.compute_health_score(before)

        combined = edges + proposed_edges
        after = GraphAnalysisEngine.compute_health_metrics(nodes, combined)
        after_score = GraphAnalysisEngine.compute_health_score(after)

        return SuggestionImpact(
            bfs_reach_delta=round(after.avg_bfs_reach - before.avg_bfs_reach, 2),
            component_count_delta=after.component_count - before.component_count,
            cross_unit_ratio_delta=round(after.cross_unit_ratio - before.cross_unit_ratio, 3),
            health_score_delta=round(after_score - before_score, 1),
        )

    # ------------------------------------------------------------------ #
    #  Edge Validation
    # ------------------------------------------------------------------ #

    @staticmethod
    def validate_edge(
        nodes: List[Dict],
        edges: List[Dict],
        new_edge: Dict,
    ) -> Tuple[bool, List[str]]:
        """Validate a proposed edge.

        Returns (valid, warnings). Cycle detection runs on the prerequisite
        subgraph only — non-prerequisite edges can form cycles.
        """
        warnings: List[str] = []
        node_ids = {n["id"] for n in nodes}

        # Check source and target exist
        if new_edge.get("source") not in node_ids:
            return False, [f"Source {new_edge.get('source')} not found in graph"]
        if new_edge.get("target") not in node_ids:
            return False, [f"Target {new_edge.get('target')} not found in graph"]

        # Self-loop
        if new_edge["source"] == new_edge["target"]:
            return False, ["Self-loop: source and target are the same node"]

        # Cycle check (prerequisite subgraph only)
        if new_edge.get("is_prerequisite", False):
            prereq_edges = [e for e in edges if e.get("is_prerequisite", True)]
            prereq_edges.append(new_edge)

            # BFS from target to see if we reach source
            forward: Dict[str, List[str]] = defaultdict(list)
            for e in prereq_edges:
                forward[e["source"]].append(e["target"])

            visited: Set[str] = set()
            queue = [new_edge["target"]]
            while queue:
                current = queue.pop(0)
                if current == new_edge["source"]:
                    return False, ["Prerequisite cycle detected"]
                if current in visited:
                    continue
                visited.add(current)
                queue.extend(forward.get(current, []))

        # Redundancy check (transitive prerequisite)
        if new_edge.get("is_prerequisite", False):
            prereq_forward: Dict[str, List[str]] = defaultdict(list)
            for e in edges:
                if e.get("is_prerequisite", True):
                    prereq_forward[e["source"]].append(e["target"])

            # BFS from source on existing prereqs — if target is reachable,
            # this edge is transitively redundant
            visited = set()
            queue = list(prereq_forward.get(new_edge["source"], []))
            while queue:
                current = queue.pop(0)
                if current == new_edge["target"]:
                    warnings.append("Transitively redundant: target already reachable from source via existing prerequisites")
                    break
                if current in visited:
                    continue
                visited.add(current)
                queue.extend(prereq_forward.get(current, []))

        # Duplicate edge check
        for e in edges:
            if e["source"] == new_edge["source"] and e["target"] == new_edge["target"]:
                if e.get("relationship") == new_edge.get("relationship"):
                    return False, [f"Duplicate edge: {new_edge['source']} -> {new_edge['target']} ({new_edge.get('relationship')}) already exists"]
                else:
                    warnings.append(f"Edge already exists with relationship '{e.get('relationship')}'; adding '{new_edge.get('relationship')}' creates a multi-edge")

        return True, warnings

    # ------------------------------------------------------------------ #
    #  Opportunity Identification (for suggestion engine)
    # ------------------------------------------------------------------ #

    @staticmethod
    def identify_opportunities(
        nodes: List[Dict],
        edges: List[Dict],
        anomalies: List[GraphAnomaly],
    ) -> List[Dict]:
        """Identify high-value connection opportunities from anomalies.

        Only produces subskill↔subskill candidates — skill-level nodes are
        containers and should not be edge endpoints.

        Returns a list of opportunity dicts:
          {type, source_candidates, target_candidates, reason, priority}
        """
        opportunities: List[Dict] = []
        node_map = {n["id"]: n for n in nodes}
        subskill_ids = {n["id"] for n in nodes if n.get("type") == "subskill"}
        connected = {e["source"] for e in edges} | {e["target"] for e in edges}

        for anomaly in anomalies:
            if anomaly.type == "orphan":
                # For each orphan subskill, find nearest connected subskill in same unit
                for orphan_id in anomaly.entity_ids[:10]:
                    if orphan_id not in subskill_ids:
                        continue
                    orphan = node_map.get(orphan_id, {})
                    orphan_unit = orphan.get("unit_id", "")
                    same_unit = [
                        nid for nid in connected & subskill_ids
                        if node_map.get(nid, {}).get("unit_id", "") == orphan_unit
                    ]
                    if same_unit:
                        opportunities.append({
                            "type": "connect_orphan",
                            "source_candidates": same_unit[:3],
                            "target_candidates": [orphan_id],
                            "reason": f"Orphan subskill {orphan_id} in unit {orphan_unit}",
                            "priority": "high",
                        })

            elif anomaly.type == "isolated_unit":
                # Bridge isolated units via subskill nodes only
                for unit_id in anomaly.entity_ids[:5]:
                    unit_subskills = [
                        n["id"] for n in nodes
                        if n.get("unit_id") == unit_id and n.get("type") == "subskill"
                    ]
                    # Find connected subskills in other units as bridge sources
                    other_subskills = [
                        nid for nid in connected & subskill_ids
                        if node_map.get(nid, {}).get("unit_id") != unit_id
                    ]
                    if unit_subskills and other_subskills:
                        opportunities.append({
                            "type": "bridge_unit",
                            "source_candidates": other_subskills[:5],
                            "target_candidates": unit_subskills[:5],
                            "reason": f"Unit {unit_id} is isolated (no cross-unit edges)",
                            "priority": "critical",
                        })

            elif anomaly.type == "dead_end_cluster":
                # Dead-end subskills need forward edges to other units
                for dead_id in anomaly.entity_ids[:10]:
                    if dead_id not in subskill_ids:
                        continue
                    dead = node_map.get(dead_id, {})
                    dead_unit = dead.get("unit_id", "")
                    dead_diff = dead.get("difficulty_start", 5)
                    candidates = [
                        n["id"] for n in nodes
                        if n.get("type") == "subskill"
                        and n.get("unit_id", "") != dead_unit
                        and abs(n.get("difficulty_start", 5) - dead_diff) <= 2
                        and n["id"] not in {e["target"] for e in edges if e["source"] == dead_id}
                    ]
                    if candidates:
                        opportunities.append({
                            "type": "extend_dead_end",
                            "source_candidates": [dead_id],
                            "target_candidates": candidates[:3],
                            "reason": f"Dead-end subskill {dead_id} — needs forward edges",
                            "priority": "medium",
                        })

        return opportunities

    # ------------------------------------------------------------------ #
    #  Private helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _bfs_reach(start: Set[str], edges: List[Dict], max_hops: int) -> Set[str]:
        """BFS on full graph, returns reachable node IDs (excluding start)."""
        forward: Dict[str, List[str]] = defaultdict(list)
        for e in edges:
            forward[e["source"]].append(e["target"])

        visited: Set[str] = set()
        queue = [(s, 0) for s in start]
        while queue:
            nid, depth = queue.pop(0)
            if nid in visited or depth > max_hops:
                continue
            visited.add(nid)
            if depth < max_hops:
                for child in forward.get(nid, []):
                    if child not in visited:
                        queue.append((child, depth + 1))
        return visited - start
