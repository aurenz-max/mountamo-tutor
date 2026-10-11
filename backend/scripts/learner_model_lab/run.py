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

OUT = ROOT / "backend" / "reports" / "learner-model-lab-2026-10-11"
CHECKPOINTS = (10, 20, 40, 60, 100)
PASS = 6.0
POLICIES = ("today", "bayes_value", "layered_value")
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
    e = (BaselineEngine(g) if which == "today" else LayeredEngine(g, seed=seed) if which == "layered_value"
         else B.BayesEngine(g, seed=seed))
    pick = {"today": lambda: e.select(g.items),
            "bayes": lambda: e.select(g.items),
            "bayes_floor": lambda: e.select(g.items, min_p=0.6),
            "bayes_value": lambda: e.select_value(g.items),
            "layered_value": lambda: e.select_value(g.items)}[which]
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


_G = None


def _child(job) -> Dict:
    """One simulated child: E1 plus every E2 policy. Runs in a worker process."""
    global _G, SUBJECT
    persona, seed, n_items, learning, subject = job
    SUBJECT = subject
    if _G is None:
        _G = load(subject)
    truth_mod.LEARNING = learning
    r = {"persona": persona, "seed": seed, "e1": e1(_G, persona, seed, n_items)}
    r["e2"] = {w: e2(_G, persona, seed, n_items, w) for w in POLICIES}
    return r


def run(args) -> None:
    from concurrent.futures import ProcessPoolExecutor
    import os
    OUT.mkdir(parents=True, exist_ok=True)
    personas = args.personas or list(PERSONAS_BY_SUBJECT[args.subject])
    jobs = [(p, s, args.items, args.learning, args.subject) for p in personas for s in range(args.seeds)]
    t0 = time.time()
    rows = []
    with ProcessPoolExecutor(max_workers=args.workers or os.cpu_count()) as pool:
        for r in pool.map(_child, jobs):
            rows.append(r)
            persona, seed = r["persona"], r["seed"]
            print(f"[{time.time() - t0:6.0f}s] {persona:16s} s{seed} "
                  f"loss today {r['e1']['loss']['today']:.3f} bayes {r['e1']['loss']['bayes']:.3f} | "
                  f"E2 acc " + " ".join(f"{w} {r['e2'][w]['checkpoints'][args.items]['acc']:.2f}" for w in POLICIES), flush=True)
    (OUT / "results.json").write_text(json.dumps(rows, indent=1), encoding="utf-8")
    summarize(rows, args.items)


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
          "Three cells per metric: today / bayes info gain with a 60% success floor / bayes frontier value.\n",
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
    r.add_argument("--subject", default="LANGUAGE_ARTS", choices=["LANGUAGE_ARTS", "MATHEMATICS"])
    r.add_argument("--workers", type=int, default=0, help="processes; 0 = one per CPU")
    r.add_argument("--learning", default="ready", choices=["ready", "flat", "zone", "success"])
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
