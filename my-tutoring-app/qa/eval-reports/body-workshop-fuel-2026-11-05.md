# body-workshop: `fuel_the_body` — 2026-11-05 (L1, mode 2)

Second eval mode on the same row, check and author agent. Food instead of a breath: the row starts at what the animal eats ("grass") and the **Eat** button sends it along.

| Mode | β | What the learner builds |
|---|---|---|
| `deliver_oxygen` | 0.2 | air or water → into the blood (K-3) / to a muscle (4-5) |
| `fuel_the_body` | 0.4 | food → mouth → mashed or ground → intestines → blood (K-3) / heart, blood tubes, muscle (4-5) |

## What changed

- **Model** (`bodyModel.ts`): tokens `outside_food → food → mush → blood_food → pumped_food → food_at_muscle`; parts `crop`, `gizzard`, `four_stomach`; heart and blood tubes carry oxygen or food. Misses for food: `breath_part`, `not_mashed` (food sent to the intestines in big pieces), plus the shared `no_way_in`, `no_pump`, `stops_short`, `not_this_animal`, `skips_a_part`, `blocked`. The miss lists live on the card.
- **Atlas** (`bodyAtlas.ts`): `FOOD_JOBS` + `jobOf(animal, task)`. Easy: person, dog, fish (one plain stomach). Medium adds frog (swallows whole), bird (no teeth: crop holds seeds, gizzard grinds them with stones) and cow (four-part stomach; a new animal, food only). Hard adds earthworm (crop + gizzard, eats soil). Paths: 3-4 parts into the blood, 5-6 to a muscle.
- **Bench** (food): mouth, stomach, intestines + breathing distractors (nose, windpipe, lungs); medium adds crop, gizzard, four-part stomach; hard adds gills, wet skin; 4-5 adds heart, blood tubes.
- **Levers:** `how_it_eats` (clue: "A bird has no teeth. It swallows hard seeds whole, and it swallows tiny stones too."), `no_breath_parts` (layout; easy starts with it on), and the shared `animal_fact`, `count_parts`, `show_flow`, `easier_animal`. `show_flow` now answers only the path-break misses. `easier_animal` is not offered for a plain-stomach animal (every easy animal shares that path, so any practice animal would be the answer).
- **Generator:** `resolveEvalModes` (pin → no call; intent → one or both; failure → mixed). Mixed = 2 + 1 of the two modes, interleaved. Author agent and checks take the task.
- **Catalog, backend prior (0.4), card (two modes), metrics, tester** (reads `evalModes`).

## Verified

- `typecheck:lumina` 0. `test:primitive body-workshop` 760 + 11 pass. Own + boss tests 255 pass, including:
  - every real path in both tasks flows, is the animal's and fits its tier's bench;
  - the food misses named (`breath_part`, `not_mashed`, `stops_short` "still inside the belly", `no_pump`, cow and bird `not_this_animal`);
  - every clue in both tasks never names a path part;
  - every miss of each mode has a lever, with a miss → lever table;
  - mixed sessions validate and interleave;
  - mounted: a cow's row starts at "grass", Eat stops at the intestines with "still in big pieces", a plain stomach fails as not a real cow, and the four-part stomach passes.
- W1 payload `body-workshop.fuel_the_body.json` (grade 4, medium): person, bird, cow, all 3 from the agent's first answer.
- Gemini: 1 agent call; automated spend $4.95 of $5.

## Findings

- The agent's principles are correct but generic ("Food is mashed up and enters the blood") and the cow's skips its four rooms. A prompt line asking for what is special about this animal's path would fix it; it needs a paid run to verify, so it is queued, not shipped.
- Not verified: the browser (Eat button, food start node, crop/gizzard/four-part pictures); `/eval-test` per mode; the tutor replay.
