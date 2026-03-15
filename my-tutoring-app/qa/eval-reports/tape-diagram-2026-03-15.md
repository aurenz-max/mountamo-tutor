# Eval Report: tape-diagram — 2026-03-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| represent | FAIL | 2 |
| solve_part_whole | PASS | — |
| solve_comparison | FAIL | 1 |
| multi_step | FAIL | 1 |

## Issues

### represent — No "build diagram" functionality
- **Severity:** CRITICAL
- **What's broken:** Catalog says "Build tape diagram from word problem, identify parts" but the component only supports solving (find total, find unknowns). There is no drag-to-build, label-assignment, or representation interaction path. Student experience is identical to solve_part_whole.
- **Data:** `challengeType = "represent"` (discarded by generator transform)
- **Fix in:** COMPONENT (or remove mode from CATALOG until built)

### represent, solve_comparison, multi_step — Component ignores challengeType (SP-1)
- **Severity:** CRITICAL
- **What's broken:** The generator produces a `challengeType` field but it's discarded during the flat→TapeDiagramData transform (generator lines 268-281). The component has zero references to `challengeType`. All 4 eval modes produce the exact same 3-phase explore→practice→apply experience.
- **Data:** All modes return identical structure: 1 bar, 4 segments (2 known + 2 unknown), `comparisonMode: false`
- **Fix in:** GENERATOR (pass challengeType through) + COMPONENT (branch on it)

### solve_comparison — Never creates comparison layout
- **Severity:** HIGH
- **What's broken:** Generator hardcodes `comparisonMode: false` and always creates a single bar with 4 segments. True comparison problems require 2+ bars representing different quantities being compared. The "Comparison (Tier 3)" eval mode doesn't actually test comparison skills.
- **Data:** `comparisonMode = false`, `bars.length = 1`
- **Fix in:** GENERATOR (produce 2-bar comparison data) + COMPONENT (ensure comparison rendering works)

### multi_step — No multi-step differentiation
- **Severity:** HIGH
- **What's broken:** Data structure is identical to solve_part_whole: 2 known parts + 2 unknowns with a single operation per phase. No intermediate calculations, no chained operations, no multi-step reasoning required beyond the standard 3-phase flow.
- **Data:** Same flat schema as all other modes
- **Fix in:** GENERATOR (produce problems requiring chained operations) + COMPONENT (add multi-step interaction)
