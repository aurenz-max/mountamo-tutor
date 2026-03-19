# Eval Report: area-model — 2026-03-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| build_model | PASS | — |
| find_area | PASS | — |
| multiply | PASS | — |
| factor | PASS | — |

## Issues

_No open issues._

## Previously Fixed

| Issue | Fix |
|-------|-----|
| multiply — Difficulty indistinguishable from find_area | Post-validation bumps to 3-part decomposition (3×2 grid) when too easy |
| multiply — Phantom field showPartialProducts | Post-validation forces `showPartialProducts: false` |
| factor — Title product doesn't match actual product | Post-validation recalculates and rewrites title with correct product |
| factor — Dimensions shown defeat the challenge | Post-validation forces `showDimensions: false` |
| factor — Generator still leaks dimensions | Same fix as above |
| AM-1: factor — Description contains hallucinated product number | Post-process scans description for numbers not in validNums set (product, factor totals, factor parts), replaces with actual product. Verified 3/3 stochastic runs clean. |
