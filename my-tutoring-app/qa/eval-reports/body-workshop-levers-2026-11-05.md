# body-workshop levers — 2026-11-05 (L3)

Mode `deliver_oxygen` (the only mode). Code: `bodyLevers.ts` (`BODY_LEVERS`, one lever set on `bodyWorkshop.boss.ts`), drawn in `BodyWorkshop.tsx`; card `levers: true`, no unanswered misses.

## Failure inventory

Evidence: **no real-learner or Live evidence yet** (born today). Every miss is observed by code (`judgeBuild`) on scripted builds; the reasons behind them are inferred.

| Miss (what the check sees) | Class | Likely reason |
|---|---|---|
| `wrong_breather`: gills given air, lungs/nose given water | synthetic | habitat read as medium (a whale lives in the sea, so gills) |
| `not_this_animal`: flows, but a part this animal lacks | synthetic | builds the human path for every animal |
| `food_path`: stomach or intestines in the path | synthetic | breath and food confused (K) |
| `skips_a_part`: real parts, one left out | synthetic | nose straight to lungs |
| `stops_short`: ends before the goal | synthetic | stops at the lungs at grades 4-5 |
| `no_way_in`: an inside part first | synthetic | starts at the lungs |
| `no_pump`: oxygen in the blood, no heart | synthetic | blood moves on its own |
| `blocked`: any other break | synthetic | — |

## Lever table

| Lever | Kind / type | Answers | Carrier | Leak rule (code) |
|---|---|---|---|---|
| `where_it_breathes` | help / clue | wrong_breather | shown (air or water picture on the habitat) + voiced sentence | the sentence names no part of the item's real path (`answersOf`, tested over all 18 animal × goal items) |
| `animal_fact` | help / clue | not_this_animal | voiced + text under the animal | says only what the animal does NOT have; same check |
| `no_food_parts` | help / layout | food_path | shown | removes only the stomach and intestines, the same for every animal |
| `count_parts` | help / marks | skips_a_part, stops_short | shown (empty slots) | how many parts, never which (nearest real path's length) |
| `show_flow` | help / legend | no_way_in, wrong_breather, no_pump, stops_short, blocked, food_path | shown (pictures: air, water, blood, food) | every part shows its in → out alike, none marked |
| `easier_animal` | simplify / easier | not_this_animal, skips_a_part, stops_short, blocked | shown | a familiar animal ≠ the item's, none of its real paths is the item's (`practiceLeaks`), smaller bench; ungraded; the full animal comes back |

Dropped from the birth list: **x_ray_animal** (lighting the animal's real parts is the answer for 1-3 part paths); `animal_fact` covers that miss instead. `one_step_less`'s "first part placed" was dropped for the same reason; its food half is `no_food_parts`.

**Starting positions** (`config.difficulty`): easy starts with `no_food_parts` (drawn, listed as on screen, never recorded as help); medium and hard start with none.

## Verified

- `bodyLevers.test.ts` (10): leak rules on every animal × goal; a practice animal exists for all 18 items, is solvable from its own bench, never repeats the item's path; every miss has a lever; `it.each` miss → lever table; a pulled lever passes to the next.
- `BodyWorkshop.levers.workspace.test.tsx` (4, mounted runtime): a pull changes the screen and the fact in one commit and is recorded on the next attempt; a refused or repeated pull changes nothing; easy's starting lever is not recorded; the practice animal is ungraded and the full animal is credited after it with the lever recorded.
- `test:primitive body-workshop` 759 + 6 pass; `boss.test` and earlier own tests 232 pass; `typecheck:lumina` 0.
- Tutor-replay moments recorded (free): `qa/tutor-reports/body-workshop-moments-2026-11-05.json` (start, miss, stuck, lever, credit).
- Gemini: none.

## Not verified

- **Browser:** the flow pictures on bench buttons (size at phone width), the slots of `count_parts`.
- **Tutor replay (paid, yours):** does the tutor pull a lever itself at `stuck`, and does it describe the change only after the receipt?
  `cd backend/tests/tutor_live && ../../venv/Scripts/python tutor_replay.py "../../../my-tutoring-app/qa/tutor-reports/body-workshop-moments-2026-11-05.json" --primitive body-workshop --samples 5` (5 moments × 5 samples = 25 requests).
- `docs/contracts/body-workshop.md` not written (one consumer so far); `/primitive-contract` when a second mode or skill uses it.
