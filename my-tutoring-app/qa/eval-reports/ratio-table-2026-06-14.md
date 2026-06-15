# ratio-table — Eval-Test Step 2c (Support-Tier Difficulty Sweep)

**Date:** 2026-06-14
**Skill:** `/eval-test` Step 2c — support-tier difficulty sweep
**Context:** ratio-table just received support tiers + a unit-rate LEAK FIX.
**Topic:** Recipe ratios | **Grade:** grade 6 | **Catalog id:** `ratio-table` (hyphen) | **eval modes:** underscore (`missing_value`, `find_multiplier`, `build_ratio`, `unit_rate`)

## Result: PASS (no CRITICAL / no HIGH)

9 calls, all HTTP 200, all `status=pass`, all `catalogMeta` non-null, all challengeCount ≥ 3. No retries needed.

## Scaffold flip (easy → hard)

| mode | showUnitRate easy→hard | showBarChart easy→hard | verdict |
|---|---|---|---|
| missing-value | true → **false** | true → **false** | flips ✓ |
| find-multiplier | true → **false** | true → **false** | flips ✓ |
| build-ratio | true → **false** | true → **false** | flips ✓ |
| unit-rate | false → false (banner redundant by design) | true → **false** | bar flips ✓ |

All scaffolds withdraw toward hard. unit-rate's banner is `false` at every tier by design (its own B÷A display covers it).

## LEAK CLOSED at hard (priority check) — YES

- **Banner off:** mv_hard and fm_hard both report `showUnitRate=false`. The always-on banner (which prints baseRatio[1]/baseRatio[0] = the answer for these modes) is withdrawn. ✓
- **Hints don't state the unit-rate value at hard:** Every generated `hint` in mv_hard / fm_hard names only the *strategy* (per-1 reasoning, "divide total by time", "how many times does 6 go into 18"), never the unit-rate number verbatim. ✓
- **Component hint ladder confirmed in source:** `provideHint` gates on `mayStateUnitRate = !isHard && !isUnitRateMode`; at hard the first hint is "find how many B go with just 1 A" (strategy nudge), the verbose `Hint: The unit rate is N` branch is unreachable at hard. ✓

## Magnitude invariance — YES (structural)

Tier code (`resolveSupportStructure` + the post-process block) touches only the `showUnitRate` / `showBarChart` / `supportTier` fields and the prompt scaffolding prose; it **never reads or writes `baseRatio` / `targetMultiplier`**. Numbers differ between easy and hard calls only because the LLM samples fresh contexts each call — both tiers stay within the same grade-6 scope (whole-number bases, multipliers ~2–5 / simple decimals). No tier-driven number inflation. ✓

## unit-rate B÷A framing kept at every tier — YES

ur_easy and ur_hard both render the hardcoded `B ÷ A = ?` division prompt (tier-independent in the component), and every unit-rate hint at both tiers instructs "divide [B] by [A]". Task identity preserved. ✓

## Null-tier no-op — YES

Baseline `missing_value` with no `difficulty` param: `supportTier` undefined, `showUnitRate=true`, `showBarChart=true`. Banner + bar shown, tier not stamped. ✓

## Raw scaffold matrix

| call | tier | showUnitRate | showBarChart | count | types |
|---|---|---|---|---|---|
| mv_easy | easy | true | true | 4 | missing-value |
| mv_hard | hard | false | false | 4 | missing-value |
| mv_base | — | true | true | 4 | missing-value |
| fm_easy | easy | true | true | 4 | find-multiplier |
| fm_hard | hard | false | false | 4 | find-multiplier |
| br_easy | easy | true | true | 3 | build-ratio |
| br_hard | hard | false | false | 4 | build-ratio |
| ur_easy | easy | false | true | 4 | unit-rate |
| ur_hard | hard | false | false | 4 | unit-rate |

## Issues

None. No code changes made.
