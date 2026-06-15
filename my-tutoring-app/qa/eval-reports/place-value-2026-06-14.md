# Eval-Test — Support-Tier Difficulty Sweep: place-value (PlaceValueChart)

Date: 2026-06-14
Skill: `/eval-test` Step 2c (Support-Tier Difficulty Sweep)
Scope: scaffold-withdrawal tiers only (structural prefilled-column lever deliberately deferred)
Result: **PASS** — no CRITICAL, no HIGH.

## Design under test
- `showMultipliers` (×1/×10/×100 labels): ON@easy only.
- `showExpandedForm` panel: ON@easy+medium, OFF@hard (primary scaffold of expanded_form mode — withdrawn only at hard).
- Headers (Ones/Tens/Hundreds) + highlighted-digit echo: ungated, render every tier.
- No new component field. No magnitude change (per-mode `MODE_PROFILES` owns the band, tier-independent).
- Single-mode-per-session primitive — `challengeType` is session-level; scaffold flags resolve once.

## Sweep (9 calls, all HTTP 200, status=pass, 3 challenges each)

| run | mode | tier | supportTier | showMult | showExp | numbers (band) |
|---|---|---|---|---|---|---|
| identify_easy | identify | easy | "easy" | **true** | **true** | 11,16,14 (2-digit) |
| identify_hard | identify | hard | "hard" | **false** | **false** | 93,82,13 (2-digit) |
| build_easy | build | easy | "easy" | **true** | **true** | 544,908,442 (3-digit) |
| build_hard | build | hard | "hard" | **false** | **false** | 459,816,662 (3-digit) |
| build_baseline | build | — | **undefined** | true | true | 588,951,145 (3-digit) |
| compare_easy | compare | easy | "easy" | **true** | **true** | 1170,6096,9958 (4-digit) |
| compare_hard | compare | hard | "hard" | **false** | **false** | 2473,4098,3274 (4-digit) |
| expanded_easy | expanded_form | easy | "easy" | **true** | **true** | 88358,26599,63058 (5-digit) |
| expanded_hard | expanded_form | hard | "hard" | **false** | **false** | 20034,66411,53335 (5-digit) |

## Assertions

1. **Scaffold flips** — PASS. `showMultipliers` true@easy / false@hard across all 4 modes; `showExpandedForm` true@easy / false@hard across all 4 modes. Easy ≠ hard (not identical). Medium not swept by harness, but ground-truth `resolveSupportStructure` sets `showExpandedForm = tier !== 'hard'` (true at easy AND medium for every mode, including expanded_form — no per-mode early withdraw), so the panel survives medium as designed.
2. **Structural lever (N/A, deferred)** — PASS. No new structural/prefilled field present in challenge data; only the pre-existing value fields (`targetNumber`, `highlightedDigitPlace`, `minPlace/maxPlace`, `placeNameChoices`, `digitValueChoices`). Numbers do NOT shift as a difficulty lever (see #3).
3. **Magnitude invariance** — PASS. Each mode's number stays in the same band at easy/hard/baseline; hard is not a bigger number (identify 2-digit, build 3-digit, compare 4-digit, expanded_form 5-digit at every tier). Band is owned by `MODE_PROFILES`, independent of `difficulty`. No past-scope.
4. **No answer leak / contract** — PASS. Place-name column headers render unconditionally in `PlaceValueChart.tsx` (the place-name row at the build table has no `showMultipliers`/`showExpandedForm`/tier guard) → present every tier. expanded_form panel present at easy (and code-confirmed at medium). For identify/compare MC, the correct place name is present in `placeNameChoices` every run (e.g. identify includes Ones/Tens; build includes Hundreds; compare includes Thousands).
5. **Null-tier no-op** — PASS. build_baseline: `supportTier=undefined`, `showMultipliers=true`, `showExpandedForm=true` (current/default behavior, no tier applied).

## Notes
- No code touched. EVAL_TRACKER.md untouched.
- `showMultipliers`/`showExpandedForm` consumption confirmed in component (multiplier header row gated by `showMultipliers`; expanded-form panel gated by `showExpandedForm`); place-name HEADER row is never tier/flag-gated.
