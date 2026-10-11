"""
Compare the Jev parallel graph against the published graphs. Read-only.

  venv/Scripts/python scripts/graph_jev_pilot/analyze.py > reports/graph-jev-pilot-2026-10-11/analysis.txt
"""

from __future__ import annotations

import collections
import json
import statistics as st
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / "reports" / "graph-jev-pilot-2026-10-11"
STRONG = 0.7
WEAK = 0.2

base = json.loads((OUT / "baseline_graphs.json").read_text(encoding="utf-8"))
jev = json.loads((OUT / "jev_answers.json").read_text(encoding="utf-8"))
gold = json.loads((HERE / "gold_pairs.json").read_text(encoding="utf-8"))["pairs"]
label = {n["id"]: n["label"] for g in base.values() for n in g["nodes"]}
grade_of = {n["id"]: sid for sid, g in base.items() for n in g["nodes"]}

base_edges = {}
for sid, g in base.items():
    for e in g["edges"]:
        base_edges[f"{e['source']}>{e['target']}"] = e


def short(i: str, n: int = 60) -> str:
    return f"{i} {label.get(i, '?')[:n]}"


def auc(pos: list[float], neg: list[float]) -> float:
    if not pos or not neg:
        return float("nan")
    wins = sum((p > q) + 0.5 * (p == q) for p in pos for q in neg)
    return wins / (len(pos) * len(neg))


print(f"# Jev parallel graph vs published graph\n")
print(f"pairs judged: {len(jev):,}; published edges in scope: {len(base_edges):,}\n")

# 1. Gold set
print("## 1. Hand-labelled pairs (labels written before reading Jev output)\n")
for q, gk in [("step", "step"), ("easier_form", "easier")]:
    pos = [jev[k][q] for k, v in gold.items() if v[gk] == 1 and k in jev]
    neg = [jev[k][q] for k, v in gold.items() if v[gk] == 0 and k in jev]
    acc = (sum(p >= 0.5 for p in pos) + sum(p < 0.5 for p in neg)) / max(1, len(pos) + len(neg))
    print(f"- Jev `{q}`: AUC {auc(pos, neg):.2f}, accuracy at 0.5 {acc:.0%} (pos {len(pos)}, neg {len(neg)})")
missing = [k for k in gold if k not in jev]
if missing:
    print(f"- not judged (outside pool): {missing}")
# Published graph on the same pairs: any edge = predicts related; gating edge = predicts prerequisite
rel_pos = [k for k, v in gold.items() if (v["step"] == 1 or v["easier"] == 1)]
rel_neg = [k for k, v in gold.items() if v["step"] == 0 and v["easier"] == 0]
same_grade = lambda k: grade_of.get(k.split(">")[0]) == grade_of.get(k.split(">")[1])
for name, keys_pos, keys_neg in [("all", rel_pos, rel_neg),
                                 ("same-grade only", [k for k in rel_pos if same_grade(k)], [k for k in rel_neg if same_grade(k)])]:
    hit = sum(k in base_edges for k in keys_pos)
    fa = sum(k in base_edges for k in keys_neg)
    jhit = sum(max(jev[k]["step"], jev[k]["easier_form"]) >= 0.5 for k in keys_pos if k in jev)
    jfa = sum(max(jev[k]["step"], jev[k]["easier_form"]) >= 0.5 for k in keys_neg if k in jev)
    print(f"- related pairs, {name}: published has an edge for {hit}/{len(keys_pos)}, false edges {fa}/{len(keys_neg)};"
          f" Jev (max >= 0.5) finds {jhit}/{len(keys_pos)}, false {jfa}/{len(keys_neg)}")
print("\n| pair | gold step/easier | Jev step | Jev easier | published edge |\n|---|---|---|---|---|")
for k, v in gold.items():
    j = jev.get(k, {})
    e = base_edges.get(k)
    pub = f"{e['relationship']}{' (gates)' if e.get('is_prerequisite') else ''}" if e else "-"
    print(f"| {k} | {v['step']}/{v['easier']} | {j.get('step', float('nan')):.2f} | {j.get('easier_form', float('nan')):.2f} | {pub} |")

# 2. Published edges, as Jev sees them
print("\n## 2. Published edges, scored by Jev\n")
print("| subject/grade | relationship | gating | n | median step | median easier | Jev rejects (both < 0.2) |\n|---|---|---|---|---|---|---|")
groups = collections.defaultdict(list)
for k, e in base_edges.items():
    if k in jev:
        groups[(grade_of[e["target"]], e["relationship"], bool(e.get("is_prerequisite")))].append(jev[k])
for (sid, rel, gate), rows in sorted(groups.items()):
    rej = sum(max(r["step"], r["easier_form"]) < WEAK for r in rows)
    print(f"| {sid} | {rel} | {gate} | {len(rows)} | {st.median(r['step'] for r in rows):.2f} | "
          f"{st.median(r['easier_form'] for r in rows):.2f} | {rej} ({rej / len(rows):.0%}) |")
unjudged = [k for k in base_edges if k not in jev]
print(f"\npublished edges Jev did not judge (target earlier than source across grades, or out of scope): {len(unjudged)}")

print("\n### Gating edges Jev rejects (sample, with the published rationale)\n")
rej = [(k, e) for k, e in base_edges.items() if k in jev and e.get("is_prerequisite")
       and max(jev[k]["step"], jev[k]["easier_form"]) < WEAK]
for k, e in rej[:15]:
    s, t = k.split(">")
    print(f"- {short(s, 50)} -> {short(t, 50)} [{e['relationship']}] step {jev[k]['step']:.2f}"
          f"\n  rationale: {(e.get('rationale') or '')[:160]}")

# 3. Jev-only edges
print("\n## 3. Strong Jev edges the published graph lacks\n")
only = [v for k, v in jev.items() if k not in base_edges and max(v["step"], v["easier_form"]) >= STRONG]
cross = [v for v in only if v["source_grade"] != v["target_grade"]]
print(f"- {len(only):,} pairs with step or easier >= {STRONG} and no published edge; {len(cross):,} cross-grade")
by_t = collections.Counter(v["target"] for v in only)
print(f"- per target: median {st.median(by_t.values()) if by_t else 0}, max {max(by_t.values()) if by_t else 0}")

# transitive reduction of the Jev step graph: drop a->c when a->b and b->c are both strong
step = {(v["source"], v["target"]) for v in jev.values() if v["step"] >= STRONG}
succ = collections.defaultdict(set)
for a, b in step:
    succ[a].add(b)
direct = {(a, c) for a, c in step if not any((b, c) in step for b in succ[a] if b != c)}
print(f"- Jev `step` edges >= {STRONG}: {len(step):,}; after removing edges implied by a two-step path: {len(direct):,}")
print("\nG2 examples (no published edges exist for G2):\n")
for tid in ["OPS002-02-b", "OPS002-01-b", "NBT002-05-c"]:
    rows = sorted((v for v in jev.values() if v["target"] == tid), key=lambda v: -v["step"])[:6]
    print(f"- **{short(tid, 70)}**")
    for v in rows:
        fl = f", fluency {v['fluency']:.2f}" if "fluency" in v else ""
        print(f"  - step {v['step']:.2f}, easier {v['easier_form']:.2f}{fl}: {short(v['source'], 70)}")

# 4. Fluency
fl = [v["fluency"] for v in jev.values() if "fluency" in v]
if fl:
    print(f"\n## 4. Fluency pass\n\n- {len(fl):,} pairs; median {st.median(fl):.2f}; share >= 0.7: {sum(f >= 0.7 for f in fl) / len(fl):.0%}; share <= 0.3: {sum(f <= 0.3 for f in fl) / len(fl):.0%}")
    top = sorted((v for v in jev.values() if "fluency" in v), key=lambda v: -v["fluency"])[:8]
    for v in top:
        print(f"  - {v['fluency']:.2f} {short(v['source'], 50)} -> {short(v['target'], 50)}")
