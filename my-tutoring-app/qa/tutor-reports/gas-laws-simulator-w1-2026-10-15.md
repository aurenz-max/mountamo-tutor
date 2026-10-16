# gas-laws-simulator W1 binding (ROLLOUT C27), 2026-10-15

**Shape P, three modes, all bound** (observe, predict, calculate). Levers in `../eval-reports/gas-laws-simulator-levers-2026-10-15.md`. Not committed.

## What changed, and why
The old screen gave the answer away in every mode. "Apply Change" ran the perturbation, and the live P/V/T readouts and
the P-V/V-T/P-T plots then showed the asked quantity's new value before the learner answered. "Skip & Answer" was a
second way past the task. A wrong numeric answer printed "Expected about X". Gemini wrote each instruction and key
(code re-solved the key, but the instruction text was the model's), and predict and calculate were the same task. The
sliders let the learner set any variable and read the answer off the panel. The scripted context sent
`directionAnswer` and `targetAnswer` to the tutor.

Rebuilt so that each mode is a prediction made before the change runs, with the items built and keyed in code (`gasLawsWorkspace.ts`):
- **observe**: a container (a steel tank, a cylinder with a free weighted piston, a syringe in a water bath), its state
  before, and one change. The learner chooses Goes up / Goes down / Stays the same for the asked quantity.
- **predict**: one change, and the learner chooses the new value. The wrong choices are the inverted factor, the old
  value, and on Celsius items the Celsius ratio.
- **calculate**: a cylinder pressed and heated at once (combined gas law). The wrong choices apply only the first
  change, only the second, or the second the wrong way round, plus the Celsius ratio on hard items. An item where the two
  changes cancel is not built, because it would credit a learner who ignored both.
- **Difficulty is structural** (`config.difficulty`). Easy: direct relations, whole-number factors, and the ask names
  what is held. Medium: inverse relations and fractional factors. Hard: observe leaves what is held for the learner to
  infer from the container and always includes a "stays the same" key (heating a free piston leaves the pressure the
  same; pumping gas in leaves the temperature the same). Predict and calculate at hard give temperatures in degrees
  Celsius.
- **The screen** shows the gas BEFORE the change on the particle canvas and a before/after table with "?" for the asked
  quantity. The change runs on the canvas, and the "?" fills, only after credit (on the scripted path, after two
  misses). The readouts, sliders, plots, Skip, the KMT accordion and the description are gone. The frame moved to the
  Lumina kit.
- **Generator**: Gemini writes only the title, the description (not rendered), `lawFocus` (its reading of the topic)
  and the gas. Code builds the items from those fields, the eval-mode pin and the tier, and stores them on the data. A
  legacy payload (`scenario` + `challenges`) is rebuilt from its law focus and modes. Amounts of gas are relative
  ("twice as much air"), never in moles, so no state on screen breaks PV=nRT. The catalog description and constraints
  say so.

Every item is `speech` with `acceptsGesture` (J14): JEV judges speech against `gasExpectedAnswer`, and `gasCorrect`
checks the tap. Misses (`gasMiss`, the same ids as `gasSpokenMisses`): observe `opposite_direction`, `said_unchanged`,
`missed_unchanged`; predict `inverse_factor`, `kept_value`, `celsius_ratio`; calculate `first_change_only`,
`second_change_only`, `ratio_inverted`, `celsius_ratio`. On the workspace path a wrong tap stays marked until Try
again, and Next and the scripted messages are off.

## Gates
- `typecheck:lumina` 0. Full `tsc` 770 (baseline 770).
- `GasLawsSimulator.workspace.test.tsx` 16/16: every mode on hand-built items; the item space over 3 tiers x 5 foci
  (valid, PV/nT preserved, distinct choices, tiers structural, no rounded change value); the leak rules; misses and levers.
- live-activity + `misses.test.ts` + ScienceWorkspaces Pip surface + chemistry: 62 files, 4845 passed.
- Payloads `w1-payloads/gas-laws-simulator.{observe,predict,calculate}.json` from `save_payload.py`: observe Grade 9
  hard, predict Grade 10 hard, calculate Grade 11 medium. All three titles were written by the model, not the fallback frame.
- Sweep: 0 findings J1-J14 on the three payloads; misses named 4/4, 4/4, 3/3; J11 67. The advisories ("scene facts
  contain the key") come from the choice list, which is on screen.

## Replay (gemini-3.8-flash, 3 payloads x 5 samples, `--observe`; `replay/gas-laws-simulator-2026-10-15{,-r2,-r3}.json`)
The automatic checks missed nothing on any run (0/15 everywhere). Reading the replies by hand found the following:
- **r1.** On the observe "stays the same" item (a heated steel tank, asked volume), 10 of 10 miss and stuck replies
  settled it by voice: "Can the walls of a solid steel tank expand or shrink?". My guidance listed which quantity each
  container holds, which is the answer on that item. On predict credit, 2/5 replies said "the pressure gauge now shows
  the higher reading", but no reading is drawn. On calculate, 1/5 replies described the one_change practice as the
  temperature change when it is the pressure change. On observe, 1/5 lever replies said the card mentions "the steel
  walls", which it does not.
- **Fixes.** Guidance now says never to name which quantity the container holds or ask a yes-or-no question that
  settles it, and to ask what the container keeps the same. It says to describe a card only by what the scene says it
  shows, and that no gauge reading is drawn. The scene calls the tank "thick-walled (no gauge or reading is drawn)".
  The run fact says the table's "?" now reads the value. The one_change lever names which change it keeps.
- **r2.** Observe miss replies became "What does the sealed steel tank keep the same?" (5/5). 2/5 stuck replies still
  asked "does the space inside change?". 3/5 calculate miss replies stated the fix ("you accounted for the pressure
  change, but don't forget the gas was also cooled"). Guidance now quotes those yes-or-no questions, and says that
  after a miss the tutor never says what the wrong value came from or which change was left out.
- **r3.** No reply names a key or settles the held quantity. Calculate miss replies ask "how does each change on the
  table affect the volume?", and stuck replies pull one_change and describe the pressure-only item correctly.

## Undriven modes
None. The sweep drives taps; the workspace test drives a spoken answer on observe.

## Open findings
- 4/5 predict lever replies (r3) call `kelvin_scale` and describe only the relation card. Some stuck replies pull two
  levers in one turn while a practice item opens, so the second pull is refused but the reply still describes it. This
  is the same shared lever-doctrine issue mixing-and-dissolving reported. `/add-live-tutor-tools` (shared doctrine).
- The spoken path is not swept (the row taps), so the spoken-miss probe has no requests. Next `/eval-test` of this
  family: one spoken program per mode.
- No `docs/contracts/gas-laws-simulator.md`. The new requirements (code-built keys, the gas shown before the change
  until credit, no cancelling calculate items, relative amounts) are recorded only here. `/primitive-contract`.
- Needs a browser check on the canvas: the piston height and particle speed before and after the run, and the tank,
  piston and syringe drawings. Only JSDOM has run them.
