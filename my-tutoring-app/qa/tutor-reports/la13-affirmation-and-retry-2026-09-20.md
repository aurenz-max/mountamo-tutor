# LA-13 closed as two small fixes, not a criterion ruling

Date: 2026-09-20 · Drives: `run_live_runtime.py`, text mode, real backend + Gemini Live

The queue held LA-13 open as a shared-criterion question — "should a whole-assignment
affirmation that names no answer be creditable when the prior tutor turn corrected or
modelled the target?" — on the evidence of five adopters across three domains all landing
in the same 0.84–0.86 band. User challenge: that is not a real question. It was not.

## Finding 1 — the band was four adapters missing one sentence

The 0.84–0.86 band is not evidence that JEV's criterion is wrong. It is the signature of a
tutor being vague, and the tutor was vague because nothing told it not to be:

| adapter | guidance chars (cap 2000) | said about affirming |
|---|---|---|
| countingBoardLive | 1087 | nothing |
| shapeSorterLive | 1042 | nothing |
| numberSequencerLive | 1435 | nothing |
| diLetterSoundsLive | 1932 | "Merely restating what you heard … reads as your own teaching rather than as credit" |
| diWordReadingLive | 1994 | the same discouraging sentence (fixed earlier today) |

Three adapters had no affirmation rule at all and plenty of headroom. One actively told the
tutor not to name the answer. Each now carries one domain-specific sentence: say so **and**
name the answer back in the same breath; praise that names no answer is generic and credits
nothing. No observer change, no threshold change, no phrase rule.

## Finding 2 — the retry stall was a missing mirror, not missing wiring

`useTeachingWorkspace.ts:137` already did `if (d.transition === 'retry') { session.retry(); reset(); }`.
The contract already carried `'none' | 'retry' | 'advance'`. Nothing needed wiring.

`decideDialogue` forces `advance` when the verdict is certainly `correct` and feedback is
finished (`finishedSuccess`), but had no mirror for a certain `incorrect` — so reopening an
item required a **second, independent** classification to clear 0.90. When the correction
scored .59–.89 the item stayed in `checked` and nothing could reopen it. The tutor said
"give it another try" and the runtime would not take one.

Added `settledFailure`: grounded, verdict certainly `incorrect`, answer not correct →
`transition: 'retry'` at the verdict's own confidence, reason `tutor_incorrect_reopen`.
Finished feedback is deliberately not required — a correction that leaves the door open
*is* the invitation to retry, and requiring it would strand exactly the corrections that
teach.

## Live results

| primitive | before | after | affirmations |
|---|---|---|---|
| di-word-reading | 2/5 | **4/4** | 0.91–0.99, all name the word |
| counting-board | — | **3/3** | 0.99–1.00, all name the number |
| number-sequencer | — | **2/2** | all name the number |
| di-letter-sounds | — | 2/3 | 0.93–0.97, all name the sound |
| shape-sorter | 0/2 (control) | 0/2 | both affirmations pass; failure is elsewhere |

`tutor_incorrect_reopen` fired in 3/4 word-reading runs, 3/3 counting-board runs and 1/2
number-sequencer runs. The clearest proof is word-reading run 4: the transition question
scored `retry@0.59` — no threshold change would have saved it — and the item reopened on
the verdict's 0.98. Run 2's transition question chose `none@0.75`, likewise unreachable by
any gate adjustment.

Gates: `typecheck:lumina` 0; full vitest 7070 passed / 10 skipped, 0 failures.

## What did NOT close

- **shape-sorter times out after the second item.** A control run on the reverted adapter
  fails identically 0/2, so it is pre-existing and unrelated. Both affirmations were
  accepted in every run, before and after. Separate defect, still open.
- **One residual sub-threshold affirmation**, di-letter-sounds run 2: the tutor asked an
  intermediate question ("What picture do you see next to the letter 's'?"), the driver
  answered the whole assignment ("sss") anyway, and the affirmation naming that sound
  classified `correct` at 0.84. This is no longer the "names no answer" family — the answer
  IS named. It is a prior-turn mismatch, and partly a harness artifact, since a real child
  asked about the picture would say "sun". Narrower than LA-13 was; worth its own item.
- **The two harness families** (model leaking its own tokens into speech — seen twice today
  as `=""=\"\"` and a Chinese-language run; demonstration narrated without being performed)
  are untouched.
