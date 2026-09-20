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

Under `L/components/live-activity/`, inspect `adapters/countingBoardLive.ts`,
`adapters/shapeSorterLive.ts`, `activityContract.ts`, `liveActivitySpec.ts`,
`liveRenderers.tsx`, `livePlan.ts` and `liveJourneySpec.ts`. The registry owns supported
modes, data validation, guidance and ownership; generated and prepared-plan mounts
both need exact mode and objective/plan metadata. A workspace uses `canAdvance: false`
even though its teaching owner is the tutor.

The frontend API is under `my-tutoring-app/src/app/api/lumina/live-activity/`,
including `observe-dialogue/route.ts` and `capabilities/route.ts`.
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
```

The JEV probe needs the frontend service and real model configuration. Omitting
`--shapes` runs the Counting Board cases. Extend semantic cases for the new domain;
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
