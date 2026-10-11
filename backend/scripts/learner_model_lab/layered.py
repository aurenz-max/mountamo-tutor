"""
Two-layer learner model: IRT measures, the graph decides.

Measurement layer (per subskill k)
    theta_k on the production grid 0-10 (101 points). Each review updates it
    with the production likelihood (P^x (1-P)^(1-x))^n, P = 3PL with the
    item's own registry a, beta, c; x = first-try fraction, n = testlet
    count. A little diffusion per review lets ability grow.

Interface
    Mastery is defined on the IRT scale: K_k = 1  <=>  theta_k >= tau_k,
    tau_k = the subskill's median item beta + 1.4 (80% on its typical item).
    UP: the graph receives one number per subskill, the data's likelihood
        ratio  [mass of L x base above tau / base mass above tau] /
                [mass of L x base below tau / base mass below tau]
        It never sees primitives, betas or retries.
    DOWN: when the child first meets k, theta_k's prior is the base
        distribution reshaped by the graph's current P(K_k): mass above tau
        gets P(K_k), mass below gets 1 - P(K_k). Mastered prerequisites
        therefore raise the expected starting point on the next subskill.
        Base = N(mean of already-seen sibling subskills, else the graph's
        current estimate of general ability phi, sd 2.0).

Knowledge layer
    The BayesEngine graph (phi, K, prerequisite weights, practice-aware
    readiness), with each subskill's evidence entering as log LR_k.

Prediction of an item uses theta_k only (pure IRT). Choosing what to teach
uses the graph frontier with unlock value; within the chosen subskill the
item the child most likely gets right.
"""

from __future__ import annotations

from typing import Dict, List

import numpy as np

from . import bayes as B
from .bayes import BayesEngine, sig
from .graph import MASTERY_MARGIN, Graph, Item

TH = np.linspace(0.0, 10.0, 101)
BASE_MEAN, BASE_SD = 3.0, 2.0
DIFFUSION_SD = 0.2
WITHIN = "value"   # item choice inside the chosen subskill: "value" (look-ahead) or "easiest"


def _normal(mean: float, sd: float) -> np.ndarray:
    p = np.exp(-0.5 * ((TH - mean) / sd) ** 2)
    return p / p.sum()


def p_item(a: float, beta: float, c: float) -> np.ndarray:
    return np.clip(c + (1 - c) * sig(a * (TH - beta)), 1e-6, 1 - 1e-6)


class LayeredEngine(BayesEngine):
    name = "layered"

    def __init__(self, g: Graph, chains: int = 256, seed: int = 0, sweeps: int = 6, learn: bool = True):
        super().__init__(g, chains=chains, seed=seed, sweeps=sweeps, learn=learn)
        self.tau = self.bmed + MASTERY_MARGIN
        self.above = TH[None, :] >= self.tau[:, None]           # (n, grid)
        self.post: Dict[int, np.ndarray] = {}                    # theta_k posterior, touched subskills
        self.base: Dict[int, np.ndarray] = {}
        self.loglik: Dict[int, np.ndarray] = {}                  # accumulated log L(theta_k)
        self.lr = np.zeros(g.n)                                  # log LR per subskill, read by the graph
        # subskills with evidence plus their ancestors; every other subskill is
        # barren (no evidence at or below it) and integrates out of phi exactly
        self.relevant: set = set()
        self._order = g.topo(g.parents)

    # ── interface ───────────────────────────────────────────────────────────
    def _base(self, k: int) -> np.ndarray:
        sk = self.g.nodes[k].skill
        sib = [float((TH * p).sum()) for j, p in self.post.items() if self.g.nodes[j].skill == sk]
        return _normal(float(np.mean(sib)) if sib else float(B.PHI[self.f].mean()), BASE_SD)

    def _prior(self, k: int) -> np.ndarray:
        """DOWN: base reshaped by the graph's current belief that k is mastered."""
        base = self._base(k)
        pk = float(self.K[:, k].mean())
        up = self.above[k]
        b1, b0 = base[up].sum(), base[~up].sum()
        if b1 < 1e-9 or b0 < 1e-9:
            return base
        return np.where(up, base * pk / b1, base * (1 - pk) / b0)

    def theta_dist(self, k: int) -> np.ndarray:
        return self.post[k] if k in self.post else self._prior(k)

    def _update_lr(self, k: int) -> None:
        """UP: likelihood ratio of k's data for mastered vs not, against the base."""
        L = np.exp(self.loglik[k] - self.loglik[k].max())
        base, up = self.base[k], self.above[k]
        b1, b0 = base[up].sum(), base[~up].sum()
        m1, m0 = (L * base)[up].sum(), (L * base)[~up].sum()
        if min(b1, b0, m1, m0) < 1e-300:
            self.lr[k] = 20.0 if m0 < 1e-300 else -20.0
        else:
            self.lr[k] = float(np.clip(np.log(m1 / b1) - np.log(m0 / b0), -20, 20))

    def _mark_relevant(self, k: int) -> None:
        stack = [k]
        while stack:
            x = stack.pop()
            if x in self.relevant:
                continue
            self.relevant.add(x)
            stack.extend(self.g.parents[x])

    def _gibbs_phi(self) -> None:
        """phi given the relevant subskills only (barren ones sum out exactly)."""
        rel = np.array(sorted(self.relevant), dtype=int)
        lp = self.logphi[None, :] + (self._prior_terms()[:, :, rel].sum(axis=2) if len(rel) else 0.0)
        lp -= lp.max(axis=1, keepdims=True)
        pr = np.exp(lp)
        pr /= pr.sum(axis=1, keepdims=True)
        u = self.rng.random((self.C, 1))
        self.f = (pr.cumsum(axis=1) < u).sum(axis=1).clip(0, len(B.PHI) - 1)

    def _redraw_barren(self) -> None:
        """Exact draw of every barren subskill from its prior given phi and parents."""
        phi = B.PHI[self.f]
        for k in self._order:
            if k not in self.relevant:
                self.K[:, k] = (self.rng.random(self.C) < self._pk(k, phi)).astype(float)
                self._dirty.add(k)

    # ── graph Gibbs: evidence enters as log LR ─────────────────────────────
    def _gibbs_node(self, k: int) -> None:
        K, phi = self.K, B.PHI[self.f]
        old = K[:, k].copy()
        pk = self._pk(k, phi)
        d = np.log(pk) - np.log1p(-pk) + self.lr[k]
        for c in self.ch[k]:
            kc = K[:, c] > 0.5
            K[:, k] = 1.0
            p1 = self._pk(c, phi)
            K[:, k] = 0.0
            p0 = self._pk(c, phi)
            d = d + np.where(kc, np.log(p1) - np.log(p0), np.log1p(-p1) - np.log1p(-p0))
        K[:, k] = old
        K[:, k] = (self.rng.random(self.C) < sig(d)).astype(float)
        self._dirty.add(k)
        self._dirty.update(self.ch[k])

    # ── engine interface ────────────────────────────────────────────────────
    def predict(self, it: Item) -> float:
        return float((self.theta_dist(it.node) * p_item(it.a, it.beta, it.c)).sum())

    def observe(self, it: Item, score: float, n: float = 1.0) -> None:
        k = it.node
        if k not in self.post:
            self.base[k] = self._base(k)
            self.post[k] = self._prior(k)
            self.loglik[k] = np.zeros_like(TH)
        x = score / 10.0
        P = p_item(it.a, it.beta, it.c)
        ll = n * (x * np.log(P) + (1 - x) * np.log1p(-P))
        self.loglik[k] = self.loglik[k] + ll
        post = self.post[k] * np.exp(ll - ll.max())
        post /= post.sum()
        # diffusion: ability can move between reviews
        off = np.arange(-10, 11) * (TH[1] - TH[0])
        kern = np.exp(-0.5 * (off / DIFFUSION_SD) ** 2)
        post = np.convolve(post, kern / kern.sum(), mode="same")
        self.post[k] = post / post.sum()
        self._update_lr(k)
        self._mark_relevant(k)
        local = sorted(({k} | set(self.g.parents[k]) | set(self.ch[k])) & self.relevant)
        for _ in range(self.sweeps):
            self.sweep(local)
        self._n_obs = getattr(self, "_n_obs", 0) + 1
        if self._n_obs % 5 == 0:
            for _ in range(2):
                self.sweep(sorted(self.relevant))
        if self.learn:
            self.nprac[k] += 1
            self._dirty.add(k)
            self.sweep(local)
        self._redraw_barren()

    def _item_split(self):
        """Per item: P(right | k mastered) and P(right | not), from theta_k."""
        p1 = np.empty(len(self._items))
        p0 = np.empty(len(self._items))
        cache: Dict[int, np.ndarray] = {}
        for j, it in enumerate(self._items):
            k = it.node
            if k not in cache:
                cache[k] = self.theta_dist(k)
            d, up = cache[k], self.above[k]
            P = p_item(it.a, it.beta, it.c)
            m1, m0 = d[up].sum(), d[~up].sum()
            p1[j] = (d * P)[up].sum() / m1 if m1 > 1e-12 else P[up].mean()
            p0[j] = (d * P)[~up].sum() / m0 if m0 > 1e-12 else P[~up].mean()
        return p1, p0

    def select_value(self, items: List[Item]) -> Item:
        assert items is self._items
        p1, p0 = self._item_split()
        Kn = self.K[:, self._node_of]                                     # (C, I)
        P = np.clip(Kn * p1[None, :] + (1 - Kn) * p0[None, :], 1e-6, 1 - 1e-6)
        V = self.teach_value()
        vnow = V.mean(axis=0)
        W1 = P / P.sum(axis=0, keepdims=True)
        W0 = (1 - P) / (1 - P).sum(axis=0, keepdims=True)
        pbar = P.mean(axis=0)
        value = B.LAMBDA * (vnow[self._node_of] + pbar * (W1.T @ V).max(axis=1)
                            + (1 - pbar) * (W0.T @ V).max(axis=1) - vnow.max())
        if WITHIN == "value":
            return self._items[int(value.argmax())]
        k = self._node_of[int(value.argmax())]
        same = np.nonzero(self._node_of == k)[0]
        return self._items[int(same[pbar[same].argmax()])]
