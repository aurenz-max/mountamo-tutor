"""
Repro harness for QA_curriculum_mapping_misattribution.

Drives the REAL CurriculumMappingService with the exact inputs the
MathPrimitivesTester sends for `ordinal-line`, and surfaces the two pieces of
evidence missing from the original server log:

  1. Which subjects were loaded into the Gemini prompt (is MATHEMATICS present?)
  2. Whether an ordinal-positions skill exists in the loaded math curriculum
  3. The raw Gemini response + final mapping (subject/skill/subskill/confidence)

Run:
  cd backend && ./venv/Scripts/python.exe scripts/repro_ordinal_mapping.py
"""
import asyncio
import json
import logging
import sys

# Make INFO logs from the services visible (this is where "Resolved N subjects"
# and "Resolved via Gemini" are emitted).
logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s", stream=sys.stdout)

from dotenv import load_dotenv
load_dotenv()

from app.dependencies import get_curriculum_service, get_gemini_generate_service
from app.services.curriculum_mapping_service import CurriculumMappingService


# Exact inputs for `ordinal-line` from MathPrimitivesTester.tsx:100 + the
# free-form frontend payload (no componentIntent, no curriculumSubject, auto subject).
TOPIC = "Ordinal positions"
COMPONENT_INTENT = ""        # tester sends no intent
GRADE_LEVEL = "kindergarten"
PRIMITIVE_TYPE = "ordinal-line"
SUBJECT_HINT = None          # subject == 'auto' => hint dropped => full cross-subject curriculum


async def main():
    curriculum_service = await get_curriculum_service()
    gemini_service = get_gemini_generate_service()
    svc = CurriculumMappingService(curriculum_service, gemini_service)

    print("\n" + "=" * 70)
    print("STEP 1 — which subjects load into the Gemini prompt?")
    print("=" * 70)
    subject_dicts = await curriculum_service.get_available_subjects()
    subject_names = [
        s.get("subject_id") or s.get("subject_name", "")
        for s in subject_dicts if isinstance(s, dict)
    ]
    print(f"Available subjects: {subject_names}")

    summary_json = await svc._build_curriculum_summary(subject_names)
    summary = json.loads(summary_json)
    print(f"\nSubjects actually present in curriculum summary: "
          f"{[s['subject'] for s in summary]}")
    for s in summary:
        print(f"  - {s['subject']}: {len(s['skills'])} skills")

    print("\n" + "=" * 70)
    print("STEP 2 — is there an ordinal / math match available at all?")
    print("=" * 70)
    hits = []
    for s in summary:
        for sk in s["skills"]:
            blob = (sk["skill_description"] + " " + sk["skill_id"]).lower()
            if "ordinal" in blob or "ordin" in blob:
                hits.append((s["subject"], sk["skill_id"], sk["skill_description"]))
    print(f"Skills mentioning 'ordinal': {hits if hits else 'NONE'}")
    math_present = any(s["subject"].upper().startswith(("MATH", "MATHEMATICS")) for s in summary)
    print(f"MATHEMATICS present in summary: {math_present}")

    print("\n" + "=" * 70)
    print("STEP 3 — run the REAL resolve_mapping (fresh, no cache)")
    print("=" * 70)
    mapping = await svc.resolve_mapping(
        topic=TOPIC,
        component_intent=COMPONENT_INTENT,
        grade_level=GRADE_LEVEL,
        primitive_type=PRIMITIVE_TYPE,
        subject_hint=SUBJECT_HINT,
    )
    print("\nFINAL MAPPING:")
    print(json.dumps(mapping.to_dict(), indent=2))


if __name__ == "__main__":
    asyncio.run(main())
