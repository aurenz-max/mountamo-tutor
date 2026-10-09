# circle-explorer — support levers, 2026-10-09

Built on the W1 binding (`qa/tutor-reports/circle-explorer-w1-2026-10-09.md`). Not committed.

## Failure inventory
No real-learner evidence (no demonstrations, misconception, remediation or eval-report files for circle-explorer). Documented = the catalog's `commonStruggles` (radius and diameter swapped, radius not squared, around vs inside, multiplying where the reverse divides); synthetic = the journey's scripted wrong answers; the rest inferred from each formula.

| Mode | Failure (miss) | Class |
|---|---|---|
| discover_pi | d ÷ C (`inverse_ratio`), a length typed (`typed_length`) | inferred, synthetic |
| circumference | π × r (`pi_times_radius`), 2π × d (`two_pi_times_diameter`) | documented, synthetic |
| circumference | π r² (`area_formula`), no π (`no_pi`) | documented / inferred |
| area | 2πr (`circumference_formula`), π r (`pi_times_radius`), π d² (`diameter_squared`), r² (`no_pi`) | documented, synthetic |
| reverse | C ÷ π (`diameter_not_radius`), times π (`multiplied`), C ÷ 2, A ÷ π (`no_square_root`), A ÷ 2π, √A | documented ("multiplying instead of dividing"), synthetic |
| composite | whole circle, d as r, πr (semicircle area); curve only, whole edge, + r (perimeter); circle, square, added (circle in square) | inferred, synthetic |
| all | near, too high, too low | inferred |

## Lever table (built, `circleExplorerLevers.ts`)

| Mode | Lever | Kind | Answers | Leak rule (code) |
|---|---|---|---|---|
| all (hard tier only) | formula_labels | help | every miss of the mode | formulas only; offered only where `showFormulaReveal` is false |
| discover_pi | ratio_frame | help | inverse_ratio, typed_length, too_high/low | "C ÷ d = <C> ÷ <d> = ?" with the figure's own labels; words for an unlabelled C |
| discover_pi | tenth_marks (after the unroll) | help | near, too | one diameter in ten unlabelled parts beside the leftover |
| circumference / area (given d) / reverse | other_length | help | the radius/diameter swaps | named by letter only (d = r + r, r = half of d) |
| circumference | diameters_around | help | no_pi, area_formula, swaps, near/too | unlabelled bars |
| area | radius_square | help | every area miss | "r × r", caption in words |
| reverse | undo_chain | help + voiced | every reverse miss | symbols only; never r's value |
| composite | whole_circle / trace_edges / shade_corners (per figure) | help | that figure's misses, near/too | captions in words |
| all but discover_pi | simpler_problem | simplify | every miss of the mode | same mode and figure; one step shorter (C from d, A from r, r from C) on a round radius; own id, radius and answer (`practiceLeaks`) |

No lever `when`/`does` or scene fact carries a digit (`leverTextLeaks`); no lever picture carries the answer (`pictureLeaks`). Starting position: the existing tier's `showFormulaReveal` (hard withholds the labels, so `formula_labels` starts released); no new tier code.

## Gates
- `typecheck:lumina` 0; full `tsc` 770 (baseline 770).
- `circleExplorerLevers.test.ts` 26/26 (leak rules over every generator shape, both reveal tiers; simplify builder; miss -> lever table), `CircleExplorer.levers.workspace.test.tsx` 4/4, `CircleExplorer.workspace.test.tsx` 10/10, `sourceControlBytes` pass.
- Sweep `circle-explorer`: 5 payloads, 0 findings J1-J13; lever inventory: every catalog miss answered on every mode, 0 gaps.
- Replay (`replay/circle-explorer-2026-10-09-r2.json`, 5 x 5): 0 misses on every check, including `no_change_before_receipt`. Read by hand: on "I'm stuck" the tutor pulls ratio_frame, other_length, radius_square, undo_chain or whole_circle itself and describes it after the call; 1/5 reverse samples pulled other_length and undo_chain together. None names the answer.

## Failures with no lever
- discover_pi has no simplify lever: π is every circle's answer, so any practice circle would carry the item's answer. Its misses are answered by the two help levers.

## Open
- Browser check on the canvas levers (JSDOM has no canvas; tests read the captions, `data-lever` and scene facts).
- Fixed after review: the `tenth_marks` ruler was clipped after about seven tenths. The discover π track now fits four diameters (`discoverTrack`), so all ten parts are drawn; `circleExplorerLevers.test.ts` asserts the last mark is inside the canvas.
