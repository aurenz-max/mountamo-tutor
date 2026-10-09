# calendar-explorer levers (2026-10-08 class sweep, run 10-09)

`/add-support-tiers` on all 8 eval modes. The user waived the "confirm the table first" stop for this class sweep, so the table below was built without that confirmation.
Size: about 400 production lines (`calendarExplorerLevers.ts` 405 including docblock, about 180 in `CalendarExplorer.tsx`, 25 for the month misses, 6 in the journey row, 3 in the catalog) against about 460 test lines.

## Failure inventory

| Mode | Failure (what the check sees) | Evidence class |
|---|---|---|
| identify | weekday one off (`day_before`/`day_after`), other weekday; date a week off, next to it, elsewhere | observed-synthetic (journey wrong option); documented (commonStruggles "confuses day-of-week with date number", "clicks random dates") |
| mark_events | marker a week off / next to / elsewhere | inferred (no payload) |
| count | one less, one more, other | inferred; documented (2026-04-04 eval report: count questions) |
| pattern | as identify | inferred |
| day_offset | lands on start, one short, one past, other | inferred (the miss ids name it) |
| interval_count | one less / one more (endpoint convention), other | inferred |
| day_sequence | given day said back, one skipped, backwards, other | observed-synthetic (journey `plainWrong` = given day); documented (commonStruggles) |
| month_sequence | the same four, for months: **no miss function existed**; added (`start_month`, `month_after`, `month_before_start`, `other_month`) and listed in the catalog | documented (commonStruggles) |

There is no real-learner evidence. No demonstrations, misconception reports, remediation module or contract doc exist for this primitive. Content that would corrupt the evidence: none found. The saved identify payload's keys check out against the date arithmetic.

## Lever table (built)

| Mode | Lever | Kind | Carrier | Leak rule (code) | Answers |
|---|---|---|---|---|---|
| identify, pattern | `ring_dates`: ring on each date the question names | help | shown | never on the answer date (`ringLeaks`) | weekday + date misses |
| identify, pattern | `weekday_tint`: tint every cell of the asked weekday | help | shown | never when the answer is a weekday (`tintLeaks`) | date misses |
| identify (today star) | `time_arrow`: arrow over the grid showing that days run left to right and then wrap to the next row | help | both | on no cell; `does` forbids naming the before/after square | weekday + date misses |
| identify, pattern, count | `day_headers`: Sun..Sat row back, only where the tier withdrew it | help | shown | never offered at K or untiered (nothing withdrawn) | weekday misses, `next_to_date`, `other_count` |
| mark_events | `row_ranges`: first and last date written left of each week row | help | shown | a row of one date gets no label (`rowsLeak`) | date misses |
| count, interval_count | `tick_taps`: a tap leaves a tick that the learner can remove | help | shown | code never places a tick; the fact never gives a count | count misses |
| count (hard) | `weekday_tint`: the tier's purple tint back | help | shown | the fact never gives a count | count misses |
| day_offset | `week_strip`: seven days from the start day, only the start marked | help | shown | `stripLeaks`: 7 days, starts at start, one mark | offset misses |
| day/month_sequence | `model_pair`: card showing two OTHER names in order | help | both | neither name is the turn's day/month or its successor; the pair is not a turn still ahead (`modelPairLeaks`) | all four spoken misses |
| identify "Nth weekday" | `simpler_question`: the FIRST of that weekday | simplify | shown | `practiceLeaks`: new id, same mode, different answer, no session question | `same_column_date`, `other_date` |
| mark_events | `simpler_question`: a free date in the top row | simplify | shown | same + not marked, not another item's date | date misses |
| count | `simpler_question`: same weekday in Feb 2026 (4 full rows) | simplify | shown | not offered when the item's own count is 4 | count misses |
| day_offset | `simpler_question`: one day forward from another start | simplify | shown | start and landing ≠ item start/answer | offset misses |
| interval_count | `simpler_question`: two days apart, same convention, away from the item's markers | simplify | shown | same | count misses |

Starting positions: easy starts with the grid help levers shown (not a pull). The tier's existing withdrawals (headers, tint) are now the hard start of `day_headers`/`weekday_tint`. A pulled `day_headers` adds a `coaching` fact so the tutor may point at the header row again.

## What was built

- `calendarExplorerLevers.ts` holds the declarations, the leak rules, the builders, the scene facts, `calendarPracticeParent` and the `model_pair` chain lever.
- `CalendarExplorer.tsx`: in the grid, lever and practice state keyed by item, plus ticks; a practice question records no result; ring, tint, ticks, row labels, time arrow and week strip are drawn; `pullLever`/`endPractice`. In the chain, `model_pair` state and its card.
- `calendarExplorerWorkspace.ts`: the month chain's spoken misses. Catalog: `levers: true`, `month_sequence` misses. Journey row: rebuilds `<id>~simpler` from its parent.

## Tests

- `calendarExplorerLevers.test.ts` (31): each leak rule; each builder over every relevant item (every Nth-weekday ask 2024-26, 36 months of mark items, every start × step, 160 intervals); miss → `nextLever` table; saved payloads: every wrong option on every identify item has a lever on that item, simplify offered on c4, every day-chain turn has `model_pair`.
- `CalendarExplorer.levers.workspace.test.tsx` (6, mounted): pull changes the screen and the scene fact in one commit; the next attempt records the lever; a refused pull leaves scene, levers, attempts and DOM unchanged; simplify opens `c1~simpler` (ungraded), the full item comes back blank and is credited with `[weekday_tint, simpler_question]`; ticks only from taps; easy start is not a pull; the model pair on the day chain.
- Existing calendar suites (8 files) and the generator tests pass, 145/145 with the new files. The dry journey on the two calendar payloads (`-t calendar-explorer`) passes 2/2, J9/J12 included. `activityContract`, `lessonWorkspacePlan` and the calendar rows of `workspaceContract` pass. `typecheck:lumina` reports 0 errors.

## Gaps (per item, no lever)

- identify or pattern items that name no date in the item's month, have no today star and no "Nth weekday", e.g. "What is the last day of February 2024?". They get `day_headers` only where the tier withdrew it, and otherwise have no lever. These are Gemini-authored, so code cannot rebuild them. No saved payload has one, so J12 cannot see the gap.
- pattern has no simplify lever: its questions are LLM-authored, and there is no code builder for them.
- weekday-answer identify has no simplify lever; ring + headers are its help.
- No catalog `unanswered` entries were needed: every listed miss is answered on the payload items.
- Not done: the replay/Live lever gate (batch step); no contract doc exists for this primitive (`/primitive-contract` not run).
