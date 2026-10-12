"""
Learner-model lab: today's estimator vs the Bayesian graph model, side by side
on literacy K-G1 with simulated children. Offline: no Firestore, no Jev calls.

  check   Gibbs inference vs exact enumeration on a 4-5 subskill subgraph
  run     E1 shared stream: both engines see the same items (today's picks)
            and the same answers -> next-answer prediction loss, diagnosis
          E2 own choice: each engine picks its own items for its own copy of
            the same child -> diagnosis, success rate, items served while a
            prerequisite was missing, learning

Usage (from backend/):
  venv/Scripts/python -m scripts.learner_model_lab.run check
  venv/Scripts/python -m scripts.learner_model_lab.run run --items 60 --seeds 4
"""

from __future__ import annotations

import argparse
import os
import itertools
import json
import math
import re
import statistics as st
import sys
import time
from pathlib import Path
from typing import Dict, List

import numpy as np

from . import bayes as B
from .baseline import BaselineEngine
from .graph import ROOT, Graph, Item, load
from . import truth as truth_mod
from .layered import LayeredEngine
from .truth import PERSONAS, PERSONAS_BY_SUBJECT, TruthStudent

OUT = ROOT / "backend" / "reports" / "learner-model-lab" / "frontier"   # gitignored
CHECKPOINTS = (10, 20, 40, 60, 100)
PASS = 6.0
POLICIES = ("today", "layered_base", "layered_value")
# layered_base: unweighted frontier value (before the success fixes); layered_value: success-weighted + transfer
SUBJECT = "LANGUAGE_ARTS"  # set per worker from --subject
CHALLENGES = 4             # challenges per served item, scored first-try like real reviews
N_EFF = 1 + 0.5 * (CHALLENGES - 1)
# bayes_floor: info gain among items with predicted P >= 0.6
# bayes_value: expected learning on the frontier with one-step look-ahead


# ── check: Gibbs vs exact ───────────────────────────────────────────────────

def subgraph(g: Graph, keys: List[str]) -> Graph:
    old = [g.index[k] for k in keys]
    new = {o: i for i, o in enumerate(old)}
    nodes, items = [], []
    for o in old:
        nd = g.nodes[o]
        its = [Item(node=new[o], mode=it.mode, beta=it.beta, a=it.a, c=it.c) for it in nd.items]
        nodes.append(type(nd)(**{**{k: v for k, v in nd.__dict__.items() if not k.startswith("_")}, "items": its}))
        items.extend(its)
    keep = lambda ps, ws: ([new[p] for p in ps if p in new], [w for p, w in zip(ps, ws) if p in new])
    par = [keep(g.parents[o], g.weights[o]) for o in old]
    tpar = [keep(g.truth_parents[o], g.truth_scores[o]) for o in old]
    step = {(new[a], new[b]): s for (a, b), s in g.step.items() if a in new and b in new}
    return Graph(nodes=nodes, index={k: i for i, k in enumerate(keys)}, parents=[p for p, _ in par],
                 weights=[w for _, w in par], truth_parents=[p for p, _ in tpar],
                 truth_scores=[w for _, w in tpar], items=items, step=step)


def exact(sg: Graph, obs: List[tuple]) -> np.ndarray:
    n = sg.n
    eng = B.BayesEngine(sg, chains=2, seed=0)  # borrow its fixed pieces only
    marg, tot = np.zeros(n), 0.0
    for bits in itertools.product([0, 1], repeat=n):
        K = np.array(bits, float)
        for gi, phi in enumerate(B.PHI):
            lp = eng.logphi[gi]
            for k in range(n):
                z = phi - eng.bmed[k] + ((K[eng.pa[k]] - 1) @ eng.w[k] if len(eng.pa[k]) else 0.0)
                lp += float(B.logsig(z if K[k] else -z))
            for it, score in obs:
                m = bool(K[eng.req[it.node]].prod())
                lp += float(B.ll(score / 10, B.resp(m, phi, eng.bmed[it.node], it)))
            p = math.exp(lp)
            tot += p
            marg += p * K
    return marg / tot


def check() -> None:
    g = load()
    cvc = "G1:LA001-01-a"
    keys = [g.nodes[p].key for p in g.parents[g.index[cvc]]] + [cvc]
    sg = subgraph(g, keys)
    print("subgraph:", [(k.split(":")[0], sg.nodes[i].label[:40]) for i, k in enumerate(keys)])
    print("task-graph row for CVC items:", [keys[i].split(":")[1][-12:] for i in sg.required(len(keys) - 1, B.MIN_STEP)])
    cv = sg.nodes[-1].items[0]
    ls = sg.nodes[0].items[0]
    scenarios = {
        "prior": [],
        "CVC wrong": [(cv, 1.0)],
        "CVC wrong, letter-sound right x2": [(cv, 1.0), (ls, 9.5), (ls, 9.0)],
        "CVC right x3": [(cv, 9.0), (cv, 9.5), (cv, 8.5)],
    }
    worst = 0.0
    for name, obs in scenarios.items():
        ex = exact(sg, obs)
        eng = B.BayesEngine(sg, chains=4000, seed=1, sweeps=30, learn=False)
        for it, s in obs:
            eng.observe(it, s)
        for _ in range(30):
            eng.sweep(range(sg.n))
        gb = np.array(eng.mastery())
        worst = max(worst, float(np.abs(ex - gb).max()))
        print(f"{name:34s} exact {np.round(ex, 2)}  gibbs {np.round(gb, 2)}")
    print(f"max |exact - gibbs| = {worst:.3f}  ->  {'PASS' if worst <= 0.04 else 'FAIL'} (tolerance 0.04)")


# ── run ─────────────────────────────────────────────────────────────────────

def diag(g: Graph, truth: TruthStudent, m: List[float], weak: str | None) -> Dict:
    tm = truth.mastered()
    acc = st.mean((p > 0.5) == t for p, t in zip(m, tm))
    brier = st.mean((p - t) ** 2 for p, t in zip(m, tm))
    pos = [p > 0.5 for p, t in zip(m, tm) if t]
    neg = [p <= 0.5 for p, t in zip(m, tm) if not t]
    bal = st.mean([st.mean(x) for x in (pos, neg) if x])
    out = {"acc": acc, "bal_acc": bal, "brier": brier, "truth_mastered": sum(tm)}
    if weak:
        idx = [k for k, nd in enumerate(g.nodes) if re.search(weak, nd.label.lower())]
        out["gap_acc"] = st.mean((m[k] > 0.5) == tm[k] for k in idx)
    return out


def xent(x: float, p: float) -> float:
    p = min(1 - 1e-6, max(1e-6, p))
    return -(x * math.log(p) + (1 - x) * math.log(1 - p))


def e1(g: Graph, persona: str, seed: int, n_items: int) -> Dict:
    truth = TruthStudent(g, PERSONAS_BY_SUBJECT[SUBJECT][persona], seed)
    eng = {"today": BaselineEngine(g), "bayes": B.BayesEngine(g, seed=seed)}
    loss = {k: [] for k in eng}
    cps = {}
    for t in range(1, n_items + 1):
        it = eng["today"].select(g.items)
        pred = {k: e.predict(it) for k, e in eng.items()}
        score = truth.answer_first(it, CHALLENGES)
        for k, e in eng.items():
            loss[k].append(xent(score / 10, pred[k]))
            e.observe(it, score, N_EFF)
        if t in CHECKPOINTS:
            cps[t] = {k: diag(g, truth, e.mastery(), PERSONAS_BY_SUBJECT[SUBJECT][persona].weak) for k, e in eng.items()}
    return {"loss": {k: st.mean(v) for k, v in loss.items()}, "checkpoints": cps}


def e2(g: Graph, persona: str, seed: int, n_items: int, which: str) -> Dict:
    truth = TruthStudent(g, PERSONAS_BY_SUBJECT[SUBJECT][persona], seed)
    e = (BaselineEngine(g) if which == "today" else LayeredEngine(g, seed=seed) if which.startswith("layered")
         else B.BayesEngine(g, seed=seed))
    pick = {"today": lambda: e.select(g.items),
            "bayes": lambda: e.select(g.items),
            "bayes_floor": lambda: e.select(g.items, min_p=0.6),
            "bayes_value": lambda: e.select_value(g.items),
            "layered_value": lambda: e.select_value(g.items),
            "layered_base": lambda: e._select_value_unweighted()}[which]
    weak = PERSONAS_BY_SUBJECT[SUBJECT][persona].weak
    front, on_gap = [], []
    start = sum(truth.mastered())
    succ, gap, streak, run, served = [], [], 0, 0, []
    cps = {}
    for t in range(1, n_items + 1):
        it = pick()
        gap.append(truth.prereq_gap(it.node))
        front.append(truth.on_frontier(it.node))
        on_gap.append(bool(weak and re.search(weak, g.nodes[it.node].label.lower())))
        score = truth.answer_first(it, CHALLENGES)
        ok = score >= PASS
        succ.append(ok)
        run = 0 if ok else run + 1
        streak = max(streak, run)
        served.append(g.nodes[it.node].key)
        e.observe(it, score, N_EFF)
        if t in CHECKPOINTS:
            cps[t] = diag(g, truth, e.mastery(), PERSONAS_BY_SUBJECT[SUBJECT][persona].weak)
    return {"success": st.mean(succ), "prereq_gap_share": st.mean(gap), "frontier_share": st.mean(front),
            "gap_node_share": st.mean(on_gap), "max_miss_streak": streak,
            "mastered_gain": sum(truth.mastered()) - start, "distinct_subskills": len(set(served)),
            "checkpoints": cps, "first_items": served[:8]}


_G: Dict[str, Graph] = {}


def _job(job) -> tuple:
    """One unit of work in a worker process: E1 for a child, or one E2 policy
    for a child. Small jobs keep every core busy to the end of a sweep."""
    global SUBJECT
    kind, cfg, persona, seed, n_items, policy = job
    learning, subject, transfer = cfg
    SUBJECT = subject
    truth_mod.LEARNING, truth_mod.TRANSFER = learning, transfer
    if subject not in _G:
        _G[subject] = load(subject)
    g = _G[subject]
    res = e1(g, persona, seed, n_items) if kind == "e1" else e2(g, persona, seed, n_items, policy)
    return kind, cfg, persona, seed, policy, res


def _single_thread_blas() -> None:
    """16 worker processes each running a multi-threaded BLAS fight for the
    cores; one thread per worker. Set before the pool spawns its workers."""
    for v in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS"):
        os.environ[v] = "1"


def sweep(configs: List[tuple], personas_of, seeds: int, n_items: int, workers: int, out_of) -> None:
    """Every (config x persona x seed x {E1, each policy}) job in ONE pool."""
    from concurrent.futures import ProcessPoolExecutor, as_completed
    _single_thread_blas()
    jobs = []
    for cfg in configs:
        for p in personas_of(cfg):
            for s in range(seeds):
                jobs.append(("e1", cfg, p, s, n_items, None))
                jobs += [("e2", cfg, p, s, n_items, w) for w in POLICIES]
    t0 = time.time()
    rows: Dict[tuple, Dict] = {}
    with ProcessPoolExecutor(max_workers=workers or os.cpu_count()) as pool:
        futs = [pool.submit(_job, j) for j in jobs]
        for i, f in enumerate(as_completed(futs), 1):
            kind, cfg, persona, seed, policy, res = f.result()
            r = rows.setdefault((cfg, persona, seed), {"persona": persona, "seed": seed, "e2": {}})
            if kind == "e1":
                r["e1"] = res
            else:
                r["e2"][policy] = res
            if i % max(1, len(jobs) // 10) == 0:
                print(f"[{time.time() - t0:6.0f}s] {i}/{len(jobs)} jobs", flush=True)
    for cfg in configs:
        out = out_of(cfg)
        out.mkdir(parents=True, exist_ok=True)
        cr = [r for (c, _, _), r in rows.items() if c == cfg]
        (out / "results.json").write_text(json.dumps(cr, indent=1), encoding="utf-8")
        global OUT
        OUT = out
        print(f"\n=== learning={cfg[0]} subject={cfg[1]} transfer={cfg[2]} -> {out}")
        summarize(cr, n_items)
    print(f"sweep done: {len(jobs)} jobs in {time.time() - t0:.0f}s")


def run(args) -> None:
    personas = args.personas or list(PERSONAS_BY_SUBJECT[args.subject])
    configs = [(lr, args.subject, tr) for lr in args.learning for tr in args.transfer]
    single = len(configs) == 1

    base = OUT

    def out_of(cfg):
        return base if single else base / f"{cfg[1].lower()}-{cfg[0]}-t{cfg[2]}"

    sweep(configs, lambda cfg: personas, args.seeds, args.items, args.workers, out_of)


def summarize(rows: List[Dict], n_items: int) -> None:
    def avg(f):
        v = [f(r) for r in rows_p if f(r) is not None]
        return st.mean(v) if v else float("nan")

    L = [f"# Learner-model lab — literacy K-G1, {n_items} items per child\n",
         "Synthetic children only. `today` = production per-skill theta update + Fisher x sigma^2 selection. "
         "`bayes` = subskill graph model (Jev pilot edges) with Gibbs inference + information-gain selection.\n",
         "## E1 — same items, same answers (estimation only)\n",
         "| Persona | Next-answer loss today | bayes | Balanced diagnosis acc today | bayes | Brier today | bayes | Gap-node acc today | bayes |",
         "|---|---|---|---|---|---|---|---|---|"]
    for p in dict.fromkeys(r["persona"] for r in rows):
        rows_p = [r for r in rows if r["persona"] == p]
        c = lambda r, k, m: r["e1"]["checkpoints"][n_items][k].get(m)
        L.append(f"| {p} | {avg(lambda r: r['e1']['loss']['today']):.3f} | {avg(lambda r: r['e1']['loss']['bayes']):.3f} | "
                 f"{avg(lambda r: c(r, 'today', 'bal_acc')):.2f} | {avg(lambda r: c(r, 'bayes', 'bal_acc')):.2f} | "
                 f"{avg(lambda r: c(r, 'today', 'brier')):.3f} | {avg(lambda r: c(r, 'bayes', 'brier')):.3f} | "
                 f"{avg(lambda r: c(r, 'today', 'gap_acc')):.2f} | {avg(lambda r: c(r, 'bayes', 'gap_acc')):.2f} |")
    L += ["\n## E2 — each engine picks its own items\n",
          "Three cells per metric: " + " / ".join(POLICIES) + ".\n",
          "| Persona | Balanced diagnosis acc | Success rate | Served with prereq missing | Served on true frontier | Items on the persona's gap | Max miss streak | Subskills mastered gain |",
          "|---|---|---|---|---|---|---|---|"]
    for p in dict.fromkeys(r["persona"] for r in rows):
        rows_p = [r for r in rows if r["persona"] == p]
        e = lambda r, w, m: r["e2"][w][m]
        c = lambda r, w, m: r["e2"][w]["checkpoints"][n_items].get(m)
        three = lambda f, fmt: " / ".join(format(avg(lambda r: f(r, w)), fmt) for w in POLICIES)
        L.append(f"| {p} | {three(lambda r, w: c(r, w, 'bal_acc'), '.2f')} | "
                 f"{three(lambda r, w: e(r, w, 'success'), '.2f')} | {three(lambda r, w: e(r, w, 'prereq_gap_share'), '.2f')} | "
                 f"{three(lambda r, w: e(r, w, 'frontier_share'), '.2f')} | {three(lambda r, w: e(r, w, 'gap_node_share'), '.2f')} | "
                 f"{three(lambda r, w: e(r, w, 'max_miss_streak'), '.1f')} | {three(lambda r, w: e(r, w, 'mastered_gain'), '.1f')} |")
    (OUT / "summary.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    print("\n".join(L))


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("check")
    r = sub.add_parser("run")
    r.add_argument("--items", type=int, default=60)
    r.add_argument("--seeds", type=int, default=4)
    r.add_argument("--personas", nargs="*")
    r.add_argument("--subject", default="LANGUAGE_ARTS", choices=["LANGUAGE_ARTS", "MATHEMATICS", "SCIENCE", "SOCIAL_STUDIES"])
    r.add_argument("--transfer", type=float, nargs="+", default=[0.0], help="truth model: share of easier-form practice reaching the harder skill")
    r.add_argument("--workers", type=int, default=0, help="processes; 0 = one per CPU")
    r.add_argument("--learning", nargs="+", default=["ready"], choices=["ready", "flat", "zone", "success"])
    r.add_argument("--out", default=None, help="report directory (default: the dated lab report)")
    s = sub.add_parser("summarize")
    s.add_argument("--items", type=int, default=60)
    a = ap.parse_args()
    if a.cmd == "check":
        check()
    elif a.cmd == "run":
        if a.out:
            global OUT
            OUT = Path(a.out)
        run(a)
    else:
        summarize(json.loads((OUT / "results.json").read_text(encoding="utf-8")), a.items)


if __name__ == "__main__":
    main()
