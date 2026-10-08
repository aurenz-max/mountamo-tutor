# Contract: train-yard

- **Derived:** 2026-10-06 · evidence: birth certificate and eval report `qa/eval-reports/train-yard-birth.md`, `train-yard-2026-10-05.md`, levers report `train-yard-levers-2026-10-06.md`
- **Component:** `primitives/visual-primitives/engineering/TrainYard.tsx` · **Model:** `trainYardModel.ts` · **Levers:** `trainYardLevers.ts` · **Generator:** `service/engineering/gemini-train-yard.ts`
- **Status:** ACTIVE (L0 born, L1 four modes, L3 levers)

## Consumers

| Consumer | Channel | Evidence |
|---|---|---|
| Grade 1 SCI005-02-d / SCI005-01-c (engineering-machines K-2 homes) | curriculum retrieval MATCH | birth certificate |
| Four eval modes match_car → enough_cars → enough_pull → build_train | catalog `engineering.ts` | L1 eval report |
| Teaching workspace (tutor + JEV) | `trainYardWorkspace.ts` scene | `TrainYard.workspace.test.tsx` |
| Support levers (`config.difficulty` start position) | `trainYardLevers.ts` | `TrainYard.levers.workspace.test.tsx` |

## Requirements

### R1 — numbers are code-built; one model file for run, key and check
- **Property:** amount, grade and distance come from `buildTrainYardChallenge`; the component's run, the check (`trainYardMiss`) and the generator read `trainYardModel.ts`.
- **Probe:** `gemini-train-yard.test.ts`, `trainYardModel.test.ts`.

### R2 — the screen never shows the key before a run
- **Property:** car cards say how a car is built, never what it carries; match_car hides capacity; the train weight and the pull the hill needs show only after a run (except the `train_weight` lever, below); no instruction names a car kind or count; no default consist.
- **Probe:** `TrainYard.workspace.test.tsx`; instruction test in `gemini-train-yard.test.ts`.

### R3 — lever leak rules (`/add-support-tiers`)
- `cargo_picture`: draws only the cargo; its words share none with any car card (`trainYardLevers.test.ts`).
- `model_match`: a different cargo form and a different car from the item's.
- `car_tally`: labels only the learner's coupled cars, per kind, never past their count.
- `train_weight`: weight only (engines, cars, whole load). **Never the pull the hill needs or a verdict** — a live needed-vs-given gauge turns green at exactly the answer and is not allowed.
- `worked_hill`: a train whose grade, weight and engine count differ from the item's.
- **Probe:** `__tests__/trainYardLevers.test.ts`.

### R4 — simplify stays in the mode and is ungraded
- **Property:** a simpler job has the same task, a different cargo form, whole-car loads, and its own id `<id>~simpler`; it records no result, and only the full job's answer is credited, with the lever on the attempt.
- **Mode floors:** match_car keeps choosing among cars (two, in yard order); enough_cars keeps counting cars; enough_pull keeps choosing engines (exactly 2 on a whole-number hill); build_train keeps the whole build.
- **Probe:** `TrainYard.levers.workspace.test.tsx`; journey row rebuilds `~simpler` jobs with `simplerJob`.

### R5 — tier is a starting position, not assistance
- **Property:** `supportTier: 'easy'` starts the self-checking help pulled (match_car picture; enough_cars tally; enough_pull weight; build_train tally + weight). The attempt records no lever for a starting position; the tier never changes numbers or tasks.
- **Probe:** `TrainYard.levers.workspace.test.tsx` "easy starts…".
