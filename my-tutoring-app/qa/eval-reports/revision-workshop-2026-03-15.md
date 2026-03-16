# Eval Report: revision-workshop — 2026-03-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| add_details | PASS | — |
| word_choice | PASS | — |
| combine_sentences | PASS | — |
| transitions | PASS | — |
| reorganize | FIXED | 0 |
| concision | PASS | — |

## Issues

### ~~reorganize — Wrong interaction model for reordering task~~ FIXED
- **Severity:** HIGH
- **Resolution:** Added reorganize-specific sentence reorder UI (up/down arrow buttons) in revise phase. Updated generator to produce scrambled draft with targets in correct order. Compare phase shows 3-column view (scrambled / student order / ideal order). Scoring based on correct position count.
