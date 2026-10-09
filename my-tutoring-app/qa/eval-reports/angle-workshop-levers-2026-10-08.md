# angle-workshop levers, 2026-10-08/09 (measure, classify_pairs, solve_unknown, solve_algebraic, transversal)

Class sweep (user opt-in 2026-10-08, Phase 2 stop waived): table designed and built in one pass. make_angle's levers
(built earlier) are unchanged. Every mode of angle-workshop now has a miss function and levers.

## Failures (evidence)
No real-learner evidence. Demonstration logs, tutor reports, misconception reports, remediation modules: none for
angle-workshop. No `docs/contracts/angle-workshop.md` exists.
- **documented**: catalog `commonStruggles` "adds to 90 when the angles lie on a straight line" (`total_90`), "solves
  for x but submits the wrong quantity" (`typed_an_angle`), "calls a straight-line pair vertical" (`chose_vertical`);
  the legacy ANSWER_INCORRECT text ("using 90 where 180 is needed"); the generator's measure ladder (inner vs outer
  scale: `other_scale`).
- **synthetic**: the journey's wrong program (+20°, x + 3, first other relationship) gives `far` / `chose_*`.
- **inferred**: copying a labeled angle, leaving one known out around a point or in a triangle, adding the two triangle
  angles, finding the triangle's own corner instead of the exterior angle, arithmetic slips (`near`).

**Corrupted evidence, fixed first:** transversal `alternate_exterior` drew the marked angle INTERIOR (lower-right at the
top crossing) and x at the lower crossing's lower-left. By the drawing, x was the marked angle's supplement while the
key said equal: a learner reading the figure correctly was marked wrong. The canvas now draws the marked angle exterior
(upper-right) on that relation, which makes x its true alternate exterior partner. Render-only; needs a browser look.

## Lever table
| Mode | Misses (class) | Lever | Kind | Leak rule (code) |
|---|---|---|---|---|
| measure | other_scale (doc), near, far (synth) | `tens_labels`: places the protractor, numbers the scale every 10° from 0 at the bottom ray up to the last ten ≥5° short of the ray | help | `tensLeak`: no label at or within 5° of the reading |
| measure | other_scale, far | `simpler_item`: an acute angle on a ten, ≥10° from the reading and its other-scale reading | simplify | `practiceLeaks` |
| classify_pairs | chose_* (doc, synth) | `benchmarks`: dashed rays at 90° and 180° from the vertex along the bottom ray, same on every figure | help | identical on every item; fact names no relationship |
| classify_pairs | chose_* | `simpler_item`: a pair of ANOTHER relationship, two choices, neither the item's answer | simplify | `practiceLeaks` (answer and choices exclude the item's relationship) |
| solve_unknown | total_90/180/360 (doc), copied_known, one_known_left, far | `whole_angle`: dashed arc over the whole the angles fill; vertical: one arc over each straight line through the unlabeled neighbour | help | arcs only, no number; fact names no total |
| solve_unknown | around: one_known_left, total_*, near, far; comp/supp: near | `simpler_item`: around a point → two angles on a line; comp/supp → a known on a ten | simplify | `practiceLeaks` |
| solve_algebraic | total_90/180 (doc) | `whole_angle` (as above, on the expression figure) | help | as above |
| solve_algebraic | typed_an_angle (doc), total_*, near, far | `try_your_x`: the learner's own last wrong x put into each label, with the angles it makes; offered only after a wrong x | help | `tryYourX` null on the key; only the learner's number |
| solve_algebraic | all | `simpler_item`: unit coefficients (summed), or 2x + b and x + b′ (vertical) | simplify | `practiceLeaks`, x ≠ item's |
| transversal (alt int / alt ext / co-int) | supplement_given, copied_given, near, far | `slide_copy`: dashed copy of the marked angle at the lower crossing, same place against the lines | help | `slideLeaks`: never on x's place |
| transversal (corresponding) | same | `straight_arcs`: dashed half-circle under the line at each crossing, across marked / x and its neighbour | help | arcs only |
| transversal (triangle sum) | added_givens, one_given_left, copied_given, near, far | `corners_on_line`: the two labeled corners side by side on a straight line, the rest blank | help | only the labels already on the figure |
| transversal (exterior) | found_interior, copied_given, near, far | `straight_at_corner`: half-circle over the base at x's corner, the triangle's own corner there outlined | help | no number |
| transversal | exterior → triangle sum; co-interior → corresponding | `simpler_item` | simplify | `practiceLeaks` |

Starting positions: every lever starts released at every tier. The generator's existing tier scaffolds (reading cue,
perception marks, named relationship, given equation) stay as the starting positions; no generator change.

**No lever by decision:** none new (catalog `unanswered` unchanged: make_angle `not_opened`).
**Per-item gaps (help only, no simpler item; each is already the plainest of its mode):** measure on an acute ten;
solve_unknown vertical or a known on a ten (here `near` has no lever: an arithmetic slip, and the whole-angle arc does
not address it); solve_algebraic with unit coefficients, or vertical 2x/x; transversal corresponding, alternate
interior/exterior, triangle sum. In the saved payloads: measure c2 (70) and c3 (80) help-only; solve_unknown vertical 40
and supplementary 40 help-only.

## Built
`angleWorkshopWorkspace.ts` (`classicMiss`, `CLASSIC_MISSES`, classify `choices` in scene and harness),
`angleWorkshopLevers.ts` (levers for every mode, leak rules, `simplerItem`, `practiceFor`, `practiceParent`, facts),
`AngleLeverOverlay.tsx` (new: the help pictures as an SVG over the canvas), `AngleWorkshop.tsx` (one generic
pull/practice path for all modes, misses on every check, last wrong x, practice label, tens lever places the
protractor, alternate-exterior drawing fix), catalog `misses` for all modes, `liveJourneySpec.ts` row (practice rebuilt
from its parent for `~simpler` and `~coarser`).

## Measured
- vitest: `AngleWorkshop.levers.workspace.test.tsx` 73/73 (miss table; every producible miss answered on every
  generated item except the recorded `near` gap; `nextLever` table; leak rules over ~4,000 generated items at every tier;
  every simpler item solvable, same mode, never the item's answer; mounted per mode: help pull changes screen + `onScreen`
  in one commit, refused pull leaves demand/levers/attempts/HTML unchanged, next attempt records the lever, practice
  ungraded, full item back blank and credited with both levers). With the primitive's other tests
  (workspace, pip surface, oracles, lessonWorkspacePlan): 354/354.
- typecheck:lumina: 0.
- Not run here: journey sweep, tutor replay, Live (batch verify step). Not browser-driven: the SVG overlay's placement
  over the canvas and the alternate-exterior redraw need a browser look.

Ratio: about 480 production lines (levers module, overlay, component, misses) under 346 test lines.
