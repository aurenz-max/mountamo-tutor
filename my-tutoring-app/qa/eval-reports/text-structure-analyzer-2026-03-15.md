# Eval Report: text-structure-analyzer — 2026-03-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| chronological_description | FAIL | 1 (CRITICAL) |
| cause_effect | FAIL | 1 (CRITICAL) |
| compare_contrast | FAIL | 1 CRITICAL, 1 HIGH |
| problem_solution | FAIL | 1 (CRITICAL) |

## Issues

### ALL MODES — Signal word startIndex/endIndex offsets are wrong
- **Severity:** CRITICAL
- **What's broken:** 100% of signal word offsets are incorrect across all 4 modes. Component uses `passage.slice(sw.startIndex, sw.endIndex)` to create clickable spans — wrong offsets produce garbled text fragments. Phase 1 (Signal Words) is completely broken.
- **Data:** All signalWords entries have startIndex/endIndex that don't match their `word` field position in the passage
- **Fix in:** GENERATOR — post-process with `passage.indexOf(sw.word)` to recompute indices

### compare_contrast — "One solution" is a problem-solution signal word
- **Severity:** HIGH
- **What's broken:** Compare-contrast response includes "One solution" as a signal word, which is a problem-solution signal word. Confuses students about which words signal which structure.
- **Data:** `signalWords` contains cross-structure-type signal word
- **Fix in:** GENERATOR — strengthen prompt to forbid signal words from other structure types
