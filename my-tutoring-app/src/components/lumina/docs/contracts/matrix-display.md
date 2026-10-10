# Contract: matrix-display

- **Derived:** 2026-10-09, PARTIAL: written by the W1 workspace binding (ROLLOUT C20) for the workspace and lever requirements only. A full `/primitive-contract matrix-display` derivation (consumers per matrix skill, grade bands) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/MatrixDisplay.tsx` · **Workspace:** `matrixDisplayWorkspace.ts` · **Levers:** `matrixDisplayLevers.ts` · **Generator:** `service/math/gemini-matrix.ts` · **Oracle:** `service/qa/oracles/matrix-display.ts` · **Adapter:** `components/live-activity/adapters/matrixDisplayLive.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`matrix-display`)

## Requirements

### R1 — every mode binds the shared teaching workspace with no key reaching the tutor · OBSERVED (2026-10-09)
- **Property:** all four modes are gesture items checked by the activity's own check (`matrixCorrect`: every box of the answer grid, or the determinant box). A box that is not a number is not a check. Each wrong check names a `MatrixMiss` from the catalog list. Scene facts name the drawn matrices, the answer grid's shape, the rule line (or its absence), the boxes a check marked wrong (in words), and the learner's work; never a result entry or the determinant. Try again empties the boxes marked wrong and keeps the right ones. Show steps, Skip and Next are not shown on the workspace path.
- **Demanded by:** qa/workspace-rollout/ROLLOUT.md C20.
- **Evidence:** `MatrixDisplay.workspace.test.tsx` 10; sweep J1-J13 on 4 payloads, 0 findings, 16/16 misses named; replay 4 x 5 (`qa/tutor-reports/matrix-display-w1-2026-10-09.md`).
- **Probe:** `MatrixDisplay.workspace.test.tsx`; `journeySweep -t matrix-display`.

### R2 — the walkthrough works one entry, never the whole answer · OBSERVED (2026-10-09)
- **Property:** "Show steps" (scripted path) shows the rule and one worked entry with the rest of the result masked; a determinant's walkthrough stops at the substitution, an inverse's at the determinant. It previously drew the full transpose, sum, difference and inverse, and the determinant's value.
- **Probe:** read `StepsReveal` in `MatrixDisplay.tsx`.

### R3 — every mode's levers change the picture, never the answer · OBSERVED (2026-10-09)
- **Property:** `matrixDisplayLevers.ts` declares levers on every mode and every catalog miss of an item's type is answered by a help lever on every item. Help: row_bands (transpose), position_tracking (add/subtract), row_column_tracking and term_list (multiply), diagonal_marks (2×2 determinant), cofactor_signs (3×3 determinant), swap_negate_letters (inverse), model_example (every type). Leak rules in code: no lever text or fact carries a digit; the bands, tracking, marks, signs, letters and recipes write no value; the model shows no number whose size equals an answer entry or the determinant (transpose's model is lettered). Simplify (`simpler_problem`) opens a same-operation practice item on a smaller or friendlier matrix with its own `~simpler` id, ask, values and key (`practiceLeaks`), ungraded; the full item comes back blank.
- **Evidence:** `matrixDisplayLevers.test.ts` 19, `MatrixDisplay.levers.workspace.test.tsx` 4; sweep J9/J12/J13 0 findings (`qa/eval-reports/matrix-display-levers-2026-10-09.md`).

### R4 — the lesson's grade caps the number band · OBSERVED (2026-10-09)
- **Property:** the model's `gradeBand` is clamped to the objective's grade (`ctx.grade`): grade 8 and below `7-8`, 9-10 `algebra2`, 11-12 `precalculus`. A Grade 10 payload came back `advanced` (entries to ±12, products past 100) before the clamp.
- **Probe:** `save_payload.py --primitive matrix-display --grade "Grade 10"` reads `gradeBand: algebra2`.

## Changelog

- 2026-10-09 — created with R1-R4 (W1 plain-shape binding, levers, walkthrough and grade fixes, C20).
