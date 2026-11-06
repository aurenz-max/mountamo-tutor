# Birth Certificate — marble-run-park (2026-11-03)

**Lifecycle layer: L0 (born).** W4 of the science build roadmap (`qa/science-build/ROADMAP.md`).

- **Core task:** `make_the_loop`, β 1.8. The learner taps a start peg on the ramp, says aloud whether the marble will make the loop (never graded), taps the marble, watches, runs as often as needed, then presses "I'm done!" with the marble on a peg.
- **Model:** `marbleModel.ts`. The marble rolls along a side-on track (ramp, flat, optional carpet, loop, bell). It is a rolling ball (factor 1.4) with rolling friction. If the track would have to pull to keep the marble on, it leaves the track and flies. The outcome is `made_it`, `fell`, `rolled_back` or `stopped`. Frictionless, a start at about 2.7 loop radii is the least that makes it round. `marble3d.ts` plays back the model's frames and decides nothing.
- **Generator:** Fork C (code-only), `service/physics/marble-run-park-generator.ts`, 3 items per session.
  - easy: any peg that makes the loop.
  - medium: the lowest peg that makes it, with at least one peg as high as the loop's top that still fails.
  - hard: the same, with carpet before the loop.
  - `loopFair` requires at least 2 failing and 2 working pegs, with every peg above the first working one also working.
- **Workspace binding:** `marbleWorkspace.ts`, `marbleRunPark.card.ts` and `marbleRunPark.boss.ts` (bespoke `defineBoss`; the answer type is `manipulate`, judged by the activity). No key reaches the tutor.
  - Misses: `too_low`, `top_height_only`, `not_lowest`. All three are `unanswered` until levers are built.
  - Scene facts: pegs, where the loop's top sits beside them ("level with peg 4"), the peg the marble is on, and every run.
- **Answer-leak audit:** no label, line or readout marks the loop's top height or the working peg. Peg numbers and heights are only what is drawn. The scene facts never say which peg works.
- **Design gate:**
  - Manipulation: pass. The child taps the 3D peg and the marble; the chips are a fallback.
  - Simulation: pass. The model runs the marble.
  - Production: pass. The child runs experiments and chooses.
  - Timer: none.
  - Layout leak: pass.
- **Curriculum homes (published K-4):**
  - G4: `SCI001-03-a/b/c` (height to energy), `SCI001-01-a/b/c` (speed and energy).
  - K: `SCI001-01-E` (ramps).
  - `SCI001-02-a/b/c` (collisions) waits for `knock_it_over`. `/curriculum-fit` has not been run yet.
- **Pip:** framework, on the boss. The workspace region only; Pip never points at a peg.
- **Checks:**
  - `typecheck:lumina` 0.
  - `test:primitive marble-run-park` passes (730 + 6), including the J1 baseline entry (by design: WebGL).
  - `marbleModel.test.ts` 11/11. `boss.test.ts` and the band test pass.
  - Browser drive 29/29 at medium (`marble-run-park-drive-2026-11-03/`): 3D taps on pegs and marble, notebook rows, a `top_height_only` miss, Try again keeps the runs, `not_lowest`, the lowest peg credited, 3 items, finale.
  - `/eval-test` 6/6 (easy, medium, hard ×2). Gemini spend: $0.
- **Not checked:** the carpet (hard) has not been seen in the browser, because the tester has no tier control. No Live sample has been run.

## Follow-up queue

| # | Skill | Layer | Input from this birth |
|---|---|---|---|
| 1 | `/add-eval-modes` | L1 | `roll_it` (K, β -0.8: how far it rolls from a height, K `SCI001-01-C/E`); `bumpy_or_smooth` (K/G3 friction, `SCI001-01-D`, `G3 SCI001-02-c`); `knock_it_over` (G4 collisions: height and marble mass vs how far the block slides, `SCI001-02-a/b/c`); `jump_the_gap` (β 2.2, height sets launch speed); `chain_reaction` (open build, K `SCI001-01-H`, β 2.5). The track model already handles flight, so a jump only needs a lip and a landing ramp. |
| 3 | `/add-support-tiers` | L3 | Levers for the three misses: `xray` (an energy bar: height becoming speed, shown at the loop's top); `loop_top_line` (a dashed line level with the loop's top, answers `top_height_only`); `notebook_sorted` (runs ordered by peg, answers `not_lowest`); `one_step_less` (easy goal: any working peg). |
| 5 | `/add-sound` | L5 | Rolling hum scaled to speed, bell ding on `made_it`, a clack when it falls. |
| ✓ | `/eval-test` | QA | After each layer. |
