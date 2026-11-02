# circuit-workbench `two_bulbs` (2026-10-31, `/add-eval-modes`, SB-6, G4)

**Mode:** a red and a blue bulb. The learner guesses, wires both bulbs in a row (one path) or side by side (each its
own path) as asked, may take either bulb out of its holder to test, and presses I'm done!. Code judges the wiring:
both lit, and removing one puts the other out (row) or leaves it on (side by side). β 3.2, scaffoldingMode 3.

| Tier | Item |
|---|---|
| easy | in a row, the first wire on |
| medium | side by side, nothing (or one wire) on |
| hard | already wired the other way and lit: rewire it |

**Model:** `evaluate` now returns `dim` (lit bulbs every path to which runs through another bulb); the 3D glow is
dimmer for them, and a taken-out bulb's glass is hidden. **Misses:** `not_both_lit`, `made_a_row`,
`made_side_by_side`, `short_circuit` (unanswered until levers). Words: "in a row" / "side by side", never series or
parallel on screen.

**Verification:** `twoBulbModel.test.ts` 5; mounted test (a row when asked side by side is a named miss, taking the
red bulb out puts both out, side by side passes with blue on alone); `test:primitive circuit-workbench` 725/725;
`typecheck:lumina` 0; full tsc 770. Browser Grade 4 medium `drive-two.mjs` 20/20 (side by side; red out leaves blue
on). $0 Gemini. Easy and hard (in a row, dim) checked in vitest only.
