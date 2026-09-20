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
| `math/CountingBoard.tsx` | live (`countingBoardLive.ts`) + standalone | **domain extracted** (S1). Hosts both controllers; picks by `useLiveRuntime()`. Legacy branch is S3. |
| `math/ShapeSorter.tsx` → `ShapeSorterTeaching.tsx` | live (`shapeSorterLive.ts`) + standalone | **domain extracted** (S1). `identify` is on the workspace; `count`, `sort`, `identify-real-object` are not. |
| `math/NumberSequencer.tsx` | live (`numberSequencerLive.ts`) + standalone | legacy |
| `math/BalanceScaleEquality.tsx` | standalone | legacy |
| `math/BalanceScaleWorkshop.tsx` | standalone | legacy |
| `math/BaseTenBlocksDi.tsx` | standalone | legacy |
| `math/BarModelExplanation.tsx` | standalone | legacy |
| `math/FractionTouch.tsx` | standalone | legacy |
| `math/SpatialScene.tsx` | standalone | legacy |
| `literacy/CvcSpeller.tsx` | standalone | legacy — calls BOTH runner hooks |
| `literacy/PhonicsBlender.tsx` | standalone | legacy — calls BOTH runner hooks |
| `literacy/SoundSwap.tsx` | standalone | legacy — calls BOTH runner hooks |
| `literacy/WordFlip.tsx` | standalone | legacy — calls BOTH runner hooks |
| `literacy/YouAndMe.tsx` | standalone | legacy |
| `direct-instruction/DiLetterSounds.tsx` | standalone | legacy |
| `direct-instruction/DiMathFacts.tsx` | standalone | legacy |
| `direct-instruction/DiSentenceReading.tsx` | standalone | legacy |
| `direct-instruction/DiShapes.tsx` | standalone | legacy |
| `direct-instruction/DiWordReading.tsx` | standalone | legacy |
| `engineering/RampInvestigation.tsx` | standalone | legacy |
| `components/di-bench/DirectInstructionBench.tsx` | bench harness | legacy — a test surface, not a learner one |

The nine other live adapters (`ten-frame`, `number-line`, `number-bond`, `ordinal-line`,
`sorting-station`, `compare-objects`, `place-value-chart`, `number-tracer`,
`comparison-builder`) do not call a runner hook from their component. They are LA-04
adoptions on the live runtime, and they are not part of this retirement's consumer list.

## Real lesson entry: S2 wired for two pilot modes

`LessonScreen` now mounts `LessonWorkspaceProvider`. `OrderedSection` supplies the
runtime only to eligible Counting Board `count` and Shape Sorter `identify` surfaces,
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
| Sibling modes on a part-migrated primitive | shape-sorter (`count`, `sort`, `identify-real-object`), counting-board (ten kinds) | S3. A migrated mode does not retire its siblings. |

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
