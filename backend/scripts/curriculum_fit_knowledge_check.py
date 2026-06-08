"""
Curriculum-Fit QA — Knowledge-Check (content-driven, out-of-sample).

knowledge-check lives in the cross-cutting `assessment` domain, which has NO fixed
curriculum subject. So unlike math/science primitives, its curriculum home is decided
ENTIRELY by the CONTENT it is populated with. This harness simulates "a knowledge-check
filled with content about topic T at grade 1", routes it to the content's subject, and
runs the REAL scoped CurriculumRetrievalMatcher.probe() — the same path
/api/problems/submit uses — to ask: does retrieval find the correct grade-1 home?

The topics are HELD-OUT content (not derived from any catalog description), so the result
is a general read on how well scoped retrieval generalizes OUT OF SAMPLE.

Usage:
  cd backend && PYTHONPATH=$(pwd) ./venv/Scripts/python.exe scripts/curriculum_fit_knowledge_check.py [--json]
"""
import argparse
import asyncio
import contextlib
import json
import logging
import re
import sys

logging.basicConfig(level=logging.ERROR, stream=sys.stderr)

from dotenv import load_dotenv
load_dotenv()

from app.dependencies import get_curriculum_service
from app.services.curriculum_retrieval_service import CurriculumRetrievalMatcher
from app.services.curriculum_mapping_service import CurriculumMappingService

GRADE = "1"


def fam(skill_id: str) -> str:
    """Curriculum UNIT family for a skill_id (OPS001-03 -> OPS001)."""
    if not skill_id:
        return ""
    return re.sub(r"-[^-]+$", "", skill_id)


# Each item simulates a grade-1 knowledge-check populated with `content` (the concept
# the KC questions actually probe). `domain` = subject we route the content to.
# expect: a family string (MATCH that family), "ABSTAIN", or "UNROUTABLE".
FIXTURE = [
    # ---- In-curriculum core: should MATCH the right family (recall) ----
    dict(id="m_add10", cat="core", domain="math", topic="Adding within 10",
         expect="OPS001",
         content="Quiz: What is 3 + 4? Which number sentence shows five plus two? "
                 "Sara has 6 stickers and gets 2 more — how many now? Solve 7 + 1 = ?"),
    dict(id="m_time_hour", cat="core", domain="math", topic="Telling time to the hour",
         expect="MEAS001",
         content="Quiz: What time does the clock show when the hour hand points to 3 and the "
                 "minute hand points to 12? Match the analog clock to 5 o'clock. Write the time to the hour."),
    dict(id="m_tens_ones", cat="core", domain="math", topic="Tens and ones place value",
         expect="NBT001",
         content="Quiz: How many tens and how many ones are in 34? Build the number 27 with ten-rods "
                 "and unit cubes. Which is greater, 41 or 38? What is 10 more than 52?"),
    dict(id="m_2d_shapes", cat="core", domain="math", topic="2D shape attributes",
         expect="GEOM001",
         content="Quiz: How many sides does a triangle have? How many vertices does a square have? "
                 "Is this shape open or closed? Which attribute defines a rectangle?"),
    dict(id="m_patterns", cat="core", domain="math", topic="Repeating patterns",
         expect="PTRN001",
         content="Quiz: What comes next in the pattern red, blue, red, blue, ___ ? Find the missing "
                 "shape in the repeating core. Extend the pattern circle, square, square, circle, square, square."),
    dict(id="m_coins", cat="core", domain="math", topic="Identifying coins and value",
         expect="MEAS001",
         content="Quiz: Which coin is a nickel? How much is a dime worth in cents? Count these three "
                 "pennies — what is the total value? Match each coin to its value."),

    # ---- In-curriculum core, other subjects ----
    dict(id="l_cvc", cat="core", domain="literacy", topic="Short vowel CVC decoding",
         expect="LA001",
         content="Quiz: Read the word 'cat' by blending the sounds. Which word has a short 'a' sound? "
                 "Decode 'pin'. Pick the word that rhymes with 'hot'."),
    dict(id="l_nouns", cat="core", domain="literacy", topic="Identifying nouns",
         expect="LA004",
         content="Quiz: Click the noun in the sentence 'The dog ran fast.' Which word names a person, "
                 "place, or thing? Sort these words into common and proper nouns."),
    dict(id="l_story", cat="core", domain="literacy", topic="Story characters and setting",
         expect="LA003",
         content="Quiz: Who is the main character in the story? Where does the story take place (the setting)? "
                 "What major event happens in the middle of the story?"),
    dict(id="l_syn_ant", cat="core", domain="literacy", topic="Synonyms and antonyms",
         expect="LA005",
         content="Quiz: Which word means the same as 'big'? Pick the opposite of 'happy'. Match each "
                 "word to a word with a similar meaning. Find the antonym of 'fast'."),
    dict(id="s_sound", cat="core", domain="science", topic="Vibrations and sound",
         expect="SCI001",
         content="Quiz: What makes a sound when you pluck a guitar string? True or false: faster "
                 "vibrations make a higher pitch. Which object is vibrating to make the noise?"),
    dict(id="s_animal_parts", cat="core", domain="science", topic="Animal body parts for survival",
         expect="SCI002",
         content="Quiz: Which body part helps a bird fly? Match the animal part to how it helps the "
                 "animal survive. Why does a fish have fins? Sort body parts by their survival function."),
    dict(id="s_day_night", cat="core", domain="science", topic="Day and night, sun patterns",
         expect="SCI003",
         content="Quiz: What causes day and night? Where is the sun in the morning versus the evening? "
                 "Put the day-night cycle events in order from sunrise to night."),
    dict(id="s_machines", cat="core", domain="science", topic="Simple machines",
         expect="SCI005",
         content="Quiz: How does moving the fulcrum on a seesaw change the effort? Which simple machine "
                 "is a ramp? Use a pulley to lift the flag — which way do you pull?"),

    # ---- Cross-subject MISROUTING: should ABSTAIN (misattribution guard) ----
    dict(id="x_math_as_literacy", cat="misroute", domain="literacy", topic="Adding within 10",
         expect="ABSTAIN",
         content="Quiz: What is 3 + 4? Which number sentence shows five plus two? Solve 7 + 1 = ?"),
    dict(id="x_literacy_as_math", cat="misroute", domain="math", topic="Short vowel CVC decoding",
         expect="ABSTAIN",
         content="Quiz: Read the word 'cat' by blending the sounds. Which word has a short 'a' sound? Decode 'pin'."),

    # ---- Out-of-curriculum / wrong-grade: should ABSTAIN (boundary) ----
    dict(id="o_multiplication", cat="oos", domain="math", topic="Multiplication as equal groups",
         expect="ABSTAIN",
         content="Quiz: There are 4 baskets with 3 apples each — what is 4 times 3? Which array shows "
                 "2 rows of 5? Skip count to find the product of 3 x 6."),
    dict(id="o_count10_K", cat="oos", domain="math", topic="Counting objects to 10 (Kindergarten)",
         expect="ABSTAIN",
         content="Quiz: Count the 7 ducks and pick the number. How many stars are there — count from 1? "
                 "Which group has exactly 5 objects?"),
    dict(id="o_fractions_symbolic", cat="oos", domain="math", topic="Writing fractions one half and one fourth",
         expect="ABSTAIN",
         content="Quiz: Write one half as a fraction. Which symbol means one fourth, 1/4 or 1/3? "
                 "What fraction of the pizza is shaded if 1 of 4 equal slices is colored?"),

    # ---- Unroutable subject: curriculum exists but no domain mapping ----
    dict(id="ss_community", cat="unroutable", domain="social_studies", topic="Community helpers and maps",
         expect="UNROUTABLE",
         content="Quiz: What does a firefighter do in the community? Which map symbol shows a road? "
                 "Name a community helper who delivers mail."),
]


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    rows = []
    with contextlib.redirect_stdout(sys.stderr):
        cs = await get_curriculum_service()
        matcher = CurriculumRetrievalMatcher(cs)

        for item in FIXTURE:
            subject = matcher.subject_for_domain(item["domain"])
            row = dict(id=item["id"], cat=item["cat"], domain=item["domain"],
                       topic=item["topic"], expect=item["expect"], subject=subject)
            if not subject:
                row.update(verdict="UNROUTABLE", best=None, coherent=None,
                           top1_skill=None, top1_fam=None, reason="no_subject_for_domain")
                row["pass"] = (item["expect"] == "UNROUTABLE")
                rows.append(row)
                continue

            query = CurriculumMappingService._build_retrieval_query(
                item["content"], item["topic"], "", "", "knowledge-check"
            )
            probe = await matcher.probe(
                subject=subject, grade_level=GRADE, query_text=query, primitive_type="knowledge-check"
            )
            top1 = probe["top_k"][0] if probe.get("top_k") else {}
            top1_skill = top1.get("skill_id")
            top1_fam = fam(top1_skill) if top1_skill else None
            verdict = probe["verdict"].upper()
            row.update(
                verdict=verdict,
                best=round(probe["best_cosine"], 3) if isinstance(probe.get("best_cosine"), (int, float)) else None,
                coherent=f"{probe['coherent']}/{len(probe['top_k'])}",
                top1_skill=top1_skill, top1_fam=top1_fam,
                reason=probe.get("abstain_reason"),
                top3=[f"{t['cosine']:.3f} {t['skill_id']}" for t in probe.get("top_k", [])[:3]],
            )
            exp = item["expect"]
            if exp == "ABSTAIN":
                row["pass"] = (verdict == "ABSTAIN")
            elif exp == "UNROUTABLE":
                row["pass"] = False  # it was routable, so it failed the expectation
            else:
                row["pass"] = (verdict == "MATCH" and top1_fam == exp)
            rows.append(row)

    if args.json:
        print(json.dumps(rows, indent=2))
        return

    npass = sum(1 for r in rows if r["pass"])
    print(f"\nKnowledge-Check Curriculum-Fit QA — grade {GRADE} — {npass}/{len(rows)} expectations met\n")
    hdr = f"{'id':22} {'cat':10} {'route':14} {'verdict':9} {'best':6} {'coh':5} {'landed':14} {'expect':10} {'P/F'}"
    print(hdr); print("-" * len(hdr))
    for r in rows:
        landed = (r["top1_fam"] or "-") if r["verdict"] != "UNROUTABLE" else "(no route)"
        best = f"{r['best']:.3f}" if isinstance(r["best"], float) else "-"
        coh = r["coherent"] or "-"
        pf = "PASS" if r["pass"] else "FAIL"
        print(f"{r['id']:22} {r['cat']:10} {r['domain']:14} {r['verdict']:9} {best:6} {coh:5} "
              f"{landed:14} {r['expect']:10} {pf}")
    print("\nDetail (top-3 per routed item):")
    for r in rows:
        if r.get("top3"):
            print(f"  {r['id']:22} -> {', '.join(r['top3'])}  [{r.get('reason') or 'match'}]")


if __name__ == "__main__":
    asyncio.run(main())
