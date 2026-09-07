# `di-spoken-practice[compare_choice]` — the closed-set comparative mode

**Date:** 2026-09-06 · **Handoff:** [HANDOFF-di-spoken-practice-comparative-2026-09-06.md](../HANDOFF-di-spoken-practice-comparative-2026-09-06.md)
**Closes:** `qa/di/BACKLOG.md` item 34 · `qa/lesson-bench/BACKLOG.md` item 30(c), supply half
**Evidence:** [di-spoken-practice-compare-2026-09-06.json](di-spoken-practice-compare-2026-09-06.json) (9/9, real Gemini)

## What shipped

A fourth task identity on the content-generic pack: the child is shown TWO things and SAYS
which word from a menu the objective NAMED describes them. `closed_set_choice`, β 2.0.

The split that makes it work: **code owns the menu, the model writes the pairs.** The planner
extracts the required words from the objective text through the same token-grounding that
grounds a printed symbol (`compare_choice` targets are menu WORDS, and `buildPlannedSpokenItems`
refuses to build them — there is no stimulus mapping to repeat). The item generator then writes
the object pairs around that menu, and `hasChoiceCoverage` re-checks after the gates that every
named word was actually asked. A session covering three of four words ships nothing.

## The gate that makes the exemption honest

A comparative ask must read the menu aloud, so it contains the answer by construction — the
answer-leak scan had to exempt it. That exemption is only safe paired with
`findChoiceMenuDefects`, which requires **every** choice in **every** ask. A complete menu tells
the child nothing; a menu narrowed to two of four is a two-way guess in a four-way costume, and
it is the shape the model reaches for unprompted (the wxyu draw's own intent proposed
"is it longer or heavier?" verbatim). Four other refusals ride the same gate: <2 choices, an
answer off the menu, choices the ear cannot separate, and —

**Found live, first real generation:** flash-lite wrote **"a long pencil"** against a menu holding
"longer". Every whole-token gate passed it (`containsPhrase` is deliberately blind to substrings —
it is what stops "cat" hitting "catalog"), but a five-year-old hears the answer in the adjective.
Closed with a 4-character shared-stem rule that catches long/longer, heavy/heavier, light/lighter
and short/shorter while sparing the accidents (leaf/lighter, ladybug/lighter). Zero stem giveaways
in the six sessions generated after the fix.

`findUnspokenStimulus` also grew the pair case — the ask must NAME both things, because two
unnamed pictures are not a comparison for a pre-reader — and stopped requiring articles, which
was a latent false-drop on every mode ("the rock" against a stimulus reading "a rock").

## Verification

| Gate | Result |
|---|---|
| `tsc --noEmit` | **770 = baseline**, 0 new |
| `typecheck:lumina` | **0** |
| vitest (DI + catalog + hooks) | **570/570**, 44 files |
| Live probe, real Gemini | **9/9** — [json](di-spoken-practice-compare-2026-09-06.json) |

The probe tests both halves, because either alone is a false pass. **SELECTION:** stripped of
their pins, both frozen manifests route obj3's spoken slot to `compare_choice` through the real
`resolveLessonEvalModes`. **RESOLUTION:** 6 independent draws (3 per objective text), every one
full-menu, leak-free, both-things-spoken. **REFUSAL:** the out-of-scope explain objective
("Explain what the equal sign means") still ships nothing — the planner calls it `unsupported`.

## Coverage confirm — and the line it draws

Fresh sessions spliced into the two frozen packages, re-judged:

| | before | after |
|---|---|---|
| **3rvk** obj3 *"**Describe** … using words like longer, shorter, heavier, and lighter"* | `ASSESSED_INSUFFICIENTLY` — "heavier and lighter are never sorted or produced… generated 0 items" | ✅ **`ASSESSED_SUFFICIENTLY`** — "Spoken production tasks directly elicit all four target descriptive words" |
| lesson coverage | 0.67, 1/3 sufficient | **0.83, 2/3 sufficient** |
| **wxyu** obj3 *"**Explain** the difference … using your own words"* | `ASSESSED_INDIRECTLY` — "generated 0 items" | `ASSESSED_INDIRECTLY` — generation failure GONE (evidence 6→8, all four items cited), new note: "closed-set selection… rather than an open explanation" |

That is the handoff's own scope line, drawn by the judge rather than asserted: **describe** with a
named word set is now supplied; **explain in your own words** is open production, which
`open_set_word` blocks by design, and it stays with lesson-bench item 21(c). Both draws lose the
`generation_failure`; only the in-scope one reaches SUFFICIENT.

## Residuals

- **The explain shape is untouched and deliberately so** — `…-ah5w` obj2, `…-f00i` speak-the-rule,
  wxyu obj3. Needs a judged live utterance, not a pre-generated item pack.
- **No mic sitting.** The judged loop was never driven with a real child voice on this mode; the
  menu clause reaches the tutor as text nobody has heard performed. → HUMAN-CHECKS.
- **Not swept.** Per pilot-then-sweep, no other `evals.jsonl` row was converted; the
  "does any other lesson share this shape" grep is the next pull, not this slice.
