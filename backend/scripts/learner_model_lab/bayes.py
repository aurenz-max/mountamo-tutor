"""
Bayesian learner model over the subskill graph (lab version).

    phi ~ N(4.5, 2.5) on the 0-10 grid       general literacy ability
    logit P(K_k = 1) = (phi - beta_k) + sum_parents w_jk (K_j - 1)
        beta_k = the subskill's median item beta; w_jk = 3 x Jev score.
        With every parent mastered, P(K_k) = 0.80 at phi = beta_k + 1.4,
        the same point the truth model calls mastery.
    item of subskill k requires k plus every parent Jev scores as a step
    inside k (step >= 0.8). The task graph comes from the structural graph.
    P(right) = c + (1 - c - s) sigma(a (phi_eff - beta)), s = 0.05
        phi_eff = max(phi, beta_k + 1.4) if every required subskill is
        mastered, else min(phi, beta_k + 0.7)
    likelihood of a 0-10 score: P^x (1-P)^(1-x), x = score / 10 (the same
    continuous weighting production uses)

Inference: 256 persistent Gibbs chains over (phi, K). Each answer reweights the
chains through Gibbs sweeps over the subskills near the item; every 10 answers
one full sweep. `check` in run.py compares this with exact enumeration on a
small subgraph.

Selection (`select`): the expected information an item's answer carries
about the subskills it involves, estimated from the chains.

Selection (`select_value`): expected learning. The frontier of subskill k is
    f(k) = P(K_k = 0 and every R prerequisite of k mastered)
the subskills a child is ready to learn but has not. Serving an item of k
teaches L = LAMBDA * f(k). An item's value is its own L plus how much its
answer raises the best L available next (one-step look-ahead, computed by
reweighting the chains by P(answer | chain)). Information counts only when
it changes what gets taught next.

Learning over time: each practice item on k gives a READY child (every R
prerequisite mastered) a LAMBDA chance of mastering k, so after n practices
    P(K_k = 1 | ready) = 1 - (1 - prior)(1 - LAMBDA)^n
Repeated failure after practice is then evidence that a prerequisite is
missing, which moves the frontier down to it. Older answers on k keep weight
GAMMA per later practice, so early failures stop counting against later
mastery.
"""

from __future__ import annotations

from typing import Dict, List

import numpy as np

from .graph import MASTERY_MARGIN, Graph, Item

PHI = np.arange(0.0, 11.0, 1.0)
PHI_MEAN, PHI_SD = 4.5, 2.5
W_SCALE = 3.0
MIN_STEP = 0.8
NONMASTER_HEADROOM = 0.7
LAMBDA = 0.15        # P(one practice item moves a ready, unmastered child to mastery); expert prior
GAMMA = 0.85         # weight kept by older answers on a subskill each time it is practised again
SLIP = 0.05          # a 9/10 from a master is not evidence against mastery


def logsig(x):
    return -np.logaddexp(0.0, -x)


def sig(x):
    return 1.0 / (1.0 + np.exp(-x))


def resp_arr(mastered, phi, beta_k, beta, a, c):
    """P(right) given a mastered indicator and ability; every argument broadcasts."""
    eff = np.where(mastered, np.maximum(phi, beta_k + MASTERY_MARGIN), np.minimum(phi, beta_k + NONMASTER_HEADROOM))
    p = c + (1 - c - SLIP) * sig(a * (eff - beta))
    return np.clip(p, 1e-6, 1 - 1e-6)


def resp(mastered, phi, beta_k, it: Item):
    return resp_arr(mastered, phi, beta_k, it.beta, it.a, it.c)


def _pad(rows, fill):
    width = max(1, max((len(r) for r in rows), default=1))
    out = np.full((len(rows), width), fill, dtype=float if isinstance(fill, float) else int)
    for i, r in enumerate(rows):
        out[i, :len(r)] = r
    return out


def ll(x, p):
    return x * np.log(p) + (1 - x) * np.log(1 - p)


class BayesEngine:
    name = "bayes"

    def __init__(self, g: Graph, chains: int = 256, seed: int = 0, sweeps: int = 6, learn: bool = True):
        self.g, self.C, self.sweeps, self.learn = g, chains, sweeps, learn
        n = g.n
        self.rng = np.random.default_rng(seed)
        self.bmed = np.array([nd.beta_med for nd in g.nodes])
        self.pa = [np.array(p, dtype=int) for p in g.parents]
        self.w = [W_SCALE * np.array(w, dtype=float) for w in g.weights]
        self.ch: List[List[int]] = [[] for _ in range(n)]
        for k, ps in enumerate(g.parents):
            for p in ps:
                self.ch[p].append(k)
        self.req = [np.array(g.required(k, MIN_STEP), dtype=int) for k in range(n)]
        self.rpa = [r[r != k] for k, r in enumerate(self.req)]
        self.nprac = np.zeros(n)
        self._dirty = set(range(n))
        self._node_of = np.array([it.node for it in g.items])
        self._ix = {id(it): j for j, it in enumerate(g.items)}
        self._it_beta = np.array([it.beta for it in g.items])
        self._it_a = np.array([it.a for it in g.items])
        self._it_c = np.array([it.c for it in g.items])
        # padded index tables; index n points at a constant-1 column
        self._R = _pad(self.req, n)
        self._RP = _pad(self.rpa, n)
        self._PA = _pad(self.pa, n)
        self._PW = _pad(self.w, 0.0)
        lp = -0.5 * ((PHI - PHI_MEAN) / PHI_SD) ** 2
        self.logphi = lp - np.logaddexp.reduce(lp)
        self.obs: List[Dict] = []
        self.obs_by_node: List[List[Dict]] = [[] for _ in range(n)]
        # answers on the same item type of the same subskill share one likelihood:
        # sum of w*x and w*(1-x) per group, so cost grows with item types, not history
        self._groups: Dict[tuple, Dict] = {}
        self._gby: List[List[tuple]] = [[] for _ in range(n)]
        # exact forward draws from the prior
        self.f = self.rng.choice(len(PHI), size=self.C, p=np.exp(self.logphi))
        self.K = np.zeros((self.C, n))
        for k in g.topo(g.parents):
            self.K[:, k] = self.rng.random(self.C) < sig(self._z(k))
        # item targets for selection: required set plus their parents
        self._items = g.items
        tgt = np.zeros((n, len(g.items)))
        for j, it in enumerate(g.items):
            r = self.req[it.node]
            for t in set(r.tolist()) | {p for q in r for p in g.parents[q]}:
                tgt[t, j] = 1.0
        self._tgt = tgt

    # ── model pieces ──────────────────────────────────────────────────────
    def _z(self, k: int, phi=None):
        phi = PHI[self.f] if phi is None else phi
        z = phi - self.bmed[k]
        if len(self.pa[k]):
            z = z + (self.K[:, self.pa[k]] - 1.0) @ self.w[k]
        return z

    def _ready(self, k: int):
        if not len(self.rpa[k]):
            return np.ones(self.C, bool)
        return self.K[:, self.rpa[k]].prod(axis=1) > 0.5

    def _pk(self, k: int, phi):
        """P(K_k = 1 | parents, ability, practice so far)."""
        p = sig(self._z(k, phi))
        if self.learn and self.nprac[k]:
            p = np.where(self._ready(k), 1 - (1 - p) * (1 - LAMBDA) ** self.nprac[k], p)
        return np.clip(p, 1e-9, 1 - 1e-9)

    def _kpad(self):
        return np.hstack([self.K, np.ones((self.C, 1))])

    def node_mastered(self):
        """(C, n): every subskill an item of k requires is mastered."""
        return self._kpad()[:, self._R].prod(axis=2)

    def _mastered(self, it: Item, K=None):
        K = self.K if K is None else K
        return K[:, self.req[it.node]].prod(axis=1) > 0.5

    # ── Gibbs ─────────────────────────────────────────────────────────────
    def _gibbs_node(self, k: int) -> None:
        K, phi = self.K, PHI[self.f]
        old = K[:, k].copy()
        pk = self._pk(k, phi)
        d = np.log(pk) - np.log1p(-pk)
        for c in self.ch[k]:
            kc = K[:, c] > 0.5
            K[:, k] = 1.0
            p1 = self._pk(c, phi)
            K[:, k] = 0.0
            p0 = self._pk(c, phi)
            d = d + np.where(kc, np.log(p1) - np.log(p0), np.log1p(-p1) - np.log1p(-p0))
        for key in self._gby[k]:
            gr = self._groups[key]
            others = gr["req"][gr["req"] != k]
            mo = K[:, others].prod(axis=1) > 0.5 if len(others) else np.ones(self.C, bool)
            p1 = resp(mo, phi, gr["bk"], gr["it"])
            p0 = resp(np.zeros(self.C, bool), phi, gr["bk"], gr["it"])
            d = d + gr["sx"] * (np.log(p1) - np.log(p0)) + gr["s1x"] * (np.log1p(-p1) - np.log1p(-p0))
        K[:, k] = old
        K[:, k] = (self.rng.random(self.C) < sig(d)).astype(float)
        # log P(K_c | parents, phi) changes for k and its children only
        self._dirty.add(k)
        self._dirty.update(self.ch[k])

    def _prior_terms(self) -> np.ndarray:
        """(C, |PHI|, n) log P(K_k | parents, phi = each grid point, practice).
        Independent of the current phi, so it is cached and only the columns
        whose subskill or parents changed are recomputed."""
        if not hasattr(self, "_lpri"):
            self._lpri = np.zeros((self.C, len(PHI), self.g.n))
        if self._dirty:
            cols = np.array(sorted(self._dirty))
            self._dirty = set()
            ps = ((self._kpad()[:, self._PA[cols]] - 1.0) * self._PW[cols][None]).sum(axis=2)
            P = sig(PHI[None, :, None] - self.bmed[cols][None, None, :] + ps[:, None, :])
            if self.learn:
                for i, k in enumerate(cols):
                    if self.nprac[k]:
                        r = self._ready(k)[:, None]
                        P[:, :, i] = np.where(r, 1 - (1 - P[:, :, i]) * (1 - LAMBDA) ** self.nprac[k], P[:, :, i])
            P = np.clip(P, 1e-9, 1 - 1e-9)
            Kc = self.K[:, None, cols]
            self._lpri[:, :, cols] = Kc * np.log(P) + (1 - Kc) * np.log1p(-P)
        return self._lpri

    def _gibbs_phi(self) -> None:
        lp = self.logphi[None, :] + self._prior_terms().sum(axis=2)
        if self._groups:
            grs = list(self._groups.values())
            its = [gr["it"] for gr in grs]
            sx = np.array([gr["sx"] for gr in grs])
            s1x = np.array([gr["s1x"] for gr in grs])
            node = np.array([it.node for it in its])
            M = self.node_mastered()[:, node][:, None, :] > 0.5
            P = resp_arr(M, PHI[None, :, None], self.bmed[node], np.array([it.beta for it in its]),
                         np.array([it.a for it in its]), np.array([it.c for it in its]))
            lp = lp + (sx * np.log(P) + s1x * np.log1p(-P)).sum(axis=2)
        lp -= lp.max(axis=1, keepdims=True)
        pr = np.exp(lp)
        pr /= pr.sum(axis=1, keepdims=True)
        u = self.rng.random((self.C, 1))
        self.f = (pr.cumsum(axis=1) < u).sum(axis=1).clip(0, len(PHI) - 1)

    def sweep(self, nodes) -> None:
        for k in nodes:
            self._gibbs_node(k)
        self._gibbs_phi()

    # ── engine interface ─────────────────────────────────────────────────
    def predict(self, it: Item) -> float:
        return float(resp(self._mastered(it), PHI[self.f], self.bmed[it.node], it).mean())

    def observe(self, it: Item, score: float, n: float = 1.0) -> None:
        """score 0-10; n = effective evidence count (a multi-challenge review counts more)."""
        for old in self.obs_by_node[it.node]:
            if old["it"].node == it.node:
                old["w"] *= GAMMA
        o = {"it": it, "req": self.req[it.node], "bk": self.bmed[it.node], "x": score / 10.0, "w": float(n)}
        self.obs.append(o)
        for k in set(o["req"].tolist()):
            self.obs_by_node[k].append(o)
        self._regroup(it.node)
        local = set(o["req"].tolist())
        for q in list(local):
            local |= set(self.g.parents[q]) | set(self.ch[q])
        local = sorted(local)
        for _ in range(self.sweeps):
            self.sweep(local)
        if len(self.obs) % 10 == 0:
            self.sweep(range(self.g.n))
        if self.learn:  # the item was also practice
            self.nprac[it.node] += 1
            self._dirty.add(it.node)
            for _ in range(2):
                self.sweep(local)

    def _regroup(self, node: int) -> None:
        """Recompute the group sums for every item type of `node` (its weights just decayed)."""
        sums: Dict[tuple, list] = {}
        for o in self.obs_by_node[node]:
            it = o["it"]
            if it.node != node:
                continue
            key = (node, it.beta, it.a, it.c)
            acc = sums.setdefault(key, [0.0, 0.0, o])
            acc[0] += o["w"] * o["x"]
            acc[1] += o["w"] * (1 - o["x"])
        for key, (sx, s1x, o) in sums.items():
            if key not in self._groups:
                self._groups[key] = {"it": o["it"], "req": o["req"], "bk": o["bk"]}
                for k in set(o["req"].tolist()):
                    self._gby[k].append(key)
            self._groups[key]["sx"], self._groups[key]["s1x"] = sx, s1x

    def frontier(self) -> np.ndarray:
        """(C, n): 1 where the chain has k unmastered and all of k's R prerequisites mastered."""
        return (1.0 - self.K) * self._kpad()[:, self._RP].prod(axis=2)

    def _pmatrix(self) -> np.ndarray:
        M = self.node_mastered()[:, self._node_of] > 0.5
        return resp_arr(M, PHI[self.f][:, None], self.bmed[self._node_of], self._it_beta, self._it_a, self._it_c)

    def _unlock_tables(self) -> None:
        """One row per R edge k -> c: the other R prerequisites of c (padded)."""
        ks, cs, others = [], [], []
        for c in range(self.g.n):
            for k in self.rpa[c]:
                ks.append(k)
                cs.append(c)
                others.append([p for p in self.rpa[c] if p != k])
        self._ek, self._ec = np.array(ks, dtype=int), np.array(cs, dtype=int)
        self._eo = _pad(others, self.g.n)
        A = np.zeros((len(ks), self.g.n))
        A[np.arange(len(ks)), self._ek] = 1.0
        self._eA = A

    def teach_value(self) -> np.ndarray:
        """(C, n) per chain: k is on the frontier, times 1 + [mastering k would
        make some subskill ready] (c unmastered and every other R prerequisite
        of c mastered). Only one item can be taught next, so unlocking counts
        once, however many subskills it opens: a hub cannot outweigh the graph."""
        if not hasattr(self, "_eA"):
            self._unlock_tables()
        F = self.frontier()
        if not len(self._ek):
            return F
        D = (1.0 - self.K[:, self._ec]) * self._kpad()[:, self._eo].prod(axis=2)   # (C, E)
        best = np.zeros_like(F)
        np.maximum.at(best, (np.arange(self.C)[:, None], self._ek[None, :]), D)
        return F * (1.0 + best)

    def select_value(self, items: List[Item]) -> Item:
        """Pick the subskill with the highest expected teaching value (with
        one-step look-ahead), then its item the child is most likely to get
        right: teach the frontier through its easiest item."""
        assert items is self._items
        P = self._pmatrix()                       # (C, I)
        V = self.teach_value()                    # (C, n)
        vnow = V.mean(axis=0)
        best_now = vnow.max()
        W1 = P / P.sum(axis=0, keepdims=True)
        W0 = (1 - P) / (1 - P).sum(axis=0, keepdims=True)
        best1 = (W1.T @ V).max(axis=1)
        best0 = (W0.T @ V).max(axis=1)
        pbar = P.mean(axis=0)
        value = LAMBDA * (vnow[self._node_of] + pbar * best1 + (1 - pbar) * best0 - best_now)
        k = self._node_of[int(value.argmax())]
        same = np.nonzero(self._node_of == k)[0]
        return self._items[int(same[pbar[same].argmax()])]

    def mastery(self) -> List[float]:
        return self.K.mean(axis=0).tolist()

    def select(self, items: List[Item], min_p: float | None = None) -> Item:
        idx = [self._items.index(it) for it in items] if items is not self._items else range(len(items))
        idx = list(idx)
        P = self._pmatrix()[:, idx]
        m = self.K.mean(axis=0)[:, None]
        pbar = P.mean(axis=0)[None, :]
        A = self.K.T @ P / self.C
        with np.errstate(divide="ignore", invalid="ignore"):
            p1 = np.where(m > 0, A / m, 0.5)
            p0 = np.where(m < 1, (pbar - A) / (1 - m), 0.5)

        def hb(p):
            p = np.clip(p, 1e-9, 1 - 1e-9)
            return -(p * np.log2(p) + (1 - p) * np.log2(1 - p))

        mi = hb(pbar) - m * hb(p1) - (1 - m) * hb(p0)
        eig = (np.clip(mi, 0, None) * self._tgt[:, idx]).sum(axis=0)
        if min_p is not None and (pbar[0] >= min_p).any():
            eig = np.where(pbar[0] >= min_p, eig, -1.0)
        return self._items[idx[int(eig.argmax())]]
