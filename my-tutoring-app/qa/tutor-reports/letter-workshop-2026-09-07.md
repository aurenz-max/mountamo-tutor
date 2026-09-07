# Letter Workshop tutoring scaffold — 2026-09-07

Implemented a mode-aware catalog scaffold with 15 runtime context keys, three hint levels, six observable struggle responses, and three directive sections. Help me requests progressively stronger hints and records hint usage. Speech moments cover activity start, next item, read-aloud, correct/incorrect feedback, and completion; all tagged messages are silent system messages.

Write mode explicitly overwrites letter/case with `withheld`, including after feedback, rather than leaving previous targets in merged tutor state. Its opening is owned by the browser cue. Hint requests carry current assistance, model visibility, drawing/cue state, attempts, and feedback. Trace/copy introductions occur once per item, with inactive-lesson and late-connection guards. Pointer gestures emit no speech triggers. Help/read-aloud controls are disabled during drawing or cue playback, and directives require the tutor to stay quiet then.

| Verification | Result |
|---|---|
| Tutor-test Tier 1 | PASS: no findings; static context bag contains all 15 keys |
| Tier 2 trace/copy/write | PASS: all variables resolve from the component; no `(not set)` placeholders |
| Component and regression tests | 268/268 pass across seven files |
| Live generated browser flows | PASS for all three modes; drawing/check/next/finish and evidence retained; cue playback simulated |
| Full TypeScript | 770 baseline / 770 after; no new diagnostics |
| Lumina TypeScript | PASS: zero errors |
| Real tutor connection | PASS: authentication, session ready, real audio, and greeting transcript |
| Full live coaching/device audio | Not verified by the connection-only run |

Artifacts: [trace probe](letter-workshop-tutor-probe-trace.json), [copy probe](letter-workshop-tutor-probe-copy.json), [write probe](letter-workshop-tutor-probe-write.json), [real connection transcript](letter-workshop-live-2026-09-07.md), [browser result](../eval-reports/letter-workshop-modes-browser.json).

The real tutor said: “Hi there! I'm so glad you're here. Let's work on this tracing together!” This verifies the live connection, not every coaching behavior. The test harness's PASS applies only to that connection/greeting run.

Next manual check in the Lumina Tutor panel: trace/copy hint levels, wrong-start/direction feedback, read-aloud, quiet drawing and pen lifts, browser cue/tutor audio overlap, and write-mode answer fishing before the model is revealed. Confirm short speech without target disclosure or mastery claims. Copy/write assessment remains provisional and local-only; no backend code or scoring policy changed in this scaffold slice.
