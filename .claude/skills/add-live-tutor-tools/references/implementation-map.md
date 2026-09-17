# Implementation map and repeatable commands

`src/` below is under `my-tutoring-app/`; everything else is from the repo root.

## Read only the execution family you are joining

**Shared contract (always):**
`src/components/lumina/components/live-activity/runtime/` — `README.md` (adapter
obligations), `contract.ts` (`TutorAction`, `TutorPrimitiveState`,
`ExecutableAffordance`, `CounterSupport`, `RuntimeSnapshot`, `TransitionReceipt`,
`parseTutorCommand`, `validateCounterSupport`), `LiveLessonRuntime.ts` (policy,
revisions, duplicate/conflict rejection, ownership, completion gate, one detour per
item — policy defaults to `maxSupportLevel: 3, allowAnswerExposure: false,
allowSupportArtifacts: false`, and `offers()` silently drops a `scaffold` with no
`assistance`, an out-of-range level, and any exposure above `'none'` unless
allowed), `LiveRuntimeContext.tsx` (`usePrimitiveRuntime`, `useLiveRuntime`),
`LiveRuntimeSurface.tsx` (keeps the parent mounted, paints prepared support),
`runtimeTransport.ts`, `waitForVisible.ts`.

**Tutor-led reference (component grades; tutor asks):**
`src/components/lumina/primitives/visual-primitives/math/useNumberLineRuntime.ts`,
`NumberLine.tsx`, `NumberLine.runtime.test.tsx`, `NumberLine.jump-evidence.test.tsx`.
Its prepared subtraction example is withheld for addition, fractional starts,
multi-operation tasks and out-of-range quantities. Its reminder is jump-only.

**Judged-runner reference (runner asks, judges, advances):**
`src/components/lumina/primitives/visual-primitives/math/useTenFrameRuntime.ts`,
`TenFrame.runtime.test.tsx`, `src/components/lumina/hooks/useJudgedScriptRunner.ts`.
Read the runner before adding replay or suspension to another DI primitive. TenFrame
advertises no tutor `advance`; `subitize` advertises no help detour. Other
primitives do not inherit these capabilities.

The runner takes an optional `runtime?: LiveLessonRuntime | null` option that the
component must supply from `useLiveRuntime()`. Without it, `runtimeControls.resume()`
returns early, the cue speech holds are never acquired, and the completion handoff
never defers — a detour suspends and never resumes. `runtimeControls` exposes
`getState()`, `replay()`, `suspend()` and `resume()`; `grantOwnership('runner')` is
retried inside the runner's own start path.

**Frontend host:** `src/components/lumina/components/live-activity/` —
`LiveActivitySandbox.tsx`, `activityContract.ts` (`ActivityRequest`,
`LIVE_ADAPTERS`, per-family `validate`/`initialState`), `liveActivitySpec.ts`,
`livePlan.ts`, `directVisualContract.ts`; plus
`src/app/api/lumina/live-activity/route.ts` and `capabilities/route.ts`. Generated
content and prepared-plan mounts both need resolved metadata.

**Backend bridge:** `backend/app/services/live_runtime_tools.py` (current-task help
and `perform_runtime_action`), `live_activity_tools.py` (generation/mount
correlation). Inspect protocol assumptions only. The bridge holds no primitive IDs,
mode catalog, teaching-script tags or visual-data constructors: `parse_activity_spec`
validates the host envelope arriving as `auth_data['activity_sandbox']` (called from
`backend/app/api/endpoints/lumina_tutor.py:897`), declares the advertised tools, and
correlates browser receipts. Silent runner startup keys off `teachingOwner`, never a
primitive branch.

The envelope validator enforces things your registration must satisfy:
`primitiveId` matches `[a-z][a-z0-9-]{0,79}`, each mode `[a-z][a-z0-9_-]{0,63}`,
1–32 modes, `guidance` 1–2000 characters, at most 32 activities plus visuals, 32 KB
total — and **`teachingOwner: 'di-runner'` requires `canAdvance: false`**. A visual
may not reuse an activity's `primitiveId`, and these tool names are reserved:
`perform_runtime_action`, `request_activity`, `advance_activity`, `start_plan_item`,
`highlight_visual`.

## Mounted driver

`my-tutoring-app/scripts/primitive-runtime-driver.mjs <epoch> <primitive-id>` loads
the real component through Vite in JSDOM. Families registered today: `ten-frame`
(default, instance `frame`) and `number-line` (instance `line`) — a small `families`
map at the top of the file. `ten-frame-runtime-driver.mjs` forwards to it.
`primitive-runtime-seams.tsx` isolates audio hardware, auth and evaluation writes;
put any completion-summary context readers in those seams rather than replacing the
primitive or its grading.

Newline-delimited JSON on stdin/stdout; component diagnostics on stderr.

| Input | Meaning |
|---|---|
| `mount` | render with `{...data, instanceId}` |
| `command` | a wire `TutorCommand` through `RuntimeTransport` |
| `output` / `end` | model turn begins (audio playing) / ends |
| `stop` | `runtime.stop()` |
| `start`, `answer` | TenFrame: begin, then real speech reduction |
| `place` (numeric), `check` | Number Line: real SVG click, then the Check button |

The driver replies to every line, so any unrecognized type reads state without
input. Each reply carries `state` (`runtimePacket`), `messages`, `submissions`,
`activityState` and a `dom` presence block — the block is hardcoded for the number
line and the frame, so a new family needs its own probe there as well as an entry in
the family map and its native input commands. Do not route a new primitive through
TenFrame's speech path.

## Python journeys

Driver-emitted messages go through the real authenticated backend WebSocket, and the
model's tool commands come back into `RuntimeTransport`. The journey pulls the host
capability envelope with `fetch_activity_spec` from
`backend/tests/tutor_live/activity_capabilities.py` — the frontend capabilities
endpoint, not a Python catalog — and passes it as `activity_sandbox`. References:

- `backend/tests/tutor_live/run_number_line_runtime.py` — retry, replay, hint, fade,
  subtraction example, return, checked advance, blank transfer, final completion.
  Flags: `--runs` (default 3), `--input` (replay a saved payload), `--output`.
- `backend/tests/tutor_live/run_ten_frame_runtime.py` — real speech reduction, wrong
  answer and correction, hint, prepared example, return, runner closing settlement.

Deterministic bridge tests that need no model, run with the backend venv from
`backend/`: `test_live_runtime_tools.py`, `test_live_activity_spec.py`,
`test_live_activity_tools.py`, `test_live_lesson_plan.py`, `test_live_visual_tools.py`.

## Commands

From `my-tutoring-app` (PowerShell):

```powershell
npm.cmd test -- --run src/components/lumina/components/live-activity src/components/lumina/primitives/visual-primitives/math/NumberLine src/components/lumina/primitives/visual-primitives/math/TenFrame.runtime.test.tsx src/components/lumina/hooks/useJudgedScriptRunner.test.tsx src/components/lumina/pip/NumberLine.surface.test.tsx
npm.cmd run typecheck:lumina
```

From the repo root, with frontend :3000 and backend :8000 already running:

```powershell
backend/venv/Scripts/python.exe backend/tests/tutor_live/run_number_line_runtime.py --runs 3
backend/venv/Scripts/python.exe backend/tests/tutor_live/run_number_line_runtime.py --runs 3 --input my-tutoring-app/qa/tutor-reports/number-line-runtime-payload-2026-09-17.json --output my-tutoring-app/qa/tutor-reports/number-line-runtime-replay.json
backend/venv/Scripts/python.exe backend/tests/tutor_live/run_ten_frame_runtime.py --runs 1 --input my-tutoring-app/qa/tutor-reports/ten-frame-runtime-payload-2026-09-17.json --output my-tutoring-app/qa/tutor-reports/ten-frame-runtime-regression.json
```

Use the backend venv (Python 3.11+); Windows system Python may be 3.9 and lacks
`asyncio.timeout`. The existing auth helper reads test credentials without printing
them — do not persist tokens in evidence. Never start a second `next dev`, and use a
confirmed-running backend version when changing backend code rather than restarting
another session's service.

The Number Line probe needs two generated single-operation subtraction jumps. An
incompatible generated payload is a failed precondition, not permission to invent
matching content; the saved payload makes replay independent of a new generation
call. Live journeys simulate playback edges and JSDOM paint — actual screen and
microphone timing, and both prepared-plan orders, remain separate gates
(HUMAN-CHECKS #167).
