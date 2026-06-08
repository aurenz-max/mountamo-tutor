"""
Repro / regression lock for the number-line curriculum-home fix.

Exercises the REAL production path — CurriculumMappingService.resolve_by_retrieval
(query enrichment) -> CurriculumRetrievalMatcher.probe (unit+skill coherence) — for
the exact submission shapes the screenshot produced, and asserts:

  A. OMNIBUS-only (older client, no per-challenge signal) -> ABSTAIN. The range-averaged
     catalog blurb is genuinely diffuse at the skill level; confidently attributing it
     would be the misattribution this whole path exists to prevent.
  B. CONTENT-RICH plot @ Kindergarten -> MATCH on COUNT001 (Counting & Cardinality). The
     specific challenge ("number that comes right after zero, 0-4") pins the home.
  C. CONTENT-RICH jump @ Grade 1 -> MATCH on OPS001 (operations). Same primitive, different
     eval mode -> different (correct) home. Proves per-mode differentiation.
  D. ten-frame OMNIBUS -> still MATCH (clean single-home primitive unaffected).

Run:
  cd backend && PYTHONPATH=$(pwd) ./venv/Scripts/python.exe scripts/repro_number_line_curriculum_home.py
"""
import asyncio
import contextlib
import sys

from dotenv import load_dotenv
load_dotenv()

from app.dependencies import get_curriculum_service
from app.services.curriculum_mapping_service import CurriculumMappingService

NUMBER_LINE_OMNIBUS = (
    "Interactive number line with drag-to-plot, animated jump arcs, ordering, and zoom. "
    "Supports integers, fractions, decimals, and mixed numbers. K-2 mode (0-20, counting) "
    "and 3-5 mode (negatives, fractions, operations). Perfect for teaching number placement, "
    "addition/subtraction as movement, fraction comparison, and ordering. ESSENTIAL for K-5 math."
)
TEN_FRAME_OMNIBUS = (
    "Interactive ten-frame for building number sense. Drag counters into a 10-frame to compose "
    "and decompose numbers, see ten as a benchmark, and build addition and subtraction fluency."
)


async def main():
    failures = []
    with contextlib.redirect_stdout(sys.stderr):
        cs = await get_curriculum_service()
        svc = CurriculumMappingService(cs, gemini_service=None)

        async def resolve(**kw):
            svc.clear_cache()  # avoid cross-case cache bleed
            return await svc.resolve_by_retrieval(primitive_domain="math", primitive_type="number-line", **kw)

        # A. Omnibus only — expect ABSTAIN
        a = await resolve(topic="", grade_level="Kindergarten", objective_text="",
                          primitive_description=NUMBER_LINE_OMNIBUS, eval_mode="plot")

        # B. PLOT @ K — eval-mode description only (what an un-instrumented client sends
        #    today via the central evaluationApi injection) — expect MATCH -> COUNT001
        b = await resolve(topic="", grade_level="Kindergarten", objective_text="",
                          primitive_description=NUMBER_LINE_OMNIBUS, eval_mode="plot",
                          eval_mode_description="Place value on number line with full guidance.")

        # B2. PLOT @ K — eval-mode description + actual challenge text (sharper subskill)
        b2 = await resolve(topic="", grade_level="Kindergarten", objective_text="",
                           primitive_description=NUMBER_LINE_OMNIBUS, eval_mode="plot",
                           eval_mode_description="Place value on number line with full guidance.",
                           challenge_text="Place a point at the number that comes right after zero. "
                                          "Find the very first spot on the line. What number comes next when counting?")

        # C. JUMP @ G1 — operation-as-movement — expect MATCH -> OPS001 (operations)
        c = await resolve(topic="", grade_level="1", objective_text="",
                          primitive_description=NUMBER_LINE_OMNIBUS, eval_mode="jump",
                          eval_mode_description="Show operation as movement on number line.",
                          challenge_text="Start at 8 and jump 3 to the right to add. "
                                         "Count on along the number line to find the sum.")

        # D. ten-frame omnibus — expect MATCH (unaffected)
        d = await CurriculumMappingService(cs, gemini_service=None).resolve_by_retrieval(
            primitive_domain="math", primitive_type="ten-frame", topic="", grade_level="Kindergarten",
            objective_text="", primitive_description=TEN_FRAME_OMNIBUS, eval_mode="")

    def unit(m):
        import re
        return re.sub(r"-[^-]+$", "", m.skill_id) if m else None

    # ---- assertions (real stdout) ----
    print("Repro: number-line curriculum home\n")

    print(f"A. omnibus plot @ K        -> {'ABSTAIN' if a is None else a.skill_id}")
    if a is not None:
        failures.append(f"A expected ABSTAIN, got {a.skill_id}/{a.subskill_id}")

    print(f"B. eval-mode-desc plot @ K -> {b.skill_id if b else 'ABSTAIN'} "
          f"(unit={unit(b)}, conf={b.confidence:.3f})" if b else "B. -> ABSTAIN")
    if not b or unit(b) != "COUNT001":
        failures.append(f"B expected MATCH unit COUNT001, got {b.skill_id if b else 'ABSTAIN'}")

    print(f"B2. + challenge text @ K   -> {b2.skill_id if b2 else 'ABSTAIN'} "
          f"(unit={unit(b2)}, conf={b2.confidence:.3f})" if b2 else "B2. -> ABSTAIN")
    if not b2 or unit(b2) != "COUNT001":
        failures.append(f"B2 expected MATCH unit COUNT001, got {b2.skill_id if b2 else 'ABSTAIN'}")

    print(f"C. content-rich jump @ G1  -> {c.skill_id if c else 'ABSTAIN'} "
          f"(unit={unit(c)}, conf={c.confidence:.3f})" if c else "C. -> ABSTAIN")
    if not c or unit(c) != "OPS001":
        failures.append(f"C expected MATCH unit OPS001, got {c.skill_id if c else 'ABSTAIN'}")

    print(f"D. ten-frame omnibus @ K   -> {d.skill_id if d else 'ABSTAIN'}")
    if not d:
        failures.append("D expected MATCH, got ABSTAIN")

    print()
    if failures:
        print("FAIL:")
        for f in failures:
            print("  -", f)
        sys.exit(1)
    print("PASS — all 4 cases as expected.")


if __name__ == "__main__":
    asyncio.run(main())
