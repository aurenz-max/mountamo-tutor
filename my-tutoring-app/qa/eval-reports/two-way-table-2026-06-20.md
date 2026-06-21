# Structural-Difficulty Eval Sweep — two-way-table (2026-06-20)

Primitive: `two-way-table` (generator `gemini-two-way-table.ts`)
Archetype: builder-constructor. Lever (all modes): **table dimensionality** 2x2 → 2x3 → 3x3 (code-enforced via dimension-keyed scenario pools). Scaffold axis: withdraw display margin totals (`showRowTotals`/`showColTotals`/`showGrandTotal`) + easy `sumReminder`, with `answerTotalAxis` decoupling so the answer-bearing total never renders at any tier.

## Results

| Mode | Tier | Dims (lever) | Scaffolds (sR/sC/sG) | sumReminder | answerTotalAxis hidden | maxCell (band ~5-50) | Verdict |
|------|------|-------------|----------------------|-------------|------------------------|----------------------|---------|
| marginal_distribution | baseline | 2x2 | none set (showTotals=false) | — | n/a (no tier) | in band | no-op OK |
| marginal_distribution | easy | 2x2 | non-answer axis + grand ON | safe non-answer total | yes (sR=false on row-ans, sC=false on col-ans) | ≤50 | PASS |
| marginal_distribution | hard | 3x3 | all OFF | — | yes | 30/32/24/32 | PASS |
| conditional_probability | easy | 2x2 | non-answer axis + grand ON | safe non-answer total | yes (conditioning marginal hidden) | ≤60 | PASS |
| conditional_probability | hard | 3x3 | all OFF | — | yes | 26/32/30/24 | PASS |
| joint_probability | baseline | 2x2 | showTotals=true (mode default) | — | axis=none | in band | no-op OK |
| joint_probability | easy | 2x2 | all ON (axis=none) | row anchor | n/a (axis=none) | ≤50 | PASS |
| joint_probability | hard | 3x3 | all OFF | — | n/a | 32/32/24/30 | PASS |

## Assertions (easy vs hard)

1. **Scaffold withdrawal (code-set, MUST flip):** PASS. easy shows every non-answer total + worked sumReminder; hard hides all three (`showRowTotals=showColTotals=showGrandTotal=false`, no reminder). Flips exactly as `resolveSupportStructure` declares.
2. **Structural lever moves:** PASS (code-enforced). Dimension 2x2 (easy) → 3x3 (hard) confirmed in `frequencies` shape for all three modes. For marginal/conditional this materially raises addends per marginal (2→3 cells); for joint the lever is scan-density only (brief calls it near-cosmetic) but the dimension still moves and magnitude holds — honest "yes", not oversold.
3. **Magnitude invariance:** PASS. Per-cell maxCell stayed 24–32 across easy AND hard in every mode — the same ~5-50 band as the 2x2 pool. Grand total grows only because there are more cells, never because cells got bigger. No scope-ceiling breach.
4. **No answer leak:** PASS. `answerTotalAxis` correctly suppresses the answer-bearing total at every tier: marginal/conditional hide the answer row/col total even at easy; the easy sumReminder always anchors a *safe* non-answer total (verified: e.g. col-answer challenges show a row reminder and vice versa). joint axis=none → answer is a probability with the cell already visible by mode design, totals are context only.
5. **Null-tier no-op:** PASS. Baseline (no `&difficulty`) draws from the 2x2 SCENARIO_POOL with no supportTier and mode-default showTotals (false for marginal, true for joint) — matches pre-tier default, not already-hard.

## Issues

None. No CRITICAL or HIGH findings.
