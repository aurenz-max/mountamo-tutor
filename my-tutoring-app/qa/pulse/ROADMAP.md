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
| C1 | DONE 10-13 (user checked in the app). Browser check: one Pulse session for 1004 shows K audience, "Quick check" labels, items on-subskill | user / HUMAN-CHECKS | checked |
| C2 | Theta follows learning. Tried 10-15 (C3 harness, 3 profiles x 28 days): per-answer drift 0.4/0.6 cut steady lag but dropped struggling success to 65-67%; per-day drift since last practice (`engine.DIFFUSION_DAY_SD`, built, default 0 = off) at 0.3: steady lag -0.102 -> -0.043, hidden mastery 22 -> 10, but gifted hidden 6 -> 14 and distinct 128 -> 111; 0.6 worse everywhere (struggling repeat 85%, a 17-day stuck run). Learning: measurement fixes do not touch repetition (repeat stays 47-60% in every variant) | `/pulse-fix` | TRIED, 0.3 is a candidate once C4 lands |
| C3 | BUILT 10-15 (uncommitted): the loop harness answers every lesson and Pulse item as 4 first-try right/wrong challenges (`full_loop.CHALLENGES`, `LatentStudent.answer_challenges`) and sends them as `first_try`. Effect: gates work (gifted gate 4 31 -> 77, steady 0 -> 2), struggling bias -0.038 -> -0.003, struggling miss streak passes; steady lag unchanged (-0.10), steady repeat 35% -> 47% | `/pulse-agent` | BUILT |
| C4 | Expected-improvement value, then delete `MISS_DAYS`, `CONFIRM_MAX`, confirm share. BLOCKED on the judge: neither truth model (loop `LatentStudent`, lab `TruthStudent`) has a spacing effect, so massed practice teaches as much as spaced and both sims reward repetition by construction. Step 1: truth models get an opt-in spacing effect; the scorecard runs each selector against truth WITH and WITHOUT it (a rotation rule must cost little without and win with). Scorecard now has `true gain` | user ruling on the learning theory, then `/pulse-agent` + `/pulse-fix` | NEEDS RULING |
| C5 | Memory layer (knowledge x recall): per subskill stability S and recall R = (1 + 19/81 t/S)^-0.5 (gamma-mixed Poisson forgetting, FSRS form); a successful day grows S more the further recall had faded (spacing); review value ~ (1 - R) (Tabibian 2019); replaces the retest schedule, `CONFIRM_MAX`, `MISS_DAYS`. Step 1 DONE 10-15 (`scripts/learner_model_lab/memory.py`, record + fit on 1004): no gain (gap-review loss 0.247 without memory vs 0.251 best fit; FSRS-like prior 0.45). Real data cannot fit it yet: one real student; 90% of repeat reviews are same-session; 189 challenges after a gap >= 1 h; the 1-7 day misses are math-fact fluency still being learned (OPS001-01-c, OPS001-02-b on di-math-facts / math-fact-fluency, knowledge over-predicted), not forgetting of known skills; 7+ day gaps 0.979 predicted vs 0.968 actual. Next: spacing in the simulated child (curve family different from the engine's), then the selector judged with spacing on and off; real fit waits for spaced real data | `/pulse-agent lab` | STEP 1 DONE; STEPS 2-3 NEXT |
| C9 | Common-sense checker BUILT 10-15 (uncommitted): `backend/tests/pulse_agent/common_sense.py` judges the TRACE with an independent Beta-binomial per subskill (no engine internals), each limit cited: no drill when proven (80% at 95%: Bloom 1968, Corbett & Anderson 1995; spacing: Cepeda 2006), no question already answered, model calibrated vs the last 20 first-try, not massed (> 3 days running), no failing run, challenge band 70-92% (85% rule, Wilson 2019), proven gets review (Tabibian 2019). Harness trace now logs first-try flags, lesson results and model P(mastered). Baseline (C3 harness, 28 days): massed runs 11 / 12 / 17 days (gifted / steady / struggling); steady OPS001-01-c 152 first-try answers at 81% over 14 days with model P(mastered) 0.02-0.25 and model P(right) 0.61-0.66 vs 0.80-0.85 actual; struggling at 59% Pulse accuracy (below band), gifted at 92% (at the top); gifted 15 of 33 proven subskills never reviewed. Every selector or model change reports this table beside the scorecard. CORRECTED 10-15: the baseline's calibration gap was mostly the harness. The sim answered with a = 1.0 while the engine scores registry items at a = 1.2-1.4, and the check compared the typical item's P(right) (a = 1), not the served item's. Sim now answers with the served item's registry a, beta, c; harness logs `p_served`. Re-run (`reports/cs-fixa`): model_calibrated PASSES for all three; steady lag -0.102 -> -0.063, struggling -0.008 -> -0.045. Still failing: not_massed 5 / 16 / 13 days; steady OPS002-06-c at 85% first try reads P(mastered) 0.08-0.24 because tau = beta + 1.4 is 80% on an a = 1 item, i.e. about 88% on the a = 1.4 item served; gifted 93% (above band) with 30 of 51 proven never reviewed; struggling 61% (below band). Checker limit: its per-subskill record pools lesson items (ten-frame mode, beta up to 4.5) with Pulse items at beta_k, so struggling COUNT001-01-A (lesson 48%, Pulse 75%) reads as failing and flags the model overconfident falsely | `/pulse-agent` | BUILT |
| C10 | Memory selector BUILT 10-16 (uncommitted), judged by C9 over 3 profiles x 3 seeds (`reports/cs-mem8-s{42,7,99}`). Harness: sim answers with the served item's registry a/beta/c, lessons served at the subskill's level, checker records keyed by item beta and crediting review through a containing subskill. Model: typical item a = registry median 1.4 (`engine.TYPICAL_A`, mastery margin 0.99). Memory (`learner_model/memory.py`): per-subskill stability S, R = (1 + 19/81 t/S)^-0.5, FSRS-5 first stability and hard/easy factors, each day rated from its first-try answers; a successful day also reviews what the subskill demonstrates (g.spa). Selector: one value = retention a review keeps + new learning (LAMBDA x 85%-rule weight x teaching value) x share of stability it builds; probes of inferred-mastered subskills worth the evidence the reach-gating grade still needs; items served at the child's 84% difficulty within 1 beta (`served_beta`); lesson targets learning picks only. Deleted: CONFIRM_MAX, T6 rest/step-down (MISS_DAYS now harness-only), PULSE_CONFIRM_SHARE. Result vs `cs-base`: model calibrated everywhere; steady longest run 22 -> 4-8 days, next-day repeat 47% -> 7-8%, distinct 50 -> 78-90, true gain 13.5 -> 21.5-23.4; gifted true gain 25.4 -> 22.0-24.9; struggling 74% -> 85-89% success, distinct 26 -> 64-69. Still failing: not_massed 4-17 days (acquisition of a not-yet-learned subskill in daily lessons or Pulse); gifted drill 5-7% (all lifecycle retests run as 3-item lessons); gifted band 93-94%. Each needs a ruling, see the 10-16 report | user ruling, then `/pulse-fix` | BUILT, 3 RULINGS OPEN |
| C11 | Retests vs memory reviews A/B 10-16 (`backend/tests/pulse_agent/retest_ab.py`, `reports/ab-retest`, 4 children x 3 seeds x 28 days, uncommitted). Arms: on (lifecycle retests as 3-item lessons), off (`--no-retests`, day shrinks), fill (`--no-retests --fill-from`: each day's retest slots go to selector learning picks, equal time). Judged on the truth model's own forgetting. Fill vs on: subskills kept at truth P >= 0.8 on day 28 steady 69.7 -> 73.0, gifted 99 -> 107, forgetful 68 -> 79, struggling 0.3 -> 2.3; review items 284 -> 72 / 442 -> 159 / 368 -> 147; review items on subskills already at 0.9+ 102 -> 30 / 407 -> 126 / 243 -> 79. Costs: forgetful lapses 2.7 -> 12.3, left unreviewed 1.0 -> 5.3 (memory uses FSRS-5 defaults, never fits the child's own forgetting); lifecycle gate 4 collapses without retests (gifted 66 -> 26) while the child knows more, so gates measure 'was retested', and every gate reader (planner unlock, My Progress, parent report, pulse gate_update) must move to the memory readout before retests go. True gain falls for gifted 23.9 -> 14.6 because fill found fewer learning picks (245 vs 448 lesson items) and the truth model credits any practice, including drill at the ceiling. Limit: truth has forgetting but no spacing effect (C4) | user ruling to sunset; then `/pulse-fix`: (1) per-child forgetting fit in memory.py until forgetful lapses <= on, (2) gate readers -> memory readout, (3) planner drops retests, fill to selector | MEASURED, RULING OPEN |
| C12 | Per-child forgetting + mastery readout 10-16 (uncommitted, `reports/ab-mem`). BUILT: `memory.py` per-child stability multiplier m (grid log-likelihood in engine state `mem_fit`, credibility blend log m = n/(n+K) log m_hat; each later-day practice scored against the knowledge model's P(right) as R p + (1-R) FORGOT_P), `K_CRED = inf` (collected, not applied); truth `steady_hl` / `forgetful_hl` (per-subskill exponential recall, half-life 21 / 3 days, spacing growth, base theta 2.5); struggling recalibrated to steady's per-item rate (Koedinger 2023: students differ in start, not rate; was a third of it, cap 5.0 put G1 beta > 4 out of reach); delayed posttest (`truth_delayed`, 7 days no practice); `mastery_check.py`. FOUND: (1) no simulated child shows forgetting in its served answers: the knowledge model absorbs post-gap misses as lower ability and serves items at the forgotten level (forgetful_hl 5-day gap 0.87 observed vs 0.77 predicted), so the fit reads m 6-10 for a 3-day half-life and offline K differences are < 1%. (2) Retests still win slightly where forgetting is real: forgetful_hl kept a week later 27.0 retests vs 25.3 memory defaults, on 124 vs 12.7 review items; steady_hl 36.7 vs 37.0. (3) Model 'mastered' (80%) vs truth >= 0.8: precision 0.93-1.00, recall 0.79-1.00 (gifted, steady, forgetful); gate 4 precision 1.00, recall 0.08-0.24. Against 90%: model precision 0.47-0.94 (it is built on 80%). (4) Struggling still keeps 8 subskills in 28 days at ~8 items per skill: spread over 65 subskills | `/pulse-fix`: knowledge and recall fitted jointly (the knowledge likelihood itself R p(theta) + (1-R) p_forgot, so a post-gap miss lowers recall, not ability); then calibrate K on forgetful_hl until kept-a-week >= retests at fewer reviews; then gate readers -> model readout. User rulings: mastery bar 80% or 90%; concentrate acquisition for struggling | BUILT, FIT NOT APPLIED |
| C13 | Retests retired; learner model sets gates (USER RULING 10-16: sunset retest gates, mastery bar stays 80%). Uncommitted. (1) `LearnerStateService._sync_lifecycle` -> `MasteryLifecycleEngine.apply_model_states` after every observe: gate 4 = P(mastered) >= 0.8, gates 1-3 by P(right) vs GATE_P_THRESHOLDS, retention 'mastered' = gate 4 + memory stability >= 30 days; every gate reader (planner unlock, KG status, My Progress, parent report, Pulse) reads the model through the lifecycle doc. Gifted without retests: gate 4 110 / truly known 110 (IRT gates: 26). (2) Both planners stop serving retests; new lessons get the minutes reviews leave (`fill_budget`); selector pool ~4 min per target (was 8, sized for half-day retests). (3) Grade promotion also fires when the model has no learning pick and its reach is past the grade (KG frontier never exhausts on model-inferred subskills; retests had filled gifted's idle days). Result vs the old system (`reports/ab-final`, 6 children x 3 seeds x 28 days, kept = truth P >= 0.8 a week after the last day): steady 69.0 -> 77.7, gifted 99 -> 175 (promoted to G2 day 12-17), forgetful 67.7 -> 68.3, struggling 5.7 -> 8.7, steady_hl 36.7 -> 43.0, forgetful_hl 27.0 -> 34.3; review items cut 3-12x. Loop assertions: `reviews_surfaced` replaced by `reviews_are_pulse_items`; gifted fails `plan_every_day` 27/28 in 2 seeds (G2 exhausted on day 28, second promotion lags a day) and `learner_state_tracks_truth` (ceiling: Spearman ~0.1 at MAE 0.03, fails the same way in the old system). Open: joint knowledge + recall fit (C12) so the per-child forgetting multiplier can be applied; gate readers that show retest dates (`/retests/due`, PlannerDashboard MASTERY_RETEST reason) now show none | `/pulse-fix` | BUILT, VERIFIED IN SIM |
| C14 | Gate backfill for real students: the C13 sync only re-gates subskills an answer moves, so existing lifecycle docs keep IRT/retest gates until touched. One-shot script (dry-run default, `--student N` / `--all` / `--apply`, the backfill_daily_rollups pattern): for each student and subject, read the stored learner readout and apply `apply_model_states` to every lifecycle doc. Verify on 1004: gate counts before/after, My Progress snapshot | `/pulse-fix` | BUILT 10-16: `scripts/backfill_model_gates.py` (`LearnerStateService.regate`, same verdict as the answer-time sync; `tests/test_learner_regate.py`). States stored before 10-16 carry no memory stability, so gating from them drops every mastered retention state to active: run with `--rebuild` (replays answers first, writes the state with `--apply`). 1004 dry run: 94 of 110 graph-resolved docs change (44 of 154 lifecycle docs are off the learner graph and stay); math g4 29 -> 61, mastered 25 -> 24. **APPLIED on 1004 10-16** (user ran `--rebuild --apply`): 2902 learner-state docs, 110 lifecycle docs (16 more than the gate/state count: stability changes too), result as the dry run. Backup of the pre-C14 docs in session scratchpad. **Owed: `--all --rebuild` dry run, then apply; C16 browser check on 1004** |
| C15 | Delete the retest machinery C13 left dead: lifecycle retest scheduling (`next_retest_eligible`, `RETEST_INTERVALS`, retest branches of `_handle_practice_eval`), the IRT gate derivation the sync now overwrites, `GET /{student_id}/retests/due`, `BlockType.RETEST` and its fill branch, `SessionReason.MASTERY_RETEST` + PlannerDashboard retest UI, `get_weekly_plan` / `get_forecast` pacing that projects 3d/7d/14d retests, `retests_due_morning` in the harness. Contract-first: grep every reader | `/pulse-fix` | QUEUED |
| C16 | Browser check of the gate readers on a real account after C14: My Progress snapshot + curriculum map, Planner dashboard (no retest rows, fuller day), lesson close-out 'Your progress' (gate before = latest history entry, C13 fix), parent report. Sim-only so far | `/run` | QUEUED |
| C17 | Gifted second promotion lags a day (idle day 28 in 2/3 seeds): promotion fires from the empty-learn-picks trigger only on the morning after the grade empties; re-select in the same plan after a model-triggered promotion | `/pulse-fix` | QUEUED |
| C18 | Pulse still reports the old gate. Selection and gate writes use the learner model (the answer's background sync overwrites the gate), but `pulse_engine.submit_item` runs `mastery.process_eval_result` first and builds `gate_update` from its IRT gate: the results screen "Skills advanced" (`PulseSession.tsx` SkillsAdvancedSection, `gateAdvances`) and the per-item `gate_progress` card (FrontierContextCard GateReadiness) show IRT verdicts, and for a moment the lifecycle doc holds the IRT gate. Fix: summary diffs the gate before the session (latest history entry before it, the C13 close-out rule) against the model's gate now; drop the IRT gate write with C15 | `/pulse-fix` | QUEUED 10-16, do with C15 |
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
| T6 | BUILT 10-15 (uncommitted): a learn pick missed (day mean first-try < 0.7) on 3 days running rests 3 days and its best unmastered easier form (else an R step) is served in its place (`engine.MISS_DAYS/REST_DAYS`, per-subskill day record in `touched`, replay-identical); selector picks the model has answers on plan as `practice`, so "new" = first lesson. Steady G1 28 days: OPS001-03-D 28 -> 18 pulse days, 'new' repeated on 10 subskills -> 0; struggling G1 worst served-and-missed run 19 -> 3 days, pulse success 70% -> 75%. New loop assertions `new_means_first_lesson`, `no_stuck_repeat`; `tests/test_learner_rest_step_down.py`. Open: a learn pick the child PASSES but the model does not yet call mastered still comes back most days (OPS001-03-D at 7-8 from day 21); gifted K week-4 easing not re-run | `/pulse-fix` | spacing for passing learn picks; gifted K 28-day re-run |

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
| P0.1 | DONE 10-13 (7631c431..e2f4f58a, main fast-forwarded). Ship 7.4d, 7.5, 7.6, 7.13 in mechanism slices | `/ship` | typecheck:lumina 0; backend tests compared to the prior run; `/pulse-agent steady --loop` all assertions pass |
| P0.2 | DONE 10-13 (user checked in the app). Browser checks: LearnerModelSection card, LessonSummary "Your progress", one real Pulse session submits the pinned eval_mode | user / HUMAN-CHECKS | 3 checks closed |
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

## Moved from WORKSTREAMS 2026-10-15

Everything marked "uncommitted" above shipped 10-13 (7631c431..e2f4f58a, be53b74c). Open
rows that lived only in the index:

| # | Item | Executor | State |
|---|---|---|---|
| 7.14 | A miss barely reaches the missed skill's prerequisites: 3 misses on a G1 skill move its next skill -0.44, its prerequisites -0.05 (less than unrelated K skills, -0.06 via phi), so the lesson review's "Worth checking" list stays empty. Options: weaker phi coupling for at-grade skills, or an untaught state; measure with the hops table + scripted miss | `/pulse-agent lab`, port via `/pulse-fix` | QUEUED 10-12 |
| 7.8 | Lesson manifest prompt asks difficulty "challenging" but the enum is easy/medium/hard (gemini-manifest.ts:80,83 vs :192); practice hydrator applies the first item's Bloom tier to the whole batch (practice-content-hydrator.ts:102) | `/eval-fix` | QUEUED 10-11 (blocks P4.4) |
| 7.13r | Exposure gate residue: lab anchor/reach/chain variants can be removed; `pc` of untaught above-grade subskills is still ungated (orders the ready list) | `/pulse-fix` | open |
| 7.0r | Curriculum reads without a grade remain in competency / assessment / recommender / curriculum_mapping / generation-context (logged); graph_cache_manager still writes root `*_latest_*`; lineage keyed by bare id; no G2 graphs | `/curriculum-graph` | open |
| 7.2r | Graph hygiene: publish never validates/remaps edges (G1 literacy 205 dead, 31 gating); `curriculum_graphs/2` has no core edges; no cross-grade edges storable; `is_prerequisite` vs `relationship` disagree; 17 legacy root docs (delete needs user OK) | `/curriculum-graph` | open |
| 7.6r | Curriculum node MEAS001-01-A lists sorting-station modes on `length-lab` | `/curriculum-author` (draft fix) | open |

## C — Consolidation: one evidence contract, one model, one decision rule (user 10-15)

User 10-15: "removal and consolidation; gather the data, consolidate, test and learn along the
way." The selector runs on two mastery estimators (lifecycle gates on per-skill theta, the learner
model on per-subskill theta + graph), mixed evidence (first-try from some primitives, score/10 from
others) and a value that scores state, not what the next item changes; hand-set thresholds
(`CONFIRM_MAX`, `READY_MIN`, confirm share, max per skill, `MISS_DAYS`) patch the gaps. Target:
1. **Evidence:** every primitive sends per-challenge first-try right/wrong (+ help used) at a known beta.
2. **One model:** the learner model is the only estimator; gates, mastered, My Progress are readouts;
   forgetting lives in the model, so review is a pick, not a schedule.
3. **One decision rule:** expected improvement from the next item; only stated product limits on top.

**Scorecard** (`backend/tests/pulse_agent/scorecard.py` over loop timelines; steady / struggling /
gifted G1, 28 days, seed 42): bias, lag, true>=.8-read<.8, gates, max days, repeat, miss run,
success, distinct. Real-data leg: `lab replay real` loss/AUC must not get worse.

Data 10-15:
- Real 1004 (1,854 reviews): first-try on 68% of reviews; 30 of 74 primitives send none
  (number-tracer 266, knowledge-check 141, multiple-choice 55). Where both exist the score
  overstates: measurement-tools score 10 vs first-try 0.67, time-sequencer 10 vs 0.72.
  base-ten-blocks 873 reviews, 0 first-try misses (can it record one?).
- Steady G1 28 days: 0 subskills at gate 4; 28 of 60 seen subskills truly >= 0.8 but read < 0.8;
  model below truth on 59 of 60 (mean -0.087). Bias grows with answers (gifted -0.006 at 1-3
  answers, -0.078 at 10-19): theta drifts only `DIFFUSION_SD` 0.2 per answer, so the model trails a
  child who improved.
- The loop harness sends scores only (no `first_try`), and its truth model is per SKILL while the
  learner model is per subskill; the lab's truth rewards every practice (cannot penalise repeats).

| # | Item | Executor | State |
|---|---|---|---|
| C1 | Evidence audit (static, 188 submitting primitives): ~146 send a per-challenge array, ~42 score only (30 never track attempts: most engineering/astronomy/biology sims; 12 track but do not send: CalendarExplorer, FactFile, HowItWorks, TimelineExplorer, VocabularyExplorer, ConstructionSequencePlanner, ReadingRepairStudio, OrbitMechanicsLab, GravityDropTower, PushPullArena, RaceTrackLab, SoundWaveExplorer); 24 send the array only on the workspace path. FIXED 10-15 (uncommitted): workspace outcomes carry `solved`, not `correct`, so an item missed once and never solved read as a first-try PASS on all 94 outcome senders, and assisted / uncertain items counted as unaided passes; one rule `first_try_of` (service.py) now serves the learner model, the XP bonus and the lab, mirrored in `pulse/firstTry.ts`. Open: send arrays from the 42 score-only primitives (12 already track attempts) | `/pulse-fix` (rule) · per-primitive `/eval-fix` (42) | FIX BUILT; 42 QUEUED |
| C2 | Theta follows learning. Tried 10-15: per-answer drift `DIFFUSION_SD` 0.2 -> 0.4 / 0.6 (scorecard, 3 profiles x 28 days): steady bias -0.087 -> -0.061 / -0.057, hidden mastery 28 -> 16 / 21, max days 18 -> 20 / 12; struggling success 77% -> 67% / 65%; steady gate 4 stays 0. Not shipped: per-answer drift widens every subskill alike. Next: drift per day since last practice plus a learning step tied to practice, after C3 makes the sim's evidence match the contract | `/pulse-fix` | TRIED, OPEN |
| C3 | Harness answers with per-challenge first-try (the contract real primitives meet) | `/pulse-agent` | QUEUED |
| C4 | Expected-improvement value; then delete `MISS_DAYS`, `CONFIRM_MAX`, confirm share if the scorecard holds | `/pulse-fix` | QUEUED |
| C5 | Forgetting in the model; retests become picks | `/pulse-fix` | QUEUED |
| C6 | Gates as a readout of the learner model (lifecycle becomes a view) | user ruling, then `/student-data-loop` | NEEDS RULING |
