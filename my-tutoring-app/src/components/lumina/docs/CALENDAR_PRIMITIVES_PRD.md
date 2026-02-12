# PRD: Calendar & Time Concepts Primitives

## Problem Statement

The Lumina catalog covers math, science, engineering, biology, astronomy, physics, literacy, and media — but has **zero primitives for calendar and time concepts**. This is a significant gap: understanding days, weeks, months, years, and decades is foundational to K-5 education, cuts across math and social studies standards, and is prerequisite to elapsed time, scheduling, data analysis over time, and historical thinking.

## Target Audience

- **Primary:** Grades K-5 (core calendar literacy)
- **Extended:** Grades 6-8 (elapsed time calculations, historical timelines, cyclical patterns)

## Proposed Primitives (6)

### 1. `calendar-explorer` — Interactive Calendar Navigation

**What it does:** A full interactive monthly/yearly calendar where students click days, navigate months, identify patterns (weekdays, weekends, holidays), count days in months, and answer questions about dates.

**Learning goals:**
- K: Days of the week, today/yesterday/tomorrow
- Grade 1: Months of the year, ordering months, reading a calendar
- Grade 2: Days in each month, counting days between dates, before/after
- Grade 3: Leap years, calendar patterns (e.g., "What day will March 1 fall on?")
- Grade 4-5: Scheduling, multi-month planning, recurring events

**Interaction model:** Students click/tap dates, navigate forward/backward through months, highlight ranges, answer embedded questions ("How many Tuesdays in October?", "What is the date 2 weeks from March 5?").

**Evaluable:** Yes — questions have verifiable answers (date identification, counting, pattern recognition).

**Evaluation metrics:**
- `questionsCorrect` / `questionsTotal`
- `navigationAccuracy` (did they land on the right month/date)
- `patternIdentified` (boolean — did they spot the repeating pattern)
- `attemptsCount`

---

### 2. `timeline-builder` — Place Events on a Timeline

**What it does:** Students place event cards onto a scaled timeline. Timelines can span hours, days, weeks, months, years, decades, or centuries. Supports both personal timelines ("My day", "My year") and historical timelines ("Important inventions", "US history"). Drag-and-drop with snap-to-position and immediate feedback on correct placement.

**Learning goals:**
- K-1: Sequence daily events (morning, afternoon, night), days of the week order
- Grade 2-3: Sequence monthly/yearly events, understand before/after/between
- Grade 4-5: Place historical events on decade/century timelines, understand era and scale
- Grade 6-8: Multi-scale timelines (zoom from centuries to decades to years), BCE/CE

**Interaction model:** Drag event cards from a bank onto the correct position on the timeline. Progressive phases: Phase 1 (Explore) — place 2 events with strong hints. Phase 2 (Practice) — place 3-4 events with position feedback. Phase 3 (Apply) — place all events independently.

**Evaluable:** Yes — event placement has correct positions.

**Evaluation metrics:**
- `eventsPlaced` / `eventsTotal`
- `orderCorrect` (boolean — all events in correct sequence)
- `positionAccuracy` (average distance from correct position, normalized 0-100)
- `scaleUsed` (hours | days | weeks | months | years | decades | centuries)
- `attemptsCount`, `hintsUsed`

---

### 3. `elapsed-time-calculator` — Find Duration Between Dates/Times

**What it does:** Given two dates (or times), students calculate how much time passes between them. Visual aids include a number-line-style time bar, a clock face for hours/minutes, and a calendar strip for days/months. Students enter their answer and get step-by-step feedback.

**Learning goals:**
- Grade 2: Elapsed time in hours on a clock (e.g., 2:00 to 5:00 = 3 hours)
- Grade 3: Elapsed time in hours and minutes, crossing noon/midnight
- Grade 4: Elapsed days between calendar dates within a month
- Grade 5: Elapsed time across months, accounting for variable month lengths
- Grade 6-8: Complex elapsed time with mixed units (years, months, days)

**Interaction model:** Multi-phase — Phase 1: students identify the start and end on the visual. Phase 2: students count units between them. Phase 3: students enter the total elapsed time. Visual scaffolding fades across phases.

**Evaluable:** Yes — elapsed time has a definitive correct answer.

**Evaluation metrics:**
- `correctAnswer` / `studentAnswer`
- `accuracy` (0-100, with partial credit for close answers)
- `unitConversionCorrect` (boolean — did they handle unit conversions properly)
- `visualStrategyUsed` ("counting-on" | "subtraction" | "landmark-numbers")
- `attemptsCount`

---

### 4. `time-unit-converter` — Convert Between Time Units

**What it does:** A visual conversion tool where students convert between time units: minutes <-> hours, hours <-> days, days <-> weeks, weeks <-> months (approximate), months <-> years, years <-> decades, decades <-> centuries. Uses a "function machine" metaphor — input a value, select units, convert, see the result with visual proportional bars.

**Learning goals:**
- Grade 2: Hours in a day, days in a week
- Grade 3: Days in a month (variable!), months in a year, minutes in an hour
- Grade 4: Weeks in a year, days in a year (365 vs 366)
- Grade 5: Years in a decade, decades in a century, multi-step conversions
- Grade 6-8: Approximate conversions (weeks <-> months), precision vs estimation

**Interaction model:** Students are given a quantity in one unit and must convert to another. Visual bars show proportional relationships. Progressive difficulty: single-step conversions -> multi-step conversions -> approximate conversions.

**Evaluable:** Yes — conversions have correct answers (with tolerance for approximate units).

**Evaluation metrics:**
- `conversionsCorrect` / `conversionsTotal`
- `conversionType` (exact | approximate)
- `multiStepSuccess` (boolean — did they chain conversions correctly)
- `accuracy` (0-100)
- `attemptsCount`

---

### 5. `date-pattern-finder` — Discover Calendar Patterns

**What it does:** Students investigate patterns in how calendars work: why months have different lengths, the leap year rule, what makes a year a leap year, day-of-week cycling patterns, and how seasons align with months. Presents calendar data and asks students to find and articulate the pattern. Uses highlighting, sorting, and grouping tools.

**Learning goals:**
- Grade 1-2: "30 days hath September..." — which months have 28/30/31 days
- Grade 3: Leap year identification (every 4 years), why February is special
- Grade 4: Day-of-week patterns (if Jan 1 is Monday, what day is Feb 1?), 7-day cycling
- Grade 5: The full leap year rule (divisible by 4, except centuries, except 400s)
- Grade 6-8: Modular arithmetic connections, calendar reform history

**Interaction model:** Students are shown calendar data (tables, mini-calendars, highlighted patterns) and must identify, predict, or extend patterns. Phase 1: observe and highlight. Phase 2: predict the next instance. Phase 3: articulate the rule.

**Evaluable:** Yes — pattern predictions have correct answers.

**Evaluation metrics:**
- `patternIdentified` (boolean)
- `predictionCorrect` (boolean — did they predict the next occurrence)
- `ruleArticulated` (string — student's explanation, for teacher review)
- `accuracy` (0-100)
- `patternType` ("month-lengths" | "leap-year" | "day-cycling" | "seasonal")

---

### 6. `seasonal-cycle-viewer` — Months, Seasons, and Natural Cycles

**What it does:** A circular/ring visualization showing the 12 months arranged in a cycle (not a line), with overlaid seasonal bands, daylight duration curves, temperature trends, and cultural/natural events (migration, harvest, holidays). Students rotate the ring, compare hemispheres, and connect abstract month numbers to concrete seasonal experiences.

**Learning goals:**
- K-1: Four seasons, which months are in which season, weather patterns
- Grade 2: Months cycle — after December comes January again
- Grade 3: Northern vs Southern hemisphere seasons are opposite
- Grade 4: Daylight hours change through the year (connects to astronomy `day-night-seasons`)
- Grade 5: Climate vs weather, why seasons happen (tilt connection)

**Interaction model:** Primarily exploratory with embedded questions. Students rotate the cycle, toggle overlays (seasons, temperature, daylight), compare hemispheres, and answer questions. Less evaluable than others — more of a rich visualization with optional knowledge checks.

**Evaluable:** Optional — knowledge-check style questions can be embedded.

**Evaluation metrics (if evaluable):**
- `questionsCorrect` / `questionsTotal`
- `hemisphereComparisonMade` (boolean)
- `overlaysExplored` (count of data layers toggled)

---

## New Catalog Domain

These primitives should live in a new **`CALENDAR_CATALOG`** in `catalog/calendar.ts`, registered in the catalog index. This keeps the domain cleanly separated and avoids bloating the math or science catalogs.

**Rationale for a separate domain:** Calendar concepts are cross-curricular (math + social studies + science) and don't fit neatly into any existing domain. A dedicated catalog allows AI agents to pull in calendar context specifically when time-related topics are requested.

## New Generator Domain

A new `service/calendar/` directory with Gemini generator services for each primitive, and a new `calendarGenerators.ts` in the generators registry.

## File Inventory (per primitive)

Following the ADDING_PRIMITIVES checklist, each primitive requires 7 files:

| File | Purpose |
|------|---------|
| `primitives/visual-primitives/calendar/[Name].tsx` | React component + data interface |
| `types.ts` | Add ComponentId to union |
| `service/calendar/gemini-[name].ts` | Gemini generator |
| `service/registry/generators/calendarGenerators.ts` | Generator registration |
| `service/manifest/catalog/calendar.ts` | Catalog entry |
| `config/primitiveRegistry.tsx` | UI registry entry |
| `evaluation/types.ts` | Custom metrics interface |

**Total new files:** ~14 new files (6 components + 6 generators + 1 catalog + 1 generator registry), plus edits to 4 existing files (types.ts, primitiveRegistry.tsx, evaluation/types.ts, catalog/index.ts).

## Implementation Priority

| Priority | Primitive | Rationale |
|----------|-----------|-----------|
| **P0** | `calendar-explorer` | Most fundamental — reading a calendar is prerequisite to everything else |
| **P0** | `timeline-builder` | High cross-curricular value (math sequencing + social studies history) |
| **P1** | `elapsed-time-calculator` | Core math standard (3.MD.1), directly tied to state testing |
| **P1** | `time-unit-converter` | Builds conversion fluency needed for elapsed time and science |
| **P2** | `date-pattern-finder` | Deepens understanding but not prerequisite |
| **P2** | `seasonal-cycle-viewer` | Rich visualization, connects to existing astronomy primitives |

## Cross-Primitive Connections

| Calendar Primitive | Connects To |
|---|---|
| `seasonal-cycle-viewer` | `day-night-seasons` (astronomy) — same seasonal concepts, different visualization |
| `timeline-builder` | `number-line` (math) — timeline is conceptually a number line for dates |
| `elapsed-time-calculator` | `tape-diagram` (math) — elapsed time can be modeled as part-whole |
| `time-unit-converter` | `function-machine` (math) — conversion is a function |
| `date-pattern-finder` | `factor-tree` (math) — divisibility rules for leap years |

## Open Questions

1. **Should `timeline-builder` support collaborative timelines?** (Multiple students placing events on a shared timeline) — defer to v2.
2. **Hemisphere handling in `seasonal-cycle-viewer`** — should the AI auto-detect student location, or always default to Northern Hemisphere with a toggle?
3. **Cultural sensitivity** — holiday/event references in `calendar-explorer` and `seasonal-cycle-viewer` should be configurable. Generator prompts should avoid assuming specific cultural calendars.
4. **Approximate conversions** — "weeks in a month" (~4.3) and "days in a month" (28-31) need clear pedagogical guidance. Should we teach averages or ranges?
