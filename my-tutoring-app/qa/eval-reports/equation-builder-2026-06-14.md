# equation-builder — Support-Tier Difficulty Sweep (Step 2c)

**Date:** 2026-06-14
**Topic:** "Balancing equations" · grade 3 (maxNumber=10) · dev server localhost:3000
**Lever (design):** generator-side tile/option distractor count. build/rewrite = distractor tile count; missing-result/missing-operand = MC option count + spread. true-false + balance-both-sides = instruction-only.
**Result: PASS** (no CRITICAL / no HIGH). Do-not-fix sweep; no code touched.

## Sweep coverage
6 eval modes × {easy, hard} + 1 baseline (build-simple, no `difficulty`). All 13 calls `status:pass`, catalogMeta non-null, 5 challenges each, 0 errors.

## Structural lever — moves cleanly

| mode | easy | hard | spec | verdict |
|---|---|---|---|---|
| build-simple (distractor tiles) | **0** | **4** (incl. operator `-`) | 0→4 | PASS exact |
| rewrite (distractor tiles) | +0 over needed | +4 over needed (incl. op) | 0→4 delta | PASS (delta +4; absolute tile count higher than build because the needed-token base is the union of all accepted-forms, not just the original equation — expected) |
| missing-result (MC) | **3** opts, FAR (deltas ≥3) | **4** opts, NEAR ±1/±2 | 3 far → 4 near | PASS |
| missing-operand (MC) | **3** opts, FAR (deltas ≥3) | **4** opts, NEAR ±1 | 3 far → 4 near | PASS |
| true-false | instruction-only | instruction-only | no structural lever | PASS (accepted) |
| balance-both-sides | instruction-only | instruction-only | no structural lever | PASS (accepted) |

Per-challenge distractor counts were uniform within each tier (build hard = [4,4,4,4,4]; rewrite hard = [7,7,7,7,7] = needed-base+4; missing-value hard = 4 options every instance).

## Key invariant — tile-palette / MC completeness: HOLDS
- **build + rewrite, every tier:** `MISSING_NEEDED=[]` for all 25 build + 10 rewrite challenges. easy (0 added distractors) still contains every target/accepted-form token.
- **missing-value, every tier:** `correctValue ∈ options` = True for all 20 challenges. easy (3 opts) and hard (4 opts) both always include the answer.
- No missing needed tile and no missing correct option anywhere → invariant satisfied.

## Magnitude invariance: HOLDS
All operands and results stay within scope (0–10, maxNumber=10) at both tiers across every mode. Hard tiers add NOISE (more distractors / near-miss options), not bigger numbers. Distractor tiles are spare in-scope numbers + one opposite operator; near-miss MC deltas are ±1/±2 (one scope-clamp artifact: missing-result `7+3=10` hard had a -4 delta because +1/+2 exceed max 10 — option count still 4, acceptable).

## true-false + balance instruction-only: OK
Both modes return identical structure across easy/hard (no choice-breadth lever exists for a binary / numeric-input task). Gradient is instruction-tone only via `resolveSupportStructure` + `tutorRevealPolicy`. Accepted per design.

## Null-tier no-op (baseline): CONFIRMED
build-simple with no `difficulty` → `fullData.supportTier` absent (None), 3 distractors (≥2 default behavior), missing-value default 4 options. Byte-compatible with pre-tier behavior.

## Notes
- `supportTier` is stamped at **`fullData.supportTier`** (top-level), not per-challenge. Present for easy/hard, absent for baseline — correct.
- rewrite absolute distractor count (3 easy / 7 hard) is higher than build (0/4) but the easy→hard **delta is exactly +4**, matching distractorCount 0→4. The larger floor is the accepted-forms needed-set, which `addDistractorTiles` correctly treats as needed tiles (never withdrawn).
