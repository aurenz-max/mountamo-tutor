# Eval Report: double-number-line — 2026-03-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| equivalent_ratios | PASS | — |
| find_missing | PASS | — |
| unit_rate | PASS | — |

## Test Details

### equivalent_ratios (PASS)
- **Mode:** Equivalent Ratios (Tier 2), **Topic:** default
- Context: "1 cup of water makes 4 glasses of lemonade" — unit rate 1:4
- givenPoints includes origin + unit rate (1, 4) — correct for this mode
- All 4 target points follow x4 ratio: (3,12), (5,20), (7,28), (8,32)
- Scales (0-8 top, 0-32 bottom) accommodate all values
- Ratio direction matches context (Cups of Water → Glasses of Lemonade)

### find_missing (PASS)
- **Mode:** Find Missing Value (Tier 3), **Topic:** default
- Context: "2 cans of paint cover 8 feet" — unit rate 1:4
- givenPoints includes origin + non-unit clue (4, 16) labeled "Given" — students have info to discover relationship
- targetPoints: unit rate (1, 4) + (5, 20) + (9, 36) — all consistent
- Previous bug (origin-only givenPoints) is fixed by `buildPointsByMode()`
- Ratio direction correct: Cans of Paint (top/input) → Feet of Fence (bottom/output)

### unit_rate (PASS)
- **Mode:** Discover Unit Rate (Tier 4), **Topic:** default
- Context: "4 inches of water → 20 inches tall" — unit rate = 5
- givenPoints: origin only — correct for hardest mode (students discover everything)
- targetPoints: (1, 5), (3, 15), (5, 25), (7, 35) — all follow x5 ratio
- Non-unit pair presented in context, not given as a point — appropriate difficulty

## Previous Issues (Resolved)

### Painting Fence Pickets — Inverted ratio (from earlier run)
- **Status:** FIXED in generator
- **Fix:** Added ratio direction enforcement in prompt + post-generation inversion detection

### find_missing — No clue point given
- **Status:** FIXED in generator
- **Fix:** `buildPointsByMode()` now gives a non-origin ratio pair for `find_missing` mode
