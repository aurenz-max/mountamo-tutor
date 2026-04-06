# Eval Report: decodable-reader — 2026-04-05

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| default   | PASS   | —      |

All checks pass. No CRITICAL or HIGH issues.

## Generator↔Component Sync

- **G1 (Required fields):** All fields present — passage, sentences, words with id/text/phonicsPattern, comprehensionQuestion with options and correctOptionId.
- **G4 (Answer derivability):** Passage content ("six hats") matches comprehension answer ("Six hats."). Correct.
- **G5 (Fallbacks):** No silent fallbacks triggered.

## Resolved Issues (prior run)

### DR-1 — Case-sensitive MC comparison makes correct answers always wrong
- **Severity:** CRITICAL
- **What was broken:** MC comprehension used text matching with case mismatch. Fixed by adopting stable option IDs (`correctOptionId`).
- **Date fixed:** 2026-04-05
