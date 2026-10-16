# mixing-and-dissolving W1 binding (ROLLOUT C26), 2026-10-15

**Shape P, three modes, all bound.** Levers in `../eval-reports/mixing-and-dissolving-levers-2026-10-15.md`. Not committed.

## The modes were not real before this slice
The catalog's `dissolve`, `classify` and `separate` named challenge types (`dissolve`, `classify`) that the generator
never wrote, and the generator ignored the pin: every mode got the same mixed set, and no lesson ever got a classify
question. The generator now reads `targetEvalMode` (catalog `challengeTypes` re-based to the real types):
- `dissolve`: "does it dissolve?" items built in code from each substance's `type` (the field the beaker draws from, so
  the key and the experiment agree), then the model's one particle question.
- `classify`: "a solution, a suspension or two layers?" items built in code from `type`.
- `separate`: the model's separation-method questions only.
Unpinned generation is unchanged apart from the option order (below).

## What is checked by code
One tapped choice and Submit Answer, checked against `correctOptionIndex`, or said aloud (speech item with
`acceptsGesture`, J14). Misses (`dissolvingMiss`): `chose_dissolves`, `chose_does_not_dissolve`, `chose_disappeared`,
`chose_sank`, `called_solution`, `called_suspension`, `called_layers`, `filter_for_dissolved`,
`evaporate_for_undissolved`, `other_method`, `other_choice`; spoken known misses list the wrong choices under the same
ids. The tutor gets the question, the choices, the beaker's contents by amount (never what they look like) and the
learner's choice. The scripted path keeps its hint, Next Challenge and scoring.

## Pedagogy leaks fixed (both paths)
- The shelf printed "Dissolves" / "Does not dissolve" / "Does not mix" under a substance once added: hidden while a
  challenge is open (the beaker is what to read).
- The particle view's caption said "Dissolved particles spread out among the solvent molecules!", the particle
  question's answer: now it only names the dots.
- The "What is dissolving?" notes state every rule asked about: shown only when no challenge is open.
- Separation tools during a separation question: trying each tool answered it. Put away during that question.
- The model put the key in the same slot on every question (3 of 3 separation questions at choice 2): code places the
  key per question. Payload description "watch their tiny particles spread out" is hidden while a challenge is open
  (`descriptionLeaks`), and the prompt forbids it.
- Workspace path only: a wrong check showed the generated hint (one said "turns into steam" for evaporation). It now
  shows "Not quite." and the choice stays marked until Try again.

## Gates
- typecheck:lumina 0. Full tsc 770 (baseline 770), no error in a mixing file.
- `MixingAndDissolving.workspace.test.tsx` 22/22. live-activity + chemistry + `misses.test.ts` + ScienceWorkspaces
  surface: 56 files, 4705 passed. `lessonWorkspacePlan` gains the id.
- Payloads `w1-payloads/mixing-and-dissolving.{dissolve,classify,separate}.json` via `save_payload.py`, real content
  (grade 4, Kitchen lab: salt, sugar, sand, cooking oil). No generator fallback.
- Sweep: 0 findings J1-J14, misses named 11/11, J10 100, J11 67 on each. Advisory: the key is in the scene facts as
  one of the listed choices (the buttons), kept so the tutor can read them.

## Replay (5 samples x 3 modes, `--observe`)
| run | start | miss | stuck | lever | credit |
|---|---|---|---|---|---|
| first guidance (`replay/mixing-and-dissolving-2026-10-15.json`) | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 |
| + three model beakers on sort, "never say it disappeared" (`-r2`) | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 |
| + "never point at a method card by what it does" (`-r3`) | 0/15 | 0/15 | 0/15 | 0/15 | 0/15 |

Read by hand. Run 1: on the cooking-oil sort item the two models (dissolves, sits on the bottom) matched neither,
and the tutor still said "see which model it matches", so sort now draws a floating layer too. One reply read a model
as "a solution where bits disappear", the documented misconception. Run 2: separate replies pointed at the right card
by what it does ("which method leaves behind something that dissolved?", "look over what happens to dissolved
substances", 3 of 15). Run 3: no reply names a key, rules a choice out or points at a card; every stuck reply pulls the
mode's help lever and describes it after the call.

## Undriven modes
None. Spoken answers are driven in the workspace test (`say` + tutor verdict); the sweep drives taps.

## Open findings
- The replay records only each payload's first item, so the particle question (dissolve, item 4) was not replayed.
  Next replay of this family.
- 1-2 of 5 separate stuck replies pull `drop_far_choice` and `method_cards` in one turn and narrate only the cards. A
  greyed choice the tutor does not mention. `/add-live-tutor-tools` (shared lever doctrine), read off the weekly sample.
- The separate key and the `worksFor` lists are the model's; nothing checks the key against `worksFor`. `/oracle-test`.
- Scripted path: the generated hint after a wrong answer can name the method. `/eval-fix`.
- No `docs/contracts/mixing-and-dissolving.md`. `/primitive-contract`.
- Browser check on the workspace path (model beakers, method cards, greyed choice, shelf labels): JSDOM only.
- Frame still raw shadcn (Card, Button, Accordion). `/migrate-primitive`.
