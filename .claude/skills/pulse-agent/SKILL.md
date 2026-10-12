---
name: pulse-agent
description: >-
  Run synthetic student profiles through the adaptive engine — scripted
  archetypes, a latent-ability truth model, the full day-by-day student-data
  loop, or the learner-model lab that compares today's engine with the
  two-layer graph model (real-data replay, primitive-shaped simulated attempts,
  frontier selection) — without a real student or browser. Use to stress-test
  the adaptive machinery or judge a learner-model change, and produce findings.
  Not for fixing what it finds (/pulse-fix).
---

# Pulse Agent — Synthetic Student Journey Simulator

Run synthetic student profiles through Lumina's adaptive machinery without a
real student or browser. Modes 1–3 exercise the PRODUCTION engine (since
2026-10-12 the learner model selects); mode 4 is the offline lab that judges
learner-model changes.

1. **Engine mode** (v1, default) — scripted archetype scores drive PulseEngine
   directly. Validates IRT-derived mastery and that every item comes from the
   learner model.
2. **Truth mode** (`--truth`) — scores come from a LatentStudent ground-truth
   model (2PL response vs item β on the engine's 0-10 θ scale, with learning,
   forgetting, and per-skill weakness clusters). Validates the ESTIMATOR:
   does θ_est converge to θ_true, does the engine rank weak skills weak?
3. **Loop mode** (`--loop`) — the full student-data-loop, day by virtual day:
   morning plan (PlanningService + session-targets selector) → student does
   the work through the REAL submission fan-out
   (`CompetencyService.update_competency_from_problem` → save_attempt →
   apply_attempt_rollup → apply_competency_eval → CalibrationEngine →
   MasteryLifecycleEngine) plus a daily pulse session → evening canonical
   profile serve + tomorrow's targets. Verifies the L2 rebuild contract
   (replay(L0) == incremental rollups) via the production backfill logic on
   every run. Loop mode always uses the truth model.

   Loop days are **multi-subject** when several `--subject` flags are given
   (real sessions span 3-4 subjects): ONE journey per profile, the planner
   splits each day's minute budget across subjects by remaining work, the
   student does the whole served plan, and the daily pulse beat rotates
   through the subjects. Retest scheduling runs on the virtual clock (the
   planner and MasteryLifecycleEngine follow `store.virtual_now`), so review
   blocks surface on the days retests fall due.

4. **Lab mode** (`lab ...`) — the learner-model lab
   (`backend/scripts/learner_model_lab/`), offline, no Firestore except an
   explicit `pull`. Compares `today` (the production θ update, called
   unchanged, + Fisher × σ² selection) with the **two-layer model**: IRT θ per
   subskill measures; the Jev prerequisite graph decides. Interface: each
   subskill sends the graph a likelihood ratio around its mastery threshold
   (τ = median item β + 1.4); the graph's P(mastered) reshapes θ's prior when
   a child first meets a subskill. Selection teaches the **frontier**
   (P(unmastered and every R prerequisite mastered)) with an unlock bonus
   (best next step only) and a one-step look-ahead. Three checks, each on the
   data that can answer it:

   | Check | Command | Data | 10-11 result (math) |
   |---|---|---|---|
   | Predicts answers at least as well as today | `replay real` | a real student's first-try results | loss 0.047 vs 0.065, AUC 0.956 vs 0.939 |
   | The graph predicts a NEW subskill better | `replay real` (first-encounter column) | same | loss 0.35 vs 0.50 |
   | The selector teaches more | `run run` | simulated children with prerequisite dependence | 1.5–2× subskills mastered, prereq-missing 0 vs ~0.3, success 0.5–0.7 vs 0.7–0.8 |

**All modes are in-memory.** The only Firestore reads are the one-time
curriculum bootstrap and (optionally) a `--seed-from` snapshot; loop mode has
NO Firestore variant — a loop day fans each attempt into ~6 doc writes.
Cosmos is deprecated: the loop runs `CompetencyService` with `cosmos_db=None`
(Firestore-only fan-out, warn-and-continue).

**Arguments:** `/pulse-agent [command] [options]`
- `/pulse-agent` or `/pulse-agent list` — list available profiles
- `/pulse-agent gifted` — engine mode, single profile (in-memory, ~3s)
- `/pulse-agent all` — engine mode, all profiles + comparison report
- `/pulse-agent gifted --truth` — truth-model run with estimator-validity assertions
- `/pulse-agent all --truth` — truth-model sweep (12 archetypes)
- `/pulse-agent steady --loop` — full-loop journey, 20 virtual days
- `/pulse-agent steady --loop --days 40` — longer journey
- `/pulse-agent steady --loop --days 30 --subject Mathematics --subject Science
  --subject "Language Arts" --subject "Social Studies"` — multi-subject days
  (one journey, plan split across subjects; report tag `MULTI_G<grade>`)
- `/pulse-agent steady --loop --seed-from 1004` — mid-year persona: ONE
  batched read of a real student's docs seeds the store, then the journey
  diverges privately (zero writes back; parity oracle auto-skips)
- `/pulse-agent gifted --loop --days 40 --promote` — cross-grade journey:
  when a day surfaces no new work at all (grade frontier exhausted), bump
  `grade_level` to the next grade and lazily fetch that grade's graph +
  curriculum (one Firestore read per promotion). Prototype for
  `backend/docs/ISSUE_CROSS_GRADE_PROGRESSION.md`; adds the
  `promotion_continuity` assertion + a Grade Promotions report section.
  grade_level is student-global, so with multiple `--subject` flags
  promotion fires only when EVERY subject is exhausted.
- `/pulse-agent gifted --loop --days 40 --promote-engine` — verify the
  PRODUCTION promotion branch instead: pre-loads two grades ahead, sets
  `settings.AUTO_GRADE_PROMOTION=True`, and PlanningService itself detects
  the exhausted frontier (no frontier/in_progress subskills) and writes
  `students/{id}.subject_grade_overrides`; the harness only mirrors the
  engine's decision into its active graph ids. Mutually exclusive with
  `--promote`. Without the flag the planner still records
  `promotion_ready` + a plan warning (never silent).
- `--sessions N` (engine/truth), `--subject Science`, `--grade 1`, `--seed N`,
  `--graph`, `--firestore` (engine mode only, production validation)
- `/pulse-agent lab replay MATHEMATICS` — real-data replay + shuffle controls
- `/pulse-agent lab sim MATHEMATICS` — Level A simulated attempts, replayed
- `/pulse-agent lab frontier MATHEMATICS` — selection lab, every policy
- `/pulse-agent lab check` — Gibbs sampler vs exact enumeration (run after
  any change to the graph model's inference)

## Production selector (user ruling 2026-10-12)

The learner model is the only selection brain: `PulseEngine.assemble_session`
and `select_session_targets` both call `LearnerStateService.select`. Leapfrog,
cold-start DAG probes and Fisher x sigma^2 over the published graph are gone;
`selection_sweep.py` (which patched `select_best_mode`) was deleted. Engine,
truth and loop modes wire a `LearnerStateService` on the published learner
graph (read-only) with in-memory state, and answer each item with the registry
mode nearest its `target_beta` (`full_loop._nearest_registry_mode`, mirroring
the frontend pin). Assertions that replaced the leapfrog ones:
`items_from_learner_model` / `pulse_from_learner_model` (every item has a
kind), `discovery` / `discovery_active` (capable students get confirm items on
never-practised subskills), `miss_streak` (truth) / `pulse_miss_streak` (loop),
<= 3 misses (score < 5) in a row.

10-12 switch, 10-day loops vs the old engine (seed 42, K math): steady 23
distinct targets vs 7, 4 at gate 4 vs 0; gifted 77 subskills seen vs 56, 10
discovery checks, but 11 at gate 4 vs 19 (breadth over depth) and 100% pulse
success; struggling loop 82% pulse success. Truth mode: struggling 70% success
vs 19%, longest miss run 4 vs 6 (`miss_streak` FAILS at 3: nothing easier than
K in the graph, roadmap P5.5). Reports: `backend/reports/sunset-after/`.

## Lab mode (learner-model lab)

Run from `backend/`; every command uses all CPU cores. Outputs go to
`backend/reports/learner-model-lab/` (gitignored).

```bash
venv/Scripts/python -m scripts.learner_model_lab.run check                                   # exact vs Gibbs, must PASS
venv/Scripts/python -m scripts.learner_model_lab.replay pull --student 1004                  # read-only reviews refresh
venv/Scripts/python -m scripts.learner_model_lab.replay real --subject MATHEMATICS --perms 2  # ~10 min
venv/Scripts/python -m scripts.learner_model_lab.replay sim  --subject MATHEMATICS --seeds 3 --reviews 150
venv/Scripts/python -m scripts.learner_model_lab.run run --subject MATHEMATICS --items 60 --seeds 4 [--learning ready|flat|zone|success]
```

**Data rules (each cost a wrong conclusion once):**
- **Score first-try results, never the attempt `score`.** Retry-until-correct
  primitives submit 10/10 after a retry, so 97–99% of attempts read perfect.
  First try lives in each review's per-challenge results
  (`student_work.*[{attempts, correct}]`, the profile's "First-try" stat);
  `evidence.py` reads it the way `problems._find_challenge_results` does.
  Production IRT is still fed the final score — `today_first` in the replay
  measures what feeding first-try would gain.
- **Real data judges measurement; simulation judges decisions.** A
  near-ceiling student (1004: ~1% first-try misses) cannot test gap-finding
  or teaching; it can test calibration and first-encounter prediction.
- **Shuffle controls:** `shuffle-subskill` (structure destroyed) must score
  clearly worse than real order, or skill identity carries no signal;
  `shuffle-time` tests the learning-over-time component.
- **Vary the truth model's learning rule** (`--learning`) before trusting a
  selection gain: the default (`ready`) gates learning on prerequisites, which
  is the selector's own assumption.
- **Level A attempts** (`simsource.py`) use templates harvested from real
  reviews (challenges per review, whether the primitive ever recorded a
  retry). A primitive that never shows a retry is simulated as one-shot —
  whether it CAN record a miss is unknown until the real component is driven
  (base-ten-blocks: 871 reviews, zero retries).

**Model pitfalls already fixed — re-check after changing the model:**
- Untouched subskills pin general ability φ at its prior unless barren
  subskills (no evidence at or below them) are left out of φ's update; they
  sum out exactly and are redrawn after.
- The unlock bonus counts only the best next step; summing lets a hub (count
  to 10, ~40 dependents) win every pick.
- Without a slip term a 9/10 counts against mastery; continuous 0–10 truth
  scores cap near 9 and stop mastery from ever being confirmed — the lab
  scores first-try right/wrong per challenge.
- The truth model's prerequisite penalty follows only step ≥ 0.8 edges; all
  edges crushed unrelated skills.

**Personas** (`truth.py`): literacy `no_blend` (B), `no_letter_sound` (C),
`no_decode` (D) and math `no_place_value`, `no_facts`, `no_subtract`, plus
`struggling`, `steady`, `gifted`. Gaps are set by regex on subskill labels.

**Known open items (WORKSTREAMS 7.4):** success rate below today's;
literacy gap targeting; the struggling child gains nothing (no easier
subskills below K in the graph); diagnosis of untouched subskills for gifted
children.

## Required Reading

Before modifying the framework, read:
- `backend/docs/PULSE_AGENT_TESTING.md` — v1 documentation
- `backend/docs/PRD_PULSE_AGENT_V2.md` — v2 design (truth model + full loop)
- `backend/tests/pulse_agent/truth_model.py` — LatentStudent + archetype params
- `backend/tests/pulse_agent/full_loop.py` — day-loop runner + loop assertions

## When to Use This Skill

- Testing Pulse engine changes (engine mode)
- Validating estimator quality after IRT/calibration changes (truth mode)
- Testing ANY stage of the student data loop end-to-end: submission fan-out,
  rollups/profile serves, session-targets selector, daily session plan (loop mode)
- Simulating how a live student's week/month will play out before shipping a
  planner/selector change (loop mode, optionally seeded from a real student)
- Smoke-testing before deploy; comparing behavior before vs after a change

**DO NOT use this skill for:**
- Frontend/UI rendering (use `/eval-test`)
- Individual primitives or generators (use `/eval-test`, `/oracle-test`)

## Workflow

### Step 1: Parse Arguments

| User says | CLI command |
|-----------|------------|
| `/pulse-agent gifted` | `--profile gifted --in-memory --output ./reports` |
| `/pulse-agent all --truth` | `--all --truth --in-memory --output ./reports` |
| `/pulse-agent steady --loop` | `--profile steady --loop --output ./reports` (loop implies in-memory) |
| `/pulse-agent steady --loop --days 40 --grade 1` | `--profile steady --loop --days 40 --grade 1 --output ./reports` |
| `/pulse-agent steady --loop --seed-from 1004` | `--profile steady --loop --seed-from 1004 --output ./reports` |

Defaults: `--in-memory`, `--output ./reports` (→ `reports/<grade>/`), seed 42,
subject Mathematics, grade K, loop days 20.

### Step 2: Check Prerequisites

```bash
cd backend && python -c "from app.services.pulse_engine import PulseEngine; print('OK')"
cd backend && python -c "from app.core.config import settings; print(settings.FIREBASE_PROJECT_ID)"
```
(Firestore credentials are needed even in-memory for the one-time graph fetch.)

### Step 3: Run

```bash
cd backend && python -m tests.pulse_agent.run_scenarios --profile <name> \
    --subject <Subject> --grade <N> --in-memory --seed 42 --output ./reports \
    [--truth] [--loop --days N] [--seed-from ID] [--sessions N] [--graph] \
    [--promote | --promote-engine]
```

Loop mode logs one line per virtual day:
```
Day 3/15: plan=8 subskills, did 24 lesson + 6 pulse items, avg=7.7, mastered=24, pulse learn/confirm=4/2
```

### Step 4: Present Results

**Engine/truth mode:** assertion table, session timeline, notable events
(confirm/discovery items, θ trends). Truth runs add the Truth vs Estimate section (θ_true
vs θ_est per skill, MAE/bias, convergence-over-sessions).

**Loop mode:** every run also emits a self-contained interactive HTML dashboard
(`reports/<grade>/loop_report_<name>_<subject>.html` — score trend, gate
advances per day, truth-vs-estimate small multiples, final-ability dumbbell,
gate distribution; rendered from `loop_report_template.html` by
`html_report.py`). Open it in a browser or publish it as an Artifact when
presenting results. The markdown report
(`reports/<grade>/loop_report_<name>_<subject>.md`) has:
- Assertions (parity, serve integrity, plan coverage, responsiveness,
  mastered-leaves-targets, plan-not-stale, pulse-from-learner-model,
  discovery-active, pulse-miss-streak,
  reviews-surfaced, weakness routing)
- Curriculum Progression (per subject: total subskills, mastered day 1 →
  final, % mastered, still-active — "how far did the student get")
- Day Timeline (planned → done, per-subject item split, gate advances,
  pulse learn/confirm, cumulative mastered, learn targets per day)
- Pulse Audit (first/last day: each item's subskill, kind, band, target β,
  model P(right), score — read this to judge what the learner model served)
- Recommendation Audit (first/mid/last day: every selector pick with its
  kind/verb/P(correct)/reason — read this to judge whether the selection
  brain behaves sensibly)
- Truth vs Estimate (final)
- L2 Rebuild Contract detail

### Step 5: Investigate Failures

- `rollup_replay_parity` FAIL → the incremental L2 write path diverged from
  the backfill replay. Diff the mismatch lines; suspect apply_attempt_rollup
  edits or a new attempt writer bypassing save_attempt.
- `serve_integrity` FAIL → an attempt writer isn't reaching profile/summary,
  or the analytics cache is serving stale data.
- `truth_convergence` FAIL → estimator is confidently wrong (truth outside
  2.5σ after compression correction). Check CalibrationEngine changes.
- `mastered_leaves_targets` FAIL → lifecycle gate and selector P(correct)
  disagree. On SEEDED runs this can be a real-data finding (e.g. legacy gate
  inflation) — check the subskill's ability vs lifecycle docs before blaming
  the selector.
- `plan_not_stale` FAIL → a mastered subskill was re-planned as "new". This
  is the regression gate for subject-string filtering: lifecycle docs carry
  non-canonical subjects ("math", "MATHEMATICS_GK", "general"), so any
  `get_all_mastery_lifecycles(sid, subject=...)` string filter drops them
  and the planner/selector re-serves mastered work. Classify by subskill-id
  membership (or fetch unfiltered + key by id); also check `_norm_subject` /
  `rollup_subject_key` strip `_GK` as well as `_G<digits>`.
- `discovery_active` FAIL → a capable student was never checked on a
  never-practised subskill. Check `LearnerStateService.select`'s confirm pool
  (P(mastered) >= 0.8, gate < 4, within the grade of record) and its
  unseen/seen interleave.
- `pulse_miss_streak` FAIL → the selector served a long run of items the child
  missed. Check teach gain (P(right) x value) and whether easier forms exist
  below the child in the learner graph.
- `reviews_surfaced` FAIL → retests fell due (virtual clock) but no
  review/retest blocks appeared in daily plans. Check `get_mastery_retests_due`
  wiring and that plan blocks label them `review`/`retest`.
- `weakness_routed` FAIL → selector never surfaced truly-weak skills; check
  KG p_correct emission and Fisher-information ranking.
- `promotion_continuity` FAIL → a grade promotion happened but planning
  never resumed on the new grade. Harness `--promote`: check the grade
  loader fetched the next grade's graph + published curriculum and caches
  were invalidated. `--promote-engine`: check PlanningService's detection
  (`_allocate_subject_minutes` — exhausted = mastery>0 AND zero
  frontier/in_progress subskills, NEVER done==total: graphs carry
  permanently-locked orphan nodes) and that `subject_grade_overrides`
  reached the selector via `_subject_grade`.

### Step 6: Save Results Summary

Offer to save a dated summary: `backend/reports/<Grade>/pulse-agent-<YYYY-MM-DD>.md`.

## Available Profiles

| Profile | Archetype | Truth params (0-10 θ scale) |
|---------|-----------|------------------------------|
| `gifted` | High ability | θ₀ 6.5, fast learning, low decay |
| `steady` | Solid middle | θ₀ 4.3, steady learning |
| `struggling` | Low ability | θ₀ 1.8, slow gains |
| `fraction_weakness` | Selective weakness | θ₀ 5.8, weak cluster −3.2 (keyword match + md5 structural pick, works on any subject/grade) |
| `cold_start` | No history | θ₀ 3.5, first session ever |
| `forgetful` | Fast learn, fast forget | decay 0.20/day, retention 0.35 |
| `accelerating` | Fast improver | θ₀ 2.5, learning rate 0.40 |
| `shallow_roots` | Spiky knowledge | per-skill jitter 2.2 |
| `regressing` | Declining | session drift −0.28 |
| `volatile` | Noisy responder | response noise 0.30 |
| `plateau` | Ramps then stalls | growth cap 5.6 |
| `bursty` | 7-day gaps | decay 0.06, profile gap 7d |

All profiles are subject-agnostic; subject/grade set at runtime.

## Red Flags

| Signal | Likely Issue |
|--------|-------------|
| Theta never changes | CalibrationEngine not writing abilities |
| Gates stuck despite high θ, low σ | `derive_gate_from_irt()` thresholds |
| All items same band every session | Transfer prior broken in `_assemble_unified()` |
| Confirm items keep repeating one subskill | gate-4 exclusion or lifecycle subskill-id resolution in `select` |
| `plan=0 subskills` every loop day | CurriculumService not initialized, published curriculum not loaded at bootstrap, or velocity allocator sees 0 weeks remaining (school-year config) |
| Same subskills planned as "new" day after day | Subject-string filter on lifecycle reads (see `plan_not_stale` above) — mastered docs invisible to planner/selector |
| Profile attempts frozen across loop days | Analytics TTL cache not cleared per virtual day |
| Session errors (in-memory) | Missing method on InMemoryFirestoreService — mirror the FirestoreService method and add it |
| Truth MAE huge but coverage passes | Expected: prior anchoring at θ=3.0 with sparse per-skill items; coverage (2.5σ) is the honest test |

## Known Limitations (loop mode)

- Lesson items use a fixed primitive identity (`ten-frame`) with β from item
  calibration priors — the fan-out is production-real, item diversity is not.
- Pulse results do not write L0 attempts (matches production: only
  `update_competency_from_problem` calls save_attempt).
- Curriculum-progression denominators come from the published hierarchy,
  which can exceed the graph's reachable subskills (e.g. GK math 166 vs 138
  graph nodes) — 100% mastery of the graph reads as ~85% of the hierarchy.

(Retest scheduling formerly lagged virtual days — fixed 2026-07-08: the
planner and MasteryLifecycleEngine follow `store.virtual_now` when set.)

## Key Files

| File | Purpose |
|------|---------|
| `backend/tests/pulse_agent/agent.py` | v1 session runner (engine/truth modes) |
| `backend/tests/pulse_agent/truth_model.py` | LatentStudent + TRUTH_PARAMS + TruthModelStrategy |
| `backend/tests/pulse_agent/full_loop.py` | FullLoopRunner (day loop), loop assertions, loop report, seed_from_student |
| `backend/tests/pulse_agent/in_memory_firestore.py` | In-memory FirestoreService (L0/L1/L2 + planning + raw-client shims) |
| `backend/tests/pulse_agent/profiles.py` | Synthetic student definitions |
| `backend/tests/pulse_agent/scenarios.py` | v1 scripted score strategies |
| `backend/tests/pulse_agent/journey_recorder.py` | Session snapshots (+ truth snapshots) |
| `backend/tests/pulse_agent/assertions.py` | Engine + truth assertion suites |
| `backend/tests/pulse_agent/reports.py` | Markdown reports (+ Truth vs Estimate) |
| `backend/tests/pulse_agent/html_report.py` | Loop HTML dashboard (renders `loop_report_template.html`) |
| `backend/tests/pulse_agent/run_scenarios.py` | CLI entry point |
| `backend/scripts/backfill_daily_rollups.py` | `aggregate_student` = the L2 parity oracle |
| `backend/app/services/pulse_engine.py` | Engine under test |
| `backend/scripts/learner_model_lab/graph.py` | Subskill graph from Jev scores (`/curriculum-graph jev-*`) |
| `backend/scripts/learner_model_lab/layered.py` | Two-layer model: IRT per subskill + graph, interface, frontier selector |
| `backend/scripts/learner_model_lab/bayes.py` | Graph layer: Gibbs over mastery + φ, frontier, unlock value |
| `backend/scripts/learner_model_lab/baseline.py` | `today`: production θ update + Fisher × σ² |
| `backend/scripts/learner_model_lab/truth.py` | Simulated children with prerequisite dependence + personas |
| `backend/scripts/learner_model_lab/simsource.py` · `evidence.py` · `replay.py` | Level A attempts, shared first-try reader, replay |
| `backend/scripts/learner_model_lab/run.py` | Frontier lab, `check` |
