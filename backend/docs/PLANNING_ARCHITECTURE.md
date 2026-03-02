# Planning & Mastery System Architecture

> **Purpose:** This document gives Claude Code (and human developers) the full context
> needed to modify the planning and mastery services without re-reading every file.
> For the quick summary, see the "Planning & Mastery System" section in the root `CLAUDE.md`.

---

## 1. System Overview

The planning system is a **stateless, deterministic engine** that reads live Firestore
state on every request. There are no stored plans, no LLM calls, no BigQuery dependency.

```
CompetencyService.update_competency_from_problem()
        │
        ▼
MasteryLifecycleEngine.process_eval_result()   ← writes mastery_lifecycle docs
        │
        ▼
  Firestore: students/{id}/mastery_lifecycle/{subskill_id}
        │
        ▼
PlanningService (reads on-demand)
  ├── get_weekly_plan()   → pacing snapshot
  ├── get_monthly_plan()  → forward simulation with confidence bands
  └── get_daily_plan()    → today's prioritised session queue
```

---

## 2. Mastery Lifecycle Engine

**File:** `backend/app/services/mastery_lifecycle_engine.py`
**Model:** `backend/app/models/mastery_lifecycle.py`

### 2.1 Gate Model

Each subskill follows a 5-state lifecycle (Gates 0–4):

| Gate | Name             | Entry Condition                              | Retest Interval |
|------|------------------|----------------------------------------------|-----------------|
| 0    | Not Started      | Default state                                | —               |
| 1    | Initial Mastery  | 3 lesson evals with score >= 9.0             | 3 days          |
| 2    | Retest 1         | Practice eval >= 9.0, retest-eligible        | 7 days          |
| 3    | Retest 2         | Practice eval >= 9.0, retest-eligible        | 14 days         |
| 4    | Fully Mastered   | Practice eval >= 9.0, retest-eligible        | —               |

**Failed retests** do not demote the gate. They reset the retest interval:
- Gate 1→2 fail: reset to 3 days
- Gate 2→3 fail: reset to 3 days
- Gate 3→4 fail: reset to 7 days

**Anti-gaming:** Practice evals before `next_retest_eligible` are recorded in
competency but skipped by the lifecycle engine (PRD §8.3).

### 2.2 Entry Point

```python
MasteryLifecycleEngine.process_eval_result(
    student_id, subskill_id, subject, skill_id,
    score, source="lesson"|"practice", timestamp
)
```

Called from `CompetencyService.update_competency_from_problem()` as a hook
(set via dependency injection in `dependencies.py`).

### 2.3 Evaluation Routing

- `source="lesson"` → `_handle_lesson_eval()` — only affects Gate 0→1
- `source="practice"` → `_handle_practice_eval()` — affects Gates 1→2, 2→3, 3→4

Lesson evals at Gate >= 1 are no-ops. Practice evals at Gate 0 or Gate 4 are no-ops.

### 2.4 Actuarial Completion Factor (PRD §4)

After every practice eval, the completion percentage is recalculated:

```
Z = min(total_attempts / CREDIBILITY_STANDARD, 1.0)   # CREDIBILITY_STANDARD = 10
blended_pass_rate = Z × subskill_pass_rate + (1-Z) × global_pass_rate
credit_per_pass = blended_pass_rate × 0.25
completion_pct = gate_1_credit (0.25) + passes × credit_per_pass
```

`global_pass_rate` is the student's aggregate practice pass rate across all subskills,
updated after every practice eval via `update_global_pass_rate()`.

### 2.5 Workload Forecast

```
estimated_remaining_attempts = remaining_credit / credit_per_pass / blended_pass_rate
```

Used by the planning service to estimate review reserves and pipeline throughput.

### 2.6 Firestore Document

**Path:** `students/{student_id}/mastery_lifecycle/{subskill_id}`

Key fields:
- `current_gate` (0–4)
- `completion_pct` (0.0–1.0)
- `passes`, `fails` — practice-mode retest results
- `lesson_eval_count` — passing lesson evals toward Gate 1
- `next_retest_eligible` — ISO timestamp, earliest retest allowed
- `retest_interval_days` — current interval
- `blended_pass_rate`, `credit_per_pass`, `subskill_pass_rate`
- `estimated_remaining_attempts`
- `gate_history[]` — capped at 50 entries (MAX_GATE_HISTORY)
- `subject`, `skill_id` — metadata for filtering

### 2.7 Constants

```python
MASTERY_THRESHOLD = 9.0         # Score out of 10
GATE_1_MIN_LESSON_EVALS = 3    # Passing lesson evals for Gate 1
CREDIBILITY_STANDARD = 10      # Attempts before full credibility
RETEST_INTERVALS = {
    (1, 2): (3, 3),   # (pass_interval_days, fail_reset_days)
    (2, 3): (7, 3),
    (3, 4): (14, 7),
}
```

---

## 3. Planning Service

**File:** `backend/app/services/planning_service.py`
**Models:** `backend/app/models/planning.py`
**Endpoints:** `backend/app/api/endpoints/weekly_planner.py`, `backend/app/api/endpoints/daily_activities.py`

### 3.1 Data Sources (all Firestore)

| Collection/Document                          | What it provides                    |
|----------------------------------------------|-------------------------------------|
| `students/{id}/mastery_lifecycle/*`          | All lifecycle state (gates, retests)|
| `students/{id}` (planning fields)            | `daily_session_capacity`            |
| `config/schoolYear`                          | Year dates, break periods           |
| `curriculum_published` (via CurriculumService) | Total skills per subject, hierarchy|
| Curriculum graphs (via LearningPathsService) | Prerequisite relationships          |

### 3.2 Gate-to-Status Mapping

Used across all three plan types:

```
Gate 4          → closed (mastered)
Gate 1, 2, 3    → in_review (in the retest pipeline)
Gate 0 + evals  → learning (started but not yet Gate 1)
No document     → not_started
```

### 3.3 Weekly Plan (`get_weekly_plan`)

**Endpoint:** `GET /weekly-planner/{student_id}`

Computes a pacing snapshot per subject:
1. Load school year config → calculate `fraction_elapsed`, `weeks_remaining`
2. Load all mastery lifecycles → count closed/in_review/learning per subject
3. Compare to curriculum totals → derive `not_started`, `expected_by_now`, `behind_by`
4. Calculate `weekly_new_target = ceil(not_started / weeks_remaining)`
5. Sum `estimated_remaining_attempts` for in-pipeline skills → `review_reserve`
6. Estimate `sustainable_new_per_day = capacity - (total_in_pipeline / 5)`

### 3.4 Monthly Plan (`get_monthly_plan`)

**Endpoint:** `GET /weekly-planner/{student_id}/monthly`

Runs a week-by-week forward simulation:

**Pipeline delay model:**
- Optimistic: 4 weeks to close (perfect, no failures)
- Best estimate: 5 weeks (typical, ~1 failure)
- Pessimistic: 6 weeks (struggling, 2+ failures)

**Per-week simulation loop:**
1. **Reviews due** = known retests (from `next_retest_eligible`) + estimated retests from prior introductions (at weeks +1, +2, +4 post-introduction)
2. **Closures** = existing pipeline closures (based on current gate → remaining intervals) + new closures (skills introduced N weeks ago emerging from the pipeline delay)
3. **New introductions** = `min(budget // 3, pacing_target, not_started)` where budget = `weekly_capacity - projected_reviews`. Each new intro costs 3 lesson sessions.
4. **Running totals** → `open_inventory`, `cumulative_mastered` (3 confidence bands)

**Early warnings:** review overload (open_inventory > capacity × 5), zero new capacity

**Confidence bands** derived from historical pass rates (mean ± stddev from closed lifecycle docs).

### 3.5 Daily Plan (`get_daily_plan`)

**Endpoint:** `GET /daily-activities/daily-plan/{student_id}`

The most complex plan type. Five steps:

**Step 1 — Review queue:**
- Source: `firestore.get_mastery_retests_due()` (single source, no dual-merge)
- Sorted by: most overdue first, then lowest gate first
- Each item tagged with `days_overdue`, `mastery_gate`, `completion_factor`

**Step 2 — Capacity allocation:**
- `max_review_slots = floor(capacity × 0.85)` — reviews get up to 85%
- `actual_review_slots = min(len(review_queue), max_review_slots)`
- `new_skill_slots = capacity - actual_review_slots`

**Step 3 — New skill selection (with gate blocking, PRD §7):**
- Get weekly plan → identify subjects with `weekly_new_target > 0`
- Allocate slots proportionally to each subject's deficit
- For each subject:
  - Get unlocked entities from `LearningPathsService` (prerequisite graph)
  - Filter to not-started only (no lifecycle doc, or gate == 0)
  - Separate gate-eligible vs gate-blocked candidates
  - If no eligible candidates but blocked ones exist → **dependency bottleneck**: pick the one closest to complete (highest `completion_pct`)
- Session reasons: `NEXT_IN_SEQUENCE`, `BEHIND_PACE`, `BOTTLENECK_ADVANCE`

**Step 4 — Curriculum enrichment:**
- Build lookup: `subskill_id → {unit_title, skill_description, subskill_description}`
- Resolve human-readable names for all sessions

**Step 5 — Interleaving (PRD §8):**
- Subject-alternate reviews (greedy: pick subject with most remaining that differs from last)
- Front 60%: interleaved blocks (1 new + 2 reviews)
- Back 40%: tail reviews (lighter cognitive load)
- Each session gets `session_category` (INTERLEAVED or TAIL) and `priority` (1-based)

### 3.6 Session Interleaving Algorithm

```
REVIEWS_PER_NEW_BLOCK = 2
front_boundary = ceil(total_sessions × 0.60)

Loop:
  if within front 60% and new skills remain → place 1 new skill
  place up to 2 reviews (subject-alternated)
  if one type exhausted → drain the other

Assign priority = 1, 2, 3, ... in final order
```

### 3.7 Helper Methods

- `_get_school_year_config()` — loads from Firestore with fallback defaults (2025-08-25 to 2026-05-29)
- `_school_weeks_remaining()` — subtracts future break periods, divides by 5 school days/week
- `_build_curriculum_lookup()` — walks unit → skill → subskill hierarchy
- `_count_subskills()` — total subskills in a curriculum hierarchy
- `_alternate_subjects()` — greedy subject-alternation for review ordering

---

## 4. API Endpoints

### Weekly Planner (`/weekly-planner/`)
| Method | Path                              | Handler                    |
|--------|-----------------------------------|----------------------------|
| GET    | `/{student_id}`                   | Weekly pacing snapshot     |
| GET    | `/{student_id}/monthly`           | Monthly forward simulation |
| GET    | `/admin/school-year-config`       | School year config         |
| GET    | `/health`                         | Health check               |

### Daily Activities (`/daily-activities/`)
| Method | Path                                              | Handler                    |
|--------|---------------------------------------------------|----------------------------|
| GET    | `/daily-plan/{student_id}`                        | Today's session queue      |
| GET    | `/daily-plan/{student_id}/activities`             | Flat activities format     |
| POST   | `/daily-plan/{student_id}/activities/{id}/complete` | Mark activity complete (UI only) |
| POST   | `/daily-plan/{student_id}/complete`               | Mark daily plan complete   |
| GET    | `/daily-activities/health`                        | Health check               |

### Mastery (`/mastery/`)
| Method | Path                              | Handler                    |
|--------|-----------------------------------|----------------------------|
| Various | See `endpoints/mastery.py`       | Lifecycle CRUD, eval processing, summaries, forecasts |

**Note:** Activity completion endpoints are for frontend UI state only. Actual lifecycle
updates happen through `POST /competency/update → CompetencyService → MasteryLifecycleEngine`.

---

## 5. Dependency Wiring

```
dependencies.py:
  get_mastery_lifecycle_engine(firestore) → MasteryLifecycleEngine singleton
  get_competency_service() → sets competency.mastery_lifecycle_engine = engine
  get_planning_service(firestore, curriculum, learning_paths) → PlanningService singleton
```

PlanningService depends on:
- `FirestoreService` — all data reads
- `CurriculumService` — curriculum hierarchy and subskill counts
- `LearningPathsService` (optional) — prerequisite graph for new skill selection

---

## 6. Pydantic Models

### Mastery Lifecycle (`models/mastery_lifecycle.py`)
- `MasteryGate` — IntEnum (0–4)
- `GateHistoryEntry` — single eval event
- `MasteryLifecycle` — full per-subskill lifecycle document

### Planning (`models/planning.py`)
- `SkillLifecycleStatus` — not_started, learning, in_review, closed
- `SessionReason` — scheduled_review, mastery_retest, behind_pace, next_in_sequence, bottleneck_advance
- `SessionCategory` — interleaved, tail
- `SchoolYearConfig`, `SchoolBreak` — year calendar
- `SubjectWeeklyStats`, `WeeklyPlanResponse` — weekly plan
- `ReviewSessionItem`, `NewSkillSessionItem`, `DailyPlanResponse` — daily plan
- `WeekProjection`, `ConfidenceBand`, `SubjectMonthlyProjection`, `MonthlyPlanResponse` — monthly plan

---

## 7. Common Modification Patterns

### Adding a new gate transition rule
1. Update `RETEST_INTERVALS` in `models/mastery_lifecycle.py`
2. Update `_handle_retest_pass` / `_handle_retest_fail` in `mastery_lifecycle_engine.py`
3. Update `_count_by_gate_status` gate ranges in `planning_service.py`
4. Update pipeline delay constants in `get_monthly_plan()` (weeks_to_close_opt/best/pess)

### Changing capacity allocation
- Daily: `max_review_slots` ratio in `get_daily_plan()` Step 2 (currently 0.85)
- Monthly: `sessions_per_intro` (currently 3) and weekly_capacity formula

### Changing interleaving behavior
- `REVIEWS_PER_NEW_BLOCK` constant in `_interleave_sessions()`
- `front_boundary` ratio (currently 0.60)
- `_alternate_subjects()` for review ordering logic

### Changing the completion factor formula
- Constants in `models/mastery_lifecycle.py` (CREDIBILITY_STANDARD, MASTERY_THRESHOLD)
- `_recalculate_completion_factor()` in `mastery_lifecycle_engine.py`

### Adding a new session reason
1. Add to `SessionReason` enum in `models/planning.py`
2. Add selection logic in `get_daily_plan()` Step 3
3. Frontend will need to handle the new reason for display
