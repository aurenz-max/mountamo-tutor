# energy-of-reactions W1 binding (ROLLOUT C27), 2026-10-15

**Shape P, three modes, all bound** (classify, diagram, bond_energy). Levers in
`../eval-reports/energy-of-reactions-levers-2026-10-15.md`. Not committed.

## Why it was rebuilt
The old screen answered its own questions. The header had a badge reading "Exothermic" or "Endothermic". The title had
a fire or snowflake icon, and the panels were coloured orange or cyan by type. The real-world panel said "X is an
exothermic reaction". The diagram had labelled "Ea" and "ΔH = −890 kJ" arrows. The bond panel printed both totals and
"Net: ... Exothermic". The Start button had the type's icon. Every challenge (options, key, hint) came from Gemini, and
a wrong answer showed the generated hint. The catalog's `diagram` and `bond_energy` modes named challenge types the
generator never wrote, and the generator ignored the pin. None of it could be bound as it was.

Rebuilt around items that code builds and keys (`energyOfReactionsWorkspace.ts`):
- **classify**: a named reaction from a code library of 10 classroom reactions, including baking soda and vinegar
  (cools) and magnesium and HCl (warms). The learner presses Run the reaction, and the thermometer moves from its start
  reading to its end reading. The question is releases or absorbs energy. The key is the sign of the temperature
  change. No name says hot, cold, burning or what the reaction is used for (`NAME_LEAKS`). The two kinds alternate, and
  both are always present.
- **diagram**: an energy diagram on a 0-600 kJ grid with lines labelled Reactants and Products, and no arrows or values.
  Questions, in order: direction, then energy change (unsigned at 5-6, signed ΔH at 7-8), then activation energy, then
  how much a catalyst lowers it (7-8). Keys are arithmetic on the levels. The templates are picked so every distractor
  is a different number, and the choices are sorted by value.
- **bond_energy**: the equation and a table of bonds broken and formed (count and energy per bond), with no totals.
  The learner chooses ΔH. The key is energy in minus energy out, from a code table of average bond energies. The
  session gets three reactions of increasing size and both signs (H2 + Cl2, splitting water, methane and oxygen).
  Misconceptions become distractors: subtracted backwards, each bond counted once, totals added.

The generator now writes only the title, a description, and which library reactions to run (a schema enum). It reads
the pin and stamps `challengeTypes`. For a lab without classify, code replaces a title that names none of the asked
tasks: two of two model titles talked about temperature. The description, real-world fact and arrows show only after
credit. The frame is now the Lumina kit; the accordion and the catalyst toggle are gone. The catalog description,
constraints and mode descriptions say what the primitive now does. Legacy fields still type-check, and an old payload
(the Pip fixture) still renders from the library.

Every item is a sayable choice, so it is `speech` with `acceptsGesture` (J14). Misses come from `energyMiss`, with
the same ids as `energySpokenMisses`:
- classify: `cooling_called_release`, `warming_called_absorb`
- diagram: `direction_reversed`, `sign_flipped`, `read_level`, `read_activation`, `read_peak_height`, `read_delta_h`,
  `from_products`, `catalysed_ea`, `full_ea`
- bond_energy: `subtracted_backwards`, `ignored_counts`, `added_totals`

## Gates
- `typecheck:lumina` 0. Full `tsc` 770 (baseline 770), none in energy files.
- `EnergyOfReactions.workspace.test.tsx` 12/12.
- live-activity, `misses.test.ts`, the ScienceWorkspaces Pip surface and the chemistry grade-band tests: 4135 passed.
  One failure, `lessonWorkspacePlan`, is the stoichiometry session's id, which is registered but not yet in its list.
  `energy-of-reactions` is in the list.
- Payloads `w1-payloads/energy-of-reactions.{classify,diagram,bond_energy}.json` come from `save_payload.py`, at
  grades 6, 7 and 8. All three are real generations: the model picked 4-5 library reactions, and the diagram title is
  code's after the change above.
- Sweep: 0 findings J1-J14. Misses named 5/5, 4/4 and 3/3. J10 100, J11 67. The advisory "scene facts contain the
  key" is the choice list.

## Replay (gemini-3.8-flash, 3 payloads x 5 samples, `--observe`)
| run | start | miss | stuck | lever | credit |
|---|---|---|---|---|---|
| r1 (`replay/energy-of-reactions-2026-10-15.json`) | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 |
| r2, totals-card rule (`-r2.json`) | 0/15 | 0/15 | 1/15 | 0/15 | 0/15 |
| r3, no comparisons, no partial credit (`-r3.json`) | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 |

Read by hand:
- **r1.** Classify and diagram were clean. In bond_energy, with the totals card on screen, 3 of 5 stuck replies
  restated the subtraction with the numbers' roles ("subtract the formed bond energy from the broken"). One asked
  "Which total is larger here?" and one miss reply asked "Which sign does that give you?". The last two give away
  the sign.
- **r2** (guidance: never say which total is larger or which sign the answer has). Still one "which total is larger"
  and one "You've got the number right! ... check the sign", which says how close the choice was. Two diagram lever
  replies said "When the products end up lower than the reactants...", which makes the comparison for the learner. One
  classify reply said "when the water cools down". One reply said "I pulled the totals lever" (protocol word, flagged).
- **r3** (guidance: never make a comparison the learner is asked to make; never say a wrong answer's number or sign
  was right). Every stuck reply pulls the mode's help lever and asks the learner to read it. No reply names a key,
  compares two levels or readings, or says a reading's meaning. One bond stuck reply asks "what sign should your
  answer have?" (1/5). That is a question with no sign named; recorded below.

## Undriven modes
None.

## Open findings
- The replay records only each payload's first item, so these kinds were not replayed: activation, delta_h and
  catalyst in diagram, and the larger bond tables. → next replay of this family.
- 1/5 bond stuck reply asks the learner which sign the answer should have. Fixed-unmeasured; read off the next weekly
  sample. → `/add-live-tutor-tools`.
- r2's "I pulled the totals lever" names the mechanism (shared doctrine, 1/15). → `/add-live-tutor-tools`.
- The sweep drives taps only, so the spoken-miss probe has no requests (the workspace test drives speech). → next
  `/eval-test` of this family.
- No `docs/contracts/energy-of-reactions.md`. → `/primitive-contract`.
- Needs a browser check on both paths: the thermometer animation, the diagram grid and the lever overlays, the bond
  table's subtotals. JSDOM only.
