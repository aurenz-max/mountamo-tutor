# Teaching-workspace rollout queue

Owning queue for putting every answerable catalog primitive on the shared tutor/JEV teaching
workspace at **W1** (minimal binding). Executor: `/add-live-tutor-tools`, section "W1 minimal
binding". Kickoff and rung definitions: [handoff 15](../live-runtime-handoffs/15-workspace-rollout.md).
Pull the top `open` batch, close it here with its report link, and update the WORKSTREAMS row in
the same slice. W2 (demonstrations, scene facts, JEV and learner-intent cases, `--audio`
journeys) is pulled per primitive only when a W1 smoke drive or a human sitting shows the need.

## Status (2026-09-23)

- Catalog: 212 primitive ids. On the workspace: 17 (8 at W2 from the pilots, 9 at W1). Queued:
  Tier A 0, Tier B 12, Tier C 152. Held back: 31.
- **Recount:** catalog ids = `id: '...'` entries in `src/components/lumina/service/manifest/catalog/*.ts`
  (skip the test fixture id `x`); on the workspace = entries with a `teachingWorkspace: {` block.
  Runner-era surfaces: `rg -l "useJudgedScriptRunner<|useJudgedSpeechLoop<|= useJudgedScriptRunner|= useJudgedSpeechLoop" src/components/lumina/primitives --glob "!*test*"`.
- **Two shapes.** *Runner-era* (R): the component runs `useJudgedScriptRunner`; the W1 recipe
  swaps its controller and applies unchanged. *Plain* (P): no runner (its own Check/Next, or an
  older tool-lab live adapter). Recipe since A2: `useWorkspaceProgress` in place of
  `useChallengeProgress` (skill section "Plain shape (P)"). A P primitive that does not use
  `useChallengeProgress` needs its own look before its batch.
- **Parallel sessions:** every adoption edits `activityContract.ts`, the catalog and
  `liveJourneySpec.ts`. Commit one primitive before the next one starts on those files.

## Done

| Primitive | Rung | Report |
| --- | --- | --- |
| counting-board, shape-sorter, number-sequencer, letter-sound-link, di-letter-sounds, di-word-reading, di-math-facts, di-sentence-reading | W2 | `../tutor-reports/` (per-adopter, 09-19..22) |
| ten-frame (W1 pilot) | W1 | [ten-frame-w1-2026-09-22.md](../tutor-reports/ten-frame-w1-2026-09-22.md) |
| number-bond | W1 | [number-bond-w1-2026-09-23.md](../tutor-reports/number-bond-w1-2026-09-23.md) |
| compare-objects | W1 | [compare-objects-w1-2026-09-22.md](../tutor-reports/compare-objects-w1-2026-09-22.md) |
| A1: place-value-chart, ordinal-line, sorting-station | W1 | [workspace-rollout-A1-2026-09-23.md](../tutor-reports/workspace-rollout-A1-2026-09-23.md) |
| A2: number-line, comparison-builder, number-tracer (plain shape) | W1 | [workspace-rollout-A2-2026-09-23.md](../tutor-reports/workspace-rollout-A2-2026-09-23.md) |
| DEAD: runner-owned sandbox handoff, `'di-runner'` owner value, `RUNNER_GUIDANCE`/`runnerLessonStart` (frontend) | — | 09-23, no report. **Residue, owned by LA-14 retirement (`07-census.md`):** the backend bridge `live_activity_tools.py` still accepts `teachingOwner: 'di-runner'` and emits `activity_ready` for it, and `run_live_runtime.py` (`judged_runner`), `run_live_lesson_plan.py` and `scripts/live-lesson-plan-fixture.mjs` still branch on it (the live route's `diPlan` probe was removed with it). No frontend adapter sends that value. |

## Queue

Order: Tier A, then runner-era K–2 (the recipe applies as written), then the rest K–2 first.

| Row | Shape | Primitives | Status |
| --- | --- | --- | --- |
| B1 | R | `balance-scale` (equality, workshop), `base-ten-blocks` (DI modes), `bar-model` (explanation), `fraction-circles` (`touch_fraction`) — census Tier B | open |
| B2 | R | `cvc-speller`, `phonics-blender`, `sound-swap`, `word-flip` (both runner hooks) | open |
| B3 | R | `you-and-me`, `spatial-scene`, `di-shapes`, `ramp-lab` (investigation) | open |
| C1 | R | K literacy sounds: `rhyme-studio`, `word-workout`, `phoneme-explorer`, `syllable-clapper` | open |
| C2 | R | K literacy words: `letter-spotter`, `word-sorter`, `word-builder`, `picture-vocabulary` | open |
| C3 | R | K reading and oral language: `decodable-reader`, `interactive-book`, `story-bridge`, `story-ribbon` | open |
| C4 | R | K math and science: `addition-subtraction-scene`, `3d-shape-explorer`, `calendar-explorer`, `push-pull-arena` | open |
| C5 | R | K–2 science: `habitat-diorama`, `matter-explorer`, `states-of-matter`, `solar-system-explorer` | open |
| C6 | R | Spoken DI, older learners: `di-spoken-practice`, `di-dice-roll`, `di-deduction`, `di-worked-procedure`, `di-word-problem-setup` | open |
| C7 | R | Literacy G1–5 on the runner: `genre-explorer`, `sentence-analyzer`, `text-structure-analyzer`, `oral-sentence-studio`, `read-aloud-studio` | open |
| C8 | R | Other runner-era: `knowledge-check`, `periodic-table`, `cause-effect-chain`, `era-explorer` | open |
| C9 | P | K math: `math-fact-fluency`, `hundreds-chart`, `equation-builder`, `pattern-builder`, `strategy-picker` | open |
| C10 | P | K measurement and time: `length-lab`, `measure-lab`, `analog-clock`, `time-sequencer`, `timeline-builder` | open |
| C11 | P | K geometry: `shape-tracer`, `shape-composer`, `shape-builder`, `fast-fact` | open |
| C12 | P | G1–2 math: `skip-counting-runner`, `regrouping-workbench`, `coin-counter`, `fraction-bar`, `area-model` | open |
| C13 | P | K–2 literacy: `letter-workshop`, `spelling-pattern-explorer`, `story-map`, `sentence-builder`, `story-planner` (the last two HOLD in Pip for `/curriculum-fit`; check first) | open |
| C14 | P | K–2 science: `light-shadow-lab`, `day-night-seasons`, `moon-phases-lab`, `life-cycle-sequencer`, `classification-sorter` | open |
| C15 | P | Math G3–5: `array-grid`, `multiplication-explorer`, `measurement-tools`, `tape-diagram` | open |
| C16 | P | Math G5–7: `percent-bar`, `ratio-table`, `double-number-line`, `factor-tree` | open |
| C17 | P | Math expressions: `function-machine`, `equation-workspace`, `formula-lab`, `formula-card`, `practice-problem` | open |
| C18 | P | Geometry G4–8: `angle-workshop`, `circle-explorer`, `polygon-area-builder`, `net-folder`, `transformation-lab` | open |
| C19 | P | Data: `histogram`, `two-way-table`, `distribution-explorer`, `coordinate-graph` | open |
| C20 | P | Algebra: `slope-triangle`, `systems-equations-visualizer`, `matrix-display`, `function-sketch`, `parameter-explorer` | open |
| C21 | P | Literacy G2–5: `character-web`, `context-clues-detective`, `evidence-finder`, `figurative-language-finder` | open |
| C22 | P | Literacy G2–5: `reading-repair-studio`, `poetry-lab`, `spatial-path` | open |
| C23 | P | Science G3+: `food-web-builder`, `adaptation-investigator`, `constellation-builder`, `planetary-explorer`, `telescope-simulator` | open |
| C24 | P | Biology: `cell-builder`, `microscope-viewer`, `bio-compare-contrast`, `bio-process-animator`, `dna-explorer` | open |
| C25 | P | Life and earth science: `energy-cycle-engine`, `evolution-timeline`, `inheritance-lab`, `protein-folder`, `orbit-mechanics-lab` | open |
| C26 | P | Chemistry: `atom-builder`, `mixing-and-dissolving`, `molecule-constructor`, `reaction-lab`, `ph-explorer` | open |
| C27 | P | Chemistry: `equation-balancer`, `energy-of-reactions`, `gas-laws-simulator`, `stoichiometry-lab` | open |
| C28 | P | Physics: `gravity-drop-tower`, `motion-diagram`, `race-track-lab`, `sound-wave-explorer`, `mission-planner` | open |
| C29 | P | Flight: `rocket-builder`, `airfoil-lab`, `flight-forces-explorer`, `paper-airplane-designer`, `propulsion-lab` | open |
| C30 | P | Engineering: `bridge-builder`, `tower-stacker`, `shape-strength-tester`, `transport-challenge`, `foundation-builder` | open |
| C31 | P | Construction sims: `dump-truck-loader`, `excavator-arm-simulator`, `hydraulics-lab`, `construction-sequence-planner` | open |
| C32 | P | Vehicles and history: `propulsion-timeline`, `engine-explorer`, `vehicle-comparison-lab`, `digital-skills-sim`, `foundation-explorer` | open |
| C33 | P | Exhibits with a check: `fact-file`, `image-panel`, `feature-exhibit`, `how-it-works` | open |
| C34 | P | Exhibits with a check: `timeline-explorer`, `vocabulary-explorer`, `comparison-panel` | open |

A C row whose primitive turns out to have no answer check moves to HELD with the reason.

## Held back

| Row | Primitives | Reason |
| --- | --- | --- |
| PERCH | `concept-card-grid`, `curator-brief`, `flashcard-deck`, `organism-card`, `species-profile`, `machine-profile`, `scale-spectrum`, `annotated-example`, `graph-board`, `take-home-activity`, `image-comparison`, `custom-visual`, `generative-table`, `body-system-explorer`, `molecule-viewer`, `scale-comparator`, `dot-plot` | Display-only or no answer check (Pip's PERCH list). `dot-plot`: DOTP-1, "Mark Complete" records any tap as correct; `/add-eval-modes` first |
| DECIDE | `lever-lab`, `gear-train-builder`, `pulley-system-builder`, `wheel-axle-explorer` | Simulations with no evaluation hook; same user ruling Pip is waiting on |
| DESIGN | `deep-dive`, `passage-studio` | Many answerable blocks on one long page, answered in any order; an item list needs the same scope design Pip is waiting on |
| OPEN | `opinion-builder`, `paragraph-architect`, `revision-workshop`, `story-talk`, `blueprint-canvas`, `vehicle-design-studio` | Open-ended writing, talk or drawing: no bounded `expectedAnswer` and no code check. Needs an evidence contract (W2-level work) |
| BLOCKED | `safety-lab` (SAFE-1: three item types never record a result), `media-player` (3-band listening rebuild active) | A fix comes first |

## Batch recipe

- Follow `/add-live-tutor-tools` "W1 minimal binding". Per primitive: domain module, controller
  swap, adapter reduced to a `WorkspaceDomain`, catalog `teachingWorkspace`, journey row,
  `<X>.workspace.test.tsx`, one smoke drive (gesture mode, plus `--audio` on one spoken mode).
- Record per primitive in the batch report: production lines, time to clean typecheck, smoke
  results with raw file names, withheld modes and why.
- A failed smoke is written into the row, then fixed, or the primitive moves to W2 or BLOCKED.
  Do not widen W1 to pass one primitive. A defect found in two primitives is a shared-layer fix
  (skill: Standing authority).
- Never edit a component while a drive runs against it: the edit reloads the page and the drive fails.
- Gates per batch: `typecheck:lumina` 0, full `tsc` not above baseline (770 on 09-23), the batch's
  tests plus `src/components/lumina/components/live-activity`.
- Owed and not built: handoff 15's single generic contract test for every W1 primitive. Each
  adopter has its own `<X>.workspace.test.tsx` instead. Build the generic one when the per-primitive
  files start repeating their harness (likely during A1–A2).
