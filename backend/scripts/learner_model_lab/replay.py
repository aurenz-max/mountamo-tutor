"""
Replay: each engine predicts every challenge's FIRST-TRY result from only the
history before it, then sees the review. Same code for real and simulated
reviews (evidence.py).

Engines
  today        production theta update fed the review's final score (what
               production does now), evidence_n = the production testlet
               count 1 + 0.5 (N - 1), capped at 6
  today_first  the same update fed the first-try fraction instead
  bayes        the graph model fed the first-try fraction, same evidence_n

Scores per challenge: log loss (lower is better), AUC (does the engine rank
the misses below the hits), mean predicted P on misses vs on hits.

  pull  read-only copy of one student's reviews from Firestore
  sim   simulated children (Level A) on the curriculum walk
  real  student 1004's reviews, plus two permutation controls:
          shuffle-subskill  each review keeps its results but gets another
                            review's subskill (destroys skill structure)
          shuffle-time      reviews in random order (destroys learning order)

Usage (from backend/):
  venv/Scripts/python -m scripts.learner_model_lab.replay pull --student 1004
  venv/Scripts/python -m scripts.learner_model_lab.replay sim --subject MATHEMATICS
  venv/Scripts/python -m scripts.learner_model_lab.replay real --subject MATHEMATICS
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import statistics as st
import time
from concurrent.futures import ProcessPoolExecutor
from dataclasses import replace
from pathlib import Path
from typing import Dict, List

from app.services.calibration.problem_type_registry import get_item_discrimination, get_prior_beta

from . import bayes as B
from . import truth as truth_mod
from .baseline import BaselineEngine
from .evidence import Evidence, from_review, load_reviews, node_lookup
from .graph import ROOT, Item, load
from .layered import LayeredEngine
from .simsource import Simulator, harvest, usage
from .truth import PERSONAS_BY_SUBJECT, TruthStudent

LAB = ROOT / "backend" / "reports" / "learner-model-lab"   # gitignored; outputs and pulled reviews
REVIEWS_1004 = LAB / "reviews_1004.json"                   # template + real-replay source (refresh with `pull`)
ENGINES = ("today", "today_first", "bayes", "layered")


def n_eff(n: int) -> float:
    return min(6.0, 1.0 + 0.5 * (n - 1))


def xent(y: bool, p: float) -> float:
    p = min(1 - 1e-6, max(1e-6, p))
    return -math.log(p if y else 1 - p)


def auc(pairs) -> float | None:
    pos = [p for p, y in pairs if y]
    neg = [p for p, y in pairs if not y]
    if not pos or not neg:
        return None
    wins = sum((a > b) + 0.5 * (a == b) for a in pos for b in neg)
    return wins / (len(pos) * len(neg))


def replay(g, evidence: List[Evidence], seed: int = 0) -> Dict:
    eng = {"today": BaselineEngine(g), "today_first": BaselineEngine(g), "bayes": B.BayesEngine(g, seed=seed),
           "layered": LayeredEngine(g, seed=seed)}
    pairs = {k: [] for k in eng}
    first_pairs = {k: [] for k in eng}   # the first review on each subskill
    seen = set()
    for e in evidence:
        a, c = get_item_discrimination(e.primitive, e.mode)
        it = Item(node=e.node, mode=e.mode, beta=get_prior_beta(e.primitive, e.mode), a=a, c=c)
        new = e.node not in seen
        seen.add(e.node)
        for k, en in eng.items():
            p = en.predict(it)
            pairs[k].extend((p, y) for y in e.first)
            if new:
                first_pairs[k].extend((p, y) for y in e.first)
        first = 10.0 * sum(e.first) / len(e.first)
        n = n_eff(len(e.first))
        eng["today"].observe(it, e.final_score, n)
        eng["today_first"].observe(it, first, n)
        eng["bayes"].observe(it, first, n)
        eng["layered"].observe(it, first, n)
    out = {}
    for k, pr in pairs.items():
        miss = [p for p, y in pr if not y]
        hit = [p for p, y in pr if y]
        out[k] = {"loss": st.mean(xent(y, p) for p, y in pr), "auc": auc(pr),
                  "p_on_miss": st.mean(miss) if miss else None, "p_on_hit": st.mean(hit) if hit else None,
                  "challenges": len(pr), "misses": len(miss),
                  "first_loss": st.mean(xent(y, p) for p, y in first_pairs[k]) if first_pairs[k] else None,
                  "first_p": st.mean(p for p, _ in first_pairs[k]) if first_pairs[k] else None,
                  "first_acc": st.mean(y for _, y in first_pairs[k]) if first_pairs[k] else None,
                  "first_n": len(first_pairs[k])}
    return out


# ── sim ─────────────────────────────────────────────────────────────────────

_CTX: Dict = {}


def _sim_child(job):
    subject, persona, seed, n_reviews, learning = job
    if subject not in _CTX:
        g = load(subject)
        _CTX[subject] = (g, Simulator(g, harvest([REVIEWS_1004]), usage([REVIEWS_1004]), subject))
    g, sim = _CTX[subject]
    truth_mod.LEARNING = learning
    truth = TruthStudent(g, PERSONAS_BY_SUBJECT[subject][persona], seed)
    reviews = sim.stream(truth, n_reviews, seed)
    lookup = node_lookup(g)
    ev = [e for e in (from_review(r, lookup) for r in reviews) if e]
    return {"persona": persona, "seed": seed, "result": replay(g, ev, seed), "reviews": reviews}


def run_sim(a) -> None:
    out_dir = LAB / f"replay-sim-{a.subject.lower()}"
    out_dir.mkdir(parents=True, exist_ok=True)
    personas = a.personas or list(PERSONAS_BY_SUBJECT[a.subject])
    jobs = [(a.subject, p, s, a.reviews, a.learning) for p in personas for s in range(a.seeds)]
    t0 = time.time()
    rows = []
    with ProcessPoolExecutor(max_workers=a.workers or os.cpu_count()) as pool:
        for r in pool.map(_sim_child, jobs):
            rows.append(r)
            res = r["result"]
            print(f"[{time.time() - t0:5.0f}s] {r['persona']:15s} s{r['seed']} misses {res['bayes']['misses']:3d}/{res['bayes']['challenges']} "
                  + " ".join(f"{k} loss {v['loss']:.3f} auc {v['auc'] or 0:.2f}" for k, v in res.items()), flush=True)
    (out_dir / "sim_reviews.json").write_text(json.dumps([rv for r in rows for rv in r["reviews"]], indent=0), encoding="utf-8")
    (out_dir / "results.json").write_text(json.dumps([{k: v for k, v in r.items() if k != "reviews"} for r in rows], indent=1), encoding="utf-8")
    write_summary(out_dir, f"Simulated children (Level A), {a.subject}, {a.reviews} reviews each, learning rule `{a.learning}`",
                  {p: [r["result"] for r in rows if r["persona"] == p] for p in personas})


# ── real ────────────────────────────────────────────────────────────────────

def _real_job(job):
    subject, kind, seed = job
    g = load(subject)
    ev = load_reviews(REVIEWS_1004, g)
    rng = random.Random(1000 + seed)
    if kind == "shuffle-subskill":
        nodes = [e.node for e in ev]
        rng.shuffle(nodes)
        ev = [replace(e, node=n) for e, n in zip(ev, nodes)]
    elif kind == "shuffle-time":
        ev = ev[:]
        rng.shuffle(ev)
    return kind, len(ev), replay(g, ev, seed)


def run_real(a) -> None:
    jobs = [(a.subject, "real order", 0)] + [(a.subject, k, s) for s in range(a.perms) for k in ("shuffle-subskill", "shuffle-time")]
    groups: Dict[str, List[Dict]] = {"real order": [], "shuffle-subskill": [], "shuffle-time": []}
    t0 = time.time()
    with ProcessPoolExecutor(max_workers=os.cpu_count()) as pool:
        for kind, n, res in pool.map(_real_job, jobs):
            groups[kind].append(res)
            print(f"[{time.time() - t0:5.0f}s] {kind} done ({n} reviews)", flush=True)
    out_dir = LAB / f"replay-real-{a.subject.lower()}"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "results.json").write_text(json.dumps(groups, indent=1), encoding="utf-8")
    write_summary(out_dir, f"Student 1004, {a.subject}: {n} reviews on the pilot graph", groups)


def run_pull(a) -> None:
    """Read-only: students/{id}/reviews -> reports/learner-model-lab/reviews_{id}.json."""
    from app.db.firestore_service import FirestoreService
    c = FirestoreService().client
    docs = [d.to_dict() for d in c.collection("students").document(str(a.student)).collection("reviews").stream()]
    LAB.mkdir(parents=True, exist_ok=True)
    path = LAB / f"reviews_{a.student}.json"
    path.write_text(json.dumps(docs, default=str), encoding="utf-8")
    print(f"{len(docs)} reviews -> {path}")


def write_summary(out_dir: Path, title: str, groups: Dict[str, List[Dict]]) -> None:
    def avg(rs, k, m):
        v = [r[k][m] for r in rs if r[k][m] is not None]
        return f"{st.mean(v):.3f}" if v else "—"

    L = [f"# Replay — {title}\n", "First-try prediction per challenge. Cells: today / today fed first-try / bayes.\n",
         "| Group | Runs | Challenges | Misses | Log loss | AUC | Mean P on misses | Mean P on hits |",
         "|---|---|---|---|---|---|---|---|"]
    for name, rs in groups.items():
        cell = lambda m: " / ".join(avg(rs, k, m) for k in ENGINES)
        L.append(f"| {name} | {len(rs)} | {st.mean(r['bayes']['challenges'] for r in rs):.0f} | {st.mean(r['bayes']['misses'] for r in rs):.0f} | "
                 f"{cell('loss')} | {cell('auc')} | {cell('p_on_miss')} | {cell('p_on_hit')} | {cell('first_loss')} | "
                 f"{cell('first_p')} ({avg(rs, 'today', 'first_acc')}) |")
    (out_dir / "summary.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    print("\n".join(L))


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("sim")
    s.add_argument("--subject", default="MATHEMATICS")
    s.add_argument("--personas", nargs="*")
    s.add_argument("--seeds", type=int, default=3)
    s.add_argument("--reviews", type=int, default=150)
    s.add_argument("--learning", default="ready", choices=["ready", "flat", "zone", "success"])
    s.add_argument("--workers", type=int, default=0)
    r = sub.add_parser("real")
    r.add_argument("--subject", default="MATHEMATICS")
    r.add_argument("--perms", type=int, default=3)
    pl = sub.add_parser("pull")
    pl.add_argument("--student", type=int, default=1004)
    a = ap.parse_args()
    {"sim": run_sim, "real": run_real, "pull": run_pull}[a.cmd](a)


if __name__ == "__main__":
    main()
