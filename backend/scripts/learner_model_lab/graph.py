"""
Subskill graph for the learner-model lab (literacy K-G1, math K-G2).

Built offline from the 10-11 Jev pilot (`reports/graph-jev-pilot-2026-10-11/`):
nodes are published subskills keyed `grade:subskill_id` (bare ids collide
across grades), edges are Jev `max(step, easier_form)` scores. No Firestore
read and no Jev call.

Two edge sets come out of one scored list:
  model edges  the top `max_parents` parents per node above `min_score`,
               oriented into a DAG by adding edges in descending score order
               and skipping any edge that would close a cycle
  truth edges  every edge above `min_score`, same DAG rule, no parent cap;
               the simulated children use these, so the Bayesian model never
               gets the exact structure that generated the data
"""

from __future__ import annotations

import ast
import json
import statistics
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Tuple

from app.services.calibration.problem_type_registry import (
    PROBLEM_TYPE_REGISTRY,
    get_item_discrimination,
    get_prior_beta,
)

ROOT = Path(__file__).resolve().parents[3]
PILOT = ROOT / "backend" / "reports" / "graph-jev-pilot-2026-10-11"
MASTERY_MARGIN = 1.4  # theta - beta at which a 2PL item with a=1 gives P = 0.80


@dataclass
class Item:
    node: int
    mode: str
    beta: float
    a: float
    c: float


@dataclass
class Node:
    key: str
    sid: str
    grade: str
    label: str
    skill: str
    unit: str
    primitive: str
    items: List[Item] = field(default_factory=list)
    beta_med: float = 3.0


@dataclass
class Graph:
    nodes: List[Node]
    index: Dict[str, int]
    parents: List[List[int]]        # model edges
    weights: List[List[float]]      # Jev score per model edge
    truth_parents: List[List[int]]
    truth_scores: List[List[float]]
    items: List[Item]
    step: Dict[Tuple[int, int], float]   # Jev `step` score per scored pair

    def required(self, k: int, min_step: float) -> List[int]:
        """Task-graph row for an item of node k: k plus every model parent
        Jev scores as a step performed inside k."""
        return [k] + [p for p in self.parents[k] if self.step.get((p, k), 0.0) >= min_step]

    @property
    def n(self) -> int:
        return len(self.nodes)

    def topo(self, parents: List[List[int]]) -> List[int]:
        seen, order = set(), []

        def visit(i: int) -> None:
            if i in seen:
                return
            seen.add(i)
            for p in parents[i]:
                visit(p)
            order.append(i)

        for i in range(self.n):
            visit(i)
        return order


def _modes(raw: dict) -> List[str]:
    em = raw.get("eval_modes")
    if isinstance(em, str):
        try:
            em = ast.literal_eval(em)
        except (ValueError, SyntaxError):
            em = None
    if em:
        return list(em)
    return list(PROBLEM_TYPE_REGISTRY.get(raw.get("primitive_type") or "", {}).keys()) or ["default"]


def _dag(n: int, scored: List[Tuple[float, int, int]], cap: int | None) -> Tuple[List[List[int]], List[List[float]]]:
    parents: List[List[int]] = [[] for _ in range(n)]
    scores: List[List[float]] = [[] for _ in range(n)]
    children: List[List[int]] = [[] for _ in range(n)]

    def reaches(a: int, b: int) -> bool:  # is b reachable from a along child links
        stack, seen = [a], {a}
        while stack:
            x = stack.pop()
            if x == b:
                return True
            for y in children[x]:
                if y not in seen:
                    seen.add(y)
                    stack.append(y)
        return False

    for s, a, b in sorted(scored, reverse=True):
        if cap is not None and len(parents[b]) >= cap:
            continue
        if reaches(b, a):
            continue
        parents[b].append(a)
        scores[b].append(s)
        children[a].append(b)
    return parents, scores


SCOPE = {"LANGUAGE_ARTS": ("GK", "G1"), "MATHEMATICS": ("GK", "G1", "G2")}  # what the 10-11 pilot scored


def load(subject: str = "LANGUAGE_ARTS", grades=None, min_score: float = 0.6, max_parents: int = 3) -> Graph:
    grades = grades or SCOPE[subject]
    base = json.loads((PILOT / "baseline_graphs.json").read_text(encoding="utf-8"))
    jev = json.loads((PILOT / "jev_answers.json").read_text(encoding="utf-8"))

    nodes: List[Node] = []
    for g in grades:
        for raw in base[f"{subject}_{g}"]["nodes"]:
            nodes.append(Node(key=f"{g}:{raw['id']}", sid=raw["id"], grade=g, label=raw["label"],
                              skill=f"{g}:{raw.get('skill_id')}", unit=f"{g}:{raw.get('unit_id')}",
                              primitive=raw.get("primitive_type") or ""))
            nodes[-1]._modes = _modes(raw)  # type: ignore[attr-defined]
    index = {n.key: i for i, n in enumerate(nodes)}

    items: List[Item] = []
    for i, nd in enumerate(nodes):
        for m in nd._modes:  # type: ignore[attr-defined]
            a, c = get_item_discrimination(nd.primitive, m)
            nd.items.append(Item(node=i, mode=m, beta=get_prior_beta(nd.primitive, m), a=a, c=c))
        nd.beta_med = statistics.median(it.beta for it in nd.items)
        items.extend(nd.items)

    scored: Dict[Tuple[int, int], float] = {}
    step: Dict[Tuple[int, int], float] = {}
    for v in jev.values():
        if v.get("subject") != subject:
            continue
        a = index.get(f"{v['source_grade']}:{v['source']}")
        b = index.get(f"{v['target_grade']}:{v['target']}")
        if a is None or b is None or a == b:
            continue
        step[(a, b)] = v.get("step", 0.0)
        s = max(v.get("step", 0.0), v.get("easier_form", 0.0))
        if s >= min_score:
            scored[(a, b)] = s
    # a pair scored both ways keeps its stronger direction
    pairs = [(s, a, b) for (a, b), s in scored.items() if s >= scored.get((b, a), 0.0)]

    mp, mw = _dag(len(nodes), pairs, max_parents)
    tp, ts = _dag(len(nodes), pairs, None)
    return Graph(nodes=nodes, index=index, parents=mp, weights=mw,
                 truth_parents=tp, truth_scores=ts, items=items, step=step)


if __name__ == "__main__":
    g = load()
    me = sum(len(p) for p in g.parents)
    te = sum(len(p) for p in g.truth_parents)
    print(f"{g.n} subskills, {len(g.items)} items, model edges {me}, truth edges {te}")
    print("roots (no model parent):", sum(1 for p in g.parents if not p))
    k = g.index.get("G1:LA001-01-a")
    if k is not None:
        print("G1 LA001-01-a parents:")
        for p, w in zip(g.parents[k], g.weights[k]):
            print(f"  {w:.2f}  {g.nodes[p].key[:40]}  {g.nodes[p].label[:70]!r}")
