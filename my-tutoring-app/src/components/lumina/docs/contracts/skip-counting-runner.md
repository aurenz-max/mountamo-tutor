# Contract: skip-counting-runner

- **Derived:** 2026-10-09, PARTIAL: written by the W1 workspace binding (ROLLOUT C12) for the workspace and lever requirements only. A full `/primitive-contract skip-counting-runner` derivation (consumers per skip-counting / multiplication-foundation skill, grade bands) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/SkipCountingRunner.tsx` · **Workspace:** `skipCountingWorkspace.ts` · **Levers:** `skipCountingLevers.ts` · **Generator:** `service/math/gemini-skip-counting-runner.ts` · **Oracle:** `service/qa/oracles/skip-counting-runner.ts` · **Adapter:** `components/live-activity/adapters/skipCountingRunnerLive.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`skip-counting-runner`)

## Requirements

### R1 — every mode binds the shared teaching workspace with no key reaching the tutor · OBSERVED (2026-10-09)
- **Property:** all five modes are gesture items checked by the runner's own check (`skipMatches`); each wrong check names a `SkipCountingMiss` from the catalog list. count_along: the learner taps each next landing then Check; a tap past it is a checked miss. predict, find_skip_value, connect_multiplication: a typed number and Check. fill_missing: one gap at a time; a fitting fill with gaps left is progress, not a check; the item is credited on its last gap. Scene facts name the line, where the character stands, the landings made, the gap count and which aids are drawn; never the next landing, a gap, the jump size on find, or the jump count on connect. Nothing moves on its own on the workspace path (easy auto-play becomes tapping). Try again keeps the landings made and the gaps filled and clears what was typed. The generated hint is not shown on the workspace.
- **Demanded by:** qa/workspace-rollout/ROLLOUT.md C12.
- **Evidence:** `SkipCountingRunner.workspace.test.tsx` 12; sweep J1-J13 on 5 payloads, 0 findings, 28/28 misses named; replay 5 x 5 (`qa/tutor-reports/skip-counting-runner-w1-2026-10-09.md`).
- **Probe:** `SkipCountingRunner.workspace.test.tsx`; `journeySweep -t skip-counting-runner`.

### R2 — nothing on screen names the mode's answer · OBSERVED (2026-10-09)
- **Property:** predict writes no number ahead of the character; find_skip_value never shows "Count by N", "+N" on the Jump button, the n × N line, the array caption or the ones-digit row (before 2026-10-09 the easy tier showed all of them); connect_multiplication asks for the number of jumps ("? × N = landing", the landing is in the instruction by the generator's rule) and shows the equation and array caption only after credit; fill_missing has no Jump button (a jump landed on a gap and printed it). The generator code-builds count_along, fill_missing and connect_multiplication instructions and the fill, connect and find hints, and strips the jump size from a find_skip_value title, description or instruction.
- **Changed semantics:** connect_multiplication's answer moved from the product to the number of jumps; fill_missing needs every gap (before, any one gap completed it, so hard's three gaps were one). The scripted path now submits when the last challenge is right (before, its submit sat behind a Next button that never showed on the last challenge).
- **Probe:** `SkipCountingRunner.workspace.test.tsx` ("nothing on screen names the answer"); oracle `skip-counting-runner.test.ts`.

### R3 — every mode's levers change the picture, never the answer · OBSERVED (2026-10-09)
- **Property:** `skipCountingLevers.ts` declares levers on every mode and every catalog miss is answered on every saved payload item. Help: tick_numbers, count_trail (count_along); jump_sizes, count_trail (predict); step_arcs, ring_gaps (fill_missing); hop_dots, model_count (find_skip_value); jump_marks, array_rows (connect_multiplication). Leak rules in code: dots only strictly inside the first three jumps, bare; the model's step and numbers never the jump size; no arc or number past the character; arcs and rows never numbered or counted. Simplify (`simpler_count`) stays in the mode on a plainer or shorter count with its own line and `~simpler` id, never the item's answer, a gap of the item or a later item's answer (`practiceLeaks`), ungraded; the full item comes back blank. Starting positions come from the existing tier (`showOptions`, `supportTier`); they are not pulls.
- **Evidence:** `skipCountingLevers.test.ts`, `SkipCountingRunner.levers.workspace.test.tsx`; sweep J9/J12/J13 0 findings (`qa/eval-reports/skip-counting-runner-levers-2026-10-09.md`).

## Changelog

- 2026-10-09 — created with R1-R3 (W1 plain-shape binding and levers, C12).
