# Eval Report: spelling-pattern-explorer — 2026-03-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| short_vowel | PASS | 1 (HIGH) |
| long_vowel | PASS | — |
| r_controlled | PASS | — |
| silent_letter | PASS | 2 (HIGH) |
| morphological | PASS | 1 (HIGH) |

## Issues

### short_vowel — highlightPattern is descriptive phrase, not substring
- **Severity:** HIGH
- **What's broken:** `highlightPattern` is `"short vowel CVC"` (a label), not a literal substring found in the words. `highlightWordPattern()` does `lowerWord.indexOf(pattern)` — never finds it. No highlighting occurs in observe phase.
- **Data:** `highlightPattern: "short vowel CVC"`, words: ["ten","six","bed",...]
- **Fix in:** GENERATOR — prompt must enforce highlightPattern is a literal substring (e.g., "e" or "-at")

### silent_letter — highlightPattern "b" is too broad + dictation words don't match pattern
- **Severity:** HIGH
- **What's broken:** (1) `highlightPattern: "b"` highlights first "b" in each word, not the silent one. For "bomb" highlights pronounced b, not silent final b. (2) Dictation words include "sub" (b pronounced), "psalm" (no b, silent p), "whistle" (no b, silent t) — 4/5 don't follow the mb silent-b pattern.
- **Data:** Pattern words share silent-b in "mb" endings, but dictation words diverge
- **Fix in:** GENERATOR — use specific pattern like "mb"; constrain dictation words to contain same pattern

### morphological — Dictation words inconsistent with doubling rule
- **Severity:** HIGH
- **What's broken:** Pattern is "doubled consonant before -ing" but dictation word "pulled" has inherent double-l (not rule-governed), and "begun" is an irregular past participle unrelated to doubling.
- **Data:** `dictationWords: [..., "pulled", "begun"]` with doubling rule
- **Fix in:** GENERATOR — all dictation words must follow the stated pattern rule
