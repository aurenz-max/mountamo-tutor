# Eval Report: vocabulary-explorer — 2026-07-04

Focused re-test after a field-reported regression: challenge #2 (`fill_blank`) keyed
the wrong option as correct (Elevation marked correct, Terrain marked wrong) while the
explanation clearly described Terrain. This is a regression of VE-1.

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| explore (match)          | PASS (unaffected) | — |
| recall (match/fill_blank)| PASS | — |
| apply (fill_blank/context)| PASS | — |

Sampled 8 live generations (grade 3–5; Local Landforms, Weather/Climate, Solar System):
**22/22 multiple-choice challenges correctly keyed**. Post-redesign, `correctIndex` is
spread across positions 0–3 (no anchoring) and every challenge renders 4 options.

## Root Cause (VE-1 regression)

VE-1 (2026-06-25) derived `correctIndex` from the `correctAnswer` TEXT field instead of
the LLM's positional index. But it kept a last-resort branch:

```
if (correctIndex < 0) correctIndex = typeof c.correctIndex === 'number' ? c.correctIndex : 0;
```

Flash Lite routinely drops the flat `correctAnswer` field (same failure class as SP-14
that produced VE-3). When it does, VE-1 fell straight back to `c.correctIndex`, which the
code's own comment says "anchors to 0" — silently shipping option 0 as correct. That is
the field-reported bug (Elevation = option 0, keyed correct; Terrain = the real answer).

## Fix (VE-4, GENERATOR) — correct-by-construction, not heuristic recovery

The first VE-4 attempt piled text-matching heuristics (related-term lookup, unique-
explanation scan, containment) on top of the broken representation. On review
(cf. MultipleChoiceProblem / knowledge-check, which bind the answer to an option
**identity**, never a slot) that was still brittle — every heuristic is individually
fallible. Root cause is the representation: asking the LLM to author a pre-assembled
option list AND separately point at the answer couples correctness to positional
bookkeeping the model reliably gets wrong.

**Final fix — remove the coupling.** The schema no longer has `option0-3` /
`correctIndex`. The model emits `correctAnswer` + `distractor0/1/2` as separate fields.
Code assembles and shuffles the option list and reads `correctIndex` off the placement
it just made (`options.indexOf(correct)` — exact). The LLM never tracks a slot, so the
entire SP-25 failure class is structurally impossible here. No text-matching. If the
model drops the flat fields (SP-14), fall back to a term-derived challenge (also correct
by construction). Distractors are topped up from other terms so 4 options always render.

Bonus: `context` mode now produces real "identify correct usage" sentences (correct
usage vs. plausible-misuse distractors) instead of the empty-sentence / bare-word output
the old path emitted.

`tsc --noEmit` clean (no new errors in the generator).

## Observations (not flagged as blocking)

- **Prose variance (MEDIUM):** one earlier `apply` generation produced a rambling
  `fill_blank` sentence with repeated blanks. The answer key was still correct and the
  target word was not leaked, so it is a prose-quality/variance issue, not an answer-key
  or leak defect. Candidate for a future sentence-length/format constraint in the prompt,
  tracked separately if it recurs.
