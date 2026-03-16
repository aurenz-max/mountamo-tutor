# Eval Report: sorting-station — 2026-03-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| sort_one | PASS | — |
| sort_attribute | PASS | — |
| count_compare | PASS | — |
| odd_one_out | PASS | — |
| two_attributes | PASS | — |
| tally_record | PASS | — |

## Resolved Issues

### SS-1 (CRITICAL) — sort_one: Impossible challenge — only 1 category for 4 objects
- **Fixed by:** Orchestrator refactor — dedicated `generateSortChallenges()` sub-generator with focused prompt. Categories derived deterministically from actual object attribute values via `deriveCategories()`, guaranteeing every object has a matching bin and ≥2 categories exist.

### SS-2 (HIGH) — sort_one: Instruction/type mismatch (SP-3)
- **Fixed by:** Orchestrator refactor — sort_one sub-generator prompt only describes sort-by-one. No mention of count-and-compare or odd-one-out concepts, eliminating cross-contamination at the source (SP-3).

### SS-3 (HIGH) — tally_record: Orphaned object due to label/rule mismatch
- **Fixed by:** Orchestrator refactor — tally-record shares the sort sub-generator with derived categories. Category labels and rules are computed from actual object attributes, so label/rule mismatches are impossible.

## Notes

Generator refactored from monolithic single-LLM-call architecture to orchestrator pattern with per-mode sub-generators (matching tape-diagram pattern). Each mode gets a focused prompt and simplified schema — no cross-contamination possible. Categories for sort modes are derived deterministically post-generation rather than trusting LLM-generated category/rule pairs. Stochastic testing: 3/3 passes for both previously failing modes.
