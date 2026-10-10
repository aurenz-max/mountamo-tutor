# Contract: systems-equations-visualizer

- **Derived:** 2026-10-09, PARTIAL: written by the W1 workspace binding (ROLLOUT C20) for the workspace and lever requirements only. A full `/primitive-contract systems-equations-visualizer` derivation (consumers per skill, grade bands) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/SystemsEquationsVisualizer.tsx` · **Workspace:** `systemsEquationsWorkspace.ts` · **Levers:** `systemsEquationsLevers.ts` · **Generator:** `service/math/gemini-systems-equations.ts` · **Oracle:** `service/qa/oracles/systems-equations-visualizer.ts` · **Adapter:** `components/live-activity/adapters/systemsEquationsLive.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`systems-equations-visualizer`)

## Requirements

### R1 — every mode binds the shared teaching workspace with no key reaching the tutor · OBSERVED (2026-10-09)
- **Property:** graph, substitution and elimination are gesture items: the learner types x and y and presses Check, and `solutionCorrect` (within 0.01 of `expectedX`/`expectedY`) judges. The adapter refuses an item whose two lines are parallel or do not both pass through the key. Each wrong check names a `SystemsMiss` from the catalog list. Scene facts give the two equations as printed and the grid's aids, never the pair or a step's result. On the workspace path the boxes and Check are closed while a checked answer waits for Try again; Next System and the hint are not shown; nothing auto-advances; the scripted path keeps its Next and hint.
- **Demanded by:** qa/workspace-rollout/ROLLOUT.md C20.
- **Evidence:** `SystemsEquationsVisualizer.workspace.test.tsx` 7; sweep J1-J13 on 3 payloads, 0 findings, 12/12 misses named (`qa/tutor-reports/systems-equations-visualizer-w1-2026-10-09.md`).
- **Probe:** `SystemsEquationsVisualizer.workspace.test.tsx`; `journeySweep -t systems-equations`.

### R2 — nothing on screen gives the solution before it is checked · OBSERVED (2026-10-09)
- **Property:** substitution and elimination keep the lines hidden until the item is solved (the "Peek at the graph" button, which drew both lines and let the learner read the crossing, is gone on both paths). The on-demand hint states the method, never the pair (the oracle's answer-leak check now covers `hint`). Slope-form systems never have their solution on the y-axis (both equations would end in the answer's y).
- **Probe:** `oracles.test.ts` (systems-equations-visualizer); the workspace test's packet and screen checks.

### R3 — every mode's levers change the screen, never the answer · OBSERVED (2026-10-09)
- **Property:** `systemsEquationsLevers.ts` declares levers on every mode; every miss the check names is answered by a lever on every item. Help: axis_guide, every_line (hard tier only) on graph; set_equal on substitution; line_up on elimination; check_both, method_steps (where the tier did not open the steps), worked_example on all. Leak rules in code: no `when`/`does` digit; a worked example shares neither coordinate with the key, never prints its pair and is never the item's system; check_both prints only the learner's own checked pair and works/does not work; set_equal and line_up state no solved value. check_both is refused until the item has a checked pair. Simplify (`simpler_item`) opens a system of slopes one and minus one, or x + y and x - y, with a small solution that is neither the key nor the key swapped, own `~simpler` id, ungraded; the full item comes back blank. Starting positions are the existing tier flags (steps open at easy, axis numbers withheld at hard).
- **Evidence:** `systemsEquationsLevers.test.ts` 27, `SystemsEquationsVisualizer.levers.workspace.test.tsx` 7; sweep J9/J12/J13 0 findings (`qa/eval-reports/systems-equations-visualizer-levers-2026-10-09.md`).

## Changelog

- 2026-10-09 — created with R1-R3 (W1 plain-shape binding and levers, C20).
