# function-sketch — support levers, 2026-10-09

Built on the W1 binding (`qa/tutor-reports/function-sketch-w1-2026-10-09.md`). Not committed.

## Failure inventory
No real-learner evidence (no demonstrations, misconception or earlier eval files for function-sketch). Documented = the catalog's `commonStruggles` (roots confused with extrema, points too close together, families not told apart); synthetic = the journey's wrong answers; the rest inferred.

| Mode | Failure (miss) | Class |
|---|---|---|
| classify | families confused (all six misses) | documented, synthetic |
| compare | the other curve (`other_curve`) | synthetic |
| identify | a root, turning point, intercept or asymptote not found | documented (roots vs extrema), synthetic |
| sketch | upside down; a zero, peak, intercept or end missed | documented (point placement), synthetic, inferred |

## Lever table (built, `functionSketchLevers.ts`)
| Mode | Lever | Kind | Answers | Leak rule (code) |
|---|---|---|---|---|
| classify | family_gallery | help, both | every miss | a parent shape per choice, under the choice's own name; never the item's curve; every choice gets one |
| classify, compare (where a curve turns or crosses) | turn_marks | help, shown | classify: line_for_curve, polynomial_degree, periodic_family, wrong_family; compare: other_curve | dots only, no label, both curves alike |
| classify, compare | equal_steps | help, shown | classify: line/curve, growth; compare: other_curve | risers only, no number, both curves alike |
| identify | feature_guide | help, both | every miss | definitions in words, no place |
| identify (root or intercept asked) | axis_glow | help, shown | missed_root, missed_intercept | axes only, nothing on the curve |
| identify (tier hid names) | feature_names | help, shown | every miss | kinds only, no place |
| identify | model_features | help, both | every miss | a different curve; refused where it would sit on an item feature or is the item's function |
| sketch | sketch_steps | help, both | every miss | order of anchors in words, no number |
| sketch | flip_model | help, both | upside_down, missed_peak, missed_trend | y = x² beside y = -x²; refused where the item is one of them |
| every mode | simpler_item | simplify | every miss | classify: a textbook curve of a family that is not the key's, two far choices, the key's family never among them; compare: a far-apart pair with a different question; identify: a parabola with two ringed, named features, none at an item feature; sketch: a parabola with its crossings and turning point written out, not the item's function. Own `~simpler` id, ungraded |

When/does text has no digit (`leverTextLeaks`). Starting positions are the existing tier flags (feature rings and names, sketch expression and description); feature_names re-shows a tier-withheld aid only where the tier withheld it. No new tier code.

## Gates
- `typecheck:lumina` 0; full `tsc` 770 (baseline 770).
- `functionSketchLevers.test.ts` 36/36 (every miss answered on every hand-built item; no digit in when/does; miss -> lever; the turn dots and staircase; simplify on every item: same mode, own id, solvable by the row, wrong input refused, never the key), `FunctionSketch.levers.workspace.test.tsx` 4/4, `FunctionSketch.workspace.test.tsx` 8/8.
- Sweep (4 payloads): J1-J13 0 findings; inventory: every miss on every mode answered by 2-4 levers, 0 open.
- Replay (`replay/function-sketch-2026-10-09-r3.json`, 4 x 5): 0 misses on every check, including `no_change_before_receipt` and the lever moment. Read by hand: on "I'm stuck" the tutor pulls a lever itself (family_gallery, equal_steps, feature_guide, sketch_steps, once simpler_item) and describes it after the call.

## Failures with no lever
None.

## Open
- Browser check on the canvas overlays (staircase, dots, bright axes) and the gallery and model insets: JSDOM has no canvas, so the tests read the captions, `data-lever` and the scene facts.
- Since names show only at the easy tier, feature_names is offered on every no-tier, medium and hard identify item (the sweep now pulls it on the saved payload, J13 0 findings).
