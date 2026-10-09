# circle-explorer — W1 workspace binding (plain shape), 2026-10-09

ROLLOUT C18. `withWorkspaceController`: the scripted path is kept (retry until correct, hint, Next). Not committed.

## Modes and what code checks
All five catalog modes are gesture items. The learner types a number and presses Check; the activity's own check (`circleCorrect`, `circleExplorerWorkspace.ts`) accepts it within the item's tolerance. No `expectedAnswer`, no key in the scene facts. An empty or non-numeric entry is not a check.

| Mode | Input | Misses (`circleMiss`) |
|---|---|---|
| discover_pi | Unroll the circumference, type C ÷ d, Check | inverse_ratio, typed_length, near/too |
| circumference | type C, Check (unroll optional) | pi_times_radius, two_pi_times_diameter, area_formula, no_pi, near/too |
| area | type A, Check (slice optional) | circumference_formula, pi_times_radius, diameter_squared, no_pi, near/too |
| reverse | type r, Check | diameter_not_radius, multiplied, divided_by_two_only, no_square_root, divided_by_two_pi, no_pi_divide, near/too |
| composite | type the area or perimeter, Check | whole_circle, diameter_as_radius, half_circumference, curve_only, full_circle_edge, radius_edge, circle_area, square_area, added, near/too |

The canvas text is not in the page, so the scene's `figure` fact states what the canvas prints (`figureLabels`).

## Fixed on both paths
- **discover π printed its answer.** After the required unroll the track was labelled "≈ 3.14 d" and the feedback said "always about 3.14". Both gone; the feedback now asks how many diameters long the line is.
- **area with a given diameter** drew a radius-length line labelled "d = …". It now draws the diameter across.
- Unroll sets `unrolled` when pressed (the animation only draws it), so the discover gate does not wait on animation frames.
- Workspace only: hint, hint button and Next hidden; input, Check, unroll and slice closed while a checked answer waits for Try again; the box is labelled "Your answer".

## Gates
- `typecheck:lumina` 0; full `tsc` 770 (baseline 770).
- `CircleExplorer.workspace.test.tsx` 10/10; `pip/MathWorkspaces.surface` pass.
- `workspaceContract`, `journeySweep`, `misses`, `lessonWorkspacePlan`, `activityContract`: circle-explorer clean. Sweep: 5 payloads, 20 items, 0 findings (J1-J13), 20/20 misses named; J10 clean 100, J11 recover 67/0.

## Tutor replay (5 payloads x 5 samples, `replay/circle-explorer-2026-10-09.json`)
0 misses on every check. Read by hand: after a miss the replies name what was found ("that found the distance around"), ask around-or-inside and radius-or-diameter. "Stuck" replies give the computation to do ("18.8 divided by 6", "3.14 times 3 times 3"), never its result. Same pattern as ratio-table.

## Undriven modes
None.

## Open findings
1. Browser check owed on the canvas (unroll, slice, figures). JSDOM has no canvas; every check here reads the scene facts and the DOM.
2. discover π's tolerance (±0.15) credits a plain "3". That is the generator's choice for the hard tier's estimate; whether a medium item (C and d labelled) should require 3.1 or better is an `/eval-fix` question.
3. "Stuck" replies dictate the arithmetic ("multiply 3.14 by 3, then by 3"), which leaves the learner only a calculation. Not a key leak; a guidance question for the class, not this binding.
4. The scripted tutoring block names `{{expectedAnswer}}`; it reaches only the scripted path and goes when that fallback is retired.
