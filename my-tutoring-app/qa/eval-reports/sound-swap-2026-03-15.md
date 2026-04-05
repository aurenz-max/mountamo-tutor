# Eval Report: sound-swap — 2026-03-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| addition | PASS | — (fixed 2026-04-04) |
| deletion | PASS | — (fixed 2026-04-04) |
| substitution | PASS | — |

## Fixed Issues (2026-04-04)

### SW-1: addition — Vowel changes during phoneme "addition" (was CRITICAL)
- **Fix:** PROMPT-CHANGE + POST-PROCESS-VALIDATE. Added curated VALID_ADDITION_PAIRS to prompt guiding Gemini toward known-good pairs. Added COMMON_WORDS post-process validation rejecting challenges where either word isn't a real English word. Gemini now consistently uses curated pairs (at→cat, an→man, it→hit, etc.).

### SW-2: deletion — 5/9 result words were nonsense syllables (was CRITICAL)
- **Fix:** PROMPT-CHANGE + POST-PROCESS-VALIDATE. Added curated VALID_DELETION_PAIRS to prompt. COMMON_WORDS post-process rejects challenges producing nonsense words like "un", "ig", "ap". Deletion mode now yields 5-8 valid challenges per run (nonsense pairs filtered out).

### SW-3: addition — /ɹ/ vs /r/ notation mismatch (was HIGH)
- **Fix:** PROMPT-CHANGE + POST-PROCESS-DERIVE. Prompt now explicitly says "Use /r/ for the R sound, NOT /ɹ/". Added IPA_NORMALIZATIONS post-process that maps /ɹ/, /ɾ/, /ɻ/ → /r/ in all phoneme arrays.

### SW-4: addition — Non-word originals "un" and "ig" (was HIGH)
- **Fix:** Same as SW-1/SW-2 — COMMON_WORDS validation rejects any challenge where originalWord isn't a real English word.

## Notes

- Deletion mode challenge count is variable (5-8 out of 9 generated) due to post-process rejection. The primitive handles variable challenge counts gracefully.
- Stochastic verification: 3/3 passes for both addition and deletion modes.
