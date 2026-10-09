# hundreds-chart levers (2026-10-08 class sweep)

`/add-support-tiers` on all four modes. Before this, the tutor's only move on the chart was `begin_help`. The lever table was not confirmed with the user first; the user waived that stop for this class sweep.

## Failure inventory

There is no real-learner evidence. `logs/demonstrations` and `qa/misconception` have nothing for this primitive. `qa/tutor-reports` holds only W1 runtime payloads.

| Mode | Failure (class) |
|---|---|
| highlight / complete | stops before the end of the board, leaves numbers out, adds extras, counts by another step, taps stray numbers (synthetic: `hundredsChartMiss`, and the journey's stray tap; documented: catalog `commonStruggles` "Missing cells", "Clicking wrong cells") |
| identify_pattern | picks a description that does not match the drawn shape (documented: "Cannot identify the visual pattern"). Until now no miss was named. |
| find_skip_value | picks twice or half the step, one off, or further off (synthetic: miss function; documented: "Wrong skip value guess") |

## Lever table

| Mode | Lever | Kind | Carrier | Leak rule (code) |
|---|---|---|---|---|
| highlight, complete, find | `hop_dots`: a dot on each cell passed over between consecutive highlighted or tapped numbers. On highlight with no taps, the dots run from 1 and stop before the first number. | help | shown | `dotsLeak`: a dot never goes on a marked cell or past the last marked number. With no taps, a dot never goes on a number the learner has to find. No number is written on the dots, and the fact gives no count. |
| highlight, complete (board of 2+ rows) | `row_tally`: dots at each row's end, one for each highlighted or tapped number in that row | help | shown | `tallyLeaks`: the tally counts only what is marked on the board, never the pattern's count for a row |
| identify_pattern | `model_chart`: a 1-30 chart beside the item with a different count highlighted and its description as the caption. Where possible the caption is one of the item's wrong choices. | help | both | `modelLeaks`: never the item's own step, its correct description, or a later item's answer. Nothing is drawn on the item's chart. |
| all four | `simpler_chart`: the same mode with a plainer count. Cell modes get 5 cells counting by 10s or 5s. Identify gets a 10s or 5s count with two choices, one far. Find gets 4 cells counting by 2s or 5s, with two choices. | simplify | shown | `practiceLeaks`: same mode, its own id, a different step. Never the item's answer or the start of it, never identical to another item in the lesson. On identify and find, never a later item's answer. |

Starting positions: on easy, `hop_dots` and `model_chart` start shown. This does not count as a pull. The row tally only ever appears when pulled. The generator is unchanged apart from where it gets the description table.

## What was built

- `hundredsChartLevers.ts`: new pure module holding the levers, their leak rules, the builders and `practiceParent`. `PATTERN_DESCRIPTIONS` moved here from `gemini-hundreds-chart.ts`, and the generator now imports it, so every caption is the exact text of an option.
- `hundredsChartWorkspace.ts`: identify_pattern now names a miss (`chose_rows`, `chose_columns`, `chose_diagonal`, `chose_scattered`), based on what the chosen sentence describes.
- `HundredsChart.tsx`: lever state and the practice item now live in the component. It draws the dots, the row tally, the model chart and a "Practice chart" label, and implements `pullLever`/`endPractice`. A practice success records nothing for the session.
- Catalog: `misses.identify_pattern` added.
- `liveJourneySpec.ts` hundreds-chart row: rebuilds `~simpler` from its parent.
- There is no `docs/contracts/hundreds-chart.md`. Contract derivation was not run.

## Tests

- `hundredsChartLevers.test.ts` (47 tests) covers:
  - each leak rule over random items;
  - the builders over 400 random lessons: same mode, solvable, never the item's answer, more than 600 built;
  - which items are already the plainest;
  - the miss-to-`nextLever` table and the easy starting positions;
  - per item on the four saved W1 payloads, that every catalog miss has a lever on that item (the J12 check).
- `HundredsChart.levers.workspace.test.tsx` (10 tests), per mode, mounted:
  - a pull changes the screen and the scene fact in one commit;
  - a refused pull leaves the scene, levers, attempts and HTML unchanged;
  - the next try records the lever;
  - the simpler chart is ungraded, the full item comes back blank, and its answer is credited with both levers recorded.
- Existing tests still pass: `HundredsChart.workspace`, `hundredsChartWorkspace` (miss table extended), generator grade-band, variety and window tests, the oracle, `workspaceSubmission`. 70 passed.
- `npm run typecheck:lumina`: 0.
- Not run (left to the batch verify step): the journey sweep and the tutor replay. No Live runs.

## Items still without a lever

- **Counting in order on a 1-10 board (step 1, one row): no lever.** Dots would land exactly on the skipped numbers, which are the answer. A tally on one row is just the learner's own count. A shorter count-in-order would be the start of the answer. On a 1-20 board, `row_tally` answers every cell miss.
- **find_skip_value counting by 1 (only reachable on a sub-100 board):** there are no passed cells to dot, and no plainer count exists.
- **Plainest items:** cell modes counting by 10s, and find counting by 2s, have help but no simplify.
- **identify and find with every plainer count still ahead in the lesson:** no simplify, because the practice item would answer the later item. For example, the W1 identify payload's by-2s item has 5s and 10s still ahead. Help still answers every miss there.
- **Cell modes:** the practice run may count by a later item's step. Five cells of that step leave the later full board still to do, so this is allowed. It is a partial preview of the later item, not its answer.

Nothing was added to `unanswered`, because every catalog miss has a lever on every item in the saved payloads.
