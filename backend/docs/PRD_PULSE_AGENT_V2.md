# PRD — Pulse Agent v2: Full-Loop Synthetic Student Simulator

**Status:** SHIPPED Phases 1–3 (2026-07-08). Phase 4 (close-out delta +
generation-context block) remains open. v1 engine mode unchanged; `--truth`
and `--loop` (with `--days`, `--seed-from`) landed in
`tests/pulse_agent/{truth_model,full_loop}.py` + CLI. Verified: 12/12
archetypes pass truth mode; steady/gifted/fraction_weakness/struggling pass
all loop assertions over 15 days (rollup replay parity MATCH); seeded run
from student 1004 works and surfaced a real gate-4-vs-selector disagreement.
Cosmos optionality shipped in competency.py (warn-and-continue). Also fixed:
in-memory `apply_competency_eval` was missing — every v1 session had been
failing at the deferred flush. Current usage: `.claude/skills/pulse-agent/SKILL.md`.

## Problem

Pulse Agent v1 validates the PulseEngine in isolation: scripted archetype
scores → `PulseEngine.process_result` directly → L1 snapshots (θ, gates).
It cannot answer the questions that matter for a live student:

1. **Actual scores** — v1 scores are scripted per band (`scenarios.py`), so
   "does the engine's θ estimate converge to the student's true ability?" is
   unanswerable. There is no ground truth.
2. **Development** — v1 never writes L0 attempts, so daily rollups,
   profile/summary, XP-adjacent totals, and every analytics serve are empty.
   The sim exercises ~40% of the fan-out a real submission triggers.
3. **Planning** — the selector (`select_session_targets`), the daily plan
   (`PlanningService`), the canonical profile serve, and the close-out delta
   are never called. The loop is open: nothing the sim does changes what the
   sim is served next *through the production planning path*.

## Goal

A synthetic student that lives the same loop a real student lives, day by
day: **wake up → get the plan the platform would actually serve → do the
work with ability-derived (not scripted) scores → submissions run the real
fan-out → L0/L1/L2 all update → evening profile serve + next-day targets →
repeat.** Every stage of `.claude/skills/student-data-loop/SKILL.md` gets
exercised headlessly, in memory, in seconds.

## Non-goals

- Gemini content generation (manifests, primitives). The loop consumes
  evaluations at (subskill, primitive_type, eval_mode, score) granularity;
  the sim submits at that granularity. `/eval-test` owns content quality.
- Frontend rendering. The sim simulates the *producers and consumers of
  preBuiltObjectives*, not the tray UI.
- Replacing v1. Scripted strategies stay for deterministic engine
  regression (e.g. `volatile`, `plateau` stress the estimator on purpose).
- Behavior modeling (attendance, plan-adherence, frustration-quits).
  Ruled out 2026-07-08: effort goes into score fidelity (θ/β parameters)
  instead. The only behavioral knob is the existing
  `profile.session_gap_days` (already models bursty/absent students).
- Cosmos. The platform is Firestore-exclusive going forward (Cosmos is
  deprecated); the sim must never require or emulate Cosmos semantics —
  see Execution Model below.

## Execution model — in-memory is the ONLY loop mode

A full-loop day is write-heavy: per attempt, the real fan-out touches
attempt + rollup + profile/summary + competency + ability + lifecycle.
Against real Firestore that is absurd I/O and minutes-per-journey; in
memory it is milliseconds. Therefore:

- **The daily loop always runs against `InMemoryFirestoreService`.** No
  `--firestore` variant for `--loop` mode. v1's engine-only Firestore mode
  survives for rare production validation, unchanged.
- **Mid-year personas seed from Firestore ONCE, then run in memory.**
  `--seed-from <student_id>` snapshots a real student's docs (ability,
  mastery_lifecycle, competencies, daily_rollups, profile/summary,
  learning_paths) into the in-memory store at startup — one batched read,
  zero writes back. The journey then diverges privately. This gives
  "start from a real mid-year student" without a single production write.
- The only per-run Firestore reads are the existing one-time curriculum
  graph fetch and (optionally) the seed snapshot.

## Design

### A. Truth model — "actual scores" (Phase 1)

Replace band-scripted scoring with a latent student model:

```
LatentStudent:
  theta_true: Dict[skill_id, float]   # ground-truth ability per skill
  learning_rate: float                # theta_true grows with practice
  decay_rate: float                   # theta_true decays over gap days (per-skill stability)
  slip / guess: float                 # response noise
  cluster_offsets: Dict[keyword, float]  # e.g. fractions -0.8 (selective weakness)
```

Scoring an item: `P = 2PL(theta_true[skill] - item.target_beta)` (same model
the engine uses — item β is already on `PulseItemSpec.target_beta` and is
currently ignored by v1 strategies), sample correct/partial, map to 0–10.
Practice updates `theta_true` (learning); virtual-clock gaps decay it
(forgetting). Archetypes become parameterizations, not scripts:

| Archetype | θ₀ | learning | decay | notes |
|---|---|---|---|---|
| gifted | +1.5 | high | low | |
| struggling | −1.5 | low | low | |
| forgetful | +0.5 | high | high | |
| fraction_weakness | +1.0 | med | low | cluster offset −1.5 on weak keywords |
| shallow_roots | spiky per-skill θ | med | low | high θ on frontier skills, low on ancestors |

**New assertion class this unlocks:** estimator validity — `|θ_est − θ_true|
< ε` by session N; gate assignments consistent with true P(correct); the
selector prioritizes the skills where θ_true is actually low. v1 could only
assert "the engine reacted to the script"; v2 asserts "the engine *measured
the student correctly*."

### B. Production fan-out — "development" (Phase 2)

Stop calling `PulseEngine.process_result` as the only write path. Lesson
work submits through the real hub:
`CompetencyService.update_competency_from_problem` — the same call
`SubmissionService._handle_lumina_primitive` makes — so `save_attempt` →
`apply_attempt_rollup` fires and L0 attempts + `daily_rollups/{day}` +
`profile/summary` exist for the synthetic student. Pulse sessions keep using
`PulseEngine` (that IS its production path via `POST /pulse/.../result`).

Required build:
1. **InMemoryFirestoreService extensions** (`tests/pulse_agent/in_memory_firestore.py`):
   `save_attempt` + `apply_attempt_rollup` (dict-based Increment semantics),
   `apply_competency_eval` (ALSO fixes the existing latent bug: PulseEngine's
   deferred flush calls it at `pulse_engine.py:1553` and the in-memory class
   doesn't define it), `get_student_attempts`, `get_daily_rollups`,
   `get_profile_summary`, `get_competency`/`get_all_competencies`,
   `get_student_planning_fields`, `get/save_daily_session_plan_doc`,
   `get_published_curriculum`.
2. **Make `cosmos_db` optional in `competency.py` (deprecation-aligned).**
   Layering fact (verified 2026-07-08): the L1 engines are ALREADY
   Firestore-exclusive — `CalibrationEngine` and `MasteryLifecycleEngine`
   both take only `FirestoreService` (`calibration_engine.py:85`,
   `mastery_lifecycle_engine.py:171`). Cosmos debt lives solely in the
   wrapper the submit path enters through:
   `update_competency_from_problem` hard-gates on `cosmos_db`
   (`competency.py:231-233`) and dual-writes attempts/competencies
   (`competency.py:318-434`). Rather than a NullCosmos stub, Phase 2 makes
   the wrapper tolerate `cosmos_db=None` — early-return becomes
   warn-and-continue; dual-write blocks guarded by `if self.cosmos_db:`.
   Production behavior with Cosmos configured is unchanged; the sim (and
   eventually production) runs the same Firestore-only fan-out with no
   stub and no forked writer. This is the first concrete step of the
   Cosmos deprecation, exercised by the sim on every run.
3. **Virtual clock threading** — `save_attempt`/rollup day-keys must honor
   the sim's `virtual_now` (timestamps on attempts drive `daily_rollups`
   day buckets and streak-like counters).

**Invariant assertion this unlocks (free, high-value):** the L2 rebuild
contract — after every simulated day, replay L0 attempts (same logic as
`backfill_daily_rollups.py`) and assert equality with the incrementally
maintained rollups + profile/summary. The sim becomes a standing test of
the loop's core trust contract.

### C. The day loop — "planning" (Phase 3)

`FullLoopRunner` (new, beside `PulseAgentRunner`) drives virtual days:

```
for day in range(days):
    # 1. SERVE — what would the platform show this student today?
    plan    = await planning.get_daily_session_plan(sid, grade=...)      # daily plan fill mode
    targets = await analytics.select_session_targets(sid, subject, grade) # Recommended Lesson fill mode

    # 2. DO — the student does the plan; lesson blocks submit through the REAL fan-out
    for objective in plan.objectives:       # objectives = preBuiltObjectives shape
        for item in synthesize_items(objective):     # β from item calibration at assigned eval mode
            score = latent_student.answer(item)
            await competency_service.update_competency_from_problem(...)  # L0+L1+L2 fan-out

    # 3. PULSE — optional pulse session via PulseEngine (v1 path, unchanged)

    # 4. SNAPSHOT — evening read-side audit
    profile  = await analytics.get_student_profile(sid)        # canonical one-call serve
    tomorrow = await analytics.select_session_targets(...)     # did today change tomorrow?
    recorder.snapshot_day(profile, plan, targets, tomorrow, theta_true_vs_est, rollup_parity)

    latent_student.sleep(gap_days)          # forgetting
```

Key properties:
- The sim consumes planner output in the `preBuiltObjectives` shape — it
  simulates the Lesson Entry Contract's fill modes (daily plan +
  Recommended Lesson) without a launch surface, honoring "new selection
  intelligence ships as a producer of preBuiltObjectives".
- `select_session_targets` / `PlanningService` are constructed headlessly:
  `FirestoreAnalyticsService(in_memory_fs, curriculum_service, learning_paths)`
  and `PlanningService(in_memory_fs, curriculum_service, learning_paths,
  analytics)` — no Cosmos, no BigQuery, no HTTP (verified against
  `dependencies.py` wiring).
- No behavior modeling: the student simply does the plan. Realism comes
  from the truth model (per-skill θ, learning, decay, slip/guess, cluster
  offsets) plus `session_gap_days`; "how a live student will work" is
  answered by score dynamics, not simulated moods.

**Planning assertions this unlocks:**
- Weakness routing: `fraction_weakness` → selector surfaces the weak
  cluster as learn-targets within N days.
- Plan responsiveness: after a mastered gate, that subskill leaves the
  plan; after a bombed day, it returns.
- Grade of record honored: planning fields grade drives which curriculum
  the plan draws from (guards the `'1'`-beats-`'Kindergarten'` regression).
- Serve integrity: `profile.totals.attempts` == L0 count; `skill_state`
  gate counts == lifecycle docs.

### D. Close-out + generation-context (Phase 4, optional)

- **Close-out:** after each simulated lesson, call
  `get_subskill_progress_delta` (session-progress) and assert the
  before/after P(correct)/gate deltas match the recorder's own observations
  (validates `theta_history`/`gate_history` server-side derivation).
- **Generation-context:** call the STUDENT PROFILE block builder for
  curriculum-launched objectives only (known subskill_id skips the Gemini
  embedding matcher), assert the block reflects current θ/gates. Needs
  `get_competency` in memory (Phase 2) + Cosmos stub.
- **Report additions:** day-by-day table (plan → done → profile delta →
  tomorrow's targets), θ_true vs θ_est convergence chart, recommendation
  audit, rollup-parity ledger.

## Phasing (each phase runs + asserts before the next starts)

| Phase | Delivers | New surface exercised |
|---|---|---|
| 1 | LatentStudent truth model + convergence assertions | actual scores (2PL vs β), development as emergent θ growth |
| 2 | In-memory L0/L2 + real fan-out + Cosmos stub + rollup-parity oracle | save_attempt, apply_attempt_rollup, apply_competency_eval, profile/summary |
| 3 | FullLoopRunner day loop + `--seed-from` mid-year snapshot + planning assertions + reports | select_session_targets, get_daily_session_plan, get_student_profile |
| 4 | Close-out delta + generation-context block + convergence charts | session-progress, STUDENT PROFILE block |

## Skill surface (evolves `/pulse-agent`, no new skill)

```
/pulse-agent gifted --loop              # full-loop journey, 30 virtual days, in-memory
/pulse-agent gifted --loop --days 60
/pulse-agent fraction_weakness --loop --subject Mathematics --grade 1
/pulse-agent all --loop                 # archetype comparison across the full loop
/pulse-agent gifted                     # v1 engine-only mode, unchanged
```

`--loop` reports add: Day Timeline (plan/done/profile/tomorrow), Truth vs
Estimate, Rollup Parity, Recommendation Audit. Assertions split into
`engine` (v1 set) and `loop` (Phases 1–4 sets).

## Risks / open questions

- `update_competency_from_problem` is heavier than the pulse path (attempt
  history reads, legacy competency blend). In-memory keeps it fast. Cosmos
  coupling is resolved by the Phase-2 optionality change (see B.2) —
  RESOLVED as a design question 2026-07-08.
- Item synthesis for lesson blocks: β source is item calibration docs at
  the assigned eval mode (KG hardest-assigned-mode convention). Where a
  calibration doc doesn't exist in-memory, seed from curriculum defaults —
  must match what production would do for a fresh item.
- Virtual-clock: `save_attempt` stamps timestamps internally today; needs a
  `now_override` or timestamp param threaded like `PulseEngine` already does.
- Sequential eval flushes invariant (same subskill repeats in a session →
  concurrent RMW loses increments) applies to the sim's submission loop too:
  keep per-student submissions sequential.
