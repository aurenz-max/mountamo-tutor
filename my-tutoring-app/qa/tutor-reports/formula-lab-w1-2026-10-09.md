# formula-lab — W1 workspace binding (C17), 2026-10-09

Plain shape (P): `withWorkspaceController('formula-lab', FormulaLabSurface, useScriptedProgress, useWorkspaceProgressFor(...))`.
Domain module `formulaLabWorkspace.ts`; adapter `adapters/formulaLabLive.ts`; catalog `teachingWorkspace { grades 6-12, guidance, misses }`;
journey row `formula-lab`; contract `docs/contracts/formula-lab.md` (R1, R2).

## Modes and what code checks

| Mode | Answer on screen | Check (`formulaCheck`) | Misses (`formulaMiss`) |
|---|---|---|---|
| free-explore | slider to the target | reaching it (always credited) | none (nothing to get wrong) |
| predict-direction | prediction on the track + Lock prediction | direction of the locked prediction | opposite_direction, missed_change, invented_change |
| predict-magnitude | same | score by distance from the observed marker, 70 passes | opposite_direction, too_strong, too_weak |
| construct-formula | tokens tapped + Check formula | every token, same value as the hidden formula on 4 variable sets | incomplete, not_an_expression, inverted, operation_order |
| transfer-apply | output typed + Check | within 0.5% | used_starting_inputs, power_as_multiply, near_miss, too_high, too_low |

Changes beyond the binding:
- Workspace path: the predict modes commit at Lock prediction; a miss keeps the output hidden and Try again clears the prediction. The scripted path still tests first, then scores (unchanged).
- Both paths: construct credits any order with the same relationship (`m * 0.5 * v ^ 2`); before, only the generator's token order passed.
- Hint and Next hidden on the workspace path; legacy context and tagged messages muted (`enabled: !tutorOwned`).
- Hidden range inputs ("Changed quantity", "Your prediction") give the keyboard and the journey a way onto the Radix slider and the prediction track.

## Gates

- `typecheck:lumina`: 0 errors in formula-lab files. The run reported 1 error, in `liveJourneySpec.ts`: the `function-machine` row, which a sibling session was adding at the time.
- `FormulaLab.workspace.test.tsx`: 11/11. `workspaceContract`, `misses.test.ts`, `lessonWorkspacePlan`, `MathWorkspaces.surface`, `gemini-formula-lab.*`: 2570/2570.
- Sweep (`journeySweep -t formula-lab`), 5 payloads × 5 items: 0 findings. Misses named 20/20. Records: clean run 100/100, recover run 67 with every miss in teachingAttempts.
  The first run had 40 J7 findings: the reset ran in a `useEffect` after the item opened. Moving the reset into `onItemOpened` cleared them.
- Tutor replay (5 payloads × 5 samples): 0 misses on both runs (`replay/formula-lab-2026-10-09.json`, `-r2.json`).
  Reading the replies of the first run: in 2/5 predict-direction `stuck` replies the tutor stated the direction ("increasing Mass will also increase Force"), and construct replies named which quantity is squared and in what order to build. The key check cannot see either, because the keys are the output value and the expression.
  Guidance was rewritten once: name the role of the changed quantity, but do not apply it to the item, not even as a leaning either-or question. After that, predict-direction and predict-magnitude replies only ask questions.

## Undriven

None: every mode is driven through its real controls. free-explore has no wrong input, so the miss rules do not apply to it.

## Open findings

1. **Construct, tutor knowledge (W2 or guidance class).** Even after the guidance fix, about 3/10 construct replies still name "velocity squared". The tutor knows the named formula (kinetic energy) from the topic, so hiding it on screen does not keep it from the tutor. A help lever that acts outside the item is the next step (phase 2).
2. **Generator: construct repeats one answer 5 times (`/eval-fix`).** Every construct-formula lesson has one `expression`, so all 5 items ask for the same build. After item 1 is credited the formula has been shown. Finding (N challenges = N problems).
3. **Generator: thin direction content (`/eval-fix`).** All 5 payloads are `m*a` or kinetic energy, where every variable is a multiplier, so predict-direction's answer is always "the same way the input moved". No divisor or inverse appeared, so `inverted` and the direction misses on inverse relationships come only from hand-built test items.
