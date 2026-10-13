# di-shapes `build_shape` — open build, 2026-10-11

The tutor names a shape ("Make a hexagon.") and the child makes any one on an empty 7×7 dot grid, then presses
"I'm done!". This is the inverse of `name_shape`: the name is given and the child has to produce a shape with its
defining sides and corners. It is a new mode, and the five spoken modes are unchanged.

## What shipped

| Part | Where |
|---|---|
| Judge, asks, witnesses | `diShapesBuild.ts`: shape-builder's grid geometry (`readShape`) checked in order: sides, then square corners, then equal sides, then one parallel pair. A square is `made_square` for rectangle and rhombus (the K convention). Only triangle, square, rectangle, pentagon, hexagon, rhombus and trapezoid can be built; circle and oval cannot. |
| Board | `ShapeBuildBoard.tsx`: tap a dot to place a corner, tap the first corner to close the shape, tap a corner to remove it. Tapping can never make a crossed shape. The board shows the 👀 watcher line, which never contains a number or shape word. Lever marks and dot targets are `data-aid`. |
| Stage | `DiTeachingStage` gained `view.commit` / `view.canAttempt` (a gesture item commits with the pack's own verdict) and `copyFor`. Spoken packs are unchanged. |
| Levers | No lever is on at the start. `model_shape` shows a different straight-sided shape with its sides ticked. `side_ticks` and `corner_marks` (square, rectangle) mark the child's own shape, and `same_length_marks` (square, rhombus) colours its sides by length. `make_triangle` is the simplify lever (ungraded). |
| Generator | Pool = buildable scoped shapes, widened to the grade's when the scope has none. A tier draws nothing. Fixed: an "es" plural ("rhombuses") now names its shape, which was a bug in every di-shapes mode. |
| Registry | catalog mode β 2.8 + misses, backend `PROBLEM_TYPE_REGISTRY`, eval types, journey driver, DI tester example, contract R11. |
| Tester | The DI tester has an "Offline levers (free)" / "Live tutor (paid)" toggle. Live is the default, because spoken items need the tutor. |

## Evidence

- `diShapesBuild.test.ts` (12) and `DiShapes.build.workspace.test.tsx` (4) run on the real runtime: miss → Try again
  keeps the shape → side_ticks marks 5 sides → clear → hexagon passes → advance opens an empty grid; square for
  rectangle → `made_square` → make_triangle practice item.
- Real generation (`scripts/di-shapes-build-probe.mjs --run`): 4/4 lessons clean (adapter ok, witnesses pass, wrong
  builds miss, no count in the scene, no shape name in the wrapper). A "Circles and ovals" scope widened to the
  buildable K shapes. Payload saved: `w1-payloads/di-shapes.build_shape.json`.
- Journey sweep: 7/7 di-shapes payloads, including build_shape driven through real dot taps. Pip surface test 121/121.
- `typecheck:lumina`: 0 errors from this change. The gate currently shows 1 error in `drawers/growthSpecs.ts`, which
  is another session's untracked work.

## Not done

- **Browser drive:** blocked. On 10-11 the running app did not compile, because `primitiveRegistry.tsx` imports
  `drawers/drawerRegistry`, which another session had not added yet. Rerun `browser/drive-build.mjs <out dir>` once
  it compiles (DI tester → Custom run → di-shapes / build_shape → Offline levers).
- The tutor's wording on build verdicts needs the di-shapes class Live gate, which has not been run.
- Another session, still working, is removing the DI starting levers. That breaks one di-shapes test (`easy name_shape
  starts with a model`), which is not a build test. It belongs to that session's slice.
