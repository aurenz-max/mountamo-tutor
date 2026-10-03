# Close past findings at their class: J12, then small closes

Date: 2026-09-29 (rewritten same day) · Executor: `/add-live-tutor-tools` · Rule: `/add-live-tutor-tools` §5, "A finding closes at its class, not its instance" (user 09-29) · Queue: `qa/lever-bench/QUEUE.md`

## Why this exists

LB-14 (counting-board), LB-16 (letter-spotter) and LB-20 (knowledge-check) were one defect: the tutor was told a lever was on screen, but nothing was drawn or marked. Each was found in a paid Live run and fixed in its own primitive. The dry sweep already pulls a lever on every levered payload (`journeySweep.test.tsx`, the ladder and stuck branches) but never checks the screen. This lane applies the new rule to those rows, once, for every primitive with levers.

## 1. J12: a pulled help lever is on screen

- Add `J12-lever-visible` to `JOURNEY_INVARIANTS`: after a help pull commits (not a simplify, which opens a practice item), the container has a `[data-lever]` element it did not have before, before any retry. Assert it in the journey path that feeds the invariants (the pull in the replay-moments path does not record findings; add the pull there if the invariant path has none).
- Run the sweep. Every hit is a primitive whose lever is invisible or unmarked: fix all of them in this slice (draw from the pull, not from Try again; mark with `data-lever`). A lever that is correctly voice-only (`carrier: voiced`) is exempt; list them.
- Close LB-14, LB-16, LB-20's class: add "class check J12, <n> hits fixed" to each row.

## 2. Audit the other closed rows once

For each closed LB row, one line in the queue: its class check, or why none applies (harness and doctrine rows are already shared fixes). Open a new sweep rule only where a row names a primitive defect other primitives could share.

## 3. BS-3 sweep cap

Raise `MAX_ITEMS` from 24 (40 completes balance-scale's 25-item session); delete the BS-3 baseline row; strike BS-3 in EVAL_TRACKER.

## Not in this lane

- **M2 Live pair:** waits on the user's ruling on batching Live into one weekly sitting (then M2 and M3 go together).
- **LB-21 re-run:** dropped; knowledge-check recall is not on the RP-2 list, so the result is known. LB-21 stays open under handoff 31 (parked).
- LB-12, LB-18: their executors, when their primitives are next touched.

## Gates

Sweep green with J12 on every payload; `typecheck:lumina` 0; tsc at or below baseline. No Live runs.

## Closing

Queue rows updated, `WORKSTREAMS.md` 3.2, a one-paragraph report in `qa/tutor-reports/`.
