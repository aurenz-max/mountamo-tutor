# Live activity progression and language

## Observed session

Reviewed `backend/logs/lumina-sessions/2026-09-16-231727-lumina-tutor-e64acf401b42.jsonl`.
The tutor said to try another exercise at 23:18:10, but the next screen cue only
arrived at 23:18:17 as `[NEXT_ITEM]`. At 23:18:50 the tutor described another
exercise without any corresponding next-screen cue. The old sandbox exposed
generation only; it could not advance the mounted component.

The audio transcript contained `ocho` at 23:18:06 and `¿Qué?` at 23:18:20, followed
by Spanish tutor output at 23:18:21. Further `¿Qué?` transcripts preceded further
Spanish responses. This is consistent with language mirroring, not evidence that
async generation increases Spanish output. No recording was inspected, so the
accuracy of the audio transcriptions is unknown.

## Change

Added sandbox-only `advance_activity(instanceId, challengeIndex)`. The real
NumberLine exposes optional controls that require a checked-correct current
challenge, reject stale/duplicate indices, and reuse existing Next progression.
The sandbox returns the actual new state after commit and two animation frames.
Tool-driven progression suppresses the duplicate `[NEXT_ITEM]` cue; the tool
receipt introduces the newly visible exercise. Completion does not start an
unbounded sequence of generated activities. Manual Next is retained.

The tutor defaults to English and only changes language on an explicit learner
request. It must not treat a short foreign-language answer or ambiguous transcript
as a language preference. This is a prompt constraint, not an audio-recognition fix.

## Verification

- 12 frontend tests passed across sandbox, activity contract, and actual NumberLine
  tests. New coverage checks real correct/incorrect grading before progression,
  stale/duplicate controls, cleared previous work, completion, and frame-delayed
  receipt dispatch.
- 8 backend lifecycle tests passed, including command correlation, replacement,
  cancellation, and reset.
- Two real backend/Gemini Live sessions called advance after synthetic
  checked-correct state, then introduced the returned second challenge. Both
  answered the follow-up `¿Qué?` in English. Screen receipts were simulated;
  React progression was verified separately. Raw events:
  `live-activity-advance-2026-09-16.json`.
- An initial live attempt hit a development-server reload; the two completed runs
  were retried after the reload settled.
- TypeScript: no diagnostics in the changed frontend files. Repository-wide
  checking still reports 770 unrelated diagnostics.

Try a fresh Live Activity session: complete and check one exercise, then wait for
the tutor to advance and introduce the next. Spoken answers alone still do not
place markers or submit/check the exercise. Broader DI demonstration, pointing,
and voice-answer controls are not implemented by this change. Actual microphone
recognition and browser playback still require a human check.
