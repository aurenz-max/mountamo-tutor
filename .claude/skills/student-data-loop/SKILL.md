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

### 7. Closing the loop — the Lesson Entry Contract
The same L1 state the profile displays is what selects the next problem: θ/σ
feed Fisher-information item selection and P(correct) gate checks (pure IRT —
no hand-tuned urgency formulas), and the generation-context endpoint
(`POST /api/student-profile/generation-context`) folds ability + lifecycle
into the STUDENT PROFILE block Gemini sees when generating content. A
submission literally changes what the student sees next.

How lessons get launched is governed by three rules (the Lesson Entry
Contract). Past violations of these rules are what produced the orphaned
recommendation surfaces in the Deprecation Ledger below.

1. **One launch verb.** Every Lumina lesson starts via
   `useExhibitSession.generate`
   (`my-tutoring-app/src/components/lumina/hooks/useExhibitSession.ts`),
   wrapped by `startGenerate` in `App.tsx`. It is the ONLY caller of
   `generateExhibitManifestWithObjectivesStreaming`.
2. **One scope shape.** The canonical scope is `preBuiltObjectives[]`
   (2–5 objectives, each with `subskillId`/`skillId`/`verb`);
   `curriculumContext` (one subskill) and bare `topic` are degenerate forms.
   Objectives carrying subskill ids let generation-context skip embedding
   retrieval and produce an accurate STUDENT PROFILE block.
3. **One composer, N fill modes.** The Lesson Builder tray
   (`lumina/components/LessonGroupBuilder/`, state in `IdleScreen.tsx`) is
   where multi-objective lessons are assembled/edited. New "what should the
   student do next" intelligence ships ONLY as a fill mode for the tray — a
   producer of `preBuiltObjectives` — NEVER as a new launch surface, page, or
   endpoint-with-no-consumer. Current fill modes: hand-picked (curriculum
   browser `selectionMode`) and the daily plan (`DailyLessonPlan` →
   `handleBlockStart`, backed by `PlanningService`). Third (shipped
   2026-07-03): the IRT session-scope selector — "Recommended Lesson" in
   `IdleScreen.tsx` next to Build Lesson. Chain:
   `FirestoreAnalyticsService.select_session_targets` (picks learn/confirm
   targets from per-subskill P(correct) at hardest-assigned-mode β vs
   `GATE_P_THRESHOLDS`; confirm→apply, learn→identify/explain; per-pick
   `reason`; titles enriched via `_build_curriculum_hierarchy`) →
   `GET /api/analytics/student/{id}/session-targets?subject&grade&count`
   (analytics.py, /profile auth+cache pattern) →
   `analyticsApi.getSessionTargets` → fills the SAME `selectedSubskills`
   tray state (bloomPhase = selector verb, reason on chip tooltip), then the
   normal Launch Lesson path. Subject/grade come from the browsed
   CurriculumBrowser pill (`onActiveSubjectChange`); button gated on
   StudentContext `ready && !isAnonymous`. Probe:
   `scripts/probe_session_targets.py --student N --subject S [--grade G]`
   (set PYTHONIOENCODING=utf-8 on Windows). The KG graph carries BOTH skill
   and subskill nodes — selectors must filter `entity_type == "subskill"`.
   Next convergence: PlanningService daily blocks should consume the same
   selector (one selection brain).

Division of labor: the selector/fill mode personalizes WHAT (which subskills,
which verbs); generation-context personalizes HOW (difficulty framing, persona
voice). Note the two compute P(correct) differently today: generation-context
uses median item β, the KG uses hardest-assigned-mode β (what gates check).
Selection should use the KG number.

The loop's close-out is visible to the student (shipped 2026-07-03):
`POST /api/analytics/student/{id}/session-progress` →
`FirestoreAnalyticsService.get_subskill_progress_delta` computes before/after
P(correct) + gate per exercised subskill — "before" derived SERVER-SIDE from
timestamped `theta_history` (ability doc) and `gate_history` (lifecycle doc),
no client snapshotting, at the same per-row reference β (KG hardest-mode,
median fallback). `LessonSummary.tsx` renders it as "Your progress"
(before→after %, gate advancement / Mastered badges) plus "Up next" — a fresh
`getSessionTargets` call — so every review screen ends by pointing at the
next lesson. Targets come from `demonstratedSkillLog` (subskillId+skillId);
`since` = earliest submission `startedAt` − 60s. Gotchas fixed along the way
(2026-07-03, found by the close-out coming up empty on a live lesson):
- KG in-process cache key now includes `grade` (cross-grade stale reads).
- **Per-objective attribution**: multi-subskill lessons submitted EVERY
  attempt under the FIRST objective's subskill (lesson-level
  `curriculumSubskillId` fallback) — poisons θ/gates. Fixed in
  `usePrimitiveEvaluation`: a component belonging to exactly ONE manifest
  objective attributes to that objective's `subskillId`/`skillId` (carried on
  `ObjectiveData` from preBuiltObjectives); cross-objective components
  (final knowledge-check) keep the lesson-level fallback.
- **Attribution made structural** (same day): the objective→subskill
  resolution generation-context computes is now PERSISTED — `useExhibitSession`
  stamps resolved `subskillId`/`skillId` onto the lesson objectives for ALL
  launch paths (free-form included), `flattenManifestToLayout` stamps them
  into every component's config + a `lessonObjectives` list onto the final
  assessment, and the KC orchestrator tags each planned problem with the
  `objectiveId` it assesses (validated against provided ids) so each KC
  problem's evaluation attributes to ITS objective's subskill. Inner problem
  primitives already passed `data.subskillId/skillId/objectiveId` to
  `usePrimitiveEvaluation` — the ids just were never stamped upstream.
- `CurriculumService.get_subskill_metadata(id, subject)` returned None for
  any id outside the bare-subject-resolved grade doc → blank
  `skill_description` on reviews → `extractDemonstratedSkill` abstains →
  empty `demonstratedSkillLog` → no skill cards, no close-out. Fixed: direct
  lookup now falls through to an all-subjects scan that passes each published
  entry's GRADE (the old scan fetched by subject_id alone = same doc 6×).

## Deprecation Ledger — do not resurrect

Every entry here was a "use student data to pick what's next" attempt that
shipped as a parallel surface instead of a `preBuiltObjectives` producer.
Before building ANY next-activity/recommendation feature, read this list.

**Removed 2026-07-03** (deleted in the lesson-entry-contract slice):
- `components/dashboard/EnhancedLearningDashboard.tsx`,
  `DailyBriefingComponent.tsx`, `EnhancedActivityCard.tsx` — dead dashboard
  generation, imported nowhere.
- `lib/use-student-analytics.tsx` + `lib/hooks/useStudentAnalytics.ts` —
  orphaned hooks, imported nowhere.
- `studentAnalyticsAPI.getRecommendations` — client for the BigQuery
  recommendations endpoint; its only caller was the orphaned hook above.
- `GET /api/analytics/student/{id}/ai-recommendations` — endpoint had zero
  consumers (the `/briefing` page uses a WebSocket, not this GET).
- `components/analytics/archive/` (33 tracked components, the pre-Lumina
  analytics dashboard archived 2025-11-14) and `components/dashboard/archive/`
  (untracked, gitignored) — both folders deleted; `.gitignore`'s `archive/`
  rule had hidden them from ripgrep while tsc still compiled them (~300 of the
  old error baseline). Untracked leftovers were backed up to the session
  scratchpad before removal.

**Superseded / legacy-live** (do not extend; retire with their host):
- `AIRecommendationService` (`app/services/ai_recommendations.py`) — still
  imported by `daily_activities.py` (old service, not `planning_service.py`)
  and `parent_portal.py`; dies when those migrate.
- `GET .../recommendations` (BigQuery, `analytics.py`) — consumed only by
  legacy `/gemini` `/tutoring` `/practice` SyllabusSelectors via
  `api.ts getAdvancedRecommendations`; dies with those routes.
- `ProblemRecommender` (`app/services/recommender.py`) — injected only into
  deprecated `POST /problems/generate` (which legacy pages still call).
- `GET .../subject-recommendations` — live only via the legacy `/analytics`
  page (`VelocityMetricsCard`).
- `/briefing` page (WebSocket daily briefing) and `/daily-learning/[subskillId]`
  stub — URL-only, no nav path from Lumina, no Lumina launch.
- Legacy launcher stacks `/gemini` `/tutoring` `/practice` — parallel
  pre-Lumina engines; no path from the Lumina app reaches them. Deletion is
  its own future slice.

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
- Frontend: tsc baseline 1101 as of 2026-07-03 (`./node_modules/.bin/tsc
  --noEmit`); dropped from 1417 when the dead `archive/` folders were deleted.

## Known Rough Edges (checked 2026-07-02)

- Drawing path double-writes reviews (ReviewService + `_save_review`) — known,
  unfixed.
- `badges[]` is plumbed end-to-end but NOTHING awards badges
  (`engagement_service` hard-codes `badges_earned=[]`) and no UI renders them.
- Recommendation-surface debt is tracked in the Deprecation Ledger above —
  frontend `getRecommendations` and `GET /ai-recommendations` were removed
  2026-07-03; the BigQuery endpoint survives only for legacy routes.
- `competencies` retirement is pending the proficiency-map migration.
- Reviews all carry `source_system='cosmos_migration'` even for new writes —
  mislabeled by the current submit path; don't use that field to filter.
- Lumina UI kit accent palette has `purple`, not `violet`.
