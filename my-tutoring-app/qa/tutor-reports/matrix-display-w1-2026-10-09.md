# matrix-display — W1 workspace binding (plain shape), 2026-10-09

ROLLOUT C20. `withWorkspaceController`: the scripted path is kept (retry until correct, Show steps, Next, Skip). Not committed.

## Modes and what code checks
All four catalog modes are gesture items. The activity's own check (`matrixCorrect`, `matrixDisplayWorkspace.ts`) is the judge, so there is no `expectedAnswer` and no key in the scene facts. A box that is not a number is not a check (no commit); a typed − or – reads as a minus.

| Mode | Types | Learner input | Misses (`matrixMiss`) |
|---|---|---|---|
| transpose | transpose | every box of the n×m grid, Check | reshaped, sign_error, one_entry, some_entries |
| add_subtract | add, subtract | every box, Check | wrong_operation, reversed_subtraction, sign_error, one_entry, some_entries |
| multiply | multiply | every box of the 2×2 result, Check | entrywise, reversed_order, row_times_row, missed_term, sign_error, one_entry, some_entries |
| determinant_inverse | determinant, inverse | the determinant box, or every box of A⁻¹, Check | added_products, opposite_sign, one_product, near_miss, too_high, too_low; no_negation, no_swap, unscaled, original, sign_error, one_entry, some_entries |

The scene names the drawn matrices, the grid's shape, the rule line (or "none at this level"), the boxes a check marked wrong in words ("first row, second column"), and the learner's grid.

## Fixed on both paths
- **Show steps drew the answer.** The walkthrough rendered the whole transpose, sum, difference and inverse, and the 2×2 determinant's value. It now works one entry (the rest masked); the determinant stops at the substitution and the inverse at the determinant.
- **Grade band above the lesson's grade.** The model's `gradeBand` overrode the grade: the first Grade 10 payloads came back `advanced` (entries to ±12, products to 112). `gemini-matrix.ts` now clamps the band to `ctx.grade`; regenerated payloads are `algebra2`.
- **Workspace only:** Show steps, Skip and Next are hidden; input closes while a checked answer waits for Try again; Try again empties the boxes marked wrong and keeps the right ones. Answer boxes are labelled "Answer row i, column j" and the determinant box "Determinant answer".

## Gates
- `typecheck:lumina` 0. Full `tsc` 770 (baseline 770).
- `MatrixDisplay.workspace.test.tsx` 10/10; with misses, oracles, Pip surface, lessonWorkspacePlan, activityContract, sourceControlBytes and the lever tests: 9 files, 551 passed.
- `workspaceContract -t matrix-display` 17/17. Sweep `matrix-display`: 4 payloads, 16 items, 0 findings (J1-J13), 16/16 misses named; J10 clean 100, J11 recover 67.

## Tutor replay (4 payloads x 5 samples)
- r1 (`replay/matrix-display-2026-10-09.json`): 1/15 `no_key_before_try` on the determinant lever moment: the tutor read the red diagonal "5 and -1", and the determinant is -1, an entry on screen. False positive: `replayKeys` now drops a determinant equal to a drawn entry.
- r2: 1/20 `no_protocol_leak` on add_subtract stuck: the tutor wrote LaTeX (`$A_{ij} - B_{ij}$`). Guidance now says to say a formula in plain words.
- r3 (`-r3.json`): 0 misses on every check. Read by hand: after a miss the tutor pulls a picture lever and describes it; on "stuck" it names the box's entries and the operation ("what is negative nine minus negative one?", "multiply 5 by 5, multiply -2 by 6, and add"), never a result.

## Undriven modes
None.

## Open findings
1. Needs a browser check on the answer grid, the tints and the lever cards (JSDOM only).
2. determinant_inverse at algebra2+ is either all 2×2 or all 3×3 determinants in one session: the shape alternates on the item index (`idx % 2`) and the types interleave on the same index, so a determinant always lands on the same parity. `/eval-fix` on `gemini-matrix.ts` `resolveProblemShape`.
3. The stuck replies set up one box's arithmetic for the learner (the entries and the operation). That is the guidance's "name one box" made concrete; it never gives the result. Same pattern as ratio-table.
4. The scripted tutoring block stays (scripted fallback); it goes when that fallback is retired.
