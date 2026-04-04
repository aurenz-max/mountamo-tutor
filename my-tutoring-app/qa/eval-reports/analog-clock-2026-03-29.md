# Eval Report: analog-clock — 2026-03-29

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| read      | PASS (after fix) | 1 (fixed) |
| set_time  | PASS (after fix) | 3 (fixed) |
| match     | PASS (after fix) | 1 (fixed) |
| elapsed   | PASS (after fix) | 2 (fixed) |

## Issues (all fixed)

### AC-1: read / match — Digital display leaks the answer
- **Severity:** CRITICAL
- **What was broken:** `digitalDisplay` always rendered `formatTime(displayHour, displayMinute)`. In read/match modes, student saw the target time in the digital display — assessment completely defeated.
- **Fix:** Digital display now only shown for `elapsed` mode or after `isCurrentChallengeCorrect`. Hidden in read/match/set_time until answered.
- **Fix in:** COMPONENT

### AC-2: set_time — Minute hand can't cross past 45 minutes (hour never advances)
- **Severity:** CRITICAL
- **What was broken:** Drag handler had stale closure (`displayMinute` state didn't update between rapid pointermove events) and off-by-one boundary (`> 45` instead of `>= 45`).
- **Fix:** Replaced state-based `prevMin` with `prevMinuteRef` (sync ref update in handler). Changed boundary to `>= 45` / `<= 15` for wraparound detection.
- **Fix in:** COMPONENT

### AC-3: set_time — Digital clock should be hidden
- **Severity:** HIGH
- **What was broken:** Digital display showed the time being set, making set_time trivial — drag until readout matches target.
- **Fix:** Same conditional as AC-1 — digital display hidden in set_time mode.
- **Fix in:** COMPONENT

### AC-4: set_time — AI re-introduces activity on every clock reset
- **Severity:** HIGH
- **What was broken:** `aiPrimitiveData` included `displayedTime` which changed on every drag, triggering Gemini context updates. Reset to 12:00 caused repeated "Welcome!" introductions.
- **Fix:** Removed `displayedTime` from `aiPrimitiveData`. Answer check messages already include time context.
- **Fix in:** COMPONENT

### AC-5: elapsed — correctOptionIndex always 0 (wrong answer marked correct)
- **Severity:** HIGH
- **What was broken:** Generator auto-correction only validated correctOptionIndex for read/match types. Elapsed challenges always got `correctOptionIndex: 0`.
- **Fix:** Generator now derives elapsed duration from `startHour/startMinute → targetHour/targetMinute`, builds human-readable elapsed strings, and matches against options to derive `correctOptionIndex`.
- **Fix in:** GENERATOR

## Root Cause

Component had answer leakage (digital display visible in assessment modes) and a drag interaction bug (stale React closure + off-by-one boundary). Generator lacked elapsed-specific correctOptionIndex derivation.

## Fix Summary

All fixes applied across component and generator:
1. **AC-1/AC-3**: Digital display conditionally rendered — only for elapsed mode or after correct answer
2. **AC-2**: Drag handler uses `prevMinuteRef` (ref) with `>= 45` / `<= 15` boundaries
3. **AC-4**: `displayedTime` removed from `aiPrimitiveData`
4. **AC-5**: Generator computes elapsed duration and derives `correctOptionIndex` from options
