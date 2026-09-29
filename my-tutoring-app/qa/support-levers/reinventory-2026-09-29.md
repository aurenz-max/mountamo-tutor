# Support-lever re-inventory, 2026-09-29

Measured, not read from docs: `JOURNEY_SWEEP_OUT` `leverInventory` over the working tree on 09-29
(sweep green, 245 tests; includes the uncommitted M1-spoken and L4 work). Raw: `sweep-inventory-2026-09-29.json`.
A mode is `levers` if its saved payload published a lever, `none` if a payload ran and published none,
`unmeasured` if no saved payload exists (unknown, not absent).

**Correction, same day:** this sweep ran on a tree the M1 session was still writing. The re-run after it closed: counting-board 9/10 (recount_moved unanswered by decision), number-bond 6/6, base-ten-blocks 4/4, place-value-chart 4/4, so **M1 is complete and Live-ready**; 65 modes levered overall. M2 still lacks 12 (compare-objects 3, number-sequencer 5, ordinal-line 4). ten-frame and number-line's other modes belong to M4 / miss-function-first. Handoffs: 23 (math), 24 (literacy), 25 (knowledge-check).

## Totals

69 graded bound families, 319 modes: **58 levers**, 175 none, 86 unmeasured. 1,337 declared misses:
228 answered by a lever, 147 unanswered by decision, 962 open.

| Domain | Families | All modes levered | Some | None | Modes levered / total | Unmeasured |
|---|---|---|---|---|---|---|
| math | 25 | 5 | 6 | 14 | 31 / 141 | 0 |
| literacy | 23 | 1 | 17 | 5 | 27 / 93 | 48 |
| DI | 10 | 0 | 0 | 10 | 0 / 37 | 11 |
| science, history, calendar, assessment | 11 | 0 | 0 | 11 | 0 / 48 | 27 |

All modes levered: base-ten-blocks, fraction-circles, place-value-chart, comparison-builder, number-bond, interactive-book.

## What the numbers change

1. **M1 and M2 are not close to Live-ready.** "Tap modes done" covers 1-2 modes per primitive; the rest are
   spoken or unbuilt. Modes still without levers: counting-board 8/10 (count, recount_moved, subitize, group,
   add_more, take_away, count_on, compare), ten-frame 5/7, number-line 4/5 (identify, plot, order need a miss
   function first), number-sequencer 5/6, ordinal-line 4/5, compare-objects 3/4. 29 modes.
   base-ten-blocks' spoken levers (`baseTenSpokenLevers.ts`, 09-28) are the first spoken math levers: the pattern
   to copy.
2. **Literacy is mostly unmeasured, not unbuilt.** 48 of 93 modes have no saved payload, so the sweep never drove
   them. Measure first (payloads, Flash only, as S1b did for math); some already have levers.
3. **Three math primitives are in no class:** sorting-station (7 modes), shape-sorter (4), 3d-shape-explorer (5).
4. **knowledge-check** (every subject, 60 misses) has none; its text options need a `near|far` tag first.
5. **DI (10 families)** has its own correction procedure ("my turn"). Whether in-item levers apply is a user call.

## Priority

| # | Work | Why first | Executor |
|---|---|---|---|
| P1 | M1 + M2 remaining modes (29), spoken ones on the base-ten spoken pattern; number-line identify/plot/order miss functions first. Then the first class Live gate | the most-used K-1 primitives; unlocks the first `--mode mixed` Live run | `/add-support-tiers` · handoff 21 |
| P2 | Measure literacy: payloads for the 48 unmeasured modes, re-run the inventory; then finish L4 (oral-sentence-studio) and phonics-blender (OK'd 09-28) | turns "unknown" into a real gap list before building | `/add-support-tiers` · handoff 22 |
| P3 | knowledge-check (`near|far` tag, then `drop_far_choice`) | appears in every lesson of every subject | `/add-support-tiers` · handoff 21 core |
| P4 | M3 operations: addition-subtraction-scene, equation-builder (RP-4 first), math-fact-fluency (no simplify on speed_round), bar-model (12 modes), strategy-picker | 32 modes, core K-2 arithmetic | `/add-support-tiers` · handoff 21 |
| P5 | M4 + the unclassed three: pattern-builder, hundreds-chart, spatial-scene (RP-5 first), coin-counter, number-tracer, sorting-station, shape-sorter, 3d-shape-explorer; balance-scale needs a miss function first | | `/add-support-tiers` · handoff 21 |
| — | DI family, science, history, calendar | user ruling on DI; others later | — |
