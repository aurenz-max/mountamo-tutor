# Eval Report: function-machine — 2026-03-17

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| `observe` | PASS | — |
| `predict` | PASS | — |
| `discover_rule` | PASS | — |
| `create_rule` | PASS | — |

All 4 eval modes generate valid data. Uses root-level `challengeType` + `inputQueue`/`rule` structure instead of `challenges[]`. Data includes correct rule expressions, appropriate grade bands, and proper `showRule` toggling per mode (true for observe, false for discover).

## Visual Check

Open MathPrimitivesTester in the app, select **function-machine** and each mode, click Generate, then visually confirm the rendering.
