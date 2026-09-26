# Scripted-tutoring retirement census (S0)

Companion to [07-sunset-scripted-tutoring.md](07-sunset-scripted-tutoring.md), which
owns the plan. This file owns the per-surface state. Update a row here when its state
changes; do not open a second backlog.

Built 2026-09-19 by classifying every non-test file under `my-tutoring-app/src` that
names `useJudgedScriptRunner`, `useJudgedSpeechLoop`, `JudgedScriptPack`,
`JudgedScriptRun`, `JudgedScriptItem`, `judgedScriptContract`, `judgedLoopModel` or
`useTeachingWorkspace`. **169 files.** A file is counted once, by its strongest claim.

| Class | Files | What it means |
|---|---|---|
| `RUNNER` | 22 | Calls a runner hook. 20 are surfaces; 2 are the hooks themselves. |
| `PACK` | 92 | Builds or types a cue pack. Domain content and cue wording are mixed in most. |
| `TYPES` | 52 | Type-only or constant-only coupling. Cheapest to cut, but not a consumer. |
| `WORKSPACE` | 3 | On the destination contract. |

`PACK` and `TYPES` counts fall as `RUNNER` rows migrate; they are not independent work.

## Active runner call sites — the real consumer list

These 20 surfaces are what S3–S5 must migrate or delete. A `live` entry point means the
primitive has an adapter in `components/live-activity/adapters/` and can be mounted by
the tutor-driven host; everything else runs only its standalone scripted drill.

| Surface | Entry points | State |
|---|---|---|
| `math/CountingBoard.tsx` | live (`countingBoardLive.ts`) + ordinary lessons + Pulse + standalone | **domain extracted** (S1). Hosts both controllers; picks by `useLiveRuntime()`. **S3 slice 2 DONE 09-21:** Pulse binds it (item's `eval_mode_name` as the pin, shared `workspaceBinding`), and Practice is deleted. Drill callers left: domain testers, the DI drive harness (`DI_PORTS`, `--di`), lesson sections with more than one objective, and content that fails the mode gate. [Report](../tutor-reports/pulse-on-workspace-2026-09-21.md). |
| `math/ShapeSorter.tsx` → `ShapeSorterTeaching.tsx` | live (`shapeSorterLive.ts`) + standalone | **all four catalog modes on the workspace** (2026-09-22): `count`, `sort` and `find_real_object` joined `identify`. `identify`, `find_real_object` and `count` are connected-journey verified; `sort` is mechanically correct but under-confidently refused by the shared observer at a higher rate (LA-13 family, new domain evidence). [Report](../tutor-reports/shape-sorter-siblings-teaching-2026-09-22.md). |
| `math/NumberSequencer.tsx` | live (`numberSequencerLive.ts`) + standalone | **domain extracted + five modes on the workspace** (S1+S2, 09-19). `count_from`, `before_after`, `fill_missing`, `spot_error`, `decade_fill` mount `NumberSequencerTeaching`. `order_cards` is bound again since 09-20 (user ruling: no mode is withheld from lessons). **S3 slice 1 DONE 09-21:** blended and `mixed` pins now run on the workspace (shared rule `pinBindsWorkspace`: every mode the pin names binds), so no host mounts the drill under a runtime, and its live branch (`useNumberSequencerRuntime`, misstep aids, completion cue, auto-start) is deleted. [Report](../tutor-reports/blend-pins-on-workspace-2026-09-21.md). **S3 slice 2 DONE 09-21:** Pulse binds it (item's `eval_mode_name` as the pin, shared `workspaceBinding`), and Practice is deleted. Drill callers left: domain testers, the DI drive harness (`DI_PORTS`, `--di`), lesson sections with more than one objective, and content that fails the mode gate. [Report](../tutor-reports/pulse-on-workspace-2026-09-21.md). |
| `math/BalanceScaleEquality.tsx` | live + ordinary lessons | **scripted path deleted 09-23**: workspace only (`withWorkspaceOnly`, `useWorkspaceRunner`; the plain solver too). An unbound mount shows the needs-the-tutor card. `balanceEqualityScript.ts` and `balanceScaleControllers.ts` deleted; `equalityItems` moved to `balanceEqualityModel.ts`. [Report](../tutor-reports/workspace-rollout-B1-2026-09-23.md) |
| `math/BalanceScaleWorkshop.tsx` | live + ordinary lessons | **scripted path deleted 09-23**: workspace only (`withWorkspaceOnly`, `useWorkspaceRunner`). `balanceWorkshopScript.ts` deleted; `workshopItems`/`workshopAsk` moved to `balanceWorkshopModel.ts`. [Report](../tutor-reports/workspace-rollout-B1-2026-09-23.md) |
| `math/BaseTenBlocksDi.tsx` | live + ordinary lessons | **scripted path deleted 09-23**: both surfaces (this spoken mat and the click mat in `BaseTenBlocks.tsx`) are `withWorkspaceOnly`; an unbound mount shows the needs-the-tutor card. Runner cues and judging contracts removed from `baseTenScript.ts`; `DI_PORTS` entry retired. Bound in batch B1. [Report](../tutor-reports/workspace-rollout-B1-2026-09-23.md) |
| `math/BarModelExplanation.tsx` | deleted | **deleted 09-23** with bar-model's whole scripted path (`withWorkspaceOnly`; an unbound mount shows the needs-the-tutor card). The two spoken modes bind in `BarModel` with `expectedAnswer` (batch B1). [Report](../tutor-reports/workspace-rollout-B1-2026-09-23.md) |
| `math/FractionTouch.tsx` | live + ordinary lessons | **scripted path deleted 09-23**: the picture touch, the plain circle and the mixed chain are workspace-only (`withWorkspaceOnly`; an unbound mount shows the needs-the-tutor card). `fractionTouchScript.ts` deleted; its item builder moved to `fractionCirclesWorkspace.ts`; the `DI_PORTS` entry is retired. [Report](../tutor-reports/workspace-rollout-B1-2026-09-23.md) |
| `math/SpatialScene.tsx` | live + ordinary lessons | **workspace only 09-24** (batch B3), plain shape (`useWorkspaceProgress`): every check commits, a wrong direction step is a checked miss that keeps prior steps, and `describe_scene` is spoken (the nested judged runner and every scripted cue are gone). `spatialSceneDescriptionScript.ts` stays for `modelSpatialDescription`. [Report](../tutor-reports/workspace-rollout-B3-2026-09-24.md) |
| `math/AdditionSubtractionScene.tsx` | live + ordinary lessons | **workspace only 09-25** (batch C4): `withWorkspaceOnly`, `useWorkspaceRunner`; solve-story and Grade 1 act-out are one spoken number; act-out at K, create-story and build-equation commit on stillness and the activity checks them (`commitGesture`). A change group that waits for the story arrives on `present` (tutor) or Show me (learner). The runner-mock reader-fit and Pip suites moved into `AdditionSubtractionScene.workspace.test.tsx`. `additionSubtractionSceneScript.ts` stays for its build gates, the DI drive plan and pure tests. [Report](../tutor-reports/workspace-rollout-C4-2026-09-25.md) |
| `literacy/LetterSoundLink.tsx` → `LetterSoundLinkTeaching.tsx` | live (`letterSoundLinkLive.ts`) + ordinary lessons + standalone | **workspace verified** (dev host, 2026-09-20). Domain extracted (`letterSoundLinkDomain.ts`); all three modes bind, and `bindsTeachingWorkspace` puts them in ordinary lessons. First literacy adopter outside the DI packs and the first with TWO channels: `hear_see` is a checked TAP that publishes NO `expectedAnswer` and offers NO `demonstrate`. [Report](../tutor-reports/letter-sound-link-teaching-2026-09-20.md). **S3 slice 2 DONE 09-21:** Pulse binds it (item's `eval_mode_name` as the pin, shared `workspaceBinding`), and Practice is deleted. Drill callers left: domain testers, the DI drive harness (`DI_PORTS`, `--di`), lesson sections with more than one objective, and content that fails the mode gate. [Report](../tutor-reports/pulse-on-workspace-2026-09-21.md). |
| `literacy/CvcSpeller.tsx` | live + ordinary lessons | **workspace only 09-24** (batch B2): `withWorkspaceOnly`, `useWorkspaceRunner`; the two spoken modes are judged against the middle sound, `spell-word` is a checked gesture (the third letter commits, Try again keeps right letters); the speech loop, mic panel and Live connect are gone; an unbound mount shows the needs-the-tutor card. `cvcSpellerScript.ts` stays for `spokenVowel`/`vowelKeyword` and its pure script tests. [Report](../tutor-reports/workspace-rollout-B2-2026-09-24.md) |
| `literacy/PhonicsBlender.tsx` | live + ordinary lessons | **workspace only 09-24** (batch B2, straight to one path): `withWorkspaceOnly`, `useWorkspaceRunner`; the `useJudgedSpeechLoop` progression, mic panel and Live connect are gone; an unbound mount shows the needs-the-tutor card. `phonicsBlenderScript.ts` stays for `BlendItem` and the lesson bench's `extract.ts`. [Report](../tutor-reports/workspace-rollout-B2-2026-09-24.md) |
| `literacy/SoundSwap.tsx` | live + ordinary lessons | **workspace only 09-24** (batch B2): `withWorkspaceOnly`, `useWorkspaceRunner`; the speech loop, mic panel and Live connect are gone; an unbound mount shows the needs-the-tutor card. `soundSwapScript.ts` stays for `moveAsk` and its pure script tests. [Report](../tutor-reports/workspace-rollout-B2-2026-09-24.md) |
| `literacy/WordFlip.tsx` | live + ordinary lessons | **workspace only 09-24** (batch B2): `withWorkspaceOnly`, `useWorkspaceRunner`; the speech loop, mic panel and Live connect are gone; an unbound mount shows the needs-the-tutor card. `wordFlipScript.ts` stays for `countWord` and its pure script tests. [Report](../tutor-reports/workspace-rollout-B2-2026-09-24.md) |
| `literacy/YouAndMe.tsx` | live + ordinary lessons | **workspace only 09-24** (batch B3): `withWorkspaceOnly`, `useWorkspaceRunner`; each turn is one spoken sentence judged on its subject pronoun from the speaking role. `youAndMeScript.ts` stays for its sentence helpers and pure tests. [Report](../tutor-reports/workspace-rollout-B3-2026-09-24.md) |
| `literacy/SyllableClapper.tsx` | live + ordinary lessons | **workspace only 09-24** (batch C1): `withWorkspaceOnly`, `useWorkspaceRunner`; every item is one spoken answer (the blended word, the count, or the word left); the scene's `voicing` fact tells the tutor how to say the stimulus per act. `syllableClapperScript.ts` stays for its item gates, the DI drive plan and pure tests. [Report](../tutor-reports/workspace-rollout-C1-2026-09-24.md) |
| `literacy/RhymeStudio.tsx` | live + ordinary lessons | **workspace only 09-24** (batch C1): `withWorkspaceOnly`, `useWorkspaceRunner`; every item is one spoken answer (yes or no, the rhyming choice, any rhyme, or a new rhyme for the family); a credited collection answer fills its spot with the word said (`onAffirmed` now receives the credited response). `rhymeStudioScript.ts` stays for its item builder, the DI drive plan and pure tests. [Report](../tutor-reports/workspace-rollout-C1-2026-09-24.md) |
| `literacy/PhonemeExplorer.tsx` | live + ordinary lessons | **workspace only 09-24** (batch C1): `withWorkspaceOnly`, `useWorkspaceRunner`; every item is one spoken answer (a card word, the blended word, the sound count or the new word) judged against the pack's answer; the task is the pack's own ask (`askFor`, now exported). `phonemeExplorerScript.ts` stays for its item gates, the DI drive plan and pure tests. [Report](../tutor-reports/workspace-rollout-C1-2026-09-24.md) |
| `literacy/WordWorkout.tsx` | live + ordinary lessons | **workspace only 09-24** (batch C1): `withWorkspaceOnly`, `useWorkspaceRunner`; every item is one spoken read or answer judged against the pack's key, except picture match, a gesture the activity checks (`commitGesture`; its key never reaches the tutor). Chain fluency is timed open-to-credit. `wordWorkoutScript.ts` stays for its build gates, the DI drive plan and pure tests. [Report](../tutor-reports/workspace-rollout-C1-2026-09-24.md) |
| `WordBuilder.tsx` | live + ordinary lessons | **workspace only 09-24** (batch C2): `withWorkspaceOnly`, `useWorkspaceRunner`; every item is one spoken word built from the parts board, asked by its meaning; the pool is `targets`. `wordBuilderScript.ts` stays for its build gates, the DI drive plan and pure tests. [Report](../tutor-reports/workspace-rollout-C2-2026-09-24.md) |
| `literacy/WordSorter.tsx` | live + ordinary lessons | **workspace only 09-24** (batch C2): `withWorkspaceOnly`, `useWorkspaceRunner`; every item is one spoken group name or bank partner; a credited word is filed on its mat from the component's own credited ledger. `wordSorterScript.ts` stays for its build gates, the DI drive plan and pure tests. [Report](../tutor-reports/workspace-rollout-C2-2026-09-24.md) |
| `literacy/PictureVocabulary.tsx` | live + ordinary lessons | **workspace only 09-24** (batch C2): `withWorkspaceOnly`, `useWorkspaceRunner`; five modes are one spoken word judged against the pack's answer (association is an open set), and receptive match is a card tap the activity checks (`commitGesture`; its key never reaches the tutor). `pictureVocabularyScript.ts` stays for its build gates, the DI drive plan and pure tests. [Report](../tutor-reports/workspace-rollout-C2-2026-09-24.md) |
| `literacy/LetterSpotter.tsx` | live + ordinary lessons | **workspace only 09-24** (batch C2): `withWorkspaceOnly`, `useWorkspaceRunner`; name it is one spoken letter (name or sound), find it and match it are taps the activity checks (`commitGesture`). Confusion pairs come from checked taps and from single-letter spoken misses in the scored attempts. `letterSpotterScript.ts` stays for its build gates, the DI drive plan and pure tests. [Report](../tutor-reports/workspace-rollout-C2-2026-09-24.md) |
| `literacy/DecodableReader.tsx` | live + ordinary lessons | **workspace only 09-25** (batch C3): `withWorkspaceOnly`, `useWorkspaceRunner`; every item is spoken: a printed line read aloud cold, a one-word answer from the story (literal, read_along), or which printed choice is right (sequence, inference, main_idea). Items are built from the passage and its questions, so the drive harness runs the whole story. `decodableReaderScript.ts` stays for its build gates, the DI drive plan and pure tests. [Report](../tutor-reports/workspace-rollout-C3-2026-09-25.md) |
| `literacy/InteractiveBook.tsx` | live + ordinary lessons | **workspace only 09-25** (batch C3): `withWorkspaceOnly`, `useWorkspaceRunner`; read the glowing word is spoken (the tutor reads the lead-in and stops), find a book part is a tap the activity checks (`commitGesture`, printed text against the target). `interactiveBookScript.ts` stays for its build gates, the DI drive plan and pure tests. [Report](../tutor-reports/workspace-rollout-C3-2026-09-25.md) |
| `literacy/StoryBridge.tsx` | live + ordinary lessons | **workspace only 09-25** (batch C3): `withWorkspaceOnly`, `useWorkspaceRunner`; match characters, match settings, the picture Venn diagram and event sequences are taps the activity checks (`commitGesture`); say alike, say different and compare big ideas are spoken comparisons judged against a reference and both evidence sentences. `storyBridgeScript.ts` stays for its build gates, the DI drive plan and pure tests. [Report](../tutor-reports/workspace-rollout-C3-2026-09-25.md) |
| `literacy/StoryRibbon.tsx` | live + ordinary lessons | **workspace only 09-25** (batch C3): `withWorkspaceOnly`, `useWorkspaceRunner`; every item is one spoken account judged against the three event meanings (the tense modes in their time; story-to-experience a connection). The card board is a planning aid, never graded, and Try again keeps it. `storyRibbonScript.ts` stays for its build gates, the DI drive plan and pure tests. [Report](../tutor-reports/workspace-rollout-C3-2026-09-25.md) |
| `direct-instruction/DiLetterSounds.tsx` → `DiLetterSoundsTeaching.tsx` | live (`diLetterSoundsLive.ts`) + ordinary lessons + Pulse | **workspace verified** (dev host, 2026-09-19). All three modes bind; [Report](../tutor-reports/di-letter-sounds-teaching-2026-09-19.md). **S3 slice 2 DONE 09-21:** Pulse binds it (item's `eval_mode_name` as the pin, shared `workspaceBinding`), and Practice is deleted. [Report](../tutor-reports/pulse-on-workspace-2026-09-21.md). **LA-14 S5 DONE 09-22: scripted drill DELETED** (`di*Script.ts`, `Scripted*`, `withTeachingWorkspace` wrapper, drill-only Pip pose/tests). `Di*.tsx` exports the teaching component; an unbound mount renders a visible "needs the tutor" card (`DiTeachingStage`). Step-0 probe: 44/44 saved+fresh lesson sections bind, 0 multi-objective content sections. [Report](../tutor-reports/di-drill-deletion-2026-09-22.md). |
| `direct-instruction/DiMathFacts.tsx` → `DiMathFactsTeaching.tsx` | live (`diMathFactsLive.ts`) + ordinary lessons + Pulse | **workspace verified** (dev host, 2026-09-20). All five modes bind; 12/19 connected journeys — 6 of the 7 failures are the shared demonstration-narrated-not-performed family, with the modality split INVERTED from di-word-reading's. [Report](../tutor-reports/di-math-facts-teaching-2026-09-20.md). **S3 slice 2 DONE 09-21:** Pulse binds it (item's `eval_mode_name` as the pin, shared `workspaceBinding`), and Practice is deleted. [Report](../tutor-reports/pulse-on-workspace-2026-09-21.md). **LA-14 S5 DONE 09-22: scripted drill DELETED** (`di*Script.ts`, `Scripted*`, `withTeachingWorkspace` wrapper, drill-only Pip pose/tests). `Di*.tsx` exports the teaching component; an unbound mount renders a visible "needs the tutor" card (`DiTeachingStage`). Step-0 probe: 44/44 saved+fresh lesson sections bind, 0 multi-objective content sections. [Report](../tutor-reports/di-drill-deletion-2026-09-22.md). |
| `direct-instruction/DiSentenceReading.tsx` → `DiSentenceReadingTeaching.tsx` | live (`diSentenceReadingLive.ts`) + ordinary lessons | **domain extracted, all four modes bind** (2026-09-22, eighth adopter, fourth DI pack). `diSentenceReadingDomain.ts` split from the script the same way `diWordReadingDomain.ts` was; one demonstrable object (`sentence` — connected text has no per-letter sound-out sub-unit). 26/26 deterministic mounted-component tests, typecheck:lumina 0, full tsc 770 unchanged. **Real JEV probe, learner-intent probe (`--sentences` cases written) and a connected `--audio` journey are UNRUN** — deferred on user cost request, not yet workspace VERIFIED. [Report](../tutor-reports/di-sentence-reading-teaching-2026-09-22.md). **LA-14 S5 DONE 09-22: scripted drill DELETED** (`di*Script.ts`, `Scripted*`, `withTeachingWorkspace` wrapper, drill-only Pip pose/tests). `Di*.tsx` exports the teaching component; an unbound mount renders a visible "needs the tutor" card (`DiTeachingStage`). Step-0 probe: 44/44 saved+fresh lesson sections bind, 0 multi-objective content sections. [Report](../tutor-reports/di-drill-deletion-2026-09-22.md). |
| `direct-instruction/DiShapes.tsx` | live + ordinary lessons | **workspace only 09-24** (batch B3): on `DiTeachingStage` like the other spoken DI packs; the scripted drill, stall card and Live connect are gone. `diShapesScript.ts` stays for its helpers, the generator and the DI drive harness. Pip restored 09-24 on the shared stage for all five packs ([report](../pip-surface/di-teaching-stage-2026-09-24.md)); response timing and the misconception packet are still owed (`qa/di/BACKLOG.md` item 18). [Report](../tutor-reports/workspace-rollout-B3-2026-09-24.md) |
| `direct-instruction/DiWordReading.tsx` → `DiWordReadingTeaching.tsx` | live (`diWordReadingLive.ts`) + ordinary lessons + Pulse | **workspace verified** (dev host, 2026-09-20). All four modes bind; `sight_word` has no clean connected run — it stalls on the shared observer finding. [Report](../tutor-reports/di-word-reading-teaching-2026-09-20.md). **S3 slice 2 DONE 09-21:** Pulse binds it (item's `eval_mode_name` as the pin, shared `workspaceBinding`), and Practice is deleted. [Report](../tutor-reports/pulse-on-workspace-2026-09-21.md). **LA-14 S5 DONE 09-22: scripted drill DELETED** (`di*Script.ts`, `Scripted*`, `withTeachingWorkspace` wrapper, drill-only Pip pose/tests). `Di*.tsx` exports the teaching component; an unbound mount renders a visible "needs the tutor" card (`DiTeachingStage`). Step-0 probe: 44/44 saved+fresh lesson sections bind, 0 multi-objective content sections. [Report](../tutor-reports/di-drill-deletion-2026-09-22.md). |
| `engineering/RampInvestigation.tsx` (in `RampLab.tsx`) | live + ordinary lessons | **workspace only 09-24** (batch B3), free exploration excepted (an ungraded sandbox with an inert controller). Every challenge is one item: compare/threshold/design/plan are the lab's own checks, explain is spoken; RampInvestigation's nested runner is gone. `rampExplanationScript.ts` stays for the DI drive harness. [Report](../tutor-reports/workspace-rollout-B3-2026-09-24.md) |
| `components/di-bench/DirectInstructionBench.tsx` | bench harness | legacy — a test surface, not a learner one |

`di-letter-sounds` joined the live adapters on 2026-09-19 as the fourth workspace
adopter — the first outside math, and the first DI pack. It was a standalone-only
surface before that slice. `di-word-reading` followed on 2026-09-20 as the fifth, and
its slice is where adoption should PAUSE: the sub-threshold-affirmation finding
reproduced outside produced sound and stalled a live lesson, so the next work is LA-13's
criterion rather than a sixth adopter. See the report above.

`letter-sound-link` is the seventh adopter (2026-09-20, user request to move to the main
literacy primitives). It is the first adopter whose tutor is NOT told the answer: `hear_see`
publishes no `expectedAnswer` and no demonstration, because a letter NAME is a blocked
response class and every object on that stage is an answer option. Its LA-13 contribution
contradicts the sixth adopter's reading — see the report.

`di-math-facts` is the sixth adopter (2026-09-20, user request for the next math
primitive). It is the cheapest available test of the LA-13 question, because its answer is
neither printed nor a produced phoneme: the sub-threshold shape does NOT reproduce on a
spoken number word (0.94–0.96 accepted, including a variant controlled for the prior
turn naming the target), so the failing family is not "produced sound" but "the child's
answer and the tutor's own model are the same utterance in the same channel". A separate
abstention DID stall one run, and a seven-cell isolation shows the word-reading remedy
does not cover it — the reply names the answer and is still refused; what rescues it is a
relational credit phrase. [Report](../tutor-reports/di-math-facts-teaching-2026-09-20.md).
The next pull is still LA-13's criterion, now with four domains of cases.

**CORRECTED 2026-09-20 (letter-sound-link adoption).** This paragraph used to say the
nine other live adapters (`ten-frame`, `number-line`, `number-bond`, `ordinal-line`,
`sorting-station`, `compare-objects`, `place-value-chart`, `number-tracer`,
`comparison-builder`) "do not call a runner hook from their component". They do:
`math/TenFrame.tsx:480` calls `useJudgedScriptRunner<TenFrameItem>`. Counting actual call
EXPRESSIONS rather than files that name the symbols finds **58 non-test primitive modules**,
not 20:

```bash
rg -l '= useJudgedScriptRunner\(|= useJudgedSpeechLoop\(|useJudgedScriptRunner<|useJudgedSpeechLoop<'   my-tutoring-app/src/components/lumina/primitives --glob '!*test*'
```

The 20-row table above is the list this retirement has been *working*, not the list that
exists. S3-S5 scope is larger than it states; re-derive from the command before planning a
deletion slice. The LA-04 adapters still differ from the rows above in that their live
path does not run the judged runner — which is what the table was reaching for.

## Real lesson entry: S2 wired for two pilot modes

`LessonScreen` now mounts `LessonWorkspaceProvider`. `OrderedSection` supplies the
runtime only to eligible Counting Board `count`, Shape Sorter `identify` and the five
spoken Number Train modes (09-19, [report](../tutor-reports/number-sequencer-teaching-2026-09-19.md)),
and only the focused surface registers. Both submit through the normal evaluation
provider; Kindergarten uses its existing submission-based navigation. Scroll focus,
back navigation, inactive surfaces and reconnect are covered in mounted renderer tests.
See [S2 report](../tutor-reports/lesson-workspace-wiring-2026-09-19.md) for scope and
connected-model results. Other modes/entry points still need migration; this does not
make the old shared runner deletable. Browser/mic acceptance remains #167.

## Deletion blockers, named

| Blocker | Held by | Removal gate |
|---|---|---|
| `opensWithSentinel` inside `isSayableLabel` | `math/shapeSorterDomain.ts` | S5. A generated sort label opening "Yes"/"My turn" would be read as a verdict by the judged runner. The gate stays live while any mode runs on that runner. This is the one import the shape-sorter domain still makes into the legacy contract. |
| `JudgedScriptRunnerOptions` / `JudgedScriptPack` in the board's option union | `math/CountingBoard.tsx` | S3. Confined to the file that hosts both controllers; the teaching controller no longer names them. |
| `RESPONSE_CLASSES` re-export from `judgedScriptContract` | ~90 pack modules | S5, and only as an address change. The benched-class registry itself is preserved — it moved to `hooks/teachingItemContract.ts`. |
| Sibling modes on a part-migrated primitive | ~~shape-sorter~~ **CLOSED 2026-09-22** (all four modes now bind), counting-board (ten kinds) | S3. A migrated mode does not retire its siblings. |
| ~~No learner-owned retry in the lesson shell~~ **FIXED 09-20** | `runtime/LiveRuntimeSurface.tsx` | The learner's Try again / Next challenge now lives in the shared shell and the lesson passes `learnerProgress`; every gesture mode is admitted. What the row used to say: a checked-wrong manipulation locks the surface until an observer transition reopens it, and **Try again** exists only in `LiveActivitySandbox`. Withheld number-sequencer `order_cards` on this; counting-board's gesture kinds have the same gap. |

## What S1 changed

- `hooks/teachingItemContract.ts` (new): the benched response-class registry and the
  `TeachingItem` base, lifted out of `judgedScriptContract` so a domain module can
  declare an item's answer class without importing the sentinel engine.
  `judgedScriptContract` re-exports them and `JudgedScriptItem extends TeachingItem`.
- `math/countingBoardDomain.ts` (new, split from `countingBoardScript.ts`): item kinds,
  number words, asks, build rules, harness answers. The script module keeps the
  correction/affirmation wording, the two-branch law and the pack base, and re-exports
  the domain so the generator, tester and drive plan keep one address.
- `math/shapeSorterDomain.ts` (new, split from `shapeSorterScript.ts`): geometry table,
  alternates, build gates, item builders, asks, scaffolds, harness answers. Same
  re-export arrangement.
- `math/useCountingTutorController.ts`: `CountingController` was
  `Pick<JudgedScriptRun<CountingItem>, …>`. It is now declared natively. The runner's
  own return type still satisfies it structurally, so the legacy branch needs no
  adapter today and nothing here changes when S3 deletes it.
- `math/ShapeSorterTeaching.tsx` now imports from `shapeSorterDomain`.
- The two live adapters (`adapters/countingBoardLive.ts`, `adapters/shapeSorterLive.ts`)
  import only domain content, so they now address the domain modules directly. The
  tutor-driven host no longer reaches a cue module for either pilot.

Verification: `typecheck:lumina` 0; full `tsc --noEmit` 770 errors, unchanged from the
pre-slice baseline; 6947 Lumina tests pass, 10 skipped. No runtime behavior was
exercised in this slice — S1 moved code between modules and inverted a type
dependency. The Counting Board demonstration failure recorded in the
[second-adopter report](../tutor-reports/shape-sorter-teaching-2026-09-19.md) is
untouched and still open.
