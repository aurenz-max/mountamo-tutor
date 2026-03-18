# Eval Report: base-ten-blocks — 2026-03-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| build_number | PASS | — |
| read_blocks | PASS | — |
| regroup | PASS | — |
| operate | PASS | — |

## Notes — Fixed Issues (2026-03-17)

### BT-1: read_blocks — First challenge shows empty blocks (CRITICAL) — FIXED
- **Root cause:** Component initialized blocks from top-level `interactionMode='build'` (all zeros) instead of first challenge type. SP-5.
- **Fix:** Component `initialColumns` now checks `challenges[0].type` — decomposes from `challenges[0].targetNumber` for read_blocks/regroup. Generator post-process also forces `interactionMode='decompose'` when all challenges are read_blocks.

### BT-2: read_blocks — Answer leaked via column counts and Blocks Total display (CRITICAL) — FIXED
- **Root cause:** Column headers showed digit counts and "Blocks Total" displayed the exact target number.
- **Fix:** Component hides digit counts and Blocks Total display when `currentChallenge.type === 'read_blocks'`. Student must count visual block representations.

### BT-3: regroup — First challenge uses wrong initial blocks (CRITICAL) — FIXED
- **Root cause:** Same SP-5 as BT-1 — `initialColumns` used top-level `numberValue` instead of first challenge's `targetNumber`.
- **Fix:** Same component fix as BT-1 — first challenge blocks initialized from `challenges[0].targetNumber`.

### BT-4: regroup — Non-standard block arrangements impossible (HIGH) — FIXED
- **Root cause:** Generator described non-standard starting states ("23 ones blocks") but `decomposeNumber()` always produces standard form.
- **Fix:** Generator regroup promptDoc now explicitly requires standard-form starting states. Instructions describe the trade to make (e.g., "Trade 1 ten for 10 ones") rather than impossible non-standard arrangements. Product decision #6 resolved as Option B.
