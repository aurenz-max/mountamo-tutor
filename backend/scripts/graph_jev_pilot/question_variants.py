"""
Which question wording identifies prerequisites and fluency needs best?
Runs several phrasings on the hand-labelled pairs in gold_pairs_v2.json and
reports AUC overall, against related-but-not-required pairs, and against
reversed pairs. Read-only; a few cents of Jev.

  venv/Scripts/python scripts/graph_jev_pilot/question_variants.py [--repeat 2]
"""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

import httpx

from run_pilot import ENDPOINT, MODEL, OUT, _key, _skill, fluency_question, pair_questions

HERE = Path(__file__).resolve().parent


def variants(c: dict) -> dict:
    cand = {"candidate_skill": c}
    q = {
        "necessity": {"type": "noul", "instructions": {
            "question": "Could a student who cannot yet do the candidate skill below still solve a typical `target_skill` problem correctly?", **cand},
            "criteria": {"true": "Yes: the target can be done without the candidate.",
                         "false": "No: without the candidate, the student is blocked on the target."}},
        "before": {"type": "noul", "instructions": {
            "question": "Should a student be able to do the candidate skill below before they start learning `target_skill`?", **cand}},
        "kind": {"type": "choice", "instructions": {
            "question": "How is the candidate skill below related to `target_skill`?", **cand},
            "criteria": {
                "component": "The student performs the candidate as a step inside a target problem.",
                "easier_version": "The candidate is the same kind of task as the target, in an easier form that is learned first.",
                "helpful_background": "Related and useful, but a student could do the target without it.",
                "not_a_prerequisite": "Unrelated, or the candidate is harder or comes later than the target."}},
        # fluency phrasings
        "fl_instant": {"type": "noul", "instructions": {
            "question": "When the candidate skill below is used inside a `target_skill` problem, must the student produce it instantly from memory (in about a second) rather than working it out?", **cand}},
        "fl_losetrack": {"type": "noul", "instructions": {
            "question": "Picture a child solving a `target_skill` problem who can do the candidate skill below only slowly, for example by counting on fingers or sounding out each letter. Would that slowness make them lose track of the rest of the problem?", **cand}},
        "fl_score": {"type": "score", "instructions": {
            "question": "How fast must the student be at the candidate skill below for a `target_skill` problem to be manageable?", **cand},
            "criteria": [
                "Slow is fine: the student can work the candidate out step by step without hurting the target.",
                "Somewhat quick: the candidate should be reasonably practiced, but working it out is still workable.",
                "Automatic: the candidate must be instant recall; working it out would overload the student on the target."]},
    }
    return q


async def main(repeat: int) -> None:
    base = json.loads((OUT / "baseline_graphs.json").read_text(encoding="utf-8"))
    gold = json.loads((HERE / "gold_pairs_v2.json").read_text(encoding="utf-8"))["pairs"]
    nodes = {n["id"]: (n, sid.split("_")[-1]) for sid, g in base.items() for n in g["nodes"]}
    headers = {"Authorization": f"Bearer {_key()}", "Content-Type": "application/json"}
    results = {k: [] for k in gold}
    async with httpx.AsyncClient(headers=headers, timeout=120) as client:
        async def one(k: str) -> None:
            s, t = k.split(">")
            (sn, sg), (tn, tg) = nodes[s], nodes[t]
            c = _skill(sn, sg)
            qs = {**pair_questions(sn, sg), **fluency_question(sn, sg), **variants(c)}
            r = await client.post(ENDPOINT, json={"state": {"target_skill": _skill(tn, tg)}, "model": MODEL, "questions": qs})
            r.raise_for_status()
            a = r.json()["answers"]
            kp = a["kind"]["probabilities"]
            results[k].append({
                "step": a["step"]["noul"],
                "step_or_easier": max(a["step"]["noul"], a["easier_form"]["noul"]),
                "necessity": 1 - a["necessity"]["noul"],
                "before": a["before"]["noul"],
                "kind": kp["component"] + kp["easier_version"],
                "kind_choice": a["kind"]["choice"],
                "fl_original": a["fluency"]["noul"],
                "fl_instant": a["fl_instant"]["noul"],
                "fl_losetrack": a["fl_losetrack"]["noul"],
                "fl_score": a["fl_score"]["score"],
            })
        for _ in range(repeat):
            await asyncio.gather(*(one(k) for k in gold))

    avg = {k: {m: sum(r[m] for r in rs) / len(rs) for m in rs[0] if m != "kind_choice"} | {"kind_choice": rs[0]["kind_choice"]}
           for k, rs in results.items()}
    (OUT / "question_variants.json").write_text(json.dumps({"gold": gold, "answers": results}, indent=1), encoding="utf-8")

    def auc(pos, neg):
        if not pos or not neg:
            return float("nan")
        return sum((p > q) + 0.5 * (p == q) for p in pos for q in neg) / (len(pos) * len(neg))

    print("## Prerequisite wording (AUC; required pairs vs ...)\n")
    print("| wording | all negatives | related, not required | reversed | easy | acc@0.5 |\n|---|---|---|---|---|---|")
    for m in ["step", "step_or_easier", "necessity", "before", "kind"]:
        pos = [avg[k][m] for k, g in gold.items() if g["required"] == 1]
        cols = []
        for kinds in [("hard_neg", "reverse", "easy_neg"), ("hard_neg",), ("reverse",), ("easy_neg",)]:
            cols.append(auc(pos, [avg[k][m] for k, g in gold.items() if g["kind"] in kinds]))
        acc = sum((avg[k][m] >= 0.5) == (g["required"] == 1) for k, g in gold.items()) / len(gold)
        print(f"| {m} | " + " | ".join(f"{c:.2f}" for c in cols) + f" | {acc:.0%} |")

    print("\n## Fluency wording (AUC; must-be-fast vs slow-is-fine)\n")
    fl = {k: g["fluent"] for k, g in gold.items() if "fluent" in g}
    print(f"labelled: {sum(fl.values())} fast, {len(fl) - sum(fl.values())} slow-ok\n")
    print("| wording | AUC | mean on fast | mean on slow-ok |\n|---|---|---|---|")
    for m in ["fl_original", "fl_instant", "fl_losetrack", "fl_score"]:
        pos = [avg[k][m] for k, v in fl.items() if v == 1]
        neg = [avg[k][m] for k, v in fl.items() if v == 0]
        print(f"| {m} | {auc(pos, neg):.2f} | {sum(pos) / len(pos):.2f} | {sum(neg) / len(neg):.2f} |")

    print("\n## Per pair\n\n| pair | label | step | necessity | before | kind (choice) | fl_instant | fl_losetrack | fl_score |\n|---|---|---|---|---|---|---|---|---|")
    for k, g in gold.items():
        a = avg[k]
        lab = f"{g['kind']}{' fast' if g.get('fluent') == 1 else ' slow' if g.get('fluent') == 0 else ''}"
        print(f"| {k} | {lab} | {a['step']:.2f} | {a['necessity']:.2f} | {a['before']:.2f} | {a['kind']:.2f} ({a['kind_choice']}) | "
              f"{a['fl_instant']:.2f} | {a['fl_losetrack']:.2f} | {a['fl_score']:.2f} |")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--repeat", type=int, default=1)
    asyncio.run(main(p.parse_args().repeat))
