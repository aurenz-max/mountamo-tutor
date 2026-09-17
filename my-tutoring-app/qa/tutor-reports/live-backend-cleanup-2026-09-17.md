# Live backend cleanup — 2026-09-17

**Historical first cleanup.** The user correctly pointed out that this left the
primitive-specific architecture in place. The subsequent [host capability migration](live-host-capabilities-2026-09-17.md)
removes those backend rules and mode/owner branches, deletes live_visual_tools.py,
and migrates the active callers. The retained-module table below describes the
earlier slice only.

Removed the rejected connected fixture and its obsolete protocol. The existing
TenFrame demo continues to use the shared runtime alongside the activity bridge.

Removed:

- The fixture-only backend prompt that demanded a Check-answer button, and the
  runtime-only connection branch that replaced the normal tutor instructions.
- Compatibility with model commands supplying five separate scope fields. The
  only supported model request is the advertised action ticket. The bridge still
  carries its original epoch, item, instance and revision to the browser.
- The unreachable LiveRuntimeConnectedLab component and its tests, the old
  run_live_runtime.py harness, and its synthetic Node driver. Historical reports
  remain marked as historical. The old URL still redirects to the real host;
  the offline infrastructure lab and its deterministic tests remain.

Retained after tracing callers:

| Backend module | Current caller/responsibility |
|---|---|
| live_activity_tools.py | LiveActivitySandbox: request/generate an activity, mount prepared plan items, relay completion; number-line advance and enabled direct visuals |
| live_runtime_tools.py | Shared current-activity actions, scoped tickets, visible receipts and silent runner handoff |
| live_visual_tools.py | The host's opt-in counters, fractions and letter-tile tools |

The whole activity bridge is not dead code. Removing its primitive-specific
configuration requires migrating activity startup and the remaining number-line
and visual callers. That is separate from deleting unused paths. Existing
activity-only probes also still use its prompts and tools.

Verification: 35 backend tests; 90 affected frontend tests across 13 files;
Lumina-scoped TypeScript check clean; no remaining source imports of the retired
component, driver or prompt. Tests reject obsolete command shapes, preserve ticket
scope after learner changes, and check silent success versus audible failure.
An authenticated runtime-only WebSocket is rejected with 4003 before model setup.

The static tutor audit reports the existing three shared-hook parsing warnings
(dynamic data bag, delegated sendText, delegated tags), no HIGH findings. Live
verification uses the real mounted TenFrame and shared judge with the saved real
generated payload, simulating microphone boundaries, playback and paint. Results
are saved separately in [cleanup journeys](ten-frame-runtime-backend-cleanup-2026-09-17.json):
**3/3 passed**, nine visible help/return receipts, unchanged frame on return and one
settled completion per run. All three full transcripts were reviewed: correct
wrong-answer correction, grounded hints/examples, one re-ask on return, no protocol
leakage or button-only grading. The isolated verification backend is stopped afterward.
Browser/microphone acceptance and the combined two-activity lesson gate remain
separate; this cleanup does not claim to close them.
