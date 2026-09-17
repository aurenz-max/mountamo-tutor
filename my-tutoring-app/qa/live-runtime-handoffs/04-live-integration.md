# Session 04 — bridge adoption and first real lesson demonstration

**2026-09-17 update:** TenFrame is now wired into LiveActivitySandbox through the
generic runtime transport alongside the existing activity tools. Scoped tickets,
actual DOM receipts and runner-owned silent return are implemented. The next work
in this brief is number-line adoption followed by both planned activity orders and
microphone acceptance; the TenFrame pilot does not close that combined gate.
See [pilot evidence](../tutor-reports/ten-frame-runtime-live-2026-09-17.md).

**Cleanup:** the connected synthetic fixture, its backend prompt and legacy full-scope
model command format are retired. [Cleanup evidence](../tutor-reports/live-backend-cleanup-2026-09-17.md).
live_activity_tools.py remains the generic transport for generation/prepared mounts
and host-advertised controls. The subsequent [host capability migration](../tutor-reports/live-host-capabilities-2026-09-17.md)
removed its primitive-specific prompts, mode tables, identity-based speech rules
and visual builders. Descriptions and validators now come from the frontend
contracts. Current-task help continues through live_runtime_tools.py.

User review: STOP using the synthetic reference as a learner demo. Its old URL
redirects to /lumina/live-activity. runtimeTransport.ts and
backend/app/services/live_runtime_tools.py have [transport evidence](../tutor-reports/live-runtime-connected-2026-09-17.md),
but the fixture omitted the working voice judge and real activity. Adopt the shared
infrastructure incrementally inside LiveActivitySandbox. Preserve actual spoken
answer judging, automatic opening and real manipulatives throughout the work.
Resolve React commit acknowledgement before wrapping existing async state controls;
the current runtime assumes handlers commit synchronously.

Requires certified number-line and ten-frame adapters plus shared runner lifecycle.
Scope: `LiveActivitySandbox`, the opt-in `LuminaAIProvider` runtime facade, and generic
transport in `backend/app/services/live_activity_tools.py`. Read the current backend
before editing; these files had existing uncommitted sandbox work.

Supply one `LiveLessonRuntime` per connected session, a new epoch after reconnect,
and keep the parent component mounted in `LiveRuntimeSurface` through support.
Use original command IDs/scope across the wire. Publish compact semantic snapshots
and concrete affordances after meaningful transitions. Python transports/correlates;
it must not grow per-primitive modes, phase indexes, action implementations or
completion-message filters. Do not enable an action from catalog metadata alone.

Use existing wire names if convenient. A committed dispatch is not visible:
await `waitForVisible` before describing the new surface. Propagate stale, unsupported,
blocked, cancelled and timed-out results truthfully with refreshed legal choices.
`start_plan_item` must honor `canStartNext`, prepared plan order and completion ownership.
Wire actual cue-start/turn-end/audio-tail events to teaching-turn holds. The foundation's
manual lab holds are a reference, not an audio transport implementation.

Run the planned lesson drive in both orders after confirming the backend restart.
Demonstrate actual subtraction payload → help without regeneration → one prepared
counter example → same unfinished task → fresh transfer → next planned item.
Exercise stop, interruption, duplicate commands, late results and reconnect. Keep all
student-data writes disabled. Log command-to-visible separately from voice-to-help.

Exit: deterministic suites, real model text drives explicitly labeled, and a human
browser/microphone sitting. Use `$tutor-test` for the live tutoring checks. Record
keep/change/stop and link `qa/HUMAN-CHECKS.md` #167. G1–G3 remain open until the real
owners complete both activity orders without competing speech or lost work. Do not
proceed automatically to other primitives, images, durable recovery or persistence.
