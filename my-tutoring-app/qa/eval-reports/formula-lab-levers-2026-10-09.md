# formula-lab — support levers, 2026-10-09

`formulaLabLevers.ts` holds the declarations, leak rules and simplify builders. The component keeps lever state per item and exposes `pullLever`/`endPractice` on `workspace.current`, with one scene fact per pulled lever. Catalog `teachingWorkspace.levers: true`.
Builds on the W1 binding (`qa/tutor-reports/formula-lab-w1-2026-10-09.md`).

## Failure inventory

Evidence classes: no real-learner evidence (`logs/demonstrations`, `qa/misconception` and the remediation modules have nothing for formula-lab). **observed-synthetic**: the sweep's signature wrong answers on 5 payloads. **documented**: the catalog's commonStruggles. **inferred**: reasoning from the task.

| Mode | Miss (pattern on screen) | Class |
|---|---|---|
| predict-direction | opposite_direction, missed_change, invented_change | documented ("same direction every time"), synthetic |
| predict-magnitude | opposite_direction, too_strong, too_weak | synthetic, inferred (the track's scale is never stated) |
| construct-formula | incomplete, not_an_expression, inverted, operation_order | documented ("invalid order"), synthetic |
| transfer-apply | used_starting_inputs (the scene still shows the starting values), power_as_multiply, near_miss, too_high, too_low | documented ("arithmetic before structure"), inferred |
| free-explore | none: every finished move is credited | — |

## Lever table

| Mode | Lever | Kind | Answers | Leak rule (code) |
|---|---|---|---|---|
| predict ×2 | find_quantity: the changed symbol ringed in the formula | help, shown | opposite_direction (+ missed/invented on direction) | no direction word (`leverTextLeaks`) |
| predict ×2 | model_pair: y = k × x and y = k ÷ x, x going up (outside the item) | help, both | opposite_direction (+ missed_change) | letters the item does not use; no number of the item's or its track position (else not offered) |
| magnitude | track_scale: drops to zero / halves / no change / half as much again / doubles | help, shown | too_strong, too_weak | words only, same on every item |
| predict ×2 | simpler_problem: a quantity that only multiplies, doubled or halved | simplify | all of the mode | same mode, never the item's changed quantity; offered only when the item's quantity divides or is raised to a power |
| construct | group_tokens: tokens sorted into values / operations / grouping | help, shown | incomplete, not_an_expression | not offered where the tier already groups them |
| construct | value_check: the build's value at the starting values beside the system's | help, shown | inverted, operation_order, not_an_expression, incomplete | shows values only, no token or order |
| construct, transfer | order_card: order of operations, what a power belongs to, a ÷ b ≠ b ÷ a | help, shown | construct: order misses; transfer: power_as_multiply, near_miss, too_high, too_low | letters the item does not use |
| transfer | substitution: new inputs written into the formula | help, shown | used_starting_inputs, near_miss, too_high, too_low | refused if it would print the answer (`substitutionLeaks`); not offered where the tier shows it |
| transfer | new_inputs: the living system moved to the new inputs | help, shown | used_starting_inputs | the output stays hidden |
| transfer | simpler_problem: the same formula on inputs 1-5 or 10, setup written in | simplify | all of the mode | no input equal to the item's; answer more than 5% from the item's |

There is no simplify on construct: every smaller build is a piece of the hidden formula, and a different formula would need a formula swap at lesson level, which the component does not have. Starting positions: the generator's tiers already set `groupFormulaTokens` and `showSubstitutionSetup` on easy, and those two levers are not offered when the tier has set them, so the generator was not changed.

## Gates

- `typecheck:lumina`: 0.
- `formulaLabLevers.test.ts` 10/10 (declarations cover every miss per mode, the nextLever table, the leak rules, the builders over 200 random items). `FormulaLab.levers.workspace.test.tsx` 6/6. `FormulaLab.workspace.test.tsx` 11/11.
- Sweep (`-t formula-lab`, J1-J13), 5 payloads: 0 findings. Misses named 20/20. Every catalog miss is answered on every item (J9/J12 0), and J13 is 0: no key newly on screen, and the correct input still credits with every help lever pulled. On these payloads, simplify shows up only on predict-magnitude and transfer: every predict-direction quantity only multiplies.
- `workspaceContract`, `misses.test.ts`, `sourceControlBytes`, `lessonWorkspacePlan`, `MathWorkspaces.surface`, `gemini-formula-lab.*`: 2598/2598. Full sweep, every family: 572/572.
- Tutor replay, 5 payloads × 5 samples (`replay/formula-lab-2026-10-09-r3.json`): 0 misses on 110 samples when re-scored with the current `replay_checks.py`. The run itself reported 2/20 `no_protocol_leak` on "your current build". That was a checker false positive: a parallel session changed `CURRENT` to case-sensitive in `replay_checks.py` (now in `test_replay_checks.py`) while the run was in progress.

## Open findings

1. **The tutor pulled two levers in one turn (shared doctrine).** In 3/5 predict-magnitude `stuck` replies the tutor called `simpler_problem` and then `find_quantity`. The second pull is refused while the practice item is open, but the reply still says "I've circled the velocity symbol". `no_change_before_receipt` does not catch this, because the narration comes after the calls. This belongs to the class rule in the shared lever doctrine, not to formula-lab.
2. **Construct, tutor knowledge (carried over from W1).** In `stuck` replies the tutor still asks "which quantity gets squared in kinetic energy?". The formula is a named one, so the tutor knows it whatever the screen hides. The guidance forbids it, but the model reaches for it.
3. **Generator content (`/eval-fix`, from W1).** Construct repeats one expression 5 times. predict-direction payloads only use quantities that multiply, so the inverse cases, and the simplify that answers them, never come up in generated lessons.
