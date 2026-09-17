# Implementation map and repeatable commands

Paths below are relative to the repository root unless prefixed with `src/`;
`src/` here is under `my-tutoring-app/`.

## Read only the relevant execution family

- Shared contract and obligations:
  `src/components/lumina/components/live-activity/runtime/README.md`,
  `contract.ts`, `LiveLessonRuntime.ts`, `LiveRuntimeContext.tsx`,
  `LiveRuntimeSurface.tsx`, `runtimeTransport.ts`, `waitForVisible.ts`.
- Tutor-led reference:
  `src/components/lumina/primitives/visual-primitives/math/useNumberLineRuntime.ts`,
  `NumberLine.tsx`, `NumberLine.runtime.test.tsx`, `NumberLine.jump-evidence.test.tsx`.
  Its simple subtraction example is withheld for addition, fractional starts,
  multi-operation tasks and unsupported quantities. Reminder is currently jump-only.
- Judged-runner reference:
  `src/components/lumina/primitives/visual-primitives/math/useTenFrameRuntime.ts`,
  `TenFrame.runtime.test.tsx`, `src/components/lumina/hooks/useJudgedScriptRunner.ts`.
  Read the runner before adding replay/suspension to another DI primitive.
- Frontend host:
  `src/components/lumina/components/live-activity/LiveActivitySandbox.tsx`,
  `activityContract.ts`, `liveActivitySpec.ts`, `livePlan.ts`;
  `src/app/api/lumina/live-activity/route.ts` and `capabilities/route.ts`.
  Add primitive data to TypeScript unions, validation and rendering as required;
  generated content and prepared plan mounts both need resolved metadata.
- Backend bridge: `backend/app/services/live_runtime_tools.py` and
  `live_activity_tools.py`. Inspect protocol assumptions, not primitive catalog edits.

## Mounted driver

`my-tutoring-app/scripts/primitive-runtime-driver.mjs <epoch> <primitive-id>` loads
the actual component through Vite in JSDOM. Supported families initially:
`ten-frame` (default, instance `frame`) and `number-line` (instance `line`).
The old `ten-frame-runtime-driver.mjs` forwards to it for compatibility.
`primitive-runtime-seams.tsx` isolates audio hardware, auth and evaluation writes;
include any completion-summary context readers in those seams without replacing
the primitive or its grading logic.

The newline-delimited JSON protocol accepts `mount`, `poll`, `command`, `output`,
`end`, `stop`, plus family input. TenFrame accepts `start` and speech `answer`;
Number Line accepts `place` with a numeric value and `check` (actual SVG click and
button). Replies contain runtime state, transport messages, submission count,
activity state and DOM presence. Extend the small family registry and native input
commands when necessary. Do not route every primitive through TenFrame's speech
answer path. Keep component diagnostics on stderr, JSON alone on stdout.

Python journeys send driver-emitted messages through the real authenticated backend
WebSocket and feed real model tool commands back to `RuntimeTransport`. The host
capability envelope comes from `activity_capabilities.fetch_activity_spec`, not a
Python catalog. Current references:

- `backend/tests/tutor_live/run_number_line_runtime.py`: retry, replay, hint, fade,
  subtraction example, return, checked advance, blank transfer and final completion.
- `backend/tests/tutor_live/run_ten_frame_runtime.py`: real speech reduction, wrong
  answer/correction, hint, prepared example, return and runner closing settlement.

## Commands

From `my-tutoring-app` (PowerShell):

```powershell
npm.cmd test -- --run src/components/lumina/components/live-activity src/components/lumina/primitives/visual-primitives/math/NumberLine src/components/lumina/primitives/visual-primitives/math/TenFrame.runtime.test.tsx src/components/lumina/hooks/useJudgedScriptRunner.test.tsx src/components/lumina/pip/NumberLine.surface.test.tsx
npm.cmd run typecheck:lumina
```

From the repo root, with frontend :3000 and backend :8000 available:

```powershell
backend/venv/Scripts/python.exe backend/tests/tutor_live/run_number_line_runtime.py --runs 3
backend/venv/Scripts/python.exe backend/tests/tutor_live/run_number_line_runtime.py --runs 3 --input my-tutoring-app/qa/tutor-reports/number-line-runtime-payload-2026-09-17.json --output my-tutoring-app/qa/tutor-reports/number-line-runtime-replay.json
backend/venv/Scripts/python.exe backend/tests/tutor_live/run_ten_frame_runtime.py --runs 1 --input my-tutoring-app/qa/tutor-reports/ten-frame-runtime-payload-2026-09-17.json --output my-tutoring-app/qa/tutor-reports/ten-frame-runtime-regression.json
```

Use Python 3.11+ (the backend venv); Windows system Python may be 3.9 and lacks
`asyncio.timeout`. Existing auth helper reads test credentials without printing
secrets. Do not persist tokens in evidence. Use a confirmed running backend version
when changing backend code; do not close another session's service casually.

The Number Line probe requires two generated single-operation subtraction jumps.
An incompatible generated payload is a failed precondition, not permission to
silently invent matching exercise content. The saved payload makes replay independent
of another generation call. Live journeys simulate playback edges and JSDOM paint;
actual screen/microphone timing and both prepared-plan orders remain separate gates.
