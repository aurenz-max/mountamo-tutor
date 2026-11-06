# circuit-workbench: `electromagnet` (2026-11-02)

The tenth circuit-workbench mode, a build (β 2.2). The generator is code-only, so it made no Gemini calls ($0).

**Curriculum home:** none in the published K-4 science curriculum (electromagnets appear only in the G8 docs). The catalog tags it Grades 3-4. The nearest homes are G3 `SCI001-05-b` (forces at a distance) and G4 `SCI001-04-c` (electrical energy). The manifest places it only where a lesson fits; the mode needs a curriculum home before the adaptive engine routes much to it.

## What the child does
- **The bench:** a battery and a switch are wired to a coil of copper wire wrapped round a core. The core hangs from a crane over a tray of paper clips.
- **Building:** the child taps the core to add a wrap and taps the switch. The panel also has buttons for adding or taking off a wrap, flipping the switch, the spare battery, choosing a core, and dipping. Tapping the clip tray dips the core in and lifts it out.
- **What the dip shows:** the lifted clips hang from the tip. Switching off drops them.
- **The check:** "I'm done!" appears after the first dip. It judges the build as it is, including the switch.

The clip count is a teaching model, not a measurement:
- On a steel core, every two wraps lift one clip on one battery, and a second battery doubles that.
- With the switch off or no wraps, it lifts nothing.
- A wooden or aluminium core never lifts a whole clip.

| Tier | Task |
|---|---|
| easy | Lift at least 1-2 clips, starting from a bare steel nail with the switch off. |
| medium | Lift exactly 2-5 clips on one battery. It starts with some wraps already on, lifting too few on some items and too many on others. |
| hard | Lift exactly 6-10 clips, which one battery cannot do. It starts on a wooden pencil or aluminium rod, with a spare battery and a tray of cores. |

Misses: `no_coil`, `switch_off`, `not_iron_core`, `too_few_clips`, `too_many_clips`.

Levers:
- `strength_meter` (marks): a bar beside the crane, with no numbers, that fills as the magnet gets stronger.
- `one_step_less` (easier): a medium item goes to an at-least-2 item from a bare nail; a hard item goes to an exact 3 on steel with one battery. Easy has no easier item.

The guess is spoken: "Will it pick up any clips? Tell your tutor."

## Files
- New: `electroModel.ts` (with its test) and `electro3d.ts`, which draws the bench into the workbench scene.
- Wired into `circuitModel`, `circuit3d`, `CircuitScene`, `CircuitWorkbench`, `circuitWorkspace` (`electroScene`), `circuitLevers`, the card and boss, the catalog and the generator (3 items, or 1 in a mixed session).

**The card is full:** its guidance is back under the 4,000-character cap only after shortening every mode's "moves" line. Most of the guidance is shared boilerplate, so the next mode needs either a higher cap or a shorter card format.

## Verification
- `typecheck:lumina` 0; full tsc 770 (baseline).
- Physics vitest 331/331; `test:primitive circuit-workbench` 735/735.
- The mounted test covers: off lifts nothing, too many clips, switched off at "I'm done!", then correct.
- Browser drive (`circuit-workbench-drive-2026-10-31/drive-electro.mjs`, Grade 4, medium): 32/32, no page errors. Item 1 used 3D taps on the switch, the core and the clip tray.
- Fixed during the drive: the crane ran off the top of the frame and the hanging clips were too small to count. I shortened the crane and enlarged the clips.

## Not covered
- Easy and hard in the browser: the tester has no difficulty setting. The spare battery and the core tray (hard) have not been seen on screen.
- A pinned `/eval-test` run.
- A Live sample.
