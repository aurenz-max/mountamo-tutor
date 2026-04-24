# Eval Report: annotated-example — 2026-04-24

Tested after orchestrator schema refactor (flat `step0..step7` → array-based `steps`). Three topics at different grade levels: 7th-grade linear equation, AP Calculus area between curves, Algebra 2 absolute value inequality.

## Results

| Test | Topic | Status | Step count | Types chosen | Issues |
|------|-------|--------|-----------|--------------|--------|
| 1 | `2x + 3 = 11` (7th) | PASS-with-issues | 6 | diagram, algebra×4, verify | 1 HIGH (redundant steps) |
| 2 | Area between `y=x²` and `y=x` (AP Calc) | PASS-with-issues | 7 | algebra, graph, algebra×4, verify | 1 HIGH (redundant steps), 1 MEDIUM (weak verify) |
| 3 | `\|x - 2\| < 3` (Alg 2) | PASS-with-issues | 6 | diagram, case-split, algebra×3, verify | 1 HIGH (redundant steps) |

**Refactor verdict: WORKS.** Array schema produces valid plans, honest step counts (6, 7, 6 — not forced to 5), correct types chosen for each problem class (case-split for absolute value, graph-sketch for area). No JSON parse errors, no truncation. Final answers correct in all three cases.

## Issues

### Test 1 — Steps 2, 3, 4 are duplicates
- **Severity:** HIGH
- **What's broken:** Architect planned "Simplifying the Equation" (step 2), "Splitting into Groups" (step 3), and "Finding the Final Value" (step 4) as three distinct steps. All three produce the identical algebra: `2x = 8` → divide by 2 → `x = 4`. Student sees the same move three times in a row.
- **Data:** steps 2, 3, 4 all show `2x = 8 → \frac{2x}{2} = \frac{8}{2} → x = 4`
- **Fix in:** GENERATOR (orchestrator prompt — add "do not plan two steps that perform the same mathematical move")

### Test 2 — Step 2 over-performs, steps 3-5 redundantly repeat its work
- **Severity:** HIGH
- **What's broken:** Step 2 ("Set Up the Area Integral") is supposed to *set up* the integral but instead runs the full solution: applies the power rule, evaluates at bounds, finds common denominators, and produces `A = 1/6`. Then step 3 ("Find the Antiderivative") redoes the antiderivative, step 4 ("Evaluate at Boundaries") redoes the substitution, and step 5 ("Simplify Final Result") redoes the common-denominator work.
- **Data:** step 2 transitions chain all the way to `\frac{3}{6} - \frac{2}{6}` with result `\frac{1}{6}` — no room for downstream steps to contribute
- **Fix in:** GENERATOR (algebra step generator — honor the brief's scope; "set up" should stop at `\int (x - x^2) dx` not execute the integration)

### Test 2 — Verification doesn't verify
- **Severity:** MEDIUM
- **What's broken:** Verification step just converts `1/6` to `0.1667` and checks it's between 0 and 0.5. That's a sanity bound, not a verification. A real verification would either recompute the integral differently (e.g., integrate top-bottom as `\int (x - x²) dx`) or verify by geometric estimation.
- **Data:** `checkTransitions: [{from: "0 < 1/6 < 0.5", op: "Comparison test", to: "0 < 0.167 < 0.5"}]`
- **Fix in:** GENERATOR (verification step prompt for integrals needs a richer check strategy)

### Test 3 — Case-split step already solves both cases, then algebra steps re-solve them
- **Severity:** HIGH
- **What's broken:** Step 1 (case-split) produces `x < 5` and `x > -1` by showing the full algebra for each case. Then step 2 redoes "x - 2 < 3 → x < 5" and step 3 redoes "x - 2 > -3 → x > -1". Those later steps are pure repetition.
- **Data:** step 1 case results match step 2 and step 3 results exactly
- **Fix in:** GENERATOR (orchestrator should recognize that case-split implies the per-case work is done; downstream steps should combine, not re-solve)

## Systemic Pattern (New)

**Redundant step planning after an "over-performing" earlier step.** Observed in all 3 tests. Two flavors:

1. **Architect over-decomposes a single logical move into 2-4 steps** (Test 1).
2. **An earlier step executes more than its brief implies, making downstream steps redundant** (Tests 2 & 3).

Both produce worked examples where students watch the same work happen repeatedly — tedious, not pedagogical.

## Step 2a: Sync Check

- **G1 (required fields per type):** PASS. All step types render correctly; no missing required fields in any of the 19 generated steps.
- **G2 (flat-field reconstruction):** N/A — array schema now, not flat-indexed. The failure mode this rule protects against is gone as of this refactor.
- **G3 (mode differentiation):** N/A — no eval modes on annotated-example.
- **G4 (answer derivability):** PASS. In each test, the stated final answer (x=4, 1/6, -1<x<5) is correctly derivable from the step chain.
- **G5 (fallback audit):** No silent fallbacks fire in the generator hot path (only `|| 'algebra'` on bad stepType strings, which didn't trigger).

## What's not broken

- Schema refactor itself — zero issues. Array form parses cleanly. Plans are now honest about length.
- Step type selection — architect picks the right type for each problem.
- Dependency graph — wave executor runs correctly, inputs flow between steps.
- Annotations — all 4 layers populated in every step.
- KaTeX syntax — valid throughout.
- Final answers — correct in all 3 tests.
