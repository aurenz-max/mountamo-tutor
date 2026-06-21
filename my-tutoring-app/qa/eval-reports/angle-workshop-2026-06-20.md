# Structural-Difficulty Eval Sweep — angle-workshop (2026-06-20)

Primitive: `angle-workshop` (`gemini-angle-workshop.ts`) · archetype: multi-step-solver
Method: Step-2c support-tier difficulty sweep (baseline / easy / hard) per mode via live eval-test.
Topic/grade: grade 7-8 angle topics (wide band). All challenge configs built in CODE with back-solved answers + `recomputeExpected` guard → levers code-enforced.

## Results

| Mode | Lever (easy → hard) | Scaffold flip | Magnitude in band | Answer leak | Null-tier no-op | Verdict |
|------|--------------------|---------------|-------------------|-------------|-----------------|---------|
| solve_algebraic | unit_collect (a1=a2=1) → both_sides (vertical, a1≠a2) | eqShown true→false, relation withheld | x 4-12, coeff 1-3 every tier | none | baseline mixed configs, no tier | PASS |
| solve_unknown | {vertical,comp,supp} 0-1 op → all around_point (x=360−k1−k2, 2 ops) | named true→false, hint formula→concept | knowns 10-150 every tier | none | baseline all 4 configs | PASS |
| transversal | all parallel direct-equality (x=given, 1 step) → all exterior_angle (x=g1+g2) | relation named→withheld, formula→concept | given 30-140 every tier | none | baseline 3 shapes mixed | PASS |
| measure | band 15-60 acute → near-90 cluster {80,85,95,100} | showReadingCue true→false | within 15-165 protractor cap every tier | none (angle never printed) | baseline 95-150, cue undefined | PASS |

## Evidence (observed values)

- **solve_algebraic** — easy: 4× `a1=a2=1`, `eqShown=true`, x∈{7,8,10}; hard: 4× `vertical a1≠a2` (1/3, 2/3, 3/2), `eqShown=false`, generic "Decide how the angles are related…", x∈{4,11,12}. Baseline: mixed (vertical + 2/3, 3/3 coeffs), no supportTier, no eq.
- **solve_unknown** — easy: vertical/complementary/supplementary, named + formula hint, x∈{25,55,70,80}; hard: 4× around_point, generic instruction, x∈{110,150,160}. Baseline: one of each config.
- **transversal** — easy: 5× parallel_transversal (corresponding/alternate, x=given), relation named; hard: 5× exterior_angle, "Find the exterior angle x", x∈{85,100,105,115}. Baseline: triangle_sum + parallel + exterior mixed.
- **measure** — easy: {20,35,40,60} cue=true; hard: {80,85,95,100} cue=false. Answer (`angleMeasure`) absent from instruction/narration/hint/title at every tier.

## Issues

None (no CRITICAL/HIGH). All four code-enforced levers move exactly as declared, scaffolds withdraw at hard, magnitudes stay in band, no answer leak, baselines match the byte-identical no-tier default.

Notes (informational, not defects):
- `measure` hard band (80-100) is numerically slightly larger than easy (15-60), but both stay inside the 15-165 on-protractor cap — the lever is scale-confusion near the 90° crossover, not magnitude inflation past scope. Within the brief's intent.
- `solve_unknown` medium and hard both resolve to `around_point` (depth saturates at 2 subtractions — the true chained two-step has no distinct renderable figure). Documented in-generator as saturated-honest; easy→hard signal is still clean.
