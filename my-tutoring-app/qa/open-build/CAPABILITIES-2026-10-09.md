# Build modes: what to build as a class instead of one at a time

## Short answer

Yes, the work has been going one primitive at a time. Each build mode has been a hand-made front-end and back-end slice. Each one rewrites the same five things:

- the "I'm done!" commit and Try again
- a cell or tap scene
- about ten registry entries
- a generation probe
- a 90–150 line browser drive

Only the watcher (`useBuildWatcher`) and `svgPicture` are shared. Below are eight class-level capabilities that would make most of the remaining candidates a matter of configuration. After them is the ranked list of candidates, using the scope given: no literacy, none of the five engineering design builders, nothing ROADMAP lists as BUILT.

## Friction claims, checked against the repo

| Claim | Result |
|---|---|
| "I'm done!" hand-rolled per component | **Confirmed.** 28 non-test `.tsx` files: 11 math, 11 literacy surfaces, FoodWeb, Habitat, Molecule, OpenBuilder, GearTrain, TowerStacker. `build-layer/` holds only `buildLayer.ts` (97 lines) and its test, which export `svgPicture`, `BuildWatchRequest`, `WATCH_DEBOUNCE_MS` and `useBuildWatcher`. |
| Per-build scenes duplicated | **Confirmed.** math/ has `AngleBuildScene`, `AreaBuildGrid`, `ArrayBuildGrid`, `BaseTenBuildScene`, `CountingBuildScene`, `FractionEqualBuildScene`, `GraphBuildScene`, plus `HabitatBuildScene` and `MoleculeBuildScene`. |
| Per-primitive drives | **Confirmed.** 5 `drive.mjs` files of 88–154 lines, 607 in total. |
| Per-primitive probes | **Confirmed, and higher than stated.** 18 `scripts/*build*/make*-probe.mjs`. |
| Half of math is legacy | **Roughly right; the figures need correcting.** `catalog/math.ts` has 64 ids, 31 with `teachingWorkspace`. Unbound: function-machine, net-folder, dot-plot, ratio-table, analog-clock, slope-triangle, regrouping-workbench, area-model, histogram, systems-equations-visualizer, shape-composer. Bound: number-line, hundreds-chart, polygon-area-builder, compare-objects, place-value-chart, sorting-station. |
| Science/engineering candidates unbound | **Confirmed.** Unbound: lever-lab, atom-builder, rocket-builder, motion-diagram, foundation-builder, mixing-and-dissolving, inheritance-lab, vehicle-design-studio, light-shadow-lab, paper-airplane-designer. Bound: push-pull-arena, adaptation-investigator. LeverLab has 0 `usePrimitiveEvaluation`. None of these 12 has a contract doc. |
| Judgments live inside components | **Confirmed.** `FunctionMachine.tsx:100,121` (`evaluateRule`, `rulesEquivalent`, not exported); `LeverLab.tsx:99,130` (`calculateTorques` useCallback, `isBalanced`); `FoundationBuilder.tsx:175` (`calculatePressure`); `RocketBuilder.tsx:224` (`thrustToWeight`). |
| net-folder answer key written by the model | **Confirmed, and it is a correctness defect, not just friction.** `gemini-net-folder.ts:411` `isValidNet` is a model-authored boolean, and the component checks against it. |
| Canvas surfaces | **Confirmed.** `motion-diagram` and `push-pull-arena` draw on `<canvas>`. |
| Registry omissions recur | **Confirmed.** The gear-train report fixed the backend key `gear-train` → `gear-train-builder`. Four reports (array-grid, base-ten, food-web, spelling-pattern) note a missing `scripts/lib/lesson-planner-requirements.mjs` line. |
| Hub-file collisions | **Confirmed.** The shape-composer report shows `typecheck:lumina` failing at `liveJourneySpec.ts:2313` from a peer session. |
| Reusable judges for the top candidates | **Confirmed.** `learnerHops` and `jumpMiss` are in `numberLineLevers.ts`. `connectedParts` and `turnedToMatch` are exported from `polygonAreaBuild.ts`; there is no export named `sameShape`. `stepPhysics` is in `PushPullArena.tsx`. SortingStation objects carry `attributes: Record<string,string>`. |
| Owed verification, OB-5 text-only facts, open rulings R1/R4–R9 | **Confirmed** in ROADMAP.md. |

The auditor input listed several findings twice (commit footer and build surface; drives and probes; legacy binding; judgments in components; rulings). Each is counted once below.

## Class-level capabilities, in build order

### C1. Build session kit: `useBuildSession` + `BuildCommitBar` + `BuildCellGrid`
- **What it is.** A hook that owns the pieces list:
  - place and remove
  - the no-overlap check
  - the history of what was made
  - keeping the build on Try again
  - an empty scene on a new item or a simplify lever
  - turning the watcher off while checking and after a pass
  - the verdict text, which stays until the next check

  `BuildCommitBar` is the kit-styled "I'm done!" / Try again / verdict row, wired to `commitGesture` or `commitCheck`. `BuildCellGrid` is one `<svg>` tap-to-place cell grid with `data-aid` handling and a 44 px minimum cell. The ten-frame drive failed on 38 px cells and the food-web drive measured a 72×26 px target, so the minimum size belongs in the shared grid.
- **Unblocks.** polygon `build_perimeter`, hundreds-chart `make_skip`, net-folder `build_net`, dot-plot `build_stat`, histogram `build_shape`, motion-diagram (if moved to svg), and every later build. Steps 3 and 5 of build-mode.md become configuration.
- **Replaces.** Hand-rolled commit, retry and verdict logic in 28 components, and grid scenes like ArrayBuildGrid, AreaBuildGrid and CountingBuildScene for new work. Existing scenes migrate only when touched.
- **Size.** About 350 production lines plus vitest. Update build-mode.md steps 3 and 5 to point at the kit.
- **Executor.** `/add-eval-modes`, since it owns build-mode.md. The shared layer is edited in place, as `neverSay` and `made` were.
- **Pilot.** polygon-area-builder `build_perimeter` on `BuildCellGrid` (bound, judge nearly written). Then port ten-frame `build_pair` onto `BuildCommitBar` and re-run its drive to show nothing broke.

### C2. One build-mode registry check
- **What it is.** A single vitest that lists every catalog mode tagged as an open build. It asserts each one appears in:
  - the generator's valid types and fallback
  - the backend `PROBLEM_TYPE_REGISTRY` (exact primitive id key)
  - the oracle known types
  - `liveJourneySpec` and `lessonWorkspacePlan`
  - `lesson-planner-requirements.mjs`
  - catalog `misses`

  It reads the Python registry as text. A check, not code generation: it is cheaper and catches the drift seen so far.
- **Unblocks.** Every new mode; step 8 stops being a memory exercise.
- **Replaces.** The recurring "no line for the new mode" and wrong-key findings.
- **Size.** About 150 lines.
- **Executor.** `/add-eval-modes`.
- **Pilot.** Run it over the roughly 35 existing build modes and fix every hit in one pass, per the close-at-class ruling.

### C3. One parameterised build drive and one generation probe
- **What it is.** `qa/open-build/tools/build-drive.mjs <primitive> <mode>` on top of `browser-drive-2026-10-07/open.mjs`. A small per-primitive adapter supplies `place(n)`, `remove()`, `readVerdict()` and the lever ids. The harness runs the standard journey:
  1. one over
  2. the named miss
  3. Try again keeps the build
  4. fix
  5. pass
  6. pull each lever
  7. record 5+ watcher lines and run them through the leak filter
  8. phone-width (360 px) tap-size check

  `build-probe.mjs <primitive> <mode> --n 3` replaces the 18 probe scripts.
- **Unblocks.** The owed browser drives below, run as one overnight batch.
- **Replaces.** About 600 lines of drive scripts and 18 probes.
- **Size.** About 250 lines for the harness and 15–30 per adapter.
- **Executor.** `/eval-test`, the verification half.
- **Pilot.** Re-express the ten-frame drive as an adapter and match its 22/24 (with the regex false flag fixed). Then sweep:
  - OB-1: coin-counter, base-ten, fraction-circles, equation-builder, bar-model
  - OB-2: array-grid, fraction-bar, polygon-area, angle-workshop, shape-builder
  - OB-3S: habitat, food-web, molecule
  - pattern-builder levers

  OB-8L is literacy and out of scope here.

### C4. Pure judge modules, extracted as one pass
- **What it is.** Move the judgments into domain files with vitest, behaviour unchanged:

  | Module | Functions |
  |---|---|
  | `functionMachineRule.ts` | `evaluateRule`, `rulesEquivalent` |
  | `dotPlotStats.ts` | median, mode, range |
  | `leverPhysics.ts` | torques, `isBalanced` |
  | `atomModel.ts` | element from protons, charge, mass number, shell fill |
  | `rocketPhysics.ts` | thrust-to-weight, delta-v |
  | `foundationLoad.ts` | pressure |
  | `analogClockAngles.ts` | hand angles |
  | `areaModelParts.ts` | partial products |

  Add a code `isValidNet` (fold simulation, or canonical match against the 11 cube nets) and stop trusting the model's boolean.
- **Unblocks.** The judge for 9 candidates; vitest and oracle can call them.
- **Size.** About 600 lines moved and about 300 new (mostly the net validator).
- **Executor.** `/eval-fix` for net-folder (a wrong-key risk), `/add-eval-modes` for the rest.
- **Pilot.** net-folder, because it is a live answer-key defect today.

### C5. Batch workspace binding for build candidates
- **What it is.** W1 minimal binding (`withWorkspaceController`, adapter, guidance, misses), following the 09-22 ruling of minimal wiring everywhere, applied to the unbound candidates in score order:
  - math: shape-composer, function-machine, net-folder, dot-plot, ratio-table, analog-clock, slope-triangle, regrouping-workbench, area-model
  - science/engineering: lever-lab, atom-builder, rocket-builder

  lever-lab first gets an evaluation hook, as gear-train did. Each binding also writes the missing contract doc (`/primitive-contract`).
- **Unblocks.** Builds with misses, levers and JEV. Without binding, a build ships like shape-composer, with no levers.
- **Executor.** `/add-live-tutor-tools`.
- **Pilot.** shape-composer, which already has a build and only owes the bind and levers. Then bind the rest. The serial-verification rule still applies: one runtime check per primitive. The binding pattern is the same each time, so this is a queue run without stops, not separate design slices.

### C6. One pass for levers and numeric facts on built modes
- **What it is.**
  - OB-5: base-ten per place, coin cents, fraction-circles shaded parts, bar-model, equation-builder publish the made quantity as a number, so `workHistory` and self-correction credit work.
  - Levers for ten-frame `build_pair` (bare today).
  - Levers for shape-composer once it is bound.
  - One shared vitest asserting every open build mode publishes at least one numeric made-quantity fact and has `when`/`does` lever text naming the build.
- **Executor.** `/add-live-tutor-tools` for the facts, `/add-support-tiers` for the levers.
- **Pilot.** coin-counter cents, then sweep the shared check.

### C7. Rulings once for the class (user decision, not code)
- **R4/R7.** One standing rule for whether build modes join mixed, unpinned sessions. A proposal for the user to accept or reject: yes, within the lesson's grade ceiling.
- **R5.** One rule for "a second way must differ by X". A proposal: differ in the judged property, and a rotation or reflection counts as the same.
- **R1.** Whether a 3 s stillness auto-check still fires on modes that have a build.

Once ruled, build-mode.md states the rule and reports stop re-asking it.

### C8. Split the hub files and build the modality matrix
- **Hub files.** Split the `liveJourneySpec.ts` rows and `journey-sweep-baseline.json` into per-family files that are merged at load. Without this, an overnight parallel sweep breaks peer sessions' gates, as already happened once. Executor: `/add-live-tutor-tools`.
- **Matrix (OB-6).** Add an `open: true` flag on modes that are really open, separate from `answers: build`, which today mostly means targeted. Generate the skill × modality matrix from it. Executor: `/lumina-portfolio`. Lower priority. It replaces the manual catalog read this audit needed.

**Not proposed.** A canvas-to-svg layer: only motion-diagram and push-pull-arena need it. Convert their scenes to svg inside their own slices.

## Suggested overnight order
1. C2: the check plus fixing every hit.
2. C1: pilot on polygon `build_perimeter`, then the ten-frame port.
3. C3: pilot on ten-frame, then the drive sweep over OB-1, OB-2 and OB-3S.
4. The bound candidates as kit configuration: number-line, push-pull-arena, sorting-station, hundreds-chart, compare-objects, place-value-chart.
5. C4 starting with net-folder, then C5, then C6.

C7 needs the user and should be put to them at the start of the run.

## Remaining candidates, ranked

**Bound now (no binding slice needed):**
1. polygon-area-builder `build_perimeter` (9): exposed unit edges, plus `connectedParts` and `turnedToMatch`. The C1 pilot.
2. number-line `build_hops` (8): landing point, hop count, different hop sizes; reuses `learnerHops` and `jumpMiss`.
3. push-pull-arena `build_balance` / `build_reach` (7): net force = 0 or toward the named side; `stepPhysics` for the stop point. Needs an svg scene first.
4. sorting-station `sort_your_way` (6): find an attribute key that partitions the bins; a second sort must use a different key.
5. compare-objects `make_compare` (5): cube stack height against the pictured object.
6. hundreds-chart `make_skip` (5): arithmetic run with the asked step, length ≥ 5, a new start.
7. place-value-chart `make_with_place` (4): digit per column against the place constraints.
8. adaptation-investigator `design_animal` (4): a code-owned trait bank tagged by environment.

**Need C5 binding (and C4 extraction where noted):**
1. lever-lab `build_balance` / `build_lift` (8): torque sums. Needs an evaluation hook and C4.
2. atom-builder `make_atom` (8): element, charge and mass from counts. C4.
3. function-machine `make_rule` (7): `evaluateRule(rule,4)===12`; the second rule must not be equivalent to the first. C4.
4. net-folder `build_net` (7): code net validator (C4). Fix the model-authored key either way.
5. dot-plot `build_stat` (7): median, mode or range of the placed dots. C4.
6. rocket-builder `build_liftoff` / `build_altitude` (7): thrust-to-weight > 1; delta-v under a part cap. C4.
7. ratio-table `build_equivalent` (6): cross-multiplication; distinct columns. double-number-line can reuse the judge after it.
8. analog-clock `set_any` (6): minute hand at 6, hour hand halfway; miss `hour_on_number`.
9. slope-triangle `draw_any` (6): vertices on the line, legs axis-aligned, rise/run = slope.
10. regrouping-workbench `make_regroup` (6): ones digits sum ≥ 10 (subtraction: top ones < bottom ones).
11. motion-diagram `draw_motion` (6): gaps between dots increasing, equal or decreasing. Canvas to svg, and the primitive has no eval modes yet.
12. mixing-and-dissolving `make_concentration` (6): g/mL equals the target and differs from the shown recipe.
13. area-model `build_split` (5): partial products correct for the learner's own split.
14. foundation-builder `build_foundation` (5): pressure ≤ soil bearing capacity; the second way differs.
15. vehicle-design-studio `build_to_spec` (5): `computeSimulation` against the constraints.
16. inheritance-lab `build_cross` (5): Punnett from chosen genotypes gives the target ratio.
17. systems-equations-visualizer `make_system` (4): the intersection equals the target; the second pair is parallel.
18. histogram `build_shape` (4): skew sign or peak count.
19. paper-airplane-designer `build_distance` (4): `simulateFlight` distance.
20. light-shadow-lab `make_shadow` (4): `computeShadow` length and direction.

The rejected list from the input stands as given. No new rejections came out of the check.