# Eval Report: function-sketch — 2026-05-23

Scope: re-test of `classify-shape` after user-reported "always sinusoidal" symptom in MathPrimitivesTester (screenshot shows 4 of 4 sinusoidal cards under an "oscillating waves" / wave-buoy topic).

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| classify-shape | FAIL | 1 HIGH |

## Issues

### classify-shape — All N parallel sub-generators converge on the same function family

- **Severity:** HIGH
- **What's broken:** `generateFunctionSketch` fans out `DEFAULT_INSTANCE_COUNT` (4) parallel calls of `generateClassifyShape` with identical args (same `topic`, same `gradeLevel`, same prompt). Gemini deterministically picks the function family that best fits the topic, so every challenge in the session lands on that one family. Across the 4-instance session the multiple-choice answer is invariant — after the first challenge the student learns "always pick `<that family>`" and the remaining 3 challenges measure nothing.
- **Reproduction:**
  - `?evalMode=classify-shape` (no topic): 4/4 `correctType="linear"` (different cookie / plant / car scenarios but all constant-slope lines).
  - `?evalMode=classify-shape&topic=oscillating%20waves`: 4/4 `correctType="sinusoidal"` (this matches the user screenshot — Vertical Displacement vs Time wave). Options shuffle position, but the right answer is the same on every card.
- **Why this is a pedagogy break, not a render bug:** Per `feedback_mastery-over-demo.md`, single-mode sessions are supposed to drill the eval mode with 3–6+ distinct instances. For *classify-shape* the whole point of the mode is discriminating between families. When 4/4 instances are the same family, the mode is functionally `degenerate-MC`: the student can lock in the answer after one challenge and coast.
- **Data:** `challenges[0..3].correctType` collapses to a single value per run (`"linear"` x4 in run 1; `"sinusoidal"` x4 in run 2). This is structurally identical to **SP-15** (eval mode bleed: same `challengeType` across modes) but at a finer granularity — *within a single mode's session* the function family is invariant.
- **Why this primitive is uniquely affected:** other math primitives that use the orchestrator-same-mode fan-out have a finite, discrete answer space the eval mode already enumerates (matrix `add`/`subtract`, fraction-bar shaded counts, etc.). `classify-shape` is the first mode where the "answer space" is the *function family itself* — and the orchestrator hands every parallel call the same topic, so every call agrees on the family.
- **Fix in:** GENERATOR (`gemini-function-sketch.ts:generateFunctionSketch` + `generateClassifyShape`)

  Suggested approach (not implemented — flagging only):
  1. Add a `targetFamily?: 'linear' | 'quadratic' | 'cubic' | 'exponential' | 'sinusoidal' | 'logarithmic'` parameter to `generateClassifyShape`. When set, the prompt must include "Generate a function from the **${targetFamily}** family only."
  2. In `generateFunctionSketch`, when `challengeType === 'classify-shape'`, build a shuffled round-robin of families (length `instanceCount`, no two adjacent the same) and pass `targetFamily` into each sub-call.
  3. Verify post-generation: classify the actual emitted y-values (monotonic linear vs concave-up quadratic vs periodic vs exponential) and reject mismatches. Reuse the monotonicity helper already in `validateFeatureSemantics`.

  This is the same architectural move that fixed **SP-18** (matrix-display per-session shuffled round-robin) and the **SP-15** coin-counter count-like vs count-mixed split, just applied to function families instead of challenge types. Reference implementation: `selectMatrixChallenges` (gemini-matrix.ts).

  Worth checking adjacent modes after the fix: `compare-functions` likely has the same problem on the "Curve A vs Curve B" axis (both curves probably always come from the same family pair given topic determinism), and `identify-features` is constrained to turning-point families by FS-1 so the impact is smaller but still real.

## Pre-check notes

- All four classify-shape challenges render correctly (component reads `classifyCurve`, `options`, `correctType`, `classifyExplanation` — all present, all populated).
- Multiple-choice plumbing works: each challenge has 4 unique options including `correctType`, `selectedOption === challenge.correctType` is the correctness check.
- Curve points pass `extractYValues` validation (all 20 finite numbers in range).
- No crash, no answer leak in instruction/title, no UI overflow. The bug is purely *cross-instance similarity*, not within-instance correctness.
