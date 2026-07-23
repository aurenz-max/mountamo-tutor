# Curriculum-Fit: di-word-reading — 2026-07-22

**Domain → Subject:** literacy (passed explicitly; DI family follow-up `subject_for_domain('di')→LANGUAGE_ARTS` still open) → LANGUAGE_ARTS
**Query (embedded):** Live-judged Direct Instruction WORD READING (DISTAR "What word?"): the tutor models a printed word — sounding out a decodable CVC…

## Results

| Grade | Verdict | Best cosine | Coherence | Matched skill |
|-------|---------|-------------|-----------|---------------|
| 1 | MATCH | 0.800 | 3/5 | LA001-01 "Short and Long Vowel Decoding — Decode short vowel CVC words" (LA001-07 "Sight Words" also top-5 @ 0.786) |
| K | ABSTAIN (diffuse) | 0.819 | 2/5 | — top-1 IS the right concept: "Decoding CVC Words (Reading) — Decode CVC words with Short 'a'" |

## Diagnosis & Recommendation

- **Grade 1 — clear home.** LA001-01 is exactly the skill (and is where the
  di-letter-sounds 07-21 standalone run's Gemini re-mapper landed, LA001-01-a).
  Sight-word objectives have their own G1 home (LA001-07).
- **K — vote-splitting, not a gap and not a thin description.** All five top
  hits are the right phonics neighborhood (CVC decoding short a @ 0.819, short
  e, onset-rime blending, CVC encoding, CVC application) but they sit in
  sibling skill FAMILIES, so the ≥3/5 coherence rule abstains. The home exists;
  the K curriculum's granularity splits it. Practical effect: K submissions
  through `/api/problems/submit` would abstain → fall to the Gemini mapper
  (which demonstrably lands on CVC-decode skills). No catalog edit
  recommended — revisit only if K attribution misbehaves in practice; a
  possible future lever is family-linking the K CVC units (curriculum-side),
  not description surgery.
