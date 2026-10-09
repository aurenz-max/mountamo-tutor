# shape-sorter levers — 2026-10-08 (class sweep)

`/add-support-tiers` on the four workspace modes (identify, find_real_object, count, sort). The user waived the "confirm the table first" stop for this sweep, so the table below was built straight away. No contract doc exists for shape-sorter (`docs/contracts/shape-sorter.md`); the levers keep the existing guarantees (the gold ring fixes the item, mats are labelled at every tier, the corner hints never show a number, the asks never contain the answer).

## Failure inventory

| Mode | Miss (id) | Evidence class |
|---|---|---|
| identify | near_name (rectangle at a square, oval at a circle), other_shape_name | documented (catalog `commonStruggles`, `NEAR_SHAPE`), observed-synthetic (harness `signatureWrong`) |
| find_real_object | said_object, near_name, other_shape_name | documented (`i-asked-for-the-shape-not-the-thing` aid), synthetic |
| count | one_short / one_over, short_by_more / over_by_more, said_shape_name | documented (`commonStruggles`, `go-round-once-only`), synthetic |
| sort | said_shape_name, other_group | documented (`commonStruggles`), synthetic |

No observed-real evidence: there are no demonstration logs, tutor reports or misconception runs for shape-sorter. Every miss already had a pure miss list (`shapeSorterSpokenMisses`) and a catalog `misses` entry, so none was added.

## Lever table

| Mode | Lever | Kind | Carrier | Answers | Leak rule (unit-tested) |
|---|---|---|---|---|---|
| identify | `model_shape` | help | both | near_name, other_shape_name | a different shape; never the item's, a shared-name or look-alike shape, or a later item's |
| identify | `plain_drawing` | simplify (practice) | both | near_name, other_shape_name | different shape, upright, large, alone; only when the item is turned >10° off its symmetry or small; never the model or a later shape |
| find_real_object | `outline_only` | help | shown | said_object, near_name, other_shape_name | fades the object's inside details; names nothing; on every item |
| find_real_object | `model_object` | help | both | said_object, near_name, other_shape_name | another object; its shape does not leak the item or any later item |
| count | `model_count` | help | both | said_shape_name, off-by | different polygon; count not within one of the item's, not a later count |
| count | `start_mark` | help | shown | one_short, one_over | one dot on one side/corner; no number |
| count | `touch_marks` | help | shown | said_shape_name, off-by | tap targets that mark; no number |
| count | `fewer_sides` | simplify (practice) | both | off-by | fewer sides, upright, large; never a later counted shape; none on a triangle |
| sort | `mat_pictures` | help | shown | said_shape_name, other_group | drawn from the mat label only (sticks / curved-or-straight stroke / swatch); every mat alike, none marked |
| sort (sides) | `side_ticks` | help | shown | other_group | a tick on each side of the ringed shape; no number |
| sort | `fewer_mats` | simplify (on item) | shown | other_group | greys one wrong mat, three-mat sorts only; never the answer |

find_real_object has no simplify: a bare outline is the identify mode. Starting position: an `easy` sort starts with `mat_pictures` on (not recorded as a pull); other tiers unchanged (count's existing corner hints stay the easy aid).

Per-item coverage on the saved payloads (J12): every checked miss on every item has a lever (unit test `miss → lever, per item`). `model_object` exists only where an object is left after excluding later items (the find_real_object payload uses all six objects, so item 1 has none); `outline_only` covers those items. `model_count` is missing on some count items (the square in the payload: 6 is a later count); `start_mark`/`touch_marks` cover them. `plain_drawing` and `fewer_sides` are offered on items of the saved identify and count payloads (unit-tested); neither exists on an upright, not-small shape or a triangle. `fewer_mats` fires on no saved payload (all payload sorts have two mats); it only exists on three-mat sorts. No catalog `unanswered` entries needed; no rows in `QUEUE-item-gaps-2026-10-09.md`.

## Built

- `shapeSorterLevers.ts` (new): declarations, leak rules, builders, scene facts, `simplerFromId` for the journey row.
- `ShapeSorterTeaching.tsx`: lever state keyed by session item, practice item, `pullLever`/`endPractice`, model card, mat pictures, greyed mat, start/tap marks, side ticks, `onScreen` fact.
- `shapeSorterDrawing.tsx`: `shapeCorners` is the one geometry source; `marks` overlay (ticks, start dot, tap targets).
- `RealWorldShapeObject.tsx`: optional `detailsMuted` prop (default off; DiShapes unchanged).
- Catalog `levers: true`; journey row rebuilds `~simpler` items from the parent.

## Tests

- `shapeSorterLevers.test.ts`: 58 pass (leak rules over random sessions, builders, per-item miss coverage on the payloads, miss → `nextLever`).
- `ShapeSorter.levers.workspace.test.tsx`: 8 pass (pull changes screen + fact in one commit, next attempt records the lever, refused pull changes nothing, practice item ungraded and the full item credited after, easy start not a pull).
- Existing: `ShapeSorterTeaching.test.tsx` (expectation updated: `pull_lever` is now offered), di-script, spoken misses, real-object generator, DiShapes levers, activityContract, lessonWorkspacePlan: all pass. Dry journey filtered to the 4 shape-sorter payloads: pass, no baseline entries.
- `typecheck:lumina`: 0 errors in these files (3 in a sibling's calendarExplorerLevers.ts).

Not run: tutor replay and Live (batch step).
