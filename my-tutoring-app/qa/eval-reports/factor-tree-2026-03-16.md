# Eval Report: factor-tree — 2026-03-16

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| guided_small | PASS | — |
| guided_medium | PASS | — |
| unguided | PASS | — |
| assessment | PASS | — |

## Notes

- First eval run after adding eval modes (4 modes added this session)
- FactorTree is a single-activity primitive (no `challenges` array) — the eval-test validator warns "No challenge array found" which is expected
- All modes produce correct `challengeType`, `rootValue` within range, and correct `guidedMode`/`allowReset` flags
- Root-level `challengeType` field with `SchemaConstraintConfig { fieldName: 'challengeType', rootLevel: true }`
