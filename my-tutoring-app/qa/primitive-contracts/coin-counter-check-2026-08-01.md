# Contract check: coin-counter — 2026-08-01 (reader-fit 14b widening)

**Edit under guard:** widen the K enacted-count band+mode fork to Grade 1 as a G1 VARIANT
(tag each coin → typed total), per `qa/HANDOFF-reader-fit-14b-coin-counter-g1-2026-08-01.md`.
**Edit's own consumer:** G1 `MEAS001-07-c` `count-like` (verified separately under the
Verification Doctrine — see `qa/reader-fit/coin-counter-14b-2026-08-01.md`).

**Verdict: COMPATIBLE** — recorded as the deliberate build of contract gap G1 → new **R11**.

## Other-consumer probes (post-edit)

| Req | Consumer | Probe run | Result |
|---|---|---|---|
| R1 keys derive from coins | all count consumers + oracle | eval-test ×3 (G1 like / K like / G2 mixed), recompute all 18 cards | **18/18 OK, 0 desyncs** |
| R2 count-like single-denomination | G1 (also edit target) | same draws | **6/6 @ G1, 6/6 @ K** |
| R3 count-mixed typed behind Check | G2 `MEAS002-05-a` | jsdom guards: mixed unchanged @ K, mixed unchanged @ G1 (new), typed grading exact; eval-test @ G2 all stamped `mixed` | **PASS** |
| R4 identify hides values | K/G1 identify | render path untouched by diff (edit zone = count only; catalog addition is a scoped aiDirective, no showValue impact) | **PASS (diff evidence)** |
| R5 instructions never enumerate coins | all count consumers | all 18 instructions generic | **PASS** |
| R6 no duplicate cards | all | 18 distinct signatures | **PASS** |
| R7 make-amount reachable | G2 | generator make-amount path untouched | **PASS (diff evidence)** |
| R8 tiers withdraw scaffolds, never magnitude | all | `showRunningTotal` stamped values UNCHANGED (easy-only fade, both mappings identical); meaning extended, magnitude untouched | **PASS** |
| R9 K count-like enacts | K topic-driven | jsdom K describe 5/5 (running badges, auto-judge, double-count, no input/Check); eval-test @ K 6/6 like, K pool | **PASS** |
| R10 grade band gates pool | all | G1 draw includes quarter (G1 pool); K draw penny/nickel only | **PASS** (known G2 defect = 14c, out of scope, unchanged) |

## Conflicts

None new. C1 stays RESOLVED — count-mixed remains typed at every band (guard-tested). The G1
change supersedes R3's *sibling* behavior at G1 count-like only, exactly as gap G1 anticipated.

## Rulings preserved (handoff decision 2)

- `countMode` stamped from `targetEvalMode` at origin — untouched; non-vacuity probe B (guard
  dropped) fails the two mode-guard tests.
- `showCoinValues` default-true on like coins (recognition aid ruling 2026-07-25) — untouched.

## Diff discipline (handoff decision 3)

`count-mixed`, `identify`, and the K enacted path are behaviorally byte-identical: the component
edit adds a sibling predicate + sibling render fn + one Check-gate condition; the only shared-line
edits are comments, the Check-gate ternary (mode-gated so it cannot fire for mixed/identify/K),
and two challenge-start tutor strings that append an empty clause outside G1 count-like.

## New requirement

**R11** (contract) — G1 count-like enacted tag-then-type, with the β1.5 calibration note: answer
act unchanged (typed total); tagging protocol added (double-taps now count as attempts); easy tier
displays the accumulation (self-check workspace). Full K parity was REJECTED (would ablate the
summation half and collapse the item toward unfailable).
