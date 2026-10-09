# strategy-picker levers (2026-10-08 class sweep, built 10-09)

`/add-support-tiers` on guided, match, try_another, compare, choose. Lever table designed and built in one pass (user waived the Phase 2 stop for this sweep).

## Failure inventory

No real-learner evidence (no demonstrations, misconception or remediation files for this primitive). The tutor reports hold W1 text runs only.

| Mode | Failure (miss id) | Class |
|---|---|---|
| guided, try_another, choose | answer one off: miscounted the picture (`one_short`, `one_over`) | observed-synthetic (the journey's wrong answer is result+1) + inferred |
| guided, try_another, choose | answered one of the printed numbers (`printed_number`) | inferred (the check names it) |
| guided, try_another, choose | combined the numbers the other way (`other_operation`) | inferred |
| guided, try_another, choose | off by more (`short_by_more`, `over_by_more`) | inferred |
| guided, try_another | "gives different answers with different strategies" | documented (commonStruggles) |
| match | tapped a strategy that draws the same kind of picture (`similar_strategy`) | observed-synthetic + documented ("cannot identify the strategy") |
| match | tapped an unrelated strategy (`different_strategy`) | observed-synthetic + documented |
| compare | none: every choice is credited | n/a |

## Lever table

| Mode | Failure | Lever | Kind | Carrier | Leak rule |
|---|---|---|---|---|---|
| guided, try_another, choose | all six number misses | `two_parts`: number line gets a ring on the start and each hop numbered over its arc; ten frame gets the top row of five outlined plus a swatch and number for each colour; doubles get each group labelled, near doubles the extra dot labelled +1; tally marks and circles are coloured in two parts, each labelled | help | both | writes only the equation's own numbers and hop ordinals; never a total, never a label at the landing tick (`partsLeak`). Choose refuses the pull until a strategy is picked. |
| guided, try_another, choose | all six number misses | `smaller_numbers`: same mode and strategy, about half as much to count or move; steps built in code from the new numbers | simplify | shown | strategy constraint holds, different answer, never any lesson item's problem, steps never print the result (`practiceLeaks`). Not offered on the smallest picture (one hop, a double of one, two marks, one counter into ten). |
| match | similar / different strategy | `option_pictures`: a small picture of every choice, each on its own example problem | help | both | every choice once, none on the item's problem (`picturesLeak`). The strategy is the answer, so the help works on models outside the item. |
| match | similar / different strategy | `two_choices`: another strategy's worked solution (code template, names no strategy), two choices that draw different pictures | simplify | shown | answer ≠ the item's strategy, the two options differ in picture kind, problem is no lesson item. Not offered when the item already has two far choices. |
| compare | — | no lever | — | — | no checked miss: every choice is credited. |

Per item: `two_parts` exists on every number item and answers every number miss; `option_pictures` exists on every match item. So no item's miss is left without a lever, and nothing goes in `unanswered`. Simplify is absent on items that are already the smallest shape (tested).

Starting positions: easy starts `two_parts` on. On match, it starts `option_pictures` on when easy or when the generator set `showStrategyExemplars`. A starting position is not recorded as a pull. No generator change: the component reads `supportTier`.

## What was built

- `strategyPickerLevers.ts` (new): lever declarations, `partsMarks`/`partsLeak`/`partsFact`, `optionPictures`/`picturesLeak`, `simplerProblem`, `practiceItem`/`practiceParent`/`practiceLeaks`, `exampleProblem`.
- `StrategyPicker.tsx`: lever state and practice item (pattern-builder shape); `pullLever`/`endPractice`; parts marks drawn in all five visualizations; a practice success records nothing. The exemplar strip now draws each strategy on its own example and never on the item's problem. Before, every strategy was drawn on 4 + 4, so near doubles showed no extra dot and looked the same as doubles. This also changes choose's easy-tier strip.
- `strategyPickerWorkspace.ts`: `PICTURE_KIND` exported.
- `liveJourneySpec.ts` (strategy-picker row only): a `~simpler` item is rebuilt from its parent with `practiceItem`.
- The catalog already listed misses for every graded mode, so it is unchanged. This primitive had no rows in `QUEUE-item-gaps-2026-10-09.md` and no J12 baseline entry.

## Tests

- `StrategyPicker.levers.workspace.test.tsx` (new, 26 tests). It covers each leak rule over every drawable problem, the simplify builders (more than 80 built, all solvable, never a lesson item), the plainest items, the `nextLever` tables, and the easy start. It also mounts each of guided, try_another, choose and match and checks four things: a pull changes the screen and the scene fact in one commit; a refused pull leaves demand, levers, attempts and HTML unchanged; the next attempt records the lever; and the simpler item is ungraded and gives the full item back blank, credited with both levers recorded.
- `StrategyPicker.workspace.test.tsx` 14/14, `lessonWorkspacePlan.test.ts` 14/14, `workspaceContract.test.tsx -t strategy` 21/21.
- `typecheck:lumina`: 0 errors in these files. One error remains, in a sibling's file (`hundredsChartLevers.test.ts`).
- Not run here: the journey sweep and tutor replay (batch verify step) and Live runs.

## Open

- `qa/support-levers/m3-lever-tables-2026-10-02.md` records the user skipping strategy-picker (they doubt its pedagogy). This build follows the 10-08 class-sweep instruction. The user should confirm it stands.
- There is no `docs/contracts/strategy-picker.md`. The leak rules above are its lever requirements, and `/primitive-contract` should record them.
- The number-line picture already shows where the hops land, because tick labels sit under the last hop. That comes from the original design, not from a lever.
