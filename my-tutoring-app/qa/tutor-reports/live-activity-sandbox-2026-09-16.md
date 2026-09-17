# Live activity sandbox — September 16, 2026

Implemented at **Lumina → Developer Tools → Live Activity** and
`/lumina/live-activity`. This is an opt-in development sandbox with one enabled
primitive, number-line, using its existing five evaluation modes and generator.

## Verification

- 30 targeted frontend tests passed, including request validation, render-before-
  acknowledgment, stale generation rejection, cancellation, errors, same-session
  requests, actual number-line jump state, and generator regression coverage.
- 6 backend lifecycle tests passed: matching mount receipts, nonblocking declaration,
  silent state streaming, replacement, duplicates, cancellation, timeout, reset.
- TypeScript: zero diagnostics in Lumina components or changed context/API/page
  files. The repository-wide check still reports 770 diagnostics elsewhere; it is
  not a clean global typecheck.
- Both `/lumina` and `/lumina/live-activity` served HTTP 200; the home HTML includes
  the new Live Activity card. Invalid primitive/mode requests returned HTTP 400.
- Final real-backend drive: **3/3 sessions completed two generated activities on
  one live connection**. All three correctly identified the synthetic student's
  jump endpoint as 2. Transcripts used the actual first challenge's start and hop
  count after the corresponding mount acknowledgment, without giving its landing
  answer. Full events/content: `live-activity-sandbox-2026-09-16.json`.

The harness uses real Firebase test-account authentication, Gemini Live and
`generateComponentContent`. It explicitly simulates the browser mount receipt;
React tests independently verify the mount timing and stale-result contract. No
browser automation surface was available, so visual layout, actual microphone
capture, interruption while speaking, and playback quality still need a human try.
Earlier development drives encountered hot-reload service restarts and a duplicate
turn-end issue in the harness. The final drive resets its per-beat transcript guard
so duplicate turn-end events cannot skip the student-state question.

## Scope and findings

The first drive exposed number-line's code-picked operations mixing addition into
a subtraction request. A small fix adds an operation enum to the **existing** range
resolver and constrains numeric selection before text generation; no extra model
call was added. Real fixed-topic probes returned subtraction-only, addition-only,
and mixed operations as requested. Further topic-fidelity work is deferred per the
user's direction. The initial evidence is retained in
`live-activity-sandbox-before-2026-09-16.json`.

Jump endpoints and ordering placements were absent from number-line's live state
bag; they now travel with the existing structured state. Sandbox evaluation remains
local because the tester has no EvaluationProvider. No mastery writes were added.

This slice tests tutor-initiated activity generation/replacement. It does **not**
yet implement micro-actions such as focus, highlight, or demonstrate-a-jump. Those
are the next bounded experiment on an already-mounted primitive. Async support
does not by itself prove good conversational behavior while generation is pending.
