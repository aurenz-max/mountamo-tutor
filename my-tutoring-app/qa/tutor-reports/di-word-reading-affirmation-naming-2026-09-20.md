# di-word-reading — affirmation must name the word (live verification)

Date: 2026-09-20 · Harness: `backend/tests/tutor_live/run_live_runtime.py --primitive di-word-reading`
Runs: 5 (2 + 3) · Raw: `di-word-reading-live-runtime-2026-09-20-affirm-names-word{,-b}.md`

## What was changed

`adapters/diWordReadingLive.ts` guidance. The old text read "Affirm the child for the
word they just read, in your own words. Merely restating the word, or stating a fact
about it, reads as your own teaching rather than as credit." That discouraged naming the
word, and the tutor's resulting generic praise was not judgeable as whole-assignment
credit. Replaced with: say so **and** name the word back in the same breath; praise that
names no word is generic and credits nothing. Guidance is 1996 chars against the 2000-char
`parse_activity_spec` cap, so two sentences elsewhere were tightened to make room.

## The failure this addresses

Session `2026-09-20-123553-lumina-tutor-360467332ef4.jsonl`, item `diwr-3-pan`. The child
read "pan" correctly; the tutor said "Spot on, you are really getting the hang of reading
these words!" The observer scored `correct` at 0.66 against a 0.90 gate and abstained with
`uncertain_or_invalid`. The item stayed open for 35 s until the child asked "¿Qué?", and
the recovery turn abstained the same way.

## Result

Every accepted success in the five runs named the word, and none scored near the gate:

| tutor reply | verdict | feedback |
|---|---|---|
| "That's right, the word is Sam!" | correct 0.99 | finished 0.99 |
| "Excellent, the word is mat!" | correct 0.98 | finished 1.00 |
| "That's right, the word is cat!" | correct 0.99 | finished 0.99 |
| "You've got it, the word is mat!" | correct 1.00 | finished 1.00 |

Correct-verdict abstains: 0. This matches the historical split in the pre-fix reports —
affirmations that name the word score 0.97–1.00, affirmations that do not score 0.66–0.85.

## Open, pre-existing, unrelated to this change

3 of the 5 runs failed before reaching any affirmation, all on the same retry stall:
the observer accepts `incorrect` with high confidence, the phase moves to `checked`, but
the retry transition lands under the 0.90 gate (0.63, 0.83, 0.89), so `decideDialogue`
returns `transition: 'none'` and nothing returns the item to `working`. The tutor says
"go ahead and give it another try" and the runtime will not take one; the harness times
out waiting for `phase === 'working'`.

`decideDialogue` forces `advance` for a certain `correct` plus finished feedback
(`finishedSuccess`) but has no mirror forcing `retry` for a certain `incorrect`.

Pre-existing: `transition_uncertain` with a paired `TimeoutError` appears in
`di-word-reading-workspace-audio-progression-2026-09-20.json` (2 and 2) and
`di-word-reading-workspace-text-2026-09-20.json` (1 and 1), all recorded before this edit.
Needs a ruling — it is a gate question, not a tutor-instruction one.
