# marble-run-park levers (2026-11-04, `/add-support-tiers`, SB-11)

**Evidence:** no real-learner runs yet. The misses are the ones `loopMiss` observes (synthetic: the birth drive hit
`top_height_only` and `not_lowest`). The misconception "a start level with the top of the loop is high enough" is
documented in the catalog and the birth report.

| Miss | Lever | Type | What the screen does | Leak rule |
|---|---|---|---|---|
| `too_low` | `loop_top_line` | marks | Dashed line level with the loop's top, across to the ramp | Marks no peg; the working pegs are well above it |
| `top_height_only` (and `too_low` once the line is drawn) | `xray` | marks | Energy bar, no numbers: blue height, orange speed, grey rubbed away. All blue on the peg; follows the run | No "needed" mark, so it never shows the threshold |
| `not_lowest` | `peg_results` | marks | Green/red ring on each peg the learner ran from; notebook sorted by peg | Only tested pegs get a ring |
| all | `one_step_less` | easier | A different loop size: lowest becomes any; carpet comes off (lowest stays) | Different loop, never the learner's pegs; none on an "any" item |

Offer rules: the bar needs the marble on a peg, the rings need a run. Easy items start with the line drawn
(`startLevers`), which is not counted as a pull. The card's `unanswered` list is gone, and the card is set to `levers: true`.

**Model change:** `runFrom` now records `motion` (height above the table and speed) per frame, so the bar reads the
model's real speed. The first version estimated speed from the marble's centre between frames. That read too slow on
curves and zero on the last frame, so the bar showed everything "rubbed away" at the bell.

**Checks:**
- `marbleLevers.test.ts`: 6 tests. They cover the miss→lever table, offer rules and the practice item over every tier and seed. They also check that the energy parts never exceed the start, that the grey part only grows, and that the marble is mostly speed at the bell. A final test checks that no lever text names a peg.
- Workspace tests: 2 new, for the pulls on screen and the facts, practice, and the easy start position.
- Marble tests: 22/22.
- `test:primitive marble-run-park` passes. `boss.test.ts` 211/211. `typecheck:lumina` 0.
- Browser drive `marble-run-park-drive-2026-11-03/drive-levers.mjs` passes 8/8 at medium. Screenshots are in `levers/`.

**Not checked:** the carpet item in a browser (the tester has no tier control); a tutor replay or Live run (user-run;
levers are stock types on the shared boss path, so no Live sample is owed). Gemini spend: $0.
