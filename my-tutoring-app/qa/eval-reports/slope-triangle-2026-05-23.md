# Eval Report: slope-triangle — 2026-05-23

## Results

| Eval Mode       | Status | Issues |
|-----------------|--------|--------|
| identify_slope  | PASS   | —      |
| calculate       | PASS   | —      |
| draw_triangle   | PASS   | —      |

All 12 generated challenges have internally-consistent math (rise/run derive correctly from the line equation and triangle position) and the triangle sizes fit the drag range. Hint text in `identify_slope` and `calculate` modes no longer reveals expected numeric values.

## Notes

### Fixed: ST-1 / ST-2 — Hint answer leaks (2026-05-23)
- **Root cause:** `hintFor()` in `gemini-slope-triangle.ts` interpolated `expectedRise`/`expectedRun` directly into hint text. With `completeChallenge` (`SlopeTriangle.tsx:506-525`) scoring by `attempts` only — no hint penalty — students could read the literal answer from "Show hint."
- **Fix:** Rewrote both hints to describe the *method* without numeric values.
  - `identify_slope` → "Start at the lower corner of the triangle. Count grid squares vertically to the opposite corner — that's the rise (positive if you went up, negative if you went down). Then count grid squares horizontally to the other corner — that's the run."
  - `calculate` → "Read Δy (the vertical leg) and Δx (the horizontal leg) off the triangle's labels. The slope is Δy ÷ Δx — and the sign of Δy is the sign of the slope."
- **Preserved:** `draw_triangle` hint (out of scope; not flagged in the report — the instruction itself doesn't specify a target run, so the hint stating the run is part of the construction task).
- **Verified:** all three eval modes return `pass`; rise/run remain mathematically consistent with the line equation.
