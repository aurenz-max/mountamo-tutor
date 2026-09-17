# Session 02 — shared judged-runner lifecycle

**2026-09-17 update:** Implemented for the user-authorized TenFrame pilot. The opt-in
API now cancels attempts/cues/timers, retains the item, fences return on settled
speech plus visible receipt, and delays completion through closing audio. Existing
runner tests remain in the regression gate. See [pilot evidence](../tutor-reports/ten-frame-runtime-live-2026-09-17.md).
This brief remains the acceptance checklist for further execution styles; do not
repeat the shared implementation or automatically port other primitives.

Implement a backwards-compatible, opt-in runtime lifecycle in `useJudgedScriptRunner`
and, where necessary, `useJudgedSpeechLoop`. Do not port individual primitives in this
session. Read the runtime README, `judgedScriptContract`, voice-turn/loop contracts,
existing runner tests and roadmap G1/G3. Keep ordinary callers' behavior unchanged.

The synchronous `suspension.suspend()` contract must actually quiesce queued cues,
pending voice and gesture attempts, stillness timers, stimulus prep/fallback timers,
and late/unanchored verdicts. Preserve the item and work. Resume establishes a new
attempt/cue generation so pre-suspension events cannot mutate the restored task.
If quiescence cannot be synchronous, extend and prove the runtime's handoff protocol
first; do not hide asynchronous cancellation behind a void synchronous callback.

Acquire a runtime teaching-turn hold before enqueueing an opener/closing cue.
Release only after the associated model turn and buffered playback finish, or a
verified cancellation drains both. Do not infer settlement from an initially false
audio flag. Initial runner ownership must wait for the tutor's actual transition
turn. Completion cannot fire as soon as a closing line is queued. One owner and one
completion channel, with a host-owned completion option for planned lessons.

Help/stop must remain reachable while waiting on judgment. The conversational tutor
cannot advance a runner concurrently; a help handoff must suspend and return the
floor explicitly. Never introduce a bridge-loop compensation to mask source timing.

Exit: real shared-engine tests for queued opener, pending judgment, delayed verdict
after return, stillness timeout, stimulus timeout, interruption, stop, unmount,
closing-cue speech tail and duplicate terminal signal. Include legacy runner tests.
Run Lumina typecheck. State exactly which lifecycle is now safe for session 03;
do not claim the reference fixture proves runner safety.
