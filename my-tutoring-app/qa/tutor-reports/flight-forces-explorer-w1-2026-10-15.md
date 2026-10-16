# flight-forces-explorer W1 binding (ROLLOUT C29), 2026-10-15

**Shape P, three modes, all bound** (predict, observe, adjust). Levers in `../eval-reports/flight-forces-explorer-levers-2026-10-15.md`. Not committed.

## Verdict on the old screen, and what changed
The old primitive did not teach its concept through its modes. All three modes were the same task: a multiple-choice
question written by Gemini, keyed by Gemini, and the right option was usually the longest and most detailed one
("They speed up and spread apart, creating lower pressure"). Nothing in the question depended on the simulation. The
simulation was a free sandbox with a live badge that named the state (CLIMBING, CRUISING, STALL!), a live force
readout, a speed and altitude display, and sliders, so a learner could read any outcome off the screen. The score
credited exploration (states visited, a stall seen, a second aircraft tried) as half the grade.

Rebuilt so that each mode is a task with a code-built key (`flightForcesWorkspace.ts`). The four forces are whole
units; lift against weight sets the height, thrust against drag sets the speed.
- **predict**: a plane flying level at a steady speed, then one change (a load of water, dropping a crate, the
  throttle, the landing gear, the nose angle). The learner says or taps what happens to the height or the speed, and
  the change runs only after credit. easy names the force ("its weight gets bigger"); medium gives only the action;
  hard is a two-step effect (pull the throttle back, then what happens to the height a little later), a stall (nose at
  18° past a 15° stall angle), or two changes that cancel.
- **observe**: the plane is drawn still with its four arrows at code-chosen lengths, with one tick per unit. The
  learner says what the height and speed are doing. easy asks one direction with a gap of 3 or more; medium asks both,
  one pair equal; hard asks both with gaps of 0 or 1, and some planes are drawn nose up while they sink.
- **adjust**: a goal ("climb and keep a steady speed"). The learner sets thrust and nose angle with buttons (the arrows
  follow) and presses Fly and check. easy has one control; medium two; hard two where each nose step adds a unit of
  drag as well as lift, with an 18° step that stalls the wing. A wrong flight runs the learner's own setting and says
  what it did ("The plane climbs and slows down. That is not the goal."), never the goal setting.
- **Screen**: no badge, readout or label names the motion; the plane holds still until credit (predict, observe) or a
  flight (adjust). The airflow particles stay as decoration and swirl in a stall. The frame is the Lumina kit.
- **Generator**: Gemini writes only the title, a one-sentence overview and the plane (small plane, jumbo jet,
  fighter). Code builds the items from the eval-mode pin and `config.difficulty`. A legacy payload is rebuilt from its
  challenge types. The catalog description, constraints and eval-mode descriptions were rewritten to match.

predict and observe items are `speech` with `acceptsGesture` (J14), judged by `flightExpectedAnswer` when spoken and by
`flightCorrect` when tapped. adjust is a gesture. Misses (`flightMiss`; the spoken ids are the same): predict
`stall_more_lift`, `missed_balance`, `said_no_change`, `opposite_way`; observe `followed_nose`, `missed_balance`,
`said_no_change`, `opposite_way`; adjust `stalled`, `forgot_drag`, `lift_vs_weight`, `thrust_vs_drag`.

## Rulings (closed 2026-10-16) (concepts removed)
**Accepted by the user 2026-10-16** (`../HANDOFF-r1-batch4-rulings-2026-10-16.md`): R2 gliders removed; lift from faster air stays with `airfoil-lab`.
- **Gliders ("a glider has no thrust") are no longer taught.** A glider cannot fly level at a steady speed, so it does
  not fit the four-force balance items. A legacy `glider` payload draws the small plane.
- **The free sandbox is gone** (aircraft switcher, thrust and cargo sliders, free nose dragging). Its concepts now
  appear as items: cargo as the water load and the crate drop, the nose as predict and adjust items, stall as predict
  hard and adjust hard.
- **Lift from faster air over the wing is no longer asked.** The particles still show it; `airfoil-lab` owns the item.

## Gates
- `typecheck:lumina` 0. Full `tsc` 770 (baseline 770); none in these files.
- `FlightForcesExplorer.workspace.test.tsx` 15/15 and the rewritten `__tests__/FlightForcesExplorer.reader-fit.test.tsx`
  1/1 (the scripted path's read-the-question button reads the ask, never the key).
- live-activity + engineering + ExhibitWorkspaces Pip surface: 69 files, 4334 passed. `misses.test.ts` +
  `sourceControlBytes.test.ts` 148 passed.
- Payloads `w1-payloads/flight-forces-explorer.{predict,observe,adjust}.json` from `save_payload.py` (predict hard,
  observe medium, adjust hard, Grade 4). Real content: the overview is model-written in each. The title "Four Forces
  Flight Lab" was copied from the schema example; the code fallback title is now "Flight Forces Lab" to tell them apart.
- Sweep: 0 findings J1-J14 on the three payloads; misses named 4/4, 4/4, 3/3. The advisories ("scene facts contain the
  key") come from the choice list, which is on screen.

## Replay (gemini-3.8-flash, `TUTOR_REPLAY_ITEMS=all`, 11 items x 5 samples, `--observe`; `replay/flight-forces-explorer-2026-10-15{,-r2,-r3,-r4}.json`)
Read every miss, stuck, lever and credit reply on each run.
- **r1.** Automatic checks: 7 protocol-leak flags, all the word "lever" in "throttle lever" (the plane's control). By
  reading: on the stall item 2/5 stuck replies said "when lift becomes smaller than weight, what happens?"; on the
  "a little later" throttle item 1/5 said "when the plane moves faster, what happens to its height?" (the step the
  learner must make); on adjust 10/15 stuck and lever replies called the dashed marks "targets" or "where the arrows
  need to reach", which is false on a climb goal (lift must pass the mark).
- **Fixes.** "throttle lever" became "throttle". Guidance: never compare a pair even when a card shows it, never state
  the speed step on a "little later" item, never call the marks targets. The target_marks lever text, the scene fact
  and the on-screen note now say a mark shows equal length with the partner arrow.
- **r2.** Marks described correctly. 4/10 adjust stuck and lever replies on the level goal said "balance the pairs",
  which is the answer there. Guidance: never tell the learner to balance, match or even out a pair.
- **r3.** No balance or target wording. The stall comparison came back 2/5 ("when upward lift is much smaller than
  downward weight"). Guidance now quotes that sentence as forbidden.
- **r4.** No reply states a key, a comparison, the fix or a claim not on screen. Credit replies cite the learner's own
  setting and what the run shows.

Shared lever doctrine (owned by the agent editing `adapterContract.ts`, counted only): one two-lever turn
(`force_link` + `one_step`, r4 1/55 stuck); first-person lever narration ("I added dashed marks", "I lined up the
arrows") 10 (r2), 6 (r3) and 11 (r4) of 165 replies.

## Undriven modes
None. The sweep drives taps and adjust button presses; the workspace test drives a spoken answer on predict.

## Open findings
- Needs a browser check of the canvas: arrow lengths and ticks, the nose pitch, the plane moving after credit, the
  dashed marks and the stall swirl. Only JSDOM has run it. `/eval-test`.
- No `docs/contracts/flight-forces-explorer.md`; the new requirements (code keys, plane still until credit, a wrong
  flight shows only the learner's own result) are recorded only here. `/primitive-contract`.
- The spoken path is not swept (the row taps), so the spoken-miss probe has no requests. Next `/eval-test`: one spoken
  program for predict and observe.
- `replay_checks.py` false positives: "throttle lever" read as protocol (avoided by rewording) and a question listing
  all three choices read as key-before-try (r2 1/55). `/add-live-tutor-tools` (replay checks).
- The predict payload's model overview says "as you adjust the plane's controls and load", which fits adjust, not
  predict. `/topic-fidelity`.
