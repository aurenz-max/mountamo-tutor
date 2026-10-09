# Contract: percent-bar

- **Derived:** 2026-10-09, PARTIAL: written by the W1 workspace binding (ROLLOUT C15) for the workspace and lever requirements only. A full `/primitive-contract percent-bar` derivation (consumers per percent skill, grade bands) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/PercentBar.tsx` · **Workspace:** `percentBarWorkspace.ts` · **Levers:** `percentBarLevers.ts` · **Generator:** `service/math/gemini-percent-bar.ts` · **Oracle:** `service/qa/oracles/percent-bar.ts` · **Adapter:** `components/live-activity/adapters/percentBarLive.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`percent-bar`)

## Requirements

### R1 — every mode binds the shared teaching workspace with no key reaching the tutor · OBSERVED (2026-10-09)
- **Property:** all four modes are gesture items checked by the activity's own step check (`stepCorrect`, ±2 points; the right option on a compare step). A right step that is not the last opens the next step and is not a commit; a wrong step and the last right step are. Each wrong step names a `PercentBarMiss` from the catalog list. Scene facts name the scenario, the step, the whole, the bar's range, which aids are drawn (guide lines counted, never named), what earlier steps found, and where the bar is; never a step's percent or which option is right. Try again keeps the steps already right and empties the current step. The generated hint and Next are not shown on the workspace path.
- **Demanded by:** qa/workspace-rollout/ROLLOUT.md C15.
- **Evidence:** `PercentBar.workspace.test.tsx` 9; sweep J1-J13 on 4 payloads, 0 findings, 16/16 misses named; replay 4 x 5 (`qa/tutor-reports/percent-bar-w1-2026-10-09.md`).
- **Probe:** `PercentBar.workspace.test.tsx`; `journeySweep -t percent-bar`.

### R2 — nothing on screen names a step's answer, and every item can be answered · OBSERVED (2026-10-09)
- **Property:** the bar starts empty on both paths (it started at 50%, which was the answer whenever a step's percent was 50). identify_percent's question states the percent to place (since 1c3e774d it said "the stated percent" and stated none, so the mode could not be answered before the hint).
- **Probe:** `PercentBar.workspace.test.tsx` (the slider reads 0 on mount); oracle `percent-bar.test.ts`.

### R3 — every mode's levers change the picture, never the answer · OBSERVED (2026-10-09)
- **Property:** `percentBarLevers.ts` declares levers on every mode and every catalog miss is answered by a help lever on every item. Help: value_bar (where the session does not draw it), tenths, fill_names (every mode); discount_model (find_part, convert); added_model (find_whole); compare_model (convert). Leak rules in code: no lever text, caption or fact carries a digit; the tenth marks are unlabelled; the bar levers are refused on a compare step. Simplify (`simpler_problem`, identify / find_part / find_whole) opens a same-mode problem on a friendlier percent with its own `~simpler` id and scenario and no step percent within tolerance of the item's (`practiceLeaks`), ungraded; the full item comes back blank. convert has no simplify. Starting positions are the existing tier's aids (labels, guide lines, value bar, calculation panel); they are not pulls.
- **Evidence:** `percentBarLevers.test.ts`, `PercentBar.levers.workspace.test.tsx`; sweep J9/J12/J13 0 findings (`qa/eval-reports/percent-bar-levers-2026-10-09.md`).

## Changelog

- 2026-10-09 — created with R1-R3 (W1 plain-shape binding and levers, C15).
