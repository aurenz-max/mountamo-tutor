# how-it-works W1 binding (ROLLOUT C33, R1 batch 4), 2026-10-16

**Shape P, three modes, all bound** (guided, sequence, predict). Levers in `../eval-reports/how-it-works-levers-2026-10-16.md`. Not committed.

## Verdict on the old screen, and what changed
The old primitive's questions were all written and keyed by Gemini: identify, predict and explain were four-option
multiple choice with a model-picked `correctIndex`, and the explanation shown after each answer came from the same call.
Nothing checked that the key matched the steps. Sequence items were model-authored lists keyed by their authored order.
The score gave 30% for scrolling past the steps. A pre-reader got the picture order whatever the lesson pinned.

Rebuilt so code builds every question from the steps and keys it from their order (`howItWorksWorkspace.ts`). Gemini
writes only the process: per step a title, a description and (new) a `purpose` sentence, plus the magazine extras.
- **Reading first.** The exhibit (or, for a pre-reader, the picture steps in order) is the teaching; the questions open
  on Start. Scripted path: Start unlocks after every step has been scrolled past (as before). Workspace path: Start is
  always enabled and the scene says `phase: reading` (`readyForResponse: false`) until it is pressed.
- **guided** (identify): a step's description with every word that shares a stem with its own title blanked
  ("Your legs ___ down on the ___"); which step is it? The numbered step list (titles only) stays on screen. easy: three
  choices, none next to the right step; medium: four, one a neighbour; hard: four, both neighbours.
- **sequence**: tap cards into numbered slots and Check (easy three steps in a row, medium four, hard every step shown as
  its blanked first sentence); then two identify items with no step list. The tray is never the order or its reverse.
- **predict**: the first steps are shown, the rest hidden; what happens next? easy: wrong choices far away; medium: one
  is the step after next; hard: both wrong choices come later in the process. Plus two **explain** items when every step
  has a purpose: why does step N matter? The choices are what each step makes possible; the asked step's title words are
  blanked in every choice alike, so a blank never marks the key.
- **Pre-reader**: the same kinds over the picture steps (find the picture the tutor describes, put the pictures in order,
  what comes next); a tap checks itself, no Check button.
- identify and predict answers (a step's name) are `speech` with `acceptsGesture` (J14), with spoken misses; orders and
  purposes are gestures. Misses (`howMiss`): `neighbour_step`, `far_step` (identify, explain), `skipped_ahead`,
  `went_back` (predict), `adjacent_swap`, `reversed`, `one_moved`, `two_swapped`, `mixed_order` (sequence).
- Catalog description, constraints and eval-mode descriptions rewritten to match. Eval-mode ids and betas unchanged;
  `problem_type_registry.py` not touched.

## Rulings (closed 2026-10-16) (removed or reshaped)
**Accepted by the user 2026-10-16** (`../HANDOFF-r1-batch4-rulings-2026-10-16.md`): R12 tap-into-slots, R18 accuracy-only score, R21 one question of each kind, R26 `purpose` field (follow-up `/topic-fidelity how-it-works`).
- **Model-written questions and their explanations are gone.** A legacy payload's `challenges` are read only for their
  kinds; its questions are rebuilt from its steps. Explain now depends on the new per-step `purpose` field: a payload
  without purposes gets predict items only in predict mode.
- **Pre-reader flow changed**: story first (pictures in order, read aloud), a play button, then picture questions that
  follow the pinned mode. Before, K always got the order task and the scripted path submitted on the correct order; it
  now submits after See Results. `[PRE_WRONG]`/`[PRE_COMPLETE]` tags replaced by the shared question tags.
- **No mode pinned** now gives one question of each kind (identify, sequence, predict, explain; a pre-reader the order),
  not a model-chosen mix.
- **Scripted score** is the share of questions answered (two tries, then the answer is shown); the 30% exploration share
  is gone. A process with fewer than three steps is display-only, as before.
- **Sequence control** changed from up/down arrows to tap-into-slots (the pre-reader control, now used by every band).

## Gates
- `typecheck:lumina`: 0 errors in these files (2 foreign: `EngineeringPrimitivesTester.tsx`,
  `VehicleComparisonLab.workspace.test.tsx`). Full `tsc` not run (orchestrator).
- `HowItWorks.workspace.test.tsx` 12/12; `HowItWorks.reader-fit.test.tsx` 4/4 (re-based on the story-first flow);
  `ExhibitWorkspaces.surface.test.tsx`, `misses.test.ts`, `activityContract.test.ts`, `lessonWorkspacePlan.test.ts`:
  386 passed across the six files. `workspaceContract.test.tsx -t how-it-works` 13/13 (its "every family has a payload"
  case fails only on `vehicle-comparison-lab`, another agent's).
- Payloads `w1-payloads/how-it-works.{guided,sequence,predict}.json` (Grade 4; guided medium, sequence hard, predict
  hard). The first sequence payload showed the tray as the exact reverse order; `bankFor` now refuses the order and its
  reverse and counts backward neighbours too; payload re-saved.
- Sweep `-t how-it-works`: 0 findings J1-J15 on all three payloads; misses named 3/3, 4/4, 3/3; J15 spoken practice credit
  driven on each. Advisories ("scene facts contain the key") are the choice lists, which are on screen.

## Replay (gemini-3.8-flash, `TUTOR_REPLAY_ITEMS=all`, 10 items x 5 samples, `--observe`; `replay/how-it-works-2026-10-16{,-r2,-r3,-r4}.json`)
Read every start, miss, stuck, lever and credit reply on each run.
- **r1.** By reading: predict "think about what that turning toothed wheel connects to and pulls next" (1/5; "pulls" is the
  key's verb), explain "think about what the bicycle chain connects" (1/5, the key's content). Guidance: never describe
  what the next step does or hint with a word from a choice's name; never say what the asked step carries or connects.
- **r2.** Explain clean. Sequence stuck 2/5 pointed at the first card as a question ("what your body touches first when
  you get on a bike"). Guidance: never point to a card even as a question. (r2 had 18 empty replies: 429 rate limits.)
- **r3** (concurrency 2). Sequence stuck 1/5 "see what happens right after your foot pushes down" (implies the first card).
  Guidance: never say or imply what comes before or after any card; the "ask what has to happen before or after"
  allowance now excludes sequence.
- **r4.** No reply states a key, names the right card by description, states the fix or claims something not on screen.
  Replies point at the lever by what the scene says, then ask; credits cite the learner's choice.

Automatic flags read and dismissed: `no_protocol_leak` on "Levers"/"lever" (the step title "Stepping on the Levers" and a
description's word), and `no_key_before_try` when the tutor names the two choices left after `two_choices` (both are on
screen; neither is marked).

## Undriven modes
None. The sweep taps every kind; the workspace test drives a spoken identify answer.

## Open findings
- Needs a browser check: reading → Start → questions, tap-into-slots, the step list per mode, crossed-out choices, the
  pre-reader story and picture questions. Only JSDOM has run them. `/eval-test`.
- No `docs/contracts/how-it-works.md`; the requirements (code keys, own title blanked from a clue, tray never the order or
  its reverse, no step list in sequence, reading before questions) live only here. `/primitive-contract`.
- The spoken path is not swept (the row taps), so the spoken-miss probe has no requests. `/eval-test`.
- `replay_checks.py` false positives above (a step title containing "lever"; the two remaining choices named after
  `two_choices`). `/add-live-tutor-tools` (replay checks).
- Model content can be loose: a purpose said a chainring "multiplies the force". `/topic-fidelity`.
- Blanking takes a key title's generic words too ("metal" in "Pulling the Metal Links" blanks three words of the last
  step's description). Readable; `/eval-fix` if it bothers a reader.
- First-person lever narration ("I crossed out two choices") is common in miss and stuck replies (not counted): the
  shared lever doctrine's owner.
- The catalog `tutoring` block (scripted fallback) still lists a `[STEP_NAVIGATION]` directive nothing sends; remove when
  the fallback is retired.
