# Eval Test Report: array-grid
**Date:** 2026-03-15
**Topic:** Multiplication / arrays | **Grade:** Grade 2-4
**Tester:** Claude Code `/eval-test`

## Summary

| Eval Mode | Status | Critical | High | Medium | Low |
|-----------|--------|----------|------|--------|-----|
| build_array (Tier 1) | PASS | 0 | 0 | 0 | 0 |
| count_array (Tier 2) | PASS | 0 | 0 | 0 | 0 |
| multiply_array (Tier 3) | PASS | 0 | 0 | 0 | 0 |

**Overall:** 3 of 3 modes passed | 0 open issues

---

## build_array (Tier 1) — PASS

**Generated:** Single-task primitive (no challenges array), duration: 845ms

```json
{
  "title": "Star Array Challenge: Building Groups",
  "description": "Use the row and column buttons to build an array that shows exactly 4 rows of 3 stars. After building the array, tell us the total number of stars you made.",
  "challengeType": "build_array",
  "targetRows": 4,
  "targetColumns": 3,
  "iconType": "star",
  "showLabels": true,
  "maxRows": 10,
  "maxColumns": 12
}
```

No issues. Title uses neutral wording without multiplication notation. Component correctly renders build interaction with row/column buttons.

---

## count_array (Tier 2) — PASS

**Generated:** Single-task primitive, duration: 673ms

```json
{
  "title": "Counting Grouped Items",
  "description": "Look carefully at this array of squares. Count the total number of squares shown. You can skip count by the number of squares in each row!",
  "challengeType": "count_array",
  "targetRows": 4,
  "targetColumns": 7,
  "iconType": "square",
  "showLabels": true,
  "maxRows": 10,
  "maxColumns": 12
}
```

No issues. Component correctly pre-builds the array (initializes currentRows/currentColumns from targets), hides build controls, and shows only the total input. Instructions say "Look at the array" without revealing dimensions.

---

## multiply_array (Tier 3) — PASS

**Generated:** Single-task primitive, duration: 593ms

```json
{
  "title": "Multiplication Fact from Array",
  "description": "This array shows a multiplication problem. Write the complete multiplication sentence (rows × columns = total) that describes this array.",
  "challengeType": "multiply_array",
  "targetRows": 5,
  "targetColumns": 7,
  "iconType": "dot",
  "maxColumns": 8,
  "maxRows": 6,
  "showLabels": true
}
```

No issues. Component correctly pre-builds the array and shows three inputs (rows × columns = total) with partial credit scoring.

---

## Notes — Previously Reported Issues (All Resolved)

All 6 issues from the original eval were resolved by a component rewrite that added full `challengeType` branching:

| ID | Was | Resolution |
|----|-----|------------|
| AG-1 | CRITICAL: No pre-built array for count_array | Component now initializes `currentRows = targetRows` when `isPreBuilt` |
| AG-2 | CRITICAL: No pre-built array for multiply_array | Same `isPreBuilt` logic |
| AG-3 | CRITICAL: No multiplication sentence input | Component now renders 3 inputs (rows × cols = total) for multiply_array |
| AG-4 | HIGH: Instructions reveal dimensions for count mode | Instructions are now context-sensitive per challengeType |
| AG-5 | MEDIUM: Title shows multiplication notation | Generator prompt now requires neutral titles for build_array |
| AG-6 | LOW: challengeType never read by component | Component now destructures and branches on challengeType |
