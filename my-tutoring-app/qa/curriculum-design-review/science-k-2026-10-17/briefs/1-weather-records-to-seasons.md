# Weather records: from a month of weather to a season

> **Status 2026-10-17:** built as modes of `ecosystem-diorama` (a 3D island tank) instead of the remedy below: `season_from_log`, `compare_logs`. See `qa/eval-reports/ecosystem-diorama-birth.md`. Fixing bar-model's hardcoded "Morning vs Afternoon" stays a defect fix.

Curriculum IDs: SCI003-01-D, SCI003-01-G (SCIENCE, grade K). Source: design review science-k-2026-10-17.

## Learning goal and gap

Kindergarten scientists (SCIENCE, unit SCI003 Earth and Space Sciences, skill SCI003-01 Weather and Climate) learn that weather recorded over time shows a pattern, and that the pattern tells you the season or the place.

- **SCI003-01-D:** "Recognize and describe characteristics of the four seasons using evidence from weather patterns"
- **SCI003-01-G:** "Compare weather patterns between different locations and times using simple graphs and charts"

What exists now:
- **bar-model** already has K picture-graph modes, and a tutor that judges a spoken comparison against facts computed in code. But:
  - The counts are random, so snowy days can win in July.
  - `make_graph` uses a fixed weather theme with invented counts.
  - `compare_two_graphs` is hardcoded to "Morning" vs "Afternoon" surveys (gemini-bar-model.ts:1743-1750). The K probe of compare_two_graphs for SCI003-01-G returned toys and snacks.
- **knowledge-check and media-player** can ask "which season has snow?". That is recall of a season fact, not a conclusion drawn from recorded weather.
- **No primitive** shows a child a record of daily weather and asks what it tells us.

**Recommendation:** extend bar-model with weather records. The extension needs:
- counts that follow a season or place (a winter month is mostly snowy and cloudy);
- graphs labelled with the month or place;
- two question types: "which season was this?" and "how are these two places or months different?".

A calendar-style front end, where the child tallies a month grid of daily weather pictures into the graph, would match the daily weather chart kindergarten classrooms keep. The implementing session can decide whether that belongs in bar-model, in calendar-explorer, or in a new primitive.

## Essential behavior

- The record looks like real weather for its place and time, so the data supports the conclusion and the label does not give it away.
- **Season from a record:** the child reads one month's graph (or calendar), names the season, and says which weather showed it ("lots of snowy days").
- **Compare two records:** two graphs labelled with places or months; the child says one way they differ ("more sunny days in July").
- For the season question, the label must not reveal the answer: show "Month 1", or ask before naming the month.

## Worked example

- **Season:** a graph of 14 snowy, 8 cloudy, 3 sunny days.
  - Success: "Winter, because it snowed a lot."
  - Misconception: "Summer, because there are sunny days." The child picks a kind of weather that is present, not the one that is most common.
- **Compare:** "Our town in January" vs "Our town in July".
  - Success: "July has more sunny days."
  - Misconception: "They both have days." True, but not a comparison of the weather.

## Evidence of success

- **Independent evidence:** names the season for fresh records and gives the weather that shows it; makes a true comparison between two labelled records.
- **Should not earn credit:**
  - a season named from the label;
  - a comparison of two rows inside one graph (bar-model already rejects this as `rows_not_graphs`);
  - an answer that ignores the data.
- **Uncertain cases:** spring and fall records can look alike. Decide whether those count, or keep the season question to records that clearly differ.

## Constraints and open questions

- K counts stay small enough to see (no more than about 15 per row), and the K rules against reading numbers aloud still hold.
- Weather depends on where the child lives. Pick climates where the four seasons differ clearly, and say in the item where it is.
- Keep bar-model's existing K modes unchanged for math objectives (contract-first: fork by content source, not in place).

## Handoff

Read the repository's current guidance (/add-eval-modes, the bar-model contract if one exists, calendar-explorer). Decide the owner, the data source and the scoring, then build and verify with your own process.
