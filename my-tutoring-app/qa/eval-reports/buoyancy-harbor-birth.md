# Birth Certificate — buoyancy-harbor (2026-10-29)

**Lifecycle layer: L0 (born)**. Pedagogically sound, measurable, single core mode, bound to the teaching workspace.
Science build world W1 (`qa/science-build/ROADMAP.md`, SB-1).

- Core task identity: `drop_test`. The learner tests two things (guess Float or Sink, which drops the thing into the
  tank; the guess is never graded). Then they call whether a mystery thing made of the same stuff as one test floats or
  sinks, tap that test, and press Check. Both the call and the test must be right.
- Generator fork: **C, code-only** (`service/physics/buoyancy-harbor-generator.ts`): no model call. 24 things in 9
  materials with real densities (`buoyancyModel.ts`). `config.difficulty` sets the structure:
  - easy: the size matches what the eye expects;
  - hard: a big floater or a small sinker, beside a test of the same size made of other stuff;
  - every session: 5 items, floaters and sinkers alternate, no mystery twice, and earlier tests are not reused.
- Workspace binding: `buoyancyWorkspace.ts` + `buoyancyHarbor.card.ts` + `buoyancyHarbor.boss.ts` on the **tap
  preset** (`TAP_ONE` + `tapBoss`; `boss.test.ts` requires it when every mode is TAP_ONE). Response: gesture.
  - Misses: `judged_by_size`, `wrong_call`, `other_thing`.
  - `boss-card.mjs` printed clean; there is no tutoring block and no hand-written Pip.
- Answer-leak audit:
  - The mystery stays on the pier, and its notebook row shows "?", until a right Check.
  - The scene facts never state the mystery's result before then (tested in `buoyancyModel.test.ts` and the workspace test).
  - Materials are shown on purpose: they are the evidence.
  - The instruction never names a result.
- Design gate:
  - **Manipulation: pass.** The learner drops each thing and the world reacts.
  - **Simulation: pass.** A 1-D buoyancy model with added mass: things rest at the depth their density sets, or sink.
  - **Production: exception, chosen.** `drop_test` is the predict-test-reason mode; the open build (`build_boat`) is the
    next layer.
  - **Timer: pass.** No timer.
  - **Layout leak: pass.** See the audit above.
- Curriculum home: **not run.** `/curriculum-fit buoyancy-harbor` is owed (SB-0).
- Pip surface: framework default (`<PipDock />` + `<PipWorkspace>`), covered by `WorkspacePip.surface.test.tsx`.

## Verification (free tiers)

- `buoyancyModel.test.ts`: 13 tests covering the model, tiers, variety, check, misses, generator, boss validation and
  scene leak.
- `BuoyancyHarbor.workspace.test.tsx`: 4 tests on the real runtime:
  - a gesture item, with no key reaching the tutor;
  - a wrong call is a named miss, and Try again keeps the tests;
  - a right call commits once and drops the mystery.
- `npm run test:primitive -- buoyancy-harbor`: green (719 tests). `typecheck:lumina`: 0. Full tsc: 771, with none in
  touched files (the 09-29 baseline of 770 is stale).
- Browser drive, `buoyancy-harbor-drive-2026-10-29/drive.mjs`, at K and Grade 1 in headless Chromium: 30/31.
  - The one fail is the SVG `<ellipse>` console errors, which also appear in the airplane-diorama drives (pre-existing, not
    from this primitive).
  - Covered: 3D mount, splash, settle, notebook, wrong call → Try again keeps the tests, evidence tapped in 3D, 5 items,
    finale.
- Found by the drive and fixed:
  - The Physics tester had no `TesterWorkspace`, so every bound physics primitive showed "needs the tutor" there.
  - The tank was tagged pass-through before its meshes existed, so a 3D tap hit the glass.
  - Physics ran slow at a low frame rate; it now uses substeps.
  - Foam launched out of the water; fixed with added mass.
  - Small things were specks; they are now drawn ×1.6.
- No Live run at birth. Model spend: $0 (code-only).

## L1: `build_boat` (2026-10-29, `/add-eval-modes`)

- Open build, code-judged (`boatModel.ts`): the learner chooses what the boat is made of (foil, clay, craft sticks), its
  shape (a ball, flat, low sides, tall sides) and size (small, big). The boat goes in the tank, and pennies go in one at
  a time until it sinks. "I'm done!" checks whether it carries the goal.
  - What a build carries: water it can push aside (floor × side height + its own volume) minus its mass, in pennies.
  - Misses: `sinks_empty`, `no_sides`, `too_small`.
  - A right boat is loaded with its goal on screen.
  - Try again keeps the build and the notebook.
- Catalog β 1.5 (backend registry matches); `drop_test` stays -0.5.
  - The gap of 2.0 is over the 1.0 densify limit until `find_the_rule` (0.5) and `make_it_float` (1.5→1.0) fill it.
- Tiers: goals 2-5 / 4-9 / 9-15. Above easy, at most half the builds from the offered materials pass. Hard drops the
  craft sticks.
- Mixed sessions run 3 drop tests, then 2 boats. The mode comes from the pin, or from intent via `resolveEvalModes` (one
  flash-lite call when not pinned).
- Leak audit:
  - Nothing is chosen at the start.
  - The goal is stated, because it is the task.
  - What a build carries is never on screen or in the scene facts until the learner tests it.
  - The penny count shown is the learner's own test.
- Not built: tipping (pennies on one side). The model is 1-D.
- Verification:
  - `boatModel.test.ts`: 9 tests.
  - The workspace test drives the miss → Try again → a test to the sink → pass → loaded → next item.
  - `test:primitive` 720 pass. `typecheck:lumina` 0. Full tsc 771, unchanged.
  - Browser drive `buoyancy-harbor-drive-2026-10-29/drive-boat.mjs` at K and G1: 23/24. The fail is console 400s from
    the unauthenticated headless session, which the drop-test drive shows too.
  - A close camera view opens when the boat is launched, so its pennies show.
- Model spend: $0 in drives (the tester pins the mode).

## Follow-up queue (in order)

| # | Skill | Layer | Input from this birth |
|---|---|---|---|
| 1 | `/add-eval-modes` | L1 | ~~`build_boat`~~ DONE 10-29 (tipping not built); `find_the_rule` (sort tested things, pick what floaters share); `make_it_float` (reshape clay); `cargo_two_designs` (science-K brief 4); `salt_water` (G3-5) |
| 3 | `/add-support-tiers` | L3 | DONE 10-29 (`buoyancy-harbor-levers-2026-10-29.md`; replay deferred). Was: SB-3 demonstration levers on the boss: `xray` (marks: weight-down and water-push-up arrows), `side_by_side` (layout), `solved_boat` (model), `one_step_less` (easier), `replay` (custom). Expected failures: calling by size (big log → sink), tapping the other test as evidence |
| 5 | `/add-sound` | L5 | splash on entry, a clunk on the tank floor, a bob |
| ✓ | `/eval-test buoyancy-harbor` | QA | Re-run after each layer |
