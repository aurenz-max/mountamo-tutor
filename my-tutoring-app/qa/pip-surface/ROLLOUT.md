# Pip shared-surface rollout queue

Owning queue for adding Pip's shared surface to every catalog primitive. Executor: `/add-pip-surface`, one batch per push. Pull the top `open` batch, close it here with its report link, and update the WORKSTREAMS row in the same slice. Policies, rules and the per-primitive target table: `src/components/lumina/pip/README.md`.

## Status (2026-09-15, after batches 5–33)

- Catalog: 212 primitive ids (six added since the first inventory). With a surface: 184. Remaining: 28 — 13 display-only and 4 with no answer check (perch), 4 simulations awaiting a decision, 2 on hold for `/curriculum-fit`, 5 that need a design or a fix first.
- Recount by comparing catalog ids (`service/manifest/catalog/*.ts`) with component files that call `usePipSurface(`, `useWorkspacePipSurface(` or `useStimulusPipSurface(` (match their `primitiveType`).

## Done

| Batch | Primitives | Report |
| --- | --- | --- |
| K math 1–4 | counting-board, number-sequencer, number-tracer, number-bond, ordinal-line, sorting-station, compare-objects, comparison-builder, ten-frame, addition-subtraction-scene, bar-model, length-lab, analog-clock, time-sequencer, pattern-builder, shape-sorter, di-spoken-practice, di-math-facts, measure-lab, math-fact-fluency, number-line, calendar-explorer, di-shapes, equation-builder, shape-tracer, shape-composer, hundreds-chart, balance-scale | `sweep-2026-09-14.md`, `batch-k-math-*-2026-09-14.md` |
| Literacy 1 | di-word-reading, phonics-blender, cvc-speller, letter-spotter, word-sorter | `batch-literacy-2026-09-14.md` |
| 1. Sounds and decoding | rhyme-studio, sound-swap, word-workout, phoneme-explorer, decodable-reader | `batch-la-1-3-2026-09-14.md` |
| 2. Oral language | story-talk, interactive-book, picture-vocabulary, word-flip, spatial-scene | `batch-la-1-3-2026-09-14.md` |
| 3. New Language Arts builds | letter-workshop, you-and-me, story-bridge, story-ribbon | `batch-la-1-3-2026-09-14.md` |
| 4. K spoken remainder | letter-sound-link, syllable-clapper, knowledge-check (judged surface; browser drive not reached), di-letter-sounds, di-sentence-reading | `batch-4-2026-09-15.md` |
| 5–6. K math, place value, fractions | 3d-shape-explorer, timeline-builder, shape-builder, strategy-picker, fast-fact, base-ten-blocks (click modes), place-value-chart, fraction-bar, fraction-circles, area-model | `batch-5-33-2026-09-15.md` |
| 7–12. Math G1–8 | array-grid, multiplication-explorer, skip-counting-runner, regrouping-workbench, coin-counter, measurement-tools, percent-bar, ratio-table, double-number-line, factor-tree, function-machine, equation-workspace, formula-lab, practice-problem, parameter-explorer, angle-workshop, circle-explorer, polygon-area-builder, net-folder, transformation-lab, histogram, two-way-table, distribution-explorer, coordinate-graph, slope-triangle, systems-equations-visualizer, matrix-display, function-sketch, di-dice-roll | `batch-5-33-2026-09-15.md` |
| 13–16. Literacy G1–5 | genre-explorer, oral-sentence-studio, read-aloud-studio, sentence-analyzer, word-builder, text-structure-analyzer, character-web, context-clues-detective, evidence-finder, figurative-language-finder, opinion-builder, paragraph-architect, revision-workshop, reading-repair-studio, spelling-pattern-explorer, story-map, poetry-lab (rhyme hunt), spatial-path | `batch-5-33-2026-09-15.md` |
| 17–24. Science | solar-system-explorer, habitat-diorama, matter-explorer, states-of-matter, push-pull-arena, ramp-lab, light-shadow-lab, day-night-seasons, moon-phases-lab, life-cycle-sequencer, classification-sorter, food-web-builder, adaptation-investigator, cell-builder, microscope-viewer, bio-compare-contrast, bio-process-animator, dna-explorer, energy-cycle-engine, evolution-timeline, inheritance-lab, protein-folder, periodic-table, atom-builder, mixing-and-dissolving, molecule-constructor, reaction-lab, ph-explorer, equation-balancer, energy-of-reactions, gas-laws-simulator, stoichiometry-lab, constellation-builder, planetary-explorer, telescope-simulator, orbit-mechanics-lab | `batch-5-33-2026-09-15.md` |
| 25–30. Physics, engineering, history, studios | mission-planner, rocket-builder, gravity-drop-tower, motion-diagram, race-track-lab, sound-wave-explorer, bridge-builder, tower-stacker, shape-strength-tester, transport-challenge, dump-truck-loader, excavator-arm-simulator, hydraulics-lab, construction-sequence-planner, foundation-builder, airfoil-lab, flight-forces-explorer, paper-airplane-designer, propulsion-lab, propulsion-timeline, engine-explorer, vehicle-comparison-lab, vehicle-design-studio, blueprint-canvas, cause-effect-chain, era-explorer, digital-skills-sim, foundation-explorer | `batch-5-33-2026-09-15.md` |
| 31–33. Core exhibits, late additions | fact-file, image-panel, feature-exhibit, how-it-works, timeline-explorer, vocabulary-explorer, comparison-panel, di-deduction, di-worked-procedure, di-word-problem-setup, tape-diagram | `batch-5-33-2026-09-15.md` |

## Queue

| Row | Theme | Primitives | Status |
| --- | --- | --- | --- |
| DONE | Spoken DI packs on the teaching workspace | `di-letter-sounds`, `di-word-reading`, `di-math-facts`, `di-sentence-reading`, `di-shapes` (B3) — their Pip surfaces lived in the scripted drill, deleted in LA-14 S5 (2026-09-22, [handoff 13](../live-runtime-handoffs/13-delete-di-scripted-drills.md)). The workspace path they have run on in lessons and Pulse since 09-19..22 never had one. Wire Pip once in the shared `DiTeachingStage` (cue/attend on the stimulus, celebrate on a COMMITTED outcome, never on a local phase) so all four regain it. Executor: `/add-pip-surface` | **done 2026-09-24**: one surface in `DiTeachingStage` (`pip/diStagePipPose.ts`), all five packs; `pip/DiTeachingStage.surface.test.tsx` 61/61 on every saved payload; DI Lab drives Shapes 1400+760 and Facts 1400 clean (`qa/pip-surface/di-teaching-stage-2026-09-24.md`) |
| DECIDE | Simulations with no evaluation hook | `lever-lab`, `gear-train-builder`, `pulley-system-builder`, `wheel-axle-explorer` — USER RULING: touch-following surface (look only, no cue or celebrate without a checked result) or the perch | needs decision |
| DESIGN | Long pages with many answerable blocks | `deep-dive`, `passage-studio` — one outline would cover a page several screens long with the dock scrolled away, and blocks are answered in any order. Proposal: scope = the evaluable block the child last touched, dock inside that block's wrapper, workspace spread on that wrapper only; never use Passage Studio's scroll-driven `activeId` as the scope. Executor: `/add-pip-surface` once the design is agreed | needs design |
| BLOCKED | A fix comes first | `safety-lab` (SAFE-1: three item types never record a result, so the session sticks on item 1 — `/eval-fix`); `formula-card` (its check is a z-50 modal above Pip's layer, so a surface there would be invisible — move the check out of the modal or leave it on the perch); `media-player` (the 3-band listening rebuild is active — wire the rebuilt component and keep the dock out of the fixed-height mobile scroll area) | blocked |
| HOLD | Only partly teach their requirements | `sentence-builder` (K 0/25), `story-planner` (K 0/10) — `/curriculum-fit` first | blocked |
| PERCH | No answer check | display-only: `concept-card-grid`, `curator-brief`, `flashcard-deck`, `organism-card`, `species-profile`, `machine-profile`, `scale-spectrum`, `annotated-example`, `graph-board`, `take-home-activity`, `image-comparison`, `custom-visual`, `generative-table`; nothing to confirm: `body-system-explorer`, `molecule-viewer`, `scale-comparator`, `dot-plot` (DOTP-1: "Mark Complete" records any tap as correct — `/add-eval-modes` first) | no work |

## Batch recipe (what made batches 1–3 cheap)

Batches 5–33 (2026-09-15):
- Classic primitives use `useWorkspacePipSurface` (one `workspace` region plus a dock) and judged primitives with one question panel use `useStimulusPipSurface`. A batch is one spec per primitive (scope, solved, open and close markers, spacing class) applied by a line-anchored script and then reviewed in the diff.
- Read-only survey agents with a shared brief wrote and dry-ran the specs (markers matched once, variables declared above the hook, patched copies parse) while drives ran; they also found most of the EVAL_TRACKER rows filed on 09-15.
- Test fixtures come from the drives' `generated-1.json`, or from `generateComponentContent` for primitives only lessons host; one parameterised test file per family (`MathWorkspaces`, `LiteracyWorkspaces`, `ScienceWorkspaces`, `ExhibitWorkspaces`, `StimulusRunners`).
- The science, engineering and history helpers minted `Date.now()` ids during render; they now keep one id per generation and mount the companion, which any Pip drive there needs.
- Never edit components while a drive runs: the edit reloads the page and the drive fails.


- Read each component, write its teaching contract into the policy docblock, then one scripted patch per batch (CRLF-safe string replacement) — no hand edits across many files.
- One surface test per primitive copying the family mock; run a policy mutation per primitive to prove each test fails when the policy changes.
- Drives: `PIP_HELPER="Language Arts"` for literacy; `start:<label>` for mic buttons with a custom idle label ("Let's talk", "Story time", "Tell this story").
- Keep one dock position per primitive. A dock that remounts when the mode changes loses Pip to another surface in a lesson (`remove` hands the active id to the last surface).
- In tests, spread the RTL view first: `{ ...view, store, update }`. `{ store, rerender, ...view }` lets RTL's `rerender` overwrite yours and unmounts the tree.
