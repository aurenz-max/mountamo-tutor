# coordinate-graph — support levers, 2026-10-09

Built on the W1 binding (`qa/tutor-reports/coordinate-graph-w1-2026-10-09.md`). Not committed.

## Failure inventory
No real-learner evidence (no demonstrations, misconception, remediation or earlier eval-report files for coordinate-graph). Documented = the catalog's `commonStruggles` (x and y swapped, negative directions, slope from two points, slope and intercept confused); synthetic = the journey's scripted wrong answers and the generator's distractor rules; the rest inferred.

| Mode | Failure (miss) | Class |
|---|---|---|
| plot_point, read_point | x and y swapped (`swapped`) | documented, synthetic |
| plot_point, read_point | a sign flipped (`x_sign`, `y_sign`, `both_signs`) | documented, synthetic |
| plot_point, read_point | one direction only (`one_axis`), one step off (`off_by_one`), elsewhere (`wrong_point`) | inferred / generator distractor |
| find_slope | run over rise (`reciprocal`, `negative_reciprocal`), sign lost (`opposite_sign`) | documented, synthetic |
| find_slope | one leg only (`rise_only`, `run_only`), other (`wrong_slope`) | inferred |
| find_intercept | the slope given (`slope_instead`) | documented, synthetic |
| find_intercept | sign (`opposite_sign`), x-axis crossing (`x_intercept`), a marked point's height (`point_y`), one off (`off_by_one`), other | generator distractors, inferred |

## Lever table (built, `coordinateGraphLevers.ts`)

| Mode | Lever | Kind | Answers | Leak rule (code) |
|---|---|---|---|---|
| plot, read | axis_guide | help, shown | swapped, signs, one_axis | words and sign patterns only, no digit |
| plot, read (where a line is unnumbered: every 4-quadrant grid, or the hard tier) | every_line | help, shown | off_by_one, one_axis, wrong_point | axis numbers only; never offered where the key is a lone number |
| read (where not drawn) | drop_lines | help, shown | off_by_one, one_axis, swapped, wrong_point | lines, no number |
| plot, read | model_point | help, both | every miss | a different point, no magnitude shared with the key, not a choice on screen |
| slope (hard tier) | rise_run_triangle | help, shown | reciprocal, negative_reciprocal, rise_only, run_only | no number |
| slope (medium, hard) | unit_steps | help, shown | rise_only, run_only, reciprocal, wrong_slope | ticks, no number |
| slope | slope_frame | help, both | every miss | definition in words, no digit |
| intercept (hard tier) | crossing_marker | help, shown | point_y, x_intercept, slope_instead, off_by_one, wrong_intercept | a question mark |
| intercept | intercept_frame | help, both | slope_instead, x_intercept, point_y, opposite_sign | definition in words, no digit |
| slope, intercept | model_line | help, both | every miss | an inset line whose caption holds no number with the key's value |
| every mode | simpler_item | simplify | every miss | same mode; smaller point (magnitudes up to 3, same quadrant), small reduced slope of the same sign with the triangle labelled, or a slope-one line crossing near its first marked point with the crossing marked; own id, ask, points and answer; the item's key never among its choices (`practiceLeaks`) |

Starting position: the existing tier flags (axis numbers, drop lines, triangle and its labels, crossing marker). A lever that re-draws an aid is offered only where the tier withheld it; no new tier code.

## Gates
- `typecheck:lumina` 0; full `tsc` 770 (baseline 770).
- `coordinateGraphLevers.test.ts` 26/26 (simplify builder over 4 tiers x 10-11 shapes per mode on both grids; leak rules per mode; every miss answered on every item; miss -> lever table), `CoordinateGraph.levers.workspace.test.tsx` 4/4, `CoordinateGraph.workspace.test.tsx` 10/10; with workspaceContract, misses, lessonWorkspacePlan, activityContract, pip surface, oracles, sourceControlBytes: 3129/3129.
- Sweep `coordinate-graph`: 4 payloads, 20 items, 0 findings J1-J13; lever inventory: every catalog miss answered on every mode, 0 open.
- Replay (`replay/coordinate-graph-2026-10-09-r3.json`, 4 x 5): 1 miss, `no_fix_before_try` on slope "stuck": "Put the labeled rise of 3 over the run of 6, and see which fraction that simplifies to". Guidance now says, on a slope, ask which number goes on top and never say the fraction. `-r4.json`: 0 misses on every check, including `no_change_before_receipt`. Read by hand: on "I'm stuck" the tutor pulls a lever itself (20/20: axis_guide, drop_lines, model_point, slope_frame, intercept_frame, model_line) and describes it after the call; slope replies now ask which number is the rise.

## Failures with no lever
None. A zero-slope item, a small point, a small reduced slope and an intercept item with a marked point on the y-axis have no simplify lever (already that simple); their misses are answered by help levers.

## Open
- Browser check on the lever pictures: the axis guide's position, the example point's label, the inset, the tick marks. JSDOM tests read the SVG text, `data-lever` and the scene facts.
- The payloads carry no tier, so the sweep never offers rise_run_triangle, unit_steps or crossing_marker; the unit and mounted tests cover them on hard-tier items. A hard-tier payload (`save_payload.py --difficulty hard`) would put them in the sweep.
