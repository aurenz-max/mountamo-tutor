# Content defects batch: wrong credit, leaks, fallbacks

Date: 2026-09-29 · Executor: `/eval-fix` (one finding at a time, contract `--check` first) · Queues: `qa/EVAL_TRACKER.md`, handoff 20 RP rows, `qa/eval-reports/knowledge-check-levers-2026-09-29.md`

## Why this exists

The lever work found content defects it was told not to fix inline. Each one either credits a wrong answer, leaks the answer, or drops the learner out of the tutored workspace. They are cheap to fix and each makes the levers' evidence worth more. Ordered by how many learners they reach.

| # | Finding | Primitive | What goes wrong | Where recorded |
|---|---|---|---|---|
| 1 | ~~**KC-UB**~~ | ~~knowledge-check~~ | ~~6 of 12 Grade 1-2 generations build no judged item and fall back to the tap flow (no tutor, no levers): the question is over 24 words (science apply/analyze/evaluate, math evaluate), or the key word sits in a "which word in this sentence" stem~~ | knowledge-check levers report, finding 1 **DONE `e608d16b`.** Three causes: stem > 24 words, the key word in a quoted-sentence stem, and the judged build not reading the generator's `[blank_N]` marker. Probe: 9 orchestrated sets, run 1 5/9 on the workspace, run 2 9/9 (27/27 problems). |
| 2 | ~~**NL-2**~~ | ~~number-line~~ | ~~identify and plot: a point one tick off the target is graded correct (tolerance equals the snap step)~~ | EVAL_TRACKER **DONE `4f65635d`.** `plot_point` accepts only the grid point nearest the target. Sweep J2 passes on plot and identify; baseline rows deleted. |
| 3 | ~~**WS-2**~~ | ~~word-sorter~~ | ~~K ternary: word cards carry their group's emoji (pup 🐶 under Dogs 🐶), so the picture answers the sort~~ | EVAL_TRACKER **DONE `39557d92`.** Generator skips a word whose picture is a mat picture. 6 real sessions, 139 words, 0 leaks. The J9 row was mostly a K-grade hard fixture (no pictures lever at K); re-derived at grade 1. |
| 4 | ~~**RP-5**~~ | ~~spatial-scene~~ | ~~`place` credits only the LLM's `correctCell`; "above/below" allow other right cells. Derive the cell in code from a named reference, as place_in/place_between do~~ | handoff 20 **DONE `2d23df83`.** Code derives `acceptableCells` from the named reference and word; the checker credits any. 15/15 real challenges recompute; 12/15 have two right cells. |
| 5 | ~~**RP-4**~~ | ~~equation-builder~~ | ~~`evaluateEquation` understands only ASCII `-`; a `−` tile row is never judged true by value~~ | handoff 20 **DONE `a9a1dff6`.** Generator keyed a true `8 − 3 = 5` False; minus normalized at ingest, checker reads `−`. 6 modes, 30 real challenges clean. Contract derived. |
| 6 | **BS-3** | balance-scale | equality_hard: the sweep drove 24 items on a 5-challenge payload and the lesson was still active (possible dead end) | EVAL_TRACKER **DIAGNOSED: driver, not a dead end.** 5 challenges × 5 stages = 25 items; the sweep stops at `MAX_ITEMS = 24`. Completes with the cap at 40. Remaining: the cap in `runtime/journeySweep.test.tsx` (runtime lane), then delete the baseline row. |

**Not here:** CO-6 and RP-3 (compare-objects K kinds) belong to the M2 lane (handoff 23), which owns compare-objects. RP-6 (balance-scale tutoring text) is `/add-tutoring-scaffold`.

## Rules

- Contract first: `/primitive-contract <id> --check` before editing; fork on conflict (CLAUDE.md).
- Fix in generator schema or code, not prompt prose, where possible (schema over regex and prompt).
- Every fix is verified at runtime: a probe with real generations (`/eval-test` or `/oracle-test` for the mode), plus the sweep. No Live runs.
- **Files:** the six primitives' generators, scripts and workspaces. The M2 lane owns compare-objects, number-sequencer, ordinal-line; the RP-2 lane owns `runtime/`. Do not edit either.

## Closing each fix

Strike the row where it is recorded, with the commit and probe numbers; update the contract changelog; `WORKSTREAMS.md` if a phase row names it.

## Result (2026-09-29, `/eval-fix`)

Five rows fixed and verified with real generations plus the journey sweep; BS-3 is a sweep limit, not a primitive defect.
`--check` COMPATIBLE on knowledge-check, number-line, word-sorter and spatial-scene; equation-builder had no contract and one
was derived first. Gates: `typecheck:lumina` 0; full tsc adds no source error (a `.next/types` entry for the eval-test route
appeared when the dev server compiled that route; the route is unchanged). Affected suites + sweep 699/699.

Two edits touched `runtime/testing/` data (not runtime code): baseline rows for NL-2 and WS-2 deleted, the BS-3 row relabelled,
and the `word-sorter.ternary_sort`, `word-sorter.ternary_sort.hard` and `spatial-scene.place` payloads regenerated/re-derived.

Seen in probes, not fixed here (for their owners): KC math evaluate G2 keyed a non-make-ten strategy as the make-ten answer;
KC science analyze G2 asks about plants with no picture (R5, visuals planned only at Grade 1); word-sorter K sorts with odd
memberships (hay→Moo, pear→Soup) and misleading emoji (tabby 🐯); spatial-scene `place` still names no misses.
