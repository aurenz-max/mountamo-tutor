# Eval Report: light-shadow-lab — 2026-03-29

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| observe   | PASS   | 0      |
| predict   | PASS   | 0      |
| measure   | PASS   | 0      |
| apply     | PASS   | 0      |

## Fixed Issues

### LS-1 (CRITICAL): Sun renders off-screen for afternoon positions
**Fixed 2026-03-29.** Generator prompt and schema rewritten to use component's 0-180 east-to-west arc convention instead of compass bearings (0-360). Azimuths now stay within 0-180, producing SVG x-coordinates within the 700px viewport. Fallback data also updated. (SP-10)

### LS-2 (HIGH): Midday shadow direction physically wrong
**Fixed 2026-03-29.** Same convention fix as LS-1. Midday azimuth now ~90 (component convention) instead of ~180 (compass). `validateShadowDirection(90)` correctly returns 'N'. (SP-10)

### LS-3 (HIGH): Direction label text contradicts SVG visual
**Fixed 2026-03-29.** Flipped DIRECTION_LABELS parenthetical hints: `E: 'East (left)'`, `W: 'West (right)'` to match SVG layout where East label is at x=30 (left) and West at x=620 (right).

### LS-4 (HIGH): Correct answer format leaks the answer in measure mode
**Fixed 2026-03-29.** Measure mode now builds correct answer and default distractors using `DIRECTION_LABELS` + `LENGTH_LABELS` (same format as observe/predict). All MC options have consistent "Direction (hint), Length" format. `correctMcAnswer` memo unified across observe/predict/measure.

### LS-5 (HIGH): Instruction text contradicts validator-corrected data
**Fixed 2026-03-29.** Same convention fix as LS-1/LS-2. With azimuth in 0-180 range, `validateShadowDirection()` thresholds agree with what Gemini writes in instruction text. (SP-10)
