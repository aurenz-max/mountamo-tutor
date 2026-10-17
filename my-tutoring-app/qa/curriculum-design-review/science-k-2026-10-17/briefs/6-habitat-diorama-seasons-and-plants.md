# habitat-diorama: seasons and plant needs

> **Status 2026-10-17:** built as modes of `ecosystem-diorama` (a 3D island tank) instead of the remedy below: `plant_needs`, `season_behavior`. See `qa/eval-reports/ecosystem-diorama-birth.md`. Fixing bar-model's hardcoded "Morning vs Afternoon" stays a defect fix.

Curriculum IDs: SCI002-02-E, SCI002-02-B (SCIENCE, grade K). Source: design review science-k-2026-10-17.

## Learning goal and gap

Kindergarten scientists (SCIENCE, unit SCI002 Life Sciences, skill SCI002-02 Living Things and Their Needs) learn what plants and animals need, and how they change what they do when the season changes.

- **SCI002-02-E:** "Explain how seasonal and weather changes affect plant and animal behavior using examples"
- **SCI002-02-B:** "Identify the three basic needs (food, water, shelter) of plants and animals through sorting activities"

What exists now:
- **habitat-diorama `build_habitat`** already serves the animal half of SCI002-02-B well. The probe drew a penguin, squirrel, deer and frog.
  - The child builds a habitat with food, water and shelter for a named animal.
  - Code checks the needs, and the needs are not named on screen.
  - It has no plants and no season.
- **No primitive has a season state.** Hibernation, migration and leaf-fall appear only in model-written text: media-player, knowledge-check, and di-spoken-practice explain_concept (which gave good why-questions in the probe).

**Recommendation:** two modes in habitat-diorama, which already draws a living scene and checks needs in code:
- **Plant needs** in the habitat build: a plant needs sunlight, water, air and soil. A pot in a dark cupboard is a misconception item.
- **Season change:** the same scene in summer and then in winter. The child shows what each animal or plant does (the bear goes to its den, birds leave, leaves fall, the squirrel stores nuts) and says why.

## Essential behavior

- **Plants:** the child gives a plant what it needs. Animal-only pieces (a den, meat) are wrong for a plant.
- **Seasons:** after the scene changes to winter, the child moves or chooses each organism's winter behavior, then answers one "why" (too cold, no food).
- **No early answer:** the winter scene starts with every animal still in its summer place, so the answer is not visible before the child acts.

## Worked example

- **Plant: a sunflower.**
  - Success: sun, water, soil.
  - Misconception: a den and berries ("it needs a home and food like animals").
- **Season: winter comes.**
  - Success: the bear goes to the den. "There is no food, so it sleeps."
  - Misconception: "The bear goes swimming."

## Evidence of success

- **Independent evidence:** for a fresh plant, meets its needs; for a fresh animal, chooses the right winter behavior and gives a reason about cold or food.
- **Should not earn credit:** a behavior chosen because its picture repeats the animal. Tracker MP-LL1 shows this in media-player.
- **Uncertain cases:** animals that change little in winter (deer). Decide whether "stays and finds food" is an option.

## Constraints and open questions

- Keep the existing build_habitat animal behaviour and the food-web modes unchanged (contract-first).
- Seasonal behaviour depends on climate. Pick familiar temperate examples and say so.

## Handoff

Read the current guidance (/add-eval-modes, the habitat-diorama contract, habitatBuild.ts) and choose the scene, response forms and scoring. Build and verify with your own process.
