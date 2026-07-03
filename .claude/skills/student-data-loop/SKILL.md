# Student Data Loop — How a Submission Becomes the Profile That Picks the Next Problem

The canonical map of Lumina's backend core loop: problem submission → L0 events
(attempts + reviews) → L1 skill state (IRT ability + mastery lifecycle) → L2
read model (daily rollups + profile summary) → one canonical profile serve →
the planning/generation context that shapes the next problem. Read this before
touching ANY of: `students/{id}/attempts|reviews|competencies|ability|
mastery_lifecycle|daily_rollups|profile`, the analytics endpoints, or the
submission fan-out. Outcome: you extend the loop without forking a writer,
breaking a rebuild contract, or reintroducing a retired inconsistency.

**Visual companion:** the interactive data-loop artifact walks the same pipeline
with real doc schemas and per-layer color coding —
https://claude.ai/code/artifact/2b6b4dbf-b8e0-496a-90f5-58bb8fadd754
(cyan = L0 events, violet = IRT, green = gates, amber = L2, rose = retiring).

## When to Use This Skill

- Adding/changing anything that writes attempts, reviews, competencies, ability,
  lifecycle, rollups, or the profile doc
- Adding a student-facing analytics endpoint or metric
- Debugging "missing" attempts/lessons/mastery in any dashboard
- Wiring a new UI surface to student progress data

## The Architecture in One Paragraph

Three layers, strictly ordered. **L0 events** are append-only ground truth
(attempts + reviews) and are never aggregated at read time except for history
views. **L1 skill state** is the pedagogical interpretation: IRT θ per skill
(`ability`) and the 4-gate mastery lifecycle per subskill (`mastery_lifecycle`).
**L2 read model** is presentation-ready counters (`daily_rollups` per day,
`profile/summary` lifetime) maintained incrementally on every attempt write and
**rebuildable from L0 by replay** — that replay property is the contract that
makes L2 trustworthy. The profile endpoint composes all three plus Cosmos
engagement (XP/level/streak) into one call, and the same L1 state feeds IRT
item selection for the next problem. The loop is closed.

## The Loop, Stage by Stage

### 1. Submission → shared attempt_id
`backend/app/services/submission_service.py` — each handler (Lumina primitive,
standard, drawing fallback) generates ONE `attempt_id = str(uuid.uuid4())` and
passes it to BOTH the attempt save (via CompetencyService) and the review save.
Attempt ↔ review join is by `attempt_id`; the ±30s timestamp-window join in
`evaluations.py` exists only as a fallback for pre-2026-07 legacy rows. Never
generate a second id or drop the parameter.

### 2. L0 write + fan-out
`CompetencyService.update_competency_from_problem`
(`backend/app/services/competency.py`) is the fan-out hub:
- attempt → Cosmos + `FirestoreService.save_attempt` (which ALSO increments L2,
  see stage 4)
- competency → `FirestoreService.apply_competency_eval` (see invariants)
- IRT → `CalibrationEngine.process_submission` (θ per student-skill, β per
  item; runs BEFORE lifecycle so gates see fresh θ)
- gates → `MasteryLifecycleEngine.process_eval_result` (4-gate model; gate
  thresholds are P(correct) checks, not θ cutoffs; `lesson_eval_count`
  increments here when `source == "lesson"` and passed)

Review → `FirestoreService.save_problem_review` from submission_service.

### 3. L1 skill state
- `ability` — θ per (student, skill). Writers resolve curriculum lineage before
  writing (`upsert_student_ability`), so renames can't fork the doc.
- `mastery_lifecycle` — per-subskill `current_gate` (0–4) + `retention_state`
  (not_started / active / mastered). This chain (ability → lifecycle) is CANON.
- `competencies` — legacy parallel scoring (blended classical average). Slated
  for retirement once `get_student_proficiency_map` (learning-path unlocks)
  migrates off it. Until then it has exactly ONE per-eval writer (invariants).

### 4. L2 read model (the 2026-07-02 slice)
`FirestoreService.apply_attempt_rollup` (`backend/app/db/firestore_service.py`)
runs best-effort inside `save_attempt` — every attempt writer (practice, pulse,
drawing) feeds it automatically:
- `students/{sid}/daily_rollups/{YYYY-MM-DD}` — attempts, sum_score, subskills
  (ArrayUnion), per-subject map. Firestore `Increment` sentinels + merge=True,
  so concurrent submissions compose without read-modify-write.
- `students/{sid}/profile/summary` — lifetime totals, per-subject totals,
  last-activity pointers.
- Subject map keys come from `FirestoreService.rollup_subject_key` (uppercase,
  separators→`_`, strip `_G\d+` — mirrors `_norm_subject`); original spelling
  is preserved in each entry's `name`.

**Rebuild contract:** `backend/scripts/backfill_daily_rollups.py` recomputes
everything from L0 and OVERWRITES (dry-run default; `--student N` / `--all` /
`--apply`). Any suspected drift → rerun backfill; never hand-edit rollups.

### 5. Serve
- `GET /api/analytics/student/{id}/profile`
  (`backend/app/api/endpoints/analytics.py`) — THE canonical one-call profile:
  `engagement` (stored Cosmos XP/level/streak/badges via user_profiles_service;
  null when viewing another student — Cosmos is keyed by caller firebase_uid) +
  `totals` (profile/summary) + `recent` (rollups) + `skill_state` (lifecycle
  gate/state counts). Service method:
  `FirestoreAnalyticsService.get_student_profile`.
- `get_engagement_metrics` / `get_score_trends`
  (`backend/app/services/firestore_analytics.py`) — read rollups (≤365 tiny
  docs); the old attempt/review scans survive only as `_engagement_from_attempts`
  / `_score_trends_from_reviews`, used solely when a student has ZERO rollup
  docs in the window (i.e. backfill never ran for them).
- Analytics endpoints take an explicit `grade` param — unit/skill/subskill IDs
  repeat across grades and bare-subject resolution picks grade "1". Frontends
  that know the grade must pass it.

### 6. UI
`my-tutoring-app/src/lib/studentAnalyticsAPI.ts` → `getStudentProfile` +
`StudentProfileResponse`. Consumed by
`my-tutoring-app/src/components/lumina/components/StudentProfileSummary.tsx`
(the "Snapshot" card at the top of `MyProgressPanel`) — level/XP/streak chips,
four stat tiles, per-subject mastery bars. It fails quietly (renders null) so
the rest of the profile view never blocks on it.

### 7. Closing the loop
The same L1 state the profile displays is what selects the next problem: θ/σ
feed Fisher-information item selection and P(correct) gate checks (pure IRT —
no hand-tuned urgency formulas), and the generation-context endpoint folds
ability + lifecycle into the STUDENT PROFILE block Gemini sees when generating
content. A submission literally changes what the student sees next.

## Invariants — Violating Any of These Is a Bug

1. **One attempt_id per submission**, stamped on both attempt and review.
2. **`apply_competency_eval` is the ONLY per-eval competency writer.** It takes
   the RAW item score and blends against the doc's own running `raw_average`
   with credibility `min(1, sqrt(n/15))`. Direct `update_competency` is for
   SEEDING only (e.g. pulse leapfrog seeds). Pulse eval flushes must stay
   SEQUENTIAL (same subskill can repeat in a session; concurrent RMW loses
   increments).
3. **Every attempt write goes through `save_attempt`** — that's what keeps L2
   in sync. Never write rollup/profile docs directly except via the backfill.
4. **Lineage before write, merge on read.** Ability/competency/lifecycle
   writers resolve subskill/skill IDs through lineage; readers
   (`_load_competency_map` / `_load_lifecycle_map`) merge canonical collisions
   (sum attempts, keep higher gate) with NO `canonical != sid` guard.
   Dead-end lineage records (empty `canonical_ids`) are repaired by
   `backend/scripts/repair_case_variant_lineage.py`, not by rewriting student
   docs. Cross-grade case twins that are BOTH published (K `OPS001-01-A` vs G1
   `OPS001-01-a`) are NOT lineage cases — the grade param is the fix.
5. **Cosmos is the single XP/level/streak source** (written event-driven by
   `engagement_service`, level formula `100 * level**1.5` cumulative). Do not
   recompute streaks in new serves — the profile's `recent` block deliberately
   omits streak keys. (Known exception: the older `/engagement-metrics`
   endpoint still derives its own window streak for EngagementPanel.)
6. **Curriculum stays clean:** no primitive mappings in curriculum data, no
   direct `curriculum_published` edits (draft-first), lineage record BEFORE any
   subskill ID change.

## Verifying Changes to the Loop

- Python: `C:\Users\xbox3\miniforge-pypy3\envs\py311env\python.exe` for
  py_compile / `import app.main` / pytest (67 pass baseline; 10
  test_planning_service failures + test_dag_analysis import are pre-existing).
- Live probe without HTTP auth:
  `FirestoreAnalyticsService(FirestoreService(), None).get_student_profile(1004)`
  (student 1004 has rich real data: ~2.7k attempts, 7 subjects).
- Rollup integrity: backfill dry-run and compare to `profile/summary`.
- Scripts touching Firestore MUST get their client via
  `FirestoreService().client` — hand-rolled clients hit 403s.
- Frontend: tsc baseline 1417 (`./node_modules/.bin/tsc --noEmit`).

## Known Rough Edges (checked 2026-07-02)

- Drawing path double-writes reviews (ReviewService + `_save_review`) — known,
  unfixed.
- `badges[]` is plumbed end-to-end but NOTHING awards badges
  (`engagement_service` hard-codes `badges_earned=[]`) and no UI renders them.
- `getRecommendations` (frontend) + its BigQuery endpoint are orphaned — zero
  live UI callers.
- `competencies` retirement is pending the proficiency-map migration.
- Reviews all carry `source_system='cosmos_migration'` even for new writes —
  mislabeled by the current submit path; don't use that field to filter.
- Lumina UI kit accent palette has `purple`, not `violet`.
