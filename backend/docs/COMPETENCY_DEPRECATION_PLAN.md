# CompetencyService Deprecation Plan

**Status:** Proposal
**Date:** 2026-03-06

---

## 1. The Problem: Three Parallel Trackers

Every student result currently flows through up to three independent state systems:

```
Student submits answer
       |
       v
CompetencyService.update_competency_from_problem()
  |-- writes students/{id}/attempts/{attempt_id}         (attempt log)
  |-- writes students/{id}/competencies/{doc_id}         (blended score)
  |-- delegates to MasteryLifecycleEngine.process_eval_result()
  |     \-- writes students/{id}/mastery_lifecycle/{subskill_id}  (4-gate state)
  \-- delegates to CalibrationEngine.process_submission()
        \-- writes students/{id}/ability/{skill_id}              (IRT theta/beta)
```

Meanwhile, PulseEngine (the new primary practice path) **bypasses CompetencyService entirely** and calls MasteryLifecycleEngine + CalibrationEngine directly:

```
Pulse item completed
       |
       v
PulseEngine.process_result()
  |-- calls CalibrationEngine.process_submission()        (IRT theta/beta)
  |-- calls MasteryLifecycleEngine.process_eval_result()  (4-gate state)
  \-- writes pulse_sessions/{session_id}                  (session log)

  ** CompetencyService is never called **
  ** students/{id}/competencies/ is never updated **
  ** students/{id}/attempts/ is never updated **
```

This means:
- Pulse results update mastery gates and IRT but NOT competency scores or attempt logs
- The `competencies` subcollection diverges from reality as Pulse becomes the primary path
- Any analytics reading from `competencies` or `attempts` sees an incomplete picture
- CosmosDB dual-writes are dead weight (only CompetencyService writes there)

---

## 2. What Each System Actually Tracks

| System | Collection | Data | Who reads it |
|--------|-----------|------|-------------|
| **CompetencyService** | `competencies/{doc_id}` | Blended score + credibility per subskill | Legacy analytics, competency endpoints |
| **CompetencyService** | `attempts/{attempt_id}` | Raw attempt records with feedback | Problem review history |
| **MasteryLifecycleEngine** | `mastery_lifecycle/{subskill_id}` | 4-gate state, pass/fail, completion %, retest schedule | PulseEngine, PlanningService, DailyActivities |
| **CalibrationEngine** | `ability/{skill_id}` | IRT theta, sigma, earned level | PulseEngine (mode selection), frontend EL display |
| **PulseEngine** | `pulse_sessions/{session_id}` | Full session log with per-item scores, theta/gate deltas | Session summary, resume |

**The overlap:** CompetencyService's `competencies` collection tracks a blended score per subskill. MasteryLifecycle tracks a gate + completion_pct per subskill. Both represent "how well does the student know this?" but in different formats. The `mastery_lifecycle` version is strictly more informative (gate position, retest schedule, actuarial completion factor).

**The gap:** CompetencyService's `attempts` collection is an audit log that nothing else replicates. PulseEngine stores per-item results inside `pulse_sessions`, but old submission-based attempts only exist in `attempts`.

---

## 3. What CompetencyService Does Beyond State Tracking

CompetencyService is not just a state writer. It also provides:

1. **Curriculum loading** via CurriculumService (subjects, skills, subskills, problem types)
2. **Problem review history** (structured feedback per attempt)
3. **CosmosDB dual-write** (legacy, likely removable)
4. **Hook orchestration** (triggers MasteryLifecycle + Calibration on each attempt)

The curriculum-loading endpoints (`/api/competency/subjects`, `/api/competency/curriculum/{subject}`) are used by the frontend and have nothing to do with competency tracking. They should be extracted.

---

## 4. Deprecation Strategy

### Phase 1: Stop the divergence (minimal, safe)

**Goal:** Make Pulse results visible to CompetencyService consumers without changing architecture.

- Add a lightweight bridge in `PulseEngine.process_result()` that writes to `attempts` subcollection after each item (same format CompetencyService uses)
- This ensures the attempt audit log stays complete regardless of entry path
- Do NOT write to `competencies` — let it go stale; mastery_lifecycle is the authoritative source

**Effort:** Small (one new write call in pulse_engine.py)
**Risk:** Low (additive only)

### Phase 2: Extract curriculum endpoints

**Goal:** Remove CompetencyService's curriculum-loading responsibility.

- Move `/api/competency/subjects`, `/api/competency/curriculum/{subject}`, `/api/competency/objectives/*`, `/api/competency/problem-types/*` to a new `/api/curriculum/*` router backed by CurriculumService directly
- Update frontend API calls
- CompetencyService no longer needs CurriculumService injected

**Effort:** Medium (new router + frontend URL updates)
**Risk:** Low (pure relocation)

### Phase 3: Retire the competency score

**Goal:** Stop writing to `competencies` subcollection entirely.

- Remove `update_competency()` calls from CompetencyService
- Remove CosmosDB dual-writes (they only exist in CompetencyService)
- Any analytics that read `competencies` should be migrated to read from `mastery_lifecycle` instead (gate + completion_pct is strictly more informative)
- Keep the `attempts` write path alive (via either CompetencyService or a thin AttemptLogger)

**Effort:** Medium (audit analytics consumers, update queries)
**Risk:** Medium (must verify no dashboards rely on competency scores)

### Phase 4: Collapse CompetencyService into a thin SubmissionRouter

**Goal:** CompetencyService becomes a simple pass-through.

What remains after phases 1-3:
- `update_competency_from_problem()` just writes an attempt record and delegates to MasteryLifecycle + Calibration
- A handful of read endpoints

This can be reduced to:
- A `SubmissionService.record_result()` method that writes the attempt + delegates (already exists at `submission_service.py:606`)
- Read endpoints moved to their respective routers

**Effort:** Large (many call sites to update)
**Risk:** Low if phases 1-3 are done first

---

## 5. What Breaks If We Skip Straight to Phase 4

| Component | Impact | Severity |
|-----------|--------|----------|
| `/api/competency/*` endpoints | Gone — frontend must update URLs | High (breaks UI) |
| Problem submission via SubmissionService | Must call MasteryLifecycle + Calibration directly | Medium (already done in Pulse) |
| `competencies` Firestore subcollection | Stops being written | Low (mastery_lifecycle replaces it) |
| `attempts` Firestore subcollection | Must be written by another service | Medium (audit trail gap) |
| CosmosDB dual-writes | Stops | Low (legacy, unused by active systems) |
| BigQuery analytics reading from competencies | Stale data | Medium (must migrate queries) |
| Problem review history (`get_detailed_problem_reviews`) | Must be reimplemented or kept | Medium |

---

## 6. Recommended Execution Order

```
Phase 1 (1-2 hours)     -- Bridge Pulse -> attempts, close the audit gap
Phase 2 (half day)       -- Extract curriculum endpoints to /api/curriculum
Phase 3 (half day)       -- Retire competency scores, kill CosmosDB writes
Phase 4 (1 day)          -- Collapse CompetencyService, clean up
```

Phase 1 is the immediate win — it stops the data divergence today. Phases 2-4 can be done incrementally over multiple sessions.

---

## 7. Key Files

| File | Role | Phase |
|------|------|-------|
| `backend/app/services/competency.py` | CompetencyService (the target) | All |
| `backend/app/services/pulse_engine.py` | PulseEngine (bypasses competency) | 1 |
| `backend/app/services/submission_service.py` | Calls `update_competency_from_problem()` | 4 |
| `backend/app/api/endpoints/competency.py` | 8 REST endpoints | 2, 4 |
| `backend/app/dependencies.py` | Singleton factory for CompetencyService | 4 |
| `backend/app/db/firestore_service.py` | `save_attempt()`, `update_competency()` | 3 |
| `backend/app/db/cosmos_db.py` | CosmosDB dual-writes | 3 |
