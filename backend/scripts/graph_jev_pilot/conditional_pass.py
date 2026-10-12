"""
Conditional probabilities on the learner graph's links (7.13).

The pilot asked whether a link EXISTS (step / easier_form / fluency): Jev's
yes-probability there is confidence in the relationship, not its strength.
This pass asks, for every published link candidate A -> target B, the two
numbers a Bayesian network needs on that link:

  without  A student cannot yet do A. Would they answer a typical B problem
           correctly?                          -> P(B right | A not known)
  with     A student can reliably do A and has not been taught B. Would they
           answer a typical B problem correctly? -> P(B right | A known, B untaught)

Jev's yes-probability is the conditional. Links come from the published
learner graph (reports/.../publish/{SUBJECT}.json, every listed parent).

Usage (from backend/):
  venv/Scripts/python -m scripts.graph_jev_pilot.conditional_pass smoke --subject MATHEMATICS
  venv/Scripts/python -m scripts.graph_jev_pilot.conditional_pass run --subject MATHEMATICS
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import re
import time

import httpx

from .run_pilot import OUT, _key, _post

CONCURRENCY = 8
GRADE_ID = {"Kindergarten": "GK", "1": "G1", "2": "G2", "3": "G3", "4": "G4", "5": "G5"}
GRADE_NAME = {"GK": "Kindergarten", "G1": "Grade 1", "G2": "Grade 2", "G3": "Grade 3", "G4": "Grade 4", "G5": "Grade 5"}
SMOKE_TARGETS = r"times table|multipl|equal groups|repeated addition|end time|future time"


def _labels(subject: str) -> dict:
    """grade:id -> full label, from the dumped published curriculum graphs."""
    base = json.loads((OUT / "baseline_graphs.json").read_text(encoding="utf-8"))
    out = {}
    for sid, g in base.items():
        subj, gr = sid.rsplit("_", 1)
        if subj == subject:
            for n in g["nodes"]:
                out[f"{gr}:{n['id']}"] = n["label"]
    return out


def _links(subject: str) -> list:
    """(parent key, target key, relation, step) for every listed parent, keys grade:id (GK..G5)."""
    pub = json.loads((OUT / "publish" / f"{subject}.json").read_text(encoding="utf-8"))
    rows = []
    for v in pub["nodes"].values():
        t = f"{GRADE_ID[v['grade']]}:{v['subskill_id']}"
        for p in v["parents"]:
            pg, pid = p["key"].split(":", 1)
            rows.append((f"{GRADE_ID[pg]}:{pid}", t, p["relation"], p["step"], p.get("in_model", False)))
    return rows


def _skill(key: str, labels: dict) -> dict:
    return {"grade": GRADE_NAME[key.split(":", 1)[0]], "description": labels[key]}


def _questions(parent: dict) -> dict:
    return {
        "without": {"type": "noul", "instructions": {
            "question": "A student cannot yet do the prerequisite skill below. Would this student answer a typical `target_skill` problem correctly?",
            "prerequisite_skill": parent},
            "criteria": {
                "true": "The student would usually still get a typical target problem right without the prerequisite (by another method, a memorised fact, or because it is not really needed).",
                "false": "Without the prerequisite the student would usually get a typical target problem wrong."}},
        "with": {"type": "noul", "instructions": {
            "question": "A student can reliably do the prerequisite skill below but has never been taught `target_skill`. Would this student answer a typical `target_skill` problem correctly?",
            "prerequisite_skill": parent},
            "criteria": {
                "true": "Knowing the prerequisite is usually enough for the student to get a typical target problem right without being taught it.",
                "false": "Even with the prerequisite, the student would usually get a typical target problem wrong until taught."}},
    }


async def judge(subject: str, links: list, labels: dict, out_path) -> dict:
    cache = json.loads(out_path.read_text(encoding="utf-8")) if out_path.exists() else {}
    todo = [l for l in links if f"{l[0]}>{l[1]}" not in cache and l[0] in labels and l[1] in labels]
    by_t: dict = {}
    for l in todo:
        by_t.setdefault(l[1], []).append(l)
    stats = {"in": 0, "out": 0}
    sem = asyncio.Semaphore(CONCURRENCY)
    headers = {"Authorization": f"Bearer {_key()}", "Content-Type": "application/json"}
    t0 = time.time()
    async with httpx.AsyncClient(headers=headers) as client:
        async def run(t, rows):
            qs = {}
            for k, (p, *_rest) in enumerate(rows):
                for name, q in _questions(_skill(p, labels)).items():
                    qs[f"{name}_{k}"] = q
            ans = await _post(client, sem, {"target_skill": _skill(t, labels)}, qs, stats)
            for k, (p, tt, rel, step, in_model) in enumerate(rows):
                cache[f"{p}>{tt}"] = {"parent": p, "target": tt, "subject": subject, "relation": rel, "step": step,
                                      "in_model": in_model, "p_without": ans[f"without_{k}"]["noul"],
                                      "p_with": ans[f"with_{k}"]["noul"]}

        items = list(by_t.items())
        for i in range(0, len(items), 40):
            await asyncio.gather(*(run(t, r) for t, r in items[i:i + 40]))
            out_path.write_text(json.dumps(cache, indent=0), encoding="utf-8")
            print(f"  {min(i + 40, len(items))}/{len(items)} targets  tokens in={stats['in']:,}  {time.time() - t0:.0f}s", flush=True)
    print(f"done: {len(todo)} links; tokens in={stats['in']:,} (~${stats['in'] / 26e6:.2f})")
    return cache


def report(cache: dict, labels: dict, keys=None) -> None:
    rows = [v for k, v in cache.items() if keys is None or k in keys]
    for rel in ("R", "E", "related"):
        rs = [v for v in rows if v["relation"] == rel]
        if rs:
            w = sorted(v["p_without"] for v in rs)
            h = sorted(v["p_with"] for v in rs)
            q = lambda x: f"p10 {x[len(x) // 10]:.2f} med {x[len(x) // 2]:.2f} p90 {x[9 * len(x) // 10]:.2f}"
            print(f"{rel:8s} n={len(rs):4d}  P(right | not A): {q(w)}   P(right | A, untaught): {q(h)}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["smoke", "run", "report"])
    ap.add_argument("--subject", default="MATHEMATICS")
    ap.add_argument("--targets", type=int, default=16, help="smoke: number of target subskills")
    a = ap.parse_args()
    labels = _labels(a.subject)
    links = _links(a.subject)
    if a.cmd == "smoke":
        out = OUT / f"jev_conditionals_smoke_{a.subject.lower()}.json"
        rng = random.Random(0)
        tg = sorted({l[1] for l in links})
        pick = [t for t in tg if re.search(SMOKE_TARGETS, labels.get(t, ""), re.I)][: a.targets // 2]
        pick += rng.sample([t for t in tg if t not in pick], a.targets - len(pick))
        sel = [l for l in links if l[1] in set(pick)]
        cache = asyncio.run(judge(a.subject, sel, labels, out))
        report(cache, labels)
        for t in pick:
            print(f"\n{t}  {labels[t][:90]}")
            for v in sorted((v for v in cache.values() if v["target"] == t), key=lambda v: -v["step"]):
                print(f"   {v['relation']:7s} step {v['step']:.2f}  not-A {v['p_without']:.2f}  A {v['p_with']:.2f}  <- {v['parent']:18s} {labels[v['parent']][:60]}")
    else:
        out = OUT / f"jev_conditionals_{a.subject.lower()}.json"
        cache = asyncio.run(judge(a.subject, links, labels, out)) if a.cmd == "run" else json.loads(out.read_text(encoding="utf-8"))
        report(cache, labels)


if __name__ == "__main__":
    main()
