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
from .kst import SimpleEngine
from .layered import LayeredEngine
from .simsource import Simulator, harvest, usage
from .truth import PERSONAS_BY_SUBJECT, TruthStudent

LAB = ROOT / "backend" / "reports" / "learner-model-lab"   # gitignored; outputs and pulled reviews
REVIEWS_1004 = LAB / "reviews_1004.json"                   # template + real-replay source (refresh with `pull`)
ENGINES = ("today", "today_first", "bayes", "layered")
GRADE_OF_RECORD = 0   # 1004 is in kindergarten


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


def replay(g, evidence: List[Evidence], seed: int = 0, engines=ENGINES, keep: Dict | None = None) -> Dict:
    make = {"today": lambda: BaselineEngine(g), "today_first": lambda: BaselineEngine(g),
            "bayes": lambda: B.BayesEngine(g, seed=seed), "layered": lambda: LayeredEngine(g, seed=seed),
            "simple": lambda: SimpleEngine(g, grade=GRADE_OF_RECORD)}
    eng = {k: make[k]() for k in engines}
    if keep is not None:
        keep.update(eng)
    pairs = {k: [] for k in eng}
    first_pairs = {k: [] for k in eng}   # the first review on each subskill
    first_rows = {k: [] for k in eng}    # (node, predicted P, first-try right, challenges) per first review
    after_easy = {k: [] for k in eng}    # reviews of k after an easier form of k was practised
    e_parents: Dict[int, set] = {}
    for j in range(g.n):
        for k, _ in g.easier_children(j, g.parents):
            e_parents.setdefault(k, set()).add(j)
    seen = set()
    for e in evidence:
        it = g.make_item(e.node, e.primitive, e.mode)
        new = e.node not in seen
        easy_before = bool(e_parents.get(e.node, set()) & seen)
        seen.add(e.node)
        for k, en in eng.items():
            p = en.predict(it)
            pairs[k].extend((p, y) for y in e.first)
            if new:
                first_pairs[k].extend((p, y) for y in e.first)
                first_rows[k].append((e.node, p, sum(e.first), len(e.first)))
            if easy_before:
                after_easy[k].extend((p, y) for y in e.first)
        first = 10.0 * sum(e.first) / len(e.first)
        n = n_eff(len(e.first))
        for k, en in eng.items():
            en.observe(it, e.final_score if k == "today" else first, n)
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
                  "first_n": len(first_pairs[k]),
                  "first_rows": first_rows[k],
                  "after_easy_loss": st.mean(xent(y, p) for p, y in after_easy[k]) if after_easy[k] else None,
                  "after_easy_n": len(after_easy[k]),
                  "after_easy_acc": st.mean(y for _, y in after_easy[k]) if after_easy[k] else None,
                  "after_easy_p": st.mean(p for p, _ in after_easy[k]) if after_easy[k] else None}
    return out


# ── transfer: how much easier-form practice transfers, measured on real data ─

def _transfer_job(job):
    subject, transfer, path = job
    B.TRANSFER = transfer
    g = load(subject)
    ev = load_reviews(Path(path), g)
    return transfer, replay(g, ev, 0, engines=("layered",))["layered"]


def run_transfer(a) -> None:
    """Replay a real student's reviews through the two-layer model at several
    TRANSFER values. The value whose predictions fit best (lowest log loss,
    above all on subskills met after their easier form) is the data's
    estimate of how much easier-form practice transfers."""
    os.environ.setdefault("OMP_NUM_THREADS", "1")
    path = LAB / f"reviews_{a.student}.json"
    jobs = [(a.subject, t, str(path)) for t in a.values]
    rows = []
    with ProcessPoolExecutor(max_workers=len(jobs)) as pool:
        for t, res in pool.map(_transfer_job, jobs):
            rows.append((t, res))
            print(f"transfer {t:.2f}: loss {res['loss']:.4f} | after easier form: n={res['after_easy_n']} "
                  f"loss {res['after_easy_loss'] or 0:.4f} predicted {res['after_easy_p'] or 0:.3f} actual {res['after_easy_acc'] or 0:.3f}", flush=True)
    out = LAB / f"transfer-{a.subject.lower()}-{a.student}.json"
    out.write_text(json.dumps(rows, indent=1), encoding="utf-8")
    print(f"-> {out}")


# ── anchor: skill location (7.13) on student 1004 ─────────────────────────

# "+chain": non-root priors from the Jev link conditionals (bayes.CHAIN)
ANCHOR_CONFIGS = [("off", 1.0), ("grade", 1.0), ("grade+chain", 1.0), ("grade+lor", 1.0)]
OVERREACH_GRADES = ("G3", "G4", "G5")   # >= 2 grades above 1004's grade of record (K)


def _per_grade(g, m, seen) -> Dict:
    from .graph import GRADE_INDEX
    out = {}
    for gr in GRADE_INDEX:
        ks = [k for k, nd in enumerate(g.nodes) if nd.grade == gr]
        un = [k for k in ks if k not in seen]
        out[gr] = {"n": len(ks), "seen": len(ks) - len(un), "mastered": sum(m[k] > 0.5 for k in ks),
                   "untouched_mastered": sum(m[k] > 0.5 for k in un),
                   "untouched_max": max((m[k] for k in un), default=0.0)}
    return out


def _first_loss(g, rows, low: bool):
    """Per-challenge log loss on first reviews, K-G1 subskills (low) or G2+."""
    from .graph import GRADE_INDEX
    tot = n = 0.0
    for node, p, right, cnt in rows:
        if (GRADE_INDEX[g.nodes[node].grade] <= 1) == low:
            tot += right * xent(True, p) + (cnt - right) * xent(False, p)
            n += cnt
    return (tot / n if n else None), int(n)


def _anchor_job(job):
    subject, anchor, step = job
    from . import graph as G
    G.ANCHOR, G.GRADE_STEP = anchor.split("+")[0], step
    B.CHAIN = "lor" if anchor.endswith("+lor") else anchor.endswith("+chain")
    g = load(subject)
    ev = load_reviews(REVIEWS_1004, g)
    eng: Dict = {}
    res = replay(g, ev, 0, engines=("today", "layered"), keep=eng)
    per_grade = _per_grade(g, eng["layered"].mastery(), {e.node for e in ev})
    fr = res["layered"]["first_rows"]
    # the claim under test: evidence on K-G1 alone must not make G3+ mastered
    low = [e for e in ev if G.GRADE_INDEX[g.nodes[e.node].grade] <= 1]
    eng_low: Dict = {}
    replay(g, low, 0, engines=("layered",), keep=eng_low)
    pg_low = _per_grade(g, eng_low["layered"].mastery(), {e.node for e in low})
    worst = max(pg_low[gr]["untouched_max"] for gr in OVERREACH_GRADES)
    return {"anchor": anchor, "step": step, "reviews": len(ev), "low_reviews": len(low), "result": res,
            "per_grade": per_grade, "per_grade_low": pg_low,
            "first_loss_k1": _first_loss(g, fr, True), "first_loss_g2up": _first_loss(g, fr, False),
            "overreach_max": worst, "overreach_pass": worst < 0.5}


def run_anchor(a) -> None:
    """Replay 1004 under each skill-location setting: prediction quality, and
    how many subskills the model calls mastered per grade. Assertion: a K
    student's untouched G3+ subskills all stay below P(mastered) 0.5."""
    os.environ.setdefault("OMP_NUM_THREADS", "1")
    jobs = [(a.subject, an, st_) for an, st_ in ANCHOR_CONFIGS]
    with ProcessPoolExecutor(max_workers=len(jobs)) as pool:
        rows = list(pool.map(_anchor_job, jobs))
    f3 = lambda v: "—" if v is None else f"{v:.3f}"
    k1n, hin = rows[0]["first_loss_k1"][1], rows[0]["first_loss_g2up"][1]
    L = [f"# Skill location (7.13) — student 1004, {a.subject}\n",
         "Layered model replaying 1004's reviews. `today` is the production per-skill estimator (registry betas, unchanged by the anchor).\n",
         "## All reviews\n",
         f"| Anchor | Step | Loss layered (today) | AUC layered (today) | First-encounter loss K-G1 ({k1n} ch) | G2+ ({hin} ch) | Mastered K / G1 / G2 / G3 / G4 / G5 | Untouched G3-G5 mastered |",
         "|---|---|---|---|---|---|---|---|"]
    for r in rows:
        ly, td, pg = r["result"]["layered"], r["result"]["today"], r["per_grade"]
        L.append(f"| {r['anchor']} | {r['step']} | {ly['loss']:.3f} ({td['loss']:.3f}) | {ly['auc'] or 0:.3f} ({td['auc'] or 0:.3f}) | "
                 f"{f3(r['first_loss_k1'][0])} | {f3(r['first_loss_g2up'][0])} | " + " / ".join(str(pg[gr]['mastered']) for gr in pg) + " | "
                 f"{sum(pg[gr]['untouched_mastered'] for gr in OVERREACH_GRADES)} |")
    L += [f"\n## K-G1 reviews only ({rows[0]['low_reviews']}) — assertion: no untouched G3+ subskill reaches P(mastered) 0.5\n",
          "| Anchor | Step | Mastered K / G1 / G2 / G3 / G4 / G5 | Untouched G3-G5 mastered | Max P untouched G3+ | Assertion |",
          "|---|---|---|---|---|---|"]
    for r in rows:
        pg = r["per_grade_low"]
        L.append(f"| {r['anchor']} | {r['step']} | " + " / ".join(str(pg[gr]['mastered']) for gr in pg) + " | "
                 f"{sum(pg[gr]['untouched_mastered'] for gr in OVERREACH_GRADES)} | {r['overreach_max']:.2f} | "
                 f"{'PASS' if r['overreach_pass'] else 'FAIL'} |")
    seen = " / ".join(f"{gr} {rows[0]['per_grade'][gr]['seen']}/{rows[0]['per_grade'][gr]['n']}" for gr in rows[0]["per_grade"])
    L.append(f"\nSubskills 1004 has reviews on (seen/total): {seen}. Reviews: {rows[0]['reviews']}.")
    out = LAB / f"anchor-{a.subject.lower()}-1004"
    out.mkdir(parents=True, exist_ok=True)
    (out / "results.json").write_text(json.dumps(rows, indent=1), encoding="utf-8")
    (out / "summary.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    print("\n".join(L))


# ── kst: the simple model (rules over the graph) against the layered model ─

def _kst_job(job):
    subject, which = job
    g = load(subject)
    ev = load_reviews(REVIEWS_1004, g)
    from .graph import GRADE_INDEX
    if which == "K-G1 only":
        ev = [e for e in ev if GRADE_INDEX[g.nodes[e.node].grade] <= 1]
    eng: Dict = {}
    res = replay(g, ev, 0, engines=("today", "layered", "simple"), keep=eng)
    seen = {e.node for e in ev}
    out = {"which": which, "reviews": len(ev), "result": {k: {m: v for m, v in r.items() if m != "first_rows"} for k, r in res.items()}}
    for k in ("layered", "simple"):
        out[k] = {"per_grade": _per_grade(g, eng[k].mastery(), seen),
                  "first_k1": _first_loss(g, res[k]["first_rows"], True), "first_g2": _first_loss(g, res[k]["first_rows"], False)}
    rd = eng["simple"].ready()
    fr = eng["layered"].frontier().mean(axis=0)
    out["simple"]["ready"] = [g.nodes[k].key for k in range(g.n) if rd[k]]
    out["layered"]["ready"] = [g.nodes[k].key for k in range(g.n) if fr[k] > 0.3 and k not in seen]
    out["labels"] = {nd.key: nd.label.split("\n")[0][:80] for nd in g.nodes}
    return out


def run_kst(a) -> None:
    import collections
    from .graph import GRADE_INDEX
    os.environ.setdefault("OMP_NUM_THREADS", "1")
    with ProcessPoolExecutor(max_workers=2) as pool:
        rows = list(pool.map(_kst_job, [(a.subject, "all reviews"), (a.subject, "K-G1 only")]))
    f3 = lambda v: "—" if v is None else f"{v:.3f}"
    L = [f"# Simple model (knowledge-space rules) vs layered — student 1004, {a.subject}\n"]
    for r in rows:
        res = r["result"]
        L += [f"## {r['which']} ({r['reviews']} reviews)\n",
              "| Engine | Loss | AUC | First-encounter loss K-G1 | G2+ | Known K / G1 / G2 / G3 / G4 / G5 | Untouched G3-G5 known | Ready by grade |",
              "|---|---|---|---|---|---|---|---|",
              f"| today | {res['today']['loss']:.3f} | {res['today']['auc'] or 0:.3f} | | | | | |"]
        for k in ("layered", "simple"):
            pg = r[k]["per_grade"]
            rg = collections.Counter(x.split(":")[0] for x in r[k]["ready"])
            L.append(f"| {k} | {res[k]['loss']:.3f} | {res[k]['auc'] or 0:.3f} | {f3(r[k]['first_k1'][0])} | {f3(r[k]['first_g2'][0])} | "
                     + " / ".join(str(pg[gr]['mastered']) for gr in pg) + f" | {sum(pg[gr]['untouched_mastered'] for gr in OVERREACH_GRADES)} | "
                     + ", ".join(f"{gr} {rg[gr]}" for gr in GRADE_INDEX if rg[gr]) + " |")
        L.append("\nSimple model, ready to learn (first 8): " + "; ".join(f"{x} {r['labels'][x][:50]}" for x in r["simple"]["ready"][:8]) + "\n")
    out = LAB / f"kst-{a.subject.lower()}-1004"
    out.mkdir(parents=True, exist_ok=True)
    (out / "results.json").write_text(json.dumps(rows, indent=1), encoding="utf-8")
    (out / "summary.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    print("\n".join(L))


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
    tr = sub.add_parser("transfer")
    tr.add_argument("--subject", default="MATHEMATICS")
    tr.add_argument("--student", type=int, default=1004)
    tr.add_argument("--values", type=float, nargs="+", default=[0.0, 0.15, 0.3, 0.6, 1.0])
    an = sub.add_parser("anchor")
    an.add_argument("--subject", default="MATHEMATICS")
    ks = sub.add_parser("kst")
    ks.add_argument("--subject", default="MATHEMATICS")
    pl = sub.add_parser("pull")
    pl.add_argument("--student", type=int, default=1004)
    a = ap.parse_args()
    {"sim": run_sim, "real": run_real, "pull": run_pull, "transfer": run_transfer, "anchor": run_anchor, "kst": run_kst}[a.cmd](a)


if __name__ == "__main__":
    main()
