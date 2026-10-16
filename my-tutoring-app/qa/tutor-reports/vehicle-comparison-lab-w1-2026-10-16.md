# vehicle-comparison-lab W1 binding (ROLLOUT C32, R1 batch 4), 2026-10-16

**Shape P, three modes, all bound** (metric_leader, evidence_choice, constraint_tradeoff). Levers in
`../eval-reports/vehicle-comparison-lab-levers-2026-10-16.md`. Not committed.

## Verdict on the old screen, and what changed
The old primitive leaked its answers. The "comparison bay" let the learner pick any metric and press "Run the
comparison", which named the leader ("Boeing 747 leads this test") and drew bars to scale. Every mission could be
answered by running the bay first. On metric_leader missions each vehicle card printed the asked value. The
evidence_choice and constraint_tradeoff missions showed no data at all, so the bay was the only way to answer them.
Gemini wrote and keyed the missions; the generator then rewrote most of them. The constraint_tradeoff scenario named
the priority column ("which has the greatest speed?"), so citing it as evidence was reading back the question. The
score also credited exploration (pairs compared, predictions, facts uncovered).

Rebuilt so that each mode is a task with a code-built key (`vehicleComparisonWorkspace.ts`). Gemini supplies the
roster (5-6 real, topic-specific vehicles with their real statistics), a neutral title and instructions, and facts
for the end. Code builds every item from the eval-mode pin and `config.difficulty`. Each item is a data table: rows
are vehicles, in an unsorted order, and columns are measures.
- **metric_leader**: the ask names one column; the learner chooses its leader (the lowest for CO₂ per rider). easy:
  3 rows, one column, the leader at least 1.5x ahead. medium: 4 rows and a second column with a different leader.
  hard: 5 rows, two extra columns, and a close race (within 25%), a lower-is-better column, or a value whose first
  digit is bigger than the leader's.
- **evidence_choice**: a job with one need, worded without a column name ("A whole school choir wants to ride
  together on one vehicle"). The learner chooses the vehicle and the column that proves it. easy: 2 columns,
  medium: 3, hard: 4, each led by a different vehicle. Another column always has another leader.
- **constraint_tradeoff**: minimums ("carry at least 5 people and reach at least 110 km/h") and a priority. The
  vehicle that leads the priority overall always misses a minimum, and at least two vehicles qualify. easy: one
  minimum; medium: two; hard: two, with two vehicles that each miss one, plus an extra column. The learner answers
  with the vehicle only.
- **Screen**: the table (Lumina kit `LuminaTable`) with each vehicle's vector silhouette, a choice button per row, and
  column buttons on evidence_choice. Nothing marks a leader until credit; then the reason is shown ("Container Ship
  leads the Cargo column with 220,000 tons"). The roster drops placeholder numbers (99999 for "unlimited") and a value
  in a different unit from the rest of its column.
- **Generator**: one Gemini call for the roster and frame; `buildVehicleItems` builds the items. If the roster cannot
  support a pinned mode, generation throws. A legacy payload (model-keyed `challenges`) is rebuilt from its roster in
  its modes.

All three modes are `speech` with `acceptsGesture` (J14): the answer is one vehicle name (on evidence_choice, a name
and a column). The tutor judges a spoken answer by `vehicleExpectedAnswer`; `vehicleCorrect` checks a tap. Misses
(`comparisonMiss`; spoken items list the same ids per wrong vehicle):
- metric_leader: `leading_digit`, `other_column_leader`, `reversed`, `runner_up`, `not_leader`.
- evidence_choice: `wrong_evidence`, `other_column_leader`, `misread_column`, `not_leader`.
- constraint_tradeoff: `ignored_minimum`, `reversed`, `not_priority_leader`.

## Rulings (closed 2026-10-16) (removed or reshaped)
**Accepted by the user 2026-10-16** (`../HANDOFF-r1-batch4-rulings-2026-10-16.md`): R3 prediction removed (a code-keyed `predict` mode is queued only if lessons need it), R4 no evidence column, R13 image button removed, R24 model statistics kept with a plausibility range per statistic (follow-up `/oracle-test vehicle-comparison-lab`).
- **The comparison bay is gone**: drag vehicles into a bay, pick a metric, predict, and run an animated reveal. It
  answered every mission. Prediction is no longer taught or scored; `predictionsMade`/`predictionsCorrect` now
  submit 0.
- **"Evidence surprises" tap-to-uncover is gone from the item screen.** A fact can name a leader. Up to three facts
  now show on the completion card, ungraded.
- **The generated-image button ("Visual") is gone.** Only the vector silhouettes remain.
- **constraint_tradeoff no longer asks for an evidence column.** The old scenario named the priority, so the column
  pick was free. The mode now tests the filter and the choice.
- **Job sentences are code templates, one per need column**, not model-written. Code cannot check that a model's job
  points to exactly one column.
- **Vehicle statistics remain model-supplied** (real-world facts). The keys are computed from the numbers shown, so a
  wrong statistic is wrong on screen but the key matches it.
- Catalog description, constraints, eval-mode descriptions, affordances (`manipulate` → `spoken`) and the scripted
  tutoring block were rewritten to match. Eval-mode ids and betas in `problem_type_registry.py` are unchanged.

## Gates
- `typecheck:lumina`: 0 errors in these files. The 1 remaining error is foreign: `EngineeringPrimitivesTester.tsx:238`
  `tasks` on `ConstructionSequencePlannerData`. Full `tsc` was not run (orchestrator).
- `VehicleComparisonLab.workspace.test.tsx` 14/14 and the rewritten `__tests__/VehicleComparisonLab.reader-fit.test.tsx`
  2/2. Engineering folder 36 files, 313 passed. live-activity without the full sweep: 34 files, 3486 passed.
  `misses.test.ts` and the ExhibitWorkspaces Pip surface: 191 passed. `lessonWorkspacePlan.test.ts` 16 passed.
- `workspaceContract.test.tsx` filtered to the id: 13 passed.
- Payloads `w1-payloads/vehicle-comparison-lab.{metric_leader,evidence_choice,constraint_tradeoff}.json` from
  `save_payload.py` (hard, medium, hard; Grade 4). Real content: mixed people-and-goods rosters; every item keyed.
- Sweep filtered to the id: 0 findings J1-J15 on the three payloads; misses named 3/3 on each. The advisories ("scene
  facts contain the key") come from the vehicle list and table, which are on screen.
- The full unfiltered sweep crashes its worker after train-yard (canvas-confetti animation frame in jsdom, "Worker
  exited unexpectedly"; 647 passed before it). Every candidate payload passes alone (train-yard, transport-challenge,
  this family), so the crash depends on run order.

## Replay (gemini-3.8-flash, `TUTOR_REPLAY_ITEMS=all`, 9 items x 5 samples, `--observe`; `replay/vehicle-comparison-lab-2026-10-16{,-r2,-r3}.json`)
I read every miss, stuck, lever and credit reply on each run.
- **r1.** Automatic checks: 1/45 (stuck evidence #2 named "range"). Reading the replies found three problems:
  - On metric_leader stuck and lever replies, 5/30 made the comparison for the learner: "Which vehicle has the
    number with the most digits?", "look at the numbers with five digits", "those two numbers with five digits".
  - On evidence_choice, the tutor singled out one definition from the column card: "Range measures how far... which
    vehicle has the numbers for this long trip?"
  - The job sentences reused the definition words ("refuel", "each person", "goods in one trip"), so the card matched
    the job for the learner.
- **Fixes.** Guidance now says: never say which numbers have the most digits or point to them, and never single out
  one definition on the column card. The jobs were reworded with no shared word against any column's meaning; a test
  pins that. The job is now derived from the column, not stored on the item.
- **r2.** 14/45 samples were lost to API 429s (concurrent agents); the 31 that came back were all clean.
- **r3** (`--concurrency 1`, 225/225 samples returned): 0 automatic flags. By reading, no reply states the key, names
  the right row or column, singles out one definition, or claims something not on screen. Credit replies cite the
  learner's choice and its number. Residual: 3/15 metric_leader stuck replies (down from 5/30 stuck+lever in r1) say
  "look at the numbers with the most digits". That states the method the `count_digits` lever is for, names no
  vehicle and does not compare rows, so I left it; a stricter line would forbid naming the digit-count strategy at all.

Shared lever doctrine (counted only): first-person narration ("I marked ticks", "I added checkmarks") 3/45 r1 stuck
and miss replies; unprompted `two_rows` pulls on stuck, 2/5 (r1).

## Undriven modes
None. The sweep drives taps (row button by vehicle name, column button by label, Check); the workspace test drives a
spoken answer on metric_leader.

## Open findings
- Needs a browser check of the table: layout at phone width, the faded columns, the digit notes, the ticks and
  crosses. Only JSDOM has rendered it. `/eval-test`.
- No `docs/contracts/vehicle-comparison-lab.md`. The new requirements (code keys from shown numbers, unsorted rows,
  no leader mark before credit, the overall priority leader misses a minimum) are recorded only here.
  `/primitive-contract`.
- The spoken path is not swept (the row taps), so the spoken-miss probe has no requests. `/eval-test`.
- Some trade-off jobs pair minimums oddly with the priority ("carry at least 5 people ... which carries the most
  cargo"). They are valid, but a code rule for which minimums suit a priority would read better. `/eval-fix`.
- The full journey sweep's worker crash: an order-dependent confetti frame after train-yard; it does not reproduce on
  any single payload. A shared fix (stub canvas-confetti, or cancel animation frames in the sweep's afterEach) belongs
  to `/add-live-tutor-tools` (sweep harness).

## Follow-up 2026-10-16 (R24, trade-off minimums)
- `vehiclePlausibility.ts`: a range per statistic and vehicle kind (unit-converted, wide: it catches a slipped unit or
  a lost digit). A statistic outside it is left off the roster. New `vehicle-comparison-lab` oracle (implausible
  values, a single key, minimums that decide something). `/oracle-test`, 3 modes x 5 runs: 6 implausible model
  statistics (a ferry at 5-25 t, a 747 at 183,500 t, a delivery van drawn as a car), 0 on a table.
- Trade-off minimums suit the priority (a people job sets no cargo minimum, a cargo job no seats); any minimum only
  in the search's last 40%. On the W1 roster, 360 items: unsuited 103 -> 0.
