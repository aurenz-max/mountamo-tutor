# Live activity pause experiment — September 16, 2026

The development tester now acknowledges a valid activity request immediately with
`preparing`, `willContinue: true`, and `scheduling: WHEN_IDLE`. Generation continues
through the existing service. The tutor is instructed to give one short conceptual
setup without inventing pending activity values. The matching browser mount receipt
still supplies the actual activity and triggers its introduction with `WHEN_IDLE`.
Student state updates remain `SILENT`.

## Evidence

- Standard Live, artificial six-second generation delay: the original three
  baseline runs started audio at 7.47–7.63 seconds from probe start. Three runs
  with the immediate preparing response started at 1.55–2.09 seconds, all before
  simulated mount. This measures audio arriving from the API, not audible browser
  playback or microphone end-of-speech latency.
- Real backend and real generator: three further sessions started audio
  2.22–2.52 seconds after the text request. Each spoke before simulated mount and
  used the generated numbers afterward. See `live-activity-pause-fix-2026-09-16.json`.
- Six backend lifecycle tests passed, including acknowledgement contents, stale
  receipt rejection, mount scheduling, silent state updates, and cancellation.
- Completion comparison with a six-second generation delay: both `WHEN_IDLE`
  runs introduced the supplied exercise after mount. Neither of the two `SILENT`
  runs spoke after mount during the 20-second observation window measured from
  request. Both variants spoke the conceptual setup before mount. Raw events:
  `artifacts/live-activity-completion-probe.json` at repository root.
- A raw WebSocket Extended Thinking probe connected and emitted `IN_PROGRESS`
  and `IDLE` inside `serverContent`. The first attempt was rejected with
  `Function response scheduling is not supported for this model`. Removing
  `scheduling` and `willContinue` allowed a single final tool response and grounded
  follow-up speech. It spoke an acknowledgement before the tool call, but did not
  speak continuously throughout the six-second wait. This is one probe, not a
  migration validation; the sandbox remains on standard Live. The pinned Python
  SDK lacks the thinking-level and interaction-status fields. Raw successful
  events: `artifacts/live-activity-thinking-probe.json` at repository root.

## Interpretation

This removes the dependency between finishing generation and starting speech; it
does not make generation faster or guarantee uninterrupted speech. Keep mount
confirmation for generated activities: their actual content affects what the tutor
should say. Direct parameterized visuals and UI actions can avoid a second LLM
generation call, but are a separate experiment and are not implemented here.

The existing frontend mount tests remain applicable. Actual browser microphone,
playback, and interruption quality still need a human try. Open Lumina → Developer
Tools → Live Activity, start a new session, and ask for subtraction within ten.
