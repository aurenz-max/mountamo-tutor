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
   - the IRT gate derivation that `process_eval_result` writes and the model then overwrites. Once deleted,
     `process_eval_result` should stop writing gates at all; keep only what something still reads, e.g.
     `lesson_eval_count` and `global_pass_rate`, if a reader exists.
2. `GET /{student_id}/retests/due` and its frontend caller.
3. `BlockType.RETEST` / `'retest'`: the planner fill branch, `lesson_plan.py`, and `sessionPlanAPI.ts`
   `BlockType` / `SkillStatus`.
4. `SessionReason.MASTERY_RETEST` and the PlannerDashboard retest UI.
5. `get_weekly_plan` / `get_forecast` pacing that projects 3d/7d/14d retests: re-base it on the model, or delete it
   with its endpoints if nothing live reads it.
6. `retests_due_morning` in `backend/tests/pulse_agent`.

Firestore docs keep the old fields (`next_retest_eligible`, retest counts). Stop writing them; do not migrate them.
Any reader left must tolerate their absence.

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
