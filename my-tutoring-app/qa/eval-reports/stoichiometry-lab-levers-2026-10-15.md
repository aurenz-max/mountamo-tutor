# stoichiometry-lab: support levers, 2026-10-15

Built on the W1 binding (`qa/tutor-reports/stoichiometry-lab-w1-2026-10-15.md`). Not committed.

## Failure inventory
No real-learner evidence: no demonstrations, misconception, remediation or eval-report files for stoichiometry-lab.
Documented = the old catalog commonStruggles (grams multiplied by coefficients, the smaller mass picked as limiting,
the mole ratio skipped, the excess reactant used); synthetic = the journey's scripted wrong answers; the rest inferred.

| Mode | Failure (miss) | Class |
|---|---|---|
| convert | a molar-mass card upside down (`upside_down_molar_mass`) | documented (grams used as moles), synthetic |
| convert | the ratio card upside down (`upside_down_ratio`); goal's molar mass where the ratio goes (`skipped_ratio`) | documented (struggle 3), synthetic |
| convert | chain stopped early or went past the goal; right cards out of order; another substance's card | inferred |
| limiting | chose the lighter reactant (`smaller_mass`) | documented (struggle 2), synthetic |
| limiting | chose the reactant with fewer moles, ignoring coefficients (`fewer_moles`) | documented (struggle 5), synthetic |
| limiting | one reactant when both run out together, or the reverse (`missed_both`, `said_both`) | inferred |
| yield | the grams the excess reactant would make (`from_excess`) | documented (struggle 5), synthetic |
| yield | no mole ratio (`skipped_ratio`), ratio upside down, the two masses added (`mass_sum`) | documented, inferred |

## Lever table (built, `stoichiometryLabLevers.ts`)

| Mode | Lever | Kind | Answers | Leak rule |
|---|---|---|---|---|
| convert | unit_track | help | every convert miss | the unit after each placed card, or "does not cancel"; names no card to place |
| convert | mole_map | help | skipped_ratio, stopped_short, extra_step, out_of_order, wrong_card | stations only (grams/moles of each substance), start and goal marked; `mapLeaks` refuses a number or a card |
| limiting, yield | mole_counts | help | limiting: smaller_mass, other_reactant, both misses; yield: from_excess, mass_sum, other_amount | each jar's moles only; `amountLeverLeaks` refuses "runs out", "excess", "left over", a run count, the yield key |
| limiting, yield | recipe_card | help | limiting: fewer_moles, both misses, other_reactant; yield: skipped_ratio, upside_down_ratio, from_excess, other_amount | one run of the equation as dots (the coefficients); never how many runs the jars allow |
| every mode | easier_item | simplify | every miss | a different item of the same mode one tier lower (one card fewer; one trap fewer), id `<id>~easier`, ungraded, never the learner's amounts; none on an easy item |

Starting position: every lever starts released. `config.difficulty` sets the item's structure instead (the
`/add-item-space` pattern): convert one, two or three cards; limiting and yield no trap, the mass trap, then the mole
trap.

## Gates
- `StoichiometryLab.workspace.test.tsx` 14/14: each lever changes the screen and the scene fact in one commit and rides
  the next attempt; the unit marks read `→ mol O2`, `does not cancel`; the mole-count and recipe lines pass
  `amountLeverLeaks`; `nextLever` gives a help lever first for every catalog miss on every item; `easier_item` is the
  same mode one tier lower, on other amounts, and the full item comes back.
- Sweep: J9, J12, J13 pass on all three payloads (every checked miss answered by a lever on its item; no help lever
  puts the key anywhere new).
- Replay r3: every miss and stuck reply pulls the mode's help lever itself and asks the learner to read it.

## Failures with no lever
- None in the miss lists. Not covered by any mode: percent yield (removed, it was never checked correctly) and
  leftover-reactant amounts. A leftover mode would need `/add-eval-modes`.
