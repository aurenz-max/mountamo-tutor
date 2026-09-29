# M1 class Live gate, then M2 spoken modes

Date: 2026-09-29 · Executor: `/add-live-tutor-tools` (the Live pair), `/add-support-tiers` (M2, one primitive at a time), `/primitive-contract` (before each primitive) · Follows: [21](21-lever-rollout.md) (rulings, method and gates apply unchanged) · Evidence: `qa/eval-reports/levers-M1-spoken-2026-09-29.md`, `qa/support-levers/m2-lever-tables-2026-09-28.md`, `qa/support-levers/reinventory-2026-09-29.md`

## Why this exists

M1 is the first class with levers on every eval mode (09-29 sweep: counting-board 9/10, `recount_moved` unanswered by decision; number-bond 6/6, base-ten-blocks 4/4, place-value-chart 4/4). Under the 09-28 ruling it is the first class ready for its paid Live pair. M2 has its tap modes only: 12 spoken modes still have no levers.

## User rulings, do not reopen

- **Live readiness (09-28):** Live runs only when every eval mode of every primitive in the class, spoken ones included, has misses and levers and passes vitest. The runs use a mixed payload so one session crosses several challenge types.
- **Budget (09-27):** about $35/day. Two runs per class, never per primitive. Stop when the question is answered; never re-run a passed gate.
- **RP-2 (09-28):** a wrong spoken answer is known from the learner's words, not the tutor's wording. Its build is handoff 20's; do not re-solve it here.

## Before you start

1. `/ship` the uncommitted tree if it is still there (~126 paths on 09-29). The Live pair must run on committed code.
2. **Files:** this lane owns math primitives, `catalog/math.ts` and `liveJourneySpec.ts` math rows. Literacy (handoff 24) and knowledge-check (handoff 25) run beside it. `runtime/` changes go to handoff 20/21, not here.
3. Backend running with the absolute `--reload-exclude` (CLAUDE.md); a `backend/*.py` save mid-run kills the drive with ws 1012.

## Step 1: M1 Live pair (paid, 2 runs)

```
run_live_runtime.py --primitive base-ten-blocks --input <w1-payloads>/base-ten-blocks.mixed.json --lever --lesson-entry --lever-ladder second-wrong --runs 1
run_live_runtime.py --primitive base-ten-blocks --input <w1-payloads>/base-ten-blocks.mixed.json --lever --lesson-entry --audio --runs 1
```

`base-ten-blocks.mixed.json` crosses build, read (spoken), regroup and add on both mats. If you judge counting-board's spoken counts need the audio run more, swap the second run to a counting-board payload; still two runs.

Check only what Live can see: the tutor or the auto-pull acts without being asked, and the screen changes before the tutor describes it. Score with `lever_checks.py`; `lever_review.py` files misses in `qa/lever-bench/QUEUE.md`. Save the summary in `qa/tutor-reports/` and mark M1 "Live gate passed" (or the failing rows) in handoff 21's class table.

## Step 2: M2 spoken modes (vitest gate per primitive)

| Primitive | Modes without levers | Notes |
|---|---|---|
| compare-objects | identify_attribute, compare_two, non_standard | `measure_grid` replaced `baseline_align` (it already exists). A help lever may not name which is longer/heavier |
| number-sequencer | count_from, before_after, spot_error, fill_missing, decade_fill | An ordering simplify never uses a subset of the item's values (R3) |
| ordinal-line | identify, match, relative_position, sequence_story | `clue_cards` is not a lever: every clue names an absolute place |

Spoken misses are already named (handoff 20 Part B; ids in catalog `unanswered` until a lever answers them). Copy the spoken-lever pattern from `baseTenSpokenLevers.ts` and `BaseTenBlocksDi.levers.workspace.test.tsx`. Each primitive: miss table, lever leak tests on saved payloads, `nextLever` table, J9 green, mounted pull test, `typecheck:lumina` 0, tsc at or below baseline. If a mode has no saved payload, generate one (Flash only) before building.

## Step 3: M2 Live pair

When all four M2 primitives pass: same two-run shape as step 1 on a mixed M2 payload (create one if none exists; comparison-builder or number-sequencer).

## Then

M3 per handoff 21 (addition-subtraction-scene, equation-builder after RP-4, math-fact-fluency, bar-model, strategy-picker).

## Closing each slice

Update the primitive's contract, `m2-lever-tables-2026-09-28.md`, the brief's audit table, handoff 21's class table and `WORKSTREAMS.md` row 3.1 in the same slice. One HUMAN-CHECKS row per class (re-grep the next free #).
