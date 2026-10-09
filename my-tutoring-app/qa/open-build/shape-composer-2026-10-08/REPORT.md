# shape-composer `free-create`: open build (OB-9M), 2026-10-08

`free-create` upgraded in place, as pattern-builder `create` was. Before: "always passes with 2+ shapes", a mode
that taught nothing. Now the learner composes their own picture from a stated recipe of shapes and code judges it.

## What changed
- **Ask (code-written, no model call):** "Make your own picture with two triangles and one square. Every shape must
  touch another shape." The recipe is also drawn as shape icons under the ask, for pre-readers. Four distinct recipes
  per session, totals rising: K 2,3,3,4 pieces from triangle/square/rectangle/circle; grade 1 3,4,4,5 with a
  hexagon, trapezoid or rhombus on items 3-4. (`shapeComposerBuild.ts` `buildRecipes`.)
- **Judge (code, at "I'm done!"):** exact shapes asked, no piece substantially on top of another (>20% of the
  smaller), and every piece touching so they make one composite (K.G.6, 1.G.2). Misses: `missing_piece`,
  `extra_piece`, `overlapping`, `not_touching`. The words name the problem, never which piece to add or move.
- **Surface:** the palette offers every shape the grade knows (choosing the asked ones is part of the task). New
  pieces land in open space. A drop within 16 units of another piece slides over until they touch. Start over +
  I'm done!; a miss keeps the build.
- **Drag fix (all modes):** pointer events (touch now works) and pointer -> canvas through `getScreenCTM`. The canvas
  is letterboxed (`maxHeight: 350` on a wider box), so the old `rect.width / 400` scale put a dragged piece away from
  the pointer on any wide screen.
- **Watcher:** `useBuildWatcher`, `numbers: 'never'`, `made` = the placed kinds, `neverSay` touch/list/verdict words.
- **Registry:** catalog mode relabelled "Free Create (Open build)", β -1.0 -> -0.3 (now judged; sits between
  compose-match -0.5 and compose-picture 0.0), backend `PROBLEM_TYPE_REGISTRY` matched. Catalog guidance: describe
  the picture, never say how many shapes are on the board or which piece to add.
- **Older payloads** with no `recipe` keep the any-two-shapes check.

## Gates
| Gate | Result |
|---|---|
| `typecheck:lumina` | 1 error, in `liveJourneySpec.ts:2313` (peer session's pattern-builder lever work); 0 in touched files |
| vitest: `shapeComposerBuild.test.ts`, `ShapeComposer.build.test.tsx`, surface test, catalog suites | 127/127 |
| headless drive (`drive.mjs`, `drive.json`, `shots/`) | 14/15 |

Drive: recipe shown, empty board -> recipe + an extra shape -> `extra_piece` -> remove it -> pieces apart ->
`not_touching`, build kept -> drag into a row (magnet joins) -> pass. Item 2: stack one on another -> `overlapping`
-> row -> pass. Watcher 3/3 lines kept, all clean ("Ooh, bright blue squares are starting to form a wide shape!").
The failed check: svg `rx/r "undefined"` console errors, which also appear on an untouched compose-match load, so
they predate this slice.

## Not done / open
- **No levers.** shape-composer is a legacy primitive (no `teachingWorkspace`), so no misses/levers/JEV. Its
  next layer is `/add-live-tutor-tools` (bind the workspace), then `/add-support-tiers` (help: a ghost of one
  touching pair; simplify: the same recipe one piece smaller).
- The svg `undefined` console errors (pre-existing, source not traced).
- No Live run; the legacy tutor gets the miss words through `sendText`.
