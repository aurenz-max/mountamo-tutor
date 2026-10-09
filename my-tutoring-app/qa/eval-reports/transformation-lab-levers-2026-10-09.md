# transformation-lab — support levers, 2026-10-09

Built on the W1 binding (`qa/tutor-reports/transformation-lab-w1-2026-10-09.md`). Not committed.

## Failure inventory
No real-learner evidence (no demonstrations, misconception, remediation or earlier eval reports for transformation-lab). Documented = the catalog's `commonStruggles` (wrong axis, rotation direction, a dilation called congruent); synthetic = the journey's scripted wrong answers; the rest inferred from the task.

| Mode | Failure (miss) | Class |
|---|---|---|
| translate/reflect | slide the other way, numbers swapped, one number applied (`opposite_shift`, `swapped_shift`, `one_axis_shift`) | synthetic, inferred |
| translate/reflect, identify | wrong mirror line (`wrong_axis`) | documented, synthetic |
| rotate, identify | turned the other way (`wrong_direction`), another angle (`wrong_angle`), flipped instead (`reflected_instead`) | documented, synthetic |
| identify | the other family named (`reflection_for_rotation`, `rotation_for_reflection`) | inferred |
| dilate | factor added (`added_factor`), another factor, one axis scaled | documented (similar vs congruent), synthetic |
| drag modes | some corners placed (`partly_placed`), shape broken (`shape_changed`), right shape elsewhere (`misplaced`), nothing moved (`unmoved`) | inferred |
| compose | faces the wrong way (`orientation_off`), right way but off target (`position_off`), no move (`unmoved`) | synthetic, inferred |

## Lever table (built)

| Mode | Lever | Kind | Answers | Leak rule |
|---|---|---|---|---|
| drag modes | corner_letters | help | partly_placed, shape_changed | letters only |
| drag modes | model_point | help | the mode's signature misses, unmoved, misplaced | P and P′ are not corners of the pre-image or image (`modelPointLeaks`) |
| drag modes | pre_coords (when the tier hid them) | help | partly_placed, misplaced | pre-image only |
| drag modes | rule_card (when no card is on screen) | help | signature misses, partly_placed, misplaced | the rule, no image corner (`leverTextLeaks`) |
| dilate | origin_rays | help | shape_changed, one_axis_scaled, added_factor, misplaced | no point on a ray marked |
| drag modes | simpler_figure | simplify | signature misses, partly_placed, shape_changed, misplaced | same motion, smaller triangle, no shared corner (`practiceLeaks`) |
| identify | corner_letters | help | all five | letters only, no option marked |
| identify | motion_models | help | all five | a six-corner model flag, one picture per option, none marked |
| identify | pre_coords (when hidden) | help | wrong_axis, wrong_direction, wrong_angle | pre-image only |
| identify | two_choices | simplify | all five | another motion on another figure; the item's answer not among its two options |
| compose | motion_models | help | orientation_off, unmoved | model flag per palette flip/turn, none marked |
| compose | target_coords | help | position_off | target corners (drawn by design); no move named |
| compose | corner_letters | help | orientation_off, position_off | letters only |
| compose | simpler_target | simplify | all three | another flip/turn and another one-square slide |

identify never gets model_point or rule_card: there the motion is the answer. Help levers draw on the canvas and add a one-line legend in the DOM (`data-lever`); motion models are SVG beside the grid. Starting positions are the existing tier's pre-image labels and rule card; no new tier code.

## Gates
- `typecheck:lumina` 0; full `tsc` 770 (baseline).
- `transformationLabLevers.test.ts` 31/31 (builders over every generator placement, >90% built per mode; leak rules per mode; every miss answered on every item with and without the tier aids; miss → lever table); `TransformationLab.levers.workspace.test.tsx` 7/7; `TransformationLab.workspace.test.tsx` 11/11.
- Sweep with `workspaceContract`, `misses`, `lessonWorkspacePlan`, `activityContract`, Pip surface, `sourceControlBytes`: 10 files, 3402 passed. transformation-lab: 5 payloads, 0 findings J1-J13; lever inventory: every miss answered on every mode.
- Replay (`replay/transformation-lab-2026-10-09-r4.json`, 5 x 5): 0 misses on every check, including `no_change_before_receipt`. Read by hand: lever replies describe the change in the lever's words (P and P′, rays, model flags, letters) and ask the learner to act; none gives an image corner or names identify's answer.

## Failures with no lever
None.

## Open
- Browser check of the canvas drawings (letters, model point, rays, target labels) and the motion-model pictures; JSDOM only.
