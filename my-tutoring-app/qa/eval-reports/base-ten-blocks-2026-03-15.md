# Eval Report: base-ten-blocks — 2026-03-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| build_number | PASS | — |
| read_blocks | FAIL | 2 |
| regroup | FAIL | 2 |
| operate | PASS | — |

## Issues

### read_blocks — First challenge shows empty blocks (no blocks to read)
- **Severity:** CRITICAL
- **What's broken:** Generator sets `interactionMode='build'`, so initialColumns are all zeros. The first read_blocks challenge renders empty columns — student is asked to "count the blocks" but there are no blocks. Subsequent challenges work because advanceChallenge pre-places blocks based on challenge type, but challenge 1 is skipped by that logic.
- **Data:** `interactionMode = 'build', first challenge targetNumber = 125, displayed blocks = 0`
- **Fix in:** GENERATOR + COMPONENT (generator should set interactionMode='decompose'; component should initialize first challenge blocks based on challenge type, not just top-level interactionMode)

### read_blocks — Answer leaked via column counts and Blocks Total display
- **Severity:** CRITICAL
- **What's broken:** For pre-placed blocks, each column header shows the digit count (e.g., "Hundreds: 1, Tens: 2, Ones: 5") and the "Blocks Total: 125" display shows the exact target number. Student copies the displayed value instead of interpreting visual block representations. Assessment completely defeated.
- **Data:** `currentTotal displayed = targetNumber for all read_blocks challenges`
- **Fix in:** COMPONENT (hide column digit counts and Blocks Total display when challenge type is read_blocks)

### regroup — First challenge uses wrong initial blocks
- **Severity:** CRITICAL
- **What's broken:** initialColumns decomposes top-level `numberValue` (45), not the first challenge's `targetNumber` (23). Student sees 4 tens + 5 ones instead of the expected starting arrangement. Same root cause as read_blocks issue #1 — no first-challenge initialization based on challenge type.
- **Data:** `numberValue = 45, first challenge targetNumber = 23, initialColumns = decompose(45)`
- **Fix in:** COMPONENT (initialize first challenge blocks from challengesWithIds[0] type and targetNumber)

### regroup — Non-standard block arrangements impossible
- **Severity:** HIGH
- **What's broken:** Generator describes starting states like "23 ones blocks" (non-standard form), but `decomposeNumber()` always produces standard form (2 tens + 3 ones). The educational purpose of regrouping requires starting with non-standard representations that the component cannot display. Even advanceChallenge calls decomposeNumber() for regroup challenges.
- **Data:** `challenge says "23 ones blocks" but decomposeNumber(23) = {tens: 2, ones: 3}`
- **Fix in:** GENERATOR + COMPONENT (either generator must describe challenges starting from standard form, or component needs a way to accept non-standard initial column configurations per challenge)
