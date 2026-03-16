# Eval Report: letter-spotter — 2026-03-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| name_it | FAIL | 1 CRITICAL |
| find_it | PASS | — |
| match_it | PASS | — |

## Issues

### name_it — Missing sentence, emoji, and targetWord fields
- **Severity:** CRITICAL
- **What's broken:** All 6 challenges are missing `sentence`, `emoji`, and `targetWord` fields. Component's `renderNameIt()` uses these to display a sentence with an emoji hiding the target letter. Without them, student sees an empty sentence area and must blindly guess among 4 letter options with zero context.
- **Data:** Challenges only have `targetLetter`, `targetCase`, `options` — no `sentence`, `emoji`, `targetWord`
- **Fix in:** GENERATOR — Gemini schema must require sentence/emoji/targetWord for name-it challenges
