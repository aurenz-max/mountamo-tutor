# double-number-line — W1 workspace binding (plain shape), 2026-10-09

ROLLOUT C15. `withWorkspaceController`: the scripted path is kept (retry until correct, Next, hint). Not committed.

## Modes and what code checks
All three catalog modes are gesture items. The learner types the bottom value that matches the marked top value (box "<bottom> when <top> is <n>") and presses Check. The activity's own check (`valuesCorrect`, ±0.1, `doubleNumberLineWorkspace.ts`) is the judge, so there is no `expectedAnswer` and no key in the scene facts.

| Mode | Item | Misses (`ratioLineMiss`) |
|---|---|---|
| equivalent_ratios | unit rate given, ask at top 2+ | gave_top, stopped_at_rate, added_rate, one_unit_off, too_high, too_low |
| find_missing | non-unit pair given | the above + gave_given, added_difference |
| unit_rate | item 1 asks for the rate (top 1); later items as find_missing | the above + inverted_rate, multiplied_not_divided, subtracted |

## Fixed on both paths
- **The bottom line printed the answers.** With the bottom tick interval equal to the rate (r ≤ 5 on short lines, or maxInput 10), every bottom tick was labelled at the 'all' tier, so the value under the asked point was on screen, and the rate at tick 1. The bottom line now labels only its ends and the given values; a tick at an asked value shows `?`.
- **Items that could not be answered.** At medium/hard the unit-rate dot and given badges are withdrawn and the prompts did not state them (unit_rate: "Find the unit rate: when Hours = 1, what is ...?" with no pair anywhere). Prompts now state the unit rate (equivalent_ratios) or the given pair (find_missing, unit_rate).
- **The context stated the answer.** The model wrote the unit rate into find_missing/unit_rate contexts ("7 finished components for every 1 unit"); on unit_rate's first item that is the key. Schema text forbids it and code replaces a context or description sentence that contains the rate.
- **Workspace only:** the generated hint (names the operation and numbers) and Next are hidden; the stepper box has an accessible name.

## Gates
- `typecheck:lumina` 0. Full `tsc` 770 (baseline 770).
- `DoubleNumberLine.workspace.test.tsx` 8/8; oracle `double-number-line.test.ts` and `pip/MathWorkspaces.surface` pass.
- `workspaceContract` + `misses` + `lessonWorkspacePlan` + `activityContract` + sweep: pass. Sweep `double-number-line`: 3 payloads, 12 items, 0 findings (J1-J13), 12/12 misses named; J10 clean 100, J11 recover 67.

## Tutor replay (3 payloads x 5 samples, `replay/double-number-line-2026-10-09.json`)
0 misses on every check. Read by hand: after a miss replies ask what 1 on the top line matches, or how many jumps of the rate make the ask; "stuck" replies name the operation ("multiply 12 by 3", "divide 7 by 2"), never its result.

## Undriven modes
None.

## Open findings
1. Needs a browser check on the stepper, the `?` tick and the lever marks. Everything has run in JSDOM only.
2. The bottom tick interval is often not the rate (r = 7, interval 6), so bottom ticks do not line up with top ticks; the lines still read correctly from the given badge and alignment. `buildScales` is unchanged: aligned ticks with labels were the leak above. Ruling owed on whether to align them now that interior bottom labels are gone.
3. The scripted tutoring block (`scaffoldingLevels.level3`) says "{{targetTopValue}} × {{unitRate}} = answer"; it reaches only the scripted path, and goes when that fallback is retired.
