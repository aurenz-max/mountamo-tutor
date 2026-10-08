# shape-builder — workspace binding + `make_shape` open build, 2026-10-07

## Was `build` already open? No.
Asks usually name one shape ("Build a square"), so only that shape at different sizes passes; nothing checks a
target is buildable; the check is loose (0 right angles never enforced, parallel pairs "at least"); and it gives the
answer away before the check (easy-tier ghost n-gon, "N corners placed / M needed" badge, a panel naming the closed
shape). `build` is left unchanged; `make_shape` is the open version.

## Step 1: binding (minimal, plain shape)
- `ShapeBuilder.tsx` → `ShapeBuilderSurface` through `withWorkspaceController`. Every real check goes through
  `commitCheck`; moves that were never checks (open shape, unfinished sort, tools not all used, too few fold lines)
  still are not.
- Tutor path: old AI hook off, scripted cues silent, learner locked between a check and Try again, Next hidden,
  evaluation submitted once. Try again keeps the shape on `make_shape`, clears it elsewhere.
- `shapeBuilderWorkspace.ts`: task and scene per mode, never a category key, target shape name or corner placement.
- Misses: `buildCheck` gives `build` and `coordinate_shape` the existing check's misses (acceptance unchanged); both
  classify modes get `misplaced_shape`. Fix: the classify verdict reads the current sort, not the running tally
  (which carried over between items and through Try again).
- Adapter `shapeBuilderLive.ts`; catalog `teachingWorkspace` (K-5, `levers: true`, guidance, misses); `tutoring`
  block kept for the scripted fallback. No contract doc existed.

## Step 2: `make_shape` (β 1.6, `answers: ['build']`)
- Ask: "Make a shape with 4 sides and exactly 1 right angle." Empty grid; any shape with all the properties passes.
- Judge (`shapeMakeBuild.ts`): exact integer geometry for sides, right angles, parallel pairs, equal sides, lines of
  symmetry; a dot on a straight run is not a corner. One miss per property: `sides_off`, `right_angles_off`,
  `parallel_off`, `equal_sides_off`, `symmetry_off`.
- Building: tap a dot to add a corner, the first corner to close, a corner to remove; on a closed shape a new dot
  adds a corner on the nearest side; taps that would cross or fold the shape are refused; dot tap targets `data-aid`.
- "I'm done!", no stillness; verdict names no property, number or shape. Before the check: no tools bar, properties
  panel, ghost or badge.
- Facts: `cornersPlaced`, `sides`, `rightAngles`, `parallelPairs`, `sidesOfOneLength`, `symmetryLines` numeric
  (`rightAngles 0 → 4 → 1` tested).
- Watcher: `useBuildWatcher` numbers:'never'. **Shared-layer addition:** optional `neverSay` word list on the build
  layer, put in the prompt and filtered in code by `keepWatchLine`. For shape-builder: shape names plus "parallel",
  "equal", "symmetry", "corner", "side".
- Levers bare, each marking only the learner's shape: `side_tags`, `corner_marks`, `parallel_marks`, `equal_ticks`,
  `fold_lines`; simplify `fewer_properties` (one property dropped, ungraded).
- Generator: code owns the asks from a menu of 22 property sets (9 K-2, 13 3-5), each carrying two passing shapes of
  different form checked by the judge (buildable, more than one answer). Distinct per session, narrowed when the
  topic names a family, K gets sides-only asks. Pinned `make_shape` makes no model call (flash-lite produced a runaway
  `"sides": 4.0000…` that truncated the JSON); in unpinned sessions code rewrites any `make_shape` ask, hint and
  narration.
- Backend prior, catalog misses, new `shape-builder` oracle, journey row, w1 payload.

## Gates (worktree; merged and re-gated in main)
- `ShapeBuilder.workspace.test.tsx` 20/20; `shapeMakeBuild.test.ts` 10/10. Affected suites 88 files, 3236 pass.
- live-activity 2245 pass; `typecheck:lumina` 0; full tsc 770 = baseline.
- Journey sweep `make_shape`: 4 items, 0 findings, 4/4 misses named; clean 100, recovery 67 with 8 attempts.
- Real generator + oracle (5 sessions): 16 `make_shape` items, 0 violations; the oracle finds passing shapes by its
  own random search. The first run (model narration) failed two items for saying "quadrilateral"; narration is now
  code-written.
- Real watcher: 12/12 kept, none with a number, shape name or property word.

About 1,070 production lines added (125 removed), 378 test lines, 211 lines of QA tooling.

## Not verified / rulings
- No browser drive (tap feel, hover preview, lever marks, phone width). No replay or Live.
- Other modes are not driven by the journey row (they place corners by svg position); only `make_shape` has a payload.
- The pinned path no longer exercises flash-lite at all.
- Rulings: (1) β 1.6 may be low for 3-5 asks with two or three properties; (2) pinned `make_shape` makes no model
  call — acceptable? (3) "now a different shape with the same properties" is not built.
