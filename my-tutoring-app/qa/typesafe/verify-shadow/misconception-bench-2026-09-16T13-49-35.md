# TypeSafe verify-and-gate bench — misconception loop

TypeSafe jev-latest · distiller/planner = production Gemini flash · 2026-09-16

## A. Distiller abstain gate — 48 labeled packets (30 generative, 18 abstain)

| arm | accuracy | generative recall | abstain recall | ms |
|---|---|---|---|---|
| live distiller (abstain / text) | 98% | 97% | 100% | 10992 |
| TypeSafe Noul "one consistent wrong rule" ≥ 0.5 | 98% | 97% | 100% | 293 |

Mean P(rule): generative packets 0.82 · abstain packets 0.15. Arms agree on 100%; when they agree the verdict is right 98%.

Gate view — of the distiller's 29 GENERATIVE verdicts (the ones that would reach a student), keep the top X% by score; share that are truly generative:

| gate score | keep 50% | 70% | 80% | 90% | 100% |
|---|---|---|---|---|---|
| distiller confidence (high>medium>low) | 100% | 100% | 100% | 100% | 100% |
| TypeSafe P(rule) | 100% | 100% | 100% | 100% | 100% |
| TypeSafe strength score | 100% | 100% | 100% | 100% | 100% |
### Production verifier (LUMINA_TYPESAFE_VERIFY=shadow)

Server-side `supported` + `leaks` ran on 29 written hypotheses: gate mode would reject 0, of which 0 carry a generative label (a wrong rejection). Mean 317 ms added per written hypothesis.


### Disagreements

| id | label | distiller | TypeSafe P(rule) / strength | note |
|---|---|---|---|---|
