# Eval Report: coin-counter — 2026-06-14

**Focus:** Support-tier difficulty sweep (Step 2c — `config.difficulty`). The generator
reads `config.difficulty` via `normalizeSupportTier`; the numeric `&theta=` path is N/A here.

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| count-mixed (count) | PASS | — |
| compare | PASS | — |
| make-amount | PASS | — |
| make-change | PASS | — |
| identify | PASS | — |

All tiers wired. No CRITICAL/HIGH findings.

## Difficulty axis — what was verified

### 1. Scaffold withdrawal (deterministic, code-set in generator L857–867) — monotonic ✅
Verified live across all three tiers (easy/medium for make-amount, hard everywhere):

| Tier | `showCoinValues` | `showRunningTotal` |
|------|------------------|--------------------|
| baseline (no `&difficulty`) | undefined → component defaults ON | undefined → component defaults ON |
| easy   | true  | true  |
| medium | true  | false |
| hard   | false | false |

Set uniformly at the data level (count-tier rule for value labels, make-amount-tier
rule for running total), so it is correct for blended sessions too. Null-tier no-op
confirmed (assertion 5).

### 2. Structural levers (prompt-shaped — coin totals are discrete, can't be code-snapped) ✅
Judged on distribution across challenges, easy-vs-hard:

| Mode | Lever | easy → hard (observed) |
|------|-------|------------------------|
| compare | group total gap | gaps {19,6,28,2,14} (avg ~14) → {4,2,3,1,0} (avg ~2); hard forces precise totaling, incl. gap=0 → `equal` |
| make-change | regrouping across 10s | easy 0/5 regroup → hard 4/6 regroup |
| make-amount | decomposition depth | easy obvious sets → hard 3+ awkward coins (e.g. `['nickel','penny','penny']`) |
| count | skip-count strategy + ¢ labels | easy names strategy + labels shown → hard terse + labels hidden |

### 3. Magnitude invariance (difficulty structural, NOT bigger numbers) ✅
Values stay in-band at every tier: count totals 19–70 across all tiers; compare values
≤36; make-change paid 25–75. No magnitude inflation at hard. No scope violations.

### 4. No answer leak at any tier ✅
Totals/change never displayed; derived answers recomputed from visual data
(`coinDefTotal`, `paid − cost`). `correctGroup` correctly derived incl. ties.
At hard, ¢ labels hidden but coin *type* names remain (intended "recall the value" design).

## Minor observations (not flagged — within reasonable-range exclusion)

- **make-amount hard target drift:** hard targets reached 94¢ vs easy max 65¢. Still
  within the grade-2 scope ceiling (≤100¢) and the dominant lever is coin-combination
  complexity (structural), so not a magnitude-inflation finding. Worth a glance if the
  hard tier ever starts clustering near the ceiling.
- **identify duplicate option (pre-existing, difficulty-independent):** one identify/hard
  challenge emitted options `['quarter','dime','penny','penny']` — a duplicate `penny`.
  `targetCoin=penny` is present and selectable (answer derivable), but the component keys
  options by coin name (`key={coin}`), so a dup yields a React key collision + two
  identical buttons. Cosmetic; not a tier issue. Fix-in: GENERATOR (dedupe `collectStrings`
  output for identify) if it recurs.
