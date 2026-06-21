# matrix-display — Structural-Difficulty Sweep (2026-06-20)

Step-2c support-tier difficulty sweep. Live eval-test against dev server. Topic `matrix operations`, gradeLevel `Algebra 2` (→ gradeBand `algebra2`, so the determinant 3×3 lever is in-grade). 3 calls/mode (baseline, easy, hard). 4 instances/mode.

## Results

| Eval mode | Lever (code-enforced) | easy → hard observed | Scaffold flip | Magnitude | Verdict |
|---|---|---|---|---|---|
| `transpose` | shape / entry count | 2×3 (6 entries) → 3×4 & 4×3 (12 entries) | hint formula→none, steps always→afterAttempt | in band [1,9] both tiers | PASS |
| `multiply` | dot-product depth k | k=2 (2×2·2×2) → k=3 (2×3·3×2), result pinned 2×2 | hint formula→none, steps always→afterAttempt | factor entries in [-6,6] both tiers | PASS |
| `determinant_inverse` | determinant order (inverse pinned) | det 2×2 → det 3×3; inverse leg 2×2 both tiers | hint formula→none, steps always→afterAttempt | entries in [-9,9] both tiers | PASS |

## Evidence

- **transpose**: baseline alternated 2×3/3×2 (no-tier default). easy = all four 2×3. hard = 3×4/4×3 alternation (12 entries). Values single-digit at every tier (e.g. easy `[[1,4,1],[6,2,6]]`, hard `[[9,5,4,1],[9,3,4,4],[6,7,3,5]]`). Hint withdrawn (`''`) and `stepsAfterAttempt=true` at hard; full formula hint + ungated steps at easy/baseline.
- **multiply**: baseline alternated k=2/k=3. easy = all k=2 (A,B both 2×2). hard = all k=3 (A 2×3 · B 3×2). Result dimension pinned 2×2 at every tier (e.g. easy res `[[-12,24],[32,-36]]`, hard res `[[219,-109],[10,12]]`). Result-cell sums grow with the depth lever, but the FACTOR entries stay in the tightened [-6,6] band — that is the depth lever working as the brief specifies (result magnitude band held by the fixed 2×2 result + tightened factor range), not numeric inflation of operands.
- **determinant_inverse** (bundled): baseline `[inverse 2×2, determinant 3×3, …]`. easy = determinant legs all 2×2 (`ad−bc`), inverse legs 2×2. hard = determinant legs all 3×3 (Sarrus), inverse legs still 2×2. The inverse leg correctly carries NO structural lever (hard floor: det=±1 keeps A⁻¹ integer-valued) — only its scaffolding varies. Determinant scalar magnitudes consistent with grade band (e.g. -83, 21).

## Assertions

1. **Scaffold withdrawal** — confirmed flips per `resolveSupportStructure`: `hintLevel` formula→none and `stepsGating` always→afterAttempt across easy→hard in all three modes (hint string empty, `stepsAfterAttempt=true` at hard).
2. **Structural lever moves** — code-enforced, asserted exactly: transpose entry-count 6→12, multiply depth k 2→3 (result 2×2 fixed), determinant order 2→3. Inverse leg = n/a (saturated by design floor).
3. **Magnitude invariance** — operand entries stay in `rangeForGrade`/multiply-tightened band at every tier; no inflation past the ceiling, no scope crossing.
4. **No answer leak** — hint emptied at hard (no formula crib); instruction never names the answer; `expectedMatrix`/`expectedScalar` are grading data, not displayed. Easy formula hint genuinely helps.
5. **Null-tier no-op** — baseline reproduced the pre-tier alternating shapes (transpose 2×3/3×2, multiply k=2/3, determinant 2×2/3×3); not already-hard.

No CRITICAL or HIGH issues.
