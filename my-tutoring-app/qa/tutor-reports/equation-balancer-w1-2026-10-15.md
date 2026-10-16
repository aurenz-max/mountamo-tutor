# equation-balancer W1 binding (ROLLOUT C27), 2026-10-15

**Shape P, three modes, all bound** (simple, guided, complex). Levers in `../eval-reports/equation-balancer-levers-2026-10-15.md`. Not committed.

## What changed, and why
The old screen could be solved without reasoning about atoms. A live atom counter coloured every element red or green
with a "Match?" column, a scale tipped and printed both totals, a "Balanced!" badge and a celebration fired the moment
the numbers hit the key, and the steppers locked there. A learner could press + until everything went green. The three
eval modes (simple, guided, complex) were difficulty labels the generator ignored. Its `count_atoms` and
`spot_imbalance` challenges asked a question ("how many hydrogen atoms on the left?") that no control could answer: the
only answer was balancing. Balanced but not smallest (4, 2, 4) was credited. Guided mode printed both counts of the
focus element.

Rebuilt around a code bank of 32 real reactions (`equationBalancerWorkspace.ts`). Code parses each formula
(parentheses included), solves the smallest whole-number key, and sorts each equation into a mode by its structure:
- **simple (count atoms)**: the equation printed with its key numbers in front; how many atoms of one element on one
  side? Code picks the side and element where the number in front and the small number both matter. Four number
  choices built from misconceptions; tap and Check Answer, or say it (speech + `acceptsGesture`, J14).
- **guided (balance)**: each element sits in one formula per side. + and − per formula, Check Balance. Credited only
  at the smallest whole numbers.
- **complex (balance, shared element)**: an element is in two formulas on one side (combustion, respiration,
  sodium in water).
The screen shows no atoms, totals or match marks until a check or a lever. The real-world line shows only after
credit. A blended session never counts and balances the same equation, because a count item prints that equation's
key. The generator lets Gemini pick bank ids per mode for the topic and write the title and the real-world lines (code
drops a line that gives a number in front of a formula). It reads the mode pin. The frame moved to the Lumina kit; undo/redo, the scale,
guided mode and the conservation accordion are gone. The catalog description, constraints, mode labels and the
backend prior descriptions (`problem_type_registry.py`) were rewritten to match. Mode ids and betas are unchanged.

Misses (`countMiss`, `balanceMiss`): simple `ignored_coefficient`, `ignored_subscript`, `ignored_parentheses`,
`one_compound_only`, `added_not_multiplied`, `miscounted`; guided `not_lowest`, `one_element_off`, `several_off`;
complex adds `shared_element_off`. On the workspace path a wrong check stays marked ("Not balanced yet.", or for
`not_lowest` "Every element matches, but these are not the smallest whole numbers.") until Try again, which keeps the
learner's numbers. The scripted path keeps Next and reveals after 2 (count) or 3 (balance) misses.

## Gates
- `typecheck:lumina` 0. Full `tsc` 770 (baseline 770), none in equation-balancer files.
- `EquationBalancer.workspace.test.tsx` 14/14. live-activity + chemistry primitives + chemistry service + `misses.test.ts`
  + ScienceWorkspaces Pip surface: 62 files, 4845 passed (the legacy-shape Pip fixture still renders).
- Payloads `w1-payloads/equation-balancer.{simple,guided,complex}.json` (Grade 7, band 6-7): real Gemini picks
  (water, table salt, rust, methane; water, table salt, rust; methane, propane, respiration) with topic lines.
- Sweep: 0 findings J1-J14 on all three; misses named 4/4, 3/3, 3/3; J10 100, J11 67; no advisories.

## Replay (gemini-3.8-flash, 3 payloads x 5 samples, `--observe`)
| run | start | miss | stuck | lever | credit |
|---|---|---|---|---|---|
| r1 (`replay/equation-balancer-2026-10-15.json`) | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 |
| r2, element rule (`-r2.json`) | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 |

I read every reply. In r1 the checks passed, but on balance items the tutor named the element that was off: "Count the
hydrogen atoms on the left side and then on the right side" with no lever pulled, and "Take a look at the oxygen atoms
on the left side and the right side" on 4 of 5 guided stuck replies. That points the learner at the fix. The guidance
now says never name the element that is off or the one to start with, and to ask which element the learner will count
first. In r2, 2 of 30 balance miss and stuck replies still name elements ("how do the counts for hydrogen and oxygen
compare", "how do the oxygen atoms compare?"). The rest ask the learner to choose or compare. No reply states a number
to set, a total or a formula to change. On count items every reply pulls `molecule_view` and asks the learner to count
the drawn O balls. Credit replies give the solved numbers after credit; 2 of 15 credit the balance to one number ("by
adjusting water to two").

## Undriven modes
None. Spoken counts are driven in the workspace test (`say` + tutor verdict). The sweep taps, so the spoken-miss probe
has no requests.

## Open findings
- 1 of 5 guided stuck replies made only tool calls and said nothing. 2 replies pulled `atom_tally` and
  `molecule_view` in one turn and described only one. This is the shared lever doctrine problem mixing-and-dissolving
  also reported. `/add-live-tutor-tools` (WORKSPACE_DOCTRINE).
- The replay covers only each payload's first item, so no count item with two formulas holding the element (methane)
  was replayed. Pointing at one formula there leads to `one_compound_only`. Next replay of this family.
- No `docs/contracts/equation-balancer.md`. The new requirements (bank keys, smallest-numbers credit, no counts or
  match marks before a check, one mode per equation per session) are recorded only here. `/primitive-contract`.
- Needs a browser check on the workspace path: steppers, molecule balls for large numbers (6 C6H12O6), tally panel.
  JSDOM only.
