# Eval Report: word-sorter — 2026-04-05

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| binary_sort | PASS | 0 |
| ternary_sort | PASS | 0 |
| match_pairs | PASS | 0 |

## Notes

### WS-1 — Fixed: Flat->nested reconstruction produces empty arrays (SP-14)

**Fix applied:** ORCHESTRATOR-REFACTOR. Replaced single mega-schema generator with 3 per-mode
sub-generators (`generateBinarySortChallenges`, `generateTernarySortChallenges`,
`generateMatchPairsChallenges`), each with a focused schema containing only the fields for
that mode. Orchestrator dispatches via `Promise.all` and combines results.

Post-reconstruction validation rejects challenges with insufficient words/pairs and validates
that `correctBucket` matches actual bucket labels. Each mode's required fields are marked
required in the schema so Gemini can't skip them.

**Verification:** 3/3 modes pass, 9/9 stochastic runs pass. Binary sort produces 6 words
with 2 buckets, ternary sort produces 8-10 words with 3 buckets, match pairs produces 5 pairs.
