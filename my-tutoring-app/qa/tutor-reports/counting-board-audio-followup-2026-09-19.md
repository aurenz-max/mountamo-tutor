> Follow-up: JEV progression is now implemented and trialed. See [dialogue observer](counting-board-dialogue-2026-09-19.md). The failures below are the retained baseline.

# Counting Board audio progression follow-up

The user's 12:05 session disproved the earlier text-only runtime smoke as evidence
for microphone progression. The tutor praised a correct count and repeatedly said
it would continue while the board stayed on the same task.

## Confirmed causes and changes

1. Counting Board advertised legacy `advance_activity`, but its new controller had
   no legacy advance handler. Its progression uses scoped runtime choices. The
   legacy advertisement is now disabled.
2. Browser runtime updates were stored and attached to typed messages only. Audio
   turns did not receive them; the first visible mount also reset that stored state.
   The mount receipt now includes runtime state, and the existing continuing
   activity response delivers subsequent state silently to the live model.
3. Actual Gemini Live input transcripts omitted the `finished` flag. Requiring it
   left speech responses permanently unfinished. `InputTranscriptBoundary` now
   closes pending source input when the provider begins its answer/tool output,
   including same-packet transcription, while preserving fragment boundaries and
   ignoring interruption-only boundaries. VAD pauses alone do not end an answer.
4. The model could recognize and praise an answer without calling `record_response`.
   Completed recognizable source answers are now checked by the shared workspace
   directly, as gestures are. The recording action and tool utterance parameter
   were removed. Help/ambiguous speech remains ungraded; correctness stays code-owned.
5. Unrelated conversational utterances no longer change action revisions. The exact
   “Yeah, please, let's continue” pattern has a regression test preserving Next scope.
6. The combined bridge refuses replacement generation while a runtime task is
   unfinished. A duplicate startup request cannot silently replace the board.

## Verification and limits

- 128 tests passed across the live host/runtime, Counting Board and sibling runtime
  regressions. An additional voice-close test then passed in the 32-test Counting
  Board suite. Backend suite: 123 passed. Lumina typecheck: zero errors.
- The harness now supports `--startup --audio`: learner speech is synthesized through
  the configured Azure service and streamed as PCM to the real Gemini Live endpoint.
  Actual provider transcription is forwarded into the real mounted React board.
  No expected transcript or verdict is injected. Playback and browser paint remain
  simulated; this is an adult synthetic speech test, not human microphone acceptance.
- `--progression-only` reproduces the six-then-five count, retry, second challenge,
  seven-count and final completion. It requires two visible advance receipts and
  checked answers. A stale command is allowed only if its revision was actually
  superseded; that refusal is recorded, and cannot substitute for either advance.
- The final raw report is
  [audio progression](counting-board-audio-progression-verified-2026-09-19.json).
  **Final result: 1/3 completed. Do not call this a clean tutor acceptance pass.** One run completed; another
  reached the second checked-correct task, verbally finished, and omitted its final
  advance action. The third verbally invited another try but omitted retry, leaving
  the incorrect response checked. This is the same architectural failure family
  the user identified.
- Earlier failed audio/startup reports are retained. Failures included missing
  transcript finalization, omitted demonstrations, stale command races, duplicate
  startup requests, and omitted progression. An attempted transcription language
  hint was rejected by the Gemini API and reverted before the final runs.
- Literal `<no speech>{pause}` output appears in some turns. Successful mechanical
  progression does not certify learner-facing speech quality.

## User-directed architecture

The user proposed TypeSafe/JEV observing the completed dialogue and emitting a
correct/incorrect event when confident, eliminating the tutor's bookkeeping calls.
This addresses the remaining omission directly. The existing TypeSafe client and
verifier can support a shared observer with typed `answer_correct`, `answer_incorrect`,
`retry`, `advance`, and `no_event` decisions, current-item scope and abstention.
Verdict identification must be checked against the learner/task evidence; tutor
praise alone is not correctness. JEV is **not yet wired into live control**.

The transport/source-answer repairs are implemented. Reliable progression without
tutor tool calls remains the next architecture change, and the failures here are
its concrete evaluation cases.
