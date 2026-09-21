# One scene builder per domain, one DI shell; the mark sentence stays (brief 11 items 6, 3, 7)

Date: 2026-09-21 · Executor: `/add-live-tutor-tools`

## Item 6: the verdict probe replays the lesson's real input

Each adopter's domain module now exports `workspaceAssignment(item)` (task, expected answer,
response channel) and `workspaceScene(item, view)` (objects and facts). The seven components
spread them into the workspace, and `scripts/tutor-verdict-probe.mjs` imports them through the
Vite module runner, building each case's item from a challenge fixture with the real builder.
Nothing is copied. A domain table replaces the five flag ternaries; `--dry` prints each input.

Counting Board's scene needed the board state as input (`counted`, `removed`, `added`, `moved`,
`covered`, `hidden`); the K quick-look board still publishes no objects (contract R14).
`boardGroups` moved from the component to `countingBoardDomain.ts`.

The old copies had drifted more than the brief said:

| Domain | Old probe input vs lesson |
|---|---|
| counting-board | facts were `{ response }` only; the task wording differed |
| shape-sorter | facts were `{ response }` only: no target, geometry, assignment or ring sentence |
| number train (before/after) | no `kind`, no `assignment` |
| di-letter-sounds | no `supportTier`, no `markMeaning` |
| di-word-reading, di-math-facts | no `markMeaning` |
| letter-sound-link | identical |

Re-baseline on the real input, 3 repetitions: board 54/54, shapes 42/42, letters 36/48, words
45/48, trains 41/42, facts 63/63, links 57/63. The failing cases are the ones already recorded
(letters: the LA-13 shapes and two keyword/clipped cases; words: `wrong_then_corrected`; links:
the two bare-token replies; trains: one repetition of `next_number`). The drift had not been
hiding a verdict difference.

## Item 3: removing `markMeaning` was measured and reverted

Removed from the four domains that carry it, plus Shape Sorter's `ringMeaning`:

| | sentence in `facts` | sentence removed |
|---|---|---|
| JEV verdict probe, five domains | 227/243 | 228/243, same failing cases |
| Mean verdict confidence on correct cases | 0.962–0.997 | 0.971–0.998 |
| Connected `--startup --audio` journeys, 5 families × 3, run in parallel | **14/15 PASS** | **10/15 PASS** |
| "Show me" answered without a visible mark | **1/15** | **3/15** |

The three misses without the sentence: letter sounds ("Listen closely to how I start the word
moon: mmm"), word reading ("Let's look at the first letter, c"), and the number train, which said
"I've marked the glowing car" and marked nothing. The other two failures in that arm are not
about marks: an Azure speech-synthesis error, and a reply that stated the answer without crediting
the child ("Exactly, the letter m makes the mmm sound"), which JEV correctly did not record.

The shared `demonstrate` affordance already tells the tutor that marks are not learner responses;
the domain sentence adds what the marks point at here, and the runs say the tutor uses it. The
earlier doctrine sweep had 1 missed demonstration in 28 runs with the sentence present. The
sentence stays in `facts`; adapter guidance has no room for it (item 8).

## Item 7: `DiTeachingStage`

`direct-instruction/DiTeachingStage.tsx` owns what the three DI teaching components repeated:
the empty state, the workspace binding, the evaluation submit, the completion recap and the
card. Each pack now supplies its domain builders, its drawn stimulus, an optional trail of
committed answers, a recap label, its metrics (`diStageMetrics` plus any extra field) and its
wording. The components went from 574 lines to 291, plus the 140-line shell; the next DI pack
needs roughly the size of `DiLetterSoundsTeaching` (74 lines) instead of 200. DOM and `data-*`
selectors are unchanged: 647 DI and runtime tests pass, and 9/9 connected `--startup --audio`
journeys pass on the saved payloads (18/18 demonstrations visible, 18/18 correct answers
credited, every run completed). Evidence: `{family}-di-stage-shell-2026-09-21.json`.

## Checks

`typecheck:lumina` 0, full `tsc` 770 (baseline), full frontend suite 7155 passed / 0 failed. Two
tests that grepped the probe source for copied sentences now assert instead that the mounted
stage publishes exactly `workspaceAssignment` and `workspaceScene`.

Evidence: `verdict-scene-2026-09-21/{domain}-{before,after}.json` (before = sentence present, the
kept design), `{family}-mark-meaning-2026-09-21.json` (removed) and
`{family}-mark-meaning-control-2026-09-21.json` (kept).
