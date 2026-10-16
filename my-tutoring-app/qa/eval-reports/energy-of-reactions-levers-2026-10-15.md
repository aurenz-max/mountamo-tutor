# energy-of-reactions: support levers, 2026-10-15

Built on the W1 binding and rebuild (`qa/tutor-reports/energy-of-reactions-w1-2026-10-15.md`). Not committed.

## Failure inventory
There is no real-learner evidence: no demonstrations, misconception, remediation or eval-report files exist for this
primitive. "Documented" means the old catalog commonStruggles: exo and endo confused, diagram direction, activation
energy versus ΔH, bond-energy arithmetic. "Synthetic" means the journey's scripted wrong taps. The rest is inferred.

| Mode | Failure (miss) | Class |
|---|---|---|
| classify | cooler water called "releases" (`cooling_called_release`); warmer called "absorbs" (`warming_called_absorb`) | documented, synthetic |
| diagram | direction read the wrong way (`direction_reversed`) | documented, synthetic |
| diagram | ΔH with the wrong sign (`sign_flipped`) | documented, synthetic |
| diagram | a level read from zero as the change or the climb (`read_level`, `read_peak_height`) | inferred |
| diagram | activation energy and ΔH swapped (`read_activation`, `read_delta_h`) | documented |
| diagram | climb measured from the products (`from_products`) | inferred |
| diagram | the catalysed climb or the full climb given for the drop (`catalysed_ea`, `full_ea`) | inferred |
| bond_energy | out minus in (`subtracted_backwards`) | documented, synthetic |
| bond_energy | each bond counted once (`ignored_counts`); totals added (`added_totals`) | documented, inferred |

## Lever table (built, `energyOfReactionsLevers.ts`)

| Mode | Lever | Kind | Answers | Leak rule |
|---|---|---|---|---|
| classify | start_mark | help | every miss | a marker at the starting reading beside the reading now; refused before the run |
| classify | heat_flow_card | help | every miss | the same three-line card on every item; it marks no line |
| diagram | level_values | help | every miss | writes each level's kJ value; no arrow, no difference |
| diagram (not direction) | start_line | help | every miss | a dashed line carrying the Reactants level across; no arrow, no number |
| diagram (not direction) | fewer_choices | simplify | every miss | a different template of the same question (`PRACTICE_DIAGRAM`) with three values, id `<id>~practice`, ungraded |
| bond_energy | row_totals | help | every miss | each row's count × energy = subtotal; no column totals |
| bond_energy | in_out_totals | help | every miss | the two totals and "ΔH = energy in − energy out"; `totalsLeak` refuses the difference and any kind word |
| bond_energy | simpler_reaction | simplify | every miss | the nearest smaller reaction by bond rows, then by bonds counted; never the current one; none for the smallest table |

Starting position: there is no tier code. Every item starts with every lever released (the generator reads no
`config.difficulty`).

## Gates
- `EnergyOfReactions.workspace.test.tsx` checks the following:
  - every wrong choice of every item names a catalog miss, and `nextLever` gives a help lever first for each
  - each lever changes the screen and the scene fact in one commit and rides the next attempt
  - start_mark is refused before the run
  - the totals card never shows the difference
  - a simplify pull opens a different item of the same question and the full item comes back
  - a simpler item never shrinks twice and has no levers of its own
- Sweep lever inventory: every catalog miss is answered on every mode, 0 gaps (J9, J12, J13 pass).
- Replay r3: every stuck reply pulls the mode's help lever itself and asks the learner to read what it shows.

## Failures with no lever
- classify and diagram-direction items have no simplify lever. They already have only two choices, and a "simpler"
  reading of a thermometer or of two levels is the same task.
- The smallest bond table (H2 + Cl2) has no simpler reaction. Its help levers cover its misses.
