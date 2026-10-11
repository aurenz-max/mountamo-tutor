"""
Score Jev's prerequisite answers against a hand-labelled pair sheet.

A sheet holds pairs with `label` R | E | H | N and `speed` F | S (see
user_literacy_pairs.json, user_math_g3g5_pairs.json). R and E count as
"required". Reported: AUC and accuracy at 0.5 of max(step, easier_form)
for required vs not, and the fluency AUC for F vs S among required pairs.

The pair id comes from the sheet (`pair`, bare ids from the 10-11 pilot) or
from its key file (`<sheet>_key.json`, grade-qualified ids), so the person
labelling never sees Jev's scores.

Usage (from backend/):
  venv/Scripts/python -m scripts.graph_jev_pilot.validate scripts/graph_jev_pilot/user_math_g3g5_pairs.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from .run_pilot import OUT


def auc(pos, neg):
    if not pos or not neg:
        return None
    return sum((a > b) + 0.5 * (a == b) for a in pos for b in neg) / (len(pos) * len(neg))


def main(path: str) -> None:
    sheet = json.loads(Path(path).read_text(encoding="utf-8"))["pairs"]
    key_path = Path(path.replace("_pairs.json", "_key.json"))
    key = json.loads(key_path.read_text(encoding="utf-8")) if key_path.exists() else {}
    jev = json.loads((OUT / "jev_answers.json").read_text(encoding="utf-8"))
    by_q = {f"{v['source_grade']}:{v['source']}>{v['target_grade']}:{v['target']}": v for v in jev.values()}
    rows, missing, unlabelled = [], [], 0
    for i, p in sheet.items():
        if not p.get("label"):
            unlabelled += 1
            continue
        pid = key.get(i, {}).get("pair") or p.get("pair")
        v = by_q.get(pid) or jev.get(pid)
        if v is None:
            missing.append(i)
            continue
        rows.append((p["label"], p.get("speed"), max(v["step"], v["easier_form"]), v.get("fluency")))
    req = [s for lab, _, s, _ in rows if lab in ("R", "E")]
    non = [s for lab, _, s, _ in rows if lab in ("H", "N")]
    acc = sum((s >= 0.5) == (lab in ("R", "E")) for lab, _, s, _ in rows) / len(rows) if rows else None
    fast = [f for lab, sp, _, f in rows if lab in ("R", "E") and sp == "F" and f is not None]
    slow = [f for lab, sp, _, f in rows if lab in ("R", "E") and sp == "S" and f is not None]
    a = auc(req, non)
    fa = auc(fast, slow)
    print(f"{len(rows)} labelled pairs ({len(req)} required, {len(non)} not); {unlabelled} unlabelled; missing answers: {missing or 'none'}")
    print(f"prerequisite AUC {a:.2f}" if a is not None else "prerequisite AUC: needs both classes",
          f"| accuracy at 0.5 {acc:.0%}" if acc is not None else "")
    print(f"fluency AUC (F vs S) {fa:.2f}" if fa is not None else "fluency AUC: needs F and S pairs with fluency scores")
    for lab, sp, s, f in sorted(rows, key=lambda r: r[2]):
        flag = "  <- disagrees" if (s >= 0.5) != (lab in ("R", "E")) else ""
        print(f"  {lab} {sp or '-'}  jev {s:.2f}{flag}")


if __name__ == "__main__":
    main(sys.argv[1])
