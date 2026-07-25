# Curriculum-Fit: di-math-facts — 2026-07-24

**Domain → Subject:** di → MATHEMATICS (per-primitive override — `_PRIMITIVE_TO_SUBJECT`
in `curriculum_retrieval_service.py`; the `di` domain default stays LANGUAGE_ARTS for the
two literacy packs. Probe run with `--domain math` to mirror the production
`subject_for_primitive` resolution, since the probe script scopes by domain flag.)
**Query (embedded):** "Live-judged Direct Instruction MATH FACT fluency (\"What is 2 plus 1?\"): the tutor models a printed addition fact aloud…"

## Results

| Grade | Verdict | Best cosine | Coherence | Matched skill |
|-------|---------|-------------|-----------|---------------|
| K | MATCH | 0.785 | 5/5 (3 same-skill) | OPS001-03 "Fluently add and subtract within 5" (top-1 OPS001-03-D) |
| 1 | MATCH | 0.830 | 5/5 (3 same-skill) | OPS001-01 "Addition within 10" (top-1 OPS001-01-c) |

## Diagnosis & Recommendation

All grades have a clear curriculum home — and they are exactly the fluency skills the
pack was built for (K fluency-within-5; G1 addition-within-10). No action.

Notes:
- The K top-5 also surfaces OPS001-01 "Understand addition as putting together" —
  a sensible sibling, not diffusion (coherent 5/5).
- The per-primitive subject override is the load-bearing piece: without it a
  di-math-facts submission would have scoped retrieval to LANGUAGE_ARTS (the DI
  domain default) and mis-attributed. Wired in the same slice as the birth
  (`subject_for_primitive`, consulted by both the `use_retrieval` gate and
  `resolve_by_retrieval`).
