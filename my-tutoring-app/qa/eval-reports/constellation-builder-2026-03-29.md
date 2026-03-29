# Eval Report: constellation-builder — 2026-03-29

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| guided_trace | PASS | — |
| free_connect | PASS | — |
| identify | PASS | — |
| seasonal | PASS | — |

## Notes — Fixed Issues

### CB-1 (CRITICAL): guided_trace — Loop connections made challenges impossible

**Fixed:** Generator post-process now derives `correctConnections` from `starOrder` as exactly N-1 consecutive pairs for `guided_trace` challenges. Any closing loop the LLM generates is removed deterministically. Prompt also updated to instruct N-1 connections.

### CB-2 (HIGH): seasonal — Answer leaked in instruction text

**Fixed:** Seasonal `promptDoc` now has explicit negative constraints against mentioning constellation shape, mythology figures, or visual descriptions. Post-process `sanitizeSeasonalInstruction()` catches any remaining shape-leak words and replaces with a generic season-only question. Verified clean across 3 stochastic runs.

### CB-3 (HIGH): seasonal — Instructions reference invisible star field

**Fixed:** Same prompt change as CB-2 — seasonal instructions no longer reference stars, star fields, or tracing. Instructions now reference only the season and ask students to select from options.
