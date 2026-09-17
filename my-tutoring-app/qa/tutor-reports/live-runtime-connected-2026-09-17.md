# Connected live runtime demo — 2026-09-17

**STOP as a learner demo — user review, 2026-09-17.** The fixture replaced the
working activity with a text problem and explicitly refused spoken answers.
The three directed journeys below tested transport with supplied checked answers,
not the learner experience shown in the user's screenshot. The original Keep
recommendation was wrong. The old URL now redirects to /lumina/live-activity.
Subsequent backend cleanup removed the connected fixture, its driver and the
run_live_runtime.py harness; the historical command below is no longer runnable.
The offline infrastructure lab remains. TenFrame adoption now has separate
[real-model evidence](ten-frame-runtime-live-2026-09-17.md); actual microphone
acceptance remains pending.

Historical implementation and verification below are retained as transport evidence.
They must not be used to certify spoken-answer judging or the actual lesson host.
See the [restoration and current verification](live-demo-restoration-2026-09-17.md).

## Implementation

- Generic development-only runtime_sandbox authentication and one
  perform_runtime_action tool. The Python bridge copies an advertised action by
  opaque ID, preserving its original epoch/instance/item/revision. It never implements
  primitive behavior or invents affordances.
- The same RuntimeTransport is used by the connected React page and headless drive.
  Browser commands dispatch through LiveLessonRuntime; tool results wait for
  waitForVisible. Cancellation and timeout do not claim rollback or visible success.
  A newer learner state supersedes an older receipt.
- Silent semantic packets carry checked evidence and current choices. Scaffold/fade
  and answer exposure remain recorded after return. Repeated checks count as new
  attempts even without a tutor-issued retry action.
- A tutor's own turn hold permits its local tool calls without invalidating their
  task revision. It still blocks ownership handoff and completion. Model turn-end
  and the playback buffer must both settle before the hold releases. Synchronous
  buffer inspection includes audio not yet reflected in React's playing state.
- Stop ends the local command surface. Connection loss closes the old transport;
  an explicit fresh demo creates a new epoch. No durable-resume claim is made.
- Existing sandbox routes and primitive controls retain their previous transport.
  No number-line, ten-frame, judged-runner or canonical learning-write path changed.

## Tutor-test evidence

Applied the tutor-test Tier-3 methodology with a bespoke reference-runtime journey.
Catalog scaffold audit and generator probes (Tiers 1–2) do not describe this
non-catalog, prepared reference task. Command, from backend:

    .\venv\Scripts\python.exe tests/tutor_live/run_live_runtime.py --runs 3 --backend ws://127.0.0.1:8011

The verification backend was freshly started on isolated port 8011 with
ENVIRONMENT=development. Server ledgers confirm **gemini-3.8-live**, fresh sessions;
voice configuration **Leda**, AUDIO responses, synthetic text input. The normal
port-8000 development backend also passed an authenticated runtime-configuration
gate probe, confirming the new code was loaded without restarting the user's server.
The actual Next live route returned **HTTP 200**.

[Full events, receipts and transcripts](live-runtime-connected-2026-09-17.json).
Each run has eight tutor turns and five successful actions:

| Check | Result |
|---|---|
| Scaffold one direction hint | 3/3 |
| Fade that hint | 3/3 |
| Show prepared counter example | 3/3 |
| Return to original item and retain assistance/exposure | 3/3 |
| Reject wrong checked answer conversationally | 3/3, transcript reviewed |
| Checked advance to a fresh task | 3/3 |
| Final completion | 3/3 |
| Tool results reporting visible | 15/15 |
| No spoken protocol tokens or unresolved placeholders | 3/3 |

Every transcript was read. The tutor asked the actual 8-minus-3 task, described the
requested 7-minus-2 example, returned to the original problem, and advanced to
9-minus-2 after the checked correct response. It did not announce either assessment
answer before the requested example. That example shares the first answer and is
intentionally marked **full exposure**; first-item success is not independent evidence.
The fresh task uses a different answer. Praise and phrasing varied. Help turns often
announced that the hint was shown; the visible hint supplied the conceptual cue.
More conversational coaching is a future tuning candidate, not a transport failure.

The prompts explicitly request the interventions. This verifies tool execution and
grounding, not whether the model independently chooses the best intervention.
The harness executes real TypeScript runtime transitions; **browser paint receipts
are simulated**, and audio is not played. Its sub-millisecond paint timings are not
browser performance evidence and do not close the 500 ms visible-help target.
No microphone, ASR, VAD, audio-tail perception or actual browser acceptance is claimed.
Computer-use inspection was attempted; its transport was unavailable.

After the three live runs, focused hardening added stale-receipt supersession,
automatic counting of repeated checked responses, and a replay-specific speech
instruction. These paths have deterministic coverage; the live scenario did not
exercise a replay request. The three-run record is retained without relabeling it.

## Final deterministic verification

- **81 frontend tests pass** across 11 suites: runtime, transport, actual connected
  React host, prior sandbox/plan/visual tests and unchanged judged-runner regressions.
- **28 backend tests pass**: generic runtime bridge plus existing activity/plan/visual
  bridge regressions. Python compilation passes.
- Lumina typecheck: **zero errors**. Full TypeScript diagnostics also contain no
  errors in the touched AI provider, playback hook or runtime routes. The repository
  still has unrelated legacy TypeScript diagnostics.
- Connected React tests verify auth payload, optional mic, rendered DOM receipts,
  preserved input node/draft and new epoch on explicit restart. Mocked transport
  tests are separate from the real Live runs above.

## Remaining gate

[HUMAN-CHECKS #167](../HUMAN-CHECKS.md) records the rejection and the remaining
real-host acceptance gate. Do not request another review of the synthetic fixture.

The number-line, shared-runner and ten-frame [handoffs](../live-runtime-handoffs/README.md)
remain separate. Roadmap G1–G3 and the real two-family planned lesson gate remain
open; a successful reference demo does not certify those unchanged owners.
