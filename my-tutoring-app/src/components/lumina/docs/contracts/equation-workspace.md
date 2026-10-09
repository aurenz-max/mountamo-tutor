# Contract: equation-workspace

- **Derived:** 2026-10-09, PARTIAL: written by the W1 workspace binding (ROLLOUT C17) for the workspace and lever requirements only. A full `/primitive-contract equation-workspace` derivation (consumers per algebra skill, grade bands) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/EquationWorkspace.tsx` · **Workspace:** `equationWorkspaceDomain.ts` · **Levers:** `equationWorkspaceLevers.ts` · **Generator:** `service/math/gemini-equation-workspace.ts` · **Oracle:** `service/qa/oracles/equation-workspace.ts` · **Adapter:** `components/live-activity/adapters/equationWorkspaceLive.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`equation-workspace`)

## Requirements

### R1 — every mode binds the shared teaching workspace with no key reaching the tutor · OBSERVED (2026-10-09)
- **Property:** all four modes are gesture items checked by the activity against the solution path (`operationCorrect`: the tapped id is the next step's id, or the identify key). In guided-solve, solve and multi-step a right step that leaves the variable attached is applied and is not a commit; a wrong operation and the step that leaves the variable alone are. identify-operation commits on Check. Each wrong operation names an `EquationMiss` (`later_step`, `not_inverse`, `wrong_number`, `other_operation`). Scene facts name the equation, the menu, the steps applied and the current line; never a line not reached, the solved value or which menu item is right. Try again keeps the applied steps. Next and the learner's Hint button are not shown on the workspace path.
- **Demanded by:** qa/workspace-rollout/ROLLOUT.md C17.
- **Evidence:** `EquationWorkspace.workspace.test.tsx`; sweep J1-J13 on 4 payloads; replay 4 x 5 (`qa/tutor-reports/equation-workspace-w1-2026-10-09.md`).
- **Probe:** `EquationWorkspace.workspace.test.tsx`; `journeySweep -t equation-workspace`.

### R2 — the answer is never given away by menu position · OBSERVED (2026-10-09)
- **Property:** the generator shuffles `availableOperations`; the model listed the solution's operations first (op0 was step 1 in 6 of 6 sampled items). The checker reads ids, never positions. Every solution step and the identify key are in the menu (adapter refuses otherwise).
- **Probe:** w1-payloads (the first menu item is the next step in 6 of 20 items after the fix, about chance); `EquationWorkspace.workspace.test.tsx` (adapter case).

### R3 — every mode's levers change the picture, never the answer · OBSERVED (2026-10-09)
- **Property:** see `equationWorkspaceLevers.ts` and `qa/eval-reports/equation-workspace-levers-2026-10-09.md`. Panels carry no digit; the marked sides are the current line's own two sides; the worked model and the practice equation share no number with the item.
- **Evidence:** `equationWorkspaceLevers.test.ts`, `EquationWorkspace.levers.workspace.test.tsx`; sweep J9/J12/J13.

### R4 — commuting tidy steps are one step · OBSERVED (2026-10-09)
- **Property:** adjacent combine steps (variable terms, constants) are merged into one "Combine like terms" step (`mergeCommutingSteps`), so neither order is marked wrong; undoing before tidying is still `later_step`.
- **Probe:** `EquationWorkspace.workspace.test.tsx` (both orders case).

## Changelog

- 2026-10-09 — created with R1-R3 (W1 plain-shape binding and levers, C17); R4 added the same day (orchestrator follow-up).
