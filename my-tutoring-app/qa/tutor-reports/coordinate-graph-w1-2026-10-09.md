# coordinate-graph — W1 workspace binding (plain shape), 2026-10-09

ROLLOUT C19. `withWorkspaceController`: the scripted path is kept (hint, Try again, the answer shown after two misses, auto-advance). Not committed.

## Modes and what code checks
All four catalog modes are gesture items. No `expectedAnswer`, no key in the scene facts.

| Mode | Input | Check | Misses (`coordinateMiss`) |
|---|---|---|---|
| plot_point | tap a grid crossing on the plane | `plotCorrect` (the crossing is the instruction's pair) | swapped, both_signs, x_sign, y_sign, one_axis, off_by_one, wrong_point |
| read_point | tap one of four pairs | `choiceCorrect` | same as plot, from the chosen pair |
| find_slope | tap one of four slopes | `choiceCorrect` | opposite_sign, reciprocal, negative_reciprocal, rise_only, run_only, wrong_slope |
| find_intercept | tap one of four numbers | `choiceCorrect` | opposite_sign, slope_instead, x_intercept, point_y, off_by_one, wrong_intercept |

The adapter refuses an item whose indexed choice is not the one choice with the key's value (computed from the drawn points), whose choices repeat, whose points are off the grid, or whose line is vertical.

## Fixed
- **find_intercept printed its answer** on both paths: the default (no tier) and easy tier drew the generated `y = 2x + 4`. The label is now drawn as `y = 2x + ?` (`maskedEquation`).
- Generator: an instruction that states the answer (a read pair, a stated slope, "horizontal" on a zero slope, an intercept's equation or `(0, b)`) is replaced by the plain ask; a repeated choice or a second choice with the key's value ("5/5" beside "1") is replaced by a computed distractor. Seen in generation: "Find the slope of the horizontal line…" on a slope-0 item.
- Plotting moved from `onClick` + bounding box to `onPointerUp` through the SVG screen matrix (same snapping); the journey drives it with a one-point stroke.
- Workspace only: no answer reveal after a wrong tap, no hint, no Continue, no auto-advance timer; the plane and choices are closed while a checked answer waits for Try again.

## Gates
- `typecheck:lumina` 0; full `tsc` 770 (baseline 770).
- `CoordinateGraph.workspace.test.tsx` 10/10; `pip/MathWorkspaces.surface`, `lessonWorkspacePlan`, `activityContract`, `workspaceContract`, `misses`: 2838/2838; oracle tests 251/251; `sourceControlBytes` pass.
- Sweep `coordinate-graph`: 4 payloads, 20 items, 0 findings (J1-J13), 20/20 misses named; J10 clean 100, J11 recover 67/0.

## Tutor replay (4 payloads x 5 samples)
- `replay/coordinate-graph-2026-10-09.json`: 0 misses on every check. Read by hand: read_point "stuck" replies said "move left along the x-axis" (3/5): the miss name (`both_signs`) with the learner's chosen pair lets the tutor work out the key, and it turned that into the direction. plot_point "stuck" walked every move (5/5).
- Guidance: one sentence (a named miss is a difference to ask about, never turned into the answer's direction or number) and one (stuck: one step, then the learner's). `replay/coordinate-graph-2026-10-09-r2.json`: 0 misses; read_point stuck now asks left or right (0/5 tell it); plot_point stuck asks which way first in 3/5, gives the first move in 1/5 and every move in 1/5 (the pair is in the instruction).

## Undriven modes
None.

## Open findings
1. Browser check owed: the pointer-up placement on a real plane (touch and mouse), and the masked equation label's position.
2. The generator often puts a defining point on the y-axis at no tier (`fi-0`, `fi-2` in the payload: `(0, 4)`), which makes find_intercept a read of a marked point. The tier prompt keeps that to easy; the default does not. `/eval-fix` question.
3. The miss reaches the tutor with the learner's response, so on an MC item the tutor can always derive the key (swap or sign flip of the chosen pair). Guidance now forbids turning it into the answer; this is a class property of named misses on choice items, not this binding.
4. The scripted tutoring block names `{{challenge.x1}}`/`{{challenge.y1}}`; it reaches only the scripted path and goes when that fallback is retired.
