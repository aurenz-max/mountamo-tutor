# Eval Report: coin-counter — 2026-04-04

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| identify | PASS (after fix) | 1 (fixed) |
| count-like | PASS (after fix) | 1 (fixed) |
| count-mixed | PASS (after fix) | 1 (fixed) |
| make-amount | PASS | — |
| compare | PASS (after fix) | 1 (fixed) |
| make-change | PASS | — |
| fewest-coins | PASS | — |

## Issues (all fixed in this session)

### identify — Options/coins arrays missing from Gemini output
- **Severity:** HIGH
- **What was broken:** Gemini Flash Lite didn't populate flat `option0..option3` and `coin0Type..coin3Type` fields. Component fell back to hardcoded `['penny','nickel','dime','quarter']` every time, reducing variety.
- **Fix:** Generator now derives options from `targetCoin` + grade-appropriate coin pool when flat fields are empty. Coins array derived from options.
- **Fix in:** GENERATOR

### count-like — Mixed coin types violating single-coin-type intent
- **Severity:** HIGH
- **What was broken:** `count-like` and `count-mixed` both map to `challengeTypes: ['count']`. Generator had no constraint to enforce single-coin-type challenges for count-like.
- **Fix:** Generator now filters count-like challenges to those with exactly 1 unique coin type in `displayedCoins`.
- **Fix in:** GENERATOR

### count-mixed — displayedCoins frequently missing entirely
- **Severity:** CRITICAL
- **What was broken:** Gemini skipped flat `displayedCoin0Type`/`displayedCoin1Type` fields. Challenges rendered with zero coins visible and wrong `correctTotal` (fell back to Gemini's stale value or hardcoded 10). Screenshot confirmed empty coin area.
- **Fix:** Generator now rejects any `count` challenge missing `displayedCoins` instead of silently producing broken output. Fallback challenges fill the gap.
- **Fix in:** GENERATOR

### compare — groupA data missing, wrong correctGroup
- **Severity:** CRITICAL
- **What was broken:** Gemini skipped flat `groupACoin0Type` fields. Challenge c1 had no Group A coins, and `correctGroup` fell back to `flat.correctGroup ?? "A"` which was factually wrong (instruction said Group B had more money).
- **Fix:** Generator now rejects any `compare` challenge missing either `groupA` or `groupB`.
- **Fix in:** GENERATOR

## Root Cause

Gemini Flash Lite unreliably populates flattened indexed fields (`coin0Type`, `displayedCoin0Type`, `groupACoin0Type`, `option0`, etc.). The schema uses this pattern to avoid deeply nested arrays that cause malformed JSON, but the tradeoff is silent data loss. The generator's post-reconstruction validation was too permissive — it accepted challenges with missing critical visual data.

## Fix Summary

All fixes applied to `gemini-coin-counter.ts`:
1. **Identify**: Derive `options` + `coins` from `targetCoin` when flat fields are empty
2. **Count**: Reject challenges with no `displayedCoins` (return null → filtered out)
3. **Compare**: Reject challenges with missing `groupA` or `groupB`
4. **Count-like**: Post-filter to enforce single-coin-type constraint based on `targetEvalMode`
5. Rejection logging added for debugging
