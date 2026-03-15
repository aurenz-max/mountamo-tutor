# Eval Report: area-model — 2026-03-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| build_model | PASS | — |
| find_area | PASS | — |
| multiply | FAIL | 2 |
| factor | FAIL | 3 |

## Issues

### multiply — Difficulty indistinguishable from find_area
- **Severity:** HIGH
- **What's broken:** 2×2 grid with 2-digit × 2-digit (26×14) is identical structure to find_area (35×21). IRT tiers 2 vs 3 produce the same experience.
- **Data:** `factor1Parts: [20,6], factor2Parts: [10,4]`
- **Fix in:** GENERATOR (constrain multiply to 3-digit × 2-digit or 3-part decomposition)

### multiply — Phantom field showPartialProducts
- **Severity:** HIGH
- **What's broken:** `showPartialProducts: true` set but component never reads it. If component ever honors this field, answers would leak.
- **Data:** `showPartialProducts: true`
- **Fix in:** GENERATOR (force `showPartialProducts: false`)

### factor — Title product doesn't match actual product
- **Severity:** HIGH
- **What's broken:** Title says "450" but factor1Parts=[30,5] × factor2Parts=[10,5] = 35×15 = 525. Student sees contradictory information.
- **Data:** `title: "Finding the Factors of 450"` vs actual product 525
- **Fix in:** GENERATOR (validate title against computed product)

### factor — Dimensions shown defeat the challenge
- **Severity:** CRITICAL
- **What's broken:** `showDimensions: true` displays the factors as axis labels. Student reads the answer instead of discovering it.
- **Data:** `showDimensions: true` with factor mode
- **Fix in:** GENERATOR (force `showDimensions: false` for factor mode)

### factor — Component has full factor mode UI now but generator still leaks dimensions
- **Severity:** CRITICAL
- **What's broken:** The component has a dedicated factor mode (input fields for dimensions, partial products shown in cells), but the generator sets `showDimensions: true` which renders the answer labels alongside the input fields, defeating the exercise.
- **Data:** `showDimensions: true, challengeType: "factor"`
- **Fix in:** GENERATOR
