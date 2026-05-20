# Eval Report: strategy-picker — 2026-05-19

Post-refactor evaluation following PRD §3a / §6g Bucket B-single fix in
`gemini-strategy-picker.ts`. Initial sweep surfaced strategy/problem
mismatches introduced by the new pool service; second pass after
strategy-aware selection landed shows all modes passing.

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| guided      | PASS | 0 |
| match       | PASS | 0 |
| try_another | PASS | 0 |
| compare     | PASS | 0 |
| choose      | PASS | 0 |

All 5 modes now produce `challengeCount=4` with pedagogically-coherent
(strategy, problem) pairings.

## Fix Summary

Initial Bucket B-single refactor exposed a class of bug: the new pool service
sampled problems and strategies independently and stapled them together. Each
strategy has implicit operation/operand constraints baked into its `StrategyVisualization`
component, so random pairing produced visualizations that didn't represent
the underlying math.

Resolved by **strategy-first pool selection**:

- Added `STRATEGY_CONSTRAINTS` table — each strategy declares its required
  operation and an optional operand predicate (doubles ⇒ `a == b`, make-ten ⇒
  `sum ∈ [8,10]`, near-doubles ⇒ `|a-b| == 1`, etc.).
- `selectStrategyProblemPairs` (single-strategy builders): pick the strategy
  first, then draw a problem from `problemsForStrategy(strat, ...)`.
- `selectPairProblemTriples` (compare + try-another): pick two strategies,
  then draw the problem from `intersectProblems(...)`. Re-roll up to 20 times
  if the intersection is empty (e.g. doubles + near-doubles); fall back to an
  unconstrained safe pair if no compatible pairing is found.
- `buildChooseChallenges`: pick problem first, filter `availableStrategies`
  to those satisfying `strategyMatchesProblem(s, p)` so the student menu
  doesn't offer incompatible options.
- `buildMatchOptions`: distractors filtered to plausible strategies for the
  problem so a student can't eliminate by operation/operand structure alone.
- `enumerateProblems`: strict `a > b` for subtraction — eliminates trivial
  `a − a = 0` selections (STP-4).
- `NumberLineViz`: hop label switched from hardcoded `+1` to direction-aware
  `+1` / `−1` (STP-5, component-side fix).

## Verification Sweep

```
guided      4: 1+5/counting-on, 9-4/counting-back, 5+5/doubles, 7+3/make-ten
match       4: 2+1/tally-marks, 1+1/doubles, 10-6/counting-back, 3+5/make-ten
try_another 4: all addition, all addition-compatible assigned strategies
compare     4: 5+3/[tally, make-ten], 7+3/[tally, make-ten], 2+2/[counting-on, doubles], 5+5/[counting-on, doubles]
choose      4: 4+1/[counting-on, tally-marks], 4-1/[counting-back], 6-3/[counting-back], 6-5/[counting-back]
```

Every constraint satisfied: counting-back exclusively with subtraction,
doubles only with equal operands, make-ten only at sums 8–10, choose menus
filtered to operation-compatible strategies.
