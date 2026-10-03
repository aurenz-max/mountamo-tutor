# M3 levers: operations and facts

Date: 2026-09-29 · Executor: `/primitive-contract` (first, per primitive), `/add-support-tiers` (one primitive at a time, never a workflow sweep) · Follows: [21](21-lever-rollout.md) "S3 onwards" (rulings, gates) · Drafts: `qa/support-levers/inventory-2026-09-27/levers-math2.json` (and `plan.html`) · Evidence: `qa/support-levers/reinventory-2026-09-29.md`

## Why this exists

M1 and M2 are done. M3 is the core K-2 arithmetic class and has no levers: 5 primitives, 32 modes, each with named gesture misses (handoff 20 A3) and spoken misses (Part B) but nothing the tutor can pull except `begin_help`. Saved payloads exist for every mode in `runtime/testing/w1-payloads/`.

| Primitive | Modes | Notes from the draft and rulings |
|---|---|---|
| addition-subtraction-scene | act_out, build_equation, create_story, solve_story | act_out and create_story misses are on the picture count; solve_story is spoken |
| equation-builder | build-simple, missing-operand, missing-result, true-false, rewrite, balance-both-sides | RP-4 fixed 09-29 (Unicode minus); a help lever never places the missing tile |
| math-fact-fluency | equation_solve, match, missing_number, visual_fact, speed_round | **No timer on fact fluency** (user ruling). `speed_round` gets no simplify lever |
| bar-model | 12 modes (read, build, compare, graph, word problem) | Largest; do it last. A readout lever never shows the asked value |
| strategy-picker | guided, try_another, choose, match, compare | `compare` has no lever: every choice is credited |

## Rulings, do not reopen

All of handoff 21's apply: levers designed from why learners fail (09-26); triggers are code (2nd wrong auto-pulls help, stuck-first gets help only, wrong-with-help gets simplify); choice removal and single-try pulls are assisted, never unaided credit; simplify keeps the mode (R2) and never uses the learner's own item (R3). Live per class only when every mode is levered (09-28).

## Before you start

1. Tree clean (`08673c20`).
2. **Files:** these five primitives, their generators and workspaces, `catalog/math.ts` M3 entries, their `liveJourneySpec.ts` rows. Other lanes: 29 (Live runs, sweep cap), 31 (`runtime/`, spoken-miss). No `runtime/` edits here.
3. Copy the pattern from M1/M2: `*Levers.ts`, `*Levers.test.ts`, `<X>.levers.workspace.test.tsx`; spoken modes from `baseTenSpokenLevers.ts`.

## Order

~~strategy-picker~~ (SKIPPED by the user 10-02: doubts its pedagogy) → math-fact-fluency (**DONE 10-02**, contract R6-R8, table `qa/support-levers/m3-lever-tables-2026-10-02.md`, HUMAN-CHECKS #182; speed_round ruled out) → addition-subtraction-scene → equation-builder → bar-model. Draft the lever table per primitive from its miss list and confirm the design before building (the skill's Phase 2).

## Gate per primitive (vitest only)

Miss table; each lever's leak rule on saved payloads (simplify: answer recomputed, R2, R3); `nextLever` table and J9 green; mounted pull (DOM changes, scene fact states no answer, next attempt carries the lever, simplify ungraded and returns to the full item, only the unaided answer credited); `typecheck:lumina` 0; tsc at or below baseline.

## Then

The M3 Live pair (handoff 23's two-run shape on a mixed M3 payload), then M4 (pattern-builder, hundreds-chart, spatial-scene, coin-counter, number-tracer) and the unclassed three (sorting-station, shape-sorter, 3d-shape-explorer).

## Closing each slice

Contract, `qa/support-levers/m3-lever-tables-<date>.md`, the brief's audit table, handoff 21's class table, `WORKSTREAMS.md` 3.1. One HUMAN-CHECKS row for the class.
