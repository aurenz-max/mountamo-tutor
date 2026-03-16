# Eval Report: rhyme-studio — 2026-03-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| recognition | PASS | — |
| identification | PASS | — |
| production | PASS | — |

## Issues

None — all modes passing.

## Notes

**RS-5 fixed (2026-03-15):** Added `IRREGULAR_RHYME_WORDS` exclusion list to recognition prompt (SP-7). Words like "two", "eight", "one", "done" etc. are excluded from recognition targetWord/comparisonWord since Gemini can't reliably determine their rhyme families from spelling. Also added a post-process filter as safety net — any recognition challenge containing an irregular word is silently dropped. Tested 3/3 passes.

**Previous fixes (RS-1 through RS-4):** Suffix-based validators (validateRecognitionChallenge, validateProductionChallenge) were added then removed — they caused false negatives for irregular-spelling words that genuinely rhyme. Production mode now correctly keeps answers like "pour"/"shore" for "four", "shoe"/"blue" for "two", "wait" for "eight".
