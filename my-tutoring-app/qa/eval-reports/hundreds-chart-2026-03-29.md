# Eval Report: hundreds-chart — 2026-03-29

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| highlight_sequence | PASS | — |
| complete_sequence | PASS | — |
| identify_pattern | PASS | — |
| find_skip_value | PASS | — |

## Notes — Fixed Issues

### HC-1: 10-slot truncation made highlight/complete challenges unsolvable (CRITICAL)
**Fixed 2026-03-29.** Flat schema uses 10 `correctCell*` slots, but skip-by-5 produces 20 cells, skip-by-3 produces 33, skip-by-2 produces 50. `correctCells` was truncated, so students who selected all correct cells were marked wrong (e.g., selected 20 but only 10 expected). Fix: post-process now derives full `correctCells`/`givenCells` from `skipValue` + `startNumber` using `buildSequence()`, bypassing the flat-field limit entirely.

### HC-2: highlight_sequence instruction said "watch" instead of "click" (HIGH)
**Fixed 2026-03-29.** Gemini generated passive instructions ("Watch carefully!") for an interactive clicking mode. Updated `highlight_sequence` promptDoc to require click/tap language in the instruction.
