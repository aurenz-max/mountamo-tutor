# Eval Report: double-number-line — 2026-03-17

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| `equivalent_ratios` | PASS | — |
| `find_missing` | PASS | — |
| `unit_rate` | PASS | — |

All 3 eval modes generate valid data. Note: this primitive uses `givenPoints`/`targetPoints` structure instead of `challenges[]` array, so eval-test validator reports 0 challenges — but data is correct with proper ratio relationships and scale configuration.

## Visual Check

Open MathPrimitivesTester in the app, select **double-number-line** and each mode, click Generate, then visually confirm the rendering.
