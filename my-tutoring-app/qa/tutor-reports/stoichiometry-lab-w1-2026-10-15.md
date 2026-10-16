# stoichiometry-lab W1 binding (ROLLOUT C27), 2026-10-15

**Shape P, three modes, all bound** (convert, limiting, yield). Levers in `../eval-reports/stoichiometry-lab-levers-2026-10-15.md`. Not committed.

## What changed, and why
The old lab computed the answers on screen. Its "Run the reaction" panel, shown by default, printed the limiting
reagent, the grams of every product and the leftovers; the mole ladder printed each given's moles; a wrong answer's
feedback said "Expected about X g"; and the scripted tutor was sent `targetAnswer`, `limitingReagent` and the product
grams. The convert key was the model's own number (recomputed only when a tier was set), and a percent-yield item showed
a % unit but was checked against the theoretical grams. None of that could be bound, so the lab was rebuilt around
items code builds and keys from one balanced reaction (`stoichiometryLabWorkspace.ts`):

- **convert**: a start card ("64 g O2"), a goal card ("? mol H2O") and a tray of six factor cards drawn as fractions
  (both molar masses each way up, both ratios each way up). The learner taps cards into the chain and presses Check
  chain; the key is the card order. Tiers: 1 card (same substance), 2 (moles of another), 3 (grams of another), with a
  non-1:1 ratio preferred. This replaces typing a number: the conversion structure is what the mode teaches; the value
  is shown after credit.
- **limiting**: two jars by mass, drawn the same size; choose H2 / O2 / Both together, or say it. Key: smaller moles /
  coefficient. Tiers: no trap; the limiting reactant has the larger mass; it has more moles too (only dividing by the
  coefficient finds it). A pinned session asks one exact-ratio "both" item.
- **yield**: the same jars; type or say the grams of a product. Key: whole grams, never equal to a number already on
  screen. Tiers as limiting, plus a product whose coefficient differs from the limiting reactant's.

The generator now only picks one of 17 library reactions (balance checked by a test) and writes a title and a
one-line setting; molar masses come from the formulas. ~1300 lines became ~150. Percent yield is gone (it was never
checked correctly); the catalog description, constraints and mode descriptions say so. The frame is now the Lumina
kit. Legacy payloads still map onto items, with every key recomputed.

Answer channels: convert is gesture only (several picks; J14 does not apply). limiting and yield are `speech` with
`acceptsGesture` (J14), judged against `stoichExpectedAnswer`; spoken known misses use the tap's miss ids.

## Gates
- `typecheck:lumina` 0. Full `tsc` 770 (baseline 770); none in stoichiometry files.
- `StoichiometryLab.workspace.test.tsx` 14/14. live-activity + chemistry + `misses.test.ts` + ScienceWorkspaces Pip
  surface + chemistry grade-band (includes the full journey sweep): 62 files, 4845 passed, 0 failed. `lessonWorkspacePlan` gains the id.
- Payloads `w1-payloads/stoichiometry-lab.{convert,limiting,yield}.json` from `save_payload.py`, all real generations
  (convert and limiting: methane and hydrogen fuel-cell settings; yield: zinc with hydrochloric acid). No fallback.
- Sweep: 0 findings J1-J14 on the three payloads, misses named 3/3 each, J10 100, J11 67. Advisory: "both together" is
  in the scene facts as one of the listed choices.

## Replay (gemini-3.8-flash, 3 payloads x 5 samples, `--observe`)
| run | start | miss | stuck | lever | credit |
|---|---|---|---|---|---|
| r1 (`replay/stoichiometry-lab-2026-10-15.json`) | 4/15 | 0/15 | 5/15 | 3/15 | 0/15 |
| r2, replay keys + convert wording (`-r2.json`) | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 |
| r3, top/bottom rule (`-r3.json`) | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 |

Read by hand. r1's flags were false: the key list held "2" from "H2", so every "two moles" hit; the row now gives
`replayKeys` (the chain's result, "<reactant> runs out first", the yield grams). Reading found what the checks missed:
on convert, 4/5 lever replies and most miss replies stated the fix ("try swapping in a card whose bottom unit cancels
your starting grams", "what unit do you need on the bottom to cancel grams of oxygen?"). r2 still asked "what unit
needs to be on the bottom to cancel it" (2/5 stuck) and claimed the start card "has grams on top". Guidance now says
never say or ask which unit belongs on a card's top or bottom (the step the item checks), and that the start card has
no top or bottom. r3: convert replies ask what unit the start card is in and what the tracker says; limiting and yield
replies read the mole counts that are on screen and ask which runs out. No reply names the reactant, a gram amount or a
card before credit. Left: 2/5 convert lever replies say "try swapping cards" without naming one.

## Undriven modes
None. The spoken path is driven in the workspace test (limiting, said "hydrogen"); the sweep drives taps and typing.

## Open findings
- Saturation: on Zn + 2HCl the medium yield tier cannot exist (HCl at half-mole steps never gives half-gram masses
  with the mass trap), so that payload asks easy, easy, hard. On 2H2 + O2 the only product shares H2's coefficient, so
  hard yield has no non-1:1 ratio. Recorded on the item (`tier`); no executor needed unless the user wants the library
  filtered per tier.
- 1-2 of 5 stuck replies pull two levers in one turn and narrate one (same as mixing-and-dissolving).
  `/add-live-tutor-tools` (shared lever doctrine).
- The spoken-miss probe has no requests (the sweep taps). Next replay or `/eval-test`: one spoken program per mode.
- No `docs/contracts/stoichiometry-lab.md`; the new requirements (code keys, no computed panel, equal jars, library
  reactions) are recorded only here. `/primitive-contract`.
- Needs a browser check on the workspace path: the fraction cards, the chain row on a phone width, the jars.
- Percent yield and leftover amounts are not asked by any mode. `/add-eval-modes` if a lesson needs them.
