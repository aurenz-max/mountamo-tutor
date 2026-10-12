"""
Simple learner model (7.13): per-subskill IRT for evidence, knowledge-space
rules on the Jev graph for everything else. No general-ability shortcut and no
fitted link probabilities.

Measurement
    theta_k on the 0-10 grid per subskill, updated from the subskill's own
    reviews with the item's registry a, beta, c (the layered engine's
    measurement layer). Evidenced subskill: known <=> P(theta_k >= tau_k) > 0.5,
    tau_k = median item beta + 1.4.

Knowledge state (rules over R edges: Jev step >= 0.8)
    1. A subskill with evidence is known or not by its own evidence.
    2. Success closes downward: the R prerequisites of a known subskill are
       known (whoever does 5x5 by repeated addition can add repeatedly; a
       miss on the prerequisite itself overrides this, rule 1).
    3. Failure closes upward: R descendants of a subskill with failing
       evidence are not presumed known.
    4. An untouched subskill BELOW the grade of record is presumed known when
       all its R prerequisites are known (earlier grades were taught). At or
       above the grade of record, nothing is presumed: it needs evidence.
    Ready to learn: not known, every R prerequisite known, and either within
    one grade of the grade of record or already attempted.

Prediction for a subskill's first item: theta prior N(mu, 2), mu = mean of
the same skill's seen subskills, else of all seen subskills; raised to tau_k
when the rules say known, lowered to the subskill's median beta when it sits
above the grade of record and is not known (not taught yet).
"""

from __future__ import annotations

from typing import Dict, List

import numpy as np

from .graph import GRADE_INDEX, MASTERY_MARGIN, Graph, Item

TH = np.linspace(0.0, 10.0, 101)
PRIOR_MEAN, PRIOR_SD = 3.0, 2.0
DIFFUSION_SD = 0.2
MIN_STEP = 0.8
WINDOW = 1          # ready: up to this many grades above the grade of record


def _normal(mean: float, sd: float) -> np.ndarray:
    p = np.exp(-0.5 * ((TH - mean) / sd) ** 2)
    return p / p.sum()


def _p(a: float, beta: float, c: float) -> np.ndarray:
    return np.clip(c + (1 - c) / (1 + np.exp(-a * (TH - beta))), 1e-6, 1 - 1e-6)


class SimpleEngine:
    name = "simple"

    def __init__(self, g: Graph, grade: int = 0):
        self.g, self.grade = g, grade
        n = g.n
        self.tau = np.array([nd.raw_beta_med + MASTERY_MARGIN for nd in g.nodes])
        self.bmed = np.array([nd.raw_beta_med for nd in g.nodes])
        self.gi = np.array([GRADE_INDEX[nd.grade] for nd in g.nodes])
        self.rpa = [[p for p in g.required(k, MIN_STEP) if p != k] for k in range(n)]
        self.rch: List[List[int]] = [[] for _ in range(n)]
        for k, ps in enumerate(self.rpa):
            for p in ps:
                self.rch[p].append(k)
        self.order = g.topo(self.rpa)
        self.post: Dict[int, np.ndarray] = {}
        self._state = None

    # ── measurement ─────────────────────────────────────────────────────────
    def _evidence(self) -> Dict[int, float]:
        return {k: float(p[TH >= self.tau[k]].sum()) for k, p in self.post.items()}

    def _prior(self, k: int) -> np.ndarray:
        means = {j: float((TH * p).sum()) for j, p in self.post.items()}
        sk = self.g.nodes[k].skill
        sib = [m for j, m in means.items() if self.g.nodes[j].skill == sk]
        mu = float(np.mean(sib)) if sib else float(np.mean(list(means.values()))) if means else PRIOR_MEAN
        known, _ = self.state()
        if known[k]:
            mu = max(mu, self.tau[k])
        elif self.gi[k] > self.grade:
            mu = min(mu, self.bmed[k])
        return _normal(mu, PRIOR_SD)

    def predict(self, it: Item) -> float:
        k = it.node
        dist = self.post[k] if k in self.post else self._prior(k)
        return float((dist * _p(it.a, it.beta, it.c)).sum())

    def observe(self, it: Item, score: float, n: float = 1.0) -> None:
        k = it.node
        if k not in self.post:
            self.post[k] = self._prior(k)
        x = score / 10.0
        P = _p(it.a, it.beta, it.c)
        ll = n * (x * np.log(P) + (1 - x) * np.log1p(-P))
        post = self.post[k] * np.exp(ll - ll.max())
        off = np.arange(-10, 11) * (TH[1] - TH[0])
        kern = np.exp(-0.5 * (off / DIFFUSION_SD) ** 2)
        post = np.convolve(post / post.sum(), kern / kern.sum(), mode="same")
        self.post[k] = post / post.sum()
        self._state = None

    # ── knowledge state ─────────────────────────────────────────────────────
    def state(self):
        """(known, ready) boolean arrays over every subskill."""
        if self._state is not None:
            return self._state
        n = self.g.n
        ev = self._evidence()
        known = np.zeros(n, bool)
        blocked = np.zeros(n, bool)
        stack = [k for k, p in ev.items() if p > 0.5]
        while stack:                                    # rule 2
            k = stack.pop()
            if known[k]:
                continue
            known[k] = True
            stack.extend(self.rpa[k])
        stack = [k for k, p in ev.items() if p <= 0.5]
        for k in stack:                                 # rule 1 wins over rule 2
            known[k] = False
        while stack:                                    # rule 3
            k = stack.pop()
            for c in self.rch[k]:
                if not blocked[c] and c not in ev:
                    blocked[c] = True
                    stack.append(c)
        for k in self.order:                            # rule 4
            if (k not in ev and not known[k] and not blocked[k] and self.gi[k] < self.grade
                    and all(known[p] for p in self.rpa[k])):
                known[k] = True
        rp_known = np.array([all(known[p] for p in self.rpa[k]) for k in range(n)])
        reach = (self.gi <= self.grade + WINDOW) | np.isin(np.arange(n), list(ev))
        ready = ~known & rp_known & reach
        self._state = (known, ready)
        return self._state

    def mastery(self) -> List[float]:
        ev = self._evidence()
        known, _ = self.state()
        return [ev[k] if k in ev else float(known[k]) for k in range(self.g.n)]

    def ready(self) -> np.ndarray:
        return self.state()[1]
