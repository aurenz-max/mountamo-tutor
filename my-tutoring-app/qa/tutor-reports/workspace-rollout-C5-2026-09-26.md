# Workspace rollout C5: habitat-diorama, matter-explorer, states-of-matter, solar-system-explorer (2026-09-26)

Queue: [`qa/workspace-rollout/ROLLOUT.md`](../workspace-rollout/ROLLOUT.md) row C5. Executor: `/add-live-tutor-tools`.

## What shipped

All four K–2 science families now run their challenges only on the teaching workspace, with every catalog mode
bound (one-path ruling 09-23). Each keeps its ungraded exploration face for a payload with no askable challenge,
as ramp-lab's sandbox does: the free diorama, the object shelf, the particle sim and the orrery.

| Primitive | Commit | Shape | Items | Production (+/−) |
| --- | --- | --- | --- | --- |
| habitat-diorama | `2e67363a` | R | Observe, predict, defend: one spoken choice from the screen. Connect (tap the living thing the relationship leads to) and restore (tap the zone): checked by the activity | +190 / −56 |
| matter-explorer | `5b5b5186` | R | One spoken answer per object: its state, what it does in a cup, whether a change can go back, a secret object's state from clues | +282 / −217 |
| states-of-matter | `a7e4821d` | R | One spoken answer from the substance table: the state its particles show, the state it will reach or the change, which of two melts first or stays solid | +206 / −152 |
| solar-system-explorer | `330ae84e` | R | One spoken planet name computed from the bodies on screen (classify accepts any member) | +206 / −126 |

Production +884 / −551. Tests +1,848 / −446: four `<X>.workspace.test.tsx` files, eight w1 payloads, two runner-mock
stage suites deleted (habitat, solar), and all four families left the shared runner-mock Pip suite
(`StimulusRunners.surface.test.tsx`); each workspace test now carries its Pip case. The test lines are mostly the
eight generated payloads.

Carried over and now tested on the workspace:

- **habitat-diorama:** tapping the lit start of a connection is exploration, not an attempt. A wrong destination
  commits and Try again reopens it. The explanation appears only after credit. The scene lists every living thing
  and zone without singling out the key, and marks a K-2 learner as not reading.
- **matter-explorer:** mystery never names the object to the tutor or the screen before credit. The property
  badges and the answer line appear only after credit.
- **states-of-matter:** no temperature, state label or particle caption is printed before credit; the beaker still
  ramps to the new temperature once the answer is credited.
- **solar-system-explorer:** identify withholds every planet label and the body card; a tap elsewhere opens the
  card and answers nothing.
- **matter-explorer and states-of-matter:** the tier lever survives. Below hard, the rule clause that names every
  option rides in the scene facts (`rule`); at hard there is none.

## Behaviour changes (recorded)

- **solar-system-explorer's spotlight paints when the item opens.** The runner held the identify and pair
  spotlight until the tutor had spoken the ask (`onPresentStimulus`). W1 offers no `present`, and the spotlight is
  the question, not the answer, so it now shows with the item. `readyForResponse` is true from the start.
- **The tap-to-hear button is gone on all four.** With the tutor present, the learner asks the tutor to repeat.
- **matter-explorer and states-of-matter no longer play their own success sound on the reveal.** The shared
  lifecycle plays it once.

## Smoke drives (`--lesson-entry --progression-only`)

| Row | Result | Raw file |
| --- | --- | --- |
| habitat-diorama connect text (taps) | PASS | `habitat-diorama-w1-connect-text-2026-09-26.json` |
| habitat-diorama observe `--audio` | PASS | `habitat-diorama-w1-observe-audio-2026-09-26.json` |
| matter-explorer sort text | PASS | `matter-explorer-w1-sort-text-2026-09-26.json` |
| matter-explorer change `--audio` | PASS | `matter-explorer-w1-change-audio-2026-09-26.json` |
| states-of-matter observe text | PASS | `states-of-matter-w1-observe-text-2026-09-26.json` |
| states-of-matter predict `--audio` | PASS | `states-of-matter-w1-predict-audio-2026-09-26.json` |
| solar-system-explorer identify text | PASS | `solar-system-explorer-w1-identify-text-2026-09-26.json` |
| solar-system-explorer compare_attribute `--audio` | PASS | `solar-system-explorer-w1-compare_attribute-audio-2026-09-26.json` |

All eight passed on the first run. Undriven modes: habitat restore, predict and defend; matter property and
mystery; states compare; solar order_from_sun, classify and orbital_reasoning. Each is covered by its workspace test
on hand-built items.

## Findings (recorded, not patched)

- **After a wrong answer the tutor often gives the answer or nearly gives it.** states-of-matter predict: "when
  water is heated past its boiling point of 100 degrees, it changes into a gas", then credited "gas".
  solar-system identify: "look closely at the planet that is closest to the bright yellow Sun". habitat observe:
  "take a look at the floating green mats". This is C4's leading-hint finding, now in four families. The doctrine
  allows teaching after an attempt, and LA-13 credits an answer the tutor modelled, so it is not a W1 defect. Whether
  a credit after the tutor said the answer should count as independent is a scoring question for
  `$student-data-loop` (the attempt records `answerExposure`).
- **A later item is sometimes opened without its specifics.** habitat connect item 2: "Now let's find the next
  connection in our pond habitat", without naming the lit start. The start is lit on screen, but a Grade 2 learner
  may not read its name. Same shape as C3's summarised stories and C4's unread riddle.
- **states-of-matter observe opened with a step question** ("How are the particles moving?") before the ask. This
  is an allowed decomposition, not an answer leak.

## Checks

- `typecheck:lumina` 0; full `tsc` 770 (baseline 770).
- The four workspace tests, the existing biology, chemistry and astronomy suites (script, reader-fit, generator),
  pip, service/qa, manifest, evaluation and live-activity: 146 files, 1,710 tests pass.
- The generic W1 contract passes on the eight new payloads.

Human acceptance (browser and mic) remains open under HUMAN-CHECKS #167. jsdom cannot tell whether the orrery's
moving `<g>` targets are hittable in a real browser.
