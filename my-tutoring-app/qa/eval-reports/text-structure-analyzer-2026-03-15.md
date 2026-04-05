# Eval Report: text-structure-analyzer — 2026-03-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| chronological_description | PASS | — |
| cause_effect | PASS | — |
| compare_contrast | PASS | — |
| problem_solution | PASS | — |

## Resolved Issues (2026-04-04)

### TS-1 — Signal word startIndex/endIndex offsets wrong in 100% of responses
- **Root cause:** SP-8 — LLMs cannot reliably compute character offsets.
- **Fix:** POST-PROCESS-DERIVE. Added `recomputeSignalWordOffsets()` that uses case-insensitive `indexOf()` on the passage to derive correct offsets deterministically. Signal words not found in the passage are dropped with a warning.
- **File:** `service/literacy/gemini-text-structure-analyzer.ts`

### TS-2 — Cross-structure signal words in compare_contrast
- **Root cause:** SP-3 — prompt didn't forbid signal words from other structure types.
- **Fix:** PROMPT-CHANGE. Added per-structure signal word ownership lists to prompt rule #6, explicitly listing which words belong to which structure type.
- **File:** `service/literacy/gemini-text-structure-analyzer.ts`
