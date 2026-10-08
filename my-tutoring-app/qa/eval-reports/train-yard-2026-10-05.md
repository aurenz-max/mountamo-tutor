# Eval Report: train-yard — 2026-10-05

Live generations through `/api/lumina/eval-test` (mode `build_train`), dev server on :3000.

## Results
| Run | Lesson | Band | Status | Jobs (cargo form) | Issues |
|-----|--------|------|--------|-------------------|--------|
| g3 | Passenger trains and freight trains, grade 3 | 3-5 | PASS | commuters, grain, lumber, heating oil | — |
| g1 | same lesson, grade 1 | K-2 | FAIL → fixed | grain, milk, lumber, packages | no passenger job in a passenger+freight lesson |
| g1b | same lesson, grade 1, after fix | K-2 | PASS | commuters, grain, milk, lumber | — |
| food | How food gets to the grocery store, grade 4 | 3-5 | PASS | grain, milk, canned food, tractors | — |
| payload | save_payload (journey row topic), grade 3 | 3-5 | PASS | commuters, grain, milk, lumber | — |

## G1-G5 Sync Check
- G1 required fields: every challenge carries id, type, title, instruction, cargo, cargoForm, amount, unit, from, to, hillName, grade, distanceKm (all set in code by `buildTrainYardChallenge`). PASS.
- G2 flat-field reconstruction: N/A (one top-level array of flat string objects; numbers are code-built). PASS.
- G3: N/A at birth (one mode).
- G4 answer derivability: the key (car kind, fewest cars, fewest engines) is computed from the challenge by `trainYardModel` — the same functions the component's check and the workspace use. K-2 loads are whole cars (300/100, 900/90, 560/80, 420/70); 3-5 loads round up. PASS.
- G5 fallbacks: the only fallback is the 4-story set when fewer than 3 stories validate; not hit in 5 live runs. Story stories still pass through the numeric builder. PASS.

## Finding fixed
- **g1: passenger job dropped.** The model wrote 6 jobs in 6 forms and selection kept the first 4 distinct forms, dropping the people job written fifth. `selectJobs` now always ships a people job the model wrote (the prompt asks for one only when the lesson involves riders). Pinned in `gemini-train-yard.test.ts`.

## Notes (not defects)
- Place names are sometimes lowercase common nouns ("suburb station to city terminal"); readable, left as is.
- People and new-car jobs almost always need one engine (light loads); the engine decision lives in freight jobs.

## L1 eval modes (2026-10-05, /add-eval-modes)

Ladder: `match_car` β −1.5 → `enough_cars` β −0.5 → `enough_pull` β 0.3 → `build_train` β 0.8 (catalog = backend registry). Gemini still writes only stories; `assignTasks` gives each job a task (one task: every job; mixed: one of each, easiest first) and `yardConsist` fills in the part of the train each task gives (match_car: the count and engines for the chosen kind; enough_cars: the engines; enough_pull: the fewest loaded cars).

| Run | Mode | Grade | Status | Keys (cars/engines) |
|-----|------|-------|--------|---------------------|
| 1 | match_car | 1 | PASS | grain 4/1, commuters 5/1, lumber 8/2, oil 10/1 |
| 2 | match_car | 4 | PASS | 21/1, 17/1, 19/2, 7/1 |
| 3 | enough_cars | 1 | PASS | 9, 10, 10, 5 cars (whole loads) |
| 4 | enough_cars | 4 | PASS | 20, 13, 7, 22 cars (round up) |
| 5 | enough_pull | 1 | FAIL → fixed → PASS | after fix: 2, 2, 2, 2 engines |
| 6 | enough_pull | 4 | FAIL → fixed → PASS | after fix: 2, 2, 3, 2 engines |
| 7 | mixed | 1 | PASS | match_car, enough_cars, enough_pull, build_train |
| 8 | mixed | 3 | PASS | same order |

**Finding fixed (enough_pull):** 4 of 8 jobs needed 1 engine (the passenger job always, and short freight trains, which cannot need 2 engines on any hill up to 3%), so the first click solved them. `buildTrainYardChallenge` now redraws the car count until some hill needs the target engines, the engines task targets at least 2, and an engines-only session drops light trains (people, vehicles) when 3 or more freight jobs exist. Pinned in `gemini-train-yard.test.ts` (10 generations, every job ≥ 2 engines).

Leak audit for the new tasks: match_car hides each car's capacity (with the load and the coupled count on screen it would turn the match into division) and offers every kind; enough_cars shows only the given kind; enough_pull shows the coupled cars and the rule of the rails. No instruction names a car kind (test). W1 payloads saved per mode; workspace contract 21/21 and dry journeys 5/5 (correct and wrong builds through the yard buttons) pass.

Notes: K-2 enough_pull jobs land on a 3.0% hill (the only hill on which K-2 train sizes need 2 engines). Not done: a browser look at the three new yard layouts.
