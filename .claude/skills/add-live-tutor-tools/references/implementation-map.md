# Implementation map and repeatable commands

Resolve repository paths from the Lumina repo root. `L` below means
`my-tutoring-app/src/components/lumina`; it is a reading shorthand, not a shell variable.
Read current files rather than relying on historical line numbers or consumer counts.

## Destination architecture

| Path relative to `L` | Responsibility |
|---|---|
| `docs/TEACHING_WORKSPACE.md` | TW invariants, behavioral matrix, architecture and limits |
| `components/live-activity/runtime/useTeachingWorkspace.ts` | Workspace binding, legal operations, pending speech and shared lifecycle |
| `components/live-activity/runtime/TeachingSession.ts` | Attempts, assistance, checked outcomes and completion |
| `components/live-activity/runtime/DialogueObserver.ts` and `dialogueContract.ts` | Settled exchange, response scope, cancellation and observer commits |
| `components/live-activity/runtime/learnerUtterance.ts` | Provider fragment assembly and speech boundaries |
| `service/typesafe/observeDialogue.ts` | Shared JEV interpretation of whole-assignment tutor feedback |
| `service/typesafe/observationKinds.ts` and `observeLearnerIntent.ts` | Observation-kind runner; the advisory learner-turn kind (help, stop, answer attempt). Only `assignment_outcome` may commit |
| `components/live-activity/runtime/learnerSignals.ts`, `LearnerObserver.ts`, `learnerIntentContract.ts` | Per-item learner facts in the packet (`liveRuntime.learner`), automatic for every shared-workspace binding. `runtime.learner` holds the tracker. A host-written non-silent `sendText` passes `author: 'host'` and reaches the transport as `hostText()`, never `learnerText()` |
| `components/live-activity/runtime/contract.ts` and `LiveLessonRuntime.ts` | Scope, ownership, deduplication, policy and action revision projection |
| `components/live-activity/runtime/LiveRuntimeContext.tsx`, `LiveRuntimeSurface.tsx`, `runtimeTransport.ts`, `waitForVisible.ts` | Mount, committed transition and visible receipt |
| `components/live-activity/LiveActivitySandbox.tsx` and `JevInspector.tsx` | Actual host integration, playback settlement and inspectable evidence |
| `hooks/teachingItemContract.ts` | Domain item base and response classes extracted from legacy contracts |

## Pilot bindings and registration

Read under `L/primitives/visual-primitives/math/`:

- `CountingBoard.tsx`, `useCountingTutorController.ts`, `countingBoardDomain.ts`:
  counting task meaning and rendering bound to the shared lifecycle.
- `ShapeSorter.tsx`, `ShapeSorterTeaching.tsx`, `shapeSorterDomain.ts`,
  `shapeSorterDrawing.tsx`: plain-shape identification, accepted aliases, stable
  assignment ring and separate demonstration marks. Other modes need their own proof.
- `countingBoardScript.ts`, `shapeSorterScript.ts`: compatibility wrappers for
  remaining scripted consumers. Read the census before removing dependencies.

Every domain module exports `workspaceAssignment(item)` and `workspaceScene(item, view)`;
the component spreads them and the verdict probe imports them. A spoken DI pack binds
through `direct-instruction/DiTeachingStage.tsx`: supply those two, the drawn stimulus, an
optional trail of committed answers, a recap label, metrics (`diStageMetrics`) and wording.
`DiLetterSoundsTeaching.tsx` is the smallest example.

Under `L/components/live-activity/`, inspect `adapters/countingBoardLive.ts`,
`adapters/shapeSorterLive.ts`, `activityContract.ts`, `liveActivitySpec.ts`,
`liveRenderers.tsx`, `livePlan.ts` and `liveJourneySpec.ts`. The registry owns supported
modes, data validation, guidance and ownership; generated and prepared-plan mounts
both need exact mode and objective/plan metadata. A workspace uses `canAdvance: false`
even though its teaching owner is the tutor.

Per-family facts are declared once, on the adapter, and shared helpers do the rest:

- **Ordinary lessons:** `bindsTeachingWorkspace: true` on the adapter, and then every mode in
  `modes` binds in a lesson. `lessonWorkspacePlan.ts` names no primitive and lists no mode. Never
  withhold a mode from lessons: a mode that misbehaves there is a defect to fix (user ruling
  2026-09-20). Absent = an LA-04 adoption with no workspace binding.
- **Learner's Try again / Next challenge on a checked item:** rendered by the shared shell
  `runtime/LiveRuntimeSurface.tsx` from the observer affordances; a host passes
  `learnerProgress`. Do not add a per-host or per-primitive copy.
- **Where a payload spells its challenge type:** `challengeTypes` on the adapter (default
  `challenges[].type`). `modeContentGate.ts` checks content against the catalog's
  mode -> challenge types for both the lesson gate and `livePlan.ts`; never restate that mapping.
- **Scripted drill or teaching workspace:** `runtime/withTeachingWorkspace.tsx`, given the
  family's `*_WORKSPACE_MODES` constant from its domain module — the same constant the adapter
  publishes as `modes`.
- **Evaluation submit:** `runtime/useTeachingEvaluation.ts`; the binding supplies only `metrics`.
- **Adapter boilerplate:** `validateChallengePool`, `workspaceLessonStart` and
  `workspaceGuidance` (domain sentences + the shared `WORKSPACE_DOCTRINE`) in
  `adapters/adapterContract.ts`.
- **A refused workspace action:** `execute` returns `false` or, better, the reason as a string;
  `LiveLessonRuntime` relays it to the tutor. A bare refusal once drew 45 identical retries.
- **A new observation kind:** `service/typesafe/observationRoute.ts` for its route,
  `runtime/observationContract.ts` for scope keys and request bounds.

`activityContract.test.ts` checks every adapter: picker modes ⊆ `modes` ⊆ catalog modes, and
guidance ≤ 2000 characters (the backend closes the socket above it).

The frontend API is under `my-tutoring-app/src/app/api/lumina/live-activity/`,
including `observe-dialogue/route.ts` and `capabilities/route.ts`. The shared observer
routes sit one level up: `api/lumina/observe-dialogue` and `api/lumina/observe-learner`.
Backend `backend/app/services/live_runtime_tools.py` and `live_activity_tools.py`
carry the generic capability/action bridge. Keep domain IDs, cue tags and teaching
plans out of that bridge. Read its actual validators before extending an envelope.

Retirement state and extraction/deletion gates live in:

- `my-tutoring-app/qa/live-runtime-handoffs/07-sunset-scripted-tutoring.md`
- `my-tutoring-app/qa/live-runtime-handoffs/07-census.md`
- `my-tutoring-app/qa/tutor-reports/shape-sorter-teaching-2026-09-19.md`

S0/S1 extraction has been recorded; verify current status before selecting later work.
Do not confuse this with ordinary-lesson integration or completed legacy deletion.

## One mounted harness

`my-tutoring-app/scripts/primitive-runtime-driver.mjs` loads the real component through
Vite/JSDOM. `liveJourneySpec.ts` owns per-domain input derivation, execution descriptor
and DOM probes; `primitive-runtime-seams.tsx` isolates audio hardware, auth and writes.
A `mount` must carry `evalMode`, which becomes `runtimeEvalMode` on the component.
Without it, a pilot can silently run its legacy branch.

`backend/tests/tutor_live/run_live_runtime.py --primitive <id>` is the shared connected
journey. Workspace execution is selected from the journey descriptor/current workspace;
legacy phase programs still use production `teachingOwner`. Both workspace and older
families use this harness. Do not recreate deleted per-primitive Python drivers or
teach the generic JS driver primitive names. Read current `--help` for available flags.

For spoken evidence, `--audio` uses synthesized learner PCM and provider transcription.
Playback edges and JSDOM paint are simulated. Real model replies, tool choice and JEV
results are distinct from deterministic mocked decisions, and neither replaces a human
microphone/visual sitting. Keep original failed traces when fixing a run.

## Commands

From `my-tutoring-app` (PowerShell), choose the tests affected by the change:

```powershell
npm.cmd test -- --run src/components/lumina/components/live-activity src/components/lumina/primitives/visual-primitives/math/CountingBoard.runtime.test.tsx src/components/lumina/primitives/visual-primitives/math/ShapeSorter.runtime.test.tsx src/components/lumina/service/typesafe/observeDialogue.test.ts
npm.cmd run typecheck:lumina
node scripts/tutor-verdict-probe.mjs --shapes qa/tutor-reports/shape-sorter-jev-current.json
node scripts/learner-intent-probe.mjs --shapes qa/tutor-reports/shape-sorter-learner-intent-current.json
```

Both JEV probes need the frontend service and real model configuration. Omitting
`--shapes` runs the Counting Board cases. The verdict probe builds every task, expected
answer, object and fact from the domain module's `workspaceAssignment(item)` and
`workspaceScene(item, view)`, which the component also spreads into its workspace; a new
adopter exports both from its domain, adds a challenge fixture per case item and a flag, and
never copies a sentence into the probe. `--dry` prints each model input without calling JEV. The learner-intent probe has one case set per
adopter domain (`--shapes`, `--trains`, `--letters`, `--words`); add a flag and a set for a
new domain. It prints the false help/stop count, which must be 0. Extend semantic cases for the new domain;
passing these two existing sets alone does not certify another domain.

From repo root, with frontend :3000 and backend :8000 already running:

```powershell
backend/venv/Scripts/python.exe backend/tests/tutor_live/run_live_runtime.py --primitive shape-sorter --mode identify --runs 3 --startup --audio --input my-tutoring-app/qa/tutor-reports/shape-sorter-runtime-identify-payload-2026-09-19.json --output my-tutoring-app/qa/tutor-reports/shape-sorter-workspace-current.json
backend/venv/Scripts/python.exe backend/tests/tutor_live/run_live_runtime.py --primitive counting-board --mode count --runs 3 --startup --audio --input my-tutoring-app/qa/tutor-reports/counting-board-runtime-count-payload-2026-09-19.json --output my-tutoring-app/qa/tutor-reports/counting-board-workspace-current.json
```

Use a new output filename for each meaningful attempt. Use the backend venv; the
system Python may lack dependencies. The auth helper reads credentials without printing
them; never save tokens in evidence. Reuse running services and confirm their code
version; do not start duplicate servers or restart another session's service blindly.
For backend bridge changes also run affected `backend/tests/tutor_live/test_live_*.py`.
Report exact results and unrun gates, including HUMAN-CHECKS #167, in the adoption report.
