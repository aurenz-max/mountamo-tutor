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

Candidates come from the target's grade and the `--window` grades before it
(default 2), so cross-grade edges come out of the same run. Answers are keyed
`grade:id>grade:id` (bare ids repeat across grades); entries from the 10-11
pilot keep their bare keys and are recognised by their grade fields.

Usage (from backend/):
  venv/Scripts/python -m scripts.graph_jev_pilot.run_pilot dump --subjects MATHEMATICS
  venv/Scripts/python -m scripts.graph_jev_pilot.run_pilot judge --subjects MATHEMATICS --grades G3 G4 G5
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

# grade ids in learning order (Firestore graph suffixes)
GRADES = ["GK", "G1", "G2", "G3", "G4", "G5"]
SUBJECTS = ["MATHEMATICS", "LANGUAGE_ARTS", "SCIENCE", "SOCIAL_STUDIES"]
WINDOW = 2           # candidate grades before the target grade
CHUNK = 120          # questions per request
CONCURRENCY = 8


def _key() -> str:
    env = (ROOT / "my-tutoring-app" / ".env.local").read_text(encoding="utf-8")
    m = re.search(r"^TYPESAFE_API_KEY=(.*)$", env, re.M)
    return m.group(1).strip().strip("'\"")


# ── dump ────────────────────────────────────────────────────────────────────

async def dump(subjects: list[str]) -> None:
    """Fetch published subskill graphs and merge them into baseline_graphs.json."""
    sys.path.insert(0, str(ROOT / "backend"))
    from app.db.firestore_service import FirestoreService
    fs = FirestoreService()
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / "baseline_graphs.json"
    out = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    for subject in subjects:
        for g in GRADES:
            sid = f"{subject}_{g}"
            try:
                graph = await fs.get_curriculum_graph(sid, "published")
            except Exception as e:  # a grade without a published graph
                print(f"{sid}: no graph ({e})")
                continue
            body = (graph or {}).get("graph", {})
            nodes = [n for n in body.get("nodes", []) if (n.get("entity_type") or n.get("type")) == "subskill"]
            out[sid] = {"nodes": nodes, "edges": body.get("edges", [])}
            print(f"{sid}: {len(nodes)} subskills, {len(out[sid]['edges'])} edges")
    path.write_text(json.dumps(out, indent=1), encoding="utf-8")


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


def _qkey(cg: str, cid: str, tg: str, tid: str) -> str:
    return f"{cg}:{cid}>{tg}:{tid}"


async def judge(subjects: list[str], targets: list[str] | None, window: int) -> None:
    base = json.loads((OUT / "baseline_graphs.json").read_text(encoding="utf-8"))
    cache_path = OUT / "jev_answers.json"
    cache = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
    stats = {"in": 0, "out": 0}
    sem = asyncio.Semaphore(CONCURRENCY)
    headers = {"Authorization": f"Bearer {_key()}", "Content-Type": "application/json"}
    t0 = time.time()
    # the 10-11 pilot stored bare keys; recognise them by their grade fields
    done = {_qkey(v["source_grade"], v["source"], v["target_grade"], v["target"]) for v in cache.values()}
    only = set()
    async with httpx.AsyncClient(headers=headers) as client:
        for subject in subjects:
            grades = [g for g in GRADES if f"{subject}_{g}" in base]
            for gi, tg in enumerate(grades):
                tsid = f"{subject}_{tg}"
                if targets and tg not in targets:
                    continue
                only.add(tsid)
                pool = [(n, g) for g in grades[max(0, gi - window): gi + 1] for n in base[f"{subject}_{g}"]["nodes"]]
                jobs = []
                for t in base[tsid]["nodes"]:
                    state = {"target_skill": _skill(t, tg)}
                    todo = [(c, cg) for c, cg in pool
                            if not (c["id"] == t["id"] and cg == tg) and _qkey(cg, c["id"], tg, t["id"]) not in done]
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
                        done.add(_qkey(cg, c["id"], tg, t["id"]))
                        cache[_qkey(cg, c["id"], tg, t["id"])] = {
                            "source": c["id"], "source_grade": cg, "target": t["id"], "target_grade": tg,
                            "subject": subject,
                            "step": ans[f"step_{k}"]["noul"], "easier_form": ans[f"easier_form_{k}"]["noul"]}

                print(f"{tsid}: {len(jobs)} requests", flush=True)
                for i in range(0, len(jobs), 40):
                    await asyncio.gather(*(run(j) for j in jobs[i:i + 40]))
                    cache_path.write_text(json.dumps(cache), encoding="utf-8")
                    print(f"  {min(i + 40, len(jobs))}/{len(jobs)}  tokens in={stats['in']:,}  {time.time() - t0:.0f}s", flush=True)

        # pass 2: fluency on likely steps
        nodes = {(sid.rsplit("_", 1)[1], n["id"]): n for sid, g in base.items() for n in g["nodes"]}
        need = [v for v in cache.values() if v["step"] >= 0.5 and "fluency" not in v
                and f"{v['subject']}_{v['target_grade']}" in only]
        by_target: dict[tuple, list] = {}
        for v in need:
            by_target.setdefault((v["target_grade"], v["target"]), []).append(v)

        async def run_f(tkey, rows):
            t = nodes[tkey]
            qs = {}
            for k, v in enumerate(rows):
                qs[f"fluency_{k}"] = fluency_question(nodes[(v["source_grade"], v["source"])], v["source_grade"])["fluency"]
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
    p.add_argument("cmd", choices=["dump", "judge", "estimate"])
    p.add_argument("--subjects", nargs="+", default=SUBJECTS, choices=SUBJECTS)
    p.add_argument("--grades", nargs="*", help="target grades to judge (default: all published)")
    p.add_argument("--window", type=int, default=WINDOW)
    a = p.parse_args()
    if a.cmd == "dump":
        asyncio.run(dump(a.subjects))
    elif a.cmd == "estimate":
        estimate(a.subjects, a.grades, a.window)
    else:
        asyncio.run(judge(a.subjects, a.grades, a.window))


def estimate(subjects: list[str], targets: list[str] | None, window: int) -> None:
    """Pairs still to judge, and a cost estimate at the pilot's rate ($1.70 / 131k pairs)."""
    base = json.loads((OUT / "baseline_graphs.json").read_text(encoding="utf-8"))
    cache_path = OUT / "jev_answers.json"
    cache = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
    done = {_qkey(v["source_grade"], v["source"], v["target_grade"], v["target"]) for v in cache.values()}
    total = 0
    for subject in subjects:
        grades = [g for g in GRADES if f"{subject}_{g}" in base]
        for gi, tg in enumerate(grades):
            if targets and tg not in targets:
                continue
            pool = [(n, g) for g in grades[max(0, gi - window): gi + 1] for n in base[f"{subject}_{g}"]["nodes"]]
            n = sum(1 for t in base[f"{subject}_{tg}"]["nodes"] for c, cg in pool
                    if not (c["id"] == t["id"] and cg == tg) and _qkey(cg, c["id"], tg, t["id"]) not in done)
            total += n
            print(f"{subject}_{tg}: {len(base[f'{subject}_{tg}']['nodes'])} subskills, {n:,} pairs to judge")
    print(f"total {total:,} pairs, about ${total / 131_000 * 1.70:.2f}")


if __name__ == "__main__":
    main()
