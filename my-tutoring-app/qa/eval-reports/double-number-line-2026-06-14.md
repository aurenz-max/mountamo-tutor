# Eval-Test Step 2c — Support-Tier Difficulty Sweep: double-number-line

**Date:** 2026-06-14
**Scope:** Support tiers just added (presentation-only). Sweep verifies scaffold withdrawal easy→hard, magnitude invariance, no answer leak, endpoint preservation, null-tier no-op.
**Verdict:** PASS — no tier defects. unit_rate prior fragility did NOT reproduce.

## Sweep matrix (7 calls, all `status: pass`, 4 challenges each)

| call | tier | guides | unitRate | tickLabels | givenValues | hint style |
|---|---|---|---|---|---|---|
| equivalent_ratios | easy | true | true | all | true | number-baked |
| equivalent_ratios | hard | false | false | none | false | generic |
| find_missing | easy | true | false* | all | true | number-baked |
| find_missing | hard | false | false | none | false | generic |
| unit_rate | easy | true | false* | all | true | number-baked |
| unit_rate | hard | false | false | none | false | generic |
| find_missing | BASELINE (no difficulty) | true | true | undefined | undefined | number-baked |

\* find_missing / unit_rate never plot a unit-rate dot by design (they give a non-unit pair), so `showUnitRate=false` at every tier is correct, not a flip miss.

## Assertions

1. **Scaffold flips (easy→hard):** PASS. guides T→F, tickLabels all→none, givenValues T→F across all three modes; equivalent_ratios additionally flips unitRate T→F. Hints fade number-baked → generic ("Use what the number line shows you to find the value.").
2. **Endpoints always kept:** PASS (component-verified). At tickLabels `none`/`endpoints`, `showTickLabelAt` (DoubleNumberLine.tsx L526-532) returns true only for index 0 and total-1, so min+max labels always render; scale `{min,max,interval}` in the data is never altered by the tier. Magnitude stays readable.
3. **Magnitude invariance:** PASS. Tier flags touch only presentation fields (guides/unitRate/tickLabels/givenValues/hint). `topScale`, `bottomScale`, `unitRate`, ratio numbers, givenPoints, and targetPoints values are produced by the builders/scope BEFORE tier application and left untouched. (Cross-call numbers differ only because each call is a fresh scenario — separate Gemini calls, not a same-seed compare.)
4. **No answer leak (target BOTTOM never pre-plotted):** PASS. Target `bottomValue` exists in data but the component renders the bottom dot from `studentValues` (empty until typed) and shows the value label only `if (hasValue)`. Only the target `topValue` (the stimulus ask) is shown. The given stimulus pair (e.g. Given(2,8)) is legitimate stimulus, not the target.
5. **null-tier no-op (baseline):** PASS. `supportTier=undefined`; new fields `showTickLabels`/`showGivenValues` absent → component defaults to `'all'`/`true`; legacy `showVerticalGuides`/`showUnitRate` default true. Baseline = full scaffolding, identical to easy minus the new explicit field stamps.

## unit_rate solvability (prior 2/3 fail watch)
PASS — not fragile in this run. ur_easy: ch0 derives rate (2,8)→(1,4), hint "Divide: 8 ÷ 2"; ch1-3 use rate 4 consistently (4→16, 5→20, 6→24). ur_hard: (2,10)→rate 5; 4→20, 5→25, 6→30. All challenges arithmetically consistent and solvable. No tier defect; no fragility observed.

## Findings
None CRITICAL/HIGH. Behavior matches the documented design (resolveSupportStructure + applyHintExplicitness + component field consumption). No code touched.
