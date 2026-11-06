# Science Build — roadmap and queue (2026-10-29)

**User 10-29:** the user's son is into sink or float, electricity and volcanoes. Make science build mode the
next frontier: very interactive, the child builds something real across many experiments, and the tutor shows
what is happening.

## Where we start

| Have | Missing |
|---|---|
| 3D diorama pattern, proven 3 times (airplane, construction site, ecosystem tank): shell + R3F scene + `x3d.ts` builder + pure `xModel.ts` + workspace + card/boss | Any primitive for **sink/float, circuits, magnets, volcanoes, rocks, weather**. `science.ts` is empty; `circuit-builder` is a comment in `physics.ts:199` |
| Open build layer: "I'm done!", flash-lite watcher, code judge for computable builds, vision judge for looks (`open-builder`) | A science build where the **world runs the build** (the boat floats or sinks, the bulb lights, the lava reaches the village) |
| Science builds already shipped: tower-stacker (wind), lever-lab, gear-train, habitat, food-web, molecule | An experiment loop: predict → build → test → record → explain, with two designs compared (science-K brief 4) |
| PRD specs: `k5-physics-primitives-prd.md` §5.1 Magnet Explorer, §5.2 Circuit Sandbox, §6 Floating & Sinking; `PRD_FUNDAMENTAL_PHYSICS.md` §5.1 Sink or Float Lab | Tutor tools that **demonstrate**: slow motion, X-ray of the hidden cause, replay, side-by-side |
| Science-K briefs 3 (make-it-go devices) and 5 (everyday mixes), unbuilt | Shared 3D kit: only `makeSkyEnvironment` is shared today |

## Design rules for every world

1. **One world, many modes.** Each topic is one 3D lab with 5-7 eval modes, not 5 primitives (user 10-17,
   ecosystem diorama).
2. **The child creates; the world reacts; code judges.** Physics in a pure model decides what happens (floats,
   lights, erupts). Code grades computable outcomes; vision only for "does it look like a boat". Never a
   multiple-choice question about a picture the child could have played with.
3. **Every build starts from a prediction.** "Will it float?" before the drop; the prediction is recorded and
   compared to the result. Wrong predictions are the teaching moment, not a miss. **User 11-01:** the child says the
   prediction to the tutor ("will this float or sink?", "good guess, try it"); there are no guess buttons, and a
   guess is never graded.
8. **Act in the world, not on buttons (user 11-01).** The child taps the thing in the 3D scene and then where it goes
   (tap the wrench, tap the water). A panel button stays only as a fallback. Each question on screen is worded as a
   question and appears when it is the next thing asked ("Which test helped you know?" after the float/sink call).
9. **Long experiments run once (user 11-01).** A build-and-compare mode (two boats) is one item per session, not three.
4. **The hidden cause is drawable.** Each world has an X-ray layer the tutor can turn on: push-up arrows and
   displaced water; glowing charge flowing round the loop; the magma chamber and pressure. This is the
   "demonstrate what's happening" lever.
5. **Content is code-owned** (Fork C generators): object libraries with real densities, part libraries with
   real conduction, magma recipes with real viscosity. The generator writes words and picks the challenge from
   difficulty and seed.
6. **One variable at a time** in test modes (ecosystem lesson: a rich world still needs fair tests).
7. **Lab notebook.** Every test writes a row (what I built, what I predicted, what happened). Rows are scene
   facts for `workHistory`, so the tutor teaches from the child's own results.

## Tutor: boss framework only, no custom scripting (user 10-29)

Every world is wired to the tutor the way ecosystem-diorama and tower-stacker are, and nothing else:

- **`<world>.card.ts`** (`defineCard`): every mode with `answer` (`build` / `tap` / `manipulate`),
  `judge: 'activity'`, `flow: 'one-at-a-time'`, its `misses`, and `moves` in plain words. Catalog entry uses
  `...bossEntry(card)`.
- **`<world>.boss.ts`** (`defineBoss`, or `tapBoss` for the tap-only modes): `validate`, `items`, `ask`,
  `bossAssignment(id, task, null)` (no key reaches the tutor: the world's model judges), `drive`, `levers`.
- **Levers via `bossLevers.ts` stock types.** The demonstration tools below are levers on the boss, so the
  tutor pulls them from the miss it sees, the same as every other family.
- **What the tutor knows comes from scene facts:** the prediction, the build, what happened, the notebook rows
  (`workHistory`). The tutor teaches from those; it never gets a world-specific prompt.
- **Not allowed:** a catalog `tutoring` block, hand-written Pip calls, per-world prompt text or coaching
  doctrine, a world-specific live adapter. Pip pointing goes through `/add-pip-surface`, not tutor code.
- **Guards:** `boss.test.ts` (card ↔ boss ↔ catalog, lever specs, ratchets) and `/review-live-wiring <world>`
  before each world closes.

### Demonstration levers

| Lever | Stock type | What the screen does | Example |
|---|---|---|---|
| `xray` | `marks` | Draws the hidden cause on what is already on screen | Weight-down and water-push-up arrows sized to scale; charge dots round the loop; pressure in the magma chamber |
| `side_by_side` | `layout` | Puts the child's last two builds next to each other and runs both | Clay ball sinks, clay bowl of the same clay floats |
| `solved_boat` | `model` | A different, solved build beside this one | A wide foil tray holding 10 pennies |
| `one_step_less` | `easier` | The same task, one step simpler, ungraded | One battery, one bulb, one wire already clipped |
| `replay` | `custom` (why: no stock type replays the learner's last test slowed down) | Replays the last test at 1/4 speed, stopping on the key moment | The boat taking on water at the rim |

If W2 or W3 also needs `replay`, promote it to a stock type in `bossLevers.ts` once (a framework change: run the
full live-activity suite and ask the user for one Live sample on the shared path) instead of three `custom`
copies. A lever's `does` never names the answer: `xray` shows the forces, the child decides float or sink.

## The worlds

### W1 Sink-or-Float Harbor (pilot) — `buoyancy-harbor`

A 3D harbor with a glass test tank (reuse the ecosystem tank glass and water). Grades K-5.

| Mode | The child... | Judge | β (proposed) |
|---|---|---|---|
| `drop_test` | predicts, then drops everyday objects (apple, key, cork, crayon, pumpkin, coin) | code: density < water | -1.0 |
| `find_the_rule` | sorts tested objects and picks what floaters share (material, not size: a big log floats, a small nail sinks) | code | 0.5 |
| `make_it_float` | reshapes a clay ball that sinks into something that floats (shape only; the rung below build_boat) | code: hull volume vs mass | 1.0 |
| `build_boat` | **open build:** builds a boat from foil, sticks, cups, tape that holds the most pennies; loads it one at a time until it sinks | physics: displaced volume, tipping | 2.0 |
| `cargo_two_designs` | builds two boats, predicts which holds more, tests both, records, explains with evidence (science-K brief 4) | code compares results to the claim | 2.5 |
| `salt_water` (G3-5) | predicts if an egg floats in fresh vs salt water, adds salt until it floats | code: fluid density | 3.0 |

X-ray: water level rise + scaled up/down arrows. Standards: 2-PS1-1, 2-PS1-2, K-2-ETS1-3, 5-PS1-3.
Why first: smallest physics, every outcome computable, water and glass already exist in the ecosystem tank, works
from K.

### W2 Circuit Workbench — `circuit-workbench`

A 3D tabletop: battery packs, wires with clips, bulbs, buzzer, motor with a fan blade, switch, test materials.
Grades K-5 (K = closed loop only, per science-K brief 3; series/parallel from G4).

| Mode | The child... | Judge | β |
|---|---|---|---|
| `light_it` | connects battery, wires and bulb so it lights | code: graph has a closed loop through the bulb | -0.5 |
| `find_the_break` | a device does not work; finds and fixes the gap, the dead battery, the loose clip | code | 0.5 |
| `conductor_test` | puts a spoon, eraser, foil, string, coin, pencil lead into the loop and records which light it | code: material table | 1.0 |
| `add_a_switch` | wires a switch so it turns the light on and off | code: loop open/closed by switch state | 1.8 |
| `build_device` | **open build:** makes a thing that works (a fan, a doorbell, a lighthouse, a night light with a switch) | code checks the loop and the parts; vision for "looks like a lighthouse" | 2.5 |
| `two_bulbs` (G4) | puts two bulbs in a row and side by side, predicts brightness, removes one bulb | code: series vs parallel current | 3.2 |

X-ray: glowing charge dots flowing around the closed loop, stopping at a gap. Standards: K SCI001-03-H,
4-PS3-2, 4-PS3-4. Later mode or sister world: magnets (3-PS2-3/4) and an electromagnet build (coil + battery
picks up paper clips) that bridges the two.

### W3 Volcano Island — `volcano-island`

A 3D island with a cutaway volcano and a village. Grades K-5.

| Mode | The child... | Judge | β |
|---|---|---|---|
| `kitchen_volcano` | mixes baking soda and vinegar in a clay volcano, changes ONE amount, predicts which erupts higher | code: reaction model | -0.5 |
| `inside_the_volcano` | finds the magma chamber, vent, crater, lava on the cutaway (X-ray) | code | 0.0 |
| `runny_or_sticky` | chooses magma (runny basalt vs sticky with gas) and predicts flow vs explosion, then erupts it | code: viscosity model | 1.2 |
| `layers_over_time` | erupts several times and watches layers build the mountain; reads which layer is oldest | code | 2.0 |
| `save_the_village` | **open build:** places walls, channels and barriers so lava misses the village; erupts to test | physics: lava flow sim on a height grid | 2.5 |
| `cool_the_rock` (G4-5) | cools lava fast (in the sea) or slow (underground) and matches the rock it makes | code | 3.0 |

X-ray: cutaway with pressure rising in the chamber. Standards: 2-ESS1-1, 2-ESS2-1, 4-ESS2-2, 4-ESS3-2, K mixes
(brief 5 overlaps `kitchen_volcano`).

### W4 Marble Run Park — `marble-run-park` (user 11-03)

A 3D marble run on a table: a ramp with 8 numbered start pegs, a flat run (carpet on hard), a loop-the-loop, a bell.
A track model (rolling ball, friction, leaves the track when the track would have to pull) runs the marble; the
scene plays back its frames. Curriculum homes (published K-4): G4 `SCI001-01-a/b/c` (speed and energy), `-02-a/b/c`
(collisions), `-03-a/b/c` (height and energy); K `SCI001-01-C/D/E/H` (pushes, surfaces, ramps, chain reactions); G3
`SCI001-02-a/b/c` (unbalanced forces, friction).

| Mode | The child... | Judge | β |
|---|---|---|---|
| `make_the_loop` | runs the marble from pegs and finds a start (or the lowest start) that makes the loop: level with the top is not enough | code: track model | 1.8 |
| `roll_it` (K) | starts the marble higher or lower and predicts how far along the table it rolls | code | -0.8 |
| `bumpy_or_smooth` | same start on wood, carpet, sandpaper: which goes farthest (one change) | code | 0.0 |
| `knock_it_over` (G4) | sets the start height and the marble (glass or steel) so it knocks a block into a zone | code: collision model | 1.2 |
| `jump_the_gap` | sets the start height so the marble clears a gap and lands on the far ramp | code: flight | 2.2 |
| `chain_reaction` | **open build:** places ramps, a loop, dominoes and the bell so one let-go rings it | code: track + collision | 2.5 |

X-ray: an energy bar that turns height into speed as the marble runs.

### W6 Wave Tank — `wave-tank` (user 11-04: amplitude, frequency, wavelength, energy)

A long 3D glass wave tank (the harbor's water and glass) with a paddle at one end and a beach at the other. The child
drives the paddle with two controls in the scene: **how far it pushes** (amplitude) and **how fast it pushes**
(frequency). The child never sets wavelength. The wave model computes it from a fixed wave speed (λ = v / f), so
shaking faster makes the crests closer, and the child finds that out from the waves. Energy is computed as
∝ A²·f² and shown by what the wave does at the beach: a cork bobs, a toy boat rocks, a block tower falls, sand washes
away. Home: G4 `SCI002` Waves ("wave properties (amplitude, wavelength), relationship between wave properties and
energy"; 4-PS4-1), taken from the GRADE_04 PRD. Not yet checked against the published curriculum.

How the screen shows each relationship:

| Relationship | What the child sees | Fixed so the test is fair |
|---|---|---|
| Amplitude ↔ energy | A bigger push makes taller crests, and the tower at the beach falls | Same push speed |
| Frequency ↔ wavelength | Pushing faster makes the crests closer together. The tank has a ruler on its glass, and the paddle count shows on a clock | Same push size |
| Frequency ↔ energy | Closer crests hit the tower more often and harder, and the tower falls | Same push size |
| Wave carries energy, not water | The cork bobs up and down in place while the crest passes it | No change. The child watches |

| Mode | The child... | Judge | β |
|---|---|---|---|
| `match_the_wave` | sets push size and speed until the waves match a target wave drawn on the glass. Easy: one control differs. Hard: both differ | code: A and λ within tolerance | 0.5 |
| `cork_ride` | predicts aloud where a cork ends up after three waves pass (moves to the beach / stays), then watches | code | 0.8 |
| `faster_closer` | changes only push speed, then measures crest spacing with the ruler before and after. Says whether crests got closer or farther | code: λ from model | 1.5 |
| `knock_it_down` | changes one control to knock down a tower that the first wave did not. Medium: a second, taller tower. Hard: the push size is capped, so only faster pushing works | code: E ∝ A²f² vs tower threshold | 2.2 |
| `which_wave_wins` | two paddles each send one wave, then the child calls which one carries more energy and backs the call with the measured crest height and spacing | code compares claim to model | 2.8 |
| `protect_the_beach` | **open build:** places a breakwater (rocks, a floating log, a reef) so that waves arrive smaller and the sandcastle survives | physics: amplitude loss per barrier | 3.0 |

X-ray: crest-height and crest-spacing marks on the waves, plus an energy bar at the beach that fills as each wave
hits. The levers:

| Lever | Stock type | What it does |
|---|---|---|
| `xray` | `marks` | Draws the crest-height and crest-spacing marks |
| `freeze_wave` | `marks` | Pauses the tank so the child can measure |
| `one_step_less` | `easier` | Same task with one control locked |
| `replay` | `custom` | Plays the last wave at 1/4 speed. This is the second world that needs `replay`, so the roadmap rule applies: promote it to a stock type instead of adding a third `custom` copy |

Bridge to W5: the same paddle can drive a speaker, where push size is loudness and push speed is pitch. That is the
G4 extension of `sound-wave-explorer`, which stops at G3.

### Horizon (after W1-W3, pick by what he asks for)

- **Magnet Playground** (3-PS2-3/4): if not folded into W2.
- **Kitchen Chemistry**: reaction-lab K mode of everyday mixes (brief 5), slime, color mixing.
- **Straw Rockets**: rocket-builder exists; give it a launch-and-measure build.
- **Weather Station**: build a rain gauge and wind vane on the ecosystem island.
- **Sound Studio**: build an instrument; pitch from string length and tension.

## Queue

| # | Item | Executor | State |
|---|---|---|---|
| SB-0 | Curriculum homes: which published K-5 subskills ask for buoyancy, circuits, magnets, volcanoes; ruling on brief 3 (K circuits or pinwheel only) | `/curriculum` lookup, `/curriculum-fit` after birth | **Lookup DONE 10-31** (published SCIENCE K-4; there is no G5 science). **W1 float:** K `SCI001-02-C` (material properties incl. floating/sinking), G2 `SCI001-01-c` (group materials by one property); thin, no G3-5 home. **W2 circuits:** K `SCI001-03-H` ("circuits with batteries", so SR-3 = yes, loop only), G4 `SCI001-04-a` (open/closed, will current flow), `-04-b` (battery, wire, bulb, switch roles), `-04-c` (electrical energy to light/heat/motion). **Magnets:** K `SCI001-01-F`, G3 `SCI001-05-a/b/c` (magnetic or not; at a distance; strength vs distance), `SCI001-06-a` (poles), `-06-c` (magnetism vs static); 5 G3 homes, so a magnet mode on W2 is the next priority after the circuit modes. **W3 volcano:** G2 `SCI003-03-a/b` (fast vs slow Earth events, timeline), G4 `SCI004-03-c` (layers), `SCI004-04-b` (plates make volcanic chains), `SCI004-06-b/c` (sudden events), `SCI005-02-a` (hazards). `/curriculum-fit` per world after birth |
| SB-1 | W1 `buoyancy-harbor` birth: pure model (density, displaced volume, tipping), 3D scene on the ecosystem tank, `drop_test` + `build_boat`, code-only generator, card/boss | `/primitive`, then `/add-eval-modes` | **L0 BUILT 10-29** (committed 68ec6a4c): `drop_test` on the tap boss, code-only generator, 3D harbor, browser drive 30/31. Birth: `qa/eval-reports/buoyancy-harbor-birth.md`. **`build_boat` BUILT 10-29** (β 1.5, code-judged, drives 23/24). Next: SB-3 levers |
| SB-2 | Science lab kit, extracted from W1 + the three dioramas (not before W1 runs): shared scene shell, camera presets, `__point` drive hooks, water and particle helpers, notebook rows as scene facts | `/primitive` (refactor slice) | after SB-1 |
| SB-3 | Demonstration levers on W1's boss (`xray`, `side_by_side`, `solved_boat`, `one_step_less`, `replay`) via `bossLevers.ts`; Pip pointing via `/add-pip-surface`; `/review-live-wiring buoyancy-harbor` clean | `/add-support-tiers`, `/review-live-wiring` | **BUILT 10-29** (committed 68ec6a4c): xray, material_tags, side_by_side, solved_boat, one_step_less on the boss; replay deferred. Report `qa/eval-reports/buoyancy-harbor-levers-2026-10-29.md`. **`/review-live-wiring` 10-29 clean** after 2 fixes: `build_boat` answers `build` (card, catalog affordance; boss now bespoke `defineBoss`), scene `constraints` no longer repeat `moves`. One user Live sample owed on `build_boat` (answer kind changed) |
| SB-4 | W1 remaining modes + β | `/add-eval-modes` | **`salt_water` BUILT 10-30** (β 3.0, code-judged, `manipulate`): foods sink in fresh water, child adds or pours out salt until the named foods float; levers xray + one_step_less; browser drive 25/26 (the miss is the tester's observer 400s), report `qa/eval-reports/buoyancy-harbor-salt-water-2026-10-30.md`. **User 10-30:** `make_it_float` overlaps `build_boat` (a clay boat with sides already passes it); rework as an easier rung or drop. **`find_the_rule` BUILT 10-30** (β 0.5, code-judged, `tap`): test 2-3 things, sort 1-2 untested things of the same stuff in another size on yellow stands, pick what decides it (size / weight / material); pier row of five + `row` camera; card trimmed to fit; drive 29/30 (G1), report `qa/eval-reports/buoyancy-harbor-find-the-rule-2026-10-30.md`. **`cargo_two_designs` BUILT 10-30** (β 2.5, code-judged, `build`+`tap`): boat A given (easy/medium) or built (hard), guess, test both to the sink, claim which carried more; medium = one change, hard = the item names the part; levers `changes_marked`, `penny_rows`, one_step_less; drive 19/19 (G2), report `qa/eval-reports/buoyancy-harbor-cargo-two-designs-2026-10-30.md`. **`make_it_float` BUILT 10-31** as the easier rung (β 1.0, `build`): clay and size fixed, only the shape changes; easy floats it empty, medium carries a load low sides take, hard needs tall sides; misses `kept_a_lump`/`flat_sinks`/`sides_too_low`; levers xray + one_step_less; drive 29/30 (G1), report `qa/eval-reports/buoyancy-harbor-make-it-float-2026-10-31.md`. **W1 has all 6 modes.** Next: SB-0 curriculum homes, SB-2 kit extraction. Constraint: the card's tutor guidance is near the 4,000-char cap (test-guarded in `ruleModel.test.ts`), so each new mode must trim wording elsewhere |
| SB-5 | **Real-student check:** your son plays W1; one Live session run by the user on the boss path | user | **User browser check 11-01 (in progress):** circuit-workbench "absolutely amazing", takes a moment to get used to (SB-10). Harbor `drop_test` felt like tap-the-buttons, so it was reworked: the guess is spoken to the tutor (no chips, never graded), tap a test then the water to drop it, "Which test helped you know?" opens after the call; drive `qa/eval-reports/buoyancy-harbor-drive-2026-11-01/` passes. `cargo_two_designs` "worked great": cut to 1 item per session. Physics tester folds its controls so the world gets the page. Still owed: son plays; one Live sample on `drop_test` (does the tutor ask the guess aloud and the "which test" question) |
| SB-6 | W2 `circuit-workbench` on the kit, then its modes and levers | `/primitive`, `/add-eval-modes`, `/add-support-tiers` | **L0 BORN 10-31** (committed 0cb35a4a; magnet modes 4b8ead85; ahead of SB-5 on the user's "until done"): `light_it` (β -0.5, `build`), code-only, circuit model (groups + path through bulbs, short), 3D workbench (battery, bulb holders, clip posts, tube wires, glow), tap a post or a clip chip; misses `open_loop`/`both_on_one_end`/`short_circuit`/`wrong_bulb`/`lit_both` (unanswered until levers); drive 30/30 (K). SB-2 kit not extracted: W2 shares no 3D code with W1 yet beyond the shell pattern. Birth `qa/eval-reports/circuit-workbench-birth.md`. `/review-live-wiring` 10-31 clean after 1 fix. **`find_the_break` BUILT 10-31** (β 0.5; loose wire / dead battery or burnt bulb / two bulbs in a row; drive 20/21 G4), report `qa/eval-reports/circuit-workbench-find-the-break-2026-10-31.md`. **`conductor_test` BUILT 10-31** (β 1.0; things across a gap; hard = shine fools the eye; drive 20/20 G3), report `qa/eval-reports/circuit-workbench-conductor-test-2026-10-31.md`. **`add_a_switch` BUILT 10-31** (β 1.8; drive 20/20 G4), report `qa/eval-reports/circuit-workbench-add-a-switch-2026-10-31.md`. **`two_bulbs` BUILT 10-31** (β 3.2, G4; row/side by side, dim glow, take a bulb out; drive 20/20), report `qa/eval-reports/circuit-workbench-two-bulbs-2026-10-31.md`. **Levers BUILT 10-31** (`xray` charge dots that flow round a loop and stop at a gap; `one_step_less` per mode; drive 4/4), report `qa/eval-reports/circuit-workbench-levers-2026-10-31.md`. **`build_device` BUILT 10-31** (β 2.5 open build; tray of bulb, motor, buzzer, switch; drive 16/16), report `qa/eval-reports/circuit-workbench-build-device-2026-10-31.md`. W2 has 6 modes. **`magnet_test` BUILT 10-31** (β 1.5, G3; not every metal sticks; drive 20/20), report `qa/eval-reports/circuit-workbench-magnet-test-2026-10-31.md`. W2 has 7 modes. **`magnet_poles` BUILT 11-02** (β 2.0, G3 `SCI001-06-a`; tap the 3D magnets to turn and slide, test both ways, then call pairs or name a striped end; spoken guess, no chips; drive 37/37), report `qa/eval-reports/circuit-workbench-magnet-poles-2026-11-02.md`. **`magnet_distance` BUILT 11-02** (β 1.7, G3 `SCI001-05-c`; a steel ball on a ruler mark, tap the mark then the magnet; easy names the farthest mark it pulls from, medium calls another magnet, hard picks the stronger of a small and a big magnet where the small one can win; levers `pull_marks` + one_step_less; drive 29/29 at medium), report `qa/eval-reports/circuit-workbench-magnet-distance-2026-11-02.md`. **`electromagnet` BUILT 11-02** (β 2.2, `build`; no published K-4 home: catalog tags G3-4, nearest G3 `SCI001-05-b` and G4 `SCI001-04-c`; wrap wire round a core, switch on, dip in clips; easy at least 1-2 from a bare nail, medium an exact count by wraps, hard needs the spare battery and a steel core; levers `strength_meter` + one_step_less; drive 32/32 at medium), report `qa/eval-reports/circuit-workbench-electromagnet-2026-11-02.md`. W2 has 10 modes; the card sits at the 4,000-char guidance cap, so the next mode needs a cap decision or a shorter card format., `build_device` (2.5), `two_bulbs` (3.2), a magnet mode; then `/add-support-tiers` |
| SB-7 | W3 `volcano-island` on the kit, then its modes and levers | same | **L0 BORN 10-31** (committed 148e8b00): `kitchen_volcano` (β -0.5), code-only, foam = min(soda, vinegar), 3D kitchen table with volcanoes A and B and measuring sticks; fair test + claim; drive 20/20 (G1). Birth `qa/eval-reports/volcano-island-birth.md`. **Levers BUILT 10-31** (`fizz_pairs`, `changes_marked`, `one_step_less`; drive 7/7), report `qa/eval-reports/volcano-island-levers-2026-10-31.md`. **`runny_or_sticky` BUILT 10-31** on the new island scene (β 1.2; real volcanoes' magma; flows / explodes / dome; drive 24/24), report `qa/eval-reports/volcano-island-runny-or-sticky-2026-10-31.md`. **`layers_over_time` BUILT 10-31** (β 2.0, G4; cutaway + crack at hard; drive 20/20), report `qa/eval-reports/volcano-island-layers-over-time-2026-10-31.md`. **`save_the_village` BUILT 10-31** (β 2.5, open build on a slope map; lava fills the lowest ground; 1/2/3 walls by tier; drive 14/14), report `qa/eval-reports/volcano-island-save-the-village-2026-10-31.md`. **`cool_the_rock` BUILT 10-31** (β 3.0, G4-5; granite/basalt/obsidian/pumice; drive 16/16), report `qa/eval-reports/volcano-island-cool-the-rock-2026-10-31.md`. W3 has 5 modes. Next: `inside_the_volcano` (0.0, a recognition mode: decide whether it is worth building) |
| SB-9 | Rule 3 + 8 across W1: spoken guess and act-in-the-world in `find_the_rule`, `salt_water`, `make_it_float` (each still has Float/Sink guess chips) and the `cargo_two_designs` "which will carry more" guess; then W2/W3 prediction steps | `/add-live-tutor-tools` (card moves + scene), browser drive per mode | after the user's Live sample confirms the `drop_test` pilot (pilot-then-sweep). Constraint: harbor guidance is at ~3,990 of 4,000 chars |
| SB-10 | Circuit workbench first-use: "takes a moment to get used to" (user 11-01). Ask the user what was unclear; likely a first-item cue (the first clip post pulses) or the tutor showing one connection before handing over | `/add-support-tiers` or component | needs the user's answer on what was unclear |
| SB-8 | Verify each world: vitest on the pure model, browser drive per mode, `/eval-test`, `/oracle-test` for the object/part libraries | `/eval-test`, `/oracle-test` | **`/eval-test` DONE 10-31** for all three worlds: 66/66 pinned runs, tier levers asserted per item (`qa/eval-reports/science-build-worlds-2026-10-31.md`); vitest 322/322 across the physics folder; a browser drive per mode. `/oracle-test` not run (the generators are code-only and the models are the oracle; the vitest suites check every item against them) |

| SB-11 | W4 `marble-run-park` birth, then its modes and levers | `/primitive`, `/add-eval-modes`, `/add-support-tiers` | **L0 BORN 11-03** (committed 0ca66ca8): `make_the_loop` (β 1.8, `manipulate`), code-only, track model (`marbleModel.ts`), 3D run with tappable pegs and marble, spoken guess (no chips); misses `too_low`/`top_height_only`/`not_lowest` (unanswered until levers); drive 29/29 (medium, 3D taps), `/eval-test` 6/6 across tiers. Birth `qa/eval-reports/marble-run-park-birth.md`. **Levers BUILT 11-04** (`loop_top_line` → too_low, `xray` energy bar → top_height_only, `peg_results` rings + sorted notebook → not_lowest, `one_step_less`; easy starts with the line; model now records per-frame height and speed; drive 8/8), report `qa/eval-reports/marble-run-park-levers-2026-11-04.md`. Next: `knock_it_over` and `jump_the_gap` (`/add-eval-modes`); carpet (hard) not yet seen in a browser |
| SB-12 | **W5 Sound Studio** — `sound-studio` (user 11-04: next world after marble run) | `/curriculum` lookup, then `/primitive` | Queued. Child builds instruments and the world plays them: rubber-band guitar (pitch from length and tightness), water-glass xylophone, drum (vibration you can see: rice jumps on the skin), cup telephone (sound travels along the string; slack string goes quiet). X-ray: vibration drawn as the string or skin moving, sound waves spreading. Candidate standards 1-PS4-1 (vibrating materials make sound), 1-PS4-4 (device that uses sound to talk at a distance); curriculum homes unchecked. Existing `sound-wave-explorer` (physics.ts) to read first: fold in or keep separate |
| SB-13 | **W6 Wave Tank** — `wave-tank` (user 11-04: show amplitude, frequency, wavelength and energy carried) | `/primitive`, then `/add-eval-modes` | **L0 BORN 11-04** (committed 2be90fce). Curriculum homes confirmed in the published G4 SCIENCE unit `SCI002`: `-01-a/b/c` (amplitude, wavelength, reading both off a wave), `-02-a/b/c` (energy), `-05-a/b` (comparing). Birth mode `knock_it_down` (β 2.2, `manipulate`): the learner changes ONE paddle setting so a wave knocks the tower down; hard locks the push size so only pushing faster works. Code-only; pure wave model (λ = v/f, E ∝ (size×speed)²); 3D tank with grid glass, paddle, knob box, cork and block tower. Levers built at birth: `crest_marks`, `xray` energy bar, `changes_marked`, `one_step_less`. Gate 740/740, drive 33/33 (3D taps), `/eval-test` 6/6 across tiers. Report `qa/eval-reports/wave-tank-birth.md`. Next: `/add-eval-modes` (`match_the_wave`, `cork_ride`, `faster_closer`, `which_wave_wins`, `protect_the_beach`); user browser check + one Live sample |
| SB-14 | **Machine Workshop** — `machine-workshop` (engineering; user 11-05: agent-built machines that show how cranks and engines work) | `/add-support-tiers`, then `/add-eval-modes` | **L0 BORN 11-05** (committed 267685a0). `spin_to_push` (β 1.4): build the missing part of a real machine (crank + rod or cam + follower) on a 3D bench. An author agent names each machine's parts; code checks they assemble (motion table) and match the real machine (`machineAtlas.ts`, 8 machines), with one repair turn and an atlas fallback; code owns every size. Gate 747+6, own tests 20/20, drive 22/23 (1 = pre-existing SVG console noise), eval-test 3 topics; the repair turn caught a missing walking beam live. Report `qa/eval-reports/machine-workshop-birth.md`. Next: levers (xray power path, slow_mo, cutaway, ghost_part, stroke ruler), then `time_the_spark` (engine/crankshaft), `gear_for_the_job`, `lift_with_liquid`; `/curriculum-fit`; user browser check |
| SB-15 | **Body Workshop** — `body-workshop` (biology, **2D, K-5**; user 11-05: agent-built biology like the machine workshop) | user browser check + tutor replay, then `/add-eval-modes` | **L0 BORN 11-05 + L3 LEVERS 11-05** (committed ea23ddb8). Levers: where_it_breathes, animal_fact, no_food_parts, count_parts, show_flow, easier_animal (report `qa/eval-reports/body-workshop-levers-2026-11-05.md`; x-ray dropped as a leak). `deliver_oxygen` (β 0.2): tap body parts into one row from habitat to body (K-3) or muscle (4-5); a breath runs the flow table and stops where a part cannot take it. The author agent names each animal's path; code checks flow + atlas (9 animals) + K-5 words; tiers add contrast animals. Gate 755+6, own 232, J1 drives. Not run: `/eval-test`, `/curriculum-fit` (spend cap), browser. Report `qa/eval-reports/body-workshop-birth.md`. **11-05 `fuel_the_body` BUILT** (β 0.4: food path, crop/gizzard/four-part stomach, cow added; report `body-workshop-fuel-2026-11-05.md`). Next: author prompt names what is special per animal (paid check), then `sense_and_respond`, `plant_transport` |

## Rulings owed

| # | Question | Recommendation |
|---|---|---|
| SR-1 | Which world first? | Sink-or-float: easiest to get right, and it builds the water, X-ray and notebook pieces the others reuse |
| SR-2 | Grade band to tune for first | Whatever grade your son is in; each world still spans K-5 |
| SR-3 | K circuits: closed loop allowed at K (brief 3) | Yes, loop only, no symbols or series/parallel |
| SR-4 | Open builds judged in code first, vision only for looks | Yes, same as tower-stacker and open-builder |
| SR-5 | Phase: WORKSTREAMS row 11, ACTIVE beside 9 or replacing 1? | User's call (WIP is already over 2+1) |

## Gates per world

Pure model vitest (floats/sinks, loop closed, lava path) · `typecheck:lumina` 0 · `boss.test.ts` green and
`/review-live-wiring` clean (card + boss, stock levers, no `tutoring` block or hand Pip) · tester browser drive per
mode (predict → build → test → miss → Try again keeps the build → pass) · `/eval-test` all modes and tiers ·
the user's son plays it (the bar, feedback 10-06) · one user-run Live sample per world on the shared boss path.
