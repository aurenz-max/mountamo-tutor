# train-yard levers — 2026-10-06 (`/add-support-tiers`, L3)

## Failure inventory

No real-learner evidence. **Observed-synthetic:** the journey row's scripted wrong builds (a car that cannot carry the cargo, one car too many, one engine too many). **Documented:** the birth certificate's "why children fail" plan. The catalog entry has no `commonStruggles` (it is workspace-bound), and there are no demonstrations, misconception files or remediation modules for this primitive. Every failure below is observable in code: `trainYardMiss` names it on the attempt.

| Mode | Miss | Failure | Class |
|---|---|---|---|
| match_car, build_train | wrong_car, mixed_cars | matches by name; does not picture the cargo or link how a car is built to it | synthetic + documented |
| enough_cars, build_train | too_few_cars, extra_cars | loses the skip count; rounds a part-full last car wrong | synthetic + documented |
| enough_pull, build_train | stalled, extra_engines | cannot apply the rule of the rails, because the train weight is hidden before a run | synthetic + documented |

## Lever table (confirmed by the user before the build)

| Lever | Kind | Modes | Answers | What it changes on screen | Leak rule (code) |
|---|---|---|---|---|---|
| `cargo_picture` | help | match_car, build_train | wrong_car, mixed_cars | an SVG of the cargo itself beside the ticket | no car; no word shared with any car card |
| `model_match` | help | match_car, build_train | wrong_car, mixed_cars | a different cargo, its car, and why | never the item's cargo form or car |
| `two_cars` | simplify | match_car | wrong_car | practice job with a different cargo, 2 car choices (its car + a far foil) | different cargo form |
| `car_tally` | help | enough_cars, build_train | too_few_cars, extra_cars | running total under each car the learner coupled, per kind | never past the learner's own cars |
| `whole_loads` | simplify | enough_cars | too_few_cars, extra_cars | practice job, whole-car load, fewer cars | different cargo and car count |
| `train_weight` | help | enough_pull, build_train | stalled, extra_engines | yard scale: engines + cars + whole load, before the run | weight only, never the pull needed |
| `worked_hill` | help | enough_pull, build_train | stalled, extra_engines | the rule worked on a different train | different grade, weight and engine count |
| `round_hill` | simplify | enough_pull | stalled, extra_engines | practice job, whole-number hill, exactly 2 engines | different cargo and amount |
| `smaller_job` | simplify | build_train | count + engine misses | practice whole build, 3-4 whole cars, 1% hill | different cargo and car count |

**Rejected:** the birth plan's live "pull needed vs pull given" gauge. It turns green at exactly the fewest engines, so it shows the answer. `train_weight` gives the input to the rule instead.

**Starting positions (`supportTier: easy`):** match_car `cargo_picture`; enough_cars `car_tally`; enough_pull `train_weight`; build_train `car_tally` + `train_weight`. The generator stamps `ctx.supportTier`. A starting position is not recorded on the attempt.

Every catalog miss in every mode is answered by a lever (J9). No failure is left without a lever.

## Built

- `trainYardLevers.ts`: declarations, leak-rule helpers, simpler-job builders (a fixed practice story per cargo form, so there is no model call at runtime), and scene facts.
- `TrainYard.tsx`: lever state keyed by the session job; `pullLever` / `endPractice`; the practice job is rendered in place of the session job and records no result; the four help panels are marked `data-lever`.
- `TrainYardChallenge.carChoices` (practice match_car only). Catalog `levers: true`. The journey row rebuilds `~simpler` jobs.
- Catalog guidance rewritten: it was 2069 chars with the lever doctrine (the cap is 2000, and over it the Live socket closes), and is now under 2000. It adds "never describe how that car is built", from the replay.

## Measured

- Unit `trainYardLevers.test.ts` 30/30: leak rules per lever, builders over 60 jobs × 4 modes × 2 bands, the miss → `nextLever` table, start positions.
- Mounted `TrainYard.levers.workspace.test.tsx` 5/5: a pull changes the screen and the scene in one commit; a second pull of the same lever is blocked; the next attempt carries the levers and is assisted; `two_cars` opens an ungraded two-car job, returns to the full job, and only the full job is credited; Try again keeps the practice job; easy starts are not recorded as pulls.
- `typecheck:lumina` 0. Live-activity suite + engineering + generator + catalog tests: 63 files, 2493 pass, 0 fail (journey sweep J1-J11 included).
- Dry journey: all 5 W1 payloads reach start → miss → stuck → lever → credit.
- Tutor replay (gemini-3.8-flash, 5 payloads × 5 samples), before and after the guidance edit:
  - Before: 0 code-check misses, but one hand-read line described the answer car ("Which car … is built with seats and doors to carry people?").
  - After: 0 of 125 replies describe the answer car; the 2 regex hits describe the model's tank car, which is allowed. 1/25 `no_protocol_leak` at `stuck` ("I pulled a helper lever …"). This is the known shared tool-narration class (calibration 09-27), not train-yard wording.
- **Not run:** Live. Per the 09-28 ruling, the class Live gate waits for every mode, and all four modes now have levers, so the engineering class gate is ready when its other members are. Not done: a browser look at the lever panels on a phone width.
