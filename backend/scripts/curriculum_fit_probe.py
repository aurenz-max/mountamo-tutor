"""
Curriculum-Fit Probe — does a Lumina primitive have a curriculum home?

Drives the REAL CurriculumRetrievalMatcher (live Firestore curriculum + live
Gemini embeddings) — the same scoped-retrieval path /api/problems/submit uses —
for one primitive across one or more grades, and prints the top-k curriculum
match per grade plus a verdict. This is the engine behind the /curriculum-fit
skill; the skill interprets the output and writes the report.

A MISS is diagnostic (see /curriculum-fit SKILL.md):
  - weak     (best cosine < tau everywhere)  -> likely CURRICULUM GAP (author the skill)
  - diffuse  (clears tau but top-k scattered) -> thin/misleading DESCRIPTION, or a real
                                                 gap where only loosely-related skills exist
  - no_scope (0 candidates for subject+grade)  -> SCOPING/DATA issue (grade not published)

Usage:
  cd backend && PYTHONPATH=$(pwd) ./venv/Scripts/python.exe scripts/curriculum_fit_probe.py \
      --primitive ordinal-line --domain math --grades K,1 \
      --description "Interactive ordinal positions activity ..." \
      [--topic "Ordinal positions"] [--objective "..."] [--eval-mode identify] [--json]

  --grades auto  (or omit)  -> probe every published grade for the primitive's subject.
  --json                    -> emit machine-readable JSON (for the skill to parse).
"""
import argparse
import asyncio
import contextlib
import json
import logging
import sys

# Keep stdout clean (only the final report / JSON) — logs + service init noise go to stderr.
logging.basicConfig(level=logging.WARNING, stream=sys.stderr, format="%(message)s")

from dotenv import load_dotenv
load_dotenv()

from app.dependencies import get_curriculum_service
from app.services.curriculum_retrieval_service import CurriculumRetrievalMatcher
from app.services.curriculum_mapping_service import CurriculumMappingService


async def _discover_grades(cs, subject: str) -> list:
    """Published grades (raw doc keys) that contain this subject."""
    try:
        subjects = await cs.get_available_subjects()
    except Exception:
        return []
    grades = []
    for s in subjects:
        sid = s.get("subject_id") or s.get("subject_name", "")
        if sid == subject and s.get("grade"):
            grades.append(s["grade"])
    # Dedup, stable order
    seen, out = set(), []
    for g in grades:
        if g not in seen:
            seen.add(g)
            out.append(g)
    return out


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--primitive", required=True, help="Primitive id (label, e.g. ordinal-line)")
    ap.add_argument("--domain", required=True, help="Catalog domain (math, literacy, science, ...)")
    ap.add_argument("--description", default="", help="Catalog description (the rich embedding signal)")
    ap.add_argument("--topic", default="", help="Optional lesson topic")
    ap.add_argument("--objective", default="", help="Optional lesson objective text")
    ap.add_argument("--eval-mode", default="", help="Optional eval mode focus")
    ap.add_argument("--grades", default="auto", help="Comma list (K,1) or 'auto' to discover published grades")
    ap.add_argument("--json", action="store_true", help="Emit JSON for machine parsing")
    args = ap.parse_args()

    # Run service init + probing with stdout redirected to stderr so stray init
    # prints never pollute stdout (the skill parses --json off stdout). Defer ALL
    # real-stdout printing to after the block.
    subject = None
    query = ""
    grades = []
    results = []
    with contextlib.redirect_stdout(sys.stderr):
        cs = await get_curriculum_service()
        matcher = CurriculumRetrievalMatcher(cs)
        subject = matcher.subject_for_domain(args.domain)

        if subject:
            if args.grades.strip().lower() in ("auto", ""):
                grades = await _discover_grades(cs, subject)
                if not grades:
                    grades = ["Kindergarten"]  # safe default
            else:
                grades = [g.strip() for g in args.grades.split(",") if g.strip()]

            query = CurriculumMappingService._build_retrieval_query(
                args.description, args.topic, args.objective, args.eval_mode, args.primitive
            )

            for grade in grades:
                probe = await matcher.probe(
                    subject=subject, grade_level=grade, query_text=query, primitive_type=args.primitive,
                )
                probe.pop("mapping", None)  # drop the live CurriculumMapping before serializing
                probe["grade_requested"] = grade
                results.append(probe)

    # ---- Output (real stdout) ----
    if not subject:
        msg = (f"domain '{args.domain}' has no curriculum subject (cross-cutting/unknown) — "
               f"retrieval can't scope; this primitive maps via the legacy generation path.")
        if args.json:
            print(json.dumps({"primitive": args.primitive, "domain": args.domain,
                              "subject": None, "error": msg, "results": []}, indent=2))
        else:
            print(msg)
        return

    report = {
        "primitive": args.primitive,
        "domain": args.domain,
        "subject": subject,
        "query_text": query,
        "grades_probed": grades,
        "results": results,
    }

    if args.json:
        print(json.dumps(report, indent=2))
        return

    # Human-readable
    print(f"\nPrimitive : {args.primitive}  (domain={args.domain} -> subject={subject})")
    print(f"Query     : {query[:120]}{'...' if len(query) > 120 else ''}\n")
    for r in results:
        verdict = r["verdict"].upper()
        reason = f" [{r['abstain_reason']}]" if r.get("abstain_reason") else ""
        best = r["best_cosine"]
        best_s = f"{best:.3f}" if isinstance(best, (int, float)) else "n/a"
        print("=" * 78)
        print(f"grade={r['grade_requested']!r}  scoped_to={r['grade']}  candidates={r['n_candidates']}")
        print(f"  VERDICT: {verdict}{reason}  best={best_s} (tau={r['tau']})  "
              f"coherent={r['coherent']}/{len(r['top_k'])} (min={r['min_coherent']})")
        for t in r["top_k"]:
            print(f"    {t['rank']}. {t['cosine']:.3f}  [{t.get('grade','?'):12}] {t['skill_id']:14} "
                  f"{t['skill_description']} — {t['subskill_description'][:44]}")
        print()


if __name__ == "__main__":
    asyncio.run(main())
