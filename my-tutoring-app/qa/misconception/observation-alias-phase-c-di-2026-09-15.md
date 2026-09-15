# Observation alias migration, Phase C (direct instruction) — 2026-09-15

Phase C of `qa/HANDOFF-observation-alias-migration-2026-09-15.md`. The 5 DI packs (di-deduction, di-worked-procedure,
di-spoken-practice, di-word-problem-setup, di-dice-roll) now use the one `observation(item, { heard, verdict })`
callback, and every host submits `summary.learningResponses`. No cues, sentinels or items changed. Uncommitted, on top
of uncommitted Phases A and B.

## What changed

- Five verdict-worded fallbacks ("The tutor judged the deduction / step / answer / spoken quantity wrong") became
  `No transcript was captured.`
- The challenges already stated the stimulus (rule and case, problem and column, the tutor's ask, the pips shown),
  except di-word-problem-setup. Its challenge now also lists the number cards with their story values ("red marbles
  (13), blue marbles (4), all the marbles (?)"). Its gesture observation used to name only the big-amount slot. It now
  names every placed card: "Built the family with "Jen's stickers" in the big-amount slot and "Tom's stickers" and
  "how many more" in the part slots." Before, "nothing" was quoted as if it were a card label; empty slots now read
  `nothing` without quotes.
- di-spoken-practice submitted no student work at all (`undefined`); it now submits `{ learningResponses }`.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck:lumina` | 0 |
| DI script, stage, mode and Pip suites | 27 files / 290 tests pass |
| `DiWordProblemSetup.stage.test.tsx`, new case | after a wrong family build, the observation quotes the story, lists the number cards with values, names all three placed cards, says "No transcript was captured." for the voice step, carries no verdict words; the run's `learningResponses` reach the submitted student work |
| Verdict-word grep over the five files | nothing |
| Census `RUN=alias-di` vs run2 | di-deduction, di-worked-procedure, di-spoken-practice and di-word-problem-setup still distil a hypothesis naming the same signature miss (repeats the rule; regroups every column; one extra count word; opposite operation). di-dice-roll has no drive adapter, as in run2. One evidence-stage case timed out at 5 s on the first run (cold import); the stage rerun alone passed 5/5 |
| Full vitest | 519 files passed, 3 skipped (6,579 tests) |

## Residual

- The census drives voice items only, so di-word-problem-setup's placement text is covered by the stage test, not the
  distiller.
- di-dice-roll drive adapter still owed (`/tutor-test`).
- Phase D (science, history, other: 11 packs), then Phase E (delete the alias).
