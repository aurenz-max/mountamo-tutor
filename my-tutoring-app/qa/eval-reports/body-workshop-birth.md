# Birth Certificate — body-workshop (2026-11-05)

**Lifecycle layer: L0 (born).** Biology, **2D** (user 11-05: 3D raises control difficulty), **K-5** (user 11-05: not middle school). Pattern of `machine-workshop`: an author agent names a real animal's path; code checks it.

- **Core task:** `deliver_oxygen`, β 0.2, `manipulate`. One row: where the animal lives → body parts the learner taps in, in order → the goal. Breathe sends a breath along the row (air or water turns into oxygen in the blood); it stops, with a reason, where a part cannot take what reached it. Breathe is free; "I'm done!" commits. Tap a part in the row to take it out; Try again keeps the row.
- **K-5 calibration (code-owned, structural, never vocabulary):**
  - Goal by grade: K-3 `into_body` (1-3 parts: nose → windpipe → lungs; mouth → gills; wet skin); 4-5 `to_muscle` (+ heart + blood tubes, up to 5 parts; NGSS 4-LS1-1).
  - Tier (`config.difficulty`; default easy for K-1, medium from grade 2): easy = person, dog, bird, fish; medium adds whale (sea, breathes air), frog (lungs or wet skin), tadpole (gills); hard adds grasshopper (breathing holes + air tubes, no blood step) and earthworm (skin). Medium and hard always include one animal the tier adds. The bench grows 6 → 8 → 11 parts (+2 at grades 4-5).
  - Words: kid names (windpipe, blood tubes, breathing holes, air tubes); the author check rejects alveoli, trachea, spiracle, capillary, diffusion, respiration and similar.
  - Instruction for K-1: "Help the frog breathe! Build the path the breath takes into its body."
- **Model** (`bodyModel.ts`, pure): flow table `FLOW` (13 parts, 8 tokens), `traceBuild`, `judgeBuild`. **Atlas** (`bodyAtlas.ts`): 9 animals with real paths per goal, `owns`, and `notFor` reasons ("A grasshopper has a heart, but its blood does not carry oxygen").
- **Author agent** (`service/biology/body-author.ts`, gemini-flash-latest): gets the lesson and the tier's animal *names*; returns per animal the path, a job per part, an intro and a principle. Checks: flow, atlas fidelity, the intro names no breathing part (it would give the path away), K-5 words. One repair turn with the errors; atlas words as fallback; the tier contrast is enforced in code.
- **Generator:** agent + code (machine-workshop's shape). Code owns goal, tier and bench (the same shuffled bench for every animal in a session, so it never shows which animal needs what).
- **Workspace binding:** `bodyWorkspace.ts` + `bodyWorkshop.card.ts` + `bodyWorkshop.boss.ts` (bespoke `defineBoss`, activity-judged, no key). Misses: `food_path`, `no_way_in`, `wrong_breather`, `no_pump`, `stops_short`, `not_this_animal`, `skips_a_part`, `blocked`; all `unanswered` (no levers yet). `boss-card.mjs` prints clean. The harness `play` drives the real bench (clear row → part taps → I'm done!), so J1 runs.
- **Answer-leak audit:**
  - The start node shows the habitat (land, sea, pond, soil, sky), never air or water: a whale lives in the sea but breathes air.
  - The bench is the same for every animal in the session.
  - The part guide says what a part looks like, never what it does; jobs and the principle appear only once the path works.
  - The intro is code-checked for breathing-part words. Feedback says where the breath stopped and why, never which part to use (tested).
  - The scene facts carry habitat, bench looks, the row and tries; never the medium or the path.
- **Design gate:** manipulation pass (tap parts into the row, tap to remove); simulation pass (the breath runs the flow table along the row); production pass (some animals have several real paths: frog lungs or skin, person nose or mouth); timer none; layout leak pass (above).
- **Pip:** framework (boss), workspace region; bench buttons carry `data-pip-object="part-*"` for the harness.
- **Checks:** `typecheck:lumina` 0. `test:primitive body-workshop` 755 + 6 pass (workspace contract, dry journey, plan, misses, Pip surface). Own tests and boss.test 232 pass: model/atlas (every real path flows, is the animal's and fits its tier's bench; misses named; no message names a part to use), author (6), workspace (4). W1 payload saved (grade 4, medium): whale, fish, person, all 3 from the agent's first answer, no repairs.
- **Gemini:** 1 agent call for the payload; automated spend was $4.95 of the $5 cap before it.
- **Not done:** browser check (row and bench layout, tracer timing); `/eval-test` (spend cap); `/curriculum-fit`; Live sample. No read-aloud button: on the workspace the tutor reads the instruction and labels (card guidance).

## Follow-up queue

| # | Skill | Layer | Input from this birth |
|---|---|---|---|
| 0 | user browser check | — | Biology tester → Body Workshop (K-5). Try grade K and grade 4, tiers easy and hard. Watch whether a K child gets the row-in-order idea and whether the tracer speed is right (480 ms per part). |
| 1 ✓ | `/add-support-tiers` (DONE 11-05: `body-workshop-levers-2026-11-05.md`) | L3 | Levers: `trace_breath` (slow, labelled tracer showing what each part turns air or water into: answers `wrong_breather`, `no_way_in`), `show_habitat` (the animal at the surface or underwater: answers `wrong_breather` for whale and frog), `x_ray_animal` (outline of the animal with its real parts lit, no order: answers `not_this_animal`, `skips_a_part`), `one_step_less` (first part placed, bench without food parts: answers `food_path`, `stops_short`). |
| 2 | `/add-eval-modes` | L1 | `fuel_the_body` (mouth → stomach → intestines → blood → muscle; cow, bird gizzard), `sense_and_respond` (stimulus → sense organ → nerve → brain → muscle; K-2 can stop at the sense organ), `plant_transport` (roots → stem → leaf; leaf sugar → roots), `breathe_out` (carbon dioxide the other way, grade 5). Each adds tokens to `FLOW` and paths to the atlas; the author and checks carry over. |
| 3 | `/eval-test body-workshop` + `/curriculum-fit body-workshop` | QA / home | Homes to check: K-LS1-1, 1-LS1-1, 3-LS4-3, 4-LS1-1. Run when spend allows. |
| 4 | `/add-sound` | L5 | Whoosh on Breathe, bubbles for water, a heartbeat through the heart, a soft stop on a break. |
| ✓ | `/eval-test` | QA | After each layer. |
