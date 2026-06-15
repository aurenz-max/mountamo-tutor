# Eval-Test — Support-Tier Difficulty Sweep: multiplication-explorer

- Date: 2026-06-14
- Skill step: eval-test Step 2c (support-tier sweep)
- Topic: "Multiplication facts" · Grade: grade 3
- Dev server: http://localhost:3000 · all 13 calls HTTP 200, n=5 challenges each (0 errors)
- Scope: QA only — no code changed, EVAL_TRACKER untouched.

## Verdict: PASS (no CRITICAL, no HIGH)

## Levers (ground truth)
`showOptions.{showProduct, showCommutativeFlip, showFactFamily, showDistributiveBreakdown}`
+ representation set (`repSet` all/core/minimal, withdrawn easy→hard) + hint depth.
Leak guard (generator line 605): `showProduct = wantProduct && !anyProductHidden` — forces the
product readout OFF whenever ANY challenge in the set hides the product. `equalGroups`+`array`
hardcoded `true` on every rep-shrink (lines 621-622). Component consumes `showOptions.showProduct`
for the big fact header (line 900) and per-rep readouts (lines 814, 833).

## Sweep data (n=5 each)

| mode / tier | tier stamp | showProduct | flip | factFam | distrib | reps | hiddenValues | fact |
|---|---|---|---|---|---|---|---|---|
| build (baseline) | undefined | true | true | true | false | all 5 | product×5 | 2×5=10 |
| build easy | easy | false | false | false | false | all 5 | product×5 | 2×5=10 |
| build hard | hard | false | false | false | false | groups+array | product×5 | 5×2=10 |
| connect easy | easy | true | false | false | false | all 5 | null×5 | 4×3=12 |
| connect hard | hard | false | false | false | false | groups+array | null×5 | 4×6=24 |
| commutative easy | easy | false | true | false | false | all 5 | null,product,null,product,factor2 | 4×6=24 |
| commutative hard | hard | false | false | false | false | groups+array | mixed (incl product) | 6×4=24 |
| distributive easy | easy | false | false | false | true | groups+array+repAdd+area | product×5 | 8×7=56 |
| distributive hard | hard | false | false | false | false | groups+array | product×5 | 8×7=56 |
| missing_factor easy | easy | true | false | true | false | all 5 | factor1/factor2 | 4×6=24 |
| missing_factor hard | hard | false | false | false | false | groups+array | factor1/factor2 | 4×6=24 |
| fluency easy | easy | false | false | false | false | all 5 | product×5 | 6×7=42 |
| fluency hard | hard | false | false | false | false | groups+array | product×5 | 6×7=42 |

## Assertions

1. **Scaffold flips (easy more on, hard fewer)** — PASS. connect (prod true→false), commutative
   (flip true→false), distributive (distrib true→false), missing_factor (prod+factFam true→false)
   all flip. build/fluency carry the lever in reps+hint (showProduct correctly pinned off both tiers).

2. **Structural lever moves (rep/scaffold-count shrink)** — PASS. Every mode shrinks reps 5→2
   (all→groups+array) easy→hard; scaffold buttons withdraw on connect/commutative/distributive/
   missing_factor.

3. **Magnitude invariance** — PASS. All factors single-digit, within grade-3 band (≤12 / products
   ≤144). No tier→bigger-factor coupling: distributive/missing_factor/fluency keep the SAME fact
   across tiers; build keeps 2×5↔5×2; commutative keeps 4×6↔6×4. connect drew different facts per
   call (4×3 vs 4×6) but both in-scope — not a tier-driven escalation. Nothing past scope.

4. **No answer leak (KEY)** — PASS / guard holds. At every set containing `hiddenValue==='product'`
   (build, distributive, fluency, BOTH commutative tiers) `showProduct=false`. Notably
   commutative_easy: the mode's own preference is showProduct=true, but the LLM hid product on some
   challenges and `anyProductHidden` forced the readout OFF — guard fired exactly as designed.
   Legitimate showProduct=true only where product is NOT asked: connect_easy (hv all null),
   missing_factor_easy (product given, factor asked). equalGroups+array survive at EVERY tier
   (incl. all hard tiers) — never all-withdrawn.

5. **Null-tier no-op** — PASS. Baseline `supportTier=undefined`, showOptions at generator defaults
   (prod=true, flip=true, factFam=true, distrib=false), all 5 reps. Tier-apply block correctly skipped.

## Observation (not a sweep failure — latent, pre-existing)
The leak guard lives INSIDE `if (supportTier)`. The null-tier baseline (build, no difficulty) ships
`showProduct=true` while all 5 challenges hide the product — the big fact header would render
`2 × 5 = 10` (the asked answer). Tiered sessions are safe; only the untiered default path is exposed.
Out of scope for this sweep (do-not-fix) — flagged for the generator's default-showOptions/leak logic.
