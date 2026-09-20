# Counting Board: source interpretation and JEV inspector

The live activity sidebar now shows a browser-local JEV inspector: current checked
answer, exact request, assignment and interaction metadata, candidate source spans,
raw questions and probability distributions, per-question confidence, and runtime
disposition. The journal retains the latest 50 events without changing action
revisions. Calls go through Next.js server routes; API credentials remain server-side.

## Confirmed failures addressed

The 17:23:05 session recorded both wrong answers and successful retries. The later
utterance `Okay, let's try it. 1 2 3 4 5` never reached the activity checker because
its parser accepted only narrowly formatted numeric speech. The tutor praised it
while the runtime retained the previous incorrect attempt.

The shared teaching workspace now offers domain-readable source spans to JEV when
direct parsing fails. JEV selects a submitted answer or abstains; the activity
checker still owns correctness. Requests contain no candidate correctness or answer
key. Original and interpreted text are retained separately. Late results require
the same item and learner input; completed tutor feedback waits for interpretation.

A real audio regression then found a separate stall: JEV recognized the tutor's
correctness verdict at 0.96, but its abstract advance classification scored 0.87.
The progression rule now also permits a checked correct answer plus confident
correct affirmation and finished feedback, without requiring a separate spoken
advance intention. Questions and unfinished feedback do not meet this rule.
Thresholds were not lowered. The raw observations and runtime reason remain visible.

## Verification and limits

- 124 focused frontend tests passed; the six actual-host tests use the real board,
  runtime and playback hook under StrictMode, with network/audio hardware mocked.
  They cover a delayed conversational correction after old incorrect evidence,
  real playback-drain callbacks, cancellation, and inspector contents.
- Lumina TypeScript gate passed with zero errors.
- [Real source interpretation replay](counting-board-response-interpretation-2026-09-19.json):
  seven cases passed, including conversational counts, wrong answers, questions,
  help requests, quoted examples, self-correction and negation.
- [Real dialogue replay](counting-board-feedback-settlement-probe-2026-09-19.json):
  sixteen cases passed, including the newly observed praise and pending questions.
- [Real audio journey](counting-board-conversational-audio-settled-2026-09-19.json)
  passed: actual synthesized learner audio and provider transcription, wrong count,
  conversational correction, both visible advances and settled completion, zero
  tutor retry/advance calls, zero mastery submissions. It used a saved generated
  payload and headless mounted components; paint/audio hardware are simulated.
- Failed runs are retained: the initial run was interrupted by server reload;
  the next reproduced the transition-confidence stall before the rule change.
- This is not human-browser microphone acceptance. The successful audio run also
  contained an unsolicited non-English startup sentence, so progression passing
  must not be described as overall tutor speech-quality acceptance.
