# Eval Report: parameter-explorer — 2026-04-08

## Key Files

```
Component:  src/components/lumina/primitives/visual-primitives/math/ParameterExplorer.tsx
Generator:  src/components/lumina/service/math/gemini-parameter-explorer.ts
Catalog:    src/components/lumina/service/manifest/catalog/math.ts
```

## Results

| Eval Mode | Status | Challenges | Source | Issues |
|-----------|--------|------------|--------|--------|
| explore | PASS | 3 | Gemini | — |
| predict-direction | PASS | 1 | Fallback | — |
| predict-value | PASS | 1 | Fallback | — |
| identify-relationship | PASS | 3 | Gemini | — |

## Architecture Refactor: Orchestrator Pattern

**Root cause:** Single monolithic Gemini call with ~55 flat properties. Output token limit caused `SyntaxError: Unterminated string in JSON at position 66248`.

**Fix:** Refactored to orchestrator pattern (matching deep-dive):

```
Stage 1 (Sequential):  Formula Service — title, params, jsExpression (~30 props)
Stage 2 (Parallel):    Challenges Service + Observations Service
                       Both receive formula context, run concurrently
```

**Benefits:**
- Each service has a focused, small schema — no more truncation
- Challenges service gets explicit formula context (param symbols, ranges, defaults)
- `identify-relationship` now gets 3 Gemini challenges instead of falling back to 1 hardcoded
- Observations generate in parallel with challenges — no latency penalty

## Remaining G5 Finding

`predict-direction` and `predict-value` still fall back to the Ohm's Law hardcoded challenge. Gemini flash-lite generates mixed types even when the schema enum is constrained to one type. The challenges service prompt includes an explicit "ALL challenges must be type X" directive but flash-lite still mixes.
