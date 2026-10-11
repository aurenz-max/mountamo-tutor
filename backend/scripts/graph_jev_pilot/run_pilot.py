"""
Jev prerequisite-edge pilot — a parallel graph built from typed judgments,
for comparison against the published (Gemini-authored) graphs. READ-ONLY on
Firestore; writes only to the output directory.

For every target subskill, every subskill in the same or an earlier grade of the
same subject is a candidate. Each (candidate, target) pair gets two Jev Nouls,
with the candidate placed INSIDE the question (a shared state listing all
candidates gave flat, unusable probabilities in the smoke test):

  step         the candidate is performed as a step inside a target problem
  easier_form  the target is the same kind of task as the candidate, made harder

Pass 2 asks a fluency Noul only on pairs with step >= 0.5.

Usage (from backend/):
  venv/Scripts/python -m scripts.graph_jev_pilot.run_pilot dump
  venv/Scripts/python -m scripts.graph_jev_pilot.run_pilot judge [--only MATHEMATICS_G1]
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "backend" / "reports" / "graph-jev-pilot-2026-10-11"
ENDPOINT = "https://api.typesafe.ai/v1/systemone"
MODEL = "jev-latest"
SUBSKILL = re.compile(r"-[a-zA-Z]$")

# subject -> grade ids in learning order (Firestore graph suffixes)
SCOPE = {
    "MATHEMATICS": ["GK", "G1", "G2"],
    "LANGUAGE_ARTS": ["GK", "G1"],
}
CHUNK = 120          # questions per request
CONCURRENCY = 8


def _key() -> str:
    env = (ROOT / "my-tutoring-app" / ".env.local").read_text(encoding="utf-8")
    m = re.search(r"^TYPESAFE_API_KEY=(.*)$", env, re.M)
    return m.group(1).strip().strip("'\"")


# ── dump ────────────────────────────────────────────────────────────────────

async def dump() -> None:
    sys.path.insert(0, str(ROOT / "backend"))
    from app.db.firestore_service import FirestoreService
    fs = FirestoreService()
    OUT.mkdir(parents=True, exist_ok=True)
    out = {}
    for subject, grades in SCOPE.items():
        for g in grades:
            sid = f"{subject}_{g}"
            graph = await fs.get_curriculum_graph(sid, "published")
            body = (graph or {}).get("graph", {})
            nodes = [n for n in body.get("nodes", []) if (n.get("entity_type") or n.get("type")) == "subskill"]
            out[sid] = {"nodes": nodes, "edges": body.get("edges", [])}
            print(f"{sid}: {len(nodes)} subskills, {len(out[sid]['edges'])} edges")
    (OUT / "baseline_graphs.json").write_text(json.dumps(out, indent=1), encoding="utf-8")


# ── judge ───────────────────────────────────────────────────────────────────

def _skill(n: dict, grade: str) -> dict:
    return {"grade": grade.replace("GK", "Kindergarten").replace("G", "Grade "), "description": n["label"]}


def pair_questions(cand: dict, cgrade: str) -> dict:
    c = _skill(cand, cgrade)
    return {
        "step": {"type": "noul", "instructions": {
            "question": "Does solving a typical problem of `target_skill` require the student to carry out the candidate skill below as one of the steps inside it?",
            "candidate_skill": c},
            "criteria": {
                "true": "The candidate is a component the student actually performs while solving a target problem.",
                "false": "The candidate is not performed inside a target problem; it may be related, easier, or a different topic."}},
        "easier_form": {"type": "noul", "instructions": {
            "question": "Is `target_skill` the same kind of task as the candidate skill below, made harder (larger numbers or texts, an extra step, or less support), so that the candidate is normally learned first?",
            "candidate_skill": c},
            "criteria": {
                "true": "The target extends the candidate: same task, harder version.",
                "false": "The target is a different kind of task, or the candidate is not an easier version of it."}},
    }


def fluency_question(cand: dict, cgrade: str) -> dict:
    return {"fluency": {"type": "noul", "instructions": {
        "question": "While solving a `target_skill` problem, the student also has to keep track of the rest of the problem. If the student can do the candidate skill below only slowly and effortfully (for example by counting one by one or sounding out every letter), would that effort stop them from completing the target problem?",
        "candidate_skill": _skill(cand, cgrade)},
        "criteria": {
            "true": "The candidate must be automatic (fast, from memory) for the target to be manageable.",
            "false": "Doing the candidate slowly is fine; the target can still be completed."}}}


async def _post(client, sem, state, questions, stats) -> dict:
    body = {"state": state, "model": MODEL, "questions": questions}
    for attempt in range(6):
        async with sem:
            try:
                r = await client.post(ENDPOINT, json=body, timeout=120)
            except httpx.HTTPError as e:
                err = str(e); r = None
        if r is not None and r.status_code == 200:
            j = r.json()
            stats["in"] += j["usage"]["input_tokens"]; stats["out"] += j["usage"]["output_tokens"]
            return j["answers"]
        err = f"{r.status_code} {r.text[:200]}" if r is not None else err
        await asyncio.sleep(2 ** attempt)
    raise RuntimeError(f"TypeSafe failed: {err}")


async def judge(only: list[str] | None) -> None:
    base = json.loads((OUT / "baseline_graphs.json").read_text(encoding="utf-8"))
    cache_path = OUT / "jev_answers.json"
    cache = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
    stats = {"in": 0, "out": 0}
    sem = asyncio.Semaphore(CONCURRENCY)
    headers = {"Authorization": f"Bearer {_key()}", "Content-Type": "application/json"}
    t0 = time.time()
    async with httpx.AsyncClient(headers=headers) as client:
        for subject, grades in SCOPE.items():
            for gi, tg in enumerate(grades):
                tsid = f"{subject}_{tg}"
                if only and tsid not in only:
                    continue
                pool = [(n, g) for g in grades[: gi + 1] for n in base[f"{subject}_{g}"]["nodes"]]
                jobs = []
                for t in base[tsid]["nodes"]:
                    state = {"target_skill": _skill(t, tg)}
                    todo = [(c, cg) for c, cg in pool
                            if c["id"] != t["id"] and f"{c['id']}>{t['id']}" not in cache]
                    per = CHUNK // 2
                    for i in range(0, len(todo), per):
                        jobs.append((t, state, todo[i:i + per]))

                async def run(job):
                    t, state, batch = job
                    qs = {}
                    for k, (c, cg) in enumerate(batch):
                        for name, q in pair_questions(c, cg).items():
                            qs[f"{name}_{k}"] = q
                    ans = await _post(client, sem, state, qs, stats)
                    for k, (c, cg) in enumerate(batch):
                        cache[f"{c['id']}>{t['id']}"] = {
                            "source": c["id"], "source_grade": cg, "target": t["id"], "target_grade": tg,
                            "subject": subject,
                            "step": ans[f"step_{k}"]["noul"], "easier_form": ans[f"easier_form_{k}"]["noul"]}

                print(f"{tsid}: {len(jobs)} requests", flush=True)
                for i in range(0, len(jobs), 40):
                    await asyncio.gather(*(run(j) for j in jobs[i:i + 40]))
                    cache_path.write_text(json.dumps(cache), encoding="utf-8")
                    print(f"  {min(i + 40, len(jobs))}/{len(jobs)}  tokens in={stats['in']:,}  {time.time() - t0:.0f}s", flush=True)

        # pass 2: fluency on likely steps
        nodes = {n["id"]: n for sid, g in base.items() for n in g["nodes"]}
        need = [v for v in cache.values() if v["step"] >= 0.5 and "fluency" not in v
                and (not only or f"{v['subject']}_{v['target_grade']}" in only)]
        by_target: dict[str, list] = {}
        for v in need:
            by_target.setdefault(v["target"], []).append(v)

        async def run_f(tid, rows):
            t = nodes[tid]
            qs = {}
            for k, v in enumerate(rows):
                qs[f"fluency_{k}"] = fluency_question(nodes[v["source"]], v["source_grade"])["fluency"]
            ans = await _post(client, sem, {"target_skill": _skill(t, rows[0]["target_grade"])}, qs, stats)
            for k, v in enumerate(rows):
                v["fluency"] = ans[f"fluency_{k}"]["noul"]

        print(f"fluency pass: {len(need)} pairs", flush=True)
        await asyncio.gather(*(run_f(t, r) for t, r in by_target.items()))
        cache_path.write_text(json.dumps(cache), encoding="utf-8")
    cost = stats["in"] / 26e6
    print(f"done: {len(cache)} pairs judged; tokens in={stats['in']:,} out={stats['out']:,} (~${cost:.2f}); {time.time() - t0:.0f}s")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("cmd", choices=["dump", "judge"])
    p.add_argument("--only", nargs="*")
    a = p.parse_args()
    asyncio.run(dump() if a.cmd == "dump" else judge(a.only))


if __name__ == "__main__":
    main()
