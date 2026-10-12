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
from typing import Dict, List, Optional, Tuple

from app.services.calibration.problem_type_registry import (
    PROBLEM_TYPE_REGISTRY,
    get_item_discrimination,
    get_prior_beta,
)

ROOT = Path(__file__).resolve().parents[3]
PILOT = ROOT / "backend" / "reports" / "graph-jev-pilot-2026-10-11"
MASTERY_MARGIN = 1.4  # theta - beta at which a 2PL item with a=1 gives P = 0.80

# Skill location (7.13). A subskill's beta used to be the median registry
# beta of its primitive's modes: how hard the ACTIVITY is, the same for a K
# and a G4 skill served by one primitive. With ANCHOR on, a subskill sits at
# its grade's place on the 0-10 scale, and an item's beta is that location
# plus the mode's offset from its primitive's median (the registry keeps
# ordering modes; it no longer places the skill).
#   off    registry beta (before 7.13)
#   grade  GRADE_BASE + GRADE_STEP x grade index
#   depth  grade, plus a within-grade offset from the subskill's depth in the
#          same-grade prerequisite graph, spread over DEPTH_SPREAD x GRADE_STEP
#   blend  grade, plus ACTIVITY_WEIGHT x how far the primitive's registry
#          median sits from its grade's typical one (an easy activity placed
#          at G3 sits below the G3 anchor)
ANCHOR = "off"
GRADE_BASE = 2.5      # K: the median registry beta of the K subskills
GRADE_STEP = 1.0
DEPTH_SPREAD = 0.8
ACTIVITY_WEIGHT = 0.5
ACTIVITY_CAP = 1.5
MODE_OFFSET_CAP = 1.0
GRADE_INDEX = {"GK": 0, "G1": 1, "G2": 2, "G3": 3, "G4": 4, "G5": 5}


@dataclass
class Item:
    node: int
    mode: str
    beta: float
    a: float
    c: float
    raw_beta: Optional[float] = None   # registry beta, for today's engine when ANCHOR is on


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
    raw_beta_med: float = 3.0


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
    easier: Dict[Tuple[int, int], float] = field(default_factory=dict)  # Jev `easier_form` per pair
    anchored: bool = False
    cond: Dict[Tuple[int, int], Tuple[float, float]] = field(default_factory=dict)  # (parent, child) -> (P right | parent not known, P right | parent known, child untaught)

    def make_item(self, k: int, primitive: str, mode: str) -> Item:
        """The item a review of subskill k on (primitive, mode) is, on this graph's scale."""
        a, c = get_item_discrimination(primitive, mode)
        raw = get_prior_beta(primitive, mode)
        if not self.anchored:
            return Item(node=k, mode=mode, beta=raw, a=a, c=c, raw_beta=raw)
        return Item(node=k, mode=mode, beta=self.nodes[k].beta_med + mode_offset(primitive, mode), a=a, c=c, raw_beta=raw)

    def easier_children(self, j: int, parents: List[List[int]], min_easier: float = 0.6, max_step: float = 0.8) -> List[Tuple[int, float]]:
        """Subskills that are a harder version of j (E edges, not R): (child, easier score)."""
        return [(k, self.easier[(j, k)]) for k in range(self.n) if j in parents[k]
                and self.easier.get((j, k), 0.0) >= min_easier and self.step.get((j, k), 0.0) < max_step]

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


def mode_offset(primitive: str, mode: str) -> float:
    """A mode's beta relative to its primitive's median mode, capped."""
    modes = PROBLEM_TYPE_REGISTRY.get(primitive) or {}
    if not modes:
        return 0.0
    med = statistics.median(cfg.prior_beta for cfg in modes.values())
    off = get_prior_beta(primitive, mode) - med
    return max(-MODE_OFFSET_CAP, min(MODE_OFFSET_CAP, off))


def _same_grade_depth(nodes, parents) -> List[float]:
    """Per subskill, its longest same-grade prerequisite chain, scaled 0-1 within its grade."""
    memo: Dict[int, int] = {}

    def d(i: int) -> int:
        if i not in memo:
            memo[i] = 0
            memo[i] = max((1 + d(p) for p in parents[i] if nodes[p].grade == nodes[i].grade), default=0)
        return memo[i]

    raw = [d(i) for i in range(len(nodes))]
    top: Dict[str, int] = {}
    for i, nd in enumerate(nodes):
        top[nd.grade] = max(top.get(nd.grade, 0), raw[i])
    return [raw[i] / top[nd.grade] if top[nd.grade] else 0.5 for i, nd in enumerate(nodes)]


def _activity_dev(nodes) -> List[float]:
    """Per subskill, its primitive's registry median minus its grade's typical
    one, capped. Primitives whose registry betas are already relative to the
    skill (practice-problem derive_*, median <= 0.5) carry no deviation."""
    absolute = [nd.raw_beta_med > 0.5 for nd in nodes]
    med: Dict[str, float] = {}
    for gr in GRADE_INDEX:
        bs = [nd.raw_beta_med for nd, ab in zip(nodes, absolute) if ab and nd.grade == gr]
        med[gr] = statistics.median(bs) if bs else 0.0
    return [max(-ACTIVITY_CAP, min(ACTIVITY_CAP, nd.raw_beta_med - med[nd.grade])) if ab else 0.0
            for nd, ab in zip(nodes, absolute)]


def _anchor(nodes, parents) -> None:
    depth = _same_grade_depth(nodes, parents) if ANCHOR == "depth" else [0.5] * len(nodes)
    dev = _activity_dev(nodes) if ANCHOR == "blend" else [0.0] * len(nodes)
    for i, nd in enumerate(nodes):
        loc = GRADE_BASE + GRADE_STEP * GRADE_INDEX[nd.grade] + ACTIVITY_WEIGHT * dev[i]
        if ANCHOR == "depth":
            loc += DEPTH_SPREAD * GRADE_STEP * (depth[i] - 0.5)
        nd.beta_med = loc
        for it in nd.items:
            it.beta = loc + mode_offset(nd.primitive, it.mode)


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


SCOPE = {  # grades scored by Jev (all published grades as of 10-11)
    "MATHEMATICS": ("GK", "G1", "G2", "G3", "G4", "G5"),
    "LANGUAGE_ARTS": ("GK", "G1", "G2", "G3", "G4", "G5"),
    "SCIENCE": ("GK", "G1", "G2", "G3", "G4"),
    "SOCIAL_STUDIES": ("GK", "G1", "G2", "G3", "G4"),
}


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
            b = get_prior_beta(nd.primitive, m)
            nd.items.append(Item(node=i, mode=m, beta=b, a=a, c=c, raw_beta=b))
        nd.beta_med = nd.raw_beta_med = statistics.median(it.beta for it in nd.items)
        items.extend(nd.items)

    scored: Dict[Tuple[int, int], float] = {}
    step: Dict[Tuple[int, int], float] = {}
    easier: Dict[Tuple[int, int], float] = {}
    for v in jev.values():
        if v.get("subject") != subject:
            continue
        a = index.get(f"{v['source_grade']}:{v['source']}")
        b = index.get(f"{v['target_grade']}:{v['target']}")
        if a is None or b is None or a == b:
            continue
        step[(a, b)] = v.get("step", 0.0)
        easier[(a, b)] = v.get("easier_form", 0.0)
        s = max(v.get("step", 0.0), v.get("easier_form", 0.0))
        if s >= min_score:
            scored[(a, b)] = s
    # a pair scored both ways keeps its stronger direction
    pairs = [(s, a, b) for (a, b), s in scored.items() if s >= scored.get((b, a), 0.0)]

    mp, mw = _dag(len(nodes), pairs, max_parents)
    tp, ts = _dag(len(nodes), pairs, None)
    if ANCHOR != "off":
        _anchor(nodes, mp)
    cond = {}
    cpath = PILOT / f"jev_conditionals_{subject.lower()}.json"
    if cpath.exists():
        for v in json.loads(cpath.read_text(encoding="utf-8")).values():
            a, b = index.get(v["parent"]), index.get(v["target"])
            if a is not None and b is not None:
                cond[(a, b)] = (v["p_without"], v["p_with"])
    return Graph(nodes=nodes, index=index, parents=mp, weights=mw,
                 truth_parents=tp, truth_scores=ts, items=items, step=step, easier=easier,
                 anchored=ANCHOR != "off", cond=cond)


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
