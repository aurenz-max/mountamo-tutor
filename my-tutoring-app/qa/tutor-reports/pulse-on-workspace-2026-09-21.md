# Pulse hosts the teaching workspace; Practice is deleted (LA-14 S3, slice 2)

Date: 2026-09-21 · Executor: `/add-live-tutor-tools` · Handoff: [12](../live-runtime-handoffs/12-pulse-practice-on-workspace.md)

## Entry points after this slice

| Entry | Path | Six workspace families |
|---|---|---|
| Home screen, Practice mode | IdleScreen → "Start practice" → `PulseSession` (new route, `activePanel 'pulse'`) | workspace when the item's `eval_mode_name` binds |
| Planner Dashboard → Start Pulse | `PulseSession` (dashboard itself has had no UI card since `1b3e2db2`) | same |
| Ordinary lessons | `LessonScreen` → `OrderedSection` | workspace (unchanged rule) |
| Domain testers, DI drive harness, multi-objective lesson sections | — | scripted drill (S5 / per-objective attribution) |

## What changed

- **One eligibility rule.** `workspaceBinding()` in `lessonWorkspacePlan.ts` is the per-primitive decision
  (primitive, pin, objectives, payload → binding or null). Lessons and Pulse both call it.
- **One host.** `LessonWorkspaceProvider` is now a thin caller of `WorkspaceHostProvider` (runtime +
  Live session + bridge). `WorkspaceSection` is the shared mounted half; `OrderedSection` and Pulse
  both use it.
- **Pulse binding** (`pulse/PulseWorkspace.tsx`, `PulseActivityRenderer.tsx`). Pin = the item's
  IRT-chosen `eval_mode_name`, objective = its subskill, plan item = its `item_id`. A bound item gets
  its own runtime, a lesson-mode Live session with the runtime packet, and the lesson's tutor face
  (`CuratorCompanion`, which owns the connecting/reconnect state). AIHelper is not rendered on it.
  Every other item is unchanged.
- **Session per bound item, not per run.** Unbound Pulse items keep their own per-item tutor
  (AIHelper's standalone connect); a run-wide lesson session would move them onto the lesson path.
  Pulse items are independent skills, so nothing is lost between them. Leaving the item unmounts the
  scope: transport closed, session disconnected, no path to the next item's runtime.
- **Generator pin (user ruling).** Pulse never passed `eval_mode_name` to the generator, so content
  matched the recorded mode only by chance and the content gate would refuse the binding. After the
  manifest, `generatePulseManifest` sets `visualPrimitive.targetEvalMode = eval_mode_name` when the
  manifest kept the item's `primitive_affinity` and the mode is in its catalog.
- **Practice deleted (user ruling: vestigial).** `PracticeModeEnhanced`, `PracticeManifestRenderer`,
  `PracticeSessionSummaryCard`, `SubjectSelector`, `PulseAdaptiveSession` + its adaptive engine,
  transition, summary and debug panel, the dead `usePulseSession`, the `practice-stream` route, the
  `generateQuests` / `generateWarmUpQuestion` / `generatePracticeAssessment` /
  `generatePracticeManifestAndHydrate` route actions and client wrappers, `quest-generator.ts`,
  `assessment-generator.ts`, `generatePracticeManifest` + `resolvePracticeEvalModes.ts`, and the
  Planner Dashboard's gate-2 Practice button.
- **Home Practice → Pulse (user ruling).** Pulse had no UI entry, so the removed home Practice was the
  only reachable practice surface. The slider stays; Practice mode's CTA opens `PulseSession`.
- **Pulse subjects fixed.** `'language-arts'` became `LANGUAGE-ARTS` in the backend graph lookup and
  `'reading'` has no graph; both failed with "No curriculum graph found". Now `LANGUAGE_ARTS` and
  `SOCIAL_STUDIES` (published graphs: 147 / 108 / 119 / 122 nodes for math / LA / science / SS).
  Mathematics and science values unchanged.

Size: host and binding ~220 lines added, ~6,000 lines of Practice code deleted; tests 295 lines.

## Submissions are identical (point 3)

`PulseActivityRenderer.workspace.test.tsx` completes each family through the real Pulse host and
asserts the evaluation Pulse receives and the `submitResult` call it makes:

| Family | `metrics.evalMode` | Pulse records `eval_mode` | Scripted drill source |
|---|---|---|---|
| counting-board | `count` | `count` | same shared `handleFinished` |
| number-sequencer | none | `eval_mode_name` | drill metrics carry no mode |
| letter-sound-link | none | `eval_mode_name` | drill metrics carry no mode |
| di-math-facts / di-letter-sounds / di-word-reading | session `challengeType` | same | `evalMode: data.challengeType` |

All-correct runs submit `success: true, score: 100` (Pulse `score: 10`) with the spec's skill and
subskill, exactly once. No field changed, so nothing went to `/student-data-loop`.

## Checks

- 12 mounted host tests (real renderer, runtime, observer, transport, evaluation provider, six real
  primitives): bound item mounts the workspace and never the runner; three unbound cases (no mode,
  mode not in the family, content not the pinned mode) keep the drill and AIHelper; one submission
  per family with the fields above; item-to-item teardown with an observation **in flight** when the
  learner presses Next challenge then Next (it lands nowhere); disconnect keeps the surface inert and
  a resume keeps work but drops unfinished speech.
- `typecheck:lumina` 0 · full `tsc` 770 (unchanged) · `npm test` 569 files, 7153 passed, 0 failed.
- **Browser:** the user drove home Practice → Pulse in the real app (Language Arts after the subject
  fix); unbound items ran with Gemini Live. **No bound item has been seen in a browser** — the
  headless drive was stopped before it got past sign-in. Owed under HUMAN-CHECKS #167.

## Findings, not fixed here

- **Mastery-lifecycle `subject` casing (student data, `/student-data-loop` + user).** Pulse loads
  lifecycles with an exact `subject ==` filter. A sample of 8 students stores math as `Mathematics`
  110, `MATHEMATICS` 36, `mathematics` 13 (plus `Language Arts` / `LANGUAGE_ARTS`, `Science` /
  `SCIENCE` / `science`). Pulse sends `mathematics`, so it sees 13 of 159 math lifecycles.
- Stale docs still describe the deleted Practice surfaces (`EVALUATION_PIPELINE_ARCHITECTURE.md`,
  `QUEST_GENERATION_IMPLEMENTATION.md`, `Lumina_PRD_Pulse.md`, `PRD_ADAPTIVE_SESSION.md`).
