# Pulse roadmap — one selection brain, measured on every answer

Owner: WORKSTREAMS Phase 7. Written 2026-10-12. Executors: `/student-data-loop` (where to
build in the data loop), `/pulse-agent` (verify), `/pulse-fix` (fix what it finds),
`/curriculum-graph` (graph). This file is the queue; WORKSTREAMS rows point here.

## Where Pulse stands (10-12)

The learner model works offline and in shadow. It does not yet choose anything a child sees.

| What exists | State |
|---|---|
| Two-layer learner model (IRT per subskill + Jev graph) | Shadow in prod: updated on every lesson and Pulse answer, stored at `students/{id}/learner_state/{SUBJECT}`. Uncommitted |
| Learner graph | Published `learner_graphs/{SUBJECT}`, all 4 subjects. Validation: literacy partial, math waits on user labels, science and social studies none |
| Pulse handoff (7.5) | Engine sends subskill + `target_beta`; frontend pins the fitting mode nearest beta. Uncommitted, browser check owed |
| Exposure gate (7.13) | Above-grade subskills need their own evidence. Uncommitted |
| Display | My Progress card and LessonSummary read the learner model. Browser checks owed |

Six findings shape the order of work:

1. **There are two Pulses.** Home → Practice opens `PulseSession` (PulseEngine: leapfrog,
   frontier probes, bound primitives). The daily plan's "pulse beat" (ribbon block 1) is a
   code-built knowledge-check from `select_session_targets`; it never calls PulseEngine. The
   07-04 direction ("standalone Start Pulse dies, pulse = the measurement beat") was half done.
2. **There are three selection brains.** PulseEngine (Fisher x sigma^2 over the published
   curriculum graph), `select_session_targets` (KG P(correct) vs gate thresholds, feeds the
   planner and Recommended Lesson), and the learner model's frontier (shadow, Jev graph).
   `/student-data-loop` §7 says "ONE selection brain everywhere"; this is now false.
3. **The display and the selector disagree.** The card says "ready next: X" from the learner
   model while Pulse and the planner serve from today's engine. A parent or child can see this.
4. **Today's engine fails the struggling child.** Selection sweep (7.3): struggling student 19%
   success with 6-miss streaks, session 1 is 0/6 (cold-start probes pinned at beta 3.5). The lab's
   success-weighted frontier: success 0.85-0.98, miss streaks 1-3, prerequisite missing ~0.
5. **Pulse answers are not in L0.** PulseEngine writes no attempt and no review; it feeds
   competencies, IRT, lifecycle and now `learner_state` directly. So rollups and the profile
   miss Pulse, and `backfill_learner_state.py` (which replays reviews) cannot rebuild the
   Pulse half of a student's state. The L2 rebuild contract does not hold for the new L1 doc.
6. **First-try lives in three places.** Review `student_work` per-challenge results, the new
   `PulseResultRequest.first_try`, and nowhere on the attempt. Production theta still reads the
   retry-pinned final score (7.7).

## 10-12 switch: the learner model is the only selection brain (user ruling)

DONE 10-12, uncommitted. `LearnerStateService.select` picks every Pulse item and every
session target (planner, Recommended Lesson, forecast head). Retired: Fisher x sigma^2 over
the published graph, cold-start DAG probes, leapfrog, the KG-P(correct) session selector,
`selection_sweep.py`. The planner's unlocked scan is kept only for subjects with no learner
graph. This closes R4, P3.1-P3.4 (no flag: switched outright), P4.1 and the selection half
of P4.5. Evidence: `/pulse-agent` loop + truth runs in `backend/reports/sunset-after/`
(baseline `sunset-baseline/`), skill `/pulse-agent` "Production selector".

Open from the switch:
- Gifted K child reaches gate 4 on 11 subskills vs 19 (spreads over 77 subskills vs 56) and
  scores 100% on Pulse: the teach gain favours easy items. Next: the lab's one-step
  look-ahead, or a teach pool above the grade-of-record window for high phi.
- Struggling truth child: 70% success (was 19%), longest miss run 4 (`miss_streak` fails
  at 3) until the graph has easier forms below K (P5.5).
- Pulse summary screen still has leapfrog UI that never fires now; replace with `influence` (P5.2).
- Cross-grade case twins: a pick's bare subskill id is resolved by the grade of record when
  ambiguous (P1.4).
- Browser check owed: one real Pulse session and one Recommended Lesson on the new selector.

## 10-12 content audit: what reaches 1004 (K)

Selection held up; content did not. Replay of 1004's 6 Pulse picks before the fix: 3 of 6
items did not teach their subskill (11-20 built as "count on 7, 8"; group-of-ten as "which
group has more"; G1 "43 + 5" as a place-value chart with tenths). Causes and fixes (uncommitted):

- FIXED. Pulse sent the header grade ("elementary"); now the student's grade of record
  (`session_meta.student_grade`) sets the audience and each item carries its subskill grade.
- FIXED. Generators never saw the subskill. The hydrator now passes it as the objective
  (`objectiveText`/`objectiveGrade`/`objectiveId`, the lesson contract) and as `intent`; the
  manifest's grade-table `numberRange` is not forwarded (it capped "11-20" at K's 1-10).
  Text items are built one per subskill instead of one batch on the session topic.
- FIXED. Mode fit: Flash (low thinking) with "the mode's task IS the subskill"; a component
  with no fitting mode becomes a text problem built from the subskill.
- FIXED. number-line `jump` draws from the resolved focus window (contract R4 holds).
- FIXED. Planner: confirm overflow past the pulse beat is deferred, not shown as "New Lesson";
  retests no longer spend a subject's lesson minutes; one subskill per day (retest wins).
- FIXED. Labels and reasons: Pulse labels by selection kind ("Quick check"); selector
  `reason` is plain language (engine numbers in `reason_detail`); My Progress shows
  "Not started" instead of a band on unpractised skills.
- Evidence: replays after the fix, 11 of 12 items on-subskill across two runs
  (scratch replay of `select(1004)` -> `generatePulseManifest` -> `hydratePracticeManifest`).

| # | Item | Executor | Exit |
|---|---|---|---|
| C1 | Browser check: one Pulse session for 1004 shows K audience, "Quick check" labels, items on-subskill | user / HUMAN-CHECKS | checked |
| C2 | ten-frame `build` ignores the objective's range ("numbers 11-20" built "put 5 counters") | `/topic-fidelity ten-frame` | build values inside 11-20 for that objective |
| C3 | base-ten-blocks has no add-without-regrouping mode; `operate` forces >=1 regroup (contract) | `/add-eval-modes base-ten-blocks` (fork) | "43 + 5" subskill gets a fitting visual |
| C4 | DONE 10-12, uncommitted. Teach picks with P(ready) 0.00 were selected (1004: top LA pick P(ready) 0.00 at P(right) 0.89; general ability predicted a right answer whose parts were not in place). Rule (user asked for a threshold; 0.40 chosen): `READY_MIN = 0.4` gates teach picks AND the card's ready list (one number); below it a subskill is served only as a last resort, most-ready first. 1004: 61-214 teach candidates per subject still clear it | `/pulse-fix` | rule decided, `/pulse-agent` loop passes |
| C5 | DONE 10-12 (user: yes, scale with grade), uncommitted. `lesson_plan.daily_budget_minutes`: K 30, G1 40, G2 45, G3 50, G4 55, G5 60, G6+ and gradeless 75; `students/{id}.daily_budget_minutes` still wins. Planner and forecast read it. Loop: K plan allocates 30 min | user ruling | grade-scaled default chosen |
| C6 | DONE 10-12, uncommitted. Stored plan dated yesterday served today. Cause: the doc was keyed by the UTC date and stamped with the server's local `date.today()`, so a plan built after 8 pm EDT on 10-11 sat under 10-12 and was served all of 10-12; the home screen also fetched once per mount. Fix: the client sends its local date (`plan_date`, accepted within 1 day of UTC); the builder stamps the day it is given; a stored doc whose date is not its key is rebuilt (completed blocks carried); the home screen refetches when the tab returns on a new day. `tests/test_session_plan_day.py` 5 pass; 1004's real 10-12 doc (dated 10-11) rebuilt as 10-12 Monday, same blocks on a second visit | `/pulse-fix` | plan rebuilt when date != today. Browser check owed: tab left open across midnight refetches |
| C7 | Pre-reader got a G1 "main idea" new lesson; better K fits dropped | `/reader-fit` on planner picks | decide whether the reading band gates teach picks |
| C8 | DONE 10-12, uncommitted. 9 tests mocked `get_curriculum` after 7.0 moved the planner to `get_student_curriculum`; 1 asserted "retest first", which the PRD §8 interleave (new block first, then reviews most-overdue first) replaced. Mocks and assertion updated; 18/18 pass | `/pulse-fix` | green |

## Fit gate: every generation is checked against its objective (10-12)

BUILT 10-12, uncommitted. `service/fitGate/` runs inside `generateComponentContent` (every
visual generation, lesson and Pulse) and on Pulse text problems: the primitive's content oracle
(code) plus one Jev call on a compact learner view (prompts + answer keys, ~100-350 tokens,
~150-300 ms) answering teaches-the-objective / numbers-inside-the-objective / fits-the-grade.
A miss is regenerated once with the reasons; Pulse replaces a persistent miss with a problem
built from the subskill; every verdict goes to `qa/fit-gate/ledger-*.jsonl`.
`node scripts/fit-gate-report.mjs` ranks primitive x mode by first-try failures (the outliers).
Calibration: 26 labelled 1004 items, 26/26 (`qa/fit-gate/calibration-2026-10-12.md`).
Runtime: 2 Pulse replays, 12/12 final items on-subskill (gate caught counting-board for
"43 + 5" twice, substituted; caught a "12 toys" item for "within 10", redraw fixed it); one
K lesson via the dev server ("11 to 20"): 5 of 8 generations missed first try.

| # | Item | Executor | Exit |
|---|---|---|---|
| F1 | Lessons ship the better attempt of a persistent miss; no substitution yet | user ruling, then `/student-data-loop` | rule: substitute (KC for the objective) or ship + flag |
| F2 | number-tracer `trace` ignores the objective's range ("Trace 9" for "numerals 11-20", fails after redraw) | `/topic-fidelity number-tracer` | ledger: trace passes for 11-20 objectives |
| F3 | knowledge-check production items ignore the objective's numbers (count 2 apples for "11 to 20") | `/topic-fidelity knowledge-check` | ledger clean on the 11-20 lesson |
| F4 | Ledger is a local file: fine on the dev server, lost on a serverless deploy | `/student-data-loop` | Firestore sink + the report reads it, when deployed |
| F5 | Thresholds from 26 items; teaches margin thin (0.15 vs 0.28) | label 100 ledger rows, re-fit | agreement >= 95% |
| F6 | Run the report weekly; top outlier becomes the next `/eval-fix` / `/topic-fidelity` item | `/pm` | standing |

## 28-day trajectories (10-12, after R2/R3/C4/C5)

Six `--loop --days 28` journeys (K: steady, struggling, gifted, cold start,
shallow roots; G1: steady), read at days 7/14/21/28 by
`tests/pulse_agent/trajectory.py`. Readout: `backend/reports/trajectory-2026-10-12/TRAJECTORY.md`.
All six: Pulse in L0, `rollup_replay_parity`, `serve_integrity`,
`learner_state_replay_parity` MATCH. True ability rises every week for every
child (one dip: shallow roots week 4, 6.01 -> 5.86, the truth model's forgetting).
A new skill taught before a required step that was neither taught nor within
the child's true ability: 0-3 per child per week (most flagged cases are
easier-form or related edges).

| # | Finding | Executor | Exit |
|---|---|---|---|
| T1 | BUILT 10-12 (user ruling: a continual system; showing K and G1 opens G2; make it a salient event and put it in reporting), uncommitted. `engine.grade_reach`: a grade is grown past when 60% of its subskills are mastered (gated readout); each grade grown past from the grade of record opens the next, so the ready window is max(record + 1, first grade not grown past). Above the grade of record a subskill still counts only through own evidence. Fixed same day after the report showed "has shown most of K math" beside 18 of 166 mastered: a skill counts toward a grade only on evidence (practised, or an R step of a practised one), never on general ability; 1004 math K is 42 of 166 shown (25%), nothing grown past. The My Progress headline uses the same evidence count ("skills shown"; LA read 186 from 19 practised before). **Unified 10-12 (user: "these need to be intricately connected"):** `engine.demonstration` is the one per-subskill state (mastered > shown > learning > tried) read by the report grid, the My Progress card, reach and `select`. Evidence AND lifecycle gates/retention flow down `g.spa` = R steps + easier forms (Jev easier_form >= 0.6, step < 0.8; count 20 -> count 10 is easier 0.78, step 0.64, so R-only missed it). phi never reports. 1004 K math grid: 18 -> 51 mastered + 5 shown; LA 18 + 12; science 0 + 12. Open: credit is not decayed per hop (longest seen: 4 hops); a few 0.6-0.8 easier edges over-credit (recall addition facts -> "add and subtract fluently within 5") -- graph quality, /curriculum-graph. `observe` stamps `grown_past {grade: ts}` on the state and a `milestone` on the event; `select` / `profile` return `reach_grade` + `grown_past`; `influence` returns `milestones`. Shown in LessonImpact (lesson review) and My Progress (`GrownPastBanner`, child copy), and the progress report (facts `grown_past`, narrative leads with it, parent banner). Gifted K child runs out of teaching: week 4 is retests 44, confirms 32, learn 10, new 4; the last day is all confirm. The ready window stops at grade of record + 1 and no promotion fires (planner promotion needs the K curriculum exhausted by lifecycle; she has 15 at gate 4 of 166). Same as "gifted depth" above | `/pulse-fix` (window from evidence, or promotion read from the learner model) · ruling: how far ahead may a K child go | gifted loop: learn/new picks every day of 28 |
| T2 | Struggling K child: no retest, no gate 4 in 28 days; lesson average 4.2 -> 6.3, Pulse 69% -> 81%, longest miss run 4 (`pulse_miss_streak` fails at 3); 19 subskills seen. Nothing easier than K to step down to | P5.5 (`/curriculum-graph`, `/curriculum-author`) | miss run <= 3 |
| T3 | Steady G1 child is served mostly G2 work by week 3 (G2 39, G1 11, K 19 items) and Pulse success falls to 35/42 in week 4. Within the +1 window and the P(ready) floor, but fast for an average child | `/pulse-agent lab` (window / readiness sweep) then `/pulse-fix` | rule: share of above-grade teaching for a steady child, checked on the loop |
| T4 | Lifecycle mastery lags the model by design: day 28 gate 4 = steady K 3, steady G1 0, cold start 0, against model mastered 80 / 23 / 36. Anything parent-facing that says "mastered" does not move for a month | R5 / P4.2 (`/student-data-loop`) | decide what My Progress shows before 30-day stability |

Content read of the same runs (days 1, 2, 27, 28) changes T1/T3:

| # | Finding | Executor | Exit |
|---|---|---|---|
| T5 | **Subskill difficulty does not follow grade, and the simulation inherits it.** Learner-graph node beta (the selector's target_beta AND the truth child's item difficulty): K "add and subtract fluently within 5" 4.5, G1 "time to the hour" 1.5, G2 "value of a digit in a three-digit number" 3.0. So a steady G1 child fails K fluency for 4 weeks while G2 place value reads as easy; T3's "mostly G2" is this artifact, and the loop cannot say whether a real child could do the work, because truth and selector share the numbers (7.13 found the cause: beta = the primitive's registry median) | `/curriculum-graph` (content difficulty per node: grade + within-grade order, Jev-rated) · `/pulse-agent` (truth difficulty independent of the selector's beta) | node beta rises with grade within a strand; truth model reads its own difficulty |
| T6 | PARTLY BUILT 10-12: a practised subskill at model P(mastered) >= 0.95 is no longer a confirm pick (`CONFIRM_MAX`); the confirm loop came from the lifecycle record lagging the model (T4). Open: failing learn picks that never step down; planner "new" every day. **The same items repeat for the whole month.** Steady G1: OPS001-03-D (K, beta 4.5) served on days 1, 2, 27, 28, scores 5.1 -> 7.3; NBT002-01-b planned as "new" every day from day 1 to 28. Gifted K week 4 is easier than week 1 (confirms of "count to 5", "o'clock", shape names at beta 1.5-2 vs week 1 G1 place value and partitioning) | `/pulse-fix` | a learn pick that fails N days steps down or rotates; confirms stop once a subskill is confirmed; "new" means first lesson |

## Rulings needed before P2 (user)

| # | Ruling | Recommendation |
|---|---|---|
| R1 | Which is "the Pulse"? | The ribbon's pulse beat launches a short PulseEngine session (bound primitives, leapfrog, workspace) instead of the knowledge-check. Home → Practice stays as "more Pulse". One engine, two entry points |
| R2 | DECIDED 10-12: yes; Pulse answers must support full analysis (problem, answer, metrics) and feed misconception + support capture. Pulse writes L0? | Yes: each Pulse answer goes through `save_attempt` with `source='pulse'` (attempt + review, shared `attempt_id`). Fixes rollups, profile, backfill and the learner-state rebuild in one move |
| R3 | DECIDED 10-12: yes (a first-try right counts, a first-try miss informs selection). User's test: does a 7-14-21-28 day journey put the child on a sensible path. 7.7 first-try into production theta | Yes, as part of P2: `first_try` becomes an attempt field; CalibrationEngine reads it when present. Replay: loss 0.055 vs 0.065 |
| R4 | DECIDED 10-12 (switch made). 7.11 + 7.3 target-P hold | Resolve both by switching selection to the learner model's value = P(right) x teaching value (P4), not by adding a scalar target P to today's engine. Price a subskill with no primitive (default discrimination, beta from the graph node) |
| R5 | Mastery source | Lifecycle gates stay the one "mastered" record (evidence count, sigma, 30-day stability). From P5, the P(correct) they check comes from the learner model instead of CalibrationEngine |

## P0 — Land what is built

| # | Item | Executor | Exit |
|---|---|---|---|
| P0.1 | Ship 7.4d, 7.5, 7.6, 7.13 in mechanism slices | `/ship` | typecheck:lumina 0; backend tests compared to the prior run; `/pulse-agent steady --loop` all assertions pass |
| P0.2 | Browser checks: LearnerModelSection card, LessonSummary "Your progress", one real Pulse session submits the pinned eval_mode | user / HUMAN-CHECKS | 3 checks closed |
| P0.3 | Backfill learner state for the other real students | `scripts/backfill_learner_state.py` | dry-run reviewed, applied |

## P1 — The data loop holds for the new doc (`/student-data-loop`)

| # | Item | Exit |
|---|---|---|
| P1.1 | DONE 10-12, uncommitted. `PulseEngine._write_l0`: one attempt (`source='pulse'`, eval_source, primitive/mode, success, first_try, duration, band, selection kind, target_beta, predicted P(right), subskill grade) + one review (problem shown, student work, metrics) per item under the learner event's id `{session}:{item}`. The frontend sends `student_work`, `metrics`, `problem_content` and runs the lesson path's misconception + learning-observation capture after each Pulse submit (Pulse primitives run `localOnly`, so capture never fired before). Not done: IRT/lifecycle/competency still run on Pulse's own prefetch-batched route, not CompetencyService (same writers, same math; merging would cost the batching). Loop: 654 attempts = 486 lesson + 168 Pulse, `rollup_replay_parity` + `serve_integrity` pass | `rollup_replay_parity` and `serve_integrity` pass with Pulse days included |
| P1.2 | DONE 10-12, uncommitted. `first_try` (+ `evidence_parts`, `lesson_grade`) on lesson and Pulse attempts; `CalibrationEngine.process_submission(first_try=)` sets θ/β from the first-try fraction with one part per challenge (R3). Lifecycle gates still count the final score (not in R3's scope; see trajectory) | attempt docs carry it; replay reads attempts, not reviews |
| P1.3 | DONE 10-12, uncommitted. `backfill_learner_state` replays attempts (first_try from the attempt, else from its joined review for pre-R3 lesson attempts; diagnostic skipped); `observations()` / `replay()` are shared with the new loop assertion `learner_state_replay_parity`. 28-day steady K loop: MATCH over 654 attempts | assertion passes on a 10-day loop |
| P1.4 | DONE 10-12, uncommitted. Lineage before write: `observe` and `select`'s lifecycle read resolve subskill ids through `subskill_id_resolver` before `_resolve_key` (invariant 4). Probe on real lineage + learner graphs: `COUNT001-01-a` -> `Kindergarten:COUNT001-01-A` (was skipped); 6 of 233 lineage records land on a node this way. `tests/test_learner_lineage.py` 2 pass | probe with a renamed id lands on the canonical node |
| P1.5 | Grade promotion feeds the exposure gate (`subject_grade_overrides`, not only `grade_level`) | `--promote-engine` loop: ready list moves with the grade |
| P1.6 | DONE 10-12, uncommitted (§2b Pulse L0, §2c first-try, L1 `learner_state` + rebuild, READY_MIN). Restate `/student-data-loop`: `learner_state` as L1 (writer, rebuild, readers), first-try on L0, Pulse in L0 | skill doc matches code |

## P2 — The harness can judge a selector swap (`/pulse-agent`)

| # | Item | Exit |
|---|---|---|
| P2.1 | Loop-mode truth with prerequisite dependence: port the lab's `truth.py` children (personas included) into `tests/pulse_agent` | `--loop --truth-graph` runs all 12 archetypes + 6 personas |
| P2.2 | `PULSE_SELECTOR=today\|layered` setting; loop and engine modes run either on the same seed | one profile, both selectors, one report |
| P2.3 | New loop assertions: `prereq_missing_rate` <= 0.05, `first_try_success` in 0.65-0.9, `miss_streak_max` <= 3, `session1_success` >= 0.5, `served_matches_ready` (what Pulse served was on the card's ready list) | assertions fail today's engine where the sweep says it fails |
| P2.4 | Shadow decisions on real traffic: on each Pulse session, log what `layered` would have served beside what `today` served (`learner_events`, kind `shadow_pick`) | a week of real sessions gives an agreement rate and the disagreement list |
| P2.5 | Fix the seed-42 nondeterminism (two baselines differ by up to 10 gate advances) | two runs, same seed, identical report |

## P3 — Pulse selects with the learner model

CLOSED 10-12 by the switch above (no flag: switched outright). Rows kept for history.

| # | Item | Executor | Exit |
|---|---|---|---|
| P3.1 | `_assemble_unified` reads frontier + value from `LearnerStateService` behind `PULSE_SELECTOR`; items still carry (mode, beta) per 7.6; handoff unchanged (7.5) | `/pulse-fix` | P2.3 assertions pass under `layered`, all existing loop assertions still pass |
| P3.2 | Price subskills without a primitive (7.11): stop emitting `primitive_affinity` / `eval_mode_hint`; target_beta from the node's beta and theta | `/pulse-fix` | `items_carry_engine_mode` passes; no curriculum `primitive_type` read in selection |
| P3.3 | Cold start = graph placement: the first session probes hubs chosen by expected information on the graph, not beta-3.5 pins; leapfrog becomes the graph's own inference (R ancestors of a passed node) | `/pulse-fix` · `/pulse-agent cold_start --loop` | session-1 success >= 0.5; placement MAE <= today's |
| P3.4 | Default `PULSE_SELECTOR=layered` after P2.4 shows no harmful disagreement class | user | flag flipped; today's path kept one release, then deleted |

## P4 — One brain everywhere (`/student-data-loop` §7)

| # | Item | Exit |
|---|---|---|
| P4.1 | DONE 10-12 (switch). `select_session_targets` reads the learner model's ready list + value; planner Step 1b and Recommended Lesson follow (same endpoint, same tray, no new surface) | loop `plan_coverage`, `mastered_leaves_targets` pass; Recommended Lesson == card's ready list |
| P4.2 | Lifecycle gates check learner-model P(correct) (R5); evidence counts and stability rules unchanged | `/pulse-agent all --loop` gate-advance distribution within today's band; no same-day mastery |
| P4.3 | Session-progress delta (break screen) reads `influence`, same as LessonSummary; theta_history path retired | one close-out source |
| P4.4 | Lessons get the same handoff (7.12): resolver's fitting set is allowed, target_beta narrows within it | `/pulse-agent` lesson items carry target_beta; 7.8 bugs fixed first |
| P4.5 | Retire PulseEngine transfer prior and published-graph BFS for selection; published soft edges stay as the variety layer | dead code gone; Deprecation Ledger entry |

## P5 — The Pulse a child and parent see

| # | Item | Exit |
|---|---|---|
| P5.1 | Ribbon pulse beat = PulseEngine session, ~4 min (R1); knowledge-check pulse shape retired | browser: block 1 opens Pulse items, break screen counts them |
| P5.2 | Pulse end screen shows what moved: practised, "next skills got easier", foundations confirmed (the `influence` read) in MasteryBands, never percentages | browser check |
| P5.3 | Parent report reads the same learner-model rows (`parent_summary`) | parent report and card agree on one student |
| P5.4 | Density feedback: Pulse `MISMATCH` logs (|delta beta| > 1) roll up weekly into a ranked list of (subskill, missing beta band) for `/lumina-densify-primitives` and `/add-support-tiers` | first ranked list filed in their queues |
| P5.5 | Struggling child below the floor: subskills with no easier form in the graph get Pre-K / easier-form nodes | `/curriculum-graph` + `/curriculum-author` |

## Graph validation (runs beside P1-P3)

| # | Item | Executor |
|---|---|---|
| G1 | User labels `user_math_g3g5_pairs.json`, then `validate` | user, `/curriculum-graph` |
| G2 | Science + social studies spot labels (20 pairs each) | user, `/curriculum-graph` |
| G3 | Measure easier-form transfer (7.9) on a persona session; it decides whether the mastery gain is real | user session, `/pulse-agent lab replay transfer` |
| G4 | Re-run the lab frontier sweep after the sampler fix | `/pulse-agent lab` |

## What this does not do

- No new launch surface: selection changes reach lessons only through the Lesson Builder tray
  (§7 contract).
- No primitive named by the backend; no manifest rules.
- No heuristic multipliers: value = P(right) x teaching value is the model's own quantity.
