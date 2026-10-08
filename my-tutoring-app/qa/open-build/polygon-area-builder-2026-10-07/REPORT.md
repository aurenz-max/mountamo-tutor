# polygon-area-builder — workspace binding + `build_area` open build, 2026-10-07

## Step 1: binding (minimal, plain shape)
- `PolygonAreaBuilder.tsx` → `PolygonAreaBuilderSurface` through `withWorkspaceController` (`useScriptedProgress`,
  `useWorkspaceProgressFor`). Typed-area checks commit with `commitCheck(describeAreaWork, correct, areaMiss)`;
  misses `forgot_half`, `halved`, `added_sides`, `one_piece`, `bounding_box`, `wrong_area`.
- Tutor path: input blocked while the item is closed, scripted `sendText` silenced, `useLuminaAI` `enabled:
  !tutorOwned`, Next hidden, evaluation submitted from `onFinished` with `teachingAttempts`,
  `assistanceProvenance`, `diagnosisEvidence`. A new item is cleared in the render that opens it (fixes J7).
- `polygonAreaWorkspace.ts` publishes drawn lengths, never `expectedArea`. Adapter `polygonAreaBuilderLive.ts`.
  Catalog `teachingWorkspace` grades 3–7, ~1,000 chars of guidance, `levers: true`, misses for six modes; the
  `tutoring` block kept for the scripted fallback. No contract doc exists.

## Step 2: `build_area` — "Make a shape with an area of N squares" (two-shape items add "then a different shape")
- `AreaBuildGrid.tsx`: one 10×8 svg grid, tap to shade/clear, "Clear grid"; no count printed; square numbers and
  piece colours are `data-aid`.
- Check (`polygonAreaBuild.ts`) at "I'm done!", in order: count (`one_short`, `one_over`, `short_by_more`,
  `over_by_more`); side-joined (`not_connected`; corners do not join); on the second shape, not the first moved,
  turned or flipped (`same_as_first`, all eight symmetries).
- A right first shape is kept, drawn small, not committed. "I'm done!" is the only commit; no stillness. Try again
  keeps the squares and verdict; a new item or simplify opens empty. Count misses give no number or direction;
  `not_connected` says how many separate pieces.
- Facts: `squaresPlaced`, `separatePieces` numeric; `shape`, `firstShape` (rows × columns), `onScreen`;
  `workHistory` `squaresPlaced 0 → 7 → 6` tested. Target never beside the count.
- Watcher: `useBuildWatcher` numbers:'never' on the grid svg; off when empty, after a check, after a pass.
- Levers bare: `square_numbers` (help; count misses), `piece_colors` (help; not_connected), `turned_first` (help,
  two-shape only; same_as_first), `smaller_area` (simplify: half, one shape, ungraded).
- Generator (Fork A pool pattern kept): code picks distinct N (6–20, narrowed by `resolveScopeRange`, ceiling 3–24),
  writes every instruction; first half of a session one shape, second half two. Build sessions get `gradeBand '3'`
  (type widened to `'3'|'6'|'7'`, badge `Grade ${gradeBand}`). Tier flags off. Mixed path includes `build_area`
  (SP-21).
- Catalog β 1.6 (decompose + 0.1), `answers: ['build']`; one description sentence for the Grade 3 mode; backend
  prior 1.6; metrics union; oracle (whole-number area = `expectedArea`, fits grid, ≥ 3, shapesAsked 1|2, instruction
  states N, scope, no repeats; answer-leak check skipped since the stated area is the task); journey row; 2 payloads.

## Gates (worktree; merged and re-gated in main)
- `PolygonAreaBuilder.workspace.test.tsx` 14/14; `polygonAreaBuild.test.ts` 5/5; existing polygon tests 72/72.
- live-activity + catalog 2350 passed (one load timeout passed on re-run).
- Journey sweep on both payloads: 4 items each, 0 findings, 4/4 misses named; clean 100, recovery 67.
- `typecheck:lumina` 0; full tsc 770 = baseline, sorted lists identical.
- Real generator + oracle (4 runs): 0 violations. Real watcher: 10/10 lines kept, no number, verdict or advice.

About 916 production lines (component +274/−36), 309 test lines, a 96-line probe.

## Not verified / rulings
- No browser drive (grid hit areas, phone width, watcher line, levers; decompose and typed modes on the scripted path).
- No replay or Live; the tutor gets no verdict after a right first shape. Decompose drag not driven; no decompose payload.
- Rulings: (1) mixed sessions now include one Grade 3 build item beside the Grade 6–7 formula tiers — keep?
  (2) a shape with a hole counts as one shape (only side-joined is checked); (3) one β for one- and two-shape items.
