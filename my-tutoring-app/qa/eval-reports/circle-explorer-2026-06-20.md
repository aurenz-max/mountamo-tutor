# Structural-Difficulty Eval-Test — circle-explorer (2026-06-20)

Archetype: multi-step-solver. Lever = operation/step depth, pinned per tier via `resolveProblemShape` (code-enforced sub-variant flags). Scaffold withdrawal via `resolveSupportStructure` (`showFormulaReveal`, hint style, instruction formula-naming). Grade 7, π ≈ 3.14, whole-number bands. Verdict: **PASS**.

## Results

| Mode | Lever | Easy | Hard | Scaffold flip (reveal/hint) | Magnitude band | Leak | Null no-op |
|------|-------|------|------|------------------------------|----------------|------|------------|
| circumference | code-enforced | given=**diameter** (1-op, C=πd) | given=**radius** (2-op, 2πr) | True→False; formula instr/hint → generic + conceptual | r∈[7,11.5] easy, r∈[2,15] hard — both in [2,15]/d[4,24] | none | baseline mixes diameter+radius ✓ |
| area | code-enforced | given=**radius** (square directly) | given=**diameter** (3-op: halve→square→×π) | True→False; "Area=πr²" → "Picture circle re-cut into a rectangle" | r∈[2,12] both tiers | none | baseline mixes given ✓ |
| reverse | code-enforced | revGiven=**circumference** (1 inverse, ÷2π) | revGiven=**area** (2 inverse, ÷π then √) | True→False; formula hint → "Work the area relationship backward" | r∈[3,15] both tiers | none (see below) | baseline mixes C+A ✓ |
| composite | code-enforced (3 rungs) | **semicircle_area** (1 op) | **circle_in_square** (s²−πr²) | True→(med True)→False | r∈[2,12]/even side both | none | baseline mixes all 3 shapes ✓ |
| discover_pi | none (n/a) | shape unchanged, ans≡3.14 | shape unchanged, ans≡3.14 | True→False; "find how many" → "estimate how many"; hint → conceptual | diameter 2r∈[6,20] both | none | n/a (no in-mode lever, by design) |

medium tested on composite: confirms the full 3-rung ladder (semicircle_area → semicircle_perimeter → circle_in_square). circumference/area/reverse have only 2 variants so medium==hard — **saturated-honest**, matches the brief.

### Assertion detail
1. **Scaffold withdrawal (MUST flip):** `showFormulaReveal` True at easy/medium → False at hard in every mode. Easy instruction appends "Use C = π × d" etc.; hard instruction stays generic. Easy hint states the formula; hard hint is a conceptual nudge (no formula, no operation). Flips exactly as `resolveSupportStructure` declares.
2. **Structural lever moves:** Each code-enforced mode pins the deeper-chain sub-variant easy→hard exactly as `resolveProblemShape` specifies, with 100% of a tier's challenges on the forced variant (not a mix). composite shows the full 3-step ladder. discover_pi correctly leaves shape unchanged (lever=none).
3. **Magnitude invariance:** value bands identical across tiers (no inflation, no scope-ceiling breach). Easy radii were not smaller-on-purpose vs hard — bands overlap within the declared whole-number range. The radius-sort is a within-tier display order, not the difficulty axis.
4. **No answer leak:** reverse stores `radius` = the answer, but the component (CircleExplorer.tsx L530-534) renders ONLY the given C or A (`givenValue`); the radius is drawn as a faint "?" line and never labeled. Tutor policy (L159) forbids revealing the answer at hard. No leak at any tier.
5. **Null-tier no-op:** baseline (no &difficulty) returns the byte-identical no-tier path: rotated variants (≥1 of each), `supportTier=None`, `showFormulaReveal` unset, formula-bearing hints/instructions. Not already-hard.

## Issues

None (no CRITICAL/HIGH).
