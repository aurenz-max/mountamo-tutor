# Pulse Agent — Synthetic Student Journey Simulator

Run synthetic student profiles through Lumina's adaptive machinery without a
real student or browser. Three modes, increasing scope:

1. **Engine mode** (v1, default) — scripted archetype scores drive PulseEngine
   directly. Validates IRT-derived mastery, unified item selection, leapfrog
   unlock propagation.
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
Day 3/15: plan=8 subskills, did 24 lesson + 6 pulse items, avg=7.7, mastered=24, leapfrogs=1
```

### Step 4: Present Results

**Engine/truth mode:** assertion table, session timeline, notable events
(leapfrogs, θ trends). Truth runs add the Truth vs Estimate section (θ_true
vs θ_est per skill, MAE/bias, convergence-over-sessions).

**Loop mode:** every run also emits a self-contained interactive HTML dashboard
(`reports/<grade>/loop_report_<name>_<subject>.html` — score trend, gate
advances per day, truth-vs-estimate small multiples, final-ability dumbbell,
gate distribution; rendered from `loop_report_template.html` by
`html_report.py`). Open it in a browser or publish it as an Artifact when
presenting results. The markdown report
(`reports/<grade>/loop_report_<name>_<subject>.md`) has:
- Assertions (parity, serve integrity, plan coverage, responsiveness,
  mastered-leaves-targets, plan-not-stale, leapfrogging-active,
  reviews-surfaced, weakness routing)
- Curriculum Progression (per subject: total subskills, mastered day 1 →
  final, % mastered, still-active — "how far did the student get")
- Day Timeline (planned → done, per-subject item split, gate advances,
  leapfrogs, cumulative mastered, learn targets per day)
- Leapfrog Audit (every graph jump: day, subject, frontier probe passed,
  ancestors inferred, score — "is leapfrogging occurring" is answered here)
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
- `leapfrogging_active` FAIL → a capable student never jumped ahead. Check
  frontier probe assembly (pulse band mix) and `_check_leapfrog` ancestor
  inference; also confirm the harness is reading `result.leapfrog`.
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
| Leapfrogs on low scores | Frontier pass threshold bug |
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
