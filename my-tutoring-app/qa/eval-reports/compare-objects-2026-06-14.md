# Eval Report: compare-objects — 2026-06-14

Focus: **support-tier difficulty sweep** (Step 2c — `config.difficulty`). All four eval
modes swept at baseline / easy / hard, grade 1, 7 instances each.

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| identify_attribute | PASS | — |
| compare_two | PASS | — |
| order_three | PASS | — |
| non_standard | PASS | — |

## Difficulty (support-tier) verification

Tier levers are code-enforced in post-process, so they flip deterministically (no LLM
variance). Observed values match `resolveSupportStructure` / `resolveProblemShape` exactly:

| Mode | Lever | easy | hard | Verdict |
|------|-------|------|------|---------|
| compare_two | visualSize gap `\|a−b\|` (`compareGap`) | 44 (72/28) | 16 (58/42) | ✅ closer at hard |
| order_three | adjacent visualSize spacing (`orderSpacing`) | 28 → [22,50,78] | 12 → [38,50,62] | ✅ tighter at hard |
| order_three (weight) | `showScaleReadout` scaffold | true | false | ✅ withdrawn at hard |
| non_standard | `showUnitNumbers` scaffold | true | false | ✅ withdrawn at hard |
| identify_attribute | `maxOptions` distractors | 3 | 4 | ✅ more distractors at hard |

**Magnitude invariance (structural-not-numeric):** all rendered values stay in-band at
every tier — visualSize on the 5–95 scale (gap/spacing only narrows around midpoint 50,
never inflates), non_standard `unitCount` stays 3–9 at both easy and hard. compare_two's
`actualValue` differs across tiers but is hidden (never rendered); the student reads
`visualSize`, which is bounded. No "hard = bigger numbers" anti-pattern. ✅

**Answer derivability / no leak at any tier:** ✅ Each answer remains derivable from what
the student sees (visualSize ranks preserve `actualValue` rank via `applyCompareGap`/
`applyOrderSpacing`; non_standard count still visible with boxes unnumbered). Withdrawing
the order_three readout at hard hides the digital weight but the platform-drop ordering
remains; nothing is exposed.

**Null-tier no-op:** ✅ Baseline (no `&difficulty=`) → `supportTier` undefined, scaffold
fields (`showScaleReadout`, `showUnitNumbers`) undefined (component defaults them ON),
structural levers at LLM-natural values (gap 40–80, irregular spacing). Pre-tier behavior
unchanged; baseline does not look like "hard".

Note: for identify_attribute, baseline and hard both yield 4 options (hard = untrimmed
natural state); easy trims to 3. Gradient is real (easy genuinely easier); not a regression.

## Issues

None — all modes pass at all tiers.
