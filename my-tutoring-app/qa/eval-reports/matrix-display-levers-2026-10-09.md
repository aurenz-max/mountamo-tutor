# matrix-display — support levers, 2026-10-09

Built with the W1 binding (`qa/tutor-reports/matrix-display-w1-2026-10-09.md`). Not committed.

## Failure inventory
No real-learner evidence (no demonstrations, misconception, remediation or eval-report files for matrix-display). Documented = the catalog's `commonStruggles` (wrong determinant formula, multiplication order, inverse confusion, transpose dimensions); synthetic = the journey's scripted wrong answers; the rest inferred.

| Type | Failure (miss) | Class |
|---|---|---|
| transpose | entries in reading order, not swapped (`reshaped`) | documented ("transpose dimensions"), synthetic |
| add / subtract | the other operation (`wrong_operation`), B − A (`reversed_subtraction`) | inferred, synthetic |
| multiply | matching entries multiplied (`entrywise`), B·A (`reversed_order`), row times row (`row_times_row`) | documented ("multiplication order"), synthetic |
| multiply | one product dropped from each sum (`missed_term`) | inferred |
| determinant | products added (`added_products`), wrong way round (`opposite_sign`), one product only (`one_product`) | documented ("wrong determinant formula"), synthetic |
| inverse | swapped not negated (`no_negation`), negated not swapped (`no_swap`), not divided by −1 (`unscaled`), A typed back (`original`) | documented ("inverse confusion"), synthetic |
| any grid | sign flips (`sign_error`), one box (`one_entry`), several (`some_entries`); determinant near / too high / too low | inferred |

## Lever table (built, `matrixDisplayLevers.ts`)

| Type | Lever | Kind | Answers | Leak rule (code) |
|---|---|---|---|---|
| transpose | row_bands | help | every transpose miss | colour only, no number |
| add / subtract | position_tracking | help | every add/subtract miss | lights A and B at the clicked box; recipe "A₁₂ − B₁₂" in subscripts, no value |
| multiply | row_column_tracking | help | entrywise, reversed_order, row_times_row, one/some | lights the row and column, no number |
| multiply | term_list | help | missed_term, entrywise, row_times_row, sign_error, one/some | "A₂₁·B₁₁ + A₂₂·B₂₁", subscripts, no value |
| determinant 2×2 | diagonal_marks | help | every determinant miss | green / red tints, caption has no digit |
| determinant 3×3 | cofactor_signs | help | all but one_product (2×2 only) | + − + over the top row |
| inverse | swap_negate_letters | help | every inverse miss | letters a b c d and the pattern in letters |
| every type | model_example | help | every miss of the type | a worked example outside the item; no number whose size is an answer entry or the determinant; transpose's is lettered |
| every type | simpler_problem | simplify | the type's misses but sign_error | same operation, smaller or friendlier matrix (2×2, entries 0-5, det 1 inverse, counting-number transpose); own id, ask, values and key (`practiceLeaks`); none when the item is already that simple |

No lever text, `does`, or scene fact carries a digit (`leverTextLeaks`). The tracking levers follow the box the learner clicks; the scene fact names it in words. Starting positions are the existing tier's rule line and Show steps gating (`gemini-matrix.ts`); no new tier code, and a starting position is not a pull.

## Gates
- `typecheck:lumina` 0. Full `tsc` 770 (baseline 770).
- `matrixDisplayLevers.test.ts` 19/19 (leak rules per type over 60 seeded items per type across every band and tier shape, simplify builder, miss -> lever), `MatrixDisplay.levers.workspace.test.tsx` 4/4, `MatrixDisplay.workspace.test.tsx` 10/10.
- Sweep `matrix-display`: 4 payloads, 0 findings J1-J13; lever inventory: every catalog miss answered on every mode.
- Replay r3 (`replay/matrix-display-2026-10-09-r3.json`, 4 x 5): 0 misses, including `no_change_before_receipt`. On "stuck" the tutor pulls model_example, position_tracking, row_column_tracking, diagonal_marks or row_bands itself and describes it after the call; none names a result.

## Failures with no lever
None.

## Open
- Browser check on the tints, outlines and cards (JSDOM only).
- With position_tracking or row_column_tracking on, one box is one sum or one dot product; the learner still computes every box.
