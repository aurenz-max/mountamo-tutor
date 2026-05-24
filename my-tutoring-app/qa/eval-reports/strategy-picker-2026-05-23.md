# Eval Report: strategy-picker — 2026-05-23

Single-mode eval of `guided` (Tier 1). Generator output is structurally clean
(4 distinct challenges, strategy/problem pairings respect STRATEGY_CONSTRAINTS
from the 2026-05-19 refactor, math checks). The component-side answer-leak
issue (STP-6) was fixed 2026-05-23 — see Notes.

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| guided | PASS | 0 |

## Generated Data Snapshot

| ch | equation | result | assignedStrategy | strategySteps |
|----|----------|--------|-------------------|---------------|
| ch1 | 2 + 4 | 6 | counting-on | 4 steps |
| ch2 | 7 + 2 | 9 | tally-marks | 3 steps |
| ch3 | 3 − 2 | 1 | counting-back | 3 steps |
| ch4 | 1 + 1 | 2 | doubles | 3 steps |

All math correct, all (strategy, problem) pairings honor STRATEGY_CONSTRAINTS,
no fallback content fired, no instruction text leaks the result.

## Notes

### STP-6 — Strategy visualizations rendered the answer as a text label (FIXED 2026-05-23)

- **Severity:** HIGH (resolved)
- **Was broken:** `TallyViz` printed `"{total} total"`, `DoublesViz` printed
  `"{base} + {base} = {operand1 + operand2}"`, `DrawObjectsViz` printed
  `"{total} objects"`, and `TenFrameViz` printed `"{operand1} + {operand2} = {total}"`
  — each rendering the sum as visible UI text below the visualization, before
  the student touches the answer input.
- **Fix:** Removed the four answer-bearing `<text>` elements from
  `StrategyPicker.tsx`. The dots, tallies, ten-frame cells, and number-line
  hops still demonstrate each strategy; the student must now compute the total
  by counting the visual elements (which is the entire point of the strategy).
- **Regression check:** All 5 eval modes (`guided`, `match`, `try_another`,
  `compare`, `choose`) still pass eval-test. `compare` mode retains the
  intentional "Same answer: {result}" badge — that's part of the metacognitive
  reflection (the question is "which strategy felt easier?", not "what's the
  answer?"), and is shown only after both visualizations are rendered.
