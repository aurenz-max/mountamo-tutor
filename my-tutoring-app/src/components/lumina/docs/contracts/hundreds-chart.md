# Contract: hundreds-chart

- **Derived:** 2026-10-13, PARTIAL: written by the VB-1 voice slice for the workspace answer channels only. A full `/primitive-contract hundreds-chart` derivation (consumers per counting / skip-counting skill, grade bands, board ceiling) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/HundredsChart.tsx` · **Workspace:** `hundredsChartWorkspace.ts` · **Levers:** `hundredsChartLevers.ts` · **Generator:** `service/math/gemini-hundreds-chart.ts` · **Oracle:** `service/qa/oracles/hundreds-chart.ts` · **Adapter:** `components/live-activity/adapters/hundredsChartLive.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`hundreds-chart`)

## Requirements

### R1 — no unearned credit and no key in the scene; a choice may be said aloud · OBSERVED (NEW 2026-10-13)
- **Property:** every tap and Check is checked by the chart (`hundredsChartMatches`) and a wrong one names a `HundredsChartMiss` from the catalog list. highlight_sequence and complete_sequence are gesture only (the answer is a set of cells, tapped one by one). identify_pattern and find_skip_value are spoken items with `acceptsGesture`: JEV judges the spoken description or skip value against `expectedAnswer` (`hundredsChartExpectedAnswer`, observer-only), wrong ones map to the tap's miss ids (`hundredsChartSpokenMisses`), and the tap and Check is still checked by the chart. The scene names the board, the highlighted numbers, the printed choices and the choice tapped so far (`learnerWork`), never which numbers belong, the shape or the skip value.
- **Demanded by:** qa/workspace-rollout/ROLLOUT.md C9 (W1 binding); VB-1 (voice beside the tap).
- **Evidence:** `HundredsChart.workspace.test.tsx`, `HundredsChart.spoken.workspace.test.tsx`; journey sweep (J14 cleared for find_skip_value); `scripts/tutor-verdict-probe.mjs --hundreds` 27/27, false credit 0 (`qa/tutor-reports/hundreds-chart-tutor-verdict-2026-10-13.json`). The first run, before `learnerWork` was published, credited a bare "Great job!" after "four" in 2 of 3 repetitions (verdict p 0.90-0.91, at the gate).

## Changelog

- 2026-10-13 — created with R1 (VB-1). Nothing removed: every tap path, Try again and the levers are unchanged; the gesture-only assertions in `HundredsChart.workspace.test.tsx` re-based to the cell modes.
- 2026-10-14 — `/add-item-space`: with a tier, highlight_sequence, complete_sequence and find_skip_value take each count (step and start) from `skip-count`; a session holds `requestedCount` distinct counts (before: the same three counts from their own step at every tier, and a one-interval lesson shipped one challenge). A count that does not start at its step names its start in the instruction; hop_dots on highlight is offered only for a count from its step (no hop precedes 23 in a by-10s count from 23). The oracle derives the run from `startNumber`. hard find_skip_value for 10s now has four options (the neighbours were capped at 10). identify_pattern stays on its own path (the shape is set by the step and its descriptions assume a count from the step). R1 unchanged.
