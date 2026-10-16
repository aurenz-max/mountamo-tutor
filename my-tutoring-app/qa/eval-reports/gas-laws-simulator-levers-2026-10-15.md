# gas-laws-simulator: support levers, 2026-10-15

Built on the W1 binding (`qa/tutor-reports/gas-laws-simulator-w1-2026-10-15.md`). Not committed.

## Failure inventory
There is no real-learner evidence: no demonstrations, misconception, remediation or earlier eval-report files exist for
gas-laws-simulator. The documented failures are the catalog's commonStruggles: what is held constant, pressure against
volume when compressing, Celsius in a ratio, and more gas read as a higher temperature. The synthetic failures are the
journey's scripted wrong taps. The rest are inferred.

| Mode | Failure (miss) | Class |
|---|---|---|
| observe | the quantity moves the other way (`opposite_direction`) | documented (struggle 2), synthetic |
| observe | a quantity that changes called unchanged (`said_unchanged`) | inferred |
| observe | a held quantity called changing (`missed_unchanged`): heating a free piston "raises the pressure", pumping gas in "raises the temperature" | documented (struggles 1, 5), synthetic |
| predict | the factor applied the wrong way round (`inverse_factor`) | documented (struggle 2), synthetic |
| predict | the old value kept (`kept_value`) | inferred |
| predict, calculate | degrees Celsius divided (`celsius_ratio`) | documented (struggle 3) |
| calculate | only the first or the second change applied (`first_change_only`, `second_change_only`) | synthetic, inferred |
| calculate | the second ratio inverted (`ratio_inverted`) | inferred |

## Lever table (built, `gasLawsLevers.ts`)

| Mode | Lever | Kind | Answers | Leak rule |
|---|---|---|---|---|
| observe | particle_card | help | every miss | what the change does to the particles, and what P, V, T are in particle terms; `directionLeak` refuses a direction word next to the asked quantity |
| observe | held_label | help | every miss | what the container does (the piston slides until..., the steel cannot stretch, the bath, sealed); offered only when the ask names nothing held AND the asked quantity is not held (on a stays-the-same item it would be the answer) |
| predict, calculate | kelvin_scale | help | celsius_ratio | each Celsius temperature with its kelvin value; Celsius items only |
| predict, calculate | relation_card | help | every miss but celsius_ratio | what stays constant for this container, in words with no numbers |
| predict, calculate | factor_line | help | every miss | each change as a factor, temperatures in kelvin; names only the changed quantities; `valueLeak` refuses the key or the after value |
| predict | simpler_numbers | simplify | every miss | the same container, change and question with factor 2 or 1/2 in kelvin and held named; own id `<id>~simpler`, ungraded, key differs from the full item's; null when the item is already that simple |
| calculate | one_change | simplify | every miss | the same cylinder and question with only the first change (the second when the first alone gives the full key); ungraded; full item back |

Starting position: every lever starts released. `config.difficulty` picks the item structure (see the W1 report), not
the levers.

## Gates
- `GasLawsSimulator.workspace.test.tsx`: for every item built at every tier and focus, every miss its choices can show
  gets a help lever first from `nextLever`. Each lever changes the screen and the scene fact in one commit and rides the
  next attempt. No ask, particle card, held label or factor line states the asked quantity's direction or value. The
  simpler item keeps the mode and the question, never repeats the learner's item or key, and never shrinks twice.
- Sweep lever inventory: every catalog miss answered on every mode (J9, J12, J13 pass).
- Replay r3: stuck replies pull particle_card (observe), kelvin_scale or relation_card (predict) and one_change
  (calculate), and describe the practice item correctly.

## Failures with no lever
- observe has no simplify lever. There are already only three choices, and the only simpler shape (naming what is
  held) is `held_label`, a help lever, which is withheld where it would state the answer.
- A learner who cannot connect particle motion to pressure at all gets only particle_card on a stays-the-same item.
  The next lesson's prerequisite is the particle model (states-of-matter, matter-explorer), not a lever here.
