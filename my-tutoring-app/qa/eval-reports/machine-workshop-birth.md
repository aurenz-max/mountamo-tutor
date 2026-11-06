# Birth Certificate — machine-workshop (2026-11-05)

**Lifecycle layer: L0 (born).** Engineering, 3D (R3F). User 11-05: "an agent-based machine creation primitive… make sure the agent can identify parts that will properly assemble into the actual specified machine and show the principle at play."

- **Core task:** `spin_to_push`, β 1.4, `manipulate`. A real machine stands on a 3D workbench in the order power flows. The part that turns spinning into up-and-down is missing. The learner fits one tray part on the shaft (crank disc, cam, gear) and one to the slider (connecting rod, follower, rack), presses Run, runs as often as it likes, then presses "I'm done!".
- **Model** (`machineModel.ts`, pure). A chain of stages with a motion table (`MOTION`: source → spin, belt/gearbox spin → spin, converter spin → push, walking beam push → push, load needs push). `judgeBuild` decides the outcome:
  - pairing: `no_pin`, `no_push`, `no_grip`, `ran_out` (gear and rack);
  - geometry: crank-slider binds when r sin φ / L ≥ ½ (`jams`);
  - stroke: 2r for a crank, the lift for a cam (`too_short` / `hits_end` against the load's window);
  - force: push = torque / (stroke / 2) (`stalls`).

  `runBuild` writes the poses (crank-slider kinematics, cam lift, rack travel, stop and shake). `machine3d.ts` draws them and decides nothing.
- **Author agent** (`service/engineering/machine-author.ts`, gemini-flash-latest, structured JSON). It is given the lesson, the parts library and only the *names* of 8 real machines. It returns, for each machine, the stages in order, a job per stage, an intro, a doesWord and the principle. Code holds every machine to two checks, and the agent gets one repair turn with the error messages:
  1. `assemblyErrors`: the bench's own motion rules.
  2. `fidelityErrors` against `machineAtlas.ts`: the real chain, with optional parts such as a windmill's gearbox.

  Word checks: no stage outside the converter may name crank, cam, connecting, follower, pitman or eccentric; the principle must say both the round motion and the up-and-down one. A machine still wrong after the repair turn is replaced by the atlas's words for a machine that fits the lesson, so a lesson never breaks. Code owns every number (`buildItem`). An item ships only if `machineFair` holds: exactly crank + rod and cam + follower work, and the tier's failures exist.
- **Atlas:** pump jack, windmill water pump, sewing machine, jigsaw, air compressor, stamp mill, trip hammer, toy automaton.
- **Tiers** (`config.difficulty`). Easy: only the pairing matters. Medium: three crank sizes and a short rod, giving too short, too far and a jam. Hard: the large crank's stroke fits but it stalls, and a large cam stalls the same way.
- **Workspace binding:** `machineWorkspace.ts` + `machineWorkshop.card.ts` + `machineWorkshop.boss.ts` (bespoke `defineBoss`, activity-judged, no key). Misses: `wrong_pair`, `one_way_only`, `rod_too_short`, `stroke_too_small`, `stroke_too_big`, `too_weak`. All six are `unanswered` (no levers yet). `boss-card.mjs` prints a clean card.
- **Showing the principle:** the run itself (crank pin circling, rod pushing the slider, beam rocking, oil, water, air or chips on each working stroke). After a working check, the feedback gives the principle in the agent's words plus "a real pump jack uses a crank and a connecting rod". A cam in a crank machine works and is told what the real one uses. The bench and that feedback stay on screen after the last machine.
- **Answer-leak audit:**
  - The slot shows "? missing part"; its stage chip and its job text appear only after the machine works.
  - The tray order is shuffled.
  - The instruction never names the converter, and the author's intro, doesWord and other jobs are code-checked for converter words.
  - The scene facts list the tray and the runs, never which parts work.
- **Design gate:**
  - Manipulation: pass (3D tap a tray part, 3D tap a fitted part to take it off; chips are the fallback).
  - Simulation: pass (the model runs the machine).
  - Production: pass (several builds work; failures are physical).
  - Timer: none.
  - Layout leak: pass.
- **Pip:** framework (boss). The workspace region only.
- **Checks:**
  - `typecheck:lumina` 0.
  - `test:primitive machine-workshop` 747 + 6 pass. J1 is a baseline entry by design (WebGL).
  - Own tests 20/20: model/atlas 9 (every tier × machine × 7 seeds is fair), author 6, workspace 4. W1 payload saved.
  - Browser drive (`machine-workshop-drive-2026-11-05/`): 22/23. The one failure is SVG `<ellipse>`/`<circle>` console noise the marble drive also filters. The drive covers:
    - 3D tray tap fits a part and a fitted-part tap removes it;
    - no_pin, then Try again keeps the notebook;
    - hits_end, jams, works;
    - the principle shows after each machine and stays after the last;
    - a cam build on machine 2;
    - the finale.
  - `/eval-test` 3/3 topics, plus the drive and payload runs. Of 6 sessions with logged sources (18 machines), the first answer fully passed in 4. In the other 2, the agent left the walking beam out of a trip hammer (twice) and a pump jack (once). The fidelity check caught each one and the repair turn fixed it. No atlas fallback was needed.
  - Gemini: about 8 agent calls; today's metered total is $4.85 of the $5 cap, mostly other harness runs.
- **Not done:**
  - `/curriculum-fit` (homes unchecked: 4-PS3-4, 3-5-ETS1, MS-ETS1, and the G2 to G8 band).
  - No Live sample.
  - User browser check.
  - The link-row parts (rods, rack) read small on the 3D tray; the chips carry them.

## Follow-up queue

| # | Skill | Layer | Input from this birth |
|---|---|---|---|
| 1 | `/add-support-tiers` | L3 | Levers asked for at design: `xray` (colour the power path, spin vs push, and label each part's motion), `slow_mo` (step the crank 15° at a time with the pin's circle and the slider's line traced), `cutaway` (see into the pump cylinder or the gearbox), `ghost_part` (outline of the real converter's shape in the slot: answers `wrong_pair`), `one_step_less` (medium → easy tray). Size misses want a stroke ruler beside the load (`stroke_too_small` / `stroke_too_big`) and a push meter (`too_weak`). |
| 2 | `/add-eval-modes` | L1 | `time_the_spark` (single-cylinder engine: piston → rod → crank → flywheel, the reverse direction; fire the spark at a crank angle; the four strokes); `gear_for_the_job` (winch or fan: gear ratio vs torque); `lift_with_liquid` (pump → hose → cylinder, Pascal; excavator boom); `follow_the_power` (K-2: tap stages in power order); `fix_the_machine` (a broken stage among working ones). Each needs new chain kinds in `MOTION` and atlas machines; the author agent and both checks carry over unchanged. |
| 3 | `/curriculum-fit machine-workshop` | home | Check that 3-5 and MS engineering skills route here before more modes. |
| 4 | Atlas growth | — | Open the atlas to an "other" machine with a judged fidelity check only if lessons ask for machines outside these 8. |
| 5 | `/add-sound` | L5 | Motor hum scaled to the run, a clunk on `hits_end`/`jams`, a ratchet tick on `ran_out`, a slurp or stitch on the effect. |
| ✓ | `/eval-test` | QA | After each layer. |

## 11-05 revision (user browser check: "absurdly difficult" without knowing how a sewing machine works; tester too cramped)

- Default tier is now **easy** unless the lesson sends `config.difficulty` (only the pairing matters); sizes and force stay as medium/hard.
- Plain words: "the wheel spins round and round, but the needle has to go up and down"; rows are "On the spinning wheel" / "Joins it to the needle"; pin → peg.
- A **part guide** (open on the first machine) says what each part looks like, never what it is for: "a wheel with a peg near its edge: as it turns, the peg goes round in a circle", "a stiff stick … that hooks onto a peg".
- Every run that does not work now shows **why** before any check ("A connecting rod hooks onto a peg, and that wheel has no peg. Which wheel has a peg that goes round in a circle?"). Stage chips mark ⟳ spinning vs ↕ up-and-down.
- Engineering tester: the legacy AI Tutor side panel starts closed and the controls fold to a rail after Generate; at 1280 px the bench is 1062 px wide (was about 420).
- Re-checked: own tests 372/372 across the engineering folders, `typecheck:lumina` 0, drive 25/26 at 1280×900 on easy (the miss is the pre-existing SVG console noise).

## 11-05 revision 2 (user: go 2D, "3D increases the difficulty a lot without much knowledge benefit"; the tutor said only "find the missing part")

- **2D side view** (`MachineBench.tsx`, SVG) replaces `machine3d.ts` / `MachineScene.tsx` (deleted). Same model and poses. Before anything is fitted, the wheel spins on its own and the bench labels "⟳ spins" and "↕ <needle> must go up and down". While a run plays, the peg's circle and the slider's straight line are traced. The tray is now picture buttons (each part drawn as on the bench), and a fitted part is tapped on the bench to take it off.
- **Tutor teaches first.** Card `special`: on each new machine, say what it is for, that its wheel spins, that its working end must go up and down, so the missing part must change one into the other; point at both; then describe the tray parts by look; invite one idea; after a run say what moved and what stayed still; never say which parts or which pair. The scene facts now carry `goal`, `howItMoves`, `wheelParts` and `joiningParts` (by look), so the tutor has the words to teach from.
- Checks: `typecheck:lumina` 0, gate 747 + 6, own tests 20/20. Drive 27/28 at 1280×900 (the miss is the pre-existing SVG console noise). The drive shows the goal labels on the bench, the trace during a crank run, fit and remove, no_pin with its reason, gear and rack running out, cam and crank builds, and the finale.
- Not verified: what the Live tutor actually says now. That needs a Live session (user-run).
