# Contract: ratio-table

- **Derived:** 2026-10-09, PARTIAL: written by the W1 workspace binding (ROLLOUT C15) for the workspace and lever requirements only. A full `/primitive-contract ratio-table` derivation (consumers per ratio skill, grade bands) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/RatioTable.tsx` · **Workspace:** `ratioTableWorkspace.ts` · **Levers:** `ratioTableLevers.ts` · **Generator:** `service/math/gemini-ratio-table.ts` · **Oracle:** `service/qa/oracles/ratio-table.ts` · **Boss:** `ratioTable.card.ts` + `ratioTable.boss.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`ratio-table`)

## Requirements

### R1 — every mode binds the shared teaching workspace with no key reaching the tutor · OBSERVED (2026-10-09)
- **Property:** all four modes are gesture items checked by the activity's own check (`ratioCorrect`: a typed number within the item's tolerance, the slider within twice it). Each wrong check names a `RatioMiss` from the catalog list. Scene facts name both columns as drawn (the hidden cell as "?"), the aids, and the learner's work; never the hidden value, the asked multiplier or the asked unit rate. Try again empties the answer box or returns the slider to its start. The hint, the hint panel and Next are not shown on the workspace path.
- **Demanded by:** qa/workspace-rollout/ROLLOUT.md C15.
- **Evidence:** `RatioTable.workspace.test.tsx` 11; sweep J1-J13 on 4 payloads, 0 findings, 16/16 misses named; replay 4 x 5 (`qa/tutor-reports/ratio-table-w1-2026-10-09.md`).
- **Probe:** `RatioTable.workspace.test.tsx`; `journeySweep -t ratio-table`.

### R2 — nothing on screen or in the ask names the answer · OBSERVED (2026-10-09)
- **Property:** a build_ratio ask is built by code (`buildRatioAsk`) and names one scaled value to reach, never the multiplier (flash-lite named the factor on 4/4 items). A missing_value header shows ×? at every tier until the item is checked right (fork 10-16, below); the `times_arrows` lever writes the multiplier, and hides it when it equals the answer (hidden row base 1). The unit-rate banner is not drawn when its number is the answer.
- **Probe:** `RatioTable.workspace.test.tsx` (build ask, header, banner cases).

### R3 — every mode's levers change the picture, never the answer · OBSERVED (2026-10-09)
- **Property:** `ratioTableLevers.ts` declares levers on every mode and every catalog miss is answered by a help lever on every item. Help: bar_chart and unit_rate_banner (where the session hides them), times_arrows, division_frame (find), equal_groups (unit rate), model_ratio (every mode). Leak rules in code: no lever text or fact carries a digit; find's arrows and the boxes carry no number; the division frame, the banner and the model never write the answer. Simplify (`simpler_problem`, every mode) opens a same-mode problem on small whole numbers with its own `~simpler` id, ask, base and answer (`practiceLeaks`), ungraded; the full item comes back blank.
- **Evidence:** `ratioTableLevers.test.ts`, `RatioTable.levers.workspace.test.tsx`; sweep J9/J12/J13 0 findings (`qa/eval-reports/ratio-table-levers-2026-10-09.md`).

### R-IS — missing_value and unit_rate with a tier take their items from the ratio-missing-value space · OBSERVED (2026-10-14)
- With `config.difficulty`, a pinned missing_value or unit_rate mode, no manifest `challenges`, and an objective the resolver fits to `ratio-missing-value`, code picks 4 items (`tierPick`; `ratioTableItemSpace.ts`) and one flash-lite call writes the stories and row labels; `ratioStoryFits` rejects a story that misses a given number, adds a number other than 1, states the answer or does not ask, and the plain story replaces it. missing_value takes only items whose factor is exact to two decimals, so the lever's ×m is the true factor; unit_rate takes unit-rate items (whole, half, other decimals, below one). Each challenge carries `itemSpace` {space, structure, beta}, never rendered or sent to the tutor. R1 and R2 hold (keys from `ratioKey`). No tier keeps the own path.
- **Fork (2026-10-16, ruling 10-15, QUEUE 8.1e), missing_value only:** R2 changed from "the header shows the factor unless it is the answer" to "the header never shows the factor": the factor is the step 6.RP.3 asks of the learner. The ×m label moved into the `times_arrows` help lever. Tiers stay structural (whole factor, non-whole, unit rate below one); no tier shows the factor. Other modes unchanged. Probe: `RatioTable.workspace.test.tsx` (header ×? and scene ×?), Chrome drive easy + hard (header ×?, lever pulled once writes ×m).
- Probe: `service/itemSpace/ratioMissingValue.test.ts`, `service/math/ratioTableItemSpace.test.ts`, `scripts/difficulty-lab/tier-probe.mjs --component ratio-table`.

## Changelog

- 2026-10-09 — created with R1-R3 (W1 plain-shape binding and levers, C15).
- 2026-10-14 — R-IS added. Before: the LLM chose every ratio; easy got ×3.75 and ×4.5 while medium got ×7, and the no-tier path shipped decimal base ratios (1.5:45, 8.2:140). Compatible with R1-R2.
- 2026-10-20 — moved onto a boss (wave 3): card + bespoke `defineBoss` (typed modes and the build slider), levers as a lever set (bar chart layout, unit-rate banner clue shown, times arrows marks, division frame and equal groups layout, model, easier; the model lever's tier from the item's `supportTier`, which the generator now stamps), workspace-only export; the scripted path, hint button, adapter and catalog guidance/tutoring prose deleted. R1-R3 unchanged.
