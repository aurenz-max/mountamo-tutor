# Eval Report: sorting-station — 2026-04-01

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| odd-one-out | FAIL → FIXED | 1 |

## Issues

### odd-one-out — Impossible challenge: oddOneOut references stale object ID
- **Severity:** CRITICAL
- **What's broken:** The orchestrator re-numbers object IDs globally across all challenge types, but `oddOneOut` still references the pre-renumbered ID. No selection can ever match, making the challenge unsolvable.
- **Data:** `oddOneOut = "obj4"` but objects have IDs `obj27`-`obj31`
- **Fix in:** GENERATOR (orchestrator section of `gemini-sorting-station.ts`)
- **Status:** FIXED — added `idMap` to track old→new IDs during re-numbering, then updates `oddOneOut` reference accordingly (lines 563-576).
