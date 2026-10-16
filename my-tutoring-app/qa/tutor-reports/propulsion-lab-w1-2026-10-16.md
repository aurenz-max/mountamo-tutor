# propulsion-lab W1 binding (ROLLOUT C29, R1 batch 4), 2026-10-16

**Shape P, three modes, all bound** (predict, observe, experiment). Levers in `../eval-reports/propulsion-lab-levers-2026-10-16.md`. Not committed.

## Verdict on the old screen, and what changed
The old primitive did not teach through its modes. All three modes were the same task: a four-option multiple-choice
question that Gemini wrote and keyed. The right option was usually the longest one ("Nothing happens because there are
no air particles to push!"), and nothing in the question depended on the simulation. The simulation was a free sandbox
that gave away the answers: the medium buttons said "(empty)" next to Vacuum, the canvas wrote "NO THRUST! Propeller
needs a medium to push against!" and drew labelled ACTION and REACTION arrows, a "Key Discovery" card stated the vacuum
rule, and live readouts showed thrust and speed. Exploration counted for half the score (combinations tried, a
no-thrust moment seen), and the evaluation passed at 40%.

Rebuilt so that each mode is a task with a code-built key (`propulsionWorkspace.ts`). A craft carries one or two engines
(jet engine, rocket engine, propeller, sail). An engine pushes the craft the opposite way from its blast, and a sail goes
with the wind. A jet engine, a propeller and a sail need air; a rocket engine does not. The motion is the sum of the
working pushes: Moves left, Moves right or Stays still.
- **predict**: the craft is described and drawn with its engines off; the learner says or taps what it does when they
  start, and only then does it run. easy states how each engine works and that space has no air. medium leaves that to
  the learner and turns some engines round so they blast forward. hard has two engines aimed opposite ways: equal,
  one bigger, or one that cannot work in space.
- **observe**: the craft is held by a clamp with its engines running, and streams are drawn with one tick per unit. The
  learner says which way it goes when the clamp lets go. easy has one stream. medium adds an engine switched on with
  nothing coming out (a propeller or jet in space) and two equal streams. hard has two opposite streams that are equal
  or one unit apart.
- **experiment** (fair test): a question ("Does a jet engine need air to push a craft along?", "In space, which can push
  a craft: a rocket engine or a propeller?", "Does a propeller push harder on high throttle?"). The learner sets Test A
  and Test B (engine, place, throttle) and presses Run and check. The check passes only when the asked thing is the
  one difference, the tests use the asked engine (or place), and the setup can show a difference. easy: Test A is set
  and locked. medium: both tests start the same, on the wrong engine or place. hard: the tests start two changes
  apart, or (throttle) in space where the engine has nothing to push. Every run shows the learner's own two tests
  ("Test B: the craft stays still: nothing comes out of the engine"), whether the check passed or not.
- **Screen**: no badge, readout or label says what the craft does. The craft holds still until credit (predict,
  observe) or a run (experiment). The frame uses the Lumina kit; the canvas is bespoke.
- **Generator**: Gemini writes only the title and a one-sentence overview. Code builds the items from the eval-mode pin
  and `config.difficulty`. A legacy payload (model-written `challenges`) is rebuilt from its challenge types.
  The catalog description, constraints, tutoring block and eval-mode descriptions were rewritten to match. Eval-mode
  ids and betas are unchanged (`problem_type_registry.py` not touched).

predict and observe are `speech` with `acceptsGesture` (J14). A spoken answer is judged against
`propulsionExpectedAnswer`, a tap by `propulsionCorrect`. experiment is a gesture. Misses (`propulsionMiss`; the spoken
ids are the same):
- predict and observe: `missed_cancel`, `said_moves`, `said_still`, `wrong_way`
- experiment: `same_tests`, `changed_more_than_one`, `changed_other`, `wrong_subject`, `cannot_show`

## Rulings (closed 2026-10-16) (concepts removed or reshaped)
**Accepted by the user 2026-10-16** (`../HANDOFF-r1-batch4-rulings-2026-10-16.md`): R1 water removed, R7 sandbox removed.
- **Water as a medium is gone.** The old sim claimed a propeller gives more thrust in water. It actually ran slower
  there, and a "jet" in water is ambiguous (jet skis). Places are now air (a track on Earth) and space.
- **The free sandbox is gone**: free engine and medium switching, the throttle slider, and the speed and thrust
  gauges. Throttle now appears only as an experiment variable (low or high).
- **Default modes by band**: 1-2 gets predict and observe; 3-5 gets all three. Before, every band got all three.
- **Metrics reinterpreted** (`PropulsionLabMetrics` unchanged): `combinationsExplored` counts the engine-place pairs
  in the session's items; `noThrustDiscoveries` counts credited items with an engine that cannot work;
  `vacuumExperimentDone` means a credited space item or air question.

## Gates
- `typecheck:lumina`: 0 errors in my files. 3 foreign errors at the end, all from other agents mid-edit:
  `EngineeringPrimitivesTester.tsx:238` (construction-sequence-planner `tasks`),
  `HowItWorks.workspace.test.tsx:313`, `VehicleComparisonLab.workspace.test.tsx:228`. Full `tsc` not run
  (orchestrator).
- `PropulsionLab.workspace.test.tsx` 15/15. The rewritten `__tests__/PropulsionLab.reader-fit.test.tsx` 1/1: the
  scripted path's read-the-question button reads the ask, never the key.
- Also passing: misses, lessonWorkspacePlan, activityContract, ExhibitWorkspaces Pip surface (386 tests), and
  `workspaceContract.test.tsx -t propulsion` 13/13.
- Payloads `w1-payloads/propulsion-lab.{predict,observe,experiment}.json` from `save_payload.py`: predict hard,
  observe medium, experiment hard, Grade 4. The overviews are model-written.
- Sweep (`-t propulsion-lab`): 0 findings J1-J15 on the three payloads. Misses named 4/4, 4/4, 3/3. Clean
  programs score 100; recover programs 67 with the first-response gate. The advisories ("scene facts contain the
  key") come from the choice list, which is on screen.

## Replay
gemini-3.8-flash, `TUTOR_REPLAY_ITEMS=all`, 11 items x 5 samples, `--observe`. Saved as
`replay/propulsion-lab-2026-10-16{,-r2..-r6}.json`. The automatic checks scored 0 on r1 and r2. I read every miss,
stuck, lever and credit reply on each run.
- **r1.**
  - predict, jet engine and propeller in space: 2/5 stuck replies said "the card shows both engines need air to
    work". The card does not say that; it is the conclusion.
  - predict, two equal propellers: "both propellers pushing with equal power in opposite directions" on 3/5 stuck
    and 2/5 lever replies.
  - observe: 1/5 stated the rule ("the craft gets pushed in the opposite direction!"); 1/5 said two streams are "pushing
    equally".
  - experiment: 2/5 said "what should stay the same" or "to test just the throttle" (the fair-test rule).
- **Fixes (guidance only).** Never say what an engine needs to work. Never put two engines together ("both pushing
  equally", "the stronger one"). Quote the how-it-works card as it reads. Never state the opposite-way rule. Never say
  what should stay the same or "just the throttle".
- **r2.** Those cleared. On predict#2 (a bigger rocket at the back) 3/5 stuck replies singled out "the bigger engine at
  the back". On experiment, 1/5 said "test only what the question asks". Guidance: never single out the bigger one; the
  "only" phrasing added to the forbidden list.
- **r3, r4.** No statement of a key or a fix. Empty replies appeared (r3 4/165, r4 19/275 samples). Guidance
  restructured: the never-lists apply until credit, then "say what the run showed".
- **r5.** 0 flags. The rewrite had dropped "never single out the bigger one", and 9/10 predict#2 replies pointed at
  the bigger engine again, so I restored it.
- **r6.** No reply states a key, a comparison, the fair-test rule or a claim not on screen. Credit replies cite the
  learner's own setup and what the run showed. Empty replies 7/55, all on host-pulled lever moments in observe.

**Empty replies are not this family's**: they started on 10-16 in every family replayed that day. Counts are empty /
all samples: timeline-explorer r2 7/225, vocabulary-explorer 17/200, how-it-works r2 21/250, digital-skills-sim
24/500. The 10-15 runs had 0.

Shared lever doctrine (counted only): first-person lever narration ("I added a label") in about 6 of 165 r6 replies.

## Undriven modes
None. The sweep taps the choices and presses the test buttons; the workspace test drives a spoken answer on predict.

## Open findings
- Needs a browser check of the canvas: engines aimed each way, stream lengths and ticks, the clamp, a propeller
  spinning with nothing coming out in space, the craft moving after credit, the blast arrows and the ringed air
  specks. Only JSDOM has run it. `/eval-test`.
- No `docs/contracts/propulsion-lab.md`. The new requirements (code keys, the craft still until credit, a run shows
  only the learner's own tests) are recorded only here. `/primitive-contract`.
- The spoken path is not swept (the row taps), so the spoken-miss probe has no requests. `/eval-test`.
- Empty tutor replies on replay, across families since 10-16. `/add-live-tutor-tools` (shared doctrine or host
  lever message, or the model).
