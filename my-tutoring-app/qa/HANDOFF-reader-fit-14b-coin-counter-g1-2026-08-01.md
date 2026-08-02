# HANDOFF — reader-fit 14b: coin-counter `count-like` @ Grade 1 — widen the enacted-count fork

Written by `/pm` 2026-08-01. Owning queue: `my-tutoring-app/qa/reader-fit/BACKLOG.md` item **14b**
(second in the §14 pull order; NOT gated on 14e — the census shows coin-counter's own grade
resolution already stamps `gradeBand: 1` correctly at G1). Executors: `/reader-fit --fix` +
`/primitive-contract --check`.

## Paste-able prompt

> Widen coin-counter's K enacted-count band+mode fork to Grade 1 — deliberately, contract-first.
> This is reader-fit BACKLOG 14b, confirmed by authored demand: the `MEAS001-07-c` census trace
> (`qa/topic-traces/g1-identical-coins-2026-08-01.md`) routes `count-like` at Grade 1 and the child
> still computes over inert coins, types a total, and presses Check. Read
> `qa/HANDOFF-reader-fit-14b-coin-counter-g1-2026-08-01.md`, then
> `docs/contracts/coin-counter.md` and `qa/reader-fit/coin-counter-task3-2026-07-25.md` BEFORE
> touching the component.

## Context — what already exists (Task 3, 2026-07-25)

The K fork is built and verified: at K `count-like`, the child taps each coin, a badge stamps the
running skip-count total (5→10→15) in tap order, auto-judge fires when every coin is counted
exactly once, a re-tap is a rejected double-count (shake) — no number input, no Check. The fork is
**band+mode**; Grade 1+ and every `count-mixed` card were left byte-identical (the proof standard
was a git diff of 160 insertions, 0 deletions). The census then corrected the premise: **the
PRIMARY authored consumer of `count-like` is Grade 1** (`MEAS001-07-c`, "skip counting and
summation… single-denomination sets"), there is no K money subskill at all, and the G1 proxy
survives. Widening was deliberately NOT done unilaterally in Task 3 — this slice is that decision,
taken on its own evidence.

## Census evidence (the demand you are honoring)

The trace stamps `gradeBand: 1`, `countMode: 'like'`, **`showRunningTotal: false`** — while the
manifest intent explicitly asks for tap-each-coin running totals. Reconcile `showRunningTotal`'s
meaning if the enacted fork (which IS a running total) ships at G1 — generator/manifest alignment
may be part of the slice.

## Decisions to take deliberately (record each in the contract changelog)

1. **The β question.** G1 `count-like` is `catalog/math.ts:3613`, **β1.5, with live item history**.
   Replacing compute-then-type with the enacted count changes what the item measures. Decide the
   G1 interaction shape on pedagogy (full K parity vs. a G1 variant — e.g. enacted running total
   but the child still states/confirms the final total, which preserves the "summation" half of the
   authored focus) and record the calibration note. Do not silently inherit the K shape just
   because it exists.
2. **Standing rulings that must survive:** the generator stamps `countMode` from `targetEvalMode`
   (never inspect `displayedCoins`); `showCoinValues` stays default-true on like coins (recognition
   aid ruling, 2026-07-25).
3. **Byte-identical elsewhere:** `count-mixed` (β2.5, G2/G3 shared render path) and `identify` must
   not change. Same insertions-only diff discipline as Task 3.

## Explicitly NOT in scope (queued elsewhere — don't scope-creep)

- **14c** G2–3 reachability (`resolveGradeBand` parses prose; re-check after 14e lands).
- **14d / HUMAN-CHECKS #52** K chrome band-gating + missing 🔊.
- Contract gaps **G4** (one-coin card prints its own total) and **G5** (count fallback is a mixed
  set) unless the widening forces one of them.

## Gates

- `/primitive-contract --check` before shipping — COMPATIBLE, or a recorded deliberate fork; append
  the contract changelog.
- `npm run typecheck:lumina` 0 + project-local full tsc 0-new; jsdom suite extended with
  non-vacuity probes; full vitest green.
- Real-Gemini `/eval-test`: `count-like` @ G1 (the target), plus K and `count-mixed` @ G2
  regressions.
- **A real-Chrome click probe** (playwright-core) — jsdom is blind to SVG hit areas (the
  Task 3 / item-11 lesson); drive tap→badge→auto-judge at G1.
- Report `qa/reader-fit/coin-counter-14b-<date>.md`; strike 14b in the BACKLOG with evidence;
  pixel/feel residual → a HUMAN-CHECKS row; WORKSTREAMS "last touched" in the same slice.

## Collision discipline

A sibling session may be working **14e** (geminiService.ts / resolveGenerationContext.ts)
concurrently — file-disjoint from this slice; don't touch those files. Re-read shared registers
(`BACKLOG.md`, `WORKSTREAMS.md`, `EVAL_TRACKER.md`, `HUMAN-CHECKS.md`) immediately before editing;
commit component + contract + strike as one tight slice.
