# Live lesson runtime infrastructure — 2026-09-17

Follow-up: the reference is now connected to Gemini Live.
[Connected demo evidence](live-runtime-connected-2026-09-17.md) records three real
Live journeys and the remaining browser/microphone gate. The original evidence
below describes the earlier, offline infrastructure slice.

Decision: **keep the shared foundation; migrate pilots in separate sessions.**
Reason: command authority, ownership gates and preserved help/return work together
through a real mounted React host without editing individual learning primitives.
This is not completion of roadmap phases 0–3 or closure of G1–G3.

## Scope and hypothesis

User requested infrastructure first, verified before smaller primitive migrations.
Hypothesis: a mounted runtime can own scope, legal commands, receipts and help/return
while adapters retain learning semantics. Existing uncommitted number-line, ten-frame,
runner/transport-related work was preserved. No primitive or judged-runner file was
edited in this session. The only existing production module changed for the slice
is `LuminaAIContext.tsx`, adding an optional runtime context provider.

Implementation: [runtime README](../../src/components/lumina/components/live-activity/runtime/README.md).
Development page: `/lumina/live-activity/runtime` (production returns not-found).
The fixture is explicitly a reference task, not a catalog primitive, generated
lesson, simulated student record or real tutor conversation.

## Automated evidence

Command, run from `my-tutoring-app`:

```powershell
npm.cmd test -- --run src/components/lumina/components/live-activity src/components/lumina/hooks/useJudgedScriptRunner.test.tsx
```

**74 tests passed across 9 files.** Includes 19 new runtime/host/visibility tests,
existing sandbox/plan/visual contracts and existing judged-runner regression tests.
The real judged runner is unchanged: its regression pass does not certify suspension.

Verified:

- Exact command schema and scope; wrong epoch/instance/item/revision rejected.
- Duplicate commands cannot execute twice; reused IDs with different contents conflict.
- Phase-valid executable handlers, explicit refusal, unsupported actions and host policy.
- Wrong answer → retry; checked correctness required for advance; new item resets evidence.
- Scaffold/fade retains response history and prior assistance; demand is unchanged.
- One prepared help detour per item; original instance, semantic phase and work retained.
- Reference adapter invalidates delayed responses on both suspension and return.
- Full answer exposure remains in assistance history after the artifact disappears.
- Ownership and next-start remain blocked through model-turn and audio-tail holds.
- Terminal completion emitted once, only after outstanding closing holds settle.
- React StrictMode host: same input DOM node stays connected under support, is disabled
  and hidden, and returns with its draft and checked response intact. Fresh transfer
  clears the draft and uses a different answer.
- Commit and rendered revision are separate; stale, timed-out and cancelled visibility
  waits do not report a visible transition. Wait timers are cleaned up.
- Stop never emits completion; handler failure faults the runtime; invalid counter
  quantities are rejected; context packets contain no executable functions.

Final `npm.cmd run typecheck:lumina`: **passed, zero Lumina diagnostics**.
Full TypeScript output was also checked for the touched `LuminaAIContext.tsx` and
new app route: **no diagnostics in either**. The full repository check still exits
2 with existing diagnostics outside this scope; a repository-wide pass is not claimed.

## Browser, microphone and product evidence

**Actual browser: pending. Actual microphone: pending.** Computer-use discovery returned
no available browsers or apps, so no visual/browser acceptance was performed. The
DOM tests above use jsdom and synthetic clicks. No Live model was called, no actual
speech timing measured, and the lab's holds are manual representations of lifecycle
signals. Local-action 500 ms and voice-to-help targets have not been measured.

Human queue: [HUMAN-CHECKS.md](../HUMAN-CHECKS.md), #167. Reproduce the reference demo:

1. Start the Next development server and open `/lumina/live-activity/runtime`.
2. Enter `2`, check it, show/fade the direction hint, then open the different example.
3. Return: the draft `2` and incorrect result remain. The example cannot reopen on
   this item, and assistance history still contains the full-exposure event.
4. Retry and answer `5`; advance to the blank `9 minus 2` item and answer `7`.
5. Hold the teaching turn, report terminal completion: state is `closing`, events `0`.
   Settle the turn: state is `completed`, events `1`. Re-report: still `1`.
6. Reload and stop during help: unfinished work must not be marked complete.

What works in machine checks: deterministic refusal, preserved draft, truthful
assistance and completion ordering. What remains unproven: visual comfort, natural
audio timing, real primitive cancellation, meaningful intervention choice and transfer.

## Remaining work

Handoffs: [number-line](../live-runtime-handoffs/01-number-line.md),
[shared judged runner](../live-runtime-handoffs/02-judged-runner.md),
[ten-frame](../live-runtime-handoffs/03-ten-frame.md),
[live bridge and demonstration](../live-runtime-handoffs/04-live-integration.md).

The optional context is the adoption point; existing sandbox events have not been
redirected to it. G1–G3 remain open for those real owners. General detours, asynchronous
artifact generation/cancellation, skip/defer, bounded demand changes, generated images,
durable recovery, production rollout and learning writes are unimplemented later work.
LA-11 has deterministic contract scenarios, not a scored model intervention-policy
comparison. Broader portfolio priorities were not reconciled or changed.
