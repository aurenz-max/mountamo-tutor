# function-machine levers, 2026-10-09

`/add-support-tiers` on the W1 binding (`qa/tutor-reports/function-machine-w1-2026-10-09.md`). Not committed.

## Failure inventory
There is no real-learner evidence: `logs/demonstrations` and `qa/misconception` hold nothing for function-machine.

| Mode | Failure (miss) | Class |
|---|---|---|
| predict | added or subtracted where the rule multiplies or divides (`added_not_multiplied`), or the reverse (`multiplied_not_added`) | documented (commonStruggles "additive for multiplicative") + synthetic |
| predict | one step of a two-step rule (`one_step_only`), or the steps the other way round (`wrong_order`) | documented ("confusing two-step rules") |
| predict | the input back (`gave_input`), `too_high` / `too_low` | inferred / synthetic (journey: one over) |
| discover, create | right for some pairs only (`fits_some_pairs`) | documented ("only looking at one pair") + synthetic |
| discover, create | adding for multiplying and the reverse, one step of two, wrong order, `wrong_rule` | documented |
| discover, create | the typed rule cannot run (`not_a_rule`) | inferred |
| make | `wrong_output` | synthetic (journey: one over), open-build report |
| make | `no_input`, `not_a_rule`, `same_machine` | open-build report (unit tests) |
| observe | none: Continue cannot fail | — |

## Lever table (built)
| Mode | Lever | Kind | Answers | Leak rule (code) |
|---|---|---|---|---|
| predict | `model_machine`: a different machine of the same shape with one input worked through | help, both | all 7 | not equivalent to the rule; none of its numbers is an output of the item (`modelLeaks`) |
| predict | `step_order`: a two-step rule redrawn as "first × a, then + b" in place of the rule | help | one_step_only, wrong_order | exactly the rule's own numbers, else not offered (`ruleSteps`) |
| discover, create | `check_pairs`: the learner's last checked rule marked fits / does not fit on each pair | help | all but not_a_rule | only the learner's rule; refused before a rule that runs has been checked |
| discover, create | `output_steps`: output change between pairs one input apart | help | add/multiply swaps, one_step_only, wrong_rule | from pairs on screen; writes no rule |
| discover, create | `model_machine`: a different machine with its rule and three pairs | help, both | all 7 | not equivalent; its text never contains the item's rule |
| make | `run_machine`: the learner's last checked machine worked on the asked input and one more | help | wrong_output, no_input | the learner's tiles only; refused before a checked machine |
| make | `machine_shapes`: empty shapes (x + ☐, ☐ × x …) | help | not_a_rule, no_input, same_machine | no digit |
| predict, discover, create | `simpler_machine`: a one-step rule with a small number, practice | simplify | predict all, others all but not_a_rule | own id, not equivalent, no shared rule text; on predict, no output shared with the item (`practiceLeaks`) |
| make | `simpler_machine`: a smaller pair (output ≤ 9) | simplify | wrong_output | never the item's pair |

- **Lever text:** no lever's `when`/`does` carries a digit (unit-tested).
- **Simplify:** none on an item that is already one step with a number ≤ 3 (and inputs ≤ 3 on predict), or on a make pair ≤ 9. Help levers cover those items' misses (J12 green).
- **Starting positions:** not added. The generator's existing tier (`hintLevel`, prefilled pairs) is unchanged, and the tier harness does not map to these levers yet.
- **Observe:** no lever, because no miss is possible.

## What was built
- `functionMachineLevers.ts`: declarations, facts, builders and leak rules.
- `FunctionMachine.tsx`: lever state keyed by item, a practice machine in place of the item, `pullLever`/`endPractice`, five lever cards and the step-order redraw, the last checked rule/machine kept per item.
- `levers: true` in the catalog.
- The journey row gained `replayKeys`: the hidden rule, the unfed outputs, the stored machine. Before, the sweep took the digit 4 from "x + 4" as a key, and a reply reading the on-screen pair "0 → 4" was flagged.

## Gates
- `typecheck:lumina` 0; full `tsc` 770 (baseline 770).
- `functionMachineLevers.test.ts` 157/157. `FunctionMachine.levers.workspace.test.tsx` 6/6. `FunctionMachine.workspace.test.tsx` 12/12. With the build, domain, surface, oracle, misses, lessonWorkspacePlan, activityContract and sourceControlBytes suites: 686/686.
- `workspaceContract -t function-machine` 21/21.
- Sweep `function-machine`: 5 payloads, 0 findings J1-J13. J9 has every catalog miss answered on every checked mode, and J12 has every item's miss answered by a lever on that item.
- Replay r5 (`replay/function-machine-2026-10-09-r5.json`, 5 × 5): 0 check misses on start, miss, stuck, lever and credit, with `no_change_before_receipt` 0/20. Read by hand:
  - In every stuck moment the tutor pulls a lever itself (check_pairs, run_machine, model_machine) and describes the change only after the receipt.
  - No reply says a hidden rule, an unfed output or a working machine.
  - Predict replies set the model machine (2x) against the learner's own rule and stop before the result.

## Failures with no lever
- Observe: nothing can fail.
- `not_a_rule` on discover/create is answered only by the model machine. No lever shows how to fix the learner's own unparseable text; that would be a text-editing aid, not a representation change.

## Open
- Payloads are all band 3-4, one-step, so `step_order` and two-step models are covered by unit tests only.
- The make_rule practice pair is always times-shaped (2 → 4, 2 → 6, 3 → 6 …). It is valid but not varied.
- Needs a browser check on the lever cards' layout at phone width.
