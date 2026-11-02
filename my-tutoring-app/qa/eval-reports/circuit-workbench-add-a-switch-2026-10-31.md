# circuit-workbench `add_a_switch` (2026-10-31, `/add-eval-modes`, SB-6)

**Mode:** a battery, a bulb and a switch (two clips, a lever) on the table. The learner guesses (never graded), wires
clip to clip as in light_it, flips the switch to test, and presses I'm done!. Code judges: on lights the bulb, off
leaves it dark, nothing shorted either way. β 1.8, scaffoldingMode 2, answer `build`.

| Tier | Start |
|---|---|
| easy | the loop runs through the switch but for one wire |
| medium | a working loop with no switch: open it and put the switch in |
| hard | the switch wired beside the bulb: on while the switch is off, a short when it is on |

**Model:** `Clip` gained `sw.left`/`sw.right`; `evaluate` takes `switchClosed` (a closed switch joins its clips).
`switchModel.ts` holds starts, check, words. **Misses:** `no_loop`, `switch_does_nothing`, `switch_backwards`,
`switch_shorts` (unanswered until levers). **3D:** a blue base with a metal lever hinged on its left clip that drops
onto the right clip when on.

**Verification:** `switchModel.test.ts` 5; mounted test (a loop that misses the battery is a named miss, Try again
keeps the wires, in-loop switch passes with on lit and off dark); `test:primitive circuit-workbench` 724/724;
`typecheck:lumina` 0; full tsc 770. Browser Grade 4 medium `drive-switch.mjs` 20/20 (screenshots
`circuit-workbench-drive-2026-10-31/switch-g4/`). $0 Gemini. Hard tier checked in vitest only.
