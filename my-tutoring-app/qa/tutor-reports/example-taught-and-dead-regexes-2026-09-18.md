# LA-10a `exampleTaught` 3/3 failure — closed, plus a defect class it uncovered

2026-09-18. Executor `/eval-fix`. Queue: `LIVE_LESSON_ROADMAP.md` LA-10a.

## The reported failure

The ten-frame live journey failed 3/3 on `exampleTaught`: the tutor opened the prepared
worked example and said only "6 counters are on the frame.", omitting 4 and 10. The prior
session's A/B had pinned the cause away from LA-12 M0 and left it at "bisect the uncommitted
tree".

Two causes, both in shared code, neither in the model.

**1. The instruction contradicted itself.** `RUNTIME_INSTRUCTION` carried a new line, "say each
step's caption in order, one short sentence per step", six lines above an older one, "explain the
actual values or labels and their stated relationship **in one short sentence**". The tutor
resolved the contradiction by saying one sentence and ending its turn. Nothing prompts it between
parts, so the example was announced and abandoned. The failure appeared on 09-18 and not on 09-17
because ten-frame's prepared artifact changed from a one-sentence `counter-example` to a
three-frame `step-sequence` — one turn had been enough for the old shape.

Rewritten to say it once: teach the example in ONE turn, before you stop speaking, every step in
order when it has frames and one sentence when it has none.

**2. The harness judged one turn and discarded the rest.** `judged_runner` set
`spoken_at_open = said` on each turn while the detour was open, so a tutor that taught all three
steps across two turns was scored on the last one alone. Now accumulated.

Re-driven 3/3 PASS, replaying the same payload as the failing run:
`ten-frame-example-taught-fix-2026-09-18.json`. The tutor now says "Six counters are on the frame.
Count the empty spaces. There are four. Six and four make ten."

## What the regression gate found: dead regexes, invisible in every reader

Driving counting-board as the regression check failed on its own judge, and it had failed the same
way on 09-18 before any change here. The tutor said "count each one once" and the judge
`/\beach\b[^.]*\bonce\b|.../i` reported no match — while the identical regex typed into `node`
matched. The file held literal **backspace bytes (0x08)** where `\b` was meant. An editor, `grep`,
`Read`, a code review and `String(fn)` all render 0x08 as nothing, so the source reads exactly
right and the regex can never match. `tsc` accepts it.

A tree scan found 33 of them in three shipped files:

| File | Dead check | Consequence |
|---|---|---|
| `liveJourneySpec.ts` | counting-board worked-example judge | the journey could not pass; 8 bytes |
| `service/math/gemini-length-lab.ts` | `unitFromObjective`, all 7 unit regexes | **a "measure with your hands" objective drew a RANDOM unit**; 21 bytes |
| `service/qa/oracles/analog-clock.ts` | `hand_name` answer-leak | an oracle check that could never fire — false green; 4 bytes |

The length-lab one is the 2026-09-09 K-probe defect its own docblock says was fixed ("a hands
objective drew cubes three times out of three"). The fix was written correctly and saved dead.

**A/B on the live generator** (`scripts/probe-length-lab-named-unit.mjs`, real Gemini, 4 named
units): repaired **8/8** honored the objective's unit; corrupted **1/4**, and that one by chance
(`length-lab-named-unit-2026-09-18.json`, `...-BEFORE-...json`).

**A/B on the oracle**: two new seeded-violation tests for the `hand_name` answer leak — the check
had no test at all, which is how it stayed dead. Both fail against the corrupted regex and pass
against the repair.

**The channel, not the symptom.** A writer that interprets `\b` as an escape — a shell heredoc,
`sed`, a Python string without `r''` — produces this, and it recurs the moment one is used. Guard:
`service/qa/__tests__/sourceControlBytes.test.ts` fails on any C0 byte in Lumina sources. It
immediately caught two more: `StepContentRenderer.tsx`'s dollar sentinel written as a raw 0x01
(deliberate, now `'\u0001'`) and this session's own first attempt at the docblock above, which hit
the same trap while describing it.

## Gates

`typecheck:lumina` 0 · frontend vitest **6879 passed** / 3 files skipped (baseline 6875 + 4 new) ·
backend `tutor_live` 61 passed · ten-frame journey 3/3 PASS · counting-board journey 1/1 PASS.

## Residuals, not fixed here

1. **Off-script re-ask.** Run 3 of the ten-frame drive answered the return with "Hopefully, that
   helps! What is your answer now?" instead of the runner's exact re-ask cue. The runner owns that
   speech. Known class (TU-6 / di item 30), one more witness.
2. **`tutor_led` judges one turn too.** The same overwrite pattern exists in the tutor-led program's
   `turn()` helper, which returns only the turn that satisfied its predicate. comparison-builder
   passes today because it describes and opens in one turn; a framed artifact on a tutor-led
   primitive would hit exactly this. `/add-live-tutor-tools`.
3. `qa/di/BACKLOG.md` carries 2 control bytes in prose. Harmless, left alone.
