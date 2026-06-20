# Eval Report: fraction-circles — 2026-06-18

## Results

| Eval Mode  | Status | Issues |
|------------|--------|--------|
| identify   | PASS   | 1 (variety) |
| build      | PASS   | 1 (variety) |
| compare    | PASS   | 1 (variety) |
| equivalent | PASS   | 1 (variety) |

All modes are correct on CRITICAL/HIGH criteria — math valid, answers derivable
from the visual, no answer leaks, every challenge type has a component code path.
The single cross-mode issue is **low generation variety** (numerator/fraction
monotony), which is a MEDIUM pedagogy/engagement finding, not a correctness break.

## Issues

### all modes — frozen fraction ladder across runs (low entropy)
- **Severity:** MEDIUM
- **What's broken:** The generator emits a near-identical fraction sequence on
  every generation. 3 runs/mode produced essentially the same set:
  - identify: `1/2, 2/3, 3/6, 5/8, 7/12`
  - build: `1/2, 2/3, 3/4, 5/8, 7/12`
  - compare: **always** opens `1/2 vs 1/4`, then the same ladder
  - equivalent: `1/2→4, 1/3→6, 2/4→8, 3/4→12`
  Numerators do climb (1,2,3,5,7) but the specific fractions are frozen run-to-run.
  Root cause: the prompt's "start with halves/thirds and move to harder ones"
  collapses Gemini onto one canonical progression; entropy lives in prose, not in
  a topic-authoritative discrete pool injected into the prompt.
- **Data:** first challenge numerator = 1 (unit fraction) on every run; ~0 variety
  across independent generations.
- **Fix in:** GENERATOR — add a number-pool service (`/add-number-pool-service`):
  build a Fisher-Yates–shuffled discrete pool of grade-band-legal (numerator,
  denominator) pairs and inject it into the prompt so the candidate set == scope
  and the ordering varies per generation. (Same fix shape as the skip-counting
  skipValue resolver.)
- **RESOLVED 2026-06-18:** added `createFractionPool(denominators, {count})` to
  `numberPoolService.ts` (generalizes `createDiscretePool` to fraction PAIRS over
  a legal denominator set) + wired into `gemini-fraction-circles.ts`: per-call
  shuffled pool over the grade-band denominator set (K-2 {2,3,4} / 3-5
  {2,3,4,5,6,8,10,12}), injected with `authoritativeSource: 'the topic'`; replaced
  requirement #2's "start with halves/thirds" convergence rule with "choose from
  the pool, vary numerators." Re-ran 3×/mode: first item no longer always `1/2`,
  numerators now span 1–11, 0 run-to-run repetition. Scope-conflict (K-2 + "halves
  and fourths") respected the den≤4 ceiling in all runs and honored the topic
  family. Component checkers already derive answers from numerator/denominator, so
  no LLM-claimed answer is trusted (G4 satisfied).
