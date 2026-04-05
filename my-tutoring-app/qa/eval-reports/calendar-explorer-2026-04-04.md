# Eval Report: calendar-explorer

**Date:** 2026-04-04
**Eval Modes:** identify, count, pattern
**Generator:** `service/calendar/gemini-calendar-explorer.ts`
**Component:** `primitives/visual-primitives/calendar/CalendarExplorer.tsx`

## Results Summary

| Eval Mode | API Status | Challenges | G1 | G2 | G3 | G4 | G5 | Verdict |
|-----------|-----------|------------|----|----|----|----|-----|---------|
| identify  | PASS (3.9s) | 5        | PASS | PASS | PASS | PASS | PASS | PASS |
| count     | PASS (3.8s) | 5        | PASS | PASS | PASS | PASS | PASS | PASS (after fix) |
| pattern   | PASS (3.6s) | 5        | PASS | PASS | PASS | PASS | PASS | PASS |

## Issue Found and Fixed

### COUNT mode: Semantic mismatch on "total days" questions (CRITICAL -- FIXED)

**Problem:** The count generator prompt included "How many days are in February 2024?" as an example question type. Gemini sometimes generated this style of question, setting `targetDayOfWeek` to an unrelated day (e.g., "Monday"). The generator then overrode the answer with `countDayOfWeekInMonth()`, producing `correctAnswer: "4"` for a question whose real answer is `"29"`.

**Root cause:** Two issues:
1. Prompt listed "How many days in [month]?" as a valid question type, but the schema requires `targetDayOfWeek` which only makes sense for day-of-week counting.
2. No validation that the question actually references the `targetDayOfWeek`.

**Fix (GENERATOR):**
1. Removed "How many days are in February 2024?" from the prompt examples; replaced with a day-of-week counting example.
2. Added a validation guard that rejects challenges where the question text does not mention the `targetDayOfWeek` name, ensuring semantic alignment between question and computed answer.

**Verification:** Re-ran count eval-test. All 5 challenges now correctly ask about a specific day-of-week and all computed answers verified against Date math.

## G1 -- Required Fields Audit

All challenges across all three modes contain every required field per the contract:
- `id`, `type`, `question`, `month`, `year`, `correctAnswer`, `options`, `hint`, `narration`
- identify: `highlightDates` present on all 5 challenges
- count: `targetDayOfWeek` present on all 5 challenges
- pattern: no extra required fields

## G2 -- Flat-Field Reconstruction

Options arrays properly reconstructed from `option0`-`option3` flat fields. All challenges have 4 options. No empty arrays observed.

## G3 -- Eval Mode Semantic Differentiation

- identify mode: 5/5 challenges have `type: "identify"` -- PASS
- count mode: 5/5 challenges have `type: "count"` -- PASS
- pattern mode: 5/5 challenges have `type: "pattern"` -- PASS

## G4 -- Answer Derivability

All challenges have `correctAnswer` present in the `options` array. Generator includes explicit validation (lines 303, 457, 570) that forces correctAnswer into options if Gemini omits it.

Spot-check verification (count mode, post-fix):
- Mondays in Jan 2024: computed 5, answer "5" -- CORRECT
- Tuesdays in Feb 2025: computed 4, answer "4" -- CORRECT
- Saturdays in Jun 2026: computed 4, answer "4" -- CORRECT
- Wednesdays in May 2024: computed 5, answer "5" -- CORRECT
- Sundays in Dec 2025: computed 4, answer "4" -- CORRECT

## G5 -- Fallback Quality Audit

Fallback expressions audited in generator:

| Location | Expression | Reachable? | Produces valid challenge? |
|----------|-----------|-----------|--------------------------|
| L294 | `hint ?? "Look carefully..."` | Yes (Gemini omits) | Yes |
| L295 | `narration ?? "Let's explore..."` | Yes | Yes |
| L427-428 | count hint/narration defaults | Yes | Yes |
| L531 | pattern hint/narration defaults | Yes | Yes |
| L593-632 | Static FALLBACKS object | Yes (empty Gemini response) | Yes -- verified all 3 by Date math |
| L699 | `allowedTypes[0] ?? "identify"` | Edge case only | Yes |
| L443-454 | Count options from computed count | Always fires | Yes -- always produces 4 unique options |

All fallbacks produce pedagogically correct challenges.

## Component Rendering Check

Component correctly handles:
- All three challenge types with appropriate UI (calendar grid click for identify, button options for count/pattern)
- `highlightDates` displayed after correct answer on identify
- `targetDayOfWeek` used for visual highlighting on count challenges
- Multi-phase summary via PhaseSummaryPanel
- Empty challenges guard (line 284)
