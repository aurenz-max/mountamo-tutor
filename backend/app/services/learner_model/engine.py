"""
Two-layer learner model, production port of the lab's LayeredEngine
(`scripts/learner_model_lab/layered.py` + the BayesEngine graph it extends).

    Measurement layer  theta_k per subskill on the 0-10 grid (101 points),
                       updated by the production likelihood (P^x (1-P)^(1-x))^n
                       with the item's registry a, beta, c.
    Interface          K_k = 1 <=> theta_k >= tau_k = beta_k + 1.4. UP: the
                       graph sees one log likelihood ratio per subskill. DOWN:
                       a first-met subskill's theta prior is reshaped by the
                       graph's P(K_k).
    Knowledge layer    phi (general ability) and K over the Jev learner graph,
                       256 persistent Gibbs chains, practice-aware readiness.

The math is the lab's, unchanged; what this file adds is state that persists
between requests, so a submission updates the student once and reads never
replay history:

    summary   chains (phi index, K bits for the relevant subskills),
              per touched subskill {lr, base_mean, theta_mean, pc, n},
              practice {nprac, noln}, observation count
    grids     theta posterior + accumulated log likelihood, one doc per
              touched subskill, loaded only when that subskill is observed

Subskills with no evidence at or below them ("barren") are not stored: they
are redrawn exactly from their prior given phi and parents on load, which is
what the lab does after every observation.

Readouts (`readout`) are Rao-Blackwellized where it is cheap, so before/after
deltas are mostly signal, not chain noise:
    pm     P(subskill mastered)
    pc     P(right) on the subskill's typical item (a = TYPICAL_A, beta = beta_k)
    ready  P(not mastered and every R prerequisite mastered), the frontier

Exposure gate (`exposure_gate`, WORKSTREAMS 7.13). The model has no "taught
yet" variable, so general ability (phi) alone reads untaught above-grade
subskills as mastered (1004, grade K at 95%: 216 G3-G5 subskills). With the
student's grade of record known, an untouched subskill above it is mastered
only as an R prerequisite of a subskill the student showed (whoever does 5x5
by repeated addition can add repeatedly), and is ready only within one grade
of it. At or below the grade of record the model's readout stands. Chosen
over grade-anchored betas and Jev link conditionals in the lab (`replay kst`).
"""

from __future__ import annotations

import base64
import hashlib
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np

from . import memory

PHI = np.arange(0.0, 11.0, 1.0)
PHI_MEAN, PHI_SD = 4.5, 2.5
W_SCALE = 3.0
MIN_STEP = 0.8               # a parent with Jev step >= this is performed inside the child (R)
MIN_EASIER, MAX_STEP_E = 0.6, 0.8
# The typical item: the registry's median discrimination (a = 1.4 on 513 of
# 704 modes; tests/test_learner_typical_item.py fails if that drifts). Mastered
# = 80% right on the items actually served. With a = 1 here, as before 10-15,
# "80% on a typical item" meant ~88% on the a = 1.4 items served, and a child
# at 85% first try was never mastered (steady OPS002-06-c, 16 days running).
TYPICAL_A = 1.4
MASTERY_MARGIN = float(np.log(0.8 / 0.2) / TYPICAL_A)   # theta - beta at which the typical item gives P = 0.80
NONMASTER_HEADROOM = 0.7
LAMBDA = 0.15
TRANSFER = 0.5
DEFAULT_BETA = 3.0

TH = np.linspace(0.0, 10.0, 101)
BASE_SD = 2.0
DIFFUSION_SD = 0.2
# theta drift per sqrt(day) since the subskill was last practised (C2): evidence
# goes stale while the child learns elsewhere (siblings, easier forms) or forgets
DIFFUSION_DAY_SD = 0.0
CHAINS = 256
SWEEPS = 6
READY_WINDOW = 1             # exposure gate: ready up to this many grades above the grade of record
# Continual reach (user ruling 10-12, T1): a grade is "grown past" when this share
# of its subskills is mastered ON EVIDENCE (practised, or an R step of a practised
# subskill, at P(mastered) >= GROWN_PAST_PM); each grade
# grown past, starting at the grade of record, opens the next. A K child who has
# shown K and G1 is taught G2. Above the grade of record a subskill still counts
# only through the child's own evidence (or as an R step of one), so a grade
# above is grown past only on real work in it.
GROWN_PAST_SHARE = 0.6
GROWN_PAST_PM = 0.8
SHOWN = 0.5                  # exposure gate: a touched subskill at this P(mastered) counts as shown


def grade_name(idx: int) -> str:
    """0..12 -> grade doc id ("Kindergarten", "1".."12")."""
    return "Kindergarten" if idx == 0 else str(idx)


def grade_index(grade: Optional[str]) -> Optional[int]:
    """Grade doc id ("Kindergarten", "1".."12") -> 0..12."""
    if grade == "Kindergarten":
        return 0
    return int(grade) if grade and str(grade).isdigit() else None


def sig(x):
    return 1.0 / (1.0 + np.exp(-x))


def _normal(mean: float, sd: float) -> np.ndarray:
    p = np.exp(-0.5 * ((TH - mean) / sd) ** 2)
    return p / p.sum()


def p_item(a: float, beta: float, c: float) -> np.ndarray:
    return np.clip(c + (1 - c) * sig(a * (TH - beta)), 1e-6, 1 - 1e-6)


def _pad(rows, fill):
    width = max(1, max((len(r) for r in rows), default=1))
    out = np.full((len(rows), width), fill, dtype=float if isinstance(fill, float) else int)
    for i, r in enumerate(rows):
        out[i, :len(r)] = r
    return out


def n_eff(n: int) -> float:
    """Evidence weight of an n-challenge review: the production testlet count."""
    return min(6.0, 1.0 + 0.5 * (max(1, n) - 1))


# ── graph arrays ────────────────────────────────────────────────────────────

@dataclass
class GraphArrays:
    """The learner graph as index arrays. Built once per published version."""
    version: str
    keys: List[str]
    index: Dict[str, int]
    labels: List[str]
    skill: List[str]
    bmed: np.ndarray
    parents: List[List[int]]
    weights: List[List[float]]
    req: List[np.ndarray]
    rpa: List[np.ndarray]
    ch: List[List[int]]
    e_children: List[List[Tuple[int, float]]]
    order: List[int]
    gi: np.ndarray = field(default=None)          # grade index per subskill (K = 0)
    rch: List[List[int]] = field(default=None)    # R children
    spa: List[np.ndarray] = field(default=None)   # parents a success here demonstrates: R steps + easier forms
    _PA: np.ndarray = field(default=None)
    _PW: np.ndarray = field(default=None)
    _RP: np.ndarray = field(default=None)

    @property
    def n(self) -> int:
        return len(self.keys)

    @classmethod
    def from_nodes(cls, version: str, nodes: Dict[str, dict]) -> "GraphArrays":
        keys = sorted(nodes)
        index = {k: i for i, k in enumerate(keys)}
        n = len(keys)
        parents, weights, steps, easier = [], [], [], []
        for k in keys:
            ps = [p for p in nodes[k].get("parents", []) if p.get("in_model") and p["key"] in index]
            parents.append([index[p["key"]] for p in ps])
            weights.append([W_SCALE * float(p["score"]) for p in ps])
            steps.append([float(p.get("step") or 0.0) for p in ps])
            easier.append([float(p.get("easier_form") or 0.0) for p in ps])
        req = [np.array([i] + [p for p, s in zip(parents[i], steps[i]) if s >= MIN_STEP], dtype=int) for i in range(n)]
        rpa = [r[r != i] for i, r in enumerate(req)]
        ch: List[List[int]] = [[] for _ in range(n)]
        e_children: List[List[Tuple[int, float]]] = [[] for _ in range(n)]
        for i in range(n):
            for p, s, e in zip(parents[i], steps[i], easier[i]):
                ch[p].append(i)
                if e >= MIN_EASIER and s < MAX_STEP_E:
                    e_children[p].append((i, e))
        seen, order = set(), []

        def visit(i: int) -> None:
            stack = [(i, False)]
            while stack:
                x, done = stack.pop()
                if done:
                    order.append(x)
                    continue
                if x in seen:
                    continue
                seen.add(x)
                stack.append((x, True))
                stack.extend((p, False) for p in parents[x] if p not in seen)

        for i in range(n):
            visit(i)
        g = cls(version=version, keys=keys, index=index,
                labels=[nodes[k].get("label", "") for k in keys],
                skill=[f"{nodes[k].get('grade')}:{nodes[k].get('skill_id')}" for k in keys],
                bmed=np.array([float(nodes[k].get("beta") or DEFAULT_BETA) for k in keys]),
                parents=parents, weights=weights, req=req, rpa=rpa, ch=ch, e_children=e_children, order=order)
        g.gi = np.array([grade_index(k.split(":", 1)[0]) if grade_index(k.split(":", 1)[0]) is not None else 99 for k in keys])
        g.rch = [[] for _ in range(n)]
        for i, r in enumerate(rpa):
            for p in r:
                g.rch[int(p)].append(i)
        # Success on a subskill demonstrates its R steps (performed inside it) and its
        # easier forms (count 20 objects -> count 10 objects): the same pairs the
        # e_children transfer uses, read in the other direction.
        g.spa = [np.array(sorted(set(rpa[i].tolist()) | {p for p, s, e in zip(parents[i], steps[i], easier[i])
                                                         if e >= MIN_EASIER and s < MAX_STEP_E}), dtype=int)
                 for i in range(n)]
        g._PA = _pad(parents, n)
        g._PW = _pad(weights, 0.0)
        g._RP = _pad([r.tolist() for r in rpa], n)
        return g


# ── exposure gate ───────────────────────────────────────────────────────────

def exposure_gate(g: GraphArrays, readout: Dict[str, List[float]], touched, grade: Optional[int]) -> Dict[str, List[float]]:
    """readout (key -> [pm, pc, ready]) with untaught above-grade subskills
    gated; see the module docstring. Pure and idempotent, so it also corrects
    readouts stored before the gate. grade None: unchanged."""
    if grade is None:
        return readout
    n = g.n
    pm = np.array([readout[k][0] if k in readout else 0.0 for k in g.keys])
    ready = np.array([readout[k][2] if k in readout else 0.0 for k in g.keys])
    seen = _seen(g, touched)
    implied = _implied(g, pm, seen)
    above = ~seen & (g.gi > grade)
    pm = np.where(above, implied, np.where(~seen, np.maximum(pm, implied), pm))
    top, _ = _reach(g, _evidenced(pm, seen, implied), grade)
    # above grade: ready = not mastered and every R prerequisite mastered, from the gated pm
    rp = np.array([float(np.prod(pm[g.rpa[k]])) if len(g.rpa[k]) else 1.0 for k in range(n)])
    ready = np.where(above, np.where(g.gi <= top, (1.0 - pm) * rp, 0.0), ready)
    out = dict(readout)
    for k in np.nonzero(above | (implied > 0))[0]:
        key = g.keys[k]
        if key in out:
            out[key] = [round(float(pm[k]), 4), out[key][1], round(float(ready[k]), 4)]
    return out


def _seen(g: GraphArrays, touched) -> np.ndarray:
    seen = np.zeros(g.n, bool)
    for key in touched:
        if key in g.index:
            seen[g.index[key]] = True
    return seen


def _implied(g: GraphArrays, pm: np.ndarray, seen: np.ndarray, via: Optional[np.ndarray] = None) -> np.ndarray:
    """Shown subskills lend their P(mastered) to what they demonstrate (R steps and
    easier forms, g.spa), transitively. `via`, when given, receives the index of
    the practised subskill each credit came from (-1 for none)."""
    implied = np.zeros(g.n)
    stack = [(int(k), float(pm[k]), int(k)) for k in np.nonzero(seen & (pm >= SHOWN))[0]]
    while stack:
        k, p, src = stack.pop()
        for q in g.spa[k]:
            q = int(q)
            if p > implied[q]:
                implied[q] = p
                if via is not None:
                    via[q] = src
                stack.append((q, p, src))
    return implied


def _evidenced(pm: np.ndarray, seen: np.ndarray, implied: np.ndarray) -> np.ndarray:
    """P(mastered) only where the child's own work stands behind it: practised, or
    demonstrated by something practised (an R step or an easier form of it). General ability alone counts for nothing:
    "grown past a grade" is a claim about what the child has SHOWN (a 95%-right
    child read as having shown most of K after 3 hours, report 10-12)."""
    return np.where(seen, pm, implied)


def _reach(g: GraphArrays, evidenced: np.ndarray, grade: int) -> Tuple[int, List[int]]:
    """(highest grade that may be taught, grades grown past) from evidenced P(mastered)."""
    level, grown = grade, []
    while True:
        mask = g.gi == level
        if not mask.any() or float((evidenced[mask] >= GROWN_PAST_PM).mean()) < GROWN_PAST_SHARE:
            break
        grown.append(level)
        level += 1
    return max(grade + READY_WINDOW, level), grown


# One state per subskill, read by every surface (My Progress card, report grid,
# selector, reach). Ladder: mastered > shown > learning > tried > None.
MASTERED_STATE, SHOWN_STATE, LEARNING_STATE, TRIED_STATE = "mastered", "shown", "learning", "tried"


def demonstration(g: GraphArrays, gated: Dict[str, List[float]], touched,
                  lifecycle: Optional[Dict[str, dict]] = None) -> Dict[str, dict]:
    """key -> {state, gate, own_gate, retained, pm, via} for every subskill with any
    standing (practised, demonstrated, or on the lifecycle).

    Evidence and retention travel the same edges (g.spa: R steps and easier
    forms): a subskill is shown when it was practised or something practised
    demonstrates it, and its gate is the highest lifecycle gate among itself and
    everything that demonstrates it (a retest on subtract within 100 is a retest
    of subtract within 10). General ability (phi) plays no part: it selects, it
    never reports. `via` is the practised or gated subskill the standing came
    from when it is not the subskill's own."""
    lifecycle = lifecycle or {}
    n = g.n
    pm = np.array([gated[k][0] if k in gated else 0.0 for k in g.keys])
    seen = _seen(g, touched)
    via = np.full(n, -1)
    ev = _evidenced(pm, seen, _implied(g, pm, seen, via))
    own = np.full(n, -1)
    kept = np.zeros(n, bool)
    for key, lc in lifecycle.items():
        if key in g.index:
            k = g.index[key]
            own[k] = int(lc.get("current_gate", 0) or 0)
            kept[k] = lc.get("retention_state") == "mastered"
    gate, gvia = own.copy(), np.full(n, -1)
    stack = [(int(k), int(own[k]), bool(kept[k]), int(k)) for k in np.nonzero((own > 0) | kept)[0]]
    while stack:
        k, gt, kp, src = stack.pop()
        for q in g.spa[k]:
            q = int(q)
            if gt > gate[q] or (kp and not kept[q]):
                if gt > gate[q]:
                    gate[q], gvia[q] = gt, src
                kept[q] = kept[q] or kp
                stack.append((q, max(gt, int(gate[q])), kept[q], src))
    out: Dict[str, dict] = {}
    for k in range(n):
        if gate[k] >= 4 or kept[k]:
            st = MASTERED_STATE
        elif ev[k] >= GROWN_PAST_PM:
            st = SHOWN_STATE
        elif seen[k] or gate[k] >= 1:
            st = LEARNING_STATE
        elif own[k] == 0:
            st = TRIED_STATE
        else:
            continue
        src = int(gvia[k]) if st == MASTERED_STATE and gvia[k] >= 0 else (int(via[k]) if not seen[k] and via[k] >= 0 else -1)
        out[g.keys[k]] = {"state": st, "gate": int(max(gate[k], -1)) if gate[k] >= 0 else None,
                          "own_gate": int(own[k]) if own[k] >= 0 else None, "retained": bool(kept[k]),
                          "pm": round(float(ev[k]), 4), "via": g.keys[src] if src >= 0 and src != k else None}
    return out


# Per-day record per touched subskill (last practice day, that day's mean
# first-try result, closed days running below MISS_X). The selector no longer
# rests on it (10-15: memory.value ranks a missed subskill below its easier
# form); the loop harness's stuck-run assertion reads MISS_X / MISS_DAYS.
MISS_X, MISS_DAYS = 0.7, 3


def _diffuse(post: np.ndarray, sd: float) -> np.ndarray:
    """Gaussian random-walk step of `sd` on the theta grid."""
    step = TH[1] - TH[0]
    half = max(10, int(np.ceil(5 * sd / step)))   # 10 = the old fixed kernel at sd 0.2
    off = np.arange(-half, half + 1) * step
    kern = np.exp(-0.5 * (off / sd) ** 2)
    out = np.convolve(post, kern / kern.sum(), mode="same")
    return out / out.sum()


def _day_record(t: dict, day: Optional[str], x: float) -> dict:
    """The touched entry's day fields after one more answer `x` on `day`.
    `miss_run` counts closed days only; the current day closes when the
    next day's first answer arrives (or is read through `miss_days`)."""
    if not day:
        return {k: t[k] for k in ("day", "day_x", "day_n", "miss_run") if k in t}
    if t.get("day") == day:
        dn = int(t.get("day_n", 0))
        return {"day": day, "day_x": (float(t["day_x"]) * dn + x) / (dn + 1), "day_n": dn + 1,
                "miss_run": int(t.get("miss_run", 0))}
    return {"day": day, "day_x": x, "day_n": 1, "miss_run": miss_days(t)}


def miss_days(t: dict) -> int:
    """Days in a row, ending with the last practice day, whose mean first-try
    result was below MISS_X."""
    if not t.get("day"):
        return 0
    return int(t.get("miss_run", 0)) + 1 if float(t["day_x"]) < MISS_X else 0


def counts_toward_grade(state: Optional[str]) -> bool:
    return state in (MASTERED_STATE, SHOWN_STATE)


def grade_reach(g: GraphArrays, gated: Dict[str, List[float]], touched, grade: Optional[int],
                lifecycle: Optional[Dict[str, dict]] = None) -> Tuple[Optional[int], List[int]]:
    """(top grade index, grades grown past) from the demonstration states: a
    subskill counts when shown or mastered. grade None (gradeless student): no
    ceiling, nothing grown past."""
    if grade is None:
        return None, []
    st = demonstration(g, gated, touched, lifecycle)
    ev = np.array([1.0 if counts_toward_grade((st.get(k) or {}).get("state")) else 0.0 for k in g.keys])
    return _reach(g, ev, grade)


# ── packing ─────────────────────────────────────────────────────────────────

def _b64(a: np.ndarray) -> str:
    return base64.b64encode(a.tobytes()).decode("ascii")


def _unb64(s: str, dtype) -> np.ndarray:
    return np.frombuffer(base64.b64decode(s), dtype=dtype).copy()


# ── engine ──────────────────────────────────────────────────────────────────

class LearnerEngine:
    """One student, one subject. Load with `from_state`, call `observe`,
    persist `to_state()` + `dirty_grids()`."""

    def __init__(self, g: GraphArrays, seed: int = 0):
        self.g, self.C = g, CHAINS
        self.rng = np.random.default_rng(seed)
        n = g.n
        lp = -0.5 * ((PHI - PHI_MEAN) / PHI_SD) ** 2
        self.logphi = lp - np.logaddexp.reduce(lp)
        self.tau = g.bmed + MASTERY_MARGIN
        self.above = TH[None, :] >= self.tau[:, None]
        self.noln = np.zeros(n)
        self.nprac = np.zeros(n)
        self.lr = np.zeros(n)
        self.relevant: set = set()
        self.touched: Dict[str, dict] = {}         # key -> {lr, base_mean, theta_mean, pc, n}
        self.post: Dict[int, np.ndarray] = {}
        self.loglik: Dict[int, np.ndarray] = {}
        self._grids_dirty: set = set()
        self.n_obs = 0
        self.mem_fit = memory.new_fit()   # the child's own forgetting (memory.multiplier)
        self._dirty = set(range(n))
        self.f = self.rng.choice(len(PHI), size=self.C, p=np.exp(self.logphi))
        self.K = np.zeros((self.C, n))
        for k in g.order:
            self.K[:, k] = self.rng.random(self.C) < sig(self._z(k))

    # ── persistence ───────────────────────────────────────────────────────
    @staticmethod
    def seed_for(student_id, n_obs: int) -> int:
        h = hashlib.sha256(f"{student_id}:{n_obs}".encode()).digest()
        return int.from_bytes(h[:8], "little")

    @classmethod
    def from_state(cls, g: GraphArrays, state: Optional[dict], seed: int) -> "LearnerEngine":
        e = cls(g, seed=seed)
        if not state:
            return e
        e.n_obs = int(state.get("n_obs", 0))
        if state.get("mem_fit"):
            e.mem_fit = {"ll": list(state["mem_fit"]["ll"]), "n": int(state["mem_fit"]["n"])}
        for key, t in (state.get("touched") or {}).items():
            k = g.index.get(key)
            if k is None:
                continue
            e.touched[key] = dict(t)
            e.lr[k] = float(t.get("lr", 0.0))
        for key, (nprac, noln) in (state.get("practice") or {}).items():
            k = g.index.get(key)
            if k is not None:
                e.nprac[k], e.noln[k] = float(nprac), float(noln)
        ch = state.get("chains") or {}
        rel_keys = [r for r in ch.get("rel", [])]
        if ch.get("f") and rel_keys:
            f = _unb64(ch["f"], np.uint8).astype(int)
            bits = np.unpackbits(_unb64(ch["K"], np.uint8))[: e.C * len(rel_keys)].reshape(e.C, len(rel_keys))
            if len(f) == e.C:
                e.f = f
                for j, key in enumerate(rel_keys):
                    k = g.index.get(key)
                    if k is not None:
                        e.K[:, k] = bits[:, j]
                        e.relevant.add(k)
        for key in e.touched:
            e._mark_relevant(g.index[key])
        e._dirty = set(range(g.n))
        e._redraw_barren()
        return e

    def load_grid(self, key: str, grid: Optional[dict]) -> None:
        k = self.g.index[key]
        if grid and grid.get("post"):
            self.post[k] = _unb64(grid["post"], np.float32).astype(float)
            self.loglik[k] = _unb64(grid["loglik"], np.float32).astype(float)

    def to_state(self) -> dict:
        rel = sorted(self.relevant)
        bits = np.packbits(self.K[:, rel].astype(np.uint8).reshape(-1)) if rel else np.zeros(0, np.uint8)
        return {
            "graph_version": self.g.version,
            "n_obs": self.n_obs,
            "mem_fit": self.mem_fit,
            "touched": self.touched,
            "practice": {self.g.keys[k]: [float(self.nprac[k]), float(self.noln[k])]
                         for k in np.nonzero((self.nprac > 0) | (self.noln < 0))[0]},
            "chains": {"f": _b64(self.f.astype(np.uint8)), "rel": [self.g.keys[k] for k in rel], "K": _b64(bits)},
        }

    def dirty_grids(self) -> Dict[str, dict]:
        return {self.g.keys[k]: {"post": _b64(self.post[k].astype(np.float32)),
                                 "loglik": _b64(self.loglik[k].astype(np.float32))}
                for k in self._grids_dirty}

    # ── graph model pieces (lab BayesEngine) ─────────────────────────────
    def _z(self, k: int, phi=None):
        phi = PHI[self.f] if phi is None else phi
        z = phi - self.g.bmed[k]
        if self.g.parents[k]:
            z = z + (self.K[:, self.g.parents[k]] - 1.0) @ np.array(self.g.weights[k])
        return z

    def _ready(self, k: int):
        rp = self.g.rpa[k]
        if not len(rp):
            return np.ones(self.C, bool)
        return self.K[:, rp].prod(axis=1) > 0.5

    def _pk(self, k: int, phi):
        p = sig(self._z(k, phi))
        if self.noln[k] < 0:
            p = np.where(self._ready(k), 1 - (1 - p) * np.exp(self.noln[k]), p)
        return np.clip(p, 1e-9, 1 - 1e-9)

    def _kpad(self):
        return np.hstack([self.K, np.ones((self.C, 1))])

    def _prior_terms(self, only=None) -> np.ndarray:
        if not hasattr(self, "_lpri"):
            self._lpri = np.zeros((self.C, len(PHI), self.g.n))
        todo = self._dirty if only is None else (self._dirty & only)
        if todo:
            cols = np.array(sorted(todo))
            self._dirty -= todo
            ps = ((self._kpad()[:, self.g._PA[cols]] - 1.0) * self.g._PW[cols][None]).sum(axis=2)
            P = sig(PHI[None, :, None] - self.g.bmed[cols][None, None, :] + ps[:, None, :])
            for i, k in enumerate(cols):
                if self.noln[k] < 0:
                    r = self._ready(k)[:, None]
                    P[:, :, i] = np.where(r, 1 - (1 - P[:, :, i]) * np.exp(self.noln[k]), P[:, :, i])
            P = np.clip(P, 1e-9, 1 - 1e-9)
            Kc = self.K[:, None, cols]
            self._lpri[:, :, cols] = Kc * np.log(P) + (1 - Kc) * np.log1p(-P)
        return self._lpri

    def _logodds(self, k: int) -> np.ndarray:
        """Per chain: log odds of K_k = 1 given everything else (Gibbs conditional).

        Children with no evidence at or below them (barren) are skipped: the
        relevant set is closed under ancestors, so they sum out of the
        posterior exactly. Conditioning on them, as the lab does, is valid but
        sticks: a hub drawn unmastered gets barren children redrawn unmastered,
        which then hold it there (1004's K counting skill read P(mastered)
        0.34 at P(right) 0.88 with both prerequisites mastered)."""
        K, phi = self.K, PHI[self.f]
        old = K[:, k].copy()
        pk = self._pk(k, phi)
        d = np.log(pk) - np.log1p(-pk) + self.lr[k]
        for c in self.g.ch[k]:
            if c not in self.relevant:
                continue
            kc = K[:, c] > 0.5
            K[:, k] = 1.0
            p1 = self._pk(c, phi)
            K[:, k] = 0.0
            p0 = self._pk(c, phi)
            d = d + np.where(kc, np.log(p1) - np.log(p0), np.log1p(-p1) - np.log1p(-p0))
        K[:, k] = old
        return d

    def _gibbs_node(self, k: int) -> None:
        d = self._logodds(k)
        self.K[:, k] = (self.rng.random(self.C) < sig(d)).astype(float)
        self._dirty.add(k)
        self._dirty.update(self.g.ch[k])

    def _phi_conditional(self) -> np.ndarray:
        """(C, |PHI|) phi given the relevant subskills (barren ones sum out exactly)."""
        rel = np.array(sorted(self.relevant), dtype=int)
        lp = self.logphi[None, :] + (self._prior_terms(self.relevant)[:, :, rel].sum(axis=2) if len(rel) else 0.0)
        lp -= lp.max(axis=1, keepdims=True)
        pr = np.exp(lp)
        return pr / pr.sum(axis=1, keepdims=True)

    def _gibbs_phi(self) -> None:
        pr = self._phi_conditional()
        u = self.rng.random((self.C, 1))
        self.f = (pr.cumsum(axis=1) < u).sum(axis=1).clip(0, len(PHI) - 1)

    def sweep(self, nodes) -> None:
        for k in nodes:
            self._gibbs_node(k)
        self._gibbs_phi()

    def _redraw_barren(self) -> None:
        phi = PHI[self.f]
        for k in self.g.order:
            if k not in self.relevant:
                self.K[:, k] = (self.rng.random(self.C) < self._pk(k, phi)).astype(float)
                self._dirty.add(k)

    def _mark_relevant(self, k: int) -> None:
        stack = [k]
        while stack:
            x = stack.pop()
            if x in self.relevant:
                continue
            self.relevant.add(x)
            stack.extend(self.g.parents[x])

    def practice(self, j: int, x: float) -> None:
        self.nprac[j] += 1
        self.noln[j] += np.log1p(-LAMBDA * x)
        self._dirty.add(j)
        for k, e in self.g.e_children[j]:
            self.noln[k] += np.log1p(-TRANSFER * e * LAMBDA * x)
            self._dirty.add(k)

    # ── measurement layer (lab LayeredEngine) ───────────────────────────
    def _base_mean(self, k: int) -> float:
        """Mean of already-seen sibling subskills, else the current phi estimate."""
        sk = self.g.skill[k]
        sib = [t["theta_mean"] for key, t in self.touched.items() if self.g.skill[self.g.index[key]] == sk]
        return float(np.mean(sib)) if sib else float(PHI[self.f].mean())

    def _base(self, k: int) -> np.ndarray:
        return _normal(self._base_mean(k), BASE_SD)

    def _prior(self, k: int, pk: Optional[float] = None) -> np.ndarray:
        base = self._base(k)
        pk = float(self.K[:, k].mean()) if pk is None else pk
        up = self.above[k]
        b1, b0 = base[up].sum(), base[~up].sum()
        if b1 < 1e-9 or b0 < 1e-9:
            return base
        return np.where(up, base * pk / b1, base * (1 - pk) / b0)

    def _update_lr(self, k: int, base: np.ndarray) -> None:
        L = np.exp(self.loglik[k] - self.loglik[k].max())
        up = self.above[k]
        b1, b0 = base[up].sum(), base[~up].sum()
        m1, m0 = (L * base)[up].sum(), (L * base)[~up].sum()
        if min(b1, b0, m1, m0) < 1e-300:
            self.lr[k] = 20.0 if m0 < 1e-300 else -20.0
        else:
            self.lr[k] = float(np.clip(np.log(m1 / b1) - np.log(m0 / b0), -20, 20))

    def theta_dist(self, k: int) -> np.ndarray:
        return self.post[k] if k in self.post else self._prior(k)

    def mem_m(self) -> float:
        """The child's stability multiplier (memory.multiplier): 1 until reviews show otherwise."""
        return memory.multiplier(self.mem_fit)

    def predict(self, key: str, a: float, beta: float, c: float) -> float:
        """P(right) on an item of this subskill. Needs the grid loaded if touched."""
        k = self.g.index[key]
        return float((self.theta_dist(k) * p_item(a, beta, c)).sum())

    def observe(self, key: str, a: float, beta: float, c: float, x: float, n: float,
                day: Optional[str] = None) -> None:
        """x = first-try fraction (0-1), n = evidence weight. Grid for `key`
        must be loaded first (`load_grid`) when the subskill was seen before.
        `day` (YYYY-MM-DD) feeds the per-day miss record the selector rests on."""
        g, k = self.g, self.g.index[key]
        t = self.touched.get(key)
        if t is None:
            t = {"base_mean": self._base_mean(k), "n": 0}
        if k not in self.post:      # first meeting (or a lost grid doc: restart from the prior)
            self.post[k] = self._prior(k)
            self.loglik[k] = np.zeros_like(TH)
        if day and t.get("S") is not None:
            # a later-day practice is a recall test, scored against what knowledge predicted
            memory.observe_recall(self.mem_fit, t, day, x, n, self.predict(key, a, beta, c))
        base = _normal(float(t["base_mean"]), BASE_SD)
        if DIFFUSION_DAY_SD and day and t.get("day") and t["day"] < day:
            from datetime import date
            gap = (date.fromisoformat(day) - date.fromisoformat(t["day"])).days
            self.post[k] = _diffuse(self.post[k], DIFFUSION_DAY_SD * np.sqrt(gap))
        P = p_item(a, beta, c)
        ll = n * (x * np.log(P) + (1 - x) * np.log1p(-P))
        self.loglik[k] = self.loglik[k] + ll
        post = self.post[k] * np.exp(ll - ll.max())
        post /= post.sum()
        self.post[k] = _diffuse(post, DIFFUSION_SD)
        self._grids_dirty.add(k)
        self._update_lr(k, base)
        self.touched[key] = {"lr": float(self.lr[k]), "base_mean": float(t["base_mean"]),
                             "theta_mean": float((TH * self.post[k]).sum()),
                             "pc": float((self.post[k] * p_item(TYPICAL_A, g.bmed[k], 0.0)).sum()),
                             "n": int(t.get("n", 0)) + 1,
                             **_day_record(t, day, x)}
        self.touched[key].update(memory.update(t, day, x, self.touched[key]["pc"], self.mem_m()))
        self._refresh_parts(k, day, x)
        self._mark_relevant(k)
        local = sorted(({k} | set(g.parents[k]) | set(g.ch[k])) & self.relevant)
        for _ in range(SWEEPS):
            self.sweep(local)
        self.n_obs += 1
        if self.n_obs % 5 == 0:
            for _ in range(2):
                self.sweep(sorted(self.relevant))
        self.practice(k, x)
        self.sweep(local)
        self._redraw_barren()

    def _refresh_parts(self, k: int, day: Optional[str], x: float) -> None:
        """A successful day on k is a review of what k demonstrates (its R steps
        and easier forms, transitively: the g.spa edges evidence and gates
        travel): adding within 20 retrieves adding within 10. Only practised
        parts carry a memory trace to refresh; a miss on k says nothing about
        its parts."""
        if not day or x < memory.SUCCESS:
            return
        seen, stack = {k}, [int(q) for q in self.g.spa[k]]
        while stack:
            q = stack.pop()
            if q in seen:
                continue
            seen.add(q)
            t = self.touched.get(self.g.keys[q])
            if t is not None and t.get("S") is not None:
                t.update(memory.update(t, day, 1.0, float(t.get("pc", memory.GOOD_P)), self.mem_m()))
            stack.extend(int(p) for p in self.g.spa[q])

    # ── readouts ──────────────────────────────────────────────────────────
    def readout(self, grade: Optional[int] = None) -> Dict[str, List[float]]:
        """key -> [pm, pc, ready] for every subskill, exposure-gated at `grade`."""
        return exposure_gate(self.g, self._readout(), self.touched, grade)

    def _readout(self) -> Dict[str, List[float]]:
        g, C, n = self.g, self.C, self.g.n
        phi = PHI[self.f]
        Kp = self._kpad()
        ps = ((Kp[:, g._PA] - 1.0) * g._PW[None]).sum(axis=2)            # (C, n)
        # phi integrated out per chain (its conditional), not the sampled value:
        # an untouched subskill then moves only when its parents or the phi
        # posterior move, not with each redraw of phi
        pr = self._phi_conditional()                                     # (C, |PHI|)
        P = sig(PHI[None, :, None] - g.bmed[None, None, :] + ps[:, None, :])   # (C, |PHI|, n)
        learnt = self.noln < 0
        if learnt.any():
            ready_c = (Kp[:, g._RP].prod(axis=2) > 0.5)[:, None, :]
            P = np.where(ready_c & learnt[None, None, :], 1 - (1 - P) * np.exp(self.noln)[None, None, :], P)
        P = (P * pr[:, :, None]).sum(axis=1)
        pm = P.mean(axis=0)
        for k in self.relevant:                                          # Rao-Blackwellized conditional
            pm[k] = float(sig(self._logodds(k)).mean())
        ready = ((1.0 - self.K) * Kp[:, g._RP].prod(axis=2)).mean(axis=0)
        # pc for untouched subskills: the graph-reshaped prior on the typical item
        sib: Dict[str, list] = {}
        for key, t in self.touched.items():
            sib.setdefault(g.skill[g.index[key]], []).append(t["theta_mean"])
        phi_mean = float((PHI * pr.mean(axis=0)).sum())
        means = np.array([np.mean(sib[s]) if s in sib else phi_mean for s in g.skill])
        base = np.exp(-0.5 * ((TH[None, :] - means[:, None]) / BASE_SD) ** 2)
        base /= base.sum(axis=1, keepdims=True)
        b1 = (base * self.above).sum(axis=1)
        b0 = 1.0 - b1
        ok = (b1 > 1e-9) & (b0 > 1e-9)
        D = np.where(self.above, base * (pm / np.maximum(b1, 1e-12))[:, None],
                     base * ((1 - pm) / np.maximum(b0, 1e-12))[:, None])
        D = np.where(ok[:, None], D, base)
        typical = np.clip(sig(TYPICAL_A * (TH[None, :] - g.bmed[:, None])), 1e-6, 1 - 1e-6)
        pc = (D * typical).sum(axis=1)
        for key, t in self.touched.items():
            pc[g.index[key]] = t["pc"]
        return {g.keys[k]: [round(float(pm[k]), 4), round(float(pc[k]), 4), round(float(ready[k]), 4)] for k in range(n)}

    # ── selection (lab LayeredEngine.select_value, success-weighted) ──────
    def _transfer(self) -> np.ndarray:
        """(n, n): column j = what practising j teaches: j itself plus TRANSFER x
        easier_form score to each harder version of j."""
        if not hasattr(self.g, "_T"):
            T = np.eye(self.g.n)
            for j, kids in enumerate(self.g.e_children):
                for k, e in kids:
                    T[k, j] = TRANSFER * e
            self.g._T = T  # type: ignore[attr-defined]
        return self.g._T  # type: ignore[attr-defined]

    def teach_value(self) -> np.ndarray:
        """(C, n) per chain: k on the frontier (unmastered, every R prerequisite
        mastered), times 1 + [mastering k would make some subskill ready]. The
        unlock counts once, however many subskills it opens, so a hub cannot
        outweigh the graph."""
        g, Kp = self.g, self._kpad()
        if not hasattr(g, "_ek"):   # one row per R edge k -> c: c's other R prerequisites
            ks, cs, others = [], [], []
            for c in range(g.n):
                for k in g.rpa[c]:
                    ks.append(int(k))
                    cs.append(c)
                    others.append([int(p) for p in g.rpa[c] if p != k])
            g._ek, g._ec, g._eo = np.array(ks, dtype=int), np.array(cs, dtype=int), _pad(others, g.n)  # type: ignore[attr-defined]
        F = (1.0 - self.K) * Kp[:, g._RP].prod(axis=2)
        if not len(g._ek):
            return F
        D = (1.0 - self.K[:, g._ec]) * Kp[:, g._eo].prod(axis=2)            # (C, E)
        best = np.zeros_like(F)
        np.maximum.at(best, (np.arange(self.C)[:, None], g._ek[None, :]), D)
        return F * (1.0 + best)

    def teaching_gain(self, readout: Dict[str, List[float]]) -> np.ndarray:
        """(n,) expected learning from serving subskill k's typical item:
        P(right) x the teaching value of what it practises (k plus harder
        versions via easier-form transfer). Success weighting is what makes an
        easier item, or an easier form, worth serving. `readout` supplies
        P(right) (exposure-gated by the caller)."""
        pc = np.array([readout[k][1] if k in readout else 0.0 for k in self.g.keys])
        vt = (self.teach_value() @ self._transfer()).mean(axis=0)
        return pc * vt

    def phi_summary(self) -> Tuple[float, float]:
        pr = self._phi_conditional().mean(axis=0)
        m = float((PHI * pr).sum())
        return m, float(np.sqrt(((PHI - m) ** 2 * pr).sum()))
