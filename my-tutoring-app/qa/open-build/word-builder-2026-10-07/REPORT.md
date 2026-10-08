# word-builder `build_affix` + the shared literacy build judge, 2026-10-07

OB-3L L0 and L1 (qa/open-build/ROADMAP.md, Literacy wave). This is the first literacy build mode and the pilot for
the rest of the wave.

## The mode
"Make a word that means to do it again." The learner taps prefix, root and suffix cards (each printed with its
meaning) into a row and presses "I'm done!". Any word that fits passes: replay, reheat and review all pass for that
ask. Every second item asks for a second, different word. β 2.1 (simple_affix + 0.1). Grades 1-8, scoped to the
lesson grade (user ruling R11: no grade floor). It is its own surface (`WordBuildAffix.tsx`), mounted when the payload
has `task: 'build_affix'`; the four spoken modes are unchanged (contract R7).

## Judge (L0, shared): code, then Jev, then a flash second opinion
1. **Code checks the row's shape first:** `root_only`, `affix_only`, `parts_out_of_order` (one root, prefixes before,
   suffixes after) and `same_word` on the second way. These misses make no model call.
2. **Jev reads the word against the ask** (route `judgeWordBuild`, `service/build-layer/`). It answers two typed
   questions: `real_word` (noul) and `fits_ask` (choice: fits / partly / no). Code passes the word at 0.5 / 0.5.
3. **A Jev rejection gets flash-latest's second opinion.** The learner hears "not yet" only when both judges say so.
   With no TypeSafe key, flash-latest alone judges.

**Calibration** (`word-build-judge-2026-10-07/`): 50 hand-labelled builds (24 pass, 12 not a word, 14 wrong meaning),
run through the production route.

| Run | Jev alone | flash alone | Jev + flash second opinion |
|---|---|---|---|
| 1 | 44/50 | 45/50 | not run |
| 2 | not run | 46/50 | 47/50 |
| 3 | not run | 46/50 | 46/50 |

- **Jev alone (run 1):** rejected 4 right words (refill, unhappy, untrue, careful).
- **flash alone:** rejected 3 right words (replayed, helped, playing). The two judges never rejected the same right word.
- **Second opinion, false rejects (the error a child feels):** run 2: 0. Run 3: 1 ("replayed"), because Jev timed out
  under 12 parallel calls and flash judged alone; the Jev timeout is now 12 s.
- **Remaining errors:**
  - One false accept: "review" for "look at something before", which Jev reads as fitting.
  - Miss labels: unpaint and prepaint come back `wrong_meaning` instead of `not_a_word` on some runs. Either way it is
    a miss; only the wording differs.
- **Jev varies run to run:** "unhappy" for "not happy or not kind" scored 0.42 on fits in one run and 0.63 in another.

## Generator
- `gemini-word-build-affix.ts` (flash-latest): the model writes the board and 4-6 asks. Each ask names a meaning and
  lists 2-5 board words that fit.
- Code (`askableBuildItem`) drops any ask that names a passing word, has fewer than two distinct fitting words, or has
  an example with a bad shape. A thin draw is redrawn once.
- Grades 1-2 get short decodable roots, un/re/pre and ed/ing/ly/ful/er, and plain-word asks. The first G1 draw asked
  "describes an action that was finished earlier", so the prompt now forbids abstract words.
- Routing: word-builder moved from `resolveEvalModeConstraint` (pin only) to `resolveEvalModes`, so an objective about
  attaching affixes can resolve to the build. Unpinned spoken lessons now resolve a level from intent instead of
  always running mixed.

## Levers (start bare)
- `part_frame` (help): typed empty boxes, prefix + root. Answers the three shape misses.
- `model_word` (help): a solved word from parts NOT on this board. Answers `not_a_word` and `wrong_meaning`.
- `small_board` (simplify): the same ask, ungraded, on the example parts plus one other card per type.
- `same_word` is unanswered by decision: the word already made stays on screen.

## Evidence
- **Real generations, pinned:**
  - G1 ×2, G2 ×2, G4 ×1: every draw is all askable with 2-4 fitting words per ask (`gen-*.json`).
  - G2 asks include "Make a word that means to do it again." (replay, reheat, review) and "Make a word that means it
    already happened." (played, helped, heated).
- **vitest:** `WordBuilder.buildAffix.workspace.test.tsx` 11/11 (real runtime). Affected suites: 368 files, 7539 tests
  pass. The one failure in that run was coin-counter's wave-1 flake, since fixed by its owner in 8d0aeee9.
- **Dry journey sweep:** recorded as by design in the baseline, as for open-builder (the judge is a model).
- **typecheck:lumina:** 0.
- **Headless Chromium drive (`drive/`)** through the Language Arts tester, offline lever bench, real G2 generation,
  real judge:
  - "play" → root_only (code)
  - Try again kept "play" in the row
  - "unplay" → not_a_word (judge), and the ladder pulled `model_word` on the second wrong
  - "replay" → pass
  - two-word item: "played" kept on screen, "played" again → same_word, "painted" → pass
- **Tester change:** the Language Arts tester gained the Creation tester's Offline/Live switch and a Word Builder entry
  (word-builder was in no tester before).

About 770 production lines (judge 145, domain 191, surface 327, generator 107) and 111 changed lines in existing
files; 190 test lines, a 50-case labelled set and its runner.

## Not verified / open
- No Live run: the tutor's words on the new verdict and the stop-building pause ride the next literacy class Live gate.
- No phone-width or touch check. The board is a 2-4 column grid of buttons; the row wraps.
- "review" passes for "look before". Asks that two affixes can both answer loosely remain a judge risk.
- `/api/lumina/eval-test` reports `fail` for this payload because its shape check looks for a challenge array, not
  `buildItems`. The content is fine.
- β 2.1 is a prior; tapping parts may be easier than the spoken simple_affix (fewer guesses than a menu, but a visible
  board). Calibration owed.
