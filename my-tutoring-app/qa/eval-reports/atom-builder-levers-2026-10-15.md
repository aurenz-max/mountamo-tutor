# atom-builder — support levers, 2026-10-15

Built on the W1 binding (`qa/tutor-reports/atom-builder-w1-2026-10-15.md`). Not committed.

## Failure inventory
No real-learner evidence (no demonstrations, misconception or remediation files for atom-builder). Documented = the
catalog's `commonStruggles` (electrons before protons, ion sign, isotopes, identity from the proton count); synthetic =
the journey's scripted wrong builds; the rest inferred from the generated items.

| Mode | Failure (miss) | Class |
|---|---|---|
| classic | wrong proton count for the named element (`protons_off`) | documented |
| classic | wrong neutrons: mass number read as neutrons, or the usual isotope's count never stated (`neutrons_off`) | documented, inferred |
| classic | electrons not equal to protons, or the ion's sign flipped (`electrons_off`) | documented, synthetic |
| make_atom | not neutral / still neutral / charge sign or size off | documented, synthetic |
| make_atom | counts every electron instead of the outer ring (`shell_not_full`, `valence_off`) | inferred |
| make_atom | too few neutrons (`nucleus_off`); changes protons or nothing between isotopes | documented, synthetic |

## Lever table (built, `atomBuilderLevers.ts`)

| Items | Lever | Kind | Answers | Leak rule (code) |
|---|---|---|---|---|
| all | table_key | help | protons_off, neutrons_off; no_protons, nucleus_off | every cell gets symbol + usual mass number; the same table for every item (`tableKey`), lights only the learner's protons |
| classic with a neutron target | mass_meter | help | neutrons_off | "protons + neutrons = sum" from the learner's own counts (`massLine`), never the target |
| classic with an electron target; make_atom except isotopes | pair_up | help | electrons_off; the four charge misses | the learner's own particles paired (`pairUp`); says no number to add |
| make_atom full_shell, valence | ring_counts | help | shell_not_full, valence_off | each of the learner's rings as "n of cap" (`ringCounts`); refused with no electrons |
| make_atom isotopes | isotope_compare | help | different_element, same_neutrons | kept vs current protons and neutrons; refused with nothing kept |
| classic | one_part_first | simplify | all classic misses | make_ion: the neutral atom first; others: the nucleus only (electrons not checked); id `~first`, ungraded, instruction states no count |
| make_atom | simpler_ask | simplify | all but need_two | "any neutral atom", or a charge of one where two was asked (`simplerAsk`); id `~simpler`, ungraded; not the full ask |

`need_two` is listed unanswered: its words say to press Keep, and the button is on the board. Starting position: no
tier code (the generator reads no `config.difficulty`); every item starts bare.

## Gates
- `typecheck:lumina` 0 in these files; full tsc 770 for them.
- `AtomBuilder.workspace.test.tsx`: miss rules, `nextLever` help-then-simplify for the catalog misses, every catalog
  miss answered on a mode's items, the practice builders (no count in the instruction, the ask always easier and
  passable), each help lever drawn in the pull's commit with its scene fact, a repeat pull refused, refused pulls
  change nothing, the next attempt carries the lever, the practice item is ungraded and the full item comes back blank.
- Sweep lever inventory: every catalog miss answered on every mode, 0 gaps (J9, J12, J13 pass).
- Replay `-r2`: every stuck reply pulls `pair_up` itself and describes it after the call; 0 misses.

## Failures with no lever
- None by miss. The replay pulled only `pair_up` (the payloads' first items fail on electrons); the other levers are
  verified in the mounted test only.

## Open
- Write the leak rules into `docs/contracts/atom-builder.md` (none exists): `/primitive-contract`.
- Browser check on the keyed table (19 px cells, scrolls on a phone) and the pair row.
