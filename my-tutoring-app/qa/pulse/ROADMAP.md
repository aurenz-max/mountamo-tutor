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

## Rulings needed before P2 (user)

| # | Ruling | Recommendation |
|---|---|---|
| R1 | Which is "the Pulse"? | The ribbon's pulse beat launches a short PulseEngine session (bound primitives, leapfrog, workspace) instead of the knowledge-check. Home → Practice stays as "more Pulse". One engine, two entry points |
| R2 | Pulse writes L0? | Yes: each Pulse answer goes through `save_attempt` with `source='pulse'` (attempt + review, shared `attempt_id`). Fixes rollups, profile, backfill and the learner-state rebuild in one move |
| R3 | 7.7 first-try into production theta | Yes, as part of P2: `first_try` becomes an attempt field; CalibrationEngine reads it when present. Replay: loss 0.055 vs 0.065 |
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
| P1.1 | Pulse writes L0 (R2): `process_result` calls the shared attempt + review path; competency/IRT/lifecycle stop being fed by a second route | `rollup_replay_parity` and `serve_integrity` pass with Pulse days included |
| P1.2 | `first_try: [bool]` on the attempt doc, written by lesson and Pulse paths; `first_try_from_response` is the one reader (R3) | attempt docs carry it; replay reads attempts, not reviews |
| P1.3 | Learner-state rebuild contract: `backfill_learner_state` replays L0 attempts (lesson + Pulse) and overwrites; new loop assertion `learner_state_replay_parity` (incremental == replay, same seed) | assertion passes on a 10-day loop |
| P1.4 | Lineage before write: `observe` resolves subskill ids through lineage before `_resolve_key` (invariant 4) | probe with a renamed id lands on the canonical node |
| P1.5 | Grade promotion feeds the exposure gate (`subject_grade_overrides`, not only `grade_level`) | `--promote-engine` loop: ready list moves with the grade |
| P1.6 | Restate `/student-data-loop`: `learner_state` as L1 (writer, rebuild, readers), first-try on L0, Pulse in L0 | skill doc matches code |

## P2 — The harness can judge a selector swap (`/pulse-agent`)

| # | Item | Exit |
|---|---|---|
| P2.1 | Loop-mode truth with prerequisite dependence: port the lab's `truth.py` children (personas included) into `tests/pulse_agent` | `--loop --truth-graph` runs all 12 archetypes + 6 personas |
| P2.2 | `PULSE_SELECTOR=today\|layered` setting; loop and engine modes run either on the same seed | one profile, both selectors, one report |
| P2.3 | New loop assertions: `prereq_missing_rate` <= 0.05, `first_try_success` in 0.65-0.9, `miss_streak_max` <= 3, `session1_success` >= 0.5, `served_matches_ready` (what Pulse served was on the card's ready list) | assertions fail today's engine where the sweep says it fails |
| P2.4 | Shadow decisions on real traffic: on each Pulse session, log what `layered` would have served beside what `today` served (`learner_events`, kind `shadow_pick`) | a week of real sessions gives an agreement rate and the disagreement list |
| P2.5 | Fix the seed-42 nondeterminism (two baselines differ by up to 10 gate advances) | two runs, same seed, identical report |

## P3 — Pulse selects with the learner model

| # | Item | Executor | Exit |
|---|---|---|---|
| P3.1 | `_assemble_unified` reads frontier + value from `LearnerStateService` behind `PULSE_SELECTOR`; items still carry (mode, beta) per 7.6; handoff unchanged (7.5) | `/pulse-fix` | P2.3 assertions pass under `layered`, all existing loop assertions still pass |
| P3.2 | Price subskills without a primitive (7.11): stop emitting `primitive_affinity` / `eval_mode_hint`; target_beta from the node's beta and theta | `/pulse-fix` | `items_carry_engine_mode` passes; no curriculum `primitive_type` read in selection |
| P3.3 | Cold start = graph placement: the first session probes hubs chosen by expected information on the graph, not beta-3.5 pins; leapfrog becomes the graph's own inference (R ancestors of a passed node) | `/pulse-fix` · `/pulse-agent cold_start --loop` | session-1 success >= 0.5; placement MAE <= today's |
| P3.4 | Default `PULSE_SELECTOR=layered` after P2.4 shows no harmful disagreement class | user | flag flipped; today's path kept one release, then deleted |

## P4 — One brain everywhere (`/student-data-loop` §7)

| # | Item | Exit |
|---|---|---|
| P4.1 | `select_session_targets` reads the learner model's ready list + value; planner Step 1b and Recommended Lesson follow (same endpoint, same tray, no new surface) | loop `plan_coverage`, `mastered_leaves_targets` pass; Recommended Lesson == card's ready list |
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
