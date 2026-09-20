# Tentative answers and erroneous counts

The user's 17:45:57 session advanced c1, c2 and c3, then stalled on c4.
The pasted inspector establishes two distinct source-answer defects:

- `Is this 12?` was excluded by our own rubric treating every question as
  non-submission. The tutor affirmed it, but the runtime retained unknown evidence.
- `1 2 3 4 6` was split into `1 2 3 4` and `6` because recognition required a
  correct consecutive sequence. JEV then had competing fragments instead of one
  incorrect counting attempt.

The shared interpretation rubric now accepts tentative proposed answers while
excluding method/help questions, quotations, hypothetical and retracted answers.
Counting recognition retains a whole numeric sequence; the domain checker separately
checks the sequence and final quantity. Missing/repeated/reversed numbers are
incorrect attempts even if the last number matches the target. Group tasks accept
their declared group size as well as individual counting. No confidence threshold
was lowered, no phrase-specific frontend answer rule or tutor tool was added.

The inspector now preserves actual confidence on abstention, hides placeholder
scores during pending requests, and labels source-answer events with the original
item. Old c1 diagnostics are no longer visually attributable only to the current c4.

## Verification

- 135 focused frontend tests passed (15 files). Actual host regressions reproduce
  an initially unchecked twelve-block board, delayed interpretation of `Is this 12?`,
  completed tutor audio, visible advancement, and cancellation on newer input.
- Lumina typecheck passed with zero errors.
- [Real JEV boundary probes](counting-board-answer-boundaries-current-2026-09-19.json):
  39/42 passed across three repetitions. Both reported failure families and the
  negative help/method/quotation cases passed each time. The three failures are the
  added tentative self-correction `I said 6, but could it be 5?`: JEV abstained due
  to competing candidates. That limitation is retained, not relabelled a pass.
- [Real audio journeys](counting-board-tentative-audio-2026-09-19.json): 3/3 passed
  with actual synthesized `Could it be ...` speech, provider transcription, checked
  wrong answers, corrections, two visible advances, settled completion and no
  tutor progression calls or mastery writes. Saved generated payload; headless
  mounted components with simulated paint and playback hardware, not human-browser
  microphone certification.

The screenshot also shows the tutor stating twelve during help before the learner's
answer. These source-answer fixes do not resolve or certify that teaching-quality
issue, or automatically infer verbal assistance that bypasses `begin_help`.
