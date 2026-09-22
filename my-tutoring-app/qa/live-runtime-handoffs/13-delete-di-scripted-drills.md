# Delete the four DI packs' scripted drills (LA-14 S5, pilot)

Date: 2026-09-22 · Owner: roadmap LA-14 · Executor: `/add-live-tutor-tools` (owns the spoken DI
migration and edits its packs in place, user ruling 09-21) · Plan:
[07-sunset-scripted-tutoring.md](07-sunset-scripted-tutoring.md) · Per-surface state:
[07-census.md](07-census.md)

## Why this slice

`di-letter-sounds`, `di-word-reading`, `di-math-facts` and `di-sentence-reading` each ship two
complete teaching paths. `withTeachingWorkspace` chooses between them when the component mounts:

| Path | Per pack | Example (sentence reading) |
|---|---|---|
| Scripted drill (retiring) | `Scripted*` component in `Di*.tsx` + `di*Script.ts` | ~1,190 lines |
| Teaching workspace | `Di*Teaching.tsx` + `di*Domain.ts` + adapter | ~370 lines |

The four packs total about 4,400 lines in `Di*.tsx` + `di*Script.ts`, and most of that is the
drill. Every catalog mode of all four already binds the workspace in lessons and in Pulse.

The drill still exists because of three recorded blockers (handoff 12, README):
1. lesson sections with more than one objective, which were said to need per-objective
   attribution;
2. the domain testers;
3. the DI drive harness (`DI_PORTS`, `--di`).

**Blocker 1 is not reachable in production.** Check it (step 0) instead of building attribution:
- `service/manifest/flattenManifest.ts:152`: every objective-block component gets exactly
  `objectiveIds: [block.objectiveId]`.
- The only multi-objective layout items are the curator brief (not a primitive) and the final
  assessment (`flattenManifest.ts:182`). The final assessment's schema limits `componentId` to
  `knowledge-check | flashcard-deck` (`service/manifest/gemini-manifest.ts:264`). The Pulse check
  manifest hard-codes `knowledge-check`.
- Pulse binds with `objectiveIds: [currentSpec.subskill_id]` (`pulse/PulseActivityRenderer.tsx:255`).
- Handoff 12: none of the 62 saved lesson-bench packages has a multi-objective section.

So the per-objective attribution work queued for `/student-data-loop` is **not** a prerequisite for
deleting these drills. Blended-pin per-item recording (user ruling 09-21) is also separate. Both
paths already file a blend the same way, so it doesn't block deletion either.

## Scope

In: the four DI packs above. Pilot on **`di-sentence-reading`**, exercise it at runtime, then sweep
the other three (pilot-then-sweep).

Out:
- `letter-sound-link`, `counting-board`, `number-sequencer` and `shape-sorter`. They also bind
  every mode, but their scripted component is the primitive's original tap UI. Deleting it needs
  its own decision about the no-tutor experience.
- The shared runner (`useJudgedScriptRunner`, `useJudgedSpeechLoop`). About 60 other primitives
  still use it (S4).
- The other DI packs (`DiShapes`, `DiDeduction`, `DiDiceRoll`, `DiSpokenPractice`,
  `DiWordProblemSetup`, `DiWorkedProcedure`). They have no workspace binding yet.

## Steps

### 0. Confirm blocker 1 is unreachable (probe, not grep)

Run every saved lesson-bench package, plus a fresh batch of real manifests for K–1 literacy and math
topics that select these packs, through `flattenManifestToLayout` → `lessonWorkspaceItems`. Record
every section of the four packs that does not bind, with its reason.

Expected: zero sections with ≠1 objective. If one appears, stop and record which producer made it;
that producer, not the drill, is the thing to fix.

Also list the other ways a section of these packs can fail to bind in a lesson
(`lessonWorkspacePlan.ts:31-44`): no pin, a pin outside the catalog, `validate` throws, no
challenges, `audience: 'caregiver'`. Each of these currently falls back to the drill silently.
After deletion there is no fallback, so each needs a decision in step 2.

### 1. Move the remaining consumers off the drill

- **`components/DirectInstructionPrimitivesTester.tsx:102-108`** mounts the packs with no runtime,
  so it gets the drill. Mount them inside a workspace host instead (`WorkspaceHostProvider` or
  `runtime/LiveRuntimeLab.tsx`), using the generated mode as the pin.
- **DI drive harness:** check which `DI_PORTS` entries in `service/qa/di/diDrivePlan.ts` and
  `app/api/lumina/tutor-test/route.ts` still drive these four. Retire those entries; the workspace
  journey (`backend/tests/tutor_live/run_live_runtime.py --lesson-entry --audio`) replaces them.
  Keep generator probes and saved audio evidence.
- **`di*Script.ts` re-exports** used outside the pack: `knowledgeCheckScript.ts`,
  `literacy/{decodableReader,readAloudStudio,wordWorkout}Script.ts` and
  `service/qa/lessonBench/journey/extract.ts` import constants such as `MAX_SENTENCE_WORDS`.
  Point them at `di*Domain.ts`, which already owns those constants.
- **`components/live-activity/liveRenderers.tsx:70-74`** already mounts under a runtime. Confirm
  it still does.

### 2. Delete the drill

Per pack:
- Export the teaching component directly from `Di*.tsx`. Remove `ScriptedDi*` and the
  `withTeachingWorkspace` wrapper.
- Keep `Di*Data` and the other types the generator and registry use.
- Delete `di*Script.ts` and its script-only tests (`*Script.support-tiers.test.ts`). Move any
  assertion that tests domain facts rather than script wording into the domain's tests.

Replace the silent fallback with a visible state. When the component mounts with no runtime, or
its section did not bind, it should render a plain "this activity needs the tutor" state and log
the unbind reason in development. It must not render a blank or stalled stage. Per the 09-20
ruling, an unbindable section is a defect to surface and fix, never a mode to route around.

Close the mechanism, not the symptom: grep the diff for anything that still imports the deleted
modules, and update `07-census.md` rows for these four packs.

### 3. Docs and queues

- In `07-sunset-scripted-tutoring.md`, correct the "multi-objective sections need attribution"
  blocker with the step-0 evidence.
- Update the README "Next session" line and the WORKSTREAMS row ("next pull … or multi-objective
  lesson sections").
- Update `/add-live-tutor-tools` if it still describes the DI drill as a fallback.

## Verification

- `npm run typecheck:lumina` = 0; full `tsc` error count unchanged from baseline (770 on 09-22).
- Focused suites: the four packs' `*.teaching.test.tsx`, `DiLessonIsolation.test.tsx`,
  `live-activity/`, `pulse/`, and the literacy scripts whose imports moved.
- Runtime, pilot first: a connected `--lesson-entry --audio` journey for `di-sentence-reading`
  reaching settled completion and one evaluation submission. Its real JEV and learner-intent probes
  were never run when it was adopted (09-22 report). Run them here, because after this slice the
  workspace is the only path.
- Then the same journey for each of the other three packs.
- The DI tester renders all four packs under the workspace host (screenshot from the real host).
- Browser check owed: a lesson and a Pulse item for one pack (HUMAN-CHECKS #167).

## Exit

- No importer of `di{LetterSounds,WordReading,MathFacts,SentenceReading}Script`.
- No `withTeachingWorkspace` wrapper on these four packs.
- No `DI_PORTS` entry for them.
- An unbound mount renders a visible state, never the old drill.
- Step-0 probe results saved under `qa/tutor-reports/`.
