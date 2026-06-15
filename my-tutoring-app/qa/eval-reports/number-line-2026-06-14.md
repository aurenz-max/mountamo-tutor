# Eval-Test — number-line (Support-Tier Difficulty Sweep)

**Date:** 2026-06-14
**Skill step:** /eval-test Step 2c (Support-Tier Difficulty Sweep)
**Primitive:** number-line (support tiers just added)
**Topic / grade:** "Number line to 20" / grade 1
**Server:** http://localhost:3000 (up)
**Sweep:** plot_point, show_jump, order_values, find_between × {easy, hard} + show_jump no-difficulty baseline. All 9 calls HTTP 200, ~1.2s each, no infra flakiness.

> Note: the eval-test harness returns the FULL blended set (17 challenges, all 4 types) per call rather than filtering to the requested `evalMode`. The tier (easy/hard) is applied uniformly across every challenge, so each mode is judged from its own challenges within the tiered responses.

## Result table

| Mode | easy→hard scaffold flip | Structural lever | Magnitude invariant | Leak | Verdict |
|------|------------------------|------------------|---------------------|------|---------|
| plot_point | anchors 18→0; tickInterval 2→4 | n/a | targets in [0,20] both tiers | none (anchor ≠ target) | PASS |
| show_jump | arc on→off; tickInterval untouched by mode | 1 op easy → 2 chained ops hard | all landings in [0,20], chained landing clamped | none (arc off at hard) | PASS |
| order_values | anchors present→0; tickInterval 2→4 | n/a | sets in [0,20] both tiers | none | PASS |
| find_between | anchors present→0; tickInterval 2→4 | n/a | bounds in [0,20] both tiers | none | PASS |
| baseline (null tier) | supportTier undefined; no anchors; single-op jumps; tickInterval undefined | n/a | in range | none | PASS (no-op) |

## Assertions

1. **Scaffold flips deterministically** — PASS. easy: 18 anchors total + show_jump arc ON; hard: 0 anchors, arc OFF. tickInterval 2 (easy) → 4 (hard), coarser at hard for plot/order/find (show_jump leaves labels alone, by design).
2. **Structural lever moves** — PASS. show_jump easy = `[1,1,1,1]` single ops; hard = `[2,2,2,2]` chained ops. Verified across all tiered files.
3. **Magnitude invariance** — PASS. Every target, op start, and (chained) landing across all 8 tiered files sits inside `range` [0,20]. Hard is NOT just bigger numbers (max target easy=19 vs hard=18). Chained hard landings stay in scope.
4. **No answer leak** — PASS. Zero anchor-equals-target across all files (leak guard in `buildAnchorsForChallenge` holds). show_jump arc never present at hard.
5. **Null-tier no-op** — PASS. Baseline: `supportTier=undefined`, 0 per-challenge highlights, single-op jumps `[1,1,1,1]`, `tickInterval=undefined` (component default).

## Issues

None. No CRITICAL or HIGH findings. Tier wiring is correct end-to-end; generator owns the structure (anchors / arc / tickInterval / jump steps), magnitudes stay scope-bound, no leak surface.
