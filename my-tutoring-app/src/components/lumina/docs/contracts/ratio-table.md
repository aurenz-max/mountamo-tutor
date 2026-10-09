# Contract: ratio-table

- **Derived:** 2026-10-09, PARTIAL: written by the W1 workspace binding (ROLLOUT C15) for the workspace and lever requirements only. A full `/primitive-contract ratio-table` derivation (consumers per ratio skill, grade bands) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/RatioTable.tsx` · **Workspace:** `ratioTableWorkspace.ts` · **Levers:** `ratioTableLevers.ts` · **Generator:** `service/math/gemini-ratio-table.ts` · **Oracle:** `service/qa/oracles/ratio-table.ts` · **Adapter:** `components/live-activity/adapters/ratioTableLive.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`ratio-table`)

## Requirements

### R1 — every mode binds the shared teaching workspace with no key reaching the tutor · OBSERVED (2026-10-09)
- **Property:** all four modes are gesture items checked by the activity's own check (`ratioCorrect`: a typed number within the item's tolerance, the slider within twice it). Each wrong check names a `RatioMiss` from the catalog list. Scene facts name both columns as drawn (the hidden cell as "?"), the aids, and the learner's work; never the hidden value, the asked multiplier or the asked unit rate. Try again empties the answer box or returns the slider to its start. The hint, the hint panel and Next are not shown on the workspace path.
- **Demanded by:** qa/workspace-rollout/ROLLOUT.md C15.
- **Evidence:** `RatioTable.workspace.test.tsx` 11; sweep J1-J13 on 4 payloads, 0 findings, 16/16 misses named; replay 4 x 5 (`qa/tutor-reports/ratio-table-w1-2026-10-09.md`).
- **Probe:** `RatioTable.workspace.test.tsx`; `journeySweep -t ratio-table`.

### R2 — nothing on screen or in the ask names the answer · OBSERVED (2026-10-09)
- **Property:** a build_ratio ask is built by code (`buildRatioAsk`) and names one scaled value to reach, never the multiplier (flash-lite named the factor on 4/4 items). A missing_value header hides its multiplier when it equals the answer (hidden row base 1). The unit-rate banner is not drawn when its number is the answer.
- **Probe:** `RatioTable.workspace.test.tsx` (build ask, header, banner cases).

### R3 — every mode's levers change the picture, never the answer · OBSERVED (2026-10-09)
- **Property:** `ratioTableLevers.ts` declares levers on every mode and every catalog miss is answered by a help lever on every item. Help: bar_chart and unit_rate_banner (where the session hides them), times_arrows, division_frame (find), equal_groups (unit rate), model_ratio (every mode). Leak rules in code: no lever text or fact carries a digit; find's arrows and the boxes carry no number; the division frame, the banner and the model never write the answer. Simplify (`simpler_problem`, every mode) opens a same-mode problem on small whole numbers with its own `~simpler` id, ask, base and answer (`practiceLeaks`), ungraded; the full item comes back blank.
- **Evidence:** `ratioTableLevers.test.ts`, `RatioTable.levers.workspace.test.tsx`; sweep J9/J12/J13 0 findings (`qa/eval-reports/ratio-table-levers-2026-10-09.md`).

## Changelog

- 2026-10-09 — created with R1-R3 (W1 plain-shape binding and levers, C15).
