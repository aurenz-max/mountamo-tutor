# Migrate every judged pack to the one `observation` callback, by family

Status: **Phase A (math) DONE 2026-09-15** ([report](misconception/observation-alias-phase-a-math-2026-09-15.md));
**Phase B (literacy) DONE 2026-09-15** ([report](misconception/observation-alias-phase-b-literacy-2026-09-15.md));
**Phase C (DI) DONE 2026-09-15** ([report](misconception/observation-alias-phase-c-di-2026-09-15.md));
**Phase D (other) DONE 2026-09-15** ([report](misconception/observation-alias-phase-d-other-2026-09-15.md)); next Phase
E (no pack uses the alias any more). None of the four phases is committed yet. Written 2026-09-15 after the judged-evidence handoff (slices 1–4 shipped as `082bd54b`; capture
repairs uncommitted, `qa/misconception/judged-capture-repairs-2026-09-15.md`). Five phases, one per family plus the
deletion. Executor: `/add-misconception-loop` (Phase 2 contract). Queue: `qa/di/BACKLOG.md` item 18.

## Why this exists

Slice 2 replaced the pair `diagnosisObservation` / `responseObservation` with one `observation(item, { heard, verdict })`
that the runner calls on every verdict: evidence-carrying attempts go to `learningResponses` (student work), corrections
also become the diagnosis observations behind `summary.diagnosisEvidence`. Eight packs use it (counting-board, ten-frame,
base-ten-blocks, place-value-chart, ordinal-line, decodable-reader, 3d-shape-explorer, picture-vocabulary). The other
**45 pack implementations** still use `diagnosisObservation`, a deprecated corrections-only alias, so for them:

1. Right answers never reach student work. `learningResponses` is empty, and the observation preview (`components/LearningResponsePreview`) and any later strength distillation have nothing to show.
2. **41 `observed` strings in 33 packs name a verdict** ("The tutor judged the answer wrong from the audio", "Said something that did not match", "Tapped a letter that did not match", "The committed ecosystem model did not match the relationship key"). Under `observation` the same text is recorded on affirmed attempts, so each must be reworded to state what was heard or done before the pack moves.
3. Several `challenge` strings name the mode, not the stimulus ("identify_shape from the visible or spoken stimulus" was the census abstain that the capture repairs fixed). The distiller reasons from the phases, so the ask must say what was shown, said or asked.

18 of the 45 are declared observation sources (catalog `misconceptionScope`), so for them the migration also changes what
the distiller sees; the census is the check. The other 27 gain student-work richness only.

## The per-pack recipe (same in every phase)

1. **Rename.** `diagnosisObservation: (item, { lastHeard }) => …` becomes `observation: (item, { heard, verdict }) => …`;
   `lastHeard` becomes `heard` in the body. Packs built in a script module (`oralSentenceStudioPack`, `storyBridgeScript`,
   `storyRibbonScript`, `youAndMeScript`, `barModelExplanationScript`, `fractionTouchScript`,
   `spatialSceneDescriptionScript`, `rampExplanationScript`) rename in the builder.
2. **Reword every `observed` fallback.** Voice with no transcript → `'No transcript was captured.'`. Gesture → what was
   committed, read from the pack's refs (`Tapped the card "${tappedRef.current}".`); when the ref is empty →
   `'Tapped …; which one was not recorded.'` Never "wrong", "did not match", "incorrect", "does not support". Return
   `null` only when there is truly nothing factual to record (an unscored planning step, as read-aloud-studio does).
3. **State the stimulus in `challenge`.** The line, the sentence, the solid, the picture, the printed word, the story
   clue: whatever the child was looking at or listening to. A mode name alone is not a challenge. The `expected` field
   already carries the key, so naming the stimulus leaks nothing (the evidence is never shown to the child).
4. **Refs are read before reset.** The runner calls `observation` before `applyVerdict`, on affirmed and corrected
   alike, so a gesture ref still holds the committed state; do not clear refs in `onAffirmed` before that call (none of
   the 45 does today; check when a pack resets in a verdict handler).
5. **Submit the responses** (found in Phase A). The runner keeps them in `summary.learningResponses`, but capture and
   the preview read `studentWork.learningResponses`, and most hosts never copied it: add
   `learningResponses: summary.learningResponses` to the component's student work. A beat hosted inside a larger
   primitive (bar-model, spatial-scene) records it on its per-challenge result and the host submits the combined list.
   The capture test fails without this line.
6. **Do not touch cues, sentinels or items.** The wire (`JudgedCueSurface`) is untouched by this migration; the DI
   drive adapters do not read the callback.

## Phases

Order inside a phase: declared sources first (their census baseline exists), then the rest. The gesture count is the
number of gesture branches or ref reads inside the observation block; it is the effort signal.

### Phase A — math (11 packs; 4 declared)

| Pack | File | Gesture | Verdict strings | Declared | Adapter |
|---|---|---|---|---|---|
| compare-objects | `math/CompareObjects.tsx` | 5 | 1 | yes | yes |
| sorting-station | `math/SortingStation.tsx` | 0 | 1 | yes | yes |
| fraction-circles (touch) | `math/fractionTouchScript.ts` | 0 | 0 | yes | yes |
| bar-model (explanation) | `math/barModelExplanationScript.ts` | 0 | 0 | yes | no |
| number-bond | `math/NumberBond.tsx` | 16 | 1 | no | yes |
| addition-subtraction-scene | `math/AdditionSubtractionScene.tsx` | 8 | 1 | no | yes |
| number-sequencer | `math/NumberSequencer.tsx` | 11 | 0 | no | yes |
| shape-sorter | `math/ShapeSorter.tsx` | 0 | 1 | no | yes |
| balance-scale (equality, workshop) | `math/BalanceScaleEquality.tsx`, `math/BalanceScaleWorkshop.tsx` | 0 | 0 | no | no |
| spatial-scene (description) | `math/spatialSceneDescriptionScript.ts` | 0 | 0 | no | no |

Number-bond, addition-subtraction-scene and number-sequencer are gesture packs: their observation must describe the
committed bond, scene or order from the refs on every attempt, and that is the work in this phase.

### Phase B — literacy (18 packs; 9 declared)

| Pack | File | Gesture | Verdict strings | Declared | Adapter |
|---|---|---|---|---|---|
| letter-sound-link | `literacy/LetterSoundLink.tsx` | 7 | 2 | yes | yes |
| letter-spotter | `literacy/LetterSpotter.tsx` | 6 | 2 | yes | yes |
| phoneme-explorer | `literacy/PhonemeExplorer.tsx` | 0 | 1 | yes | yes |
| read-aloud-studio | `literacy/ReadAloudStudio.tsx` | 5 | 1 | yes | no |
| rhyme-studio | `literacy/RhymeStudio.tsx` | 2 | 1 | yes | yes |
| sentence-analyzer | `literacy/SentenceAnalyzer.tsx` | 0 | 1 | yes | yes |
| syllable-clapper | `literacy/SyllableClapper.tsx` | 0 | 1 | yes | yes |
| word-builder | `primitives/WordBuilder.tsx` | 0 | 1 | yes | yes |
| oral-sentence-studio | `literacy/oralSentenceStudioScript.ts` | 0 | 0 | yes | no |
| word-workout | `literacy/WordWorkout.tsx` | 5 | 5 | no | yes |
| interactive-book | `literacy/InteractiveBook.tsx` | 5 | 2 | no | yes |
| genre-explorer, story-talk, text-structure-analyzer, word-sorter | `literacy/*.tsx` | 0 | 1 each | no | yes |
| story-bridge, story-ribbon, you-and-me | `literacy/*Script.ts` | 1, 0, 0 | 0 | no | story-bridge only |

Sentence-analyzer's census abstain (a different confusable per item) is the fixture; its `observed` text is fine.
Word-workout has five verdict strings, one per branch.

### Phase C — direct instruction (5 packs; all declared)

| Pack | File | Gesture | Verdict strings | Adapter |
|---|---|---|---|---|
| di-deduction | `direct-instruction/DiDeduction.tsx` | 0 | 1 | yes |
| di-worked-procedure | `direct-instruction/DiWorkedProcedure.tsx` | 0 | 1 | yes |
| di-spoken-practice | `direct-instruction/DiSpokenPractice.tsx` | 0 | 1 | yes |
| di-word-problem-setup | `direct-instruction/DiWordProblemSetup.tsx` | 7 | 1 | yes |
| di-dice-roll | `direct-instruction/DiDiceRoll.tsx` | 1 | 1 | no |

di-word-problem-setup's gesture is the placed big number; the observation must state the story numbers and what was
placed. di-dice-roll has no drive adapter, so its census row stays "not driveable" until `/tutor-test` adds one.

### Phase D — science, history, other (11 packs; none declared)

| Pack | File | Gesture | Verdict strings |
|---|---|---|---|
| knowledge-check | `primitives/KnowledgeCheck.tsx` | 1 | 1 |
| periodic-table | `primitives/PeriodicTable.tsx` | 5 | 1 |
| solar-system-explorer | `astronomy/SolarSystemExplorer.tsx` | 2 | 1 |
| habitat-diorama | `biology/HabitatDiorama.tsx` | 2 | 2 |
| matter-explorer, states-of-matter | `chemistry/*.tsx` | 0 | 1 each |
| cause-effect-chain, era-explorer | `history/*.tsx` | 6, 0 | 1 each |
| push-pull-arena | `physics/PushPullArena.tsx` | 12 | 1 |
| ramp-lab (explanation) | `engineering/rampExplanationScript.ts` | 0 | 0 |
| calendar-explorer | `calendar/CalendarExplorer.tsx` | 0 | 0 |

Student-work richness only; no census baseline. Push-pull-arena and cause-effect-chain are the gesture packs.

### Phase E — delete the alias

Grep for `diagnosisObservation` outside tests returns nothing. Then: delete the field and its docblock from
`hooks/judgedScriptContract.ts`; delete the legacy `else if (corrected && item)` branch in
`hooks/useJudgedScriptRunner.ts`; delete the fallback in `evaluation/diagnosis/judgedEvidenceCensus.test.tsx`; delete the
"legacy alias ignored" line of the one-callback test in `hooks/useJudgedScriptRunner.test.tsx`; drop the alias sentence
from `.claude/skills/add-misconception-loop/SKILL.md` Phase 2. Full census rerun (`RUN=alias-final STAGES=G,E,D`) as
the closing check.

## Verification per phase

| Check | How |
|---|---|
| The pack still compiles and its cues are byte-identical | `npm run typecheck:lumina` 0; the family's `*.di-script.test.ts`, `*.di-stage.test.tsx` and `pip/*.surface.test.tsx` pass |
| The callback records right answers and states the stimulus | one mounted capture test per phase on a declared source (template `literacy/LetterSpotter.capture.test.tsx`): a wrong-first run submits `learningResponses` with the affirmed attempts, `observed` text without verdict words, and `challenge` naming the stimulus |
| Declared sources still reach the distiller with usable evidence | `RUN=alias-<family> STAGES=G,E,D node scripts/misconception-harness/judged-evidence-census.mjs --only <ids>`; compare each source's hypothesis with `artifacts/learning-applicability/judged-census/run2` (and run4 for the repaired four). A source that named its signature miss in run2 and abstains now blocks the phase |
| No verdict words remain | `grep -rn "judged .* wrong\|did not match\|does not support" primitives/` returns nothing in the migrated files |
| Phase close | full vitest green outside known flakes (`layout/AppChrome.test.tsx` is a known cold lazy-import flake); item 18 entry and the `WORKSTREAMS.md` row; ship the phase before the next one starts, because every phase touches many files a concurrent sweep may also touch |

## Baselines to compare against

`artifacts/learning-applicability/judged-census/run2/report.json` (23 sources, 09-14) and `run4` (the repaired four).
Hypotheses that named the signature miss in run2: base-ten-blocks, di-deduction, di-spoken-practice,
di-word-problem-setup, di-worked-procedure, letter-sound-link, letter-spotter, oral-sentence-studio, phoneme-explorer,
place-value-chart, rhyme-studio, sorting-station, syllable-clapper, word-builder; run4 added ordinal-line.

## Not in this handoff

- The census-only single-rule fixtures for the three fixture abstains (decodable-reader, 3d-shape-explorer,
  picture-vocabulary), and drive adapters for di-dice-roll and read-aloud-studio: `/tutor-test`.
- cvc-speller, phonics-blender, sound-swap, word-flip run on `useJudgedSpeechLoop`, not the runner; their `accuracy < 60`
  self-gate is a separate item.
