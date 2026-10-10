# slope-triangle — support levers, 2026-10-09

Built on the W1 binding (`qa/tutor-reports/slope-triangle-w1-2026-10-09.md`). Not committed.

## Failure inventory
No real-learner evidence (no demonstrations, misconception, remediation or earlier eval-report files for slope-triangle). Documented = the catalog's `commonStruggles` (rise and run confused, negative slope, slope thought to change with triangle size, an unreduced fraction); synthetic = the journey's scripted wrong answers; the rest inferred.

| Mode | Failure (miss) | Class |
|---|---|---|
| identify_slope | rise and run exchanged (`swapped`) | documented, synthetic |
| identify_slope | rise sign lost, run negative (`rise_sign`, `run_sign`) | documented, synthetic |
| identify_slope | the slope typed as rise over one, not this triangle's legs (`same_ratio`) | documented (slope vs triangle size) |
| identify_slope | one leg miscounted (`rise_off`, `run_off`), other (`wrong_legs`) | inferred |
| calculate | run over rise (`reciprocal`, `negative_reciprocal`), sign lost (`opposite_sign`) | documented, synthetic |
| calculate | one leg only (`rise_only`, `run_only`), other (`wrong_slope`) | inferred |
| draw_triangle | checked at the start size (`not_resized`), one step off (`off_by_one`), other (`wrong_run`) | synthetic, inferred |

An unreduced fraction is not a miss: the check compares by value, so 4/6 counts for 2/3.

## Lever table (built, `slopeTriangleLevers.ts`)

| Mode | Lever | Kind | Answers | Leak rule (code) |
|---|---|---|---|---|
| every mode (where the tier hid the ticks) | count_ticks | help, shown | identify: leg misses, same_ratio; calculate: rise_only, run_only, wrong_slope; draw: off_by_one, wrong_run | ticks, no number |
| identify | leg_names | help, shown | swapped, run_sign, same_ratio, wrong_legs | the words rise and run on the legs; no number, no direction |
| identify | sign_frame | help, both | rise_sign, run_sign | the sign rule in words, no digit |
| calculate (where the tier hid them) | leg_labels | help, shown | rise_only, run_only, wrong_slope | the legs' lengths, as the easy tier prints them; the learner still forms and reduces the ratio |
| calculate | formula_frame | help, both | reciprocal, negative_reciprocal, rise_only, run_only, opposite_sign | badge and rule in words, no digit |
| draw | build_frame | help, both | not_resized, off_by_one, wrong_run | which leg is the run and which corner changes it, no digit |
| identify, calculate | model_triangle | help, both | every miss | a triangle on another line, same sign; no caption number the size of the item's rise, run, slope or its turn-over; slope not the item's |
| every mode | simpler_item | simplify | every miss | identify: run 2 (or 1), ticks on; calculate: legs already reduced, labelled; draw: target run one shorter; another line, same sign; never the item's legs, slope or target (`practiceLeaks`); refused where the item is already that small |

Starting position: the existing tier flags (`showGridCountOverlay`, `showRiseRunLabels`, `showFormulaReminder`); a lever that re-draws an aid is offered only where the tier withheld it. No new tier code.

## Gates
- `typecheck:lumina` 0; full `tsc` 770 (baseline 770).
- `slopeTriangleLevers.test.ts` 14/14 (every pool pair x run x 3 tiers per mode: no digit in when/does, every miss answered by a help lever on every item, the model always built and leak-free, the simplify builder same-mode, in view, adapter-valid and deterministic, the miss -> next lever table), `SlopeTriangle.levers.workspace.test.tsx` 4/4, `SlopeTriangle.workspace.test.tsx` 8/8; with workspaceContract, journeySweep, misses, lessonWorkspacePlan, activityContract, pip surface, slope-triangle oracle, sourceControlBytes: 3548/3548.
- Sweep `slope-triangle`: 3 payloads, 15 items, 0 findings J1-J13; lever inventory: every catalog miss answered on every mode, 0 open.
- Replay (`replay/slope-triangle-2026-10-09-r2.json`, 3 x 5): 0 misses on every check, including `no_change_before_receipt`. Read by hand: on "I'm stuck" the tutor pulls a lever itself (15/15: sign_frame, formula_frame with model_triangle, build_frame or count_ticks) and describes it after the receipt; calculate asks which number goes on top; identify asks whether the line goes up or down.

## Failures with no lever
None. Items with a run of 2 and a rise of 2 or less (identify), legs already reduced and 3 or less (calculate), or a target run of 2 (draw) have no simplify lever; their misses are answered by help levers.

## Open
- Browser check on the lever pictures: leg names on the canvas, the tick overlay, the worked-triangle inset, the frames' position.
- The saved payloads carry no tier, so leg_labels never appears in the sweep (the no-tier calculate card prints its legs); the unit and mounted tests cover it on hard-tier items.
- draw_triangle's task weakness (W1 finding 1) limits what its levers can teach: the run is printed beside the target.

## Update: draw_triangle levers after the rebuild
draw now builds the rise too and is credited for any triangle that fits the line (W1 report, Update). Its misses are `flat`, `wrong_sign`, `swapped`, `rise_off`, `wrong_ratio`; its levers:

| Lever | Kind | Answers | Leak rule |
|---|---|---|---|
| count_ticks (where withheld) | help, shown | rise_off, wrong_ratio | ticks on the learner's own legs, no number |
| build_frame | help, both | every miss | rise = slope x run and the falling-line rule in words, no digit, no target |
| model_triangle | help, both | every miss | another line's slope with a run and the rise it needs; no caption number the size of the item's example rise, run, slope or its turn-over |
| simpler_item | simplify | every miss | a line with a whole-number slope (1 or 2, same sign), not the item's slope; refused where the item's slope is already plus or minus one |

`SlopeTriangle.levers.workspace.test.tsx` adds "draw: no lever prints a run or a rise to build". Sweep J9/J12/J13 0 findings; every draw miss answered (lever inventory). Replay `-r3`: stuck pulls build_frame 5/5, described after the receipt.
