# Eval Report: analog-clock — 2026-03-29

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| read      | FAIL   | 1      |
| set_time  | FAIL   | 3      |
| match     | FAIL   | 1      |
| elapsed   | FAIL   | 2      |

## Issues

### AC-1: read / match — Digital display leaks the answer
- **Severity:** CRITICAL
- **What's broken:** `digitalDisplay` at line 789 always renders `formatTime(displayHour, displayMinute)`. In read/match modes, `displayHour/displayMinute` are set to the target answer (line 429-431). Student sees e.g. "11:30" in the digital display and picks "11:30" from MC options — assessment completely defeated.
- **Data:** `displayHour = targetHour, displayMinute = targetMinute` in read/match modes
- **Fix in:** COMPONENT — hide digital display during read/match/set_time until student answers correctly

### AC-2: set_time — Minute hand can't cross past 45 minutes (hour never advances)
- **Severity:** CRITICAL
- **What's broken:** The drag handler (lines 527-557) has two bugs:
  1. **Stale closure:** `prevMin = displayMinute` (line 547) reads React state which doesn't update between rapid pointermove events within the same render frame. Multiple drag events fire before React re-renders, so `displayMinute` stays frozen at the last-rendered value.
  2. **Off-by-one boundary:** `prevMin > 45` (line 548) uses strict greater-than, but grade '1-2' snapping maxes out at 45. `45 > 45` is always **false** — the hour can never advance for K/1-2 grade bands.
- **Result:** User drags minute hand to :45 but can't cross to :00. Hour hand never changes. Clock appears to "jump backwards" when trying to cross the 12 o'clock position.
- **Data:** `snapMinute('1-2') → [0, 15, 30, 45]`, stale `displayMinute` in closure
- **Fix in:** COMPONENT — use a ref for previous minute (sync update in handler), change boundary to `>=`/`<=`

### AC-3: set_time — Digital clock should be hidden
- **Severity:** HIGH
- **What's broken:** The digital display shows the current time being set, making set_time mode too easy — student can just drag until the digital readout matches the target instead of learning to read the analog hands.
- **Fix in:** COMPONENT — hide digital display in set_time mode

### AC-4: set_time — AI re-introduces activity on every clock reset
- **Severity:** HIGH
- **What's broken:** `aiPrimitiveData` memo (lines 489-501) includes `displayedTime: formatTime(displayHour, displayMinute)`. In set_time mode, every drag event changes `displayHour`/`displayMinute`, causing a context update to Gemini. When the clock resets to 12:00 (new challenge or failed drag), Gemini sees a fresh-looking state and responds with "Welcome! We're going to have so much fun learning..." — repeating the introduction on every reset.
- **Data:** Logs show repeated "Welcome! We're going..." on context updates with `displayedTime: "12:00"`
- **Fix in:** COMPONENT — remove `displayedTime` from aiPrimitiveData (answer check messages already include it)

### AC-5: elapsed — correctOptionIndex always 0 (wrong answer marked correct)
- **Severity:** HIGH
- **What's broken:** Generator auto-correction (lines 263-276) only validates `correctOptionIndex` for read/match types by matching targetTime against options. For elapsed challenges, Gemini consistently outputs `correctOptionIndex: 0` regardless of which option contains the correct elapsed duration. Most elapsed challenges are impossible to answer "correctly."
- **Data:** All 6 elapsed challenges had `correctOptionIndex: 0`; e.g. c1 answer is "30 minutes" (option2) but correctOptionIndex=0 points to "10 minutes"
- **Fix in:** GENERATOR — compute elapsed duration from start→target, match against options, derive correctOptionIndex
