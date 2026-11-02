# circuit-workbench `build_device` (2026-10-31, `/add-eval-modes`, SB-6)

**Mode (open build):** a tray of parts (a bulb, a motor with a fan, a buzzer, a switch). The learner takes the parts
the device needs, wires them, flips any switch to test, and presses I'm done!. Code judges: every part the device
needs is on the table and nothing else; nothing is shorted; every needed part runs with the switch on; with a switch,
everything stops when it is off. β 2.5, scaffoldingMode 3, answer `build`.

| Tier | Devices |
|---|---|
| easy | a fan (motor) or a reading light (bulb), no switch |
| medium | a night light, a doorbell, a fan with a switch |
| hard | a lighthouse or a burglar alarm: a bulb and a buzzer on one switch |

**Model:** `BulbColor` became a general load (`red`, `blue`, `motor`, `buzzer`; `isBulb`); `bulbName` says "the bulb",
"the motor", "the buzzer". 3D: a motor on a post with a fan facing the viewer that spins while on, a buzzer that shakes
while on, up to three load slots. The status line says lit / spinning / buzzing. **Misses:** `missing_part`,
`extra_part`, `short_circuit`, `not_working`, `switch_does_nothing`. Levers: `xray` (now also answers `not_working`)
and `one_step_less` (a fan, one motor, no switch).

**Verification:** `deviceModel.test.ts` 4; mounted test (a doorbell without a switch is a named miss; the switch in the
loop passes: buzzer off, then on); the earlier circuit tests still pass after the load change;
`test:primitive circuit-workbench` 731/731; `typecheck:lumina` 0; full tsc 770. Browser Grade 2 medium
`drive-device.mjs` 16/16 (night light, fan with a switch, doorbell). From the screenshots: the fan was edge-on to
the camera; it now faces the viewer, raised on a post so the blades clear the base. $0 Gemini. Hard (two loads) in
vitest only.
