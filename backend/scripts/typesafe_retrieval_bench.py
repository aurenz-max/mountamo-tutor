"""
Objective -> curriculum subskill: embedding retrieval vs TypeSafe (System One).

WHAT IS MEASURED. The personalization path resolves each lesson objective to a
published subskill with the production CurriculumRetrievalMatcher (Gemini
embeddings + cosine + a unit/skill coherence gate that may abstain). TypeSafe's
docs claim strong reranking and hierarchical classification. This bench runs
both over the SAME objectives with a known home, four arms:

  E1   embedding top-1 (cosine argmax, no gate)
  EP   embedding PRODUCTION verdict (probe(): match -> attribution, or abstain)
  TF   TypeSafe flat Choice over every subskill in the (subject, grade)
  TR   TypeSafe rerank: Choice over the embedding top-K plus "none of these"
  TH   TypeSafe hierarchical: Choice over skills, then over that skill's subskills

Ground truth comes from scripts/typesafe-bench.mjs output: each objective was
written by the curator brief FROM a sampled published subskill, so the source
subskill is the home. That is the objective-regime the personalization path
sees (not challenge text), and it is an easy regime: objectives paraphrase the
description. Skill-level accuracy is the fairer number — the matcher's own
doctrine is that the subskill "wobbles" while unit and skill are stationary.

Usage (from backend/):
  PYTHONPATH=$(pwd) venv/Scripts/python.exe scripts/typesafe_retrieval_bench.py \
      [--from ../my-tutoring-app/qa/typesafe/bench-<stamp>.json] [--limit N] [--k 20]
Needs GEMINI_API_KEY in backend/.env (embeddings, Firestore curriculum) and
TYPESAFE_API_KEY in env or ../my-tutoring-app/.env.local.
"""
import argparse
import asyncio
import contextlib
import json
import logging
import os
import re
import sys
import time
import urllib.request
from datetime import datetime
from pathlib import Path

import numpy as np

# Windows consoles default to cp1252; the report uses arrows and check marks.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")
logging.basicConfig(level=logging.WARNING, stream=sys.stderr, format="%(message)s")
from dotenv import load_dotenv  # noqa: E402

load_dotenv()

from app.dependencies import get_curriculum_service  # noqa: E402
from app.services.curriculum_retrieval_service import CurriculumRetrievalMatcher, _skill_family  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
APP = REPO / "my-tutoring-app"
QA = APP / "qa" / "typesafe"
SUBJECT_ID = {"Mathematics": "MATHEMATICS", "Language Arts": "LANGUAGE_ARTS", "Science": "SCIENCE", "Social Studies": "SOCIAL_STUDIES"}
TYPESAFE_URL = os.environ.get("TYPESAFE_ENDPOINT", "https://api.typesafe.ai/v1/systemone")
TYPESAFE_MODEL = os.environ.get("TYPESAFE_MODEL", "jev-latest")
NONE_OPTION = "none_of_these"


def typesafe_key() -> str:
    key = os.environ.get("TYPESAFE_API_KEY")
    if key:
        return key
    m = re.search(r"^TYPESAFE_API_KEY=(.*)$", (APP / ".env.local").read_text(encoding="utf-8"), re.M)
    if not m:
        sys.exit("TYPESAFE_API_KEY not set (env or my-tutoring-app/.env.local)")
    return m.group(1).strip().strip("\"'")


KEY = typesafe_key()


def system_one_sync(state, questions):
    body = json.dumps({"state": state, "model": TYPESAFE_MODEL, "questions": questions}).encode("utf-8")
    req = urllib.request.Request(TYPESAFE_URL, data=body, method="POST",
                                 headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    t0 = time.perf_counter()
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as res:
                out = json.loads(res.read().decode("utf-8"))
                out["ms"] = round((time.perf_counter() - t0) * 1000)
                return out
        except urllib.error.HTTPError as e:  # type: ignore[attr-defined]
            if e.code in (429, 529) and attempt < 2:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise RuntimeError(f"TypeSafe HTTP {e.code}: {e.read()[:300]!r}") from e
    raise RuntimeError("unreachable")


SEM = asyncio.Semaphore(3)


async def system_one(state, questions):
    async with SEM:
        return await asyncio.to_thread(system_one_sync, state, questions)


def clip(s: str, n: int = 220) -> str:
    return s if len(s) <= n else s[: n - 3] + "..."


def latest_bench() -> Path:
    files = sorted(QA.glob("bench-*.json"))
    if not files:
        sys.exit("no bench-*.json in my-tutoring-app/qa/typesafe — run scripts/typesafe-bench.mjs first")
    return files[-1]


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="src", default=None)
    ap.add_argument("--limit", type=int, default=999)
    ap.add_argument("--k", type=int, default=20, help="embedding top-K handed to the rerank arm")
    args = ap.parse_args()
    src = Path(args.src) if args.src else latest_bench()
    bench = json.loads(src.read_text(encoding="utf-8"))
    cases = [(s, g) for s, g in zip(bench["sample"], bench["gemini"]) if not g.get("error") and g["objectives"]][: args.limit]
    print(f"from {src.name}: {len(cases)} subskills, {sum(len(g['objectives']) for _, g in cases)} objectives", file=sys.stderr)

    with contextlib.redirect_stdout(sys.stderr):
        cs = await get_curriculum_service()
        matcher = CurriculumRetrievalMatcher(cs)

    rows = []
    for ci, (s, g) in enumerate(cases):
        subject = SUBJECT_ID.get(s["subject"], s["subject"])
        grade_keys = await matcher._resolve_grades(subject, s["grade"])
        if not grade_keys:
            print(f"[{ci+1}] {s['subskillId']}: no published grade for {subject}/{s['grade']} — skipped", file=sys.stderr)
            continue
        grade = grade_keys[0]
        nodes, matrix = await matcher._node_matrix(subject, grade)
        if not nodes or matrix is None:
            print(f"[{ci+1}] {s['subskillId']}: empty node matrix — skipped", file=sys.stderr)
            continue
        by_sub = {n[2]: n for n in nodes}
        truth_sub = s["subskillId"]
        truth_node = by_sub.get(truth_sub)
        truth_skill = truth_node[0] if truth_node else truth_sub.rsplit("-", 1)[0]
        truth_unit = truth_node[4] if truth_node and len(truth_node) > 4 and truth_node[4] else _skill_family(truth_skill)
        unit_of = lambda n: (n[4] if len(n) > 4 and n[4] else _skill_family(n[0]))  # noqa: E731

        flat_criteria = {n[2]: clip(n[3]) for n in nodes}
        skills = {}
        for n in nodes:
            skills.setdefault(n[0], {"desc": n[1], "subs": []})["subs"].append(n)
        skill_criteria = {sid: clip(v["desc"]) for sid, v in skills.items()}

        for o in g["objectives"]:
            q = o["text"]
            state = {"learningObjective": q, "subject": s["subject"], "grade": s["grade"]}
            row = {"subskillId": truth_sub, "truthSkill": truth_skill, "truthUnit": truth_unit, "grade": s["grade"],
                   "subject": s["subject"], "objective": q, "candidates": len(nodes), "skills": len(skills)}

            # ---- E1: embedding argmax ----
            t0 = time.perf_counter()
            qvec = (await asyncio.to_thread(matcher._embed, [q]))[0]
            row["E1_ms"] = round((time.perf_counter() - t0) * 1000)
            sims = matrix @ qvec
            order = list(np.argsort(-sims))
            e1 = nodes[order[0]]
            row["E1"] = {"sub": e1[2], "skill": e1[0], "unit": unit_of(e1), "cosine": round(float(sims[order[0]]), 4),
                         "truthRank": next((r + 1 for r, i in enumerate(order) if nodes[i][2] == truth_sub), None)}

            # ---- EP: production probe (gate + attribution, may abstain) ----
            t0 = time.perf_counter()
            probe = await matcher.probe(subject=subject, grade_level=s["grade"], query_text=q, primitive_type="")
            row["EP_ms"] = round((time.perf_counter() - t0) * 1000)
            mp = probe.get("mapping")
            row["EP"] = {"verdict": probe.get("verdict"), "reason": probe.get("abstain_reason"),
                         "sub": getattr(mp, "subskill_id", None), "skill": getattr(mp, "skill_id", None),
                         "unit": getattr(mp, "unit_id", None) or (_skill_family(mp.skill_id) if mp else None)}

            # ---- TF + TR + TH step 1 in ONE TypeSafe request ----
            topk = [nodes[i] for i in order[: args.k]]
            rerank_criteria = {n[2]: clip(n[3]) for n in topk}
            rerank_criteria[NONE_OPTION] = "No listed subskill is what this objective teaches"
            questions = {
                "flat": {"type": "choice", "criteria": flat_criteria,
                         "instructions": "Which curriculum subskill is this learning objective teaching? Pick the one whose description matches what the student must do."},
                "rerank": {"type": "choice", "criteria": rerank_criteria,
                           "instructions": "Which of these candidate subskills is this learning objective teaching? Choose none_of_these if no candidate matches."},
                "skill": {"type": "choice", "criteria": skill_criteria,
                          "instructions": "Which curriculum skill does this learning objective belong to?"},
            }
            try:
                r1 = await system_one(state, questions)
                a = r1["answers"]
                row["T1_ms"] = r1["ms"]
                row["T1_tokens"] = r1["usage"]["input_tokens"]
                tf = a["flat"]["choice"]
                tf_node = by_sub.get(tf)
                row["TF"] = {"sub": tf, "skill": tf_node[0] if tf_node else None, "unit": unit_of(tf_node) if tf_node else None,
                             "p": round(a["flat"]["probabilities"].get(tf, 0), 3), "confidence": round(a["flat"]["confidence"], 3),
                             "truthP": round(a["flat"]["probabilities"].get(truth_sub, 0), 3)}
                tr = a["rerank"]["choice"]
                tr_node = by_sub.get(tr)
                row["TR"] = {"sub": None if tr == NONE_OPTION else tr, "abstain": tr == NONE_OPTION,
                             "skill": tr_node[0] if tr_node else None, "unit": unit_of(tr_node) if tr_node else None,
                             "confidence": round(a["rerank"]["confidence"], 3), "truthInTopK": any(n[2] == truth_sub for n in topk)}
                th_skill = a["skill"]["choice"]
                th_conf = round(a["skill"]["confidence"], 3)
                # ---- TH step 2: within the chosen skill ----
                subs = skills.get(th_skill, {"subs": []})["subs"]
                if len(subs) >= 2:
                    r2 = await system_one(state, {"sub": {"type": "choice", "criteria": {n[2]: clip(n[3]) for n in subs},
                                                          "instructions": f"Within the skill \"{skills[th_skill]['desc']}\", which subskill is this learning objective teaching?"}})
                    th_sub = r2["answers"]["sub"]["choice"]
                    row["T2_ms"] = r2["ms"]
                else:
                    th_sub = subs[0][2] if subs else None
                    row["T2_ms"] = 0
                th_node = by_sub.get(th_sub)
                row["TH"] = {"sub": th_sub, "skill": th_skill, "unit": unit_of(th_node) if th_node else _skill_family(th_skill),
                             "skillConfidence": th_conf}
            except Exception as e:  # noqa: BLE001
                row["error"] = str(e)
                print(f"[{ci+1}] {truth_sub}: TypeSafe failed: {e}", file=sys.stderr)
            rows.append(row)
            ok = lambda arm: (row.get(arm) or {}).get("sub") == truth_sub  # noqa: E731
            print(f"[{ci+1}/{len(cases)}] {truth_sub} · E1 {'✓' if ok('E1') else '✗'} EP {row['EP']['verdict'][:3]}{'✓' if ok('EP') else '✗'} "
                  f"TF {'✓' if ok('TF') else '✗'} TR {'✓' if ok('TR') else '✗'} TH {'✓' if ok('TH') else '✗'} · {q[:60]}", file=sys.stderr)

    # ---- score ----
    arms = ["E1", "EP", "TF", "TR", "TH"]
    def acc(arm, level):
        key = {"sub": "subskillId", "skill": "truthSkill", "unit": "truthUnit"}[level]
        got = [(r.get(arm) or {}).get(level if level != "sub" else "sub") == r[key] for r in rows if r.get(arm)]
        return (sum(got) / len(got)) if got else float("nan")
    def mean(xs):
        xs = [x for x in xs if x is not None]
        return sum(xs) / len(xs) if xs else float("nan")
    summary = {}
    for arm in arms:
        summary[arm] = {"n": sum(1 for r in rows if r.get(arm)), "sub": acc(arm, "sub"), "skill": acc(arm, "skill"), "unit": acc(arm, "unit")}
    summary["EP"]["abstain"] = sum(1 for r in rows if r["EP"]["verdict"] != "match") / len(rows)
    summary["EP"]["subWhenMatched"] = mean([r["EP"]["sub"] == r["subskillId"] for r in rows if r["EP"]["verdict"] == "match"]) if any(r["EP"]["verdict"] == "match" for r in rows) else float("nan")
    summary["EP"]["skillWhenMatched"] = mean([r["EP"]["skill"] == r["truthSkill"] for r in rows if r["EP"]["verdict"] == "match"]) if any(r["EP"]["verdict"] == "match" for r in rows) else float("nan")
    summary["TR"]["abstain"] = mean([r["TR"]["abstain"] for r in rows if r.get("TR")])
    summary["TR"]["truthInTopK"] = mean([r["TR"]["truthInTopK"] for r in rows if r.get("TR")])
    summary["E1"]["truthRankMean"] = mean([r["E1"]["truthRank"] for r in rows])
    summary["latency_ms"] = {"E1_embed": mean([r["E1_ms"] for r in rows]), "EP_probe": mean([r["EP_ms"] for r in rows]),
                             "T1_shared_request": mean([r.get("T1_ms") for r in rows]), "T2_hier_step2": mean([r.get("T2_ms") for r in rows])}
    summary["T1_input_tokens_mean"] = mean([r.get("T1_tokens") for r in rows])
    summary["errors"] = sum(1 for r in rows if r.get("error"))

    pct = lambda x: "-" if x != x else f"{round(x * 100)}%"  # noqa: E731
    stamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
    md = [f"# Objective → subskill retrieval: embeddings vs TypeSafe — {len(rows)} objectives, {len(cases)} subskills", "",
          f"source {src.name} · rerank K={args.k} · embedding model gemini-embedding-2-preview · TypeSafe {TYPESAFE_MODEL} · TypeSafe errors {summary['errors']}", "",
          "| arm | n | subskill@1 | skill@1 | unit@1 | notes |", "|---|---|---|---|---|---|"]
    notes = {
        "E1": f"cosine argmax, no gate · truth mean rank {summary['E1']['truthRankMean']:.1f}",
        "EP": f"production gate · abstains {pct(summary['EP']['abstain'])} · when it matches: subskill {pct(summary['EP']['subWhenMatched'])}, skill {pct(summary['EP']['skillWhenMatched'])}",
        "TF": f"one Choice over all subskills in the grade (~{round(mean([r['candidates'] for r in rows]))} options)",
        "TR": f"Choice over embedding top-{args.k} + none_of_these · abstains {pct(summary['TR']['abstain'])} · truth in top-{args.k} {pct(summary['TR']['truthInTopK'])}",
        "TH": f"skill Choice (~{round(mean([r['skills'] for r in rows]))} options) then subskill Choice — the hierarchical-classification claim",
    }
    for arm in arms:
        a = summary[arm]
        md.append(f"| {arm} | {a['n']} | {pct(a['sub'])} | {pct(a['skill'])} | {pct(a['unit'])} | {notes[arm]} |")
    lat = summary["latency_ms"]
    md += ["", f"Latency per objective (ms): embed {lat['E1_embed']:.0f} · production probe {lat['EP_probe']:.0f} · TypeSafe shared request (TF+TR+TH1) {lat['T1_shared_request']:.0f} · TH step 2 {lat['T2_hier_step2']:.0f}. TypeSafe input tokens per shared request: {summary['T1_input_tokens_mean']:.0f}.",
           "", "EP counts an abstain as wrong at every level; its when-matched columns show precision. TR's none_of_these counts as wrong. Ground truth = the subskill the objective was written from; a sibling subskill of the same skill is a plausible home, so read skill@1 as the fair comparison.",
           "", "## Per objective", "", "| subskill (truth) | objective | E1 | EP | TF (p, conf) | TR | TH |", "|---|---|---|---|---|---|---|"]
    def cell(r, arm):
        a = r.get(arm)
        if not a:
            return "ERR"
        sub = a.get("sub")
        mark = "✓" if sub == r["subskillId"] else ("~" if a.get("skill") == r["truthSkill"] else "✗")
        extra = ""
        if arm == "EP" and a["verdict"] != "match":
            return f"abstain ({a['reason']})"
        if arm == "TF":
            extra = f" ({a['p']}, {a['confidence']})"
        if arm == "TR" and a["abstain"]:
            return "none_of_these"
        return f"{mark} {sub}{extra}"
    for r in rows:
        md.append(f"| {r['subskillId']} | {r['objective'].replace('|', '/')[:80]} | {cell(r, 'E1')} | {cell(r, 'EP')} | {cell(r, 'TF')} | {cell(r, 'TR')} | {cell(r, 'TH')} |")
    md += ["", "✓ exact subskill · ~ same skill, sibling subskill · ✗ different skill"]
    text = "\n".join(md)
    QA.mkdir(parents=True, exist_ok=True)
    (QA / f"retrieval-bench-{stamp}.md").write_text(text, encoding="utf-8")
    (QA / f"retrieval-bench-{stamp}.json").write_text(json.dumps({"source": str(src), "k": args.k, "summary": summary, "rows": rows}, indent=2, default=str), encoding="utf-8")
    print(text)
    print(f"\nsaved {QA / f'retrieval-bench-{stamp}'}.{{md,json}}")


if __name__ == "__main__":
    asyncio.run(main())
