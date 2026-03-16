# Eval Report: word-workout — 2026-03-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| real_vs_nonsense | PASS | — |
| picture_match | PASS | — |
| word_chains | FAIL | 2 (CRITICAL) |
| sentence_reading | FAIL | 1 (CRITICAL) |

## Issues

### word_chains — Duplicate words and multi-letter changes in chain
- **Severity:** CRITICAL
- **What's broken:** Chain c5 has ["sip","sub","sob","sob","sob"]. Transitions 3-4 are sob→sob (no change). Also sip→sub changes TWO letters (i→u, p→b), violating the one-letter-change constraint. Component highlights a single changedPosition per transition, so one change is silently unrendered.
- **Data:** `chain: ["sip","sub","sob","sob","sob"], changedPositions: [1,1,1,1]`
- **Fix in:** GENERATOR — add post-generation validation: consecutive words must differ by exactly 1 letter, no duplicates

### sentence_reading — Single-word cvcWords produces trivial comprehension
- **Severity:** CRITICAL
- **What's broken:** Challenge c4 has only 1 cvcWord ("tap") which is also the comprehensionAnswer. Choices are built from [answer, ...cvcWords.filter(w≠answer)], producing a single button. Student cannot answer incorrectly — no assessment value.
- **Data:** `cvcWords: ["tap"], comprehensionAnswer: "tap"` — only 1 choice rendered
- **Fix in:** GENERATOR — ensure cvcWords has at least 3 words per sentence-reading challenge
