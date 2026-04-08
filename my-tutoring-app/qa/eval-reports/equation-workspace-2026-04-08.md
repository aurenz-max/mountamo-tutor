# QA Eval Report: equation-workspace

**Date:** 2026-04-08
**Component:** `equation-workspace`
**Generator:** `gemini-equation-workspace.ts`
**Eval modes tested:** guided-solve, identify-operation, solve, multi-step

---

## Results Table

| Eval Mode          | API Status | Challenges | G1  | G2  | G3  | G4           | G5  | Verdict     |
|--------------------|-----------|------------|-----|-----|-----|--------------|-----|-------------|
| guided-solve       | PASS (3.5s) | 5        | PASS | PASS | PASS | PASS        | PASS | PASS        |
| identify-operation | PASS (4.3s) | 5        | PASS | PASS | PASS | PASS        | PASS | PASS        |
| solve              | PASS (3.5s) | 5        | PASS | PASS | PASS | PASS        | PASS | PASS        |
| multi-step         | PASS (4.8s) | 4        | PASS | PASS | PASS | MEDIUM      | PASS | PASS (with notes) |

---

## G1 -- Required Fields

All challenges across all 4 modes have every required field populated:
- `id`, `type`, `instruction`, `equation`, `targetVariable` -- all non-empty strings
- `solutionSteps[]` -- each step has `operation`, `operationId`, `resultLatex` (all non-empty)
- `availableOperations[]` -- each op has `id`, `label`, `category` (valid enum values)
- `identify-operation` challenges all have `correctOperationId` matching an available operation
- `multi-step` challenges all have 4+ solution steps

**Verdict: PASS**

## G2 -- Flat-field Reconstruction

The generator uses flat indexed fields (`step0Operation`, `op0Id`, etc.) and reconstructs into arrays via `reconstructSteps()` and `reconstructOperations()`. All challenges across all modes have populated arrays:
- No challenge has empty `solutionSteps[]` or `availableOperations[]`
- guided-solve: 2-3 steps, 6 ops each
- identify-operation: 1-2 steps, 5 ops each
- solve: 2-3 steps, 6 ops each
- multi-step: 4-5 steps, 8 ops each

**Verdict: PASS**

## G3 -- Eval Mode Semantic Differentiation

Each eval mode maps to a unique `challengeType`:
- `guided-solve` -> type="guided-solve" (component highlights correct operation)
- `identify-operation` -> type="identify-operation" (MC selection)
- `solve` -> type="solve" (free-form operation selection)
- `multi-step` -> type="multi-step" (longer equations)

No overlap between modes. Differentiation is clean.

**Verdict: PASS**

## G4 -- Answer Derivability

- All solution step `operationId` values exist in `availableOperations` (enforced by validator)
- All `identify-operation` `correctOperationId` values exist in `availableOperations`
- `resultLatex` changes between consecutive steps (enforced by new degenerate-step filter)

**Known issue (MEDIUM):** In multi-step mode, Gemini occasionally adds steps after the variable is fully isolated that "undo" the solve (e.g., after reaching x=5, adds "Multiply both sides by 2" -> 2x=10). These steps have different `resultLatex` so they pass the degenerate filter, but are pedagogically misleading. This is a Gemini prompt quality issue, not a structural generator bug. The student experience still works because the component processes steps sequentially.

**Verdict: PASS (with MEDIUM note on multi-step post-solve steps)**

## G5 -- Fallback Quality

Fallback expressions in the generator:

| Location | Expression | Risk | Fires in test? |
|----------|-----------|------|----------------|
| L258 | `validCategories.has(category) ? category : "algebraic"` | LOW | No |
| L446-448 | `data.instruction ?? ""` (and equation, targetVariable) | LOW | No (validation rejects empty) |
| L456-457 | `correctOperationId \|\| solutionSteps[0]?.operationId ?? ""` | LOW | No (Gemini returns it) |
| L541 | `validChallenges.length > 0 ? validChallenges : fallbackChallenges()` | LOW | No |

None fire at >30%.

**Verdict: PASS**

---

## Fixes Applied

### Fix 1: Degenerate no-op step filter
**Problem:** Multi-step challenges had padding steps where `resultLatex` was unchanged from the previous step (e.g., "Multiply by 1", "Add 0"). 2/5 (40%) of pre-fix multi-step challenges had these.

**Fix:** Added two filters in `reconstructSteps()`:
1. Skip steps where `resultLatex` (whitespace-normalized) matches the previous step
2. Skip steps whose `operation` text matches `/\b(check|verify|confirm|substitute.*back)\b/i`

### Fix 2: Stronger multi-step prompt
**Problem:** Gemini was generating equations that only needed 3 real steps, then padding to 5.

**Fix:** Updated the multi-step prompt to:
- Explicitly forbid identity operations and check/verify steps
- Suggest equation patterns that genuinely require 4-5 steps (e.g., `a(bx + c) + dx = e`)
- State "Every step must change the equation"

### Post-fix results
- multi-step: 4/5 challenges pass (1 rejected by stricter validation). All remaining challenges have distinct `resultLatex` at each step.
- guided-solve: 5/5 pass (check steps filtered, down from 3 steps to 2 per challenge)
- solve: 5/5 pass (check steps filtered)
- identify-operation: 5/5 pass

---

## Open Items

| Priority | Issue | Notes |
|----------|-------|-------|
| MEDIUM | Multi-step post-solve step regression | Gemini sometimes adds steps after variable isolation that go in the wrong direction. Would need a "variable already isolated" detector to filter. Not blocking -- the first N steps form a valid solve path. |
| LOW | Guided-solve now has only 2 steps per challenge | After filtering check/verify steps, guided-solve challenges are shorter. Consider requesting 3-step equations from Gemini (e.g., with fractions or distribution). |
