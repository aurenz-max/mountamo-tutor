# Curriculum-Fit: number-bond — 2026-06-07

**Domain → Subject:** math → MATHEMATICS
**Query (embedded):** Classic number bond diagram (circle-and-branch visual) showing part-part-whole relationships. Supports 4 challenge types: decompose…
**Target grades (from constraints):** K (max 5), 1 (max 10)

## Results

| Grade | Verdict | Best cosine | Coherence | Matched skill |
|-------|---------|-------------|-----------|---------------|
| K | MATCH | 0.806 | 3/5 | COUNT001-05 "Compose and Decompose Numbers 11–19" (top-1); OPS001-03 "Fluently add and subtract within 5" (ranks 2 & 4) |
| 1 | MATCH | 0.816 | 5/5 | OPS001-06 "Put-Together/Take-Apart Problems" — all top-5 are OPS001 skills that *name number bonds in their constraints* |

## Diagnosis & Recommendation

**Both grades have a clear curriculum home. No action required.**

Grade 1 is an exceptionally strong fit — the top-5 (OPS001-06, -10, -08, -07, -03) all sit in the operations family and every one explicitly prescribes "use number bond diagrams / number bond visualization" in its subskill constraints. The G1 curriculum was authored expecting exactly this primitive.

**One note (not a defect, no edit recommended):** At Kindergarten the top-1 by cosine is `COUNT001-05-F` "Compose and decompose numbers 11–19," which is *above* the number-bond K range (constraint: max 5). The pedagogically correct K home is `OPS001-03` "Fluently add and subtract within 5" (fact families within 5 @ rank 2, missing-number within 5 @ rank 4), which the retrieval ranks 0.800 / 0.786 — well within the match band and aligned to the K max=5 constraint. The runtime matcher would still produce a coherent, correct attribution at K; the 11–19 skill just shares the same "compose/decompose" language and scores marginally higher. If anything were ever to be tightened it would be the curriculum's grade placement of COUNT001-05, not this primitive's description — out of scope for this skill.
