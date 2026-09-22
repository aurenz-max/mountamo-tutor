# Pulse and Practice host the teaching workspace (LA-14 S3, slice 2)

Date: 2026-09-21 · Owner: roadmap LA-14 · Executor: `/add-live-tutor-tools` (evaluation fields
checked with `/student-data-loop`) · Plan: [07-sunset-scripted-tutoring.md](07-sunset-scripted-tutoring.md)
· Per-surface state: [07-census.md](07-census.md) · Contract:
[TEACHING_WORKSPACE.md](../../src/components/lumina/docs/TEACHING_WORKSPACE.md)

## Why this slice

S3's exit is that a migrated mode has one teaching controller and that importing its normal
surface cannot start the old runner. After slice 1 ([report](../tutor-reports/blend-pins-on-workspace-2026-09-21.md)):

- **Six families bind every catalog mode:** counting-board, number-sequencer, di-letter-sounds,
  di-word-reading, di-math-facts, letter-sound-link. In ordinary lessons they run on the
  workspace for single, blended and `mixed` pins (`pinnedModes.ts`).
  - The one lesson route left is a section with more than one objective. None appears in the 62
    saved lesson-bench packages.
- **Nothing is left to delete in the drills themselves.** The DI and letter-sound-link drills
  carry no live wiring, and number-sequencer's was deleted in slice 1.
- **The normal student surfaces that still start the scripted runner for these families are
  Pulse and Practice.** Both are reached from `PlannerDashboard`, and both mount primitives with
  no runtime. That is this slice.

Out of scope, each with its own owner:
- per-mode recording of blended sections (queued in the sunset handoff, user ruling: per item);
- the domain testers and the DI drive harness (`DI_PORTS`, `--di`), which are S5;
- Shape Sorter `count`/`sort`/`find_real_object`, which are S4.

## Current state (read the code; line numbers from 2026-09-21)

**Pulse** (`pulse/PulseSession.tsx`, `pulse/PulseActivityRenderer.tsx`)
- `PulseSession.tsx:261` wraps everything in `<LuminaAIProvider>` with no `liveLessonRuntime`.
- `PulseActivityRenderer.tsx:524-545` mounts the registry component with `data` only: no
  `runtimeEvalMode`, no `runtimePlanItemId`, no `LiveRuntimeContext`. `withTeachingWorkspace`
  therefore picks the scripted drill.
  - The scripted DI drills connect their own Live session.
  - The workspace components do not: they expect the host's session.
- Each Pulse item carries ONE IRT-chosen mode, `currentSpec.eval_mode_name`. That is the natural
  `runtimeEvalMode`, and the only acceptable source; never infer one from content.
- Submission (`:378-395`) records `evalResult.metrics?.evalMode || …standardProblem.evalMode ||
  currentSpec.eval_mode_name`, through a `localOnly` evaluation provider (`:617`) and
  `onEvaluationSubmit`.

**Practice** (`components/PracticeModeEnhanced.tsx` → `components/PracticeManifestRenderer.tsx:70-100`)
- Mounts the same way. Neither file references an eval mode.
- First question: does a Practice item carry a resolved single mode at all? If it doesn't, it
  cannot bind, and the drill stays until the item supplies one. That is a finding to report, not
  something to guess around.
- `pulse/PulseAdaptiveSession.tsx` also uses `PracticeManifestRenderer`, but it is a dev-panel
  route (`DevPanelRouter.tsx:149`).

**How lessons do it, to reuse rather than copy**
- `LessonWorkspaceProvider` (`live-activity/LessonWorkspace.tsx:23-38`) owns one `LiveLessonRuntime`,
  passes it to `LuminaAIProvider`, and bridges runtime events to a `RuntimeTransport`.
- `workspaceConnectionInfo` (`:97-103`) folds the runtime into `connectLesson`
  (`LessonScreen.tsx:59`).
- `OrderedSection` (`ManifestOrderRenderer.tsx:190-194`) gives the runtime only to bound sections
  and passes `runtimeEvalMode`, `runtimePlanItemId` and `autoStart`.
- The binding decision is `lessonWorkspaceItems` (`lessonWorkspacePlan.ts`), which is keyed on
  a lesson `exhibit`.
- A Pulse item is one primitive with one mode. Extract the per-section decision (primitive, pin,
  objective, payload → binding or null) so lessons and Pulse call the same function. Do not write
  a second eligibility rule.

## What the slice has to deliver

1. **Binding.** For a Pulse (and, if it has a mode, Practice) item whose family binds
   `eval_mode_name`, render the primitive inside a runtime:
   - `runtimeEvalMode` = that mode;
   - `runtimePlanItemId` = the item id;
   - the objective = the item's subskill.

   Every other item keeps today's path unchanged.
2. **A tutor session the workspace can use.** Decide between one Live session for the whole Pulse
   run with a primitive switch per item (as lessons do), and a session per item. Record why.
   - The workspace must never sit without a connected tutor: that is a silent stall.
   - Nor should a scripted drill's own connect run beside it.
3. **Identical submissions.** Score, pass/fail, skill/subskill and the eval mode the Pulse engine
   records must be identical to the scripted drill's for each family. Slice 1's evidence says they
   will be:
   - number-sequencer and letter-sound-link report no `metrics.evalMode` on either path, so
     `eval_mode_name` wins;
   - the DI packs report `data.challengeType` on both paths;
   - counting-board reports its first challenge's mode from one shared `handleFinished`.

   Prove it with a test. If any field would change, stop and take it to `/student-data-loop` and
   the user.
4. **One completion.** The workspace's completion summary, Pulse's pending-eval → Next flow and
   the final sound happen once, in order. Moving to the next Pulse item tears down the runtime
   scope. No late observer result may land on the next item.

## Verification

- **Mounted host tests** in the style of `LessonWorkspace.test.tsx`: a real `PulseActivityRenderer`
  (and Practice, if bound) with a real runtime, observer and evaluation provider. Cover:
  - a bound item mounts the workspace and never the runner;
  - an unbound family still mounts its drill;
  - one submission per item, with the fields in point 3 asserted;
  - item-to-item teardown, and a late observer result refused;
  - a lost connection or resume.
- `typecheck:lumina` 0; the full `tsc` count unchanged (770 on 2026-09-21); full `npm test`.
- `run_live_runtime.py` already certifies the primitives under a runtime; don't re-run it as
  evidence for the host.
- **Real-app check.** The new risk is the host, so drive a real Pulse session with a bound item in
  headless Chrome if you can (recipe in memory: playwright-core plus a silent `ai_audio`). If you
  cannot, report "should work — needs a browser check on Pulse with a DI item" and add it under
  HUMAN-CHECKS #167.

## Exit and reporting

For the six families, a Pulse item with a resolved mode runs on the workspace with a connected
tutor, and importing the Pulse surface cannot start their scripted runner. Update:
- the census rows for those families (name the remaining drill callers: testers, DI harness,
  multi-objective lesson sections, and Practice if it has no mode);
- the S3 progress paragraph in the sunset handoff;
- `WORKSTREAMS.md`.

Write the report in `qa/tutor-reports/` with the supported entry points, the tests run and any
browser gap.
