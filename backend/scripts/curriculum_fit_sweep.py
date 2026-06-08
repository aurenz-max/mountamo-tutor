"""
Curriculum-Fit Sweep — batch driver behind `/curriculum-fit <domain>`.

Runs the same CurriculumRetrievalMatcher.probe() as curriculum_fit_probe.py, but
initializes the service ONCE and loops every primitive in a catalog domain. The
curriculum embeddings cache per (subject, grade), so the only per-primitive cost
is embedding that primitive's description.

Extracts (id, description) pairs straight from the catalog TS so the embedded
signal is byte-identical to what /api/problems/submit uses.

Usage:
  cd backend && PYTHONPATH=$(pwd) ./venv/Scripts/python.exe scripts/curriculum_fit_sweep.py \
      --domain math [--json]
"""
import argparse
import asyncio
import contextlib
import json
import logging
import re
import sys
from pathlib import Path

logging.basicConfig(level=logging.WARNING, stream=sys.stderr, format="%(message)s")

from dotenv import load_dotenv
load_dotenv()

from app.dependencies import get_curriculum_service
from app.services.curriculum_retrieval_service import CurriculumRetrievalMatcher
from app.services.curriculum_mapping_service import CurriculumMappingService

CATALOG_DIR = Path(__file__).resolve().parents[2] / "my-tutoring-app/src/components/lumina/service/manifest/catalog"

# top-level entry: `    id: 'x',` then (within the entry) `    description: '...'`
ID_RE = re.compile(r"^    id: '([^']+)',\s*$")
DESC_RE = re.compile(r"^    description: '(.*)',\s*$")


def extract_primitives(domain: str):
    """Ordered (id, description) for each top-level primitive in <domain>.ts."""
    text = (CATALOG_DIR / f"{domain}.ts").read_text(encoding="utf-8").splitlines()
    out, pending_id = [], None
    for line in text:
        mid = ID_RE.match(line)
        if mid:
            pending_id = mid.group(1)
            continue
        if pending_id:
            mdesc = DESC_RE.match(line)
            if mdesc:
                out.append((pending_id, mdesc.group(1)))
                pending_id = None
    return out


async def discover_grades(cs, subject):
    try:
        subjects = await cs.get_available_subjects()
    except Exception:
        return []
    seen, out = set(), []
    for s in subjects:
        sid = s.get("subject_id") or s.get("subject_name", "")
        if sid == subject and s.get("grade") and s["grade"] not in seen:
            seen.add(s["grade"])
            out.append(s["grade"])
    return out


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--domain", required=True)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    rows = []
    subject = None
    grades = []
    with contextlib.redirect_stdout(sys.stderr):
        prims = extract_primitives(args.domain)
        cs = await get_curriculum_service()
        matcher = CurriculumRetrievalMatcher(cs)
        subject = matcher.subject_for_domain(args.domain)
        if subject:
            grades = await discover_grades(cs, subject) or ["Kindergarten"]
            for pid, desc in prims:
                query = CurriculumMappingService._build_retrieval_query(desc, "", "", "", pid)
                per_grade = []
                for grade in grades:
                    p = await matcher.probe(subject=subject, grade_level=grade,
                                            query_text=query, primitive_type=pid)
                    p.pop("mapping", None)
                    top1 = p["top_k"][0] if p.get("top_k") else {}
                    per_grade.append({
                        "grade": grade,
                        "verdict": p["verdict"],
                        "reason": p.get("abstain_reason"),
                        "best": p["best_cosine"],
                        "coherent": p["coherent"],
                        "skill_id": top1.get("skill_id"),
                        "skill_desc": top1.get("skill_description"),
                    })
                # Choose best home: any MATCH (highest best), else highest-cosine near-miss
                matches = [g for g in per_grade if g["verdict"] == "match"]
                chosen = (max(matches, key=lambda g: g["best"]) if matches
                          else max(per_grade, key=lambda g: (g["best"] or 0)))
                rows.append({"primitive": pid, "chosen": chosen, "per_grade": per_grade,
                             "query_head": query[:90]})

    if not subject:
        print(f"domain '{args.domain}' has no curriculum subject — sweep N/A.")
        return

    report = {"domain": args.domain, "subject": subject, "grades": grades, "n": len(rows), "rows": rows}
    if args.json:
        print(json.dumps(report, indent=2))
        return

    print(f"\nCurriculum-Fit Sweep — domain={args.domain} -> {subject}  grades={grades}  ({len(rows)} primitives)\n")
    misses = [r for r in rows if r["chosen"]["verdict"] != "match"]
    matched = [r for r in rows if r["chosen"]["verdict"] == "match"]
    print(f"MATCH: {len(matched)}   ABSTAIN: {len(misses)}\n")
    hdr = f"{'primitive':28} {'grade':12} {'verdict':18} {'best':6} {'coh':4} skill"
    print(hdr); print("-" * len(hdr))
    for r in sorted(rows, key=lambda r: (r["chosen"]["verdict"] == "match", -(r["chosen"]["best"] or 0))):
        c = r["chosen"]
        v = c["verdict"].upper() + (f"/{c['reason']}" if c.get("reason") else "")
        best = f"{c['best']:.3f}" if isinstance(c["best"], (int, float)) else "n/a"
        skill = f"{c['skill_id']} {c['skill_desc']}" if c["verdict"] == "match" else "—"
        print(f"{r['primitive']:28} {c['grade']:12} {v:18} {best:6} {c['coherent']}/5 {skill}")


if __name__ == "__main__":
    asyncio.run(main())
