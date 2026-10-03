# M4 levers: patterns, charts, space, money, writing numbers

Date: 2026-09-29 · Executor: `/primitive-contract` (first, per primitive), `/add-support-tiers` (one primitive at a time, never a workflow sweep) · Follows: [21](21-lever-rollout.md) "S3 onwards" (rulings, gates) · Runs beside: [30](30-m3-operations-levers.md) (M3), [29](29-m2-live-and-small-closes.md) (J12) · Drafts: `qa/support-levers/inventory-2026-09-27/levers-math2.json`, `plan.html`

## Why this exists

M4 is development, not testing. Its primitives have named misses (handoff 20 A3/A4) but no levers: when a learner is stuck the tutor can only `begin_help`. Saved payloads exist for every mode. 09-29 sweep:

| Primitive | Modes without levers (misses per mode) | Notes |
|---|---|---|
| ten-frame | decompose 3, subitize 5, decompose_teen 5, make_ten 6, operate 7 | build and build_teen already have levers: reuse `tenFrameLevers.ts`. `showEmptyCount` states the answer and must not become a lever as it stands |
| hundreds-chart | highlight_sequence 5, complete_sequence 5, find_skip_value 6, identify_pattern 0 | Reuse number-line's `learnerHops`; a simpler skip shares no cells with the item's answers. identify_pattern has no misses (its choices are sentences): give its choices a recorded kind first, or record it `unanswered` with the reason |
| pattern-builder | extend 7, identify_core 4, translate 5, create 2, find_rule 7 | A help lever never shows the next element; a simplify pattern uses a shorter core, never the item's own |
| coin-counter | identify 4, count-like 5, count-mixed 6, compare 4, make-amount 5, make-change 5, fewest-coins 5 | A running total counts only coins the learner moved, never the target (as ten-frame's running count) |
| number-tracer | trace 6, copy 6, write 6, sequence 6 | Writing, not choosing: help acts on the stroke (start dot, stroke order), never shows the digit in `write` |
| spatial-scene | identify 3, place_in 3, describe 3, place_between 2, follow_directions 2, describe_scene 1, place 0 | RP-5 fixed 09-29 (`place` derives its right cells in code), but `place` still names no misses: add them from the derived cells first |
| number-line (last) | identify, plot, order, between: no miss functions | `jump` has levers. Write each mode's miss function (NL-2 fixed 09-29: plot credits only the nearest point), then levers |

About 36 modes.

## Rulings, do not reopen

All of handoff 21's: levers designed from why learners fail (09-26); triggers are code (2nd wrong auto-pulls help; stuck-first gets help only; wrong-with-help gets simplify); choice removal and single-try pulls are assisted; simplify keeps the mode (R2) and never uses the learner's own item (R3). **Findings close at their class (09-29):** a defect found here gets one shared check over every primitive it could affect (`/add-live-tutor-tools` §5), not a local fix. No Live runs in this lane; the class Live pair waits on the user's batching ruling.

## Before you start

1. Tree clean.
2. **Files:** these seven primitives, their generators, workspaces and lever files; their `liveJourneySpec.ts` rows; their entries in `catalog/math.ts`. The M3 lane (30) edits other entries in the same catalog file and other journey rows: re-read both files right before each edit. Lane 29 owns `journeySweep.test.tsx`; do not edit it.
3. Copy the pattern from M1/M2: `*Levers.ts`, `*Levers.test.ts`, `<X>.levers.workspace.test.tsx`; spoken modes from `baseTenSpokenLevers.ts`.

## Order

ten-frame (**DONE 09-29**, contract R12, table `qa/support-levers/m4-lever-tables-2026-09-29.md`, HUMAN-CHECKS #181) → hundreds-chart → coin-counter → pattern-builder → spatial-scene → number-tracer → number-line. Per primitive, draft the lever table from its miss list and why learners fail, confirm the design (the skill's Phase 2), then build.

## Gate per primitive (vitest only)

Miss table; each lever's leak rule on saved payloads (simplify: answer recomputed, R2, R3); `nextLever` table and J9 green (J12 too once lane 29 lands); mounted pull (the DOM changes and carries `data-lever`, the scene fact states no answer, the next attempt carries the lever, simplify is ungraded and returns to the full item, only the unaided answer is credited); `typecheck:lumina` 0; tsc at or below baseline.

## Then

The unclassed three (sorting-station 7 modes, shape-sorter 4, 3d-shape-explorer 5), then balance-scale (miss function first).

## Closing each slice

Contract, `qa/support-levers/m4-lever-tables-<date>.md`, the brief's audit table, handoff 21's class table, `WORKSTREAMS.md` 3.1. One HUMAN-CHECKS row for the class (re-grep the next free #).
