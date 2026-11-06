# Birth Certificate — wave-tank (2026-11-04)

**Lifecycle layer: L0 (born), with L3 levers built in the same push.** W6 of the science-build roadmap (SB-13). The paddle has two settings: push size (amplitude) and push speed (frequency). Code works out the wavelength (wave speed / frequency) and the energy, (size × speed)², so the learner sees the relationships instead of reading them.

- **Core task:** `knock_it_down` (β 2.2, `manipulate`). The first wave leaves a block tower standing. The learner changes ONE setting so the next wave knocks the tower down, and the code judges the result.
  - easy: one step up on either setting is enough.
  - medium: one step is not enough on either setting.
  - hard: the push size is stuck, so only pushing faster works, and one step faster is not enough.
- **Generator:** Fork C, code only (`service/physics/wave-tank-generator.ts`), with no model call. Three items per session. Starting settings differ within a session and items vary between seeds.
- **Pure model:** `waveModel.ts`, 12 vitest tests. It covers wavelength, wave speed, energy, item fairness per tier and the four misses.
- **Workspace binding:** `waveWorkspace.ts`, `waveTank.card.ts` and `waveTank.boss.ts` on a bespoke `defineBoss`, the same as marble-run-park.
  - Response is a gesture, and no key reaches the tutor.
  - Misses: `no_change`, `changed_both`, `weaker`, `too_small`.
  - The card is printed by `boss-card.mjs`. `boss.test.ts` passes.
  - `/review-live-wiring` was not run separately. The world has one mode; run it before W6 closes.
- **Levers** (`waveLevers.ts`), each answering a miss:
  - `crest_marks`: on-water brackets for crest height and crest spacing, in grid squares.
  - `xray`: an energy bar at the beach with a "tower falls" notch.
  - `changes_marked`: rings round the first wave's settings, plus a "Changed" column in the notebook.
  - `one_step_less`: an easier tower, ungraded.
  - Easy starts with `changes_marked` drawn.
- **Answer-leak audit:**
  - The tower's need is never drawn, never said and never in the scene.
  - The scene facts carry settings, crest words and outcomes only.
  - The tower's wobble and the energy bar are feedback from waves the learner has already sent. They never name a setting.
  - The locked size knobs on hard are the item's structure ("the stop is stuck"), not the answer.
- **Design gate:**
  - Manipulation: pass. The learner taps the 3D knobs and the paddle; panel chips are only a fallback.
  - Simulation: pass. The water, paddle, cork and tower all play back the model.
  - Production: pass. The learner chooses settings and tests them; there is no multiple choice.
  - Timer: pass. There is none.
  - Layout leak: pass, per the audit above.
- **Curriculum home (published G4 SCIENCE, looked up 11-04):**
  - Core: `SCI002-02-a` (amplitude ↔ energy) and `SCI002-02-c` (predicting energy from amplitude and wavelength).
  - The ladder serves `SCI002-01-a/b/c` and `SCI002-05-a/b`.
  - `/curriculum-fit` has not been run: it is an embedding call and the homes were confirmed by direct lookup.
- **Pip:** framework on the boss (`PipDock` + `PipWorkspace`). `WorkspacePip.surface.test.tsx` passes.

## Verification

- `npm run test:primitive -- wave-tank`: 740/740 passed, including the workspace contract, the dry journey sweep (J1 is by-design for WebGL) and `WaveTank.workspace.test.tsx` (5 tests).
- `typecheck:lumina`: 0 errors.
- Browser drive (`wave-tank-drive-2026-11-04/drive-knock.mjs`, headless Chromium, medium): **33/33**.
  - On item 1, every action is a 3D tap.
  - The first wave plays and leaves the tower up.
  - A too-small change is answered as a named miss.
  - Try again keeps the waves.
  - Changing both settings is answered as not a fair test.
  - Pushing faster knocks the tower down and is credited.
  - All three items advance, the finale shows, and there are no page errors.
- The screenshots show the relationship. Size 3 at speed 2 gives tall crests far apart (`wave1-mid-small.png`). Size 2 at speed 5 gives short crests close together (`wave1-mid-speed5.png`).
- `/eval-test` pinned to `knock_it_down`: 6/6 pass (easy, medium and hard, two runs each).
- Fixed during the drive: React strict mode's mount-cleanup cancelled the auto-played first wave's timer and left the tank "moving". The end timer is now an effect keyed on the wave.
- Spend: $0. The generator makes no model call.

## Follow-up queue

| # | Skill | Layer | Input from this birth |
|---|-------|-------|----------------------|
| 1 | `/add-eval-modes` | L1 | Roadmap W6: `match_the_wave` (0.5, SCI002-01-c: set both controls to match a drawn wave); `cork_ride` (0.8, energy not water); `faster_closer` (1.5, SCI002-01-b / 05-b: measure crest spacing before and after); `which_wave_wins` (2.8, SCI002-02-c / 05-a: two paddles, claim backed by measured height and spacing); `protect_the_beach` (3.0, open build, breakwaters). An amplitude-only rung for SCI002-01-a fits under `match_the_wave` easy |
| 3 | `/add-support-tiers` | L3 | Built. If W5 or a second W6 mode needs `replay` (slow-motion crest), promote it to a stock lever per the roadmap rule |
| 5 | `/add-sound` | L5 | Paddle splash per push (pitch from speed), tower crash, knob click |
| ✓ | `/eval-test wave-tank` | QA | Rerun per new mode |
| — | user | real-student | Browser check (the tester → Physics → Wave Tank (3D)); one Live sample on `knock_it_down` (does the tutor ask the guess aloud, and pull `crest_marks` / `xray` on `too_small`) |
