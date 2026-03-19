# Eval Report: number-sequencer — 2026-03-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| count_from | PASS | — |
| before_after | PASS | — |
| order_cards | PASS | — |
| fill_missing | PASS | — |
| decade_fill | PASS | — |

## Notes

### NS-1 (RESOLVED) — decade-fill impossible due to blankIndices/correctAnswers mismatch
- **Root cause:** The decade-fill renderer determines blanks from `correctAnswers.indexOf(num)` but the check logic and input keying used `blankIndices` (derived from sequence nulls). When the LLM produced fewer nulls in `sequence` than entries in `correctAnswers`, inputs wrote to wrong keys and the checker couldn't read them back.
- **Fix (COMPONENT):** Separated decade-fill from fill-missing/before-after in the check handler, canCheckAnswer, and renderer. Decade-fill now keys inputs and reads answers by `answerIdx` (index into correctAnswers) directly, bypassing `blankIndices` entirely. The renderer already used `correctAnswers` to determine blanks, so this makes it self-consistent.
- **Fix (GENERATOR):** Added post-process safety net for fill-missing/before-after to rebuild `sequence` if null count doesn't match `correctAnswers.length`.
- **Verification:** All 5 modes pass after fix. No regressions.
