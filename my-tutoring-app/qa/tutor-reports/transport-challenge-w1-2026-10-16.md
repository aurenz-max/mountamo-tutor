# transport-challenge W1 binding (ROLLOUT R1 batch 4), 2026-10-16

**Shape P, three modes, all bound** (single_constraint, multi_constraint, full_optimization). Levers in
`../eval-reports/transport-challenge-levers-2026-10-16.md`. Not committed.

## Verdict on the old screen, and what changed
The old primitive did not test its concept. After the learner picked a vehicle and the simulation ran, a comparison
table showed every vehicle's trips, time, cost and CO2 with a ✅/❌ status, and a badge said "All constraints met" or
"Constraint violated". The graded part was a trade-off question written and keyed by Gemini, asked after that table,
so the answer could be read off the screen. The vehicle pick itself was partly credited for any vehicle that met the
limits. The time model (up to 15 vehicles running in parallel batches) could not be worked by a grade 3-5 learner.
The 18-second simulation ran on a timer that moved the activity on by itself.

Rebuilt so that each mode is one task with a code-built key (`transportWorkspace.ts`). A vehicle does every trip
itself, one after another, so trips = load ÷ capacity rounded up and every total = trips × the per-trip figure.
- **single_constraint**: one limit (budget, time or CO2); exactly one vehicle does the job within it.
- **multi_constraint**: two limits; exactly one vehicle keeps both, and for each limit another vehicle keeps only that one (the trade-off).
- **full_optimization**: three limits that no vehicle keeps; exactly one vehicle breaks only one of them.
- **Tiers (structural)**: easy: every load fills its trips (or fits in one), and the cards show only the limited
  figures. medium: a part-full trip somewhere, every figure shown, and the vehicle that is cheapest per trip is not the
  answer. hard: adds a vehicle that would pass only if its part-full trip were not counted.
- **Screen**: each card shows capacity and per-trip figures only. A checked pick runs that one vehicle (one icon a
  trip, bars of its totals against each limit). The table of every vehicle appears only after credit. No badge,
  status or table before credit. The kit frame is kept; `LuminaAnswerChoice` cards replace the raw buttons.
- **Generator**: Gemini writes only the names: title, description, and per job the title, origin, destination, load
  kind, load name and featured vehicle (an enum from the code library). Code builds the numbers from the eval-mode pin
  and `config.difficulty`. A legacy payload (`scenarios`) is rebuilt from its types and names.
- Every item is `speech` with `acceptsGesture` (J14): one vehicle name, said or tapped. Misses (`vehicleMiss`; the
  spoken ids are the same): `forgot_round_up`, `cheapest_per_trip`, `fewest_trips`, `one_limit_only` (multi),
  `over_limit` (single, multi), `breaks_more` (full).

## Rulings (closed 2026-10-16) (removed or reshaped)
**Accepted by the user 2026-10-16** (`../HANDOFF-r1-batch4-rulings-2026-10-16.md`): R8 timed sim removed, R19 one vehicle per rule, R23 library and time model kept; a lesson's featured vehicle must appear on a job (follow-up `/eval-fix transport-challenge`).
- **The trade-off multiple-choice question and its explanation are gone.** They were model-keyed and asked after the
  answer table was on screen. The pick is now the whole task.
- **The timed 18-second animated simulation is gone.** A checked pick plays out its trips as icons (a CSS stagger, no
  timer) with bars for its totals. The catalog description no longer says "living simulation" or "constraint bars fill
  in real time".
- **The time model changed**: one vehicle making every trip in turn (hours per round trip × trips), not up to 15
  vehicles in parallel. Speed, distance and turnaround are no longer on the cards.
- **Partial credit for "a vehicle that met the limits but was not the best" is gone**: the mode's rule picks one
  vehicle. single_constraint has no "cheapest of several that fit" any more: exactly one fits.
- **Vehicle figures come from a code library** (11 vehicles; a longer route doubles them), not from the model. A
  vehicle needing more than 40 trips is left off a job, so a lesson's featured vehicle can be missing from a job
  (the "Harvest Delivery" payload featured the delivery truck for 440 tons and left it off).
- `TransportChallengeMetrics`: `tradeOffAccuracy` and `averageConstraintsMet` replaced by `firstTryCount` and
  `attemptsCount` (nothing in the backend reads them).
- Backend `problem_type_registry.py`: the three descriptions were rewritten; ids and betas unchanged.
- teachingWorkspace grades are 3-5 (the old catalog said "best for grades 3-5"; K-2 lessons stay on the scripted path).

## Gates
- `typecheck:lumina`: 0 errors in these files. 3 foreign errors at the time of the run: `EngineeringPrimitivesTester.tsx`
  (construction-sequence-planner `tasks`), `HowItWorks.workspace.test.tsx`, `VehicleComparisonLab.workspace.test.tsx`.
- `TransportChallenge.workspace.test.tsx` 16/16, rewritten `__tests__/TransportChallenge.reader-fit.test.tsx` 2/2.
  Engineering folder + Pip surface + `misses.test.ts` + `lessonWorkspacePlan.test.ts`: 39 files, 520 passed.
  `workspaceContract.test.tsx` filtered to the id: 13 passed.
- Payloads `w1-payloads/transport-challenge.{single_constraint,multi_constraint,full_optimization}.json` (easy, medium,
  hard; Grade 4). Real names from the model in each (Morning Commute, Harvest Delivery, Island Crossing).
- Sweep: 0 findings J1-J15 on the three payloads; misses named 3/3 on each. The first run found J15 (a spoken credit on
  the smaller practice job changed nothing on screen); fixed by wiring `onPracticeSolved`. Advisories ("scene facts
  contain the key") come from the vehicle list, which is on screen.

## Replay (`TUTOR_REPLAY_ITEMS=all`, 9 items x 5 samples, `--observe`; `replay/transport-challenge-2026-10-16{,-r2,-r3}.json`)
Read every start, miss, stuck, lever and credit reply on each run.
- **r1.** 9/45 stuck and 1/45 lever replies steered the learner to a vehicle, usually the key ("Take a look at the
  minivan's math", "Check the ferry's totals", "the delivery truck or the semi truck"). Miss replies asked which limit
  the learner's own run broke; some stated that run's totals, which are on screen.
- **Fix.** Guidance: name only a vehicle the learner has already picked or named; ask which card they want to work;
  never suggest a vehicle or list the ones left.
- **r2.** 1/45 stuck reply still named the key after a lever put numbers on every card. Guidance adds "even right
  after a lever puts numbers on every card".
- **r3.** No reply states a key, a total not on screen, a fix, or suggests a vehicle. Credit replies cite totals that
  the credited table shows.

Shared lever doctrine (counted only): first-person lever narration ("I added the multiplication setups") 5/225 in r3.

## Undriven modes
None. The sweep taps cards; the workspace test drives a spoken answer on single_constraint.

## Open findings
- Needs a browser check: card layout with the trip blocks and multiplication lines inside, the trip-icon stagger,
  the bars. Only JSDOM has run it. `/eval-test`.
- The spoken path is not swept (the row taps), so the spoken-miss probe has no requests. `/eval-test`.
- A lesson's featured vehicle can be dropped from a job when it would need more than 40 trips. Pick the load from the
  featured vehicle's range first. `/eval-fix`.
- Some limits come out at odd values ($1,375, 825 kg) when the gap between two totals is narrow. `/eval-fix`
  (prefer a load with a wider gap).
- No `docs/contracts/transport-challenge.md`. `/primitive-contract`.

## Follow-up 2026-10-16 (R23)
- The featured vehicle is on every job it can carry: the load is drawn from its range first (600 attempts, the last
  150 without), and every limit has at most two significant figures when such a job exists. Probe over every vehicle
  featured x 3 modes x 3 tiers x 6 seeds: featured on 594/594 (was 575/591), round limits 594/594 (was 542/591), no
  failed build (was 3).
