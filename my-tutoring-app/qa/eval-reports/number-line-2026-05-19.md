# Eval Report: number-line — 2026-05-19

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| identify  | PASS   | —      |
| plot      | PASS   | —      |
| jump      | PASS   | —      |
| order     | PASS   | —      |
| between   | PASS   | —      |

## Notes

- Post-refactor (PRD §6a #1/#2/#7): hybrid pool-service + parallel-orchestrator. Each per-mode sub-generator pre-selects N=4 distinct numeric tuples in code and fans out 4 parallel single-challenge Gemini calls for instruction/hint text only. Per-call schema is 4 fields (no SP-14 risk).
- All 5 modes returned 4 distinct challenges with no duplicate targets/tuples/sets/pairs — confirms the in-code pool selection is actually varying the numerics across the parallel calls (the §6a #2 trap Gemini Flash Lite would have walked into with one fat schema).
- identify vs plot differentiation enforced in `generatePlotPointChallenges` (`isIdentify` branch clamps to 0-10 integer); observed outputs confirm: identify targets 5/2/6/1 within 0-10, plot targets 12/17/16/14 within 0-20.
- show_jump arithmetic verified across all 4 emitted challenges: 1−1=0, 3+1=4, 3+5=8, 19−3=16.
- No fallback strings appeared in any output — Gemini text generation completed cleanly for every challenge.
- Component already on `useChallengeProgress` + `usePhaseResults` + `usePrimitiveEvaluation` from prior migration; no React changes were needed for this refactor.

## Owed validation (not covered by /eval-test)

- Manual UI walks for all 5 modes — confirm "Next →" advances (doesn't replay), `PhaseSummaryPanel` aggregates correctly.
- Cost spot-check — expect ~4× pre-refactor per pinned mode (one Gemini call per challenge instead of one per session). Compare to bar-model baseline.
