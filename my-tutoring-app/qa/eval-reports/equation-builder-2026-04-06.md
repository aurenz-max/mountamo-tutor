# Eval Report: equation-builder — 2026-04-06

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| build-simple | PASS | 0 |
| missing-result | PASS | 0 |
| true-false | PASS | 0 |
| missing-operand | PASS | 0 |
| balance-both-sides | PASS | 0 |
| rewrite | PASS | 0 |

## Resolved Issues

### EB-1 (was CRITICAL): Answer leaked in instruction text

**Fixed:** PROMPT-CHANGE + POST-PROCESS-VALIDATE in generator.

1. Updated `build` prompt doc to instruct Gemini to describe the goal conceptually ("Build an addition equation that equals 5") without revealing the target equation.
2. Updated `instruction` schema description to reinforce no-leak rule.
3. Added post-process in `validateBuild`: if instruction contains the literal `targetEquation`, replace with a generic hint using only the result value.
4. Added same post-process leak check in `validateRewrite` for accepted forms.
5. Fixed hardcoded fallback to not leak the equation.

### EB-2 (was HIGH): Duplicate tiles in availableTiles pool

**Fixed:** POST-PROCESS-DERIVE in generator.

Rewrote tile reconstruction in `validateBuild` to derive tiles deterministically:
1. Start with exactly the target equation tokens (preserving legitimate duplicates like two `5`s for `5 + 5 = 10`).
2. Add Gemini's extra tiles as distractors only if not already present (deduplicated via Set).
3. Fill to minimum 2 distractors if needed (existing logic, now also using Set for dedup).

## Prior Automated Analysis (still valid)

The automated eval-test run passed all 6 catalog eval modes (build-simple, missing-result, true-false, missing-operand, balance-both-sides, rewrite) on G1–G5 checks. Visual testing issues EB-1 and EB-2 are now resolved.
