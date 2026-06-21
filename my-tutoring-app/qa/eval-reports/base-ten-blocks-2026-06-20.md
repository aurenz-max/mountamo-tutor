# Structural-Difficulty Eval-Test — base-ten-blocks (2026-06-20)

Primitive: `base-ten-blocks` (generator `gemini-base-ten-blocks.ts`)
Sweep: Step-2c support-tier difficulty (baseline / easy / hard), live dev server.
Archetype: manipulative-quantity. Brief: codeEnforceable=yes.

Two axes both code-enforced in post-process:
- AXIS 1 scaffold (`resolveSupportStructure`): `showColumnCounts` + `showBlocksTotal` display flags.
- AXIS 2 structural (`resolveProblemShape` + constructive builders): zero-gap count (build/read), carry/borrow count (operate). `regroup` has no lever (scaffolding-only).

## Results

| Mode | Lever (brief) | Easy → Hard observed | Scaffold flip (cc/tot) | Magnitude in band | Leak | Null no-op | Verdict |
|---|---|---|---|---|---|---|---|
| build_number | interior-zero count (code) | intZeros 0 → 2 (1234/3567… → 6002/5004/6005/7007) | T/T → F/F | all 4-digit (1000–9999) | none | yes | PASS |
| subtract (operate) | borrow count (code) | 1 borrow → 2 borrows + **cross-zero** (452−127 → 600−115, 903−586) | T/T → F/F | all 3-digit (100–999) | none | yes | PASS |
| add (operate) | carry count (code) | 1 carry → 2 carries (156+237 → 287+115=402, 504+398=902) | T/T → F/F | all 3-digit, sums ≤999 | none | yes | PASS |
| regroup | none (scaffold-only) | shape UNCHANGED (single-trade targets both tiers) | T/T → F/F | 2-3 band both | none | yes | PASS |

Evidence detail:
- **build_number** (grade 5 → places=4): easy targets all interior-zero=0 (1234,3567,2415,4628,5346); hard all interior-zero=2 (6002,5004,6005,6005,7007). Full 0→2 ladder shows at 4-digit. Baseline: no supportTier, no scaffold flags (defaults), magnitude band identical.
- **subtract**: easy subtract challenges 1 borrow, crossZero=False; hard 2 borrows with crossZero=True (600−115 borrows through the zero tens; 903−586). M>S strict, no borrow out of top, all 3-digit.
- **add**: easy 1 carry; hard 2 carries (504+398=902, no carry out of top). In the same mixed batch the build_number/read_blocks siblings also moved (easy 148/373 zeros=0 → hard 907/204 zeros=1), confirming per-challenge OWN-type resolution.
- **read_blocks** (appears in mixed batches): `showColumnCounts`/`showBlocksTotal` correctly stay **False/False at every tier** — the contractual leak guard (BT-2) holds; the tier only changes the zero-gap shape, never exposes the counts.
- **regroup**: targets are plain single-trade numbers at both tiers (easy 12/12/120/110, hard 100/30/110/20/110); no zero-gap/regroup-count injected — correct for `hasLever=false`. Scaffolds still withdraw.

Note: the `subtract_with_blocks` / `add_with_blocks` eval modes generated mixed challenge types (build/read/regroup alongside the named op) rather than pinning to a single type. This is eval-mode/manifest resolution behavior, not a tier defect — each challenge's lever and scaffold resolve correctly from its own type. Not flagged.

## Issues

None. No CRITICAL or HIGH findings. All 5 assertions pass across all 4 modes: scaffold withdrawal flips code-set, structural lever moves easy→hard (code-enforced exactly for zero-gap and carry/borrow count; `regroup` correctly unchanged), magnitude stays in band, no answer leak at any tier (read_blocks scaffolds stay off; operate diff/sum computed not shown), baseline is a clean default (no supportTier).
