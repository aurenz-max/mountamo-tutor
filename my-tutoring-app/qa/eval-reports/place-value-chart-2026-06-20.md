# Structural-Difficulty Sweep — place-value-chart (2026-06-20)

Generator: `gemini-place-value.ts` · componentId `place-value-chart`
Axes: scaffold withdrawal (`showMultipliers`, `showExpandedForm`, session-level) + structural shape (`minNonZeroDigits` count ladder + highlight-place interiority, code-enforced via `enforceNonZeroDigits` + `selectHighlightedPlaceForTier`).

## Results

| Mode | Tier | mult / exp | nz digits | highlight place(s) | numbers (band) | Verdict |
|------|------|-----------|-----------|--------------------|----------------|---------|
| compare | baseline | T / T | 4,4,4 | 2,2,1 | 9175,7937,1781 (1111-9999) | OK |
| compare | easy | T / T | 4,4,3 | 0,0,3 (edges) | 6685,5235,6920 | OK |
| compare | hard | F / F | 4,4,4 | 2,2,2 (deep-interior) | 2721,2822,6643 | OK |
| build | easy | T / T | 3,3,3 | 2,2,0 (edges) | 881,385,761 (111-999) | OK |
| build | hard | F / F | 3,3,3 | 1,1,1 (interior tens) | 498,897,342 | OK |
| identify | baseline | T / T | 2,2,2 | 1,1,1 | 57,31,48 (11-99) | OK |
| identify | easy | T / T | 2,2,2 | 1,1,0 | 81,73,93 | OK |
| identify | hard | F / F | 2,2,2 | 1,1,0 | 18,35,17 | OK |

## Assertion summary

1. **Scaffold withdrawal (code-set, MUST flip)** — PASS. Every mode: easy `mult=T, exp=T` → hard `mult=F, exp=F`, matching `resolveSupportStructure` (mult ON only at easy; exp ON at easy+medium, OFF at hard).
2. **Structural lever moves** — PASS.
   - `compare` (widest band): highlight climbs edge (places 0/3) → deep-interior (place 2) easy→hard; nz packs to a reliable 4 at hard. Full ladder visible.
   - `build`: nz count **saturated-honest** (3-digit band, bandDigitFloor=3, hard's want=4 clamps to 3) — declared in brief. The interiority lever still climbs: easy edges (places 2/0) → hard interior tens (place 1, most place-confusable column). Lever moves.
   - `identify`: lever=**n/a** (2-digit band, already 2-of-2 non-zero, zero structural headroom). Shape unchanged across tiers — correct, not a gap.
3. **Magnitude invariance** — PASS. identify 2-digit (11-99), build 3-digit (111-999), compare 4-digit (1111-9999) hold at every tier. No inflation past band, no scope-ceiling breach.
4. **No answer leak** — PASS. Answers are MC choices derived locally from `targetNumber`. Hard withdraws only crutches (multiplier labels, worked expanded-form panel); place-name column headers + highlighted-digit echo (which ARE the task) stay rendered at every tier (UI contract). Easy genuinely helps; hard never exposes the answer.
5. **Null-tier no-op** — PASS. Baselines (compare, identify) show `supportTier=None`, `mult=T`, `exp=T` — the pre-tier default, not already-hard.

## Issues

None (no CRITICAL/HIGH).

Notes: `build` count lever is saturated-honest by design (3-digit band only fits one rung above the floor); its highlight-interiority lever carries the structural climb. `identify` is correctly lever=none — only scaffolding withdraws.
