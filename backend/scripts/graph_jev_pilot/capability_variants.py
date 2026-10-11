"""
Round 2 wording test, from the user's literacy review (2026-10-11):
  1. judge the underlying CAPABILITY, not the activity or materials used to practise it
  2. a per-edge condition: is the candidate needed only because the child reads the
     target's text themselves (so the edge disappears when the text is read aloud)?
Scored on the user's 22 literacy labels and the 57 pairs in gold_pairs_v2.json.

  venv/Scripts/python scripts/graph_jev_pilot/capability_variants.py
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import httpx

from run_pilot import ENDPOINT, MODEL, OUT, _key, _skill, pair_questions

HERE = Path(__file__).resolve().parent

CAPABILITY = ("Judge the underlying capability each skill description names. Ignore the materials, tools, "
              "activity format, and accuracy targets used to practise it (for example manipulatives, picture cards, "
              "drag and drop, digital counters, '90% accuracy').")
NARROW = ("Count it as a step only if the child carries out that mental operation while doing the target; "
          "an activity that merely develops a related capability does not count.")


def cap_questions(c: dict) -> dict:
    cand = {"candidate_skill": c}
    return {
        "cap_step": {"type": "noul", "instructions": {
            "how_to_judge": CAPABILITY,
            "question": "Does solving a typical `target_skill` problem require the student to carry out the candidate capability below as one of the steps inside it?", **cand},
            "criteria": {"true": "The candidate capability is a component the student actually performs while solving a target problem.",
                         "false": "The candidate is not performed inside a target problem; it may be related, easier, or a different topic."}},
        "cap_step_narrow": {"type": "noul", "instructions": {
            "how_to_judge": CAPABILITY + " " + NARROW,
            "question": "Does solving a typical `target_skill` problem require the student to carry out the candidate capability below as one of the steps inside it?", **cand},
            "criteria": {"true": "The child performs the candidate's mental operation inside a target problem.",
                         "false": "Not performed inside the target, or only an activity that builds a related capability."}},
        "cap_easier": {"type": "noul", "instructions": {
            "how_to_judge": CAPABILITY,
            "question": "Is `target_skill` the same capability as the candidate below, made meaningfully harder (larger numbers or texts, an extra step, less support), so the candidate is normally learned first? Being taught earlier in a curriculum is not enough.", **cand},
            "criteria": {"true": "A real progression of the same capability.",
                         "false": "A different capability, or no meaningful increase in difficulty."}},
        "print_only": {"type": "noul", "instructions": {
            "question": "Is the candidate skill below needed for `target_skill` only because the child reads the target's text by themselves, so that it would not be needed if the text were read aloud to them?", **cand},
            "criteria": {"true": "Needed only to read the text; with the text read aloud the candidate is not needed.",
                         "false": "Needed even when the text is read aloud, or the target is itself a reading task."}},
    }


async def main() -> None:
    base = json.loads((OUT / "baseline_graphs.json").read_text(encoding="utf-8"))
    nodes = {n["id"]: (n, sid.split("_")[-1]) for sid, g in base.items() for n in g["nodes"]}
    user = json.loads((HERE / "user_literacy_pairs.json").read_text(encoding="utf-8"))["pairs"]
    mine = json.loads((HERE / "gold_pairs_v2.json").read_text(encoding="utf-8"))["pairs"]
    labels = {}
    for v in user.values():
        labels[v["pair"]] = {"set": "user_literacy", "required": v["label"] in ("R", "E"), "label": v["label"]}
    for k, v in mine.items():
        labels.setdefault(k, {"set": "mine", "required": v["required"] == 1, "label": v["kind"]})

    headers = {"Authorization": f"Bearer {_key()}", "Content-Type": "application/json"}
    ans = {}
    async with httpx.AsyncClient(headers=headers, timeout=120) as client:
        async def one(k):
            s, t = k.split(">")
            (sn, sg), (tn, tg) = nodes[s], nodes[t]
            qs = {**pair_questions(sn, sg), **cap_questions(_skill(sn, sg))}
            r = await client.post(ENDPOINT, json={"state": {"target_skill": _skill(tn, tg)}, "model": MODEL, "questions": qs})
            r.raise_for_status()
            a = r.json()["answers"]
            ans[k] = {q: a[q]["noul"] for q in qs}
        await asyncio.gather(*(one(k) for k in labels))
    (OUT / "capability_variants.json").write_text(json.dumps({"labels": labels, "answers": ans}, indent=1), encoding="utf-8")

    def auc(pos, neg):
        return sum((p > q) + 0.5 * (p == q) for p in pos for q in neg) / (len(pos) * len(neg)) if pos and neg else float("nan")

    scorers = {
        "original: max(step, easier)": lambda a: max(a["step"], a["easier_form"]),
        "capability: max(step, easier)": lambda a: max(a["cap_step"], a["cap_easier"]),
        "capability narrow: max(step, easier)": lambda a: max(a["cap_step_narrow"], a["cap_easier"]),
    }
    print("## Prerequisite wording\n\n| wording | set | AUC | acc@0.5 |\n|---|---|---|---|")
    for name, f in scorers.items():
        for st in ("user_literacy", "mine"):
            ks = [k for k, l in labels.items() if l["set"] == st]
            pos = [f(ans[k]) for k in ks if labels[k]["required"]]
            neg = [f(ans[k]) for k in ks if not labels[k]["required"]]
            acc = sum((f(ans[k]) >= 0.5) == labels[k]["required"] for k in ks) / len(ks)
            print(f"| {name} | {st} | {auc(pos, neg):.2f} | {acc:.0%} |")

    print("\n## User literacy pairs\n\n| # | pair | label | orig step / easier | cap step / narrow / easier | print_only |\n|---|---|---|---|---|---|")
    for i, v in user.items():
        a = ans[v["pair"]]
        print(f"| {i} | {v['pair']} | {v['label']} | {a['step']:.2f} / {a['easier_form']:.2f} | "
              f"{a['cap_step']:.2f} / {a['cap_step_narrow']:.2f} / {a['cap_easier']:.2f} | {a['print_only']:.2f} |")


if __name__ == "__main__":
    asyncio.run(main())
