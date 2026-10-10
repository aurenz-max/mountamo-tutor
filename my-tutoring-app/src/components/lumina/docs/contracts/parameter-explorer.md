# Contract: parameter-explorer

- **Derived:** 2026-10-09, PARTIAL: written by the W1 workspace binding (ROLLOUT C20) for the workspace and lever requirements only. A full `/primitive-contract parameter-explorer` derivation (consumers per skill, grade bands) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/ParameterExplorer.tsx` · **Workspace:** `parameterExplorerWorkspace.ts` · **Levers:** `parameterExplorerLevers.ts` · **Generator:** `service/math/gemini-parameter-explorer.ts` · **Adapter:** `components/live-activity/adapters/parameterExplorerLive.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`parameter-explorer`)

## Requirements

### R1 — every mode binds the shared teaching workspace with no key reaching the tutor · OBSERVED (2026-10-09)
- **Property:** all four modes are gesture items checked by the activity's own code (`parameterCheck`), every item stated from the parameters' starting values: explore credits a slider moved since the item opened; predict-direction checks Increase / Decrease / Stay Same against the formula at `prediction.newValue`; predict-value checks the typed output against the formula at that setting, within a tolerance kept between 0.5% and 5%; identify-relationship checks the parameter whose doubling (the others held) moves the output furthest, by at least 1.25× the next. Each wrong check names a `ParameterExplorerMiss` from the catalog list (explore names none). Scene facts name the formula in plain symbols, the sliders, whether the output is shown, the learner's work; never the direction, the asked value or the leading parameter. Try again clears the answer. Next is not shown on the workspace path, and a miss there shows no explanation and no result line.
- **Demanded by:** qa/workspace-rollout/ROLLOUT.md C20.
- **Evidence:** `ParameterExplorer.workspace.test.tsx` 10; sweep J1-J13 on 4 payloads, 0 findings, 8/8 misses named (`qa/tutor-reports/parameter-explorer-w1-2026-10-09.md`).
- **Probe:** `ParameterExplorer.workspace.test.tsx`; `journeySweep -t parameter-explorer`.

### R2 — the keys and the asks come from the formula, both paths · OBSERVED (2026-10-09)
- **Property:** the generator's direction word, value and leading parameter are not keys. `settleChallenge` moves a direction item to a setting on the slider that gives the generator's word (or drops it), recomputes the value, keys identify by doubling and drops an item with no clear leader, and the generator keeps one identify item per lesson (one formula has one leader). The predict and identify asks are built from the data (`promptFor`), so the text and the key cannot disagree. In the predict modes the output readout is hidden until the item is over at every tier (it is the answer); observation cards show on explore only (they narrate relationships).
- **Probe:** `ParameterExplorer.workspace.test.tsx` ("the keys come from the formula"); `scripts/parameter-explorer-probe.mjs <modes>` (real generation).

### R3 — every checked mode's levers change the picture, never the answer · OBSERVED (2026-10-09)
- **Property:** help: find_parameter, model_pair (predict-direction); substitution (refused when it would print the answer), scaling_model (predict-value); double_marks (identify, only where the readout is shown), doubling_model (identify). Simplify: `simpler_problem` on predict-direction (a parameter that only multiplies, doubled or halved, when the item's does not) and predict-value (one parameter doubled or halved from its start, never the item's setting, answer more than 5% away), with its own `~simpler` id, ungraded. No lever text names a direction; the models use letters and numbers the item does not. explore has no miss and no lever; identify has no simplify.
- **Evidence:** `parameterExplorerLevers.test.ts`, `ParameterExplorer.levers.workspace.test.tsx`; sweep J9/J12/J13 0 findings (`qa/eval-reports/parameter-explorer-levers-2026-10-09.md`).

## Changelog

- 2026-10-09 — created with R1-R3 (W1 plain-shape binding and levers, C20).
