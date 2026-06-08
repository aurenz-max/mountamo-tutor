"""
Experiment for QA §8: is primitive->skill a RETRIEVAL problem (embeddings +
cosine), not a GENERATION problem (forced LLM best-match)?

Reuses the exact technique from curriculum-authoring-service SuggestionEngine:
  gemini-embedding-2-preview + cosine similarity + a calibrated threshold.

For each domain-bound math primitive, embed its catalog description and rank the
37 MATHEMATICS subskills by cosine. Abstain if the best score < TAU.

Predictions (vs the LLM experiment, which abstained on BOTH):
  - ordinal-line: best match LOW  -> abstain TRUTHFULLY (no ordinal skill exists)
  - ten-frame:    best match HIGH -> MATCH (fixes the LLM's false abstain)

Run:
  cd backend && PYTHONPATH=$(pwd) ./venv/Scripts/python.exe scripts/repro_embedding_match.py
"""
import asyncio
import logging
import sys

logging.basicConfig(level=logging.WARNING, stream=sys.stdout)

from dotenv import load_dotenv
load_dotenv()

import numpy as np
from google import genai
from app.core.config import settings
from app.dependencies import get_curriculum_service

EMBEDDING_MODEL = "gemini-embedding-2-preview"
TAU = 0.60   # same subskill-level threshold SuggestionEngine uses

# Catalog descriptions (math.ts) + the tester topic — the RICH signal the LLM
# path drops. Embeddings can use it.
PRIMITIVES = [
    {"id": "ordinal-line", "topic": "Ordinal positions",
     "text": "Ordinal positions activity. Students identify positions (1st-10th), match ordinal "
             "words to symbols, answer relative position questions (before/after), and build "
             "sequences. Teaching ordinal numbers in context. K-1 number sense.",
     "expect": "ABSTAIN (no ordinal skill in math)"},
    {"id": "ten-frame", "topic": "Building numbers, subitizing, and making ten",
     "text": "Ten-frame 2x5 grid manipulative for number sense. Students place counters to build "
             "numbers 0-20, develop subitizing (instant quantity recognition), compose/decompose "
             "numbers, practice the make-ten strategy, and solve addition/subtraction using the "
             "frame. Foundational for K-2 number sense, counting, addition, and subtraction.",
     "expect": "MATCH (ten-frame addition/number-sense skills exist)"},
]


def embed(client, texts):
    out = []
    for i in range(0, len(texts), 100):  # API caps batch at 100
        resp = client.models.embed_content(model=EMBEDDING_MODEL, contents=texts[i:i + 100])
        for e in resp.embeddings:
            v = np.array(e.values)
            n = np.linalg.norm(v)
            out.append(v / n if n > 0 else v)
    return out


async def main():
    cs = await get_curriculum_service()
    GRADE = "Kindergarten"   # ordinal-line is a K primitive; grade=None wrongly loads Grade 1
    units = await cs.get_curriculum("MATHEMATICS", grade=GRADE)
    nodes = []  # (skill_desc, subskill_id, subskill_desc)
    for u in units:
        for sk in u.get("skills", []):
            for ss in sk.get("subskills", []):
                nodes.append((sk["description"], ss["id"], ss["description"]))
    print(f"Loaded {len(nodes)} {GRADE} MATHEMATICS subskills\n")

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    node_texts = [f"{skd}: {ssd}" for skd, _, ssd in nodes]
    node_vecs = embed(client, node_texts)
    node_mat = np.vstack(node_vecs)

    for p in PRIMITIVES:
        qvec = embed(client, [p["text"]])[0]
        sims = node_mat @ qvec
        order = np.argsort(-sims)[:5]
        best = float(sims[order[0]])
        verdict = "MATCH  " if best >= TAU else "ABSTAIN"
        print("=" * 74)
        print(f"{p['id']:14} topic={p['topic']!r}")
        print(f"  expect : {p['expect']}")
        print(f"  VERDICT: {verdict} (best cosine={best:.3f}, tau={TAU})")
        print(f"  top-5 nearest MATHEMATICS subskills:")
        for rank, idx in enumerate(order, 1):
            skd, ssid, ssd = nodes[idx]
            print(f"    {rank}. {sims[idx]:.3f}  {ssid:14} {skd} — {ssd[:46]}")
        print()


if __name__ == "__main__":
    asyncio.run(main())
