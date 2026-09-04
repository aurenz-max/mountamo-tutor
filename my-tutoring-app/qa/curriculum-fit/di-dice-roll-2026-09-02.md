# Curriculum-Fit: di-dice-roll — 2026-09-02

**Domain → Subject:** di → MATHEMATICS (explicit cross-subject DI override)
**Query (embedded):** Live-judged Direct Instruction DICE-PIP QUANTITY practice: the child taps one die to roll it, looks at the pip pattern…

## Results

| Grade | Verdict | Best cosine | Coherence | Matched skill |
|-------|---------|-------------|-----------|---------------|
| K | MATCH | 0.7362 | 4/5 | COUNT001-02 “Count to tell the number of objects” |
| 1 | MACHINE MATCH, MANUALLY REJECTED | 0.7292 | 3/5 | Top-1 was MEAS001-06 “Interpreting Data,” not pip quantity/cardinality |

## Diagnosis & Recommendation

- **Kindergarten — clear curriculum home.** The top results cluster around one-to-one counting and counting objects in varied arrangements; COUNT001-02-A and COUNT001-02-B honestly describe the primitive's current `count_pips` task.
- **Grade 1 — curriculum gap / unsafe false positive.** The retrieval gate passed on a scattered set of data, addition, coin, and word-problem skills, but none is the actual one-die pip-quantity task. Treat the L0 primitive as Pre-K/K for adaptive attribution. If Grade 1 remediation must write Grade 1 mastery, add an honest Grade 1 counting/subitizing subskill through `/curriculum-author`, then rerun this probe. Do not attribute Dice Roll attempts to MEAS001-06.

The DI family defaults to Language Arts, so `di-dice-roll` was explicitly scoped to Mathematics in the retrieval service before this probe. A regression test pins that subject routing.
