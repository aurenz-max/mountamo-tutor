"""
Experiment for QA_curriculum_mapping_misattribution §8/§10.

Question: for a DOMAIN-BOUND primitive, does pinning the subject (deterministic
from the catalog domain) + offering an explicit "or NONE" abstain option fix the
misattribution WITHOUT any subject->unit->skill cascade?

Setup vs. production:
  - production: subject_hint=None  -> ALL subjects (deduped x2)  -> force best match
  - here:       subject_hint pinned -> ONE subject (deduped)     -> match OR abstain

Faithful inputs (topic-only, exactly what MathPrimitivesTester sends). Each case
run 3x because the path is non-deterministic (QA finding #2).

Run:
  cd backend && PYTHONPATH=$(pwd) ./venv/Scripts/python.exe scripts/repro_subject_pinned_abstain.py
"""
import asyncio
import json
import logging
import sys

logging.basicConfig(level=logging.WARNING, format="%(levelname)s:%(name)s:%(message)s", stream=sys.stdout)

from dotenv import load_dotenv
load_dotenv()

from app.dependencies import get_curriculum_service, get_gemini_generate_service
from app.services.curriculum_mapping_service import CurriculumMappingService

# Domain-bound math primitives. 'expect' is what a correct system should do.
CASES = [
    {"primitive": "ordinal-line", "topic": "Ordinal positions",
     "grade": "kindergarten", "expect": "ABSTAIN (no ordinal skill in math)"},
    {"primitive": "ten-frame", "topic": "Building numbers, subitizing, and making ten",
     "grade": "kindergarten", "expect": "MATCH (real K math skill exists)"},
]
RUNS = 3
PINNED_SUBJECT = "MATHEMATICS"   # deterministic: both primitives live in MATH_CATALOG


def build_prompt(topic, grade, primitive_type, math_summary):
    return f"""You are a curriculum alignment assistant. The activity below is a MATHEMATICS primitive, so it can ONLY map to a MATHEMATICS subskill. Decide whether any subskill in the provided hierarchy genuinely assesses the SAME underlying skill as this activity.

ACTIVITY:
- Topic: {topic}
- Grade Level: {grade}
- Primitive Type: {primitive_type}

MATHEMATICS CURRICULUM:
{math_summary}

Return ONLY JSON.
- If a subskill genuinely assesses this same skill:
  {{"match": true, "skill_id": "...", "skill_description": "...", "subskill_id": "...", "subskill_description": "...", "confidence": 0.0-1.0}}
- If NO subskill genuinely assesses this activity, you MUST return:
  {{"match": false, "reason": "<short why>"}}

Rules:
- Do NOT force a match. A wrong match is worse than no match (it corrupts a child's record).
- match:true ONLY if the subskill assesses the SAME underlying skill — not merely the same grade band or broad math domain.
- Return ONLY valid JSON, no prose."""


async def main():
    curriculum_service = await get_curriculum_service()
    gemini_service = get_gemini_generate_service()
    svc = CurriculumMappingService(curriculum_service, gemini_service)

    # Pinned, single-subject, deduped summary (the dup bug can't bite a 1-elem list).
    math_summary = await svc._build_curriculum_summary([PINNED_SUBJECT])
    n_skills = len(json.loads(math_summary)[0]["skills"]) if json.loads(math_summary) else 0
    print(f"Pinned subject={PINNED_SUBJECT}: {n_skills} skills in prompt "
          f"(vs ~260 cross-subject entries in production)\n")

    results = []  # collected, printed in a clean block at the very end
    for case in CASES:
        prompt = build_prompt(case["topic"], case["grade"], case["primitive"], math_summary)
        for i in range(1, RUNS + 1):
            raw = await gemini_service.generate_response(prompt, clean_json=True)
            try:
                d = json.loads(raw)
            except json.JSONDecodeError:
                results.append((case, i, "PARSE_ERR", raw[:80]))
                continue
            if d.get("match") is True:
                results.append((case, i, "MATCH",
                                f"{d.get('skill_id')}/{d.get('subskill_id')} conf={d.get('confidence')} "
                                f"({d.get('skill_description','')[:40]})"))
            elif d.get("match") is False:
                results.append((case, i, "ABSTAIN", d.get("reason", "")[:90]))
            else:
                results.append((case, i, "NO_FIELD", json.dumps(d)[:90]))

    # Clean summary block (printed last, after all the Gemini stdout noise).
    print("\n\nRESULT::" + "=" * 64)
    last = None
    for case, i, verdict, detail in results:
        if case["primitive"] != last:
            print(f"RESULT:: {case['primitive']}  (expect: {case['expect']})")
            last = case["primitive"]
        print(f"RESULT::   run {i}: {verdict:8} {detail}")


if __name__ == "__main__":
    asyncio.run(main())
