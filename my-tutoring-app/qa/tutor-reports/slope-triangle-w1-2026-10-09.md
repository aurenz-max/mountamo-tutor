# slope-triangle — W1 workspace binding (plain shape), 2026-10-09

ROLLOUT C20. `withWorkspaceController`: the scripted path is kept (hint, Next, scripted tutor messages). Not committed.

## Modes and what code checks
All three catalog modes are gesture items. No `expectedAnswer`, no key in the scene facts.

| Mode | Input | Check | Misses (`slopeTriangleMiss`) |
|---|---|---|---|
| identify_slope | type rise and run, Check | `identifyCorrect` (both legs of the drawn triangle) | swapped, rise_sign, run_sign, same_ratio, rise_off, run_off, wrong_legs |
| calculate | type the slope (number or a/b), Check | `calculateCorrect` (by value: 4/6 counts for 2/3) | opposite_sign, reciprocal, negative_reciprocal, rise_only, run_only, wrong_slope |
| draw_triangle | drag the corners or Move/Run buttons, Check | `drawCorrect` (the run built is the target) | not_resized, off_by_one, wrong_run |

The adapter refuses an item whose stored rise, run and slope are not the drawn triangle, whose run is not a whole number 1-8, a read item whose drawn size is not its run, an identify item that prints its legs, or a build that starts at its target.

## Fixed (both paths)
- **calculate printed its answer**: the line banner showed the generated `y = -0.67x + 2`. identify_slope and calculate now draw `y = ?x + b` (`lineLabel`); identify's slope with the counted run gave the rise.
- **calculate placeholder** was `e.g. 2/3`, a pool slope; now `?`. The parse error's example names no value.
- **Generator**: the no-tier path allowed half-step rises (`Δy = 7.5` for a 3/2 line with run 5, seen in the first calculate payload); rises are now whole grid steps, main loop and fallback.
- **draw_triangle had no control but a canvas drag**: Move left/right and Shorter/Longer run buttons (clamped to the grid, run 1-8) so the build is drivable without a mouse; the journey row uses them.
- Workspace only: no Next, no hint, no scripted `sendText`, `useLuminaAI` disabled; inputs, buttons, drags and Check closed while a checked answer waits for Try again; Try again restores the item's starting triangle and empty boxes; submission only under an evaluation provider.

## Gates
- `typecheck:lumina` 0 (one sibling error in SystemsEquationsVisualizer.tsx mid-edit at the first run, gone by the second); full `tsc` 770 (baseline 770).
- `SlopeTriangle.workspace.test.tsx` 8/8; with workspaceContract, journeySweep, misses, pip MathWorkspaces surface, slope-triangle oracle, lessonWorkspacePlan, activityContract: 3520 passed (one failure, `matrix-display.determinant_inverse`, a sibling's payload).
- Sweep `slope-triangle`: 3 payloads, 15 items, 0 findings (J1-J13), 15/15 misses named; J10 clean 100, J11 recover 67/0.

## Tutor replay (3 payloads x 5 samples)
`replay/slope-triangle-2026-10-09.json`: 0 misses on every check. Read by hand: start asks to count up and across; miss on identify asks whether the line goes up or down (named miss rise_sign); calculate asks which number goes on top; stuck on identify says the rise is positive because the line goes up (the direction is drawn; it gives the sign, not a number); stuck on calculate reads the printed legs (Δy = -2, Δx = 6), which the no-tier card shows. No guidance change.

## Undriven modes
None. Canvas drags are not driven (JSDOM has no 2D context); the buttons are.

## Open findings
1. **draw_triangle is a weak task** (ruling owed, `/eval-fix` or a fork): the card prints the target run and the current run side by side, and the check reads only the run, so a learner matches two numbers without using the slope; the generated instruction ("so it sits on the line and reveals the slope") asks for something the check never reads. A build that asks for a target rise, or for the slope after building, would need a new mode or a contract fork.
2. Browser check owed: the masked label, the four build buttons, Check disabled after a miss.
3. Generator variety: the identify payload has three slope-1 lines out of five; calculate (before the fix) had four slope-2 items. `/add-number-pool-service` question.
4. The scripted `tutoring` block still interpolates `{{expectedRise}}`, `{{expectedSlope}}`; it reaches only the scripted path and goes when that fallback is retired.

## Update: draw_triangle rebuilt within the mode (orchestrator, same day)
Open finding 1 was a defect, not a ruling: the card printed the target run beside the current run and the check read only the run. Fixed on both paths:
- No target anywhere before a check: the card, the ask (`askOf`), the generated instruction and hint, the scene facts and the catalog mode description name no run or rise.
- The learner builds the whole triangle: the left corner stays on the line, the run is set by the right corner (or Run +/−), the rise by the new top corner (drag, or Rise +/−). The triangle starts flat.
- `drawCorrect` reads the built triangle: rise (whole grid steps, not 0) over run equals the line's slope, so any fitting run is credited (run 5, rise -5 on y = -x + 2 counts as well as the generated 3/-3).
- Misses: `flat`, `wrong_sign`, `swapped`, `rise_off`, `wrong_ratio` (replacing not_resized/off_by_one/wrong_run).
- Finding 4 closed: the adapter and the oracle (rule e) now reject half-step rises; the adapter also rejects a flat line.

Gates after the fix: `typecheck:lumina` 0; slope-triangle tests 27/27 (workspace 8, levers workspace 5, levers unit 14); with the shared suites, oracles and sourceControlBytes 4241/4241 (one control byte in my own test, written through a heredoc, found and fixed); sweep 3 payloads (draw payload re-saved), 15 items, 0 findings J1-J13, 15/15 misses named. Replay `replay/slope-triangle-2026-10-09-r3.json`, 3 x 5: 0 misses; draw replies name direction (raise the top corner, the line goes up) and never a run or rise before the try.
