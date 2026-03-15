# Eval Report: number-sequencer — 2026-03-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| count_from | PASS | — |
| before_after | PASS | — |
| order_cards | PASS | — |
| fill_missing | PASS | — |
| decade_fill | FAIL | 1 |

## Issues

### decade_fill — Sequence null count doesn't match correctAnswers length (3/5 challenges impossible)
- **Severity:** CRITICAL
- **What's broken:** The decade-fill renderer determines blanks from `correctAnswers.indexOf(num)`, but the check logic validates via `blankIndices` (derived from sequence null positions). When correctAnswers has more entries than sequence has nulls, the check iterates past the end of studentValues and always fails. Challenges c2 (2 nulls, 3 answers), c3 (3 nulls, 4 answers), and c5 (4 nulls, 5 answers) are impossible.
- **Data:** `c2: 2 nulls vs 3 answers, c3: 3 nulls vs 4 answers, c5: 4 nulls vs 5 answers`
- **Fix in:** GENERATOR + COMPONENT (generator must ensure sequence null count == correctAnswers.length; component should use correctAnswers directly for decade-fill validation instead of blankIndices)
