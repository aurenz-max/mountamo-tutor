# Contract: two-way-table

- **Derived:** 2026-10-09, PARTIAL: written by the W1 workspace binding (ROLLOUT C19) for the workspace and lever requirements only. A full `/primitive-contract two-way-table` derivation (consumers per probability skill, grade bands) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/TwoWayTable.tsx` · **Workspace:** `twoWayTableWorkspace.ts` · **Levers:** `twoWayTableLevers.ts` · **Generator:** `service/math/gemini-two-way-table.ts` · **Oracle:** `service/qa/oracles/two-way-table.ts` · **Adapter:** `components/live-activity/adapters/twoWayTableLive.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`two-way-table`)

## Requirements

### R1 — every mode binds the shared teaching workspace with no key reaching the tutor · OBSERVED (2026-10-09)
- **Property:** all four modes are gesture items checked by the activity's own check (`twoWayCorrect`: the typed probability within the item's tolerance, 0.02; a percent with % or a number above 1 is read as a percent). Each wrong check names a `TwoWayMiss` from the catalog list. Scene facts name the cells and only the totals the table draws; never the probability, the division that gives it, or a hidden total. Try again empties the answer box. The hint, Show hint, Next and Skip are not shown on the workspace path; the placeholder is `0.00`, never a possible answer.
- **Demanded by:** qa/workspace-rollout/ROLLOUT.md C19.
- **Evidence:** `TwoWayTable.workspace.test.tsx` 11; sweep J1-J13 on 4 payloads, 0 findings, 16/16 misses named; replay 4 x 5, 0 misses (`qa/tutor-reports/two-way-table-w1-2026-10-09.md`).
- **Probe:** `TwoWayTable.workspace.test.tsx`; `journeySweep -t two-way-table`.

### R2 — the item states which cell, row or column it asks about · OBSERVED (2026-10-09)
- **Property:** the generator stamps `target` (`{ row, col, given }`) on every challenge; `locateTarget` falls back to the question's category names and the key for an older payload. The adapter refuses an item whose key is not the probability of a located target.
- **Probe:** `TwoWayTable.workspace.test.tsx` (adapter, older payload).

### R3 — every mode's levers change the picture, never the answer · OBSERVED (2026-10-09)
- **Property:** `twoWayTableLevers.ts` declares levers on every mode, and every miss the check can name on an item is answered by a lever on that item. Help: outline_question, sum_frame (only where a needed total is hidden), out_of_frame, model_table. Leak rules in code: no lever text or fact carries a digit; the out-of frame carries no digit outside the category names; the sum frame never writes a sum; the model's answer is outside the item's tolerance. Simplify (`simpler_table`, every mode) opens the same kind of question on a 2 x 2 table of ten with the item's first category names and its own `~simpler` id, ask, counts and answer (`practiceLeaks`), ungraded; the full item comes back blank.
- **Evidence:** `twoWayTableLevers.test.ts` 17, `TwoWayTable.levers.workspace.test.tsx` 3; sweep J9/J12/J13 0 findings (`qa/eval-reports/two-way-table-levers-2026-10-09.md`).

## Changelog

- 2026-10-09 — created with R1-R3 (W1 plain-shape binding and levers, C19).
