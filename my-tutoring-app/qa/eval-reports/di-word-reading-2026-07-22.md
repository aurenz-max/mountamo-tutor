# Eval Report: di-word-reading — 2026-07-22

Birth eval-test (L0, single mode `read_word`). Generator: Fork A menu-scoped
(curated CVC-by-vowel + sight-word menu in code; Gemini selects words via enum
wrapper; graphemes/emoji/aliases/wordType attached in code).

## Results
| Run | Objective | Status | Words | Check |
|-----|-----------|--------|-------|-------|
| 1 | named words ("read the words cat, hat, sun") | PASS | cat, hat, sun, mat | named words honored, menu backfill to count |
| 2 | generic ("word reading") | PASS | cat, pig, sun, the | CVC spread across vowels + one sight word (designed starter shape) |
| 3 | sight words ("high-frequency sight words") | PASS | the, see, go, to | sight set only, code-enforced |
| 4 (extra) | vowel-scoped ("short a CVC words") | PASS | sam, mat, cat, hat | HARD vowel scope enforced in code (resolveScopedVowels mirror) |

All runs: `validation.typesFound = ['read_word']`, challengeCount 4, catalog β 2.5 resolved.

## G1-G5 Sync Check: ALL PASS
- **G1 (required fields):** every challenge has `word`, `wordType`, `challengeType`; every CVC challenge has `graphemes`; sight challenges correctly omit graphemes/emoji (whole-word recall, no picture). ✓
- **G2 (flat-field reconstruction):** N/A — Fork A; Gemini never emits per-item content.
- **G3 (eval-mode differentiation):** N/A at birth (single mode); route validation confirms `read_word` only.
- **G4 (answer derivability):** the answer IS the printed word; sound-out model derives deterministically from `graphemes` (script's GRAPHEME_SOUNDS). Near-neighbour homophones (sun/son, red/read, mat/matt, see/sea, to/two) present as passive `asrAliases` for run reporting — never the judge. ✓
- **G5 (fallback quality):** ladder = model selection → objective-text scan → scoped pool (vowel/sight) → starter set (`sam, pig, sun, the`). No silent per-field defaults; scope filters are code-enforced over the LLM selection. ✓

## Answer-leak audit
Stage shows the PRINTED WORD ONLY. No emoji/picture/audio pre-cue before the
read (differs from letter-sounds, where the emoji is a safe keyword support).
Reward emoji renders only in the post-affirmation beat and completion recap.
Generator prompt + schema forbid target words in title/description (checked in
all 4 runs: titles are generic, no target word appears).

## Note
The live judged loop is NOT exercised by eval-test (it only drives the
generator). Live-loop human check queued in HUMAN-CHECKS (new row) — includes
the deferred near-neighbour over-affirmation stress (bench gate #41 waived
2026-07-22 by user ruling).
