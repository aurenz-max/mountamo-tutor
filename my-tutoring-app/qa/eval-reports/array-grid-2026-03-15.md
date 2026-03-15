# Eval Test Report: array-grid
**Date:** 2026-03-15
**Topic:** Multiplication / arrays | **Grade:** Grade 2-4
**Tester:** Claude Code `/eval-test`

## Summary

| Eval Mode | Status | Critical | High | Medium | Low |
|-----------|--------|----------|------|--------|-----|
| build_array (Tier 1) | PASS | 0 | 0 | 1 | 1 |
| count_array (Tier 2) | FAIL | 1 | 1 | 0 | 0 |
| multiply_array (Tier 3) | FAIL | 2 | 0 | 0 | 0 |

**Overall:** 1 of 3 modes passed | 6 issues found

---

## build_array (Tier 1) — PASS

**Generated:** Single-task primitive (no challenges array), duration: 3681ms

```json
{
  "title": "Build an Array for 4 × 3",
  "description": "Use the row and column buttons to build an array that shows exactly 4 rows of 3 stars. After you build it, count how many stars you have altogether.",
  "challengeType": "build_array",
  "targetRows": 4,
  "targetColumns": 3,
  "iconType": "star",
  "maxRows": 6,
  "maxColumns": 6,
  "showLabels": true
}
```

### Issues

1. **[Visual Answer Leakage]** Title reveals the multiplication fact: "Build an Array for 4 × 3"
   - Data: `title: "Build an Array for 4 × 3"`
   - Component: Title rendered at [ArrayGrid.tsx:259](my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/ArrayGrid.tsx#L259)
   - Student experience: For build_array, the student IS told the dimensions (that's the task), but the "4 × 3" in the title implicitly teaches the multiplication notation before the student has engaged with the concept. This is minor — the description already says "4 rows of 3 stars."
   - Severity: MEDIUM — mild pedagogical concern; multiplication notation in the title front-runs the concept for Tier 1 students who should be building intuition, not reading notation

2. **[Phantom Field]** `challengeType` field is generated but never consumed by the component
   - Data: `challengeType: "build_array"` present in JSON
   - Component: `ArrayGridData` interface at [ArrayGrid.tsx:20-43](my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/ArrayGrid.tsx#L20-L43) does not include `challengeType`. The field is never destructured or read.
   - Student experience: No functional impact — the component always renders the "build array" interaction.
   - Severity: LOW — no user impact, but signals that the component was not updated when eval modes were added

### Recommendation
- **Issue 1:** Prompt the generator to use a neutral title for Tier 1 (e.g., "Build an Array" without the equation). Or accept as-is since the description already gives the dimensions.
  - File: `my-tutoring-app/src/components/lumina/service/math/gemini-array-grid.ts`
  - Fix type: GENERATOR
  - Effort: SMALL (< 30 min)

- **Issue 2:** Add `challengeType` to the `ArrayGridData` interface and use it to branch rendering. This is the root cause of Tier 2 and Tier 3 failures — see below.
  - File: `my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/ArrayGrid.tsx`
  - Fix type: COMPONENT
  - Effort: LARGE (half day+) — requires new interaction paths for count and multiply modes

---

## count_array (Tier 2) — FAIL

**Generated:** Single-task primitive, duration: 1544ms

```json
{
  "title": "Count the Total Stars in the Array",
  "description": "Look closely at this array of stars. Count every single star to find the total number. Can you skip count by the number of stars in each row?",
  "challengeType": "count_array",
  "targetRows": 4,
  "targetColumns": 7,
  "iconType": "star",
  "showLabels": true,
  "maxRows": 10,
  "maxColumns": 12
}
```

### Issues

1. **[Unsupported Interaction]** Component has no pre-built array mode — count_array requires building the array first
   - Data: `challengeType: "count_array"` — the array should be displayed pre-built so the student counts the total
   - Component: State initializes at `currentRows=0, currentColumns=0` ([ArrayGrid.tsx:70-71](my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/ArrayGrid.tsx#L70-L71)). The total input only appears when `arrayBuilt` is true ([line 375](my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/ArrayGrid.tsx#L375)), which requires `currentRows === targetRows && currentColumns === targetColumns`. The student must manually build the array before they can count it.
   - Student experience: The description says "Look closely at this array" but there is no array shown. Student sees row/column buttons and must build the array themselves — which is the Tier 1 (build_array) interaction, not counting. The eval mode is functionally identical to build_array.
   - Severity: CRITICAL — the eval mode tests "build" skill instead of "count" skill; IRT calibration is measuring the wrong construct

2. **[Visual Answer Leakage]** Hardcoded instructions reveal target dimensions for a counting task
   - Data: `targetRows: 4, targetColumns: 7`
   - Component: Instructions at [ArrayGrid.tsx:468](my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/ArrayGrid.tsx#L468) always render: "Click the row and column buttons to build an array with 4 rows and 7 columns"
   - Student experience: Even if the array were pre-built, the instructions reveal the exact dimensions. For a counting task, the student should discover the dimensions by counting, not read them from instructions. And since the student must build the array first (Bug 1), they enter "4" and "7" from the instructions, then multiply — no counting skill is assessed.
   - Severity: HIGH — the count_array task becomes trivial with the dimensions given away

### Recommendation
- **Root cause fix:** Add `challengeType` support to the component:
  - For `count_array`: Initialize `currentRows = targetRows` and `currentColumns = targetColumns` so the array is pre-built. Hide the row/column buttons. Show only the total input. Hide the instructions that reveal dimensions.
  - File: `my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/ArrayGrid.tsx`
  - Fix type: COMPONENT
  - Effort: MEDIUM (1-2 hrs)

---

## multiply_array (Tier 3) — FAIL

**Generated:** Single-task primitive, duration: 879ms

```json
{
  "title": "Multiplication Fact from Array",
  "description": "Look at the array of squares below. Write the multiplication sentence that shows how many rows times how many columns equals the total number of squares.",
  "challengeType": "multiply_array",
  "targetRows": 6,
  "targetColumns": 8,
  "iconType": "square",
  "maxRows": 7,
  "maxColumns": 10,
  "showLabels": true
}
```

### Issues

1. **[Unsupported Interaction]** Component has no pre-built array mode — same as count_array
   - Data: `challengeType: "multiply_array"` — the array should be shown pre-built
   - Component: Same root cause as count_array Tier 2 Bug 1. Student must manually build a 6×8 array before anything else happens.
   - Student experience: Description says "Look at the array of squares below" but no array exists. Student builds the array (Tier 1 skill) instead of analyzing it (Tier 3 skill).
   - Severity: CRITICAL — eval mode tests "build" skill instead of "write multiplication sentence" skill

2. **[Unsupported Interaction]** No multiplication sentence input — component only accepts a single number
   - Data: `challengeType: "multiply_array"` — task is "write the multiplication sentence (rows × columns = total)"
   - Component: The only input is a number field for the total at [ArrayGrid.tsx:384-392](my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/ArrayGrid.tsx#L384-L392). There is no way to enter "6 × 8 = 48" — only "48". The component checks `correctTotal` (the product) and `correctArray` (the dimensions), but there's no interaction for identifying rows, columns, and the multiplication relationship.
   - Student experience: Even if the array were pre-built, the student would just type "48" into a number box. This doesn't assess whether the student can identify the multiplication structure — only whether they can compute the product. A student could count one-by-one and get 48 without ever connecting to multiplication.
   - Severity: CRITICAL — the Tier 3 skill (writing a multiplication sentence) is not testable with the current UI

### Recommendation
- **Root cause fix:** Add multiply_array interaction path:
  - Pre-build the array (same as count_array fix)
  - Replace the single total input with 3 inputs: rows (`__`) × columns (`__`) = total (`__`)
  - Validate all three values independently for partial credit scoring
  - File: `my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/ArrayGrid.tsx`
  - Fix type: COMPONENT
  - Effort: LARGE (half day+)

- **Alternative (faster):** Remove `multiply_array` eval mode from catalog until the component supports it. This preserves IRT integrity — better to have 2 working modes than 3 broken ones.
  - File: `my-tutoring-app/src/components/lumina/service/manifest/catalog/math.ts`
  - Fix type: CATALOG
  - Effort: SMALL (< 30 min)

---

## Cross-Mode Issues

1. **All three modes produce identical student interaction.** The component ignores `challengeType` entirely, so build_array, count_array, and multiply_array all render the exact same "build array then type total" UI. IRT calibration across these three "tiers" is meaningless — they measure the same construct at the same difficulty.

2. **Row button cap mismatch.** Component caps row buttons at `Math.min(maxRows, 6)` ([line 274](my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/ArrayGrid.tsx#L274)) and column buttons at `Math.min(maxColumns, 8)` ([line 295](my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/ArrayGrid.tsx#L295)). The multiply_array mode generated `targetRows=6` and `maxRows=7` — the target is at the exact button cap boundary. If the LLM ever generates `targetRows=7`, the student could not select it despite `maxRows=7` being set. The component overrides the generator's `maxRows` with a hardcoded cap.

---

## Product Decisions Required

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | count_array and multiply_array eval modes exist in catalog but the component doesn't support them | A) Build out count/multiply interaction paths in the component (LARGE effort, full coverage) B) Remove count_array and multiply_array from catalog until component is ready (SMALL effort, reduced coverage) C) Ship as-is and treat all three modes as "build array" variants with different difficulty via array size | Option A for full assessment coverage, but Option B as an interim step — broken eval modes produce invalid IRT data, which is worse than having fewer modes |
| 2 | Should the hardcoded row cap (6) and column cap (8) in the component be replaced by the generator's maxRows/maxColumns? | A) Use the generator's values directly (risk: LLM generates huge arrays) B) Keep the caps but raise them (e.g., 10 rows, 12 columns) C) Keep current caps but add post-generation validation to reject targets above the cap | Option C — generator should never produce targets above the component's button range. Add validation in the generator to cap targetRows <= 6 and targetColumns <= 8 |
| 3 | For count_array, should row/column labels be hidden to make counting harder? | A) Hide labels — student must count by visual inspection B) Show labels — student can use them to skip-count (still educational) C) Make it configurable via showLabels | Option B for Tier 2 — labels support skip-counting which is a valid learning strategy. Option A could be a future Tier 4 mode. |
