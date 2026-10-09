# function-machine — W1 workspace binding (plain shape), 2026-10-09

ROLLOUT C17. `withWorkspaceController`: the scripted path is kept (its tutoring block, Next Function, the tally). Not committed.

## Modes and what code checks
All five catalog modes are gesture items checked by the activity's own code (`functionMachineWorkspace.ts`), so there is no `expectedAnswer` and no hidden rule, unfed output or working machine in the scene facts.

| Mode | Learner input | Commit | Misses |
|---|---|---|---|
| observe | Feed buttons, then Continue | Continue (always right) | none: nothing to fail |
| predict | type a prediction, feed the input | each wrong prediction; the last right one | gave_input, added_not_multiplied, multiplied_not_added, one_step_only, wrong_order, too_high, too_low (`predictMiss`) |
| discover_rule | feed inputs, type the rule, Check | every Check (`rulesEquivalent`) | not_a_rule, fits_some_pairs, added_not_multiplied, multiplied_not_added, one_step_only, wrong_order, wrong_rule (`guessMiss`) |
| create_rule | type the rule, Check | every Check | same as discover_rule |
| make_rule | tile keypad, I'm done! (two machines) | a miss; the second accepted machine | not_a_rule, no_input, wrong_output, same_machine (`judgeMakeRule`) |

## Changed behaviour
- **Workspace only:** a wrong prediction does not reveal the output and does not use up the input; the item ends when every input has been predicted right. Earlier right predictions and the first make_rule machine are progress, not commits. Next Function and the "n/m correct" tally are hidden; input closes while a checked answer waits for Try again. Try again clears the typed prediction or rule and keeps fed pairs; make_rule keeps its row and verdict.
- **Both paths:**
  - Feeding records the pair at once, and the hopper/chute animation only plays. Before, a second feed during the 1.4 s animation was refused.
  - `evaluateRule` reads multiplication written by position and the keypad signs, so "1 + 2x" now passes for 2*x + 1. Before, any reordered rule written this way was marked wrong.
  - The rule-box placeholder "e.g., x + 3" was the answer on an x + 3 item. It now reads "use x".
  - Feed buttons are labelled "Feed N", and the inputs are labelled "My prediction" and "Your rule".
  - Start over is always pressable.

## Gates
- `typecheck:lumina` 0.
- `FunctionMachine.workspace.test.tsx` 12/12. `FunctionMachine.build.test`, `functionMachineDomain.test`, `MathWorkspaces.surface`, oracles: 261/261. `misses`, `lessonWorkspacePlan`, `sourceControlBytes`: 129/129. `activityContract` 119/119.
- `workspaceContract -t function-machine` 21/21.
- Sweep `function-machine`: 5 payloads, 21 items, 0 findings (J1-J13), 16/16 checked misses named. J10 clean 100/100, J11 recover 67/0.

## Tutor replay (5 payloads x 5 samples)
- **r1** (`replay/function-machine-2026-10-09.json`): checks 4 misses, all read as false positives ("Adding 2 works for 1…" describes the learner's own rule). Read by hand, there were real leaks the checks missed:
  - create stuck: "each output is double its input" (3/5);
  - discover stuck: "What can you add to 0 to get 4?";
  - make stuck: "What number can you add to 5?".
  - The guidance itself pointed at "(adding)/(multiplying)". It was rewritten.
- **r2:** two leaks were left:
  - predict stuck "count by fours two times: four, eight" said the output;
  - make stuck "change that number tile by 1, one less".
  - The guidance now says to stop before the result and never say how much to change a tile.
- **r3** (`-r3.json`): 1 check miss, a false positive. It is predict stuck "Try adding 4 plus 4", which works through the visible rule without giving its result. Read by hand, none of the 100 replies says a hidden rule, its operation, an unfed output, or a fix.

## Undriven modes
None.

## Open findings
1. **Generator scope:** the Grade 3-4 observe and predict payloads use `x - 5` on inputs 1-4. That gives negative outputs (-4…), which are out of scope at grade 3-4. Route: `/topic-fidelity` or `/oracle-test` on `gemini-function-machine.ts`.
2. **One item shape per lesson:** every saved payload is band 3-4, one-step. The discover and create payloads have no two-step rule, so `one_step_only` and `wrong_order` are covered only by unit tests.
3. **Scripted path:** its tutoring block, the `[GUESS_INCORRECT]` cue (which carries the rule) and the reveal clause still reach only the scripted fallback. They go when that fallback is retired.
4. Needs a browser check on the feed animation (now display only) and on the make_rule keypad on the workspace path.
