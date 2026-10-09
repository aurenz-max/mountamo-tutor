# Contract: circle-explorer

- **Derived:** 2026-10-09, PARTIAL: written by the W1 workspace binding (ROLLOUT C18) for the workspace and lever requirements only. A full `/primitive-contract circle-explorer` derivation (consumers per 7.G.B.4 skill) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/CircleExplorer.tsx` · **Workspace:** `circleExplorerWorkspace.ts` · **Levers:** `circleExplorerLevers.ts` · **Generator:** `service/math/gemini-circle-explorer.ts` · **Oracle:** `service/qa/oracles/circle-explorer.ts` · **Adapter:** `components/live-activity/adapters/circleExplorerLive.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`circle-explorer`)

## Requirements

### R1 — every mode binds the shared teaching workspace with no key reaching the tutor · OBSERVED (2026-10-09)
- **Property:** all five modes are gesture items: a typed number checked by the activity's own check (`circleCorrect`, within the item's tolerance); discover π first needs the circumference unrolled. Each wrong check names a `CircleMiss` from the catalog list. Scene facts state what the canvas prints (`figureLabels`), the answer box and its unit, whether formula labels are withheld, and the learner's work; never the answer. Try again empties the answer box and keeps what was unrolled or sliced. The hint, the hint button and Next are not shown on the workspace path; the scripted path is unchanged.
- **Demanded by:** qa/workspace-rollout/ROLLOUT.md C18.
- **Evidence:** `CircleExplorer.workspace.test.tsx` 10; sweep J1-J13 on 5 payloads, 0 findings, 20/20 misses named; replay 5 x 5 (`qa/tutor-reports/circle-explorer-w1-2026-10-09.md`).
- **Probe:** `CircleExplorer.workspace.test.tsx`; `journeySweep -t circle-explorer`.

### R2 — nothing on screen names the answer · OBSERVED (2026-10-09)
- **Property:** discover π never prints "≈ 3.14 d" after the unroll, and its unroll feedback never states the ratio (both did before 10-09: the required action printed the item's answer). An area item with a given diameter draws the diameter across, not a radius-length line labelled d. Reverse never labels the radius.
- **Probe:** `CircleExplorer.workspace.test.tsx` (screen text after the unroll).

### R3 — every mode's levers change the picture, never the answer · OBSERVED (2026-10-09)
- **Property:** `circleExplorerLevers.ts` declares levers on every mode, and every catalog miss is answered by a help lever on every item. Help: formula_labels (only where the hard tier withheld them), ratio_frame and tenth_marks (discover π), other_length (circumference, area with a given diameter, reverse), diameters_around (circumference), radius_square (area), undo_chain (reverse), whole_circle / trace_edges / shade_corners (composite, per figure). Leak rules in code: no lever text or fact carries a digit; no lever picture carries the item's answer (`pictureLeaks`). Simplify (`simpler_problem`, every mode but discover π) opens a same-mode, same-figure problem one step shorter where the mode has a step to drop, on a round radius, with its own `~simpler` id and answer (`practiceLeaks`), ungraded; the full item comes back blank. Discover π has no simplify: π is every circle's answer.
- **Evidence:** `circleExplorerLevers.test.ts` 25, `CircleExplorer.levers.workspace.test.tsx` 4; sweep J9/J12/J13 0 findings (`qa/eval-reports/circle-explorer-levers-2026-10-09.md`).

## Changelog

- 2026-10-09 — created with R1-R3 (W1 plain-shape binding and levers, C18).
