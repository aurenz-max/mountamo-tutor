# Eval Report: counting-board — 2026-03-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| count | PASS | — |
| subitize | PASS | — |
| group | PASS | — |
| count_on | PASS | — |
| compare | PASS | — |

## Notes

**2026-07-03 — CB-1 fixed (COMPONENT-SIDE, scatter determinism).** User-reported: scattered
arrangements landed in identical positions on every challenge. Root cause: `generateScatteredPositions`
used a hardcoded `seed = 42` and `generatePositions` never threaded a seed, so every scattered board
with the same object count was byte-identical. Fix: derive a per-challenge seed by hashing the challenge
`id` (stable within a challenge so positions don't jump on tap; varied across challenges), thread it
through `generatePositions → generateScatteredPositions`, and add it to the `positions` memo deps.
Line/groups/circle layouts unaffected (they ignore the seed). tsc: no new errors.

**2026-07-20 — subitize re-verified PASS after the reader-fit item-13 K flash-then-hide DISPLAY
fork.** The fork is component-only (no generator/schema/catalog change), so subitize CONTENT is
unchanged: eval-test @ K ("Subitizing to 5") returned `pass`, 7 subitize challenges, every
`targetAnswer === count`, counts 2–5 (K perceptual band; topic "to 5" ceiling honored — no
magnitude past 5), no bound number leaked into instruction/hint/narration. The flash-then-hide
lifecycle itself (objects appear briefly, then hide before the numeric stepper enables; hidden
objects are not tappable) is a runtime display behavior eval-test does not observe — it is verified
by the jsdom behavioral suite `CountingBoard.reader-fit.test.tsx` (3/3). Contract:
`docs/contracts/counting-board.md` R4. See reader-fit BACKLOG item 13.

**2026-07-03 — CB-2 fixed (GENERATOR, deterministic scaffold default).** User-reported: in a mixed-mode
board, counted objects showed the tap highlight ring but no per-object count number. Root cause: the
per-object counter is gated on `showOptions.showLastNumber`, which in the untiered/mixed path came
straight from flash-lite. Because `showOptions` is a single global object but the prompt gives per-type
guidance ("showRunningCount true for count_all, false for subitize"), a mixed board gets contradictory
instructions for one field and can drop `showLastNumber` to `false`. Fix: in the untiered path (`!tierScaffold`),
pin `showLastNumber = true` and `highlightOnTap = true` deterministically — same "code owns the support
structure" principle the tiered block already uses. `showRunningCount` left as-generated (its "N / total"
tally exposes the target). Tiered-mode withdrawal at `hard` is untouched. Verified: count/subitize/group
eval-tests all return `showLastNumber: true`; `showRunningCount` still varies per mode. tsc: no new errors.
