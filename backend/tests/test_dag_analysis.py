"""
Unit tests for DAGAnalysisEngine — pure algorithm tests with known graph structures.

No Firestore, no IO — these test the core diagnostic placement algorithms.
"""

import pytest
from app.services.dag_analysis import DAGAnalysisEngine
from app.models.diagnostic import (
    DiagnosticStatus,
    NodeMetrics,
    SubskillClassification,
)


# ---------------------------------------------------------------------------
# Test fixtures: reusable graph structures
# ---------------------------------------------------------------------------

def _make_node(nid: str, subject: str = "Math", skill_id: str = "") -> dict:
    return {
        "id": nid,
        "type": "subskill",
        "subject": subject,
        "description": f"Description for {nid}",
        "skill_id": skill_id or nid.rsplit("-", 1)[0],
    }


def _make_edge(source: str, target: str, threshold: float = 0.8) -> dict:
    return {"source": source, "target": target, "threshold": threshold}


def linear_chain():
    """A → B → C → D → E (5 nodes, linear)"""
    nodes = [_make_node(x) for x in "ABCDE"]
    edges = [
        _make_edge("A", "B"),
        _make_edge("B", "C"),
        _make_edge("C", "D"),
        _make_edge("D", "E"),
    ]
    return nodes, edges


def diamond_graph():
    """
    A → B → D
    A → C → D
    """
    nodes = [_make_node(x) for x in "ABCD"]
    edges = [
        _make_edge("A", "B"),
        _make_edge("A", "C"),
        _make_edge("B", "D"),
        _make_edge("C", "D"),
    ]
    return nodes, edges


def two_chains():
    """
    Chain 1: A → B → C
    Chain 2: X → Y → Z
    (two independent components)
    """
    nodes = [_make_node(x) for x in ["A", "B", "C", "X", "Y", "Z"]]
    edges = [
        _make_edge("A", "B"),
        _make_edge("B", "C"),
        _make_edge("X", "Y"),
        _make_edge("Y", "Z"),
    ]
    return nodes, edges


def wide_graph():
    """
    R → A → D → G
    R → B → E → H
    R → C → F → I
    (one root, three independent branches)
    """
    nodes = [_make_node(x) for x in "RABCDEFGHI"]
    edges = [
        _make_edge("R", "A"), _make_edge("R", "B"), _make_edge("R", "C"),
        _make_edge("A", "D"), _make_edge("B", "E"), _make_edge("C", "F"),
        _make_edge("D", "G"), _make_edge("E", "H"), _make_edge("F", "I"),
    ]
    return nodes, edges


def _init_classifications(nodes):
    """Create UNKNOWN classification for every node."""
    return {
        n["id"]: SubskillClassification(
            subskill_id=n["id"],
            subject=n.get("subject", ""),
            skill_id=n.get("skill_id", ""),
            status=DiagnosticStatus.UNKNOWN,
        )
        for n in nodes
    }


# ===========================================================================
# Topological sort tests
# ===========================================================================

class TestTopologicalSort:
    def test_linear_chain(self):
        nodes, edges = linear_chain()
        order = DAGAnalysisEngine.topological_sort(nodes, edges)
        assert order == ["A", "B", "C", "D", "E"]

    def test_diamond(self):
        nodes, edges = diamond_graph()
        order = DAGAnalysisEngine.topological_sort(nodes, edges)
        # A must come before B and C; B and C must come before D
        assert order.index("A") < order.index("B")
        assert order.index("A") < order.index("C")
        assert order.index("B") < order.index("D")
        assert order.index("C") < order.index("D")

    def test_two_chains(self):
        nodes, edges = two_chains()
        order = DAGAnalysisEngine.topological_sort(nodes, edges)
        # Within each chain, order is preserved
        assert order.index("A") < order.index("B") < order.index("C")
        assert order.index("X") < order.index("Y") < order.index("Z")

    def test_single_node(self):
        nodes = [_make_node("A")]
        order = DAGAnalysisEngine.topological_sort(nodes, [])
        assert order == ["A"]

    def test_cycle_raises(self):
        nodes = [_make_node(x) for x in "ABC"]
        edges = [
            _make_edge("A", "B"),
            _make_edge("B", "C"),
            _make_edge("C", "A"),  # cycle!
        ]
        with pytest.raises(ValueError, match="cycle"):
            DAGAnalysisEngine.topological_sort(nodes, edges)


# ===========================================================================
# Node metrics tests
# ===========================================================================

class TestNodeMetrics:
    def test_linear_chain_metrics(self):
        nodes, edges = linear_chain()
        order = DAGAnalysisEngine.topological_sort(nodes, edges)
        metrics = DAGAnalysisEngine.compute_node_metrics(nodes, edges, order)

        # A: depth=0, height=4, chain=4
        assert metrics["A"].depth == 0
        assert metrics["A"].height == 4
        assert metrics["A"].chain_length == 4

        # C: depth=2, height=2, chain=4 (midpoint)
        assert metrics["C"].depth == 2
        assert metrics["C"].height == 2
        assert metrics["C"].chain_length == 4

        # E: depth=4, height=0, chain=4
        assert metrics["E"].depth == 4
        assert metrics["E"].height == 0
        assert metrics["E"].chain_length == 4

    def test_diamond_metrics(self):
        nodes, edges = diamond_graph()
        order = DAGAnalysisEngine.topological_sort(nodes, edges)
        metrics = DAGAnalysisEngine.compute_node_metrics(nodes, edges, order)

        assert metrics["A"].depth == 0
        assert metrics["A"].height == 2
        assert metrics["B"].depth == 1
        assert metrics["C"].depth == 1
        assert metrics["D"].depth == 2
        assert metrics["D"].height == 0

    def test_single_node_metrics(self):
        nodes = [_make_node("A")]
        order = ["A"]
        metrics = DAGAnalysisEngine.compute_node_metrics(nodes, [], order)
        assert metrics["A"].depth == 0
        assert metrics["A"].height == 0
        assert metrics["A"].chain_length == 0


# ===========================================================================
# Ancestor / descendant tests
# ===========================================================================

class TestAncestorDescendant:
    def test_ancestors_linear(self):
        _, edges = linear_chain()
        assert DAGAnalysisEngine.get_ancestors("C", edges) == {"A", "B"}
        assert DAGAnalysisEngine.get_ancestors("E", edges) == {"A", "B", "C", "D"}
        assert DAGAnalysisEngine.get_ancestors("A", edges) == set()

    def test_descendants_linear(self):
        _, edges = linear_chain()
        assert DAGAnalysisEngine.get_descendants("C", edges) == {"D", "E"}
        assert DAGAnalysisEngine.get_descendants("A", edges) == {"B", "C", "D", "E"}
        assert DAGAnalysisEngine.get_descendants("E", edges) == set()

    def test_ancestors_diamond(self):
        _, edges = diamond_graph()
        assert DAGAnalysisEngine.get_ancestors("D", edges) == {"A", "B", "C"}

    def test_descendants_diamond(self):
        _, edges = diamond_graph()
        assert DAGAnalysisEngine.get_descendants("A", edges) == {"B", "C", "D"}


# ===========================================================================
# Connected component tests
# ===========================================================================

class TestIndependentChains:
    def test_single_chain(self):
        nodes, edges = linear_chain()
        chains = DAGAnalysisEngine.identify_independent_chains(nodes, edges)
        assert len(chains) == 1
        assert set(chains[0]) == {"A", "B", "C", "D", "E"}

    def test_two_chains(self):
        nodes, edges = two_chains()
        chains = DAGAnalysisEngine.identify_independent_chains(nodes, edges)
        assert len(chains) == 2
        chain_sets = [set(c) for c in chains]
        assert {"A", "B", "C"} in chain_sets
        assert {"X", "Y", "Z"} in chain_sets

    def test_isolated_nodes(self):
        nodes = [_make_node("A"), _make_node("B"), _make_node("C")]
        chains = DAGAnalysisEngine.identify_independent_chains(nodes, [])
        assert len(chains) == 3  # each node is its own component


# ===========================================================================
# Initial probe selection tests
# ===========================================================================

class TestSelectInitialProbes:
    def test_linear_chain_selects_midpoint(self):
        nodes, edges = linear_chain()
        order = DAGAnalysisEngine.topological_sort(nodes, edges)
        metrics = DAGAnalysisEngine.compute_node_metrics(nodes, edges, order)

        probes = DAGAnalysisEngine.select_initial_probes(
            metrics, nodes, edges, max_probes=5,
        )
        assert len(probes) == 1  # one chain → one probe
        # Midpoint of chain length 4 (nodes A-E) at target depth 2 = node C
        assert probes[0].subskill_id == "C"
        assert "midpoint" in probes[0].reason

    def test_two_chains_selects_two_probes(self):
        nodes, edges = two_chains()
        order = DAGAnalysisEngine.topological_sort(nodes, edges)
        metrics = DAGAnalysisEngine.compute_node_metrics(nodes, edges, order)

        probes = DAGAnalysisEngine.select_initial_probes(
            metrics, nodes, edges, max_probes=5,
        )
        assert len(probes) == 2  # two chains → two probes
        probe_ids = {p.subskill_id for p in probes}
        # Midpoints of each 3-node chain (A-B-C and X-Y-Z) at depth 1
        assert probe_ids == {"B", "Y"}

    def test_max_probes_respected(self):
        # Create 10 independent single-node chains
        nodes = [_make_node(str(i)) for i in range(10)]
        order = DAGAnalysisEngine.topological_sort(nodes, [])
        metrics = DAGAnalysisEngine.compute_node_metrics(nodes, [], order)

        probes = DAGAnalysisEngine.select_initial_probes(
            metrics, nodes, [], max_probes=3,
        )
        assert len(probes) <= 3

    def test_probe_has_reason(self):
        nodes, edges = linear_chain()
        order = DAGAnalysisEngine.topological_sort(nodes, edges)
        metrics = DAGAnalysisEngine.compute_node_metrics(nodes, edges, order)

        probes = DAGAnalysisEngine.select_initial_probes(
            metrics, nodes, edges,
        )
        for probe in probes:
            assert probe.reason  # non-empty
            assert "midpoint" in probe.reason


# ===========================================================================
# Inference propagation tests
# ===========================================================================

class TestInferencePropagation:
    def test_pass_marks_ancestors_mastered(self):
        nodes, edges = linear_chain()
        classifications = _init_classifications(nodes)

        # Mark C as probed and passed
        classifications["C"].status = DiagnosticStatus.PROBED_MASTERED
        classifications["C"].score = 0.9

        # Propagate: PASS on C → A, B inferred mastered
        classifications, inferences = DAGAnalysisEngine.propagate_inference(
            "C", True, edges, classifications,
        )
        assert classifications["A"].status == DiagnosticStatus.INFERRED_MASTERED
        assert classifications["B"].status == DiagnosticStatus.INFERRED_MASTERED
        assert classifications["D"].status == DiagnosticStatus.UNKNOWN
        assert classifications["E"].status == DiagnosticStatus.UNKNOWN
        assert len(inferences) == 2

    def test_fail_marks_descendants_not_mastered(self):
        nodes, edges = linear_chain()
        classifications = _init_classifications(nodes)

        # Mark C as probed and failed
        classifications["C"].status = DiagnosticStatus.PROBED_NOT_MASTERED
        classifications["C"].score = 0.4

        # Propagate: FAIL on C → D, E inferred not mastered
        classifications, inferences = DAGAnalysisEngine.propagate_inference(
            "C", False, edges, classifications,
        )
        assert classifications["D"].status == DiagnosticStatus.INFERRED_NOT_MASTERED
        assert classifications["E"].status == DiagnosticStatus.INFERRED_NOT_MASTERED
        assert classifications["A"].status == DiagnosticStatus.UNKNOWN
        assert classifications["B"].status == DiagnosticStatus.UNKNOWN
        assert len(inferences) == 2

    def test_inference_never_overwrites_probed(self):
        nodes, edges = linear_chain()
        classifications = _init_classifications(nodes)

        # First: probe B and it passes
        classifications["B"].status = DiagnosticStatus.PROBED_MASTERED
        classifications["B"].score = 0.8

        # Then: probe D and it fails → downward inference hits E
        # But upward inference from D should NOT overwrite B's probed status
        classifications["D"].status = DiagnosticStatus.PROBED_NOT_MASTERED

        # FAIL on D: descendants (E) get inferred not mastered
        classifications, inf1 = DAGAnalysisEngine.propagate_inference(
            "D", False, edges, classifications,
        )
        assert classifications["E"].status == DiagnosticStatus.INFERRED_NOT_MASTERED

        # PASS on D would mark ancestors — but B is already probed
        # Reset D status for this test
        classifications["D"].status = DiagnosticStatus.PROBED_MASTERED
        classifications, inf2 = DAGAnalysisEngine.propagate_inference(
            "D", True, edges, classifications,
        )
        # B should remain PROBED_MASTERED (not overwritten to INFERRED)
        assert classifications["B"].status == DiagnosticStatus.PROBED_MASTERED

    def test_diamond_inference(self):
        nodes, edges = diamond_graph()
        classifications = _init_classifications(nodes)

        # PASS on D → A, B, C all inferred mastered
        classifications["D"].status = DiagnosticStatus.PROBED_MASTERED
        classifications, inferences = DAGAnalysisEngine.propagate_inference(
            "D", True, edges, classifications,
        )
        assert classifications["A"].status == DiagnosticStatus.INFERRED_MASTERED
        assert classifications["B"].status == DiagnosticStatus.INFERRED_MASTERED
        assert classifications["C"].status == DiagnosticStatus.INFERRED_MASTERED
        assert len(inferences) == 3


# ===========================================================================
# Next probe selection tests
# ===========================================================================

class TestSelectNextProbes:
    def test_after_pass_probes_deeper(self):
        nodes, edges = linear_chain()
        order = DAGAnalysisEngine.topological_sort(nodes, edges)
        metrics = DAGAnalysisEngine.compute_node_metrics(nodes, edges, order)
        classifications = _init_classifications(nodes)

        # PASS on C → A, B inferred mastered
        classifications["C"].status = DiagnosticStatus.PROBED_MASTERED
        classifications, _ = DAGAnalysisEngine.propagate_inference(
            "C", True, edges, classifications,
        )

        # Next probe should be among D, E (descendants that are still UNKNOWN)
        probes = DAGAnalysisEngine.select_next_probes(
            metrics, nodes, edges, classifications,
            last_probed_id="C", last_passed=True,
        )
        assert len(probes) >= 1
        assert all(
            p.subskill_id in {"D", "E"} for p in probes
        )

    def test_after_fail_probes_shallower(self):
        nodes, edges = linear_chain()
        order = DAGAnalysisEngine.topological_sort(nodes, edges)
        metrics = DAGAnalysisEngine.compute_node_metrics(nodes, edges, order)
        classifications = _init_classifications(nodes)

        # FAIL on C → D, E inferred not mastered
        classifications["C"].status = DiagnosticStatus.PROBED_NOT_MASTERED
        classifications, _ = DAGAnalysisEngine.propagate_inference(
            "C", False, edges, classifications,
        )

        # Next probe should be among A, B (ancestors that are still UNKNOWN)
        probes = DAGAnalysisEngine.select_next_probes(
            metrics, nodes, edges, classifications,
            last_probed_id="C", last_passed=False,
        )
        assert len(probes) >= 1
        assert all(
            p.subskill_id in {"A", "B"} for p in probes
        )

    def test_returns_empty_when_all_classified(self):
        nodes, edges = linear_chain()
        order = DAGAnalysisEngine.topological_sort(nodes, edges)
        metrics = DAGAnalysisEngine.compute_node_metrics(nodes, edges, order)
        classifications = _init_classifications(nodes)

        # Mark everything as classified
        for cls in classifications.values():
            cls.status = DiagnosticStatus.INFERRED_MASTERED

        probes = DAGAnalysisEngine.select_next_probes(
            metrics, nodes, edges, classifications,
            last_probed_id="C", last_passed=True,
        )
        assert probes == []


# ===========================================================================
# Coverage tests
# ===========================================================================

class TestCoverage:
    def test_zero_coverage(self):
        nodes, _ = linear_chain()
        classifications = _init_classifications(nodes)
        coverage = DAGAnalysisEngine.compute_coverage(classifications, 5)
        assert coverage == 0.0

    def test_full_coverage(self):
        nodes, _ = linear_chain()
        classifications = _init_classifications(nodes)
        for cls in classifications.values():
            cls.status = DiagnosticStatus.PROBED_MASTERED
        coverage = DAGAnalysisEngine.compute_coverage(classifications, 5)
        assert coverage == 1.0

    def test_partial_coverage(self):
        nodes, _ = linear_chain()
        classifications = _init_classifications(nodes)
        # Classify 3 out of 5
        classifications["A"].status = DiagnosticStatus.PROBED_MASTERED
        classifications["B"].status = DiagnosticStatus.INFERRED_MASTERED
        classifications["C"].status = DiagnosticStatus.PROBED_NOT_MASTERED
        coverage = DAGAnalysisEngine.compute_coverage(classifications, 5)
        assert abs(coverage - 0.6) < 0.01

    def test_empty_graph(self):
        coverage = DAGAnalysisEngine.compute_coverage({}, 0)
        assert coverage == 1.0


# ===========================================================================
# Frontier identification tests
# ===========================================================================

class TestFrontier:
    def test_frontier_linear_chain(self):
        nodes, edges = linear_chain()
        classifications = _init_classifications(nodes)

        # A, B mastered; C failed; D, E inferred not mastered
        classifications["A"].status = DiagnosticStatus.INFERRED_MASTERED
        classifications["B"].status = DiagnosticStatus.INFERRED_MASTERED
        classifications["C"].status = DiagnosticStatus.PROBED_NOT_MASTERED
        classifications["D"].status = DiagnosticStatus.INFERRED_NOT_MASTERED
        classifications["E"].status = DiagnosticStatus.INFERRED_NOT_MASTERED

        frontier = DAGAnalysisEngine.identify_frontier(classifications, edges)
        # C is the frontier: prereqs (A, B) mastered, C itself not mastered
        assert frontier == ["C"]

    def test_frontier_diamond(self):
        nodes, edges = diamond_graph()
        classifications = _init_classifications(nodes)

        # A mastered, B and C are frontier
        classifications["A"].status = DiagnosticStatus.PROBED_MASTERED
        classifications["B"].status = DiagnosticStatus.PROBED_NOT_MASTERED
        classifications["C"].status = DiagnosticStatus.PROBED_NOT_MASTERED
        classifications["D"].status = DiagnosticStatus.INFERRED_NOT_MASTERED

        frontier = DAGAnalysisEngine.identify_frontier(classifications, edges)
        assert set(frontier) == {"B", "C"}

    def test_frontier_root_nodes(self):
        nodes, edges = linear_chain()
        classifications = _init_classifications(nodes)
        # Everything unknown — root node A is on the frontier (no prereqs)
        frontier = DAGAnalysisEngine.identify_frontier(classifications, edges)
        assert "A" in frontier


# ===========================================================================
# Integration test: full diagnostic simulation
# ===========================================================================

class TestFullDiagnosticSimulation:
    """Simulate a complete diagnostic flow on a linear chain."""

    def test_binary_search_finds_frontier(self):
        """
        Linear chain A → B → C → D → E
        Student knows A, B, C but not D, E.
        Binary search should find this boundary in ~2 probes.
        """
        nodes, edges = linear_chain()
        order = DAGAnalysisEngine.topological_sort(nodes, edges)
        metrics = DAGAnalysisEngine.compute_node_metrics(nodes, edges, order)
        classifications = _init_classifications(nodes)

        # Probe 1: midpoint = C (depth 2). Student PASSES.
        classifications["C"].status = DiagnosticStatus.PROBED_MASTERED
        classifications["C"].score = 0.85
        classifications, inf1 = DAGAnalysisEngine.propagate_inference(
            "C", True, edges, classifications,
        )
        # A, B inferred mastered
        assert classifications["A"].status == DiagnosticStatus.INFERRED_MASTERED
        assert classifications["B"].status == DiagnosticStatus.INFERRED_MASTERED

        # Probe 2: next probe goes deeper → D or E
        next_probes = DAGAnalysisEngine.select_next_probes(
            metrics, nodes, edges, classifications,
            last_probed_id="C", last_passed=True,
        )
        assert len(next_probes) >= 1
        # Take the first suggestion (should be D — midpoint of remaining {D, E})
        probe2_id = next_probes[0].subskill_id
        assert probe2_id in {"D", "E"}

        # Student FAILS on D
        classifications[probe2_id].status = DiagnosticStatus.PROBED_NOT_MASTERED
        classifications[probe2_id].score = 0.5
        classifications, inf2 = DAGAnalysisEngine.propagate_inference(
            probe2_id, False, edges, classifications,
        )

        # Coverage should be high now
        coverage = DAGAnalysisEngine.compute_coverage(classifications, 5)
        assert coverage >= 0.8  # At least 4/5 classified

        # Frontier should be D (prereqs A,B,C mastered, D not mastered)
        frontier = DAGAnalysisEngine.identify_frontier(classifications, edges)
        assert "D" in frontier
