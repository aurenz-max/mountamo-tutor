# shape-tracer W1 (plain shape), 2026-10-09

ROLLOUT C11. Not committed (sibling bindings in the same tree).

## What shipped
- `shapeTracerWorkspace.ts`: assignment, scene, `describeShapeWork`, `shapeTracerMiss` / `ShapeTracerMiss`, the
  draw check (`checkShapeProperties`, moved from the component), `traceAccepts` / `freeTrace`, `drawCorners` (harness).
- `ShapeTracer.tsx` → `ShapeTracerSurface` + `withWorkspaceController`. Workspace path: runtime progression,
  `commitCheck` on each check, `learnerBlocked()` on every dot, Undo and Check Shape; Next hidden; scripted `sendText`
  muted; `useLuminaAI({ enabled: !tutorOwned })`; scene in `useLayoutEffect`; submit from `onFinished` only under an
  evaluation provider; Try again clears a drawing's corners and (since the lever phase) keeps connect-dots' joined
  dots, which were all right.
- `adapters/shapeTracerLive.ts` + `activityContract.ts`; catalog `teachingWorkspace` (guidance + misses);
  `liveJourneySpec.ts` row; `lessonWorkspacePlan.test.ts`; `docs/contracts/shape-tracer.md` (new).

## Fixes found while binding (both paths)
- Hard-tier trace hid the numbers and the glow but still required corner 1 first: unknowable. It now starts at any
  corner and goes either way round when neither cue is on.
- The generator set `allSidesEqual` on a "3 straight sides" triangle clue, so a correct triangle failed. The check now
  holds the learner only to what the clue says.
- The header badge named the shape on draw-from-description and named connect-dots' hidden shape before the reveal.

## Checked by code
- trace, complete: the last right corner credits; a tap out of turn is refused on the dot, not checked (no misses).
- connect_dots: `started_elsewhere`, `skipped_number`, `went_back`. draw_from_description: `too_few_sides`,
  `too_many_sides`, `sides_unequal`.

## Gates
- `typecheck:lumina`: 0 (2 sibling errors in `shapeComposerWorkspace.ts` mid-run, gone at the end).
- `ShapeTracer.workspace.test.tsx` 10/10; workspaceContract + misses + lessonWorkspacePlan + activityContract 2329/2329.
- Sweep, 4 payloads (K, 5 items each): 0 findings; misses named 10/10 (connect_dots 5/5, draw 5/5); J10/J11 records
  right (recover score 67, first response 0 on the checked modes; 100 on trace/complete). trace/complete have no
  wrong input, so J2-J4 do not run there.

## Tutor replay (text, gemini-3.8-flash, 4 payloads x 5)
- Run 1 (`replay/shape-tracer-2026-10-09.json`): no_key 13/20 pre-try, all on on-screen text: "tap dot number 1" on a
  numbered trace, "3 corners" from the draw clue. The clue and the corner numbers are now in the task text.
- Run 2 (`-r2.json`): 0 misses. Read by hand: miss replies ask ("Which number do we count first?", "How many corners
  does our clue ask for?"); connect-dots stuck says "find the 1" on an item whose instruction lists 1, 2, 3. Guidance
  now says to ask which number comes next on connect-dots.

## Undriven / open
- All four modes driven. The replay's key list is empty on every record after the fix (first items state their
  numbers), so no_key is not measured there; read by hand instead.
- Browser check owed on the tap targets (SVG `g` with a filled circle) and the free trace's closing line.
