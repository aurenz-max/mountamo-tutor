# Eval Report: balance-scale — 2026-05-21

> Re-evaluation triggered by user UX testing. Previous run (same date) marked all
> 6 modes PASS on math-correctness only. Manual play revealed canonical equations
> are unsolvable via the documented interaction. Fixed via decomposed-RHS
> generator pattern + whole-side divide/multiply component logic.

## Results

| Eval Mode      | Status | Issues |
|----------------|--------|--------|
| equality       | PASS   | —      |
| equality_hard  | PASS   | —      |
| one_step       | PASS   | —      |
| one_step_hard  | PASS   | —      |
| two_step_intro | PASS   | —      |
| two_step       | PASS   | —      |

## Resolved Issues

### BS-1 — Canonical equations unsolvable via documented interaction (RESOLVED)
- **Fix:** GENERATOR — all builders now produce equations with decomposed RHS so the literal constant block exists on both sides. For `x + b = c` form, RHS = `[answer, b]` instead of `[c]`. Student clicks `b` → both removed → `[x] = [answer]` → SOLVED. For pre-isolated forms (`[x] = [c, b]`) student computes the sum. For multiply/divide modes (`kx = c`), kept as `[x,x,...,x] = [c]` and rely on the component fix below.
- **Files:** `service/math/gemini-balance-scale.ts` — rewrote `buildEquality`, `buildEqualityHard`, `buildOneStep`, `buildTwoStepIntro`, `buildTwoStep`; introduced `VAR_BLOCK`/`CONST_BLOCK` helpers.
- **Verified:** All 4 challenges per mode in 6/6 modes solvable via click-to-remove + (where allowed) whole-side divide. Math correctness preserved (`Σleft === Σright` when `x` substituted).

### BS-2 — divide/multiply mapped element-wise instead of combining like terms (RESOLVED)
- **Fix:** COMPONENT — replaced element-wise `map` over `o.value / k` with whole-side `divideSide` / `multiplySide` helpers. `divideSide` collapses each like-labeled variable group to `count/k` copies and divides each constant value by `k`. `multiplySide` replicates each variable `k` times and multiplies each constant by `k`. New `isSideDivisibleBy` precheck rejects the op with a clear error before mutating state.
- **Files:** `primitives/visual-primitives/math/BalanceScale.tsx` — added 3 helpers above the component; rewrote the `multiply`/`divide` branches of `applyOperation`.
- **Verified:** `[x,x,x,x] ÷ 4` → `[x]` (1 copy, not 4 fractional copies). `[12] ÷ 4` → `[3]`. Reject path: `[x,x,x,2] ÷ 3` flags "Cannot divide both sides evenly by 3" without corrupting state.

## G1-G5 Sync Verification (post-fix)

| Rule | Result |
|------|--------|
| G1 — required fields present | PASS — every challenge has leftSide, rightSide, variableValue, instruction, hint |
| G2 — flat-field reconstruction | N/A — generator builds challenges locally; no flat-indexed schema |
| G3 — eval mode differentiation | PASS — each mode has distinct equation form / coefficient range / allowOps / gradeBand |
| G4 — answer derivability | PASS — `Σleft === Σright` with `variableValue` substituted holds for all 24 challenges (4 × 6 modes) |
| G5 — fallback quality | PASS — challengeType fallback to `'one_step'` did not fire in any run |

## Step 2a Recap

The previous report flagged a gap in the eval-test framework: G1–G5 only verify
schema correctness, not solvability through the component. The decomposed-RHS
generator pattern closes that gap structurally — every challenge now has a
documented manipulation path that reaches the solved state. Adding a formal
"G6 — solvability check" remains worthwhile for future primitives that combine
generator-side equation form with component-side interaction primitives.

## Product Decision Resolved

**DEC-BS-1:** Resolved as option 3 (recommended). Generator-side decomposition
handles equality, one_step, two_step_intro, two_step (subtract path). Component-side
whole-side divide handles one_step_hard and two_step_intro/two_step (divide path).
Both fixes coexist — each addresses a different aspect of the seam.
