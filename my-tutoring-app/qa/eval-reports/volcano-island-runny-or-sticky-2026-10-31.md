# volcano-island `runny_or_sticky` (2026-10-31, `/add-eval-modes`, SB-7)

**Mode:** a 3D island with a volcano mountain and a village. The learner guesses what each test magma will do (never
graded) and it erupts: runny magma flows far in lava rivers; thick, gassy magma explodes with an ash cloud; thick magma
with little gas piles into a dome. Then the learner calls what a new volcano's magma will do, from what it is like
(runny or thick, how much gas), and presses Check; a right check erupts it. β 1.2, scaffoldingMode 2, answer `tap`.

Eight real volcanoes (`magmaModel.ts`): Kīlauea, Mauna Loa, Fagradalsfjall (runny); Mount St. Helens, Pinatubo,
Vesuvius (thick, gassy); Soufrière Hills, Lassen Peak (thick, little gas).

| Tier | Tests and calls |
|---|---|
| easy | a runny and a thick-gassy test; the new magma is like one of them in both thickness and gas |
| medium | the same two kinds; the new magma only of the same kind (a gassy runny magma still flows) |
| hard | one of each of the three kinds; three calls including the dome |

**Misses:** `missed_thickness`, `missed_gas`. **Levers:** `magma_tags` (legend: a syrup drip or peanut-butter lump
and one or three bubbles beside every magma) and `one_step_less` (Kīlauea and St. Helens, then Mauna Loa). The kitchen
levers are scoped to `kitchen_volcano`. Generator resolves modes from intent (mixed = 2 + 2).

**3D:** `buildIsland` in `volcano3d.ts`: sea, island, cone with crater, five houses; lava rivers revealed down the
slopes; an ash cloud of puffs (first drive: it rose out of frame, now it billows in view); a growing lava dome.
`VolcanoScene` switches between the kitchen table and the island.

**Verification:** `magmaModel.test.ts` 6; mounted test (tests erupt on the island, a thickness miss is named, Try again,
the right call erupts the new volcano); `test:primitive volcano-island` 726/726; `typecheck:lumina` 0; full tsc 770.
Browser Grade 4 medium `drive-magma.mjs` 24/24 (screenshots `volcano-island-drive-2026-10-31/magma-g4/`). $0 Gemini.
Hard (the dome) checked in vitest only.
