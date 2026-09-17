# Number Line live tutor actions and replication skill ? 2026-09-17

Number Line now runs through the same mounted runtime and support shell as TenFrame
in `/lumina/live-activity`. Select **Activity: Number Line ? Subtraction jumps ?
Start lesson**. The tutor uses actual component grading and scoped action tickets.

## Implemented behavior

| Action | Executable effect and gate |
|---|---|
| Advance | Only after checked correctness; commits the next React task and blank work before returning. The visible receipt remains separate. |
| Retry | Only after an incorrect response; clears work and feedback while retaining attempts and runtime assistance history. |
| Replay | Focuses the actual instruction with a visible outline and instructs the tutor to read it. Preserves work. No fabricated runner handoff. |
| Reminder / fade | Jump challenges only: show/hide a text reminder to find the start and count spaces. It does not move or highlight points. |
| Example / return | One prepared counter example for a single integer subtraction operation, then return to the same mounted number line and response. Hidden clicks and stale controls are rejected. |

The support example uses a different start and answer from the saved task; partial
exposure remains in assistance history after return. Examples are withheld for
addition, fractional starts, multi-operation jumps, zero/negative results and
unsupported quantities. No point/highlight, skip, new task shape, generated support
image, voice-answer judge, durable recovery or student-record integration was added.

`useNumberLineRuntime.ts` reads refs refreshed after React commits. Imperative
commands use `flushSync`; tests inspect the new DOM and state before dispatch exits.
Checked responses cannot be edited underneath their success evidence.
The existing legacy advance control also flushes its commit and refuses stopped,
stale or unchecked calls. Number Line retains its normal gesture/Check grading.

The host now selects either family/mode and wraps both in `LiveRuntimeSurface`.
Prepared Number Line mounts preserve objective ID, plan item ID and resolved mode.
Host plan completion waits for the mounted runtime to settle; planned Number Line
suppresses competing final speech, while ordinary standalone feedback remains.
Its success cue requests the advertised advance before the next instruction.
The generic backend return guidance now distinguishes tutor-owned from explicitly
runner-owned speech. No Python primitive catalog or new transport branch was added.

## Verification

- **125 frontend tests passed in 19 files**, including 10 new real Number Line
  runtime cases, host activity selection, plan completion settlement, shared
  runtime/transport, TenFrame runtime, judged runner and Number Line Pip regressions.
  Plot, find-between and ordering also pass checked retry/advance tests; the real
  model journey is specifically the Grade 1 subtraction-jump lane.
- **33 backend tests + 7 subtests passed** for runtime/activity/spec/plan contracts.
- **Lumina typecheck: zero errors.** Skill source and installed copy validate.
- **TenFrame shared-driver live regression: passed**, with actual speech reduction,
  wrong/right answers, reminder, example, unchanged return and one settled completion.
  [Raw regression](ten-frame-runtime-shared-driver-regression-2026-09-17.json).
- **Number Line final stable-server batch: 3/3 action journeys passed**, each with
  all seven requested action calls plus an opening replay acknowledged visible, preserved work on return, a
  blank next item and exactly one component completion.
  [Full final traces](number-line-runtime-stable-backend-2026-09-17.json).

| Run | Action journey | Visible receipts | Component completions |
|---|---|---|---|
| 1 | PASS | 8/8 | 1 |
| 2 | PASS | 8/8 | 1 |
| 3 | PASS | 8/8 | 1 |

The shared `scripts/primitive-runtime-driver.mjs` mounts the actual components,
grading, runtime and transport. Its auth/audio/persistence seams are isolated in
`primitive-runtime-seams.tsx`. Number Line input is an SVG click plus the actual
Check button. Model commands are received from the real authenticated WebSocket
and passed unchanged into `RuntimeTransport`. No correct verdict or visible receipt
is supplied by the harness. JSDOM paint opportunities and playback boundaries are
simulated. No mastery writes occur.

Commands are in the skill's [implementation map](../live-runtime-handoffs/add-live-tutor-tools/references/implementation-map.md).
The final live command uses the saved [generated payload](number-line-runtime-payload-2026-09-17.json)
and a fresh non-reloading backend on `ws://127.0.0.1:8010`, because the existing :8000
worker repeatedly closed initial connections with code 1012. Backend configured
default: `gemini-3.8-live`. This report does not certify another model/configuration.

## What the earlier probes found

- The first mounted drive executed all seven requested action calls, then crashed
  in the *driver's* missing evaluation-context seam when rendering the completion
  summary. The shared seam now supports that read. [Trace](number-line-runtime-first-drive-2026-09-17.json).
- Before the stronger success cue, 2/3 journeys advanced automatically; the third
  praised success but omitted the available advance. This was fixed at Number Line's
  feedback source. [Before cue](number-line-runtime-before-advance-cue-2026-09-17.json).
- Several batches were interrupted by backend code-1012 restarts; those remain
  failed runs, not action successes. [Restart batch](number-line-runtime-startup-reload-2026-09-17.json).
- One oracle asserted that the wrong verdict was still visible *after* the model's
  turn, but the model had executed a valid retry and cleared it. The harness now
  asserts the actual wrong verdict immediately after Check and explicitly records
  any early retry. It still requires a real retry command and visible receipt.
  [Earlier assertion](number-line-runtime-before-retry-oracle-2026-09-17.json).

## Limits and next handoff

**Action execution is not teaching-quality acceptance.** Earlier transcripts include
examples explained without their full quantities, silence-marker artifacts, and a
single unexpected Japanese praise phrase. Early autonomous retry is allowed by the
current capability surface but still needs restraint review. Preserve these as
LA-11/product-sitting inputs; do not certify English narration, helpful intervention
policy or fresh-item learning transfer from tool receipts.

In the final batch, only one of three example turns named all example quantities;
the other two described the relationship generically. One final transcript was a
fragment. The driver advances its synthetic learner after a visible tool receipt,
which can precede the tutor's next instruction turn; it does not establish natural
waiting or closing-speech quality. These limits do not change the verified action
receipts, and they do prevent an experience-gate claim.

Actual browser control was unavailable. Screen/microphone timing, touch gestures,
interruption/reconnect experience and both prepared-plan orders remain open in
[HUMAN-CHECKS #167](../HUMAN-CHECKS.md). Local completion tests do not close G1-G3
across the combined lesson. Keep the existing voice judge for runner-owned families.

The installed **$add-live-tutor-tools** skill and its versioned
[source](../live-runtime-handoffs/add-live-tutor-tools/SKILL.md) cover the bounded
workflow. [Next-session handoff](../live-runtime-handoffs/05-primitive-tools.md)
provides a ready-to-use request and the actual source map. Extend one requested
primitive at a time; metadata alone never certifies a runtime handler.


Backend regression command (from `backend`):

```powershell
venv/Scripts/python.exe -m pytest tests/tutor_live/test_live_runtime_tools.py tests/tutor_live/test_live_activity_tools.py tests/tutor_live/test_live_activity_spec.py tests/tutor_live/test_live_lesson_plan.py -q -p no:cacheprovider
```

The isolated :8010 verification server was stopped after the final run. The original
:8000 service was left in place. No changes were committed or pushed.
