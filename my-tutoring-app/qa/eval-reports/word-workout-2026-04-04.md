# Eval Report: word-workout — 2026-04-04

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| real_vs_nonsense | PASS | — |
| picture_match | PASS | — |
| word_chains | PASS | — |
| sentence_reading | PASS | — |

## Resolved Issues

### WW-1: word_chains — Duplicate words and multi-letter changes in chain (CRITICAL)
- **Was:** Chain c5 had duplicates (sob×3) and sip→sub changes 2 letters
- **Fix:** POST-PROCESS-DERIVE — `validateWordChain()` removes consecutive duplicates, validates each transition differs by exactly 1 character, and recomputes `changedPositions` deterministically. Chains failing validation are rejected (fallback kicks in if all rejected).
- **File:** `service/literacy/gemini-word-workout.ts`

### WW-2: sentence_reading — Single-word cvcWords produces trivial comprehension (CRITICAL)
- **Was:** c4 had only 1 cvcWord = comprehensionAnswer — single button rendered
- **Fix:** SCHEMA — added `minItems: "3"` to `cvcWords` array in Gemini schema. Prompt reinforced with "at least 3 different CVC words" rule. Post-process rejects challenges with < 3 cvcWords or where comprehensionAnswer is not in cvcWords.
- **File:** `service/literacy/gemini-word-workout.ts`
