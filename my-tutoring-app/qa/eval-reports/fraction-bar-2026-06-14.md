# fraction-bar — Support-Tier Difficulty Sweep (eval-test Step 2c)

**Date:** 2026-06-14  **Topic:** "Fractions of a whole"  **Grade:** grade 3
**Harness:** `GET /api/lumina/eval-test?componentId=fraction-bar&evalMode=…&difficulty=…`
**Result: PASS — no CRITICAL, no HIGH.**

## Sweep matrix (9 runs, all HTTP 200 / status=pass, real generation)

| run | mode | tier | challenges | supportTier | showDecimal | partitionNumerals | shadedReadout | promptGloss |
|---|---|---|---|---|---|---|---|---|
| 1 | identify | easy | 7 | easy | T | T | T | T |
| 2 | identify | hard | 7 | hard | F | F | F | F |
| 3 | build | easy | 3 | easy | T | T | T | T |
| 4 | build | hard | 3 | hard | F | F | F | F |
| 5 | compare | easy | 3 | easy | T | T | T | T |
| 6 | compare | hard | 3 | hard | F | F | F | F |
| 7 | add_subtract | easy | 3 | easy | T | T | T | T |
| 8 | add_subtract | hard | 3 | hard | F | F | F | F |
| 9 | build | (none) | 3 | undefined | F* | T | T | T |

\* baseline showDecimal=false comes from the grade-3 wrapper default (K–3 → false), not a tier — fields default shown.

## Assertions

**1. Scaffold flips — PASS.** Every mode: easy shows all four (decimal/partitionNumerals/shadedReadout/promptGloss = true), hard withdraws all four (false). No mode left identical.

**2. Structural distractor lever moves — PASS.** identify only (the wired lever).
- easy = 'wide': numerator-choice max deviations `[7,2,2,5,3,7,2]` — includes the num/denom swap distractor (e.g. `1/8` → numChoices `[0,8,1,2]`, the `8` is the swap; spread up to 7).
- hard = 'tight': max deviations uniformly `[2,2,2,2,2,2,2]` — only ±1/±2 neighbors, no swap, no wide filler. Lever fires.

**3. Magnitude invariance — PASS.** Denominators stay in the per-mode window at BOTH tiers; hard never shifts:
identify {2,3,4,6,8} ✓ · build 3–6 ✓ · compare 4–12 ✓ · add_subtract 3–10 ✓. No out-of-scope denominator at any tier.

**4. No answer leak — PASS.** Top `{numerator}/{denominator}` is the prompt (always shown — fine). Correct numerator AND denominator present in their choice arrays for every challenge across all 9 runs; all choice arrays are 4 distinct values (no dup/short). Withdrawn partitionNumerals/shadedReadout are position labels + self-check readout, not the answer — bar+shade interaction intact (component gates only the readout `div` and the per-cell `{i+1}` span; the clickable partitions render unconditionally).

**5. Null-tier no-op — PASS.** Baseline (run 9): `supportTier` absent, new fields default true, distractors default 'wide' (byte-identical no-tier path per `buildChoices` default). showDecimal=false is the pre-existing grade default, not a tier effect.

## Verdict
Support tiers on fraction-bar are correctly wired end-to-end: scaffolds withdraw monotonically easy→hard, the identify MC distractor lever is the genuine structural difficulty axis (wide/swap → tight), denominators are scope-locked and tier-invariant, no answer leak, and the no-tier path is a clean no-op. Nothing to fix.
