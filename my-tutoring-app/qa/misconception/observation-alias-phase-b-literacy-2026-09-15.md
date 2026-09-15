# Observation alias migration, Phase B (literacy) — 2026-09-15

Phase B of `qa/HANDOFF-observation-alias-migration-2026-09-15.md`. All 18 literacy packs now use the one
`observation(item, { heard, verdict })` callback. Every host now submits `summary.learningResponses` (recipe step 5,
found in Phase A). No cues, sentinels or items changed. Not yet committed; Phase A is uncommitted too.

## What changed

- **Every observed fallback states a fact.** 29 verdict-worded fallback strings ("The tutor judged the answer wrong from the
  audio", "Said something that did not match", "Tapped a letter that did not match", "Gave no complete comparison",
  "No usable spoken response was heard") became `No transcript was captured.` or `Tapped …; which one was not
  recorded.` you-and-me recorded the raw transcript with no framing; it now reads `Heard "…"`.
- **Challenges state what the child saw or heard** where they only named the task. The letters on screen
  (letter-sound-link hear-see, letter-spotter find-it grid and match-it options), the picture menus (phoneme-explorer,
  letter-sound-link keyword-match, rhyme-studio identification), the rhymes already collected, the sentence and wall
  labels (sentence-analyzer), the story text (story-talk), the excerpts and genre choices (genre-explorer, clipped at 500
  characters each), the passage (text-structure-analyzer name-structure, clipped at 1,200), the chart and group
  choices (text-structure, word-sorter), the page's printed parts (interactive-book find-feature), the scene labels
  (oral-sentence-studio), the three pictured events (story-ribbon), the two story lines compared (story-bridge), the
  previous chain word and the context words (word-workout).
- **A behaviour fix in letter-spotter.** Its observation also recorded confusion pairs. Under the old corrections-only
  alias that was right; under `observation` it would have logged a pair on an affirmed attempt whose single letter
  differs from the target (the judge accepts the sound as well as the name). Pairs now come only from corrected attempts.
- Three tests that called the old field directly (story-bridge, you-and-me, read-aloud-studio phrasing) now call
  `observation`. No `diagnosisObservation` remains under `literacy/` or in `WordBuilder.tsx` (cvc-speller's
  `diagnosisObservationsRef` is its own `useJudgedSpeechLoop` ledger, outside this migration).

## Verification

| Check | Result |
|---|---|
| `npm run typecheck:lumina` | 0 (it caught a `for…of entries()` in the Phase A capture test, fixed) |
| Phase B script, stage, capture and Pip suites | 61 files / 1,257 tests pass |
| Mounted capture test `literacy/LetterSpotter.capture.test.tsx` (extended) | wrong-first run submits all 8 attempts as `learningResponses` (5 affirmed), no verdict words, challenge quotes the sentence; new case: an affirmed "n" for m logs no pair, a corrected "p" for s logs `p-s`. Both assertions fail when their fix is removed |
| Verdict-word grep over the migrated files | nothing |
| Census `RUN=alias-literacy`, 9 declared sources vs run2 | all 7 run2 hypotheses still name the signature miss (letter-sound-link, letter-spotter, oral-sentence-studio, phoneme-explorer, rhyme-studio, syllable-clapper, word-builder); phoneme-explorer's is now more specific ("rather than selecting among the displayed picture options") because the menu is in the evidence; sentence-analyzer abstains as in run2 (a different confusable per item); read-aloud-studio has no drive adapter, as in run2 |
| Full vitest | 519 files passed, 3 skipped (6,578 tests) |

## Residual

- Non-declared packs (word-workout, interactive-book, genre-explorer, story-talk, text-structure-analyzer, word-sorter,
  story-bridge, story-ribbon, you-and-me) are not in the census; their text is covered by typecheck, their suites and
  read-through only.
- read-aloud-studio drive adapter still owed (`/tutor-test`).
- Phases C (DI, 5 packs), D (other, 11), E (delete the alias).
