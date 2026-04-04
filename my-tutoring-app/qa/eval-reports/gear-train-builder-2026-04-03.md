# Eval Report: gear-train-builder — 2026-04-03

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| (none defined) | FAIL | 3 |

**No eval modes exist in the catalog.** Cannot test via eval-test API. Issues below are from code review and user-reported root cause.

## Issues

### (no mode) — No eval modes defined in catalog
- **Severity:** CRITICAL
- **What's broken:** `gear-train-builder` has `supportsEvaluation: true` but no `evalModes` array in the engineering catalog. The adaptive session can select this primitive but there are no challenge types to dispatch — hydration produces nothing.
- **Data:** `evalModes = undefined` in catalog entry (engineering.ts:35-39)
- **Fix in:** CATALOG

### (no mode) — Session deadlocks when prefetch returns 0 items
- **Severity:** CRITICAL
- **What's broken:** When Gemini generator returns malformed JSON (65K+ chars from overly-complex schema interaction) and hydration fails, `prefetch()` returns 0 items. `waitingForDelivery` is never cleared, causing the session to deadlock permanently on "Preparing next challenge..."
- **Data:** Generator returned 65K+ malformed JSON; prefetch count = 0
- **Fix in:** SESSION ENGINE (defensive: clear waitingForDelivery on empty prefetch)

### (no mode) — Generator prompt is excessively long
- **Severity:** HIGH
- **What's broken:** The generator prompt is ~275 lines of grade-level guidelines. While the schema itself is reasonable (2 types, ~12 properties), the massive prompt increases the chance of Gemini producing verbose/malformed JSON. The prompt should be trimmed to essential constraints.
- **Data:** Prompt length ~275 lines in gemini-gear-train.ts
- **Fix in:** GENERATOR
