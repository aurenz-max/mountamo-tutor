# Handoff: R1 batch 4 rulings — 2026-10-16

**CLOSED 2026-10-16.** The user accepted every recommendation (R23: a lesson's featured vehicle must appear on a job).
Shipped 8bac7f00 (VB-F1), b4e1ae85 (R1), ef741cad (PM); follow-ups in the next commit, results in each report's
"Follow-up 2026-10-16" section and the batch 4 row of `workspace-rollout/ROLLOUT.md`.

## What is being decided

R1 batch 4 (`qa/workspace-rollout/ROLLOUT.md`) rebuilt nine primitives under the 10-15 ruling
("G3+ sims are mid; a binding may rebuild screen and modes to teach more"), then bound them to the
tutor workspace and gave them levers: propulsion-lab, transport-challenge,
construction-sequence-planner, vehicle-comparison-lab, digital-skills-sim, fact-file, how-it-works,
timeline-explorer, vocabulary-explorer.

Each rebuild removed or reshaped features. Each report lists them under "Rulings needed". Batch 4 is
not done until each one below is accepted or sent back. Batches 1-3 (15 primitives) have no open
removal rulings, apart from one support ruling on gravity-drop-tower (R10).

**Why the features were removed.** On every old screen the answer was visible before the learner
acted, or the score credited exploration rather than answers:

| Primitive | What gave the answer away |
|---|---|
| propulsion-lab | "NO THRUST!" banner; "(empty)" shown beside Vacuum |
| transport-challenge | ✅/❌ table on screen during the trade-off question |
| construction-sequence-planner | "Needs:" on every card; red borders on misplaced jobs |
| vehicle-comparison-lab | bay reported "X leads this test" |
| digital-skills-sim | one pulsing target |
| fact-file | key stats visible during questions |
| how-it-works, timeline-explorer, vocabulary-explorer | model-keyed questions; 30-40% of the score for opening tabs |

Now code builds each item and its key from the pinned mode and `config.difficulty`, and Gemini
writes only names, titles and source text.

## Evidence the rebuilds work

- **Gates:** `typecheck:lumina` 0; full tsc 770 (baseline); vitest across the six rebuilt domains
  3118/3118.
  - The one failure on 10-16 was a real bug, now fixed: `transportLevers.ts:43`, where `\b` was saved
    as 0x08, so the lever leak guard never matched.
- **Browser, 10-16:** headless Chromium against :3000, all 24 R1 primitives and 92 mode
  combinations.
  - Every combination generated, rendered and changed state on a click.
  - Nothing showed an error boundary or threw a page error.
  - No answer was visible before the first interaction.
  - Scripts and screenshots: session scratchpad `smoke24/`.
- **Not yet covered:**
  - the question phase of fact-file, how-it-works, timeline-explorer and vocabulary-explorer;
  - the tutor path in a browser;
  - whether canvas drawings are correct;
  - whether the screens teach (human check).

## Rulings

Mark each row **Accept** or **Revert/Change**.
- **Accept:** close the row. Nothing more to do.
- **Revert or change:** names the executor that does it.

A revert must not bring back an answer leak. If a removed feature is wanted back, it returns as an
ungraded teaching surface, a help lever, or a new eval mode, never as on-screen state during a scored
item.

### Concepts and content removed

| # | Primitive | Ruling | Recommendation | If reverted |
|---|---|---|---|---|
| R1 | propulsion-lab | Water is no longer a place; engines are tested in air and in space only. The old sim claimed a propeller gives more thrust in water, but ran slower there, and "jet in water" is ambiguous. | Accept: the old content was wrong. | `/add-eval-modes` for a water item with a correct model |
| R2 | flight-forces-explorer (batch 3, for completeness) | Gliders are no longer taught (they cannot fly level at steady speed). Lift from faster air over the wing is now only `airfoil-lab`'s. | Accept | `/add-eval-modes` |
| R3 | vehicle-comparison-lab | Prediction is no longer taught or scored (the bay answered every mission). `predictionsMade` and `predictionsCorrect` now submit 0. | Accept the removal. Queue a code-keyed `predict` mode if lessons need prediction. | `/add-eval-modes vehicle-comparison-lab` (predict) |
| R4 | vehicle-comparison-lab | constraint_tradeoff no longer asks for an evidence column (the scenario named it). | Accept | — |
| R5 | vocabulary-explorer | The `identify` challenge (pick the definition) is gone; no mode listed it. | Accept | `/add-eval-modes` |
| R6 | timeline-explorer | Model-written "why" questions are gone; cause_effect pairs event titles only. **Open:** the model writes `ledTo` as a chain, so cause_effect mostly asks "what came next". | Accept, and run `/topic-fidelity timeline-explorer` on `ledTo`. Alternatively, rule that cause_effect may ask only about links that are not next-in-time. | — |

### Interaction and presentation removed

| # | Primitive | Ruling | Recommendation | If reverted |
|---|---|---|---|---|
| R7 | propulsion-lab | Free sandbox gone (engine/medium switching, throttle slider, gauges). Throttle survives as an experiment variable. | Accept. If free play is wanted, add it as an ungraded intro, not during items. | `/add-eval-modes` (ungraded explore) |
| R8 | transport-challenge | The 18-second timed animated simulation is gone. A checked pick plays its trips as icons with total bars. | Accept | — |
| R9 | construction-sequence-planner | The canvas house animation is gone (it drew a house for a bridge or road too). A build strip of the learner's own plan stops at the first broken job. | Accept | — |
| R10 | gravity-drop-tower (batch 3) | `moon_card` help lever: its last line ("they hit the ground at the same moment") is strong help. Credit is already recorded as assisted. | Keep: a help lever is allowed to show more, and the credit is assisted. | `/add-support-tiers` (drop the line) |
| R11 | construction-sequence-planner | Drag-and-drop replaced by tap-to-place. | Accept: tap works on tablets and with voice. | — |
| R12 | how-it-works | Sequence control changed from up/down arrows to tap-into-slots for every band. | Accept | — |
| R13 | vehicle-comparison-lab | Generated-image ("Visual") button gone; vector silhouettes only. Evidence facts move to the completion card, ungraded. | Accept | — |
| R14 | digital-skills-sim | Labels removed from pictures and drop zones; the tutor says the name, and `show_picture` helps. **Also:** a wrong tap in click mode gives no visible feedback (browser run 10-16). | Accept the label removal. Queue wrong-tap feedback. | `/eval-fix digital-skills-sim` (wrong-tap feedback) |
| R15 | timeline-explorer | Order feedback no longer colours each card after a wrong check. The timeline is hidden during explore questions and returns as the `show_timeline` lever. | Accept | — |
| R16 | vocabulary-explorer | Cards close during the check in every mode (with the cards open, matching was a lookup). The "open every card" gate is gone. | Accept | — |
| R17 | fact-file | The difficulty badge is gone. explore no longer starts with a reading phase. | Accept | — |

### Scoring

| # | Primitive | Ruling | Recommendation |
|---|---|---|---|
| R18 | fact-file, how-it-works, timeline-explorer, vocabulary-explorer | Exploration is no longer scored (it was 30-40%). Scores are accuracy only. Short items that cannot be built still submit 100 after reading, as before. | Accept: mastery reads answers, not tab opens. |
| R19 | transport-challenge | Partial credit for "met the limits but not the best" is gone; each mode's rule picks one vehicle. single_constraint now has exactly one vehicle that fits. | Accept |
| R20 | digital-skills-sim | Scripted path scores the first-try share; the old correct/total was always 100. | Accept |
| R21 | how-it-works | With no mode pinned, the item set is one question of each kind, not a model-chosen mix. | Accept |

### Where content comes from (code vs model)

| # | Primitive | Ruling | Recommendation | Follow-up |
|---|---|---|---|---|
| R22 | construction-sequence-planner | Jobs come from a 44-job library in 5 projects. A topic outside them (treehouse, spaceship) gets the nearest project. | Accept. Grow the library when a lesson topic misses. | queue: library growth on demand |
| R23 | transport-challenge | Vehicle figures come from an 11-vehicle code library. A vehicle needing more than 40 trips is left off a job, so a lesson's featured vehicle can be missing (the "Harvest Delivery" payload left the delivery truck off). The time model is now one vehicle making the trips in turn. | Accept the library and time model. Decide whether a lesson's featured vehicle must appear on a job. | `/eval-fix transport-challenge` (featured vehicle, odd limits) |
| R24 | vehicle-comparison-lab | Job sentences are code templates. Vehicle statistics are still model-written real-world facts, and the key is computed from the numbers shown, so a wrong statistic is wrong on screen but scores consistently. | Accept, and add a plausibility range per statistic. | `/oracle-test vehicle-comparison-lab` |
| R25 | digital-skills-sim | Targets, zone names and key hints are no longer generated: six fixed picture themes, five fixed containers. The workspace declares K and grade 1. | Accept | — |
| R26 | fact-file, how-it-works | Questions are built by code from the file or steps. how-it-works explain needs the new per-step `purpose` field; a payload without one gets no explain item. | Accept | `/topic-fidelity how-it-works` (purpose wording) |
| R27 | vocabulary-explorer | The generator makes a second flash-lite call (an ambiguity filter), up to two per generation. Its effect is unmeasured. | Accept, and measure the reject rate on the next `/oracle-test`. | `/oracle-test vocabulary-explorer` |

### Changes beyond the primitive files

None of these needs a decision unless one is rejected.

- **propulsion-lab default modes by band:** grades 1-2 get predict and observe; grades 3-5 get all
  three.
- **transport-challenge:**
  - the workspace serves grades 3-5, and K-2 lessons stay on the scripted path;
  - `tradeOffAccuracy` and `averageConstraintsMet` are replaced by `firstTryCount` and
    `attemptsCount` (nothing in the backend reads them).
- **construction-sequence-planner:**
  - `supportTier` is replaced by `config.difficulty` structural bands;
  - critical_path asks for the fewest weeks, not the chain;
  - parallel jobs take one week each.
- **propulsion-lab:** metric meanings changed (fields unchanged).
- **Catalog descriptions:** rewritten for all nine.
- **`problem_type_registry.py`:**
  - transport descriptions rewritten;
  - the other primitives' descriptions are untouched.
- **Ids and betas:** unchanged everywhere.

## After the rulings

1. Close each row in the "Rulings needed" section of
   `qa/tutor-reports/<id>-w1-2026-10-16.md`, and change the batch 4 row in `ROLLOUT.md` from "Rulings
   owed" to done.
2. File the follow-ups above in the owning queues, each with its executor. The same applies to the
   batch 4 items in ROLLOUT that are not rulings:
   - `/primitive-contract` for all nine;
   - `/eval-fix` transport odd limits and vehicle trade-off minimums;
   - `/add-live-tutor-tools` replay-check false positives and the sweep worker crash.
3. Ship batch 4 as its own slice (`/ship`), separate from the Pulse backend work in the same tree.
