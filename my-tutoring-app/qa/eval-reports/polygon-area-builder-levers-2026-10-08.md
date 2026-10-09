# polygon-area-builder levers: decompose, trapezoid, composite, coordinate (2026-10-08)

`/add-support-tiers`, class sweep (lever-table confirmation waived by the user). find_area_triangle_parallelogram,
build_area and build_perimeter already had levers; this adds the other four typed-area modes.

## Failure inventory

Evidence: there is no real-learner evidence (observed-real is empty). No demonstrations, misconception reports or
remediation module mention this primitive. One tutor sweep (`qa/tutor-reports/sweep-2026-07-08.json`) lists it, but
it says nothing about misses. Sources used: the catalog `commonStruggles` (documented), `areaMiss` patterns and the
journey row's scripted wrong answers (synthetic), and reasoning (inferred).

| Mode | Miss (checked) | Class |
|---|---|---|
| decompose | `halved`, `added_sides`, `wrong_area`; cannot find the slot (not a check) | inferred / synthetic |
| find_area_trapezoid | `forgot_half` (the bases added together times the height, with no ½) | documented ("Adding the two trapezoid bases without halving") |
| find_area_trapezoid | `added_sides`, `wrong_area` | inferred |
| composite_area | `one_piece` (the area of one piece only), `wrong_area` | documented (double-counting, decomposition) |
| composite_area | `halved` | synthetic (journey wrong = E/2) |
| coordinate_polygon | `bounding_box` (the rectangle around the polygon) | inferred |
| coordinate_polygon | `halved`, `wrong_area` | synthetic / inferred |

The catalog listed `forgot_half` for coordinate_polygon, but `areaMiss` can never return it there: a coordinate
triangle's base × height is named `bounding_box`. It is removed from the catalog list (a comment explains why).

## Lever table (built)

| Mode | Lever | Kind | Answers | Leak rule | Starting position |
|---|---|---|---|---|---|
| decompose | `show_slot`: the dashed slot where the cut triangle fits | help | (no checked miss) | draws an outline only; refused once the rectangle is made | pulled at easy/medium (tier guides) |
| decompose | `unit_grid` | help | halved, added_sides, wrong_area | no square numbered or counted | none |
| decompose | `smaller_figure`: a smaller parallelogram leaning one square, with the slot and grid drawn | simplify | halved, added_sides, wrong_area | b×h smaller, area differs, never the item | — |
| trapezoid | `unit_grid` | help | added_sides, wrong_area | as above | easy |
| trapezoid | `cut_lines`: dashed lines down from the top corners | help | added_sides, wrong_area | no length or area | easy |
| trapezoid | `turned_copy`: a copy turned upside down against the right side, with the parallelogram the two make outlined | help | forgot_half, wrong_area | no number; the fact describes what is drawn and never says "half" or "twice" | none |
| trapezoid | `smaller_figure`: a smaller right trapezoid on the grid | simplify | forgot_half, added_sides, wrong_area | area smaller and differs | — |
| composite | `split_pieces`: the rectangle pieces drawn and labelled | help | halved, wrong_area | piece sides only (givens), no piece area | easy/medium |
| composite | `left_out_piece`: the piece(s) the last area left out, outlined bold | help | one_piece | outline only; refused unless the last checked area was one piece's area | none |
| composite | `square_rows`: every other row of squares tinted | help | halved, wrong_area | no row or square counted | none |
| composite | `smaller_figure`: a smaller two-piece L, its pieces drawn | simplify | one_piece, halved, wrong_area | area smaller | — |
| coordinate | `outside_box`: the rectangle through the outermost corners, with the part outside the polygon tinted | help | bounding_box, halved, wrong_area | no length or area; triangle and L only | none |
| coordinate | `square_rows` | help | halved, wrong_area | rectilinear polygons only (rectangle, L) | none |
| coordinate | `rectangle_first`: a rectangle on the grid | simplify | bounding_box, halved, wrong_area | area differs from the item's and from its box | — |

Coverage was checked per item, not per mode. A coordinate rectangle is already the plainest polygon, so it has no
simplify lever, and `bounding_box` cannot happen on one; `square_rows` answers its `halved` and `wrong_area`. On easy
trapezoids the grid and cut lines start pulled, so `added_sides` falls to `smaller_figure`. The `unanswered` list
gets no entries: every miss the check can name has an open lever on every generated item (unit-tested over 240
generated items per mode across all tiers).

## What was built

- `polygonAreaLevers.ts`: declarations, facts, leak rule (`figureLeverLeaks` now bans each mode's area and one-step
  products), simpler-item builders (`smallerFigure` dispatches by mode, `~smaller` id), and geometry (`outsideOfBox`,
  `squareRows`, `leftOutPieces`, the turned-copy overlay, `overlayPoints`).
- `PolygonAreaBuilder.tsx`: the canvas draws the new overlays (rows, bold outlines, the turned copy). The view grows
  to fit the copy. Runtime pulls turn on the tier-only guides (slot, cut lines, split pieces). `left_out_piece` reads
  the pieces the last check left out. A simplify pull resets the decompose drag. Each lever has a caption
  (`data-lever`).
- Catalog: dropped the unreachable `forgot_half` from coordinate_polygon's misses.
- The journey row needs no change: it already rebuilds `~smaller` items with `smallerFigure`, which now covers these
  modes. The generator needs no change: the tier flags it already writes are the starting positions.
- There is no contract doc (`docs/contracts/polygon-area-builder.md`) for this primitive. Levers change only what is
  drawn while pulled; tier defaults, checks and the generator are unchanged.

## Tests

- `polygonAreaLevers.modes.test.ts` (new, 26): checks the leak rule and that no lever text prints a number, on
  generator items at every tier. Also covers per-item miss coverage per mode, each simplify builder, the drawn
  geometry (copy area = item area, box minus outside = polygon, rows cover the figure exactly) and the
  `nextLever` tables.
- `PolygonAreaBuilder.levers.modes.workspace.test.tsx` (new, 4, mounted). Trapezoid: `forgot_half` then
  `turned_copy` changes the screen and the fact in one commit, refused pulls change nothing, and the retry is
  credited with the lever recorded. Composite: `left_out_piece` is refused before a one-piece answer and outlined
  after one. Coordinate triangle: after `bounding_box`, `outside_box` is pulled, then `rectangle_first` opens an
  ungraded practice item, and the full item comes back blank and is credited. Decompose (hard): the slot lever is
  drawn, and the smaller parallelogram opens with its slot.
- All 11 polygon-area / oracle / pip / plan test files pass (155 tests).
- `typecheck:lumina`: 0 errors in these files. The one remaining error is in `hundredsChartLevers.test.ts`, which a
  sibling agent is editing.

## Not verified here

- The canvas is not painted under jsdom, so the drawings are checked as geometry plus captions. The new overlays
  still need a browser check, especially the trapezoid view after it grows to fit the turned copy.
- The decompose drag is not driven by the journey row or the tests, so a decompose retry after a pull has not been
  exercised.
- Batch verify owns the journey sweep, tutor replay and Live runs.
