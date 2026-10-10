# function-sketch — W1 workspace binding, 2026-10-09

Plain shape (P), batch C20. Not committed.

## Modes and what code checks
| Mode | Learner action | Check (code, `checkWork`) | Misses (`functionSketchMiss`) |
|---|---|---|---|
| classify-shape | tap a family, Check | chosen === `correctType` | line_for_curve, curve_for_line, polynomial_degree, growth_family, periodic_family, wrong_family |
| compare-functions | tap a curve's button, Check | chosen === `correctCurve` | other_curve |
| identify-features | tap features on the canvas, Check | every feature found (80% rule; with 2-4 features that is all) | first one not found: missed_root, missed_extremum, missed_intercept, missed_asymptote |
| sketch-match | tap points on the empty canvas, Check | weighted key-feature match of the spline >= 60 | upside_down (the flipped sketch would pass), else the heaviest missed key feature: missed_peak, missed_zero, missed_intercept, missed_trend |

No key reaches the tutor: no family, curve letter, feature place or key feature. On the workspace path a wrong check shows "Not quite." only (the scripted path still prints the answer and the green reveal curve, then moves on); Next is hidden; the canvas, choices, Clear and Check close while a checked answer waits.

## Fixed on both paths
- Canvas taps register on pointer down (was `onClick`, which the driver's strokes never fire).
- Generator: classify drops an item whose choices repeat or whose key contradicts the drawn curve (straight vs not), replaces an instruction that names the key, and gives a classify session a plain context (the context described item 1: "oscillatory reaction potential" beside a sinusoid) and a title that names no key's family. Compare: labels that carry a formula or a function name ("Model B: g(x) = 2^x" beside "which is exponential?") become plain letters, and where labels are only letters the answer is put on A or B at random (5 of 5 generated answers were B). Identify keeps only features on the plotted axes. Sketch drops an item whose own curve, sketched, would fail the check.
- Adapter `validateFunctionSketchData` refuses the same.

## Gates
- `typecheck:lumina` 0; full `tsc` 770 (baseline 770).
- `FunctionSketch.workspace.test.tsx` 8/8. With misses, activityContract, lessonWorkspacePlan, pip surface, oracles, sourceControlBytes: 522/522.
- Sweep (4 payloads, 19 items): J1-J13 0 findings, 19/19 misses named; workspaceContract 17/17 for the id.
- Replay 4 x 5: run 1 (`replay/function-sketch-2026-10-09.json`) 3 `no_protocol_leak` ("press Check Answer", the shared pattern) and, read by hand, classify replies describing the curve as a "repeating wave" (from the leaky context and the tutor guessing). Fix: guidance and scene say "Check", guidance says the tutor does not see the curves and never describes one; classify context made plain. Run 2 (`-r2.json`): 0 misses on every check; replies ask about ends, turns and crossings.

## Undriven modes
None. Every mode drives through its real controls.

- identify-features with no tier named every feature on screen (ring labels and the list below), so the learner confirmed rather than found. Names now show only where `showFeatureLabels` is true (the easy tier); no tier behaves as medium (unnamed rings), and the `feature_names` lever is how names appear otherwise. Checked the other modes for a no-tier giveaway: classify shows only the choices, compare's labels are letters or the model's words with formulas stripped, sketch shows the description and expression that are the task. None found. Re-run after the fix: tests, sweep J1-J13 0 findings, typecheck 0, sourceControlBytes pass, replay identify-features 1 x 5 (`-r4.json`) 0 misses.

## Open
- compare-functions questions are often about one contrast (exponential vs polynomial) across a lesson: answer variety is topic-driven, not fixed here.
- classify-shape's key is still the model's word for a curve it drew; only the straight/curved contradiction is checked in code.
- Browser check on canvas tapping (pointer down) and the hidden reveal after a wrong sketch: HUMAN-CHECKS #167.
