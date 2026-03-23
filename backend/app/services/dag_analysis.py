"""
DAG Analysis Engine — Pure Graph Algorithms for Curriculum DAGs

Stateless, IO-free analysis of curriculum prerequisite graphs (DAGs).
All methods are static/pure: given nodes + edges, produce topological
metrics, probe selections, and inference propagations.

Used by PulseEngine for cold-start probes, leapfrog ancestor walks,
and frontier computation.

Key algorithms:
  - Kahn's topological sort
  - Longest-path depth/height via DP on topological order
  - BFS ancestor/descendant traversal for inference propagation
  - Union-Find for connected component (independent chain) detection
  - Midpoint selection for initial + adaptive probe placement
"""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Set, Tuple

# Default number of items per probe
DEFAULT_PROBE_ITEMS = 3


class DiagnosticStatus(str, Enum):
    """Classification status for a subskill during DAG inference."""
    UNKNOWN = "unknown"
    PROBED_MASTERED = "probed_mastered"
    PROBED_NOT_MASTERED = "probed_not_mastered"
    INFERRED_MASTERED = "inferred_mastered"
    INFERRED_NOT_MASTERED = "inferred_not_mastered"


@dataclass
class NodeMetrics:
    """Topological metrics for a single DAG node."""
    node_id: str
    depth: int = 0
    height: int = 0
    chain_length: int = 0


@dataclass
class ProbeRequest:
    """A request to probe a specific subskill."""
    subskill_id: str
    subject: str = ""
    skill_id: str = ""
    skill_description: str = ""
    description: str = ""
    items_needed: int = DEFAULT_PROBE_ITEMS
    depth: int = 0
    chain_length: int = 0
    reason: str = ""


@dataclass
class SubskillClassification:
    """Classification state for a subskill during inference."""
    subskill_id: str
    status: DiagnosticStatus = DiagnosticStatus.UNKNOWN
    inferred_from: Optional[str] = None


@dataclass
class InferenceMade:
    """Record of a single inference propagation."""
    source_probe: str
    direction: str  # "upward" or "downward"
    affected_node: str
    new_status: DiagnosticStatus


class DAGAnalysisEngine:
    """
    Stateless DAG analysis for diagnostic placement.

    All methods are static — no instance state, no IO.
    Takes raw node/edge lists from curriculum_graphs Firestore docs.

    Edge convention (matches Firestore schema):
      edge["source"] = prerequisite node
      edge["target"] = dependent node (requires source)
      i.e., source → target means "source must be mastered before target"
    """

    # ------------------------------------------------------------------
    # Graph structure helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _build_adjacency(
        edges: List[Dict],
    ) -> Tuple[Dict[str, List[str]], Dict[str, List[str]]]:
        """
        Build forward and reverse adjacency lists from edges.

        Returns:
            (forward, reverse) where:
            - forward[node] = [nodes that depend on it]
            - reverse[node] = [nodes it depends on (prerequisites)]
        """
        forward: Dict[str, List[str]] = defaultdict(list)
        reverse: Dict[str, List[str]] = defaultdict(list)
        for edge in edges:
            src = edge["source"]
            tgt = edge["target"]
            forward[src].append(tgt)
            reverse[tgt].append(src)
        return dict(forward), dict(reverse)

    # ------------------------------------------------------------------
    # Topological sort
    # ------------------------------------------------------------------

    @staticmethod
    def topological_sort(
        nodes: List[Dict], edges: List[Dict],
    ) -> List[str]:
        """
        Kahn's algorithm — BFS topological sort.

        Returns node IDs in topological order (prerequisites before dependents).
        Raises ValueError if the graph contains a cycle.
        """
        node_ids = {n["id"] for n in nodes}

        # In-degree count
        in_degree: Dict[str, int] = {nid: 0 for nid in node_ids}
        forward: Dict[str, List[str]] = defaultdict(list)
        for edge in edges:
            src, tgt = edge["source"], edge["target"]
            if src in node_ids and tgt in node_ids:
                forward[src].append(tgt)
                in_degree[tgt] = in_degree.get(tgt, 0) + 1

        # Seed queue with zero-in-degree nodes (roots)
        queue = deque(nid for nid, deg in in_degree.items() if deg == 0)
        topo_order: List[str] = []

        while queue:
            node = queue.popleft()
            topo_order.append(node)
            for neighbor in forward.get(node, []):
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        if len(topo_order) != len(node_ids):
            raise ValueError(
                f"Graph contains a cycle — topological sort found "
                f"{len(topo_order)}/{len(node_ids)} nodes"
            )

        return topo_order

    # ------------------------------------------------------------------
    # Depth / height / chain-length computation
    # ------------------------------------------------------------------

    @staticmethod
    def compute_node_metrics(
        nodes: List[Dict],
        edges: List[Dict],
        topo_order: List[str],
    ) -> Dict[str, NodeMetrics]:
        """
        Compute topological metrics for every node.

        Forward DP (topological order):
          depth[n] = max(depth[pred] + 1) for all predecessors of n.
          Roots (no incoming edges) have depth = 0.

        Backward DP (reverse topological order):
          height[n] = max(height[succ] + 1) for all successors of n.
          Leaves (no outgoing edges) have height = 0.

        chain_length[n] = depth[n] + height[n]
          This is the length of the longest path passing through n.
        """
        node_ids = {n["id"] for n in nodes}
        forward, reverse = DAGAnalysisEngine._build_adjacency(edges)

        # Forward pass: depth
        depth: Dict[str, int] = {}
        for nid in topo_order:
            preds = reverse.get(nid, [])
            if not preds:
                depth[nid] = 0
            else:
                depth[nid] = max(
                    (depth.get(p, 0) + 1 for p in preds if p in node_ids),
                    default=0,
                )

        # Backward pass: height
        height: Dict[str, int] = {}
        for nid in reversed(topo_order):
            succs = forward.get(nid, [])
            if not succs:
                height[nid] = 0
            else:
                height[nid] = max(
                    (height.get(s, 0) + 1 for s in succs if s in node_ids),
                    default=0,
                )

        # Build metrics
        metrics: Dict[str, NodeMetrics] = {}
        for nid in topo_order:
            d = depth.get(nid, 0)
            h = height.get(nid, 0)
            metrics[nid] = NodeMetrics(
                node_id=nid,
                depth=d,
                height=h,
                chain_length=d + h,
            )

        return metrics

    # ------------------------------------------------------------------
    # Ancestor / descendant traversal (BFS)
    # ------------------------------------------------------------------

    @staticmethod
    def get_ancestors(node_id: str, edges: List[Dict]) -> Set[str]:
        """
        BFS upward: find ALL transitive prerequisites of node_id.

        Follows reverse edges: target → source (i.e., "what does this depend on?").
        Does NOT include node_id itself.
        """
        reverse: Dict[str, List[str]] = defaultdict(list)
        for edge in edges:
            reverse[edge["target"]].append(edge["source"])

        visited: Set[str] = set()
        queue = deque(reverse.get(node_id, []))
        while queue:
            current = queue.popleft()
            if current not in visited:
                visited.add(current)
                queue.extend(
                    p for p in reverse.get(current, []) if p not in visited
                )
        return visited

    @staticmethod
    def get_descendants(node_id: str, edges: List[Dict]) -> Set[str]:
        """
        BFS downward: find ALL transitive dependents of node_id.

        Follows forward edges: source → target (i.e., "what depends on this?").
        Does NOT include node_id itself.
        """
        forward: Dict[str, List[str]] = defaultdict(list)
        for edge in edges:
            forward[edge["source"]].append(edge["target"])

        visited: Set[str] = set()
        queue = deque(forward.get(node_id, []))
        while queue:
            current = queue.popleft()
            if current not in visited:
                visited.add(current)
                queue.extend(
                    s for s in forward.get(current, []) if s not in visited
                )
        return visited

    # ------------------------------------------------------------------
    # Connected components (independent chains)
    # ------------------------------------------------------------------

    @staticmethod
    def identify_independent_chains(
        nodes: List[Dict],
        edges: List[Dict],
    ) -> List[List[str]]:
        """
        Find weakly-connected components via Union-Find.

        Returns list of components, each a list of node IDs.
        Sorted by component size (largest first).
        """
        node_ids = [n["id"] for n in nodes]
        parent: Dict[str, str] = {nid: nid for nid in node_ids}

        def find(x: str) -> str:
            while parent[x] != x:
                parent[x] = parent[parent[x]]  # path compression
                x = parent[x]
            return x

        def union(a: str, b: str) -> None:
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[ra] = rb

        for edge in edges:
            src, tgt = edge["source"], edge["target"]
            if src in parent and tgt in parent:
                union(src, tgt)

        # Group by root
        components: Dict[str, List[str]] = defaultdict(list)
        for nid in node_ids:
            components[find(nid)].append(nid)

        # Sort by size descending
        return sorted(components.values(), key=len, reverse=True)

    # ------------------------------------------------------------------
    # Probe selection
    # ------------------------------------------------------------------

    @staticmethod
    def select_initial_probes(
        metrics: Dict[str, NodeMetrics],
        nodes: List[Dict],
        edges: List[Dict],
        max_probes: int = 5,
    ) -> List[ProbeRequest]:
        """
        Select initial probe points — one midpoint per independent chain.

        Algorithm:
        1. Find independent chains (connected components)
        2. For each chain, find the node closest to chain_length / 2
           (where chain_length is the longest path through any node in that chain)
        3. Pick the midpoint of each chain, longest chains first
        4. Return up to max_probes

        Each ProbeRequest includes a human-readable `reason` for transparency.
        """
        node_map = {n["id"]: n for n in nodes}
        chains = DAGAnalysisEngine.identify_independent_chains(nodes, edges)

        probes: List[ProbeRequest] = []

        for chain_node_ids in chains:
            if len(probes) >= max_probes:
                break

            # Find the longest chain_length in this component
            chain_metrics = [
                metrics[nid] for nid in chain_node_ids if nid in metrics
            ]
            if not chain_metrics:
                continue

            max_chain_len = max(m.chain_length for m in chain_metrics)
            if max_chain_len == 0:
                # Single node or trivial chain — still probe it
                best = chain_metrics[0]
            else:
                # Target: node whose depth is closest to max_chain_len / 2
                target_depth = max_chain_len / 2
                best = min(
                    chain_metrics,
                    key=lambda m: abs(m.depth - target_depth),
                )

            node_data = node_map.get(best.node_id, {})
            probes.append(ProbeRequest(
                subskill_id=best.node_id,
                subject=node_data.get("subject", ""),
                skill_id=node_data.get("skill_id", ""),
                skill_description=node_data.get("skill_description", ""),
                description=node_data.get("description", "")
                    or node_data.get("label", ""),
                items_needed=DEFAULT_PROBE_ITEMS,
                depth=best.depth,
                chain_length=best.chain_length,
                reason=(
                    f"midpoint of {max_chain_len + 1}-node chain "
                    f"at depth {best.depth}"
                ),
            ))

        return probes

    # ------------------------------------------------------------------
    # Inference propagation
    # ------------------------------------------------------------------

    @staticmethod
    def propagate_inference(
        probed_node_id: str,
        passed: bool,
        edges: List[Dict],
        classifications: Dict[str, SubskillClassification],
    ) -> Tuple[Dict[str, SubskillClassification], List[InferenceMade]]:
        """
        Propagate inference from a probe result.

        PASS: mark all ancestors as INFERRED_MASTERED (if currently UNKNOWN).
        FAIL: mark all descendants as INFERRED_NOT_MASTERED (if currently UNKNOWN).

        NEVER overwrites a PROBED status (probed_mastered / probed_not_mastered)
        with an inferred status.  Direct evidence always wins.

        Returns:
            (updated_classifications, inferences_made)
        """
        inferences: List[InferenceMade] = []

        if passed:
            # Upward inference: ancestors are mastered
            ancestors = DAGAnalysisEngine.get_ancestors(probed_node_id, edges)
            for ancestor_id in ancestors:
                if ancestor_id in classifications:
                    current = classifications[ancestor_id].status
                    if current == DiagnosticStatus.UNKNOWN:
                        classifications[ancestor_id].status = (
                            DiagnosticStatus.INFERRED_MASTERED
                        )
                        classifications[ancestor_id].inferred_from = (
                            probed_node_id
                        )
                        inferences.append(InferenceMade(
                            source_probe=probed_node_id,
                            direction="upward",
                            affected_node=ancestor_id,
                            new_status=DiagnosticStatus.INFERRED_MASTERED,
                        ))
        else:
            # Downward inference: descendants are not mastered
            descendants = DAGAnalysisEngine.get_descendants(
                probed_node_id, edges,
            )
            for desc_id in descendants:
                if desc_id in classifications:
                    current = classifications[desc_id].status
                    if current == DiagnosticStatus.UNKNOWN:
                        classifications[desc_id].status = (
                            DiagnosticStatus.INFERRED_NOT_MASTERED
                        )
                        classifications[desc_id].inferred_from = (
                            probed_node_id
                        )
                        inferences.append(InferenceMade(
                            source_probe=probed_node_id,
                            direction="downward",
                            affected_node=desc_id,
                            new_status=(
                                DiagnosticStatus.INFERRED_NOT_MASTERED
                            ),
                        ))

        return classifications, inferences

    # ------------------------------------------------------------------
    # Next-probe selection (adaptive)
    # ------------------------------------------------------------------

    @staticmethod
    def select_next_probes(
        metrics: Dict[str, NodeMetrics],
        nodes: List[Dict],
        edges: List[Dict],
        classifications: Dict[str, SubskillClassification],
        last_probed_id: str,
        last_passed: bool,
        max_probes: int = 3,
    ) -> List[ProbeRequest]:
        """
        Select next probes after receiving a probe result.

        Strategy:
        1. After PASS: search among UNKNOWN descendants (go deeper)
        2. After FAIL: search among UNKNOWN ancestors (go shallower)
        3. Fallback: if no UNKNOWN nodes in that direction, pick midpoints
           of the longest remaining UNKNOWN chains anywhere in the graph

        Returns up to max_probes ProbeRequests.
        """
        node_map = {n["id"]: n for n in nodes}

        # Identify all remaining UNKNOWN nodes
        unknown_ids = {
            sid for sid, cls in classifications.items()
            if cls.status == DiagnosticStatus.UNKNOWN
        }

        if not unknown_ids:
            return []

        # Directional search
        if last_passed:
            # Look among UNKNOWN descendants
            descendants = DAGAnalysisEngine.get_descendants(
                last_probed_id, edges,
            )
            candidates = unknown_ids & descendants
            direction = "deeper"
        else:
            # Look among UNKNOWN ancestors
            ancestors = DAGAnalysisEngine.get_ancestors(
                last_probed_id, edges,
            )
            candidates = unknown_ids & ancestors
            direction = "shallower"

        # Fallback: all remaining UNKNOWN nodes
        if not candidates:
            candidates = unknown_ids
            direction = "remaining"

        # Among candidates, find the best midpoints
        candidate_metrics = [
            metrics[nid] for nid in candidates
            if nid in metrics
        ]
        if not candidate_metrics:
            return []

        # Group candidates into connected components for diversity
        candidate_nodes = [
            n for n in nodes if n["id"] in candidates
        ]
        candidate_edges = [
            e for e in edges
            if e["source"] in candidates or e["target"] in candidates
        ]

        # Simple approach: sort by chain_length desc, then pick midpoints
        # of distinct sub-chains
        candidate_metrics.sort(key=lambda m: m.chain_length, reverse=True)

        probes: List[ProbeRequest] = []
        used_ids: Set[str] = set()

        for m in candidate_metrics:
            if len(probes) >= max_probes:
                break
            if m.node_id in used_ids:
                continue

            # Check this is roughly a midpoint in the UNKNOWN region
            # (the node with the highest chain_length that's still unknown)
            node_data = node_map.get(m.node_id, {})

            reason_prefix = {
                "deeper": f"binary search deeper after PASS on {last_probed_id}",
                "shallower": f"binary search shallower after FAIL on {last_probed_id}",
                "remaining": "midpoint of longest remaining unknown chain",
            }[direction]

            probes.append(ProbeRequest(
                subskill_id=m.node_id,
                subject=node_data.get("subject", ""),
                skill_id=node_data.get("skill_id", ""),
                skill_description=node_data.get("skill_description", ""),
                description=node_data.get("description", "")
                    or node_data.get("label", ""),
                items_needed=DEFAULT_PROBE_ITEMS,
                depth=m.depth,
                chain_length=m.chain_length,
                reason=f"{reason_prefix} — depth {m.depth} in {m.chain_length + 1}-node chain",
            ))

            # Exclude ancestors and descendants of this probe to diversify
            used_ids.add(m.node_id)
            used_ids |= DAGAnalysisEngine.get_ancestors(m.node_id, edges)
            used_ids |= DAGAnalysisEngine.get_descendants(m.node_id, edges)

        return probes

    # ------------------------------------------------------------------
    # Coverage
    # ------------------------------------------------------------------

    @staticmethod
    def compute_coverage(
        classifications: Dict[str, SubskillClassification],
        total_nodes: int,
    ) -> float:
        """
        Fraction of nodes that have been classified (status != UNKNOWN).

        Returns 0.0-1.0.
        """
        if total_nodes == 0:
            return 1.0
        classified = sum(
            1 for cls in classifications.values()
            if cls.status != DiagnosticStatus.UNKNOWN
        )
        return classified / total_nodes

    # ------------------------------------------------------------------
    # Frontier identification
    # ------------------------------------------------------------------

    @staticmethod
    def identify_frontier(
        classifications: Dict[str, SubskillClassification],
        edges: List[Dict],
    ) -> List[str]:
        """
        Knowledge frontier: subskills where all prerequisites are mastered
        (probed or inferred) but the skill itself is NOT mastered.

        These are the first skills to teach after diagnostic placement.
        """
        # Build prerequisite map: target → [sources]
        prereq_map: Dict[str, List[str]] = defaultdict(list)
        for edge in edges:
            prereq_map[edge["target"]].append(edge["source"])

        mastered_statuses = {
            DiagnosticStatus.PROBED_MASTERED,
            DiagnosticStatus.INFERRED_MASTERED,
        }
        not_mastered_statuses = {
            DiagnosticStatus.PROBED_NOT_MASTERED,
            DiagnosticStatus.INFERRED_NOT_MASTERED,
            DiagnosticStatus.UNKNOWN,
        }

        frontier: List[str] = []
        for subskill_id, cls in classifications.items():
            if cls.status not in not_mastered_statuses:
                continue  # Already mastered — not on the frontier

            # Check if all prerequisites are mastered
            prereqs = prereq_map.get(subskill_id, [])
            if not prereqs:
                # Root node with no prereqs — on the frontier if not mastered
                frontier.append(subskill_id)
                continue

            all_prereqs_mastered = all(
                classifications.get(pid, SubskillClassification(
                    subskill_id=pid,
                )).status in mastered_statuses
                for pid in prereqs
            )
            if all_prereqs_mastered:
                frontier.append(subskill_id)

        return frontier

    # ------------------------------------------------------------------
    # Knowledge-graph helpers (prerequisite vs. discovery subgraphs)
    # ------------------------------------------------------------------

    @staticmethod
    def filter_prerequisite_edges(edges: List[Dict]) -> List[Dict]:
        """Return only edges that enforce mastery gates.

        Edges missing ``is_prerequisite`` (pre-migration caches) default to
        True for backward compatibility.
        """
        return [e for e in edges if e.get("is_prerequisite", True)]

    @staticmethod
    def filter_discovery_edges(edges: List[Dict]) -> List[Dict]:
        """Return all edges (the full knowledge graph is navigable for BFS
        discovery)."""
        return edges

    @staticmethod
    def bfs_reach(
        start_ids: Set[str],
        edges: List[Dict],
        max_hops: int = 5,
    ) -> Set[str]:
        """BFS on the full knowledge graph, returning all reachable node IDs.

        Uses both ``source->target`` and (for ``parallel`` edges) the reverse
        direction since parallel edges are stored bidirectionally.
        """
        forward: Dict[str, List[str]] = defaultdict(list)
        for edge in edges:
            forward[edge["source"]].append(edge["target"])

        visited: Set[str] = set()
        queue: deque = deque()
        for sid in start_ids:
            queue.append((sid, 0))

        while queue:
            nid, depth = queue.popleft()
            if nid in visited or depth > max_hops:
                continue
            visited.add(nid)
            if depth < max_hops:
                for child in forward.get(nid, []):
                    if child not in visited:
                        queue.append((child, depth + 1))

        return visited - start_ids  # Exclude the seeds themselves

    @staticmethod
    def compute_health_metrics(
        nodes: List[Dict],
        edges: List[Dict],
    ) -> Dict:
        """Compute structural health metrics for the knowledge graph.

        Returns a dict suitable for serialization:
          node_count, edge_count, edge_density, component_count,
          cross_unit_ratio, avg_bfs_reach, dead_end_ratio, orphan_count,
          bottleneck_nodes.
        """
        node_ids = {n["id"] for n in nodes}
        node_count = len(node_ids)

        if node_count == 0:
            return {
                "node_count": 0, "edge_count": 0, "edge_density": 0.0,
                "component_count": 0, "cross_unit_ratio": 0.0,
                "avg_bfs_reach": 0.0, "dead_end_ratio": 0.0,
                "orphan_count": 0, "bottleneck_nodes": [],
            }

        edge_count = len(edges)
        edge_density = edge_count / node_count if node_count else 0.0

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
        node_unit: Dict[str, str] = {}
        for n in nodes:
            node_unit[n["id"]] = n.get("unit_id", "")

        cross_unit = sum(
            1 for e in edges
            if node_unit.get(e["source"], "") and node_unit.get(e["target"], "")
            and node_unit[e["source"]] != node_unit[e["target"]]
        )
        cross_unit_ratio = cross_unit / edge_count if edge_count else 0.0

        # Dead-end ratio (nodes with no outgoing edges)
        has_outgoing: Set[str] = set()
        has_incoming: Set[str] = set()
        for edge in edges:
            has_outgoing.add(edge["source"])
            has_incoming.add(edge["target"])

        dead_ends = node_ids - has_outgoing
        dead_end_ratio = len(dead_ends) / node_count

        # Orphan nodes (no edges at all)
        connected_nodes = has_outgoing | has_incoming
        orphans = node_ids - connected_nodes
        orphan_count = len(orphans)

        # Avg BFS reach from each root (no incoming prerequisite edges)
        prereq_edges = [e for e in edges if e.get("is_prerequisite", True)]
        prereq_targets = {e["target"] for e in prereq_edges}
        roots = node_ids - prereq_targets

        if roots:
            total_reach = 0
            for root in roots:
                reached = DAGAnalysisEngine.bfs_reach({root}, edges, max_hops=5)
                total_reach += len(reached)
            avg_bfs_reach = total_reach / len(roots)
        else:
            avg_bfs_reach = 0.0

        # Bottleneck nodes: prerequisite edges where removing the node
        # disconnects parts of the prereq subgraph. Simplified: nodes that
        # are the sole prerequisite for multiple dependents.
        prereq_target_counts: Dict[str, int] = defaultdict(int)
        for e in prereq_edges:
            prereq_target_counts[e["source"]] += 1
        bottleneck_nodes = [
            nid for nid, cnt in prereq_target_counts.items() if cnt >= 3
        ]

        return {
            "node_count": node_count,
            "edge_count": edge_count,
            "edge_density": round(edge_density, 3),
            "component_count": component_count,
            "cross_unit_ratio": round(cross_unit_ratio, 3),
            "avg_bfs_reach": round(avg_bfs_reach, 2),
            "dead_end_ratio": round(dead_end_ratio, 3),
            "orphan_count": orphan_count,
            "bottleneck_nodes": bottleneck_nodes,
        }
