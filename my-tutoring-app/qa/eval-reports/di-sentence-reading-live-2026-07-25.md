# di-sentence-reading — L0 LIVE GATE (2026-07-25)

**User mic run through the primitive, same day as the birth. Verdict: PASS —
"it worked fantastically!"** The pack is now runtime-verified at L0.

Surface: `direct-instruction-tester` → **Sentence Reading** → topic *"reading
simple sentences"* → `read_sentence` @ Grade 1.

## What ran

| Item | Sentence | Words | Result |
|---|---|---|---|
| 1 | The rat ran. | 3 | affirmed |
| 2 | I see a pig. | 4 | affirmed |
| 3 | The red hen ran. | 4 | affirmed |
| 4 | The dog is hot. | 4 | affirmed |

**4/4 affirmed**, session completed, recap rendered (every card emerald with its
reward emoji — the amber `🔁` miss state did not appear). The session reached
`isComplete`, which means `finishAndSubmit` fired and the evaluation payload went
out.

## What this closes

1. **The judged loop end-to-end through THIS component** — the real L0 gate, and
   the mirror of #36 / #43 / #48. The engine has four prior live runs, but this
   pack's `applyVerdict` → `recordResult` → `advance` path, its cue builders, and
   its generator had never run together with a real mic until now.
2. **The reward beat at SENTENCE length.** This was the named pacing risk: the
   affirm restates the WHOLE sentence (~2-3s), materially longer than the fact and
   word affirms the 900ms floor / 3.5s cap were tuned against, so the cap could
   plausibly have bound and swapped the stage mid-affirmation. Not flagged as
   dragging or clipping across four items.
3. **The answer-leak gating holds in motion** — the recap prints every sentence,
   which is safe only because each was already on the stage; nothing pictured a
   sentence before it was read.
4. **The stage's one-sentence invariant** — no report of two sentences on screen
   at once (the failure di-math-facts shipped and had to fix a day earlier).

## Run 2 — `sight_phrase_sentence` pinned (same day, after L1 landed)

**PASS — "these are so good!"** The L1 ladder's highest rung, driven with a real
mic in the tester's mode picker.

| Item | Sentence | Words | Result |
|---|---|---|---|
| 1 | I can see it. | 4 | affirmed |
| 2 | We can go up. | 4 | affirmed |
| 3 | My ball is red. | 4 | affirmed (⚽ reward) |
| 4 | You and I can go. | 5 | affirmed |

Closes **#54(c)**. What it verifies beyond run 1:

1. **The L1 pool selection is right at RUNTIME, not just headlessly.** All four
   sentences are from the sight-heavy pool — the mode means what the catalog
   says it means, through the tester's real generate path.
2. **The bench-proven cue lines carry an unread vocabulary.** This mode's words
   (see, go, you, my, and) were never spoken by the tutor in the standing-gate
   sitting or in run 1. The lines are byte-identical across all four modes, so
   this was the last plausible place for the ladder to have disturbed proven
   speech. It did not.
3. **The tester's mode picker drives the right generator path** — the pinned
   `targetEvalMode` reached the generator and stamped every challenge.
4. **The reward emoji renders on an affirmed item** (⚽ on "My ball is red.")
   rather than the ✅ fallback — the post-affirmation-only reward path, which
   run 1's set exercised only via the fallback.

## What this does NOT close

**The sitting was all-correct, so the failure paths stayed dark.** Faithfully:

- **(a) The `silenceCloseMs: 1100` fix has no quantitative proof yet.** The run
  clearly did not break — a split turn tends to produce a visible stall or a
  double judgment, and neither happened — but the fix's actual evidence is three
  numbers I cannot see from the screen: **0 "attempt superseded" events**,
  **non-null `responseMs` on every attempt**, and **`aliasMatch` true on correct
  reads**. Those live in the tester's `[DI eval]` console payload
  (`outcomes[].responseMs`) and the loop's emissions. Until they are read, the
  honest claim is *"the fix did not visibly break the run"*, not *"the fix is
  proven"*. → carried on **HUMAN-CHECKS #54**.
- **(b) The SHORT end is still unstressed (the sitting's own residual, #53).**
  Items 1 and 2 were 3 and 4 words and were read correctly, so the open question —
  can the judge hear a one-word error in a 3-4 word sentence, where it has less
  context than in the 6-7 word items that proved 2/2? — is untouched.
- **(c) The correction branch and `[DI_MOVE_ON]` did not fire in this component.**
  Worth stating precisely, because it differs from di-math-facts' equivalent gap:
  the sentence correction *wording* IS bench-proven (the standing-gate sitting
  drove 3 corrections, including the two deliberate omissions, and both retries
  were affirmed). What is unproven is this component's handling — the
  `corrected` → retry-in-place branch, the 2-correction cap, and the
  `[DI_MOVE_ON]` hand-off that advances the stage on the same audio edge.
- **(d) LANGUAGE_ARTS submit attribution** — expected via the domain default with
  no per-primitive override, but not read from the backend log this run.

## Pattern worth naming

This is the **fourth consecutive all-correct DI sitting through a primitive**.
Across the family, `[DI_MOVE_ON]` has never been heard live at all. The happy
path is now very well evidenced and the failure path is not evidenced anywhere
above the bench — which is exactly what HUMAN-CHECKS **#50** exists for (a
deliberately WRONG answer). Any pack's sitting can close it; this one is now the
cheapest, since a one-word omission is trivial to produce on purpose.
