# Eval Report: sentence-builder — 2026-03-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| simple | PASS | — |
| compound | PASS | — |
| complex | FAIL | 1 CRITICAL, 1 HIGH |
| compound_complex | FAIL | 1 CRITICAL, 1 HIGH |

## Issues

### complex, compound_complex — Duplicate tile IDs in validArrangements
- **Severity:** CRITICAL
- **What's broken:** Gemini generates validArrangements containing the same tile ID twice. Since component only provides one copy of each tile, student can never match the arrangement. compound_complex ch2 has only one arrangement with duplicate `ch2_t5` — challenge is permanently unsolvable.
- **Data:** `complex` ch2 arr1: `ch2_t6` duplicated. `compound_complex` ch2 arr0: `ch2_t5` duplicated.
- **Fix in:** GENERATOR — post-generation validation: reject arrangements where any tile ID appears more than once or arrangement length ≠ tile count

### complex, compound_complex — Invalid alternative arrangements (ungrammatical)
- **Severity:** HIGH
- **What's broken:** Alternative validArrangements produce ungrammatical sentences: mid-sentence capitalization ("The"), misplaced punctuation. If student builds the reversed clause order, component accepts malformed grammar as correct.
- **Data:** complex ch1 arr1: `"the students raised their hands When the teacher said 'ten' , ."`
- **Fix in:** GENERATOR — strengthen prompt to prohibit reversed arrangements without proper capitalization/punctuation adjustment, or remove alternative arrangements from schema
