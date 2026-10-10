# parameter-explorer — support levers, 2026-10-09

`parameterExplorerLevers.ts` holds the declarations, leak rules and simplify builders. The component keeps lever state per item and
exposes `pullLever`/`endPractice` on `workspace.current`, with one scene fact per pulled lever. Catalog `teachingWorkspace.levers: true`.
Builds on the W1 binding (`qa/tutor-reports/parameter-explorer-w1-2026-10-09.md`).

## Failure inventory

No real-learner evidence (no demonstrations, misconception or remediation files for parameter-explorer). **synthetic**: the sweep's
signature wrong answers on 4 payloads. **documented**: the catalog's commonStruggles (divisor read as a multiplier; all sliders moved at
once; no slider moved). **inferred**: reasoning from the task.

| Mode | Miss (pattern on screen) | Class |
|---|---|---|
| predict-direction | opposite_direction, missed_change, invented_change | documented (inverse relation), synthetic |
| predict-value | unchanged_output, assumed_proportional, near_miss, opposite_direction, too_high, too_low | synthetic, inferred |
| identify-relationship | no_effect, largest_value, weaker_effect | inferred ("the biggest number matters most") |
| explore | none: every move is credited | — |

## Lever table

| Mode | Lever | Kind | Answers | Leak rule (code) |
|---|---|---|---|---|
| predict-direction | find_parameter: the changed symbol ringed in the plain formula | help, shown | all three | no direction word (`leverTextLeaks`) |
| predict-direction | model_pair: y = k × x and y = k ÷ x, x moved one up (outside the item) | help, both | opposite_direction, missed_change | letters and numbers the item does not use; not offered otherwise |
| predict-direction | simpler_problem: a parameter that only multiplies, doubled or halved | simplify | all three | same mode; never the item's parameter; offered only when the item's does not only multiply |
| predict-value | substitution: the formula with the setting written in | help, shown | all six | refused when it would print the answer |
| predict-value | scaling_model: × x, × x², ÷ x with x doubled (outside the item) | help, both | all but near_miss | as model_pair |
| predict-value | simpler_problem: one parameter doubled or halved from its start | simplify | all six | not the item's setting; answer more than 5% from the item's |
| identify | double_marks: start and ×2 marks on each slider, Back to start | help, shown | all three | only where the output readout is shown; marks positions, no result |
| identify | doubling_model: × x, × x², + k with x doubled (outside the item) | help, both | all three | as model_pair |

No simplify on identify: the lesson has one formula, and every smaller item on it asks the same question with the same key. Starting
positions: the generator's existing tiers (readouts, highlight) already set them; no lever starts pulled, so the generator was not changed
for levers.

## Gates

- `typecheck:lumina` 0; full `tsc` 770 (baseline).
- `parameterExplorerLevers.test.ts` 9/9 (every miss answered per item, nextLever order, leak rules, substitution, marks, the builders over
  200 seeded items). `ParameterExplorer.levers.workspace.test.tsx` 5/5. `ParameterExplorer.workspace.test.tsx` 10/10.
- Sweep (`-t parameter-explorer`, J1-J13), 4 payloads: 0 findings; misses named 8/8; every catalog miss answered on every item (J9/J12
  0); J13 0 (no key newly on screen, the correct input still credits with every help lever pulled). Lever inventory on the payloads:
  direction 3, value 3, identify 2, explore none.
- `workspaceContract`, `misses`, `lessonWorkspacePlan`, `activityContract`, `MathWorkspaces.surface`, `sourceControlBytes`: 2926/2926.
- Tutor replay, 4 payloads × 5 samples (`replay/parameter-explorer-2026-10-09-r4.json`): 0 misses on start, miss, stuck and lever
  (`no_change_before_receipt` 0/15); 2/20 credit `no_protocol_leak`, the tutor's own LaTeX (`$250\text{ J}$`). Read by hand: the tutor
  pulls the lever made for the miss (double_marks on largest/weaker, find_parameter on opposite_direction, substitution on
  unchanged_output) and describes only what is on screen; no direction, value or leader stated.

## Open findings

1. **Two pulls in one turn** (1/5 identify stuck: doubling_model then double_marks). Same class as formula-lab finding 1: shared lever doctrine.
2. **The tutor writes LaTeX in speech** (W1 finding 1); a shared class, not this primitive.
3. model_pair, scaling_model and doubling_model are not offered when every model set collides with the item's numbers (the first
   identify payload had none until four more sets were added); the ring, the substitution and the marks still answer every miss.
