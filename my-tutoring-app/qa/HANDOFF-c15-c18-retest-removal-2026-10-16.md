# Handoff: C15 + C18 — delete the retest code, Pulse reports the model's gate — 2026-10-16

Executor: `/pulse-fix`. Queue: `my-tutoring-app/qa/pulse/ROADMAP.md` rows C15 and C18 (authority over this file).
Branch `ship/2026-08-10-judged-loop`. Another session works in the same tree on primitives; commit by path
(`git commit -F <msg> -- <files>`), never `git add -A`.

## Where things stand

- **Shipped:** `b40aa75a`: the learner model sets mastery gates and planners serve no retests (C13).
  `f142e7f0`: the C14 backfill `backend/scripts/backfill_model_gates.py`, applied to 1004 and then to every
  student by the user (10-16).
- **How gates are written now:** every answer reaches `LearnerStateService.observe`
  (`backend/app/services/learner_model/service.py`). Its `_sync_lifecycle` → `_gate_updates` →
  `MasteryLifecycleEngine.apply_model_states` writes `current_gate`, `retention_state` and `stability`, and
  appends a `gate_history` entry with `source: "learner_model"`. Readers (planner, Pulse, My Progress, parent report,
  generation context) read the lifecycle doc.
- **What still runs beside it:** `MasteryLifecycleEngine.process_eval_result` still runs first on both answer paths:
  - Pulse: `pulse_engine.py:466`
  - lessons: `competency.py:502`

  It derives an IRT gate (`derive_gate_from_irt`), schedules retests (`next_retest_eligible`, `RETEST_INTERVALS`)
  and writes the doc. The model's sync then overwrites it a moment later; in production that sync runs in the
  background (`LearnerStateService.submit` → `schedule`).

## C18 — Pulse shows the old gate (do first; small, visible to children)

`pulse_engine.submit_item` builds `gate_update` from `process_eval_result`'s IRT gate (`:490-496`). Two screens
show the IRT verdict instead of the model's:

- The results screen "Skills advanced" reads `get_session_summary` `skills_advanced`, which is built from the
  per-item `gate_update` (`pulse_engine.py:684-700`). The UI is `PulseSession.tsx:649`
  `SkillsAdvancedSection`, and `:941 gateAdvances`.
- The per-item gate readiness card (`FrontierContextCard.tsx:149` `GateReadiness`) reads `gate_progress`, which
  comes from the IRT calibration result (`pulse_engine.py:614`).

**Fix:**
- **Summary:** for each served subskill, compare the gate in force before the session with the current lifecycle
  gate. "Before" is the latest `gate_history` entry earlier than the session start, not the max: model gates can
  fall. This is the C13 close-out rule; copy it from `firestore_analytics.py` `get_subskill_progress_delta`
  (the "gate_before, before_ts" block). The summary is read after the session, so the background sync has landed;
  if it can race, await `learner_state.drain()` or read after it.
- **Per-item card:** take readiness from the model (P(right) and P(mastered) on the subskill; `PulseItemSpec`
  already carries `p_right` and `p_mastered`), or drop the card's gate line. Ask the user if the choice is unclear.
- **Verify:** add a backend test for the summary diff (a gate that falls shows as a fall, not an advance), then
  drive a Pulse session on 1004 in the browser and check that "Skills advanced" matches the lifecycle docs.

## C15 — delete the retest machinery C13 left dead

From the ROADMAP row. Contract-first: grep every reader before deleting anything. A reader map is appended below
when available; re-check it, since the tree moves.

1. Lifecycle retest scheduling:
   - `next_retest_eligible`, `RETEST_INTERVALS`
   - the retest branches of `_handle_practice_eval`
   - NOT the IRT gate derivation as a whole. It is the only gate writer for subskills off the learner graph;
     see "Reader map" below.
2. `GET /{student_id}/retests/due` and its frontend caller.
3. `BlockType.RETEST` / `'retest'`: the planner fill branch, `lesson_plan.py`, and `sessionPlanAPI.ts`
   `BlockType` / `SkillStatus`.
4. `SessionReason.MASTERY_RETEST` and the PlannerDashboard retest UI.
5. `get_weekly_plan` / `get_forecast` pacing that projects 3d/7d/14d retests: re-base it on the model, or delete it
   with its endpoints if nothing live reads it.
6. `retests_due_morning` in `backend/tests/pulse_agent`.

Firestore docs keep the old fields (`next_retest_eligible`, retest counts). Stop writing them; do not migrate them.
Any reader left must tolerate their absence.

## Reader map (search 10-16, read-only; re-check before deleting)

**Corrections to the list above. Read these first.**

- **The IRT gate is NOT dead for subskills off the learner graph.** `_sync_lifecycle` runs only when the subskill
  resolves onto a learner graph (`learner_model/service.py` `observe`, the `key is None` return) and
  `lifecycle_engine` is set. For off-graph subskills (44 of 1004's 154 lifecycle docs), and for subjects with no
  graph, `_handle_practice_eval` is the only thing that writes the gate, activation (`_activate_retention`),
  stability and mastered. Deleting it without a replacement freezes those subskills: no planner unlock, no gate
  counts in My Progress or the parent report.
  - Delete only the retest scheduling.
  - Keep the IRT gate as the off-graph fallback, or ask the user how off-graph subskills should be gated.
  - Keep `evidence_n`, `review_count`, `completion_pct` and the pass/fail counts; the same handler writes them.
- **A retest projection is live on a student screen.** `forecast_service.py:51-57` `RETEST_ECHO = 3.0` and
  `RIDER_SHARE` feed `ReviewLoad` (:185-196), which `ForecastTimeline.tsx:269` shows on `MyProgressPanel` as
  "≈N reviews/wk · X need their own block". To change it, edit these together:
  - `models/forecast.py:55-75`, where `review_load` is a required field
  - `forecastAPI.ts`
  - `ForecastTimeline.tsx`
  - `scripts/probe_forecast.py`
- **`get_weekly_plan` is live and projects no retests.** It is called by `get_daily_plan`,
  `daily_subject_weights` (daily-mix Pulse) and `_build_daily_session_plan`. Do not delete it. The 3d/7d/14d
  projection is in `get_monthly_plan` (`planning_service.py:443-454`), which only the dev PlannerDashboard reads.

**Safe to delete** (nothing live reads it; the readers are dev panels, tests, or the harness):

- **Lifecycle engine and model:**
  - retest field writes: engine `_activate_retention` :490-494 and `_handle_practice_eval` :610-619
  - `RETEST_INTERVALS`
  - the model fields `next_retest_eligible` and `retest_interval_days`, if the model ignores extra keys
  - dead methods: `_handle_lesson_eval` (no callers), `_check_probability_gate`, `planning_service._compute_days_overdue`
- **`GET /api/mastery/{id}/retests/due`** (`mastery.py:340-369`): no frontend caller. Its query is
  `firestore_service.get_mastery_retests_due` :2023, mirrored in `pulse_agent/in_memory_firestore.py:1081`.
- **`BlockType.RETEST`:**
  - backend: `lesson_plan.py:30` and the cost tables; `lesson_group_service.py` :170-187, :278-284, :317,
    :359-363, :455, :518-565, :658, :674
  - tests: `test_lesson_group_service.py` :49, :113-171
  - frontend union `sessionPlanAPI.ts:19-20`, which must go together with its entries in `DailyLessonPlan.tsx:42`,
    `SessionBreakScreen.tsx:43-50,177,190`, and `App.tsx:335`
  - an old stored 'retest' block for today fails validation, and the plan regenerates
  - `BlockType.PRACTICE` is unreachable too
- **`SessionReason.MASTERY_RETEST`:** `planning.py:34` and the `get_daily_plan` review branch
  (`planning_service.py:762-778`; `review_queue` is always `[]`); its tests `test_planning_service.py:241-295`.
  - PlannerDashboard `SessionRow.tsx:13,73-80` and `types.ts:36-44` are dev-only.
  - `GATE_LABELS` ('Retest 1/2' in `MasteryComponents.tsx:9`, `PulseSession.tsx:843`, `FrontierContextCard.tsx:46`)
    are gate names: rename them, do not delete.
- **Harness:**
  - `full_loop.py` :162, :317-333, :325, :681-684, :744-757
  - `run_scenarios.py:472-491,655`
  - `retest_ab.py`: delete it only after the post-deletion simulator check, or keep it for reading old reports
  - keep the `reviews_are_pulse_items` assertion (`full_loop.py:1567`) as a regression guard
- **`next_retest_eligible` readers:** `firestore_analytics.py:325,365` → `analytics.py:85` →
  `studentAnalyticsAPI.ts:84` → `CurriculumPanel.tsx:95` "Retest due" badge (dev AnalyticsDashboard, now
  stale). Remove them together.

**Out of scope:**
- `MasteryLifecycleEngine.get_forecast`, which is stability-based
- leapfrog retest analytics (`firestore_analytics.py:1623-1798`)
- misconception "certified retest" receipts, a different system
- `mastery.py:140-200` `_seed_subskill_to_gate`, the dev seed, already broken
- the stale docs: the PRDs, `PLANNING_ARCHITECTURE.md`, and `.claude/skills/pulse-agent/SKILL.md:302,343`.
  Update the skill lines.

## Gates (verbatim forms in CLAUDE.md "Commands")

- **Backend tests:** `cd backend && venv/Scripts/python -m pytest tests/ -q -p no:cacheprovider --ignore=tests/tutor_live --ignore=tests/pulse_agent --ignore=tests/test_dag_analysis.py`.
  Baseline at `f142e7f0`: 284 pass, 16 fail. The failures are legacy: `test_ai_recommendations_integration.py`
  and `test_assessment_feedback_integration.py`, the same on HEAD. `test_dag_analysis.py` imports a removed module.
- **Simulator:** must still show the C13 result after the deletions (new system keeps more for all six child
  types on fewer review items). Run the `backend/tests/pulse_agent` retest A/B (`retest_ab.py`) and the scorecard.
- **Frontend:** `npm run typecheck:lumina` = 0; `npm test` on the touched files.
- **Browser:** the C16 check (My Progress, Planner dashboard with no retest rows, lesson close-out, parent report,
  Pulse summary) on 1004 closes both items. If you cannot drive the browser, say so in the report:
  "needs a browser check".

## Close-out

Update the ROADMAP rows C15/C18 (and C16 if driven) and the phase 7 row of `WORKSTREAMS.md` in the same commit.
Still queued after these: C17 (gifted second promotion a day late), C12 (joint knowledge-and-recall fit).
