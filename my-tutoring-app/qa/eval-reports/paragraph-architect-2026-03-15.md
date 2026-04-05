# Eval Report: paragraph-architect — 2026-03-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| informational | PASS | — |
| narrative | PASS | — |
| opinion | PASS | — |

## Resolved Issues (2026-04-04)

### PA-1, PA-2 — paragraphType always returned "informational"
- **Root cause:** SP-9 double override. Registration defaulted `paragraphType` to `'informational'` and passed it in config. Generator's config merge then overwrote Gemini's correct output with the default.
- **Fix:** Removed `paragraphType` default from registration. Excluded `paragraphType` from generator config merge (same pattern as `targetEvalMode`).
- **Files:** `service/literacy/gemini-paragraph-architect.ts`, `service/registry/generators/literacyGenerators.ts`
