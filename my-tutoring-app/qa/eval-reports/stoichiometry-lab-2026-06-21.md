# Eval Report: stoichiometry-lab — 2026-06-21

Step 2c support-tier / structural-difficulty sweep against the running dev server (localhost:3000).
Modes swept: convert, limiting, yield (baseline / easy / hard, 2-3 passes each for LLM variance).

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| convert   | PASS | — |
| limiting  | PASS | — |
| yield     | FAIL | 1 (HIGH) |

## Per-check summary (all modes)

- **1. Scaffold withdrawal (deterministic, code-set):** PASS. `resolveSupportStructure` flips exactly as declared in EVERY mode/pass: easy → showReactionOutput/showMoleLadder/showRatioStrip = T/T/T; medium → T/F/T; hard → F/F/F. Baseline leaves all three at component-default ON.
- **2. Structural lever moves easy→hard:** PASS. convert: easy = all `same` shape (g↔mol of one substance), hard = all `ratioNonUnity` (cross-substance, coeff differs) — consistent across passes. limiting: extent gap easy ~0.36–0.74 → hard ~0.20–0.25 (narrows). yield: easy gap ~0.44–0.50 + no actualYield (theoretical only) → hard gap ~0.20–0.22 + actualYield present (percent-yield step engaged). Both yield levers move.
- **3. Magnitude invariance:** PASS for the tier axis. Hard is not systematically bigger than easy — band-spill (e.g. O2 64 g, 80 g, 160 g) appears at easy AND hard equally and comes from LLM-authored / unclamped given masses, not the tier. Difficulty is carried by shape/gap, not magnitude. No tier-driven scope-ceiling breach.
- **4. No answer leak at any tier:** PASS. The "Run the reaction" panel (the only UI that prints limiting reagent + product yields) is gated on `showReactionOutput`, withdrawn at hard. Mole ladder / ratio strip never print the final answer. targetAnswer / targetAnswerFormula never appear in rendered text. Easy scaffolds genuinely present. All post-process recomputed answers verified correct (e.g. H2 10 g→O2 = 80 g; CO2 yield 44 g, AY 38.72; limiting Na correct).
- **5. Null-tier no-op:** PASS. Baseline (no &difficulty=) → supportTier undefined, all overlays default ON, mixed convert shapes, un-engineered limiting/yield gaps, no actualYield. Matches pre-tier behavior.

## Issues

### yield — hard-tier extent gap can collapse below its own unambiguity floor
- **Severity:** HIGH
- **What's broken:** In `yield` hard, `reselectMassBForGap` clamps the reselected `givenMassB` into the grade-band mass window (max 50 g at grade 10). When the target gap would require a mass above the ceiling, the clamp wins and the resulting extent gap can drop to ~0.04 — well below the generator's declared `LIMITING_GAP_FLOOR` (0.18) and the catalog's "≥~20% gap, unambiguous" rule. There is no post-clamp gap-floor re-check in the tier path (the `gap < 0.15` reject only runs in the pre-tier validation loop, before reselection), so the near-tie ships. Reproduced ~1/12 yield/hard challenges (tell: `givenMassB` lands exactly at the band max, e.g. 50). The yield answer remains mathematically computable (limiting reagent is still determined), but identifying the limiting reagent at a 4% extent gap contradicts the mode's unambiguity invariant at the hardest tier.
- **Data:** `yield hard, CH4+2O2->CO2+2H2O: A=CH4 12 g, B=O2 50 g → eA=0.750, eB=0.781, gap=0.040 (floor 0.18)`
- **Fix in:** GENERATOR

## Notes
- Honest saturation: convert `same`→`ratioNonUnity` ladder had full headroom in the reactions generated (H2/O2/H2O, CH4 combustion, Mg/O2, N2/H2 all support non-unity ratios); no saturation observed. limiting/yield hard gaps clamp to ~0.20 at the floor as designed (limiting hard never dipped below 0.18). No need to re-sweep at a higher grade.
- Recomputed-answer integrity is solid — every tier's targetAnswer/actualYield was derived correctly from final (post-reselect) masses; narration is reset to instruction to avoid stale-answer leakage.
