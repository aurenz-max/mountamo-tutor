# circuit-workbench levers (2026-10-31, `/add-support-tiers`, SB-6)

**Levers** (`circuitLevers.ts`, one `leverSet` on the boss; the card's `unanswered` lists are gone, `levers: true`):

| Lever | Type | What the screen does | Answers |
|---|---|---|---|
| `xray` | marks | glowing charge dots on every wire electricity can reach from the + end (`reachedFromPlus`): moving round a closed loop, racing through a short, standing still where the path stops | every miss but `wrong_part_named` |
| `one_step_less` | easier | the same task one step simpler, ungraded (`~easier`): one wire already right; a visible loose wire; 2 tests + 1 call; the loop through the switch but for one wire; one of the two bulb paths wired | all; none when the item is already that simple |

x-ray is offered once the battery is in. Easy items start with it drawn (`startLevers`). Practice items carry no
levers and the full item comes back with a fresh table (`endPractice`).

**Verification:** `circuitLevers.test.ts` 4 (reach stops at the gap and burnt bulbs; x-ray first for every miss but
wrong_part_named; every easier item valid, same mode, no easier of its own; easy starts with x-ray); mounted test
(no x-ray before the guess, x-ray races on a short, easier item is practice with one wire); `test:primitive
circuit-workbench` 726/726; `typecheck:lumina` 0; full tsc 770. Browser K medium `drive-levers.mjs` 4/4 (screenshots
`circuit-workbench-drive-2026-10-31/levers-k/`: dots on the shorting wire with the battery glowing; dots round the
lit loop; practice table with one wire). Two drive-script bugs fixed (the open bench covered the guess chips; the
Practice label is uppercase). $0 Gemini.

**Next:** `/review-live-wiring circuit-workbench` passes on the lever item by `boss.test.ts`; one user Live sample
on the shared boss path when convenient (levers are stock types, so not owed).
