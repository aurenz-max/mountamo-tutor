# polygon-area-builder `build_perimeter`: open build for perimeter (3.MD.D.8), overnight 2026-10-08

The new mode is built and its gates pass in the worktree: vitest, `typecheck:lumina` 0, the journey sweep and three real generations. It has not been driven in a browser yet. The drive script is ready for the coordinator to run.

It is a real build: no primitive builds perimeter today, and many shapes pass one ask (for a perimeter of 12: 3 by 3, 2 by 4, 1 by 5, an L of five). It is a new mode (a fork); `build_area` is not changed. There is no contract doc for polygon-area-builder.

## What changed
- **Ask (written by code):** "Make a shape with a perimeter of N units." Two-shape items add "Then make a different shape with the same perimeter." N is even, from 8 to 24. Two-shape items are the second half of the session.
- **Judge (code, at "I'm done!")**, in `polygonAreaBuild.ts`:
  - `perimeterOf` counts the sides of shaded squares that no other shaded square covers.
  - `holesIn` flood-fills from outside the shape to find enclosed empty squares.
  - Misses, checked in this order:
    - `not_connected`
    - `has_hole`
    - right perimeter: `same_as_first` (the existing `sameShape` check, all eight turns and flips)
    - wrong perimeter: `counted_squares` (the learner made the area N instead of the perimeter N), otherwise `two_short`, `two_over`, `short_by_more`, `over_by_more`. The smallest step is 2 because a shape made of squares always has an even perimeter.
  - On a miss the verdict names no number and no direction.
- **Surface:** the same `AreaBuildGrid` svg. Tap shades or clears a square, "Clear grid" starts over, "I'm done!" is the only commit (no stillness check). Try again keeps the build. A right first shape is kept and drawn beside the grid, and is not a commit.
- **Watcher:** `useBuildWatcher` with `numbers: 'never'`. Its `made` fact says "one shape / separate pieces" and "with a hole inside it", with no number.
- **Facts the tutor gets:** `sidesAround`, `squaresPlaced`, `separatePieces` and `holes`, all as numbers, plus `learnerWork` and `constraints`. The target is never among them. `workHistory` records a fix such as `14 → 12`.
- **Levers (none on at the start):**
  - `edge_marks` (help): a dot on every outside side, the sides around a hole included, no numbers. The dots are `data-aid`, so they stay out of the picture the watcher sees.
  - `piece_colors` (reused).
  - `turned_first` (reused, two-shape items only).
  - `smaller_perimeter` (simplify): about half the perimeter, even, at least 6, one shape, ungraded.
  - Every catalog miss is answered by a lever.
- **Generator:**
  - Code picks distinct even perimeters, from 8 to 20 by default. `resolveScopeRange` narrows the range to the lesson; the ceiling is 8 to 24.
  - A narrow scope gets fewer items instead of repeats: "up to 12" gives 8, 10, 12, never fewer than 3 items.
  - `targetPerimeter` holds the ask, and `expectedArea` holds the same number.
  - `gradeBand` is '3'. Tier flags are off. The mode is added to the schema enum, `CHALLENGE_TYPE_DOCS`, the valid-types list and the fallbacks.
  - It is left out of the mixed (unpinned) rotation, because it is a perimeter skill and not one of the area tiers.
- **Registry and wiring:**
  - Catalog mode β 2.4, `answers: ['build']`, ordered between `build_area` 1.6 and the triangle/parallelogram mode 2.5. The pictorial area-model perimeter mode is β 3.0.
  - The catalog also has the mode's misses, one guidance sentence and one sentence in the primitive description.
  - Backend `PROBLEM_TYPE_REGISTRY` prior 2.4.
  - The metrics type union.
  - The live adapter accepts the mode.
  - Oracle branch: checks the perimeter is even, in range and equal to the key; that two different rectangles with it fit the grid; that the instruction asks for it; the scope; and clustering.
  - Journey driver branch, and a saved payload `w1-payloads/polygon-area-builder.build_perimeter.json`.
- **Old payloads:** every `build_area` and typed-area path is unchanged; the existing polygon tests still pass.

My changes come to about 440 production lines, 296 test lines, a 107-line probe and a 152-line drive script.

## Gates
| Gate | Result |
|---|---|
| `typecheck:lumina` | 0. The known peer error at `liveJourneySpec.ts:2313` did not appear in this tree. |
| full tsc | 770, the baseline; no error in any touched file |
| `polygonPerimeterBuild.test.ts` (judge: one over, one under, further off, `counted_squares`, hole, pieces, two different passes, turned second refused, verdict words, simplify, oracle) | 8/8 |
| `PolygonAreaBuilder.perimeter.workspace.test.tsx` (flow: empty grid → two over → Try again keeps 10 squares → take a column off → pass with `workHistory` 14 → 12; counted_squares, has_hole, not_connected, then an L passes; two-shape turned refused, then 3 by 3 passes; edge-marks dots 10 → 12, picture clean; simplify to 8 and back) | 7/7 |
| polygon suites, plus the oracle and QA suites | 919 passed |
| live-activity, service and math dirs | 7631 passed, 1 failure, and 1 file that could not load. The train-yard test failed in the full run and passed when run alone. `learningAdaptation.live-contract` cannot load because `artifacts/learning-applicability/report.json` is missing in the worktree. Neither touches this work. |
| journey sweep on the real payload | 4 items, 0 findings, 4/4 misses named; clean run scored 100, recovery run 67 (`qa/open-build/polygon-area-builder-overnight/journey-sweep.json`) |
| real generation (`scripts/polygon-perimeter-build-probe.mjs`, flash-lite) | 3/3 clean on the final run, each item checked by my judge (two different rectangles pass, the first shape again is `same_as_first`, one column narrower is named). Perimeters: g3 [10, 18, 22, 24], scoped "up to 12" [8, 10, 12], plain [10, 12, 14, 16]. The first run of the scoped case repeated 12; that is what led to the item-count fix above. |

## Not done / open
- **No browser drive.** It is written: `qa/open-build/polygon-area-builder-overnight/drive.mjs`. It covers:
  - Item 1: one column over → miss → build kept → take the column off → pass.
  - Item 2: `counted_squares` → a ring (`has_hole`) → pass.
  - Item 3: the first shape turned → `same_as_first` → a taller rectangle passes.
  - Item 4: an L.
  - Watcher leak regex, no horizontal scroll at a 390 px viewport, and the square size in px with the card squeezed to 360.
  - It runs on the tester's scripted path, so it cannot pull levers; the levers are covered by vitest only.
- **No real watcher lines yet.** The drive collects them; the watcher needs a browser to render the svg.
- **Square size at phone width:** about 32 px when the card is 360 px wide, below the 44 px guideline. This is the same grid `build_area` uses, so it is a shared-surface question.
- **Rulings owed:**
  - (a) A shape with a hole is refused (`has_hole`) instead of having its hole sides counted.
  - (b) Should this mode join mixed sessions? I left it out.
  - (c) One β for one-shape and two-shape items.
- No Live run; the tutor's wording on the verdict cue rides the next class Live gate.
- **Merging this worktree:** I copied main-tree versions of `buildLayer.ts`, `gemini-build-watch.ts`, `PolygonAreaBuilder.tsx`, `polygonAreaWorkspace.ts`, `polygonAreaLevers.ts`, `polygonAreaLevers.test.ts` and `PolygonAreaBuilder.levers.workspace.test.tsx` before building. `math.ts` and `problem_type_registry.py` are HEAD plus only my lines. Main's catalog references ten-frame and pattern-builder work this worktree does not have, and copying it broke `typecheck:lumina` with 2 errors.
- The node_modules junction is removed and the shared install is intact.

**WORKTREE PATH:** C:\Users\xbox3\claude web tutor\.claude\worktrees\wf_71c68109-4ab-3

**Files I changed or added:**
- C:\Users\xbox3\claude web tutor\.claude\worktrees\wf_71c68109-4ab-3\backend\app\services\calibration\problem_type_registry.py
- C:\Users\xbox3\claude web tutor\.claude\worktrees\wf_71c68109-4ab-3\my-tutoring-app\src\components\lumina\primitives\visual-primitives\math\polygonAreaBuild.ts
- C:\Users\xbox3\claude web tutor\.claude\worktrees\wf_71c68109-4ab-3\my-tutoring-app\src\components\lumina\primitives\visual-primitives\math\PolygonAreaBuilder.tsx
- C:\Users\xbox3\claude web tutor\.claude\worktrees\wf_71c68109-4ab-3\my-tutoring-app\src\components\lumina\primitives\visual-primitives\math\AreaBuildGrid.tsx
- C:\Users\xbox3\claude web tutor\.claude\worktrees\wf_71c68109-4ab-3\my-tutoring-app\src\components\lumina\primitives\visual-primitives\math\polygonAreaWorkspace.ts
- C:\Users\xbox3\claude web tutor\.claude\worktrees\wf_71c68109-4ab-3\my-tutoring-app\src\components\lumina\primitives\visual-primitives\math\PolygonAreaBuilder.workspace.test.tsx
- C:\Users\xbox3\claude web tutor\.claude\worktrees\wf_71c68109-4ab-3\my-tutoring-app\src\components\lumina\primitives\visual-primitives\math\polygonPerimeterBuild.test.ts (new)
- C:\Users\xbox3\claude web tutor\.claude\worktrees\wf_71c68109-4ab-3\my-tutoring-app\src\components\lumina\primitives\visual-primitives\math\PolygonAreaBuilder.perimeter.workspace.test.tsx (new)
- C:\Users\xbox3\claude web tutor\.claude\worktrees\wf_71c68109-4ab-3\my-tutoring-app\src\components\lumina\service\math\gemini-polygon-area-builder.ts
- C:\Users\xbox3\claude web tutor\.claude\worktrees\wf_71c68109-4ab-3\my-tutoring-app\src\components\lumina\service\qa\oracles\polygon-area-builder.ts
- C:\Users\xbox3\claude web tutor\.claude\worktrees\wf_71c68109-4ab-3\my-tutoring-app\src\components\lumina\service\manifest\catalog\math.ts
- C:\Users\xbox3\claude web tutor\.claude\worktrees\wf_71c68109-4ab-3\my-tutoring-app\src\components\lumina\evaluation\types.ts
- C:\Users\xbox3\claude web tutor\.claude\worktrees\wf_71c68109-4ab-3\my-tutoring-app\src\components\lumina\components\live-activity\adapters\polygonAreaBuilderLive.ts
- C:\Users\xbox3\claude web tutor\.claude\worktrees\wf_71c68109-4ab-3\my-tutoring-app\src\components\lumina\components\live-activity\liveJourneySpec.ts
- C:\Users\xbox3\claude web tutor\.claude\worktrees\wf_71c68109-4ab-3\my-tutoring-app\src\components\lumina\components\live-activity\runtime\testing\w1-payloads\polygon-area-builder.build_perimeter.json (new)
- C:\Users\xbox3\claude web tutor\.claude\worktrees\wf_71c68109-4ab-3\my-tutoring-app\scripts\polygon-perimeter-build-probe.mjs (new)
- C:\Users\xbox3\claude web tutor\.claude\worktrees\wf_71c68109-4ab-3\my-tutoring-app\qa\open-build\polygon-area-builder-overnight\drive.mjs (new)
- C:\Users\xbox3\claude web tutor\.claude\worktrees\wf_71c68109-4ab-3\my-tutoring-app\qa\open-build\polygon-area-builder-overnight\generation.json (new)
- C:\Users\xbox3\claude web tutor\.claude\worktrees\wf_71c68109-4ab-3\my-tutoring-app\qa\open-build\polygon-area-builder-overnight\journey-sweep.json (new)

**Synced from the main tree, not my edits:** buildLayer.ts, gemini-build-watch.ts, polygonAreaLevers.ts, polygonAreaLevers.test.ts, PolygonAreaBuilder.levers.workspace.test.tsx, plus main's uncommitted edits already present in PolygonAreaBuilder.tsx and polygonAreaWorkspace.ts.

**Drive command.** After merging into the main tree and with next dev on :3000:
```
copy "C:\Users\xbox3\claude web tutor\my-tutoring-app\qa\open-build\browser-drive-2026-10-07\open.mjs" and "C:\Users\xbox3\claude web tutor\my-tutoring-app\qa\open-build\polygon-area-builder-overnight\drive.mjs" into a folder with playwright-core installed, then from that folder:  node drive.mjs
```
It writes `drive.json` and `shots/` under `my-tutoring-app/qa/open-build/polygon-area-builder-overnight/`.

To regenerate (writes `generation.json`; `--payloads` overwrites the saved sweep payload): `cd "<abs>/my-tutoring-app" && node scripts/polygon-perimeter-build-probe.mjs --run --payloads`

## Browser drive (coordinator, after merge into the main tree, 2026-10-09)
**22/22** after two drive-script fixes (press Try again after a miss: the workspace shell keeps the build closed until then; accept the shell's "Next challenge"). Watcher 4/4 lines, clean. Grid squares measure **20 px** at a 360 px card, below 44 px: the shared `AreaBuildGrid` (build_area too) needs a phone layout.
