# Contract: formula-lab

- **Derived:** 2026-10-09, PARTIAL: written by the W1 workspace binding (ROLLOUT C17) for the workspace requirements only. A full `/primitive-contract formula-lab` derivation (consumers per formula skill, grade bands) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/FormulaLab.tsx` · **Workspace:** `formulaLabWorkspace.ts` · **Math:** `formulaLabMath.ts` · **Generator:** `service/math/gemini-formula-lab.ts` · **Adapter:** `components/live-activity/adapters/formulaLabLive.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`formula-lab`)

## Requirements

### R1 — every mode binds the shared teaching workspace with no key reaching the tutor · OBSERVED (2026-10-09)
- **Property:** all five modes are gesture items checked by the activity's own code (`formulaCheck`): free-explore credits reaching the target; the predict modes check the locked prediction (on the workspace path the lock is the commit, and the output stays hidden after a miss; the scripted path still tests, then scores); construct credits any arrangement of every token that gives the hidden formula's value on four variable sets; transfer checks the typed output within 0.5%. Each wrong check names a `FormulaLabMiss` from the catalog list (free-explore names none). Scene facts name the change, what is held fixed, whether the output is shown, the aids, and the learner's work; never the direction, the strength, the output, or (on construct) the formula: its tokens are listed sorted. Try again empties the prediction, the build or the typed output. The hint and Next are not shown on the workspace path.
- **Demanded by:** qa/workspace-rollout/ROLLOUT.md C17.
- **Evidence:** `FormulaLab.workspace.test.tsx` 11; sweep J1-J12 on 5 payloads, 0 findings, 20/20 misses named (`qa/tutor-reports/formula-lab-w1-2026-10-09.md`).
- **Probe:** `FormulaLab.workspace.test.tsx`; `journeySweep -t formula-lab`.

### R2 — construct credits the relationship, not one token order · OBSERVED (2026-10-09)
- **Property:** `b * a` for `a * b` (and any other order with the same value everywhere) is credited on both paths. Until 2026-10-09 only the generator's exact token order passed.
- **Probe:** `FormulaLab.workspace.test.tsx` ("construct credits an equivalent order").

### R3 — every checked mode's levers change the picture, never the answer · OBSERVED (2026-10-09)
- **Property:** `formulaLabLevers.ts` declares levers on the four checked modes; every catalog miss is answered by a help lever on every item. Help: find_quantity, model_pair (predict), track_scale (magnitude), group_tokens (where the tier does not group), value_check (construct), order_card (construct, transfer), substitution (where the tier does not show it and it would not print the answer), new_inputs (transfer). Leak rules in code: no predict lever word names a direction; the model pair and the order card use letters the item does not use, and the pair none of its numbers or track positions; value_check shows values, never tokens. Simplify (`simpler_problem`) on predict when the changed quantity divides or is raised to a power (a quantity that only multiplies, doubled or halved) and on transfer (inputs 1-5 or 10), with its own `~simpler` id, ungraded; the full item comes back blank. free-explore has no miss and no lever; construct has no simplify.
- **Evidence:** `formulaLabLevers.test.ts`, `FormulaLab.levers.workspace.test.tsx`; sweep J9/J12/J13 0 findings (`qa/eval-reports/formula-lab-levers-2026-10-09.md`).

## Changelog

- 2026-10-09 — created with R1-R2 (W1 plain-shape binding, C17); R3 levers.
