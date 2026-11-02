# volcano-island `save_the_village` (2026-10-31, `/add-eval-modes`, SB-7)

**Mode (open build):** under the 3D island, a 9 by 9 map of the volcano's slope (crater top middle, village on the
shore, darker grey squares higher). The learner taps squares to place or remove rock walls (up to the item's limit),
presses "Erupt to test" (the island erupts, the lava floods the map square by square), and presses I'm done! when the
lava misses the village. β 2.5, scaffoldingMode 3, answer `build`. Home: 4-ESS3-2 (reduce the impact of a natural
hazard).

**Model** (`villageModel.ts`): lava from the crater always moves into the lowest neighbouring square no higher than
the lava beside it, never into a wall, until the eruption's volume is used. Maps are random slopes with ridges; an item
is kept only when the lava reaches the village with no walls and the fewest walls that save it (searched over the
squares the lava reaches) is the tier's number:

| Tier | Walls needed | Walls allowed |
|---|---|---|
| easy | 1 | 2 |
| medium | 2 | 2 |
| hard | 3 | 3 |

Generation of 4 items per tier takes about 0.15 s. **Misses:** `walls_off_path`, `lava_went_around`. **Levers:**
`lava_trail` (marks: after a test, the last lava stays drawn faintly on the map) and `one_step_less` (a map one wall
saves).

**Verification:** `villageModel.test.ts` 5 (every tier generates, exact walls needed, lava never enters a wall, the
validator, the scene names no square a wall should go on, levers); mounted test (no walls is a named miss; the
fewest walls pass); `test:primitive volcano-island` 728/728 (one run reported FAILED with every test passing; the rerun
passed, not reproduced); `typecheck:lumina` 0; full tsc 770. Browser Grade 4 medium `drive-village.mjs` 14/14 (walls
from a port of the lava rule on the generated maps). First screenshots: brown high ground was close to the lava's
orange; the ground is now green to grey. $0 Gemini.
