"""
Integration check for the QA §8 fix: drive the REAL CurriculumRetrievalMatcher
(live Firestore curriculum + live Gemini embeddings) end-to-end, exactly as
submission_service now calls it.

Expectations (from QA §11.3):
  - ordinal-line (math, kindergarten) -> COUNT001-04 "Understand ordinal numbers", MATCH
  - ten-frame   (math, kindergarten) -> a K number-sense skill, MATCH
  - ordinal-line (math, "Grade 1")   -> ABSTAIN (diffuse plateau, no home in G1)

Run:
  cd backend && PYTHONPATH=$(pwd) ./venv/Scripts/python.exe scripts/verify_retrieval_matcher.py
"""
import asyncio
import logging
import sys

logging.basicConfig(level=logging.INFO, stream=sys.stdout, format="%(message)s")

from dotenv import load_dotenv
load_dotenv()

from app.dependencies import get_curriculum_service
from app.services.curriculum_retrieval_service import CurriculumRetrievalMatcher

ORDINAL_DESC = ("Interactive ordinal positions activity with a horizontal queue of characters. "
                "Students identify positions (1st-10th), match ordinal words to symbols, answer "
                "relative position questions, solve story-based word problems, and build sequences "
                "from clues. Perfect for teaching ordinal numbers in context. ESSENTIAL for K-1 number sense.")
TENFRAME_DESC = ("Ten-frame 2x5 grid manipulative for number sense. Students place counters to build "
                 "numbers 0-20, develop subitizing, compose/decompose numbers, practice the make-ten "
                 "strategy, and solve addition/subtraction using the frame.")

CASES = [
    ("ordinal-line", "math", "kindergarten", "Ordinal positions", ORDINAL_DESC, "MATCH (COUNT001-04)"),
    ("ten-frame", "math", "kindergarten", "Building numbers", TENFRAME_DESC, "MATCH (K number sense)"),
    ("ordinal-line", "math", "Grade 1", "Ordinal positions", ORDINAL_DESC, "ABSTAIN (no home in G1)"),
    # Grade is a SOFT scope: a band ('elementary', the value production actually sends)
    # widens to its member grades instead of abstaining. Was the silent-abstain bug.
    ("ordinal-line", "math", "elementary", "Ordinal positions", ORDINAL_DESC, "MATCH (band -> K COUNT001-04)"),
    ("ten-frame", "math", "", "Building numbers", TENFRAME_DESC, "MATCH (no grade -> all grades)"),
]


async def main():
    cs = await get_curriculum_service()
    matcher = CurriculumRetrievalMatcher(cs)
    for ptype, domain, grade, topic, desc, expect in CASES:
        subject = matcher.subject_for_domain(domain)
        query = f"{desc} Topic: {topic}"
        mapping = await matcher.match(
            subject=subject, grade_level=grade, query_text=query, primitive_type=ptype,
        )
        print("=" * 74)
        print(f"{ptype:14} domain={domain} grade={grade!r}")
        print(f"  expect : {expect}")
        if mapping:
            print(f"  RESULT : MATCH -> {mapping.subject}/{mapping.skill_id}/{mapping.subskill_id} "
                  f"(cosine={mapping.confidence:.3f}) — {mapping.skill_description}")
        else:
            print(f"  RESULT : ABSTAIN (no curriculum home)")
        print()


if __name__ == "__main__":
    asyncio.run(main())
