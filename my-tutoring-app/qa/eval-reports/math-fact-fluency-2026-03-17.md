# Eval Report: math-fact-fluency — 2026-03-17

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| `visual_fact` | PASS | — |
| `match` | PASS | — |
| `equation_solve` | PASS | — |
| `missing_number` | PASS | — |
| `speed_round` | PASS | — |

All 5 eval modes generate valid data. Match mode had a transient JSON truncation error on first attempt but passed on retry — likely Gemini flash-lite output length limit. Data structure is correct with appropriate `matchDirection`, `visualType`, and `timeLimit` fields.

## Visual Check

Open MathPrimitivesTester in the app, select **math-fact-fluency** and each mode, click Generate, then visually confirm the rendering.
