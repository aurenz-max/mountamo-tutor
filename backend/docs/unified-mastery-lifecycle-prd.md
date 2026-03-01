# Unified Mastery Lifecycle — Product Requirements Document

**Author:** Chris + Claude
**Date:** February 28, 2026
**Status:** Draft v1
**Supersedes:** lumina-competency-planner-integration-prd.md (mastery model), lumina-daily-activities-prd-v2 (review engine portions)

---

## 0. Design Principles

**Parsimony.** One lifecycle system, one state machine, one source of truth per subskill. Every concept earns its place by solving a concrete problem. If it doesn't change what the student sees tomorrow, it's deferred.

**Effectiveness.** The system exists to answer one question: "What should this student do next?" Everything else — projections, dashboards, analytics — is downstream of that question and should not complicate the answer.

**Demonstrability.** Every claim about capacity, pacing, or feasibility is backed by arithmetic. If the math doesn't work, the feature doesn't ship.

---

## 1. The Problem

Lumina currently has two parallel lifecycle systems tracking the same thing:

| System | Collection | Engine | Intervals |
|--------|-----------|--------|-----------|
| `skill_status` | `students/{id}/skill_status/{skillId}` | `ReviewEngine` | 2wk / 4wk / 6wk |
| `mastery_lifecycle` | `students/{id}/mastery_lifecycle/{subskillId}` | `MasteryLifecycleEngine` | 3d / 7d / 14d |

Both fire on every evaluation. The daily planner reads from both and merges them, creating duplicate sessions and conflicting state. The weekly and monthly planners read only from `skill_status`, ignoring the richer mastery lifecycle data.

**Decision:** `mastery_lifecycle` is the single lifecycle system going forward. `ReviewEngine` and `skill_status` are retired.

**Why mastery_lifecycle wins:**
- Finer-grained gate model (5 states vs 4) maps cleanly to pedagogical reality
- Actuarial completion factor with credibility blending produces better forecasts
- Tighter intervals (3d/7d/14d) match research on spaced repetition for young learners
- Already integrated with the seeder and frontend session queue

---

## 2. The Lifecycle — One State Machine

Every subskill follows exactly one path:

```
Gate 0          Gate 1              Gate 2          Gate 3          Gate 4
NOT_STARTED --> INITIAL_MASTERY --> RETEST_1 -----> RETEST_2 -----> COMPLETE
  (lesson)       (+3 days)          (+7 days)       (+14 days)
```

### 2.1 Gate Transitions

| Transition | Trigger | Requirement | Calendar Wait |
|-----------|---------|-------------|---------------|
| 0 → 1 | Lesson eval | 3 passing lesson evals (score ≥ 9.0/10) | None |
| 1 → 2 | Practice eval | Score ≥ 9.0 after retest interval | 3 days |
| 2 → 3 | Practice eval | Score ≥ 9.0 after retest interval | 7 days |
| 3 → 4 | Practice eval | Score ≥ 9.0 after retest interval | 14 days |

### 2.2 Failure Handling

On any retest failure (score < 9.0):
- Student **stays at current gate** (does not regress)
- `fails` counter increments
- Retest interval resets to a shorter value (see table)
- Student retries the same gate transition

| Failed Transition | Reset Interval |
|-------------------|---------------|
| 1 → 2 | 3 days |
| 2 → 3 | 3 days |
| 3 → 4 | 7 days |

There is no "tight loop" concept. There is no "stability proof" requirement. You fail, you wait the reset interval, you try again. When you pass, you advance. Simple.

### 2.3 What This Means for a Student

**Perfect student (passes everything first try):**
- Day 0: 3 lesson evals → Gate 1
- Day 3: 1 practice eval → Gate 2
- Day 10: 1 practice eval → Gate 3
- Day 24: 1 practice eval → Gate 4 (complete)
- **Total: 6 sessions over 24 days**

**Typical student (fails 1 retest):**
- Day 0: 3 lesson evals → Gate 1
- Day 3: practice eval → fail (stays Gate 1)
- Day 6: practice eval → Gate 2
- Day 13: practice eval → Gate 3
- Day 27: practice eval → Gate 4
- **Total: 7 sessions over 27 days**

**Struggling student (fails 3 retests):**
- Day 0: 3 lesson evals → Gate 1
- Day 3: fail, Day 6: fail, Day 9: pass → Gate 2
- Day 16: fail, Day 19: pass → Gate 3
- Day 33: pass → Gate 4
- **Total: 9 sessions over 33 days**

---

## 3. The Math — Proving Feasibility

This is the section that should give you confidence the system works.

### 3.1 Assumptions

| Parameter | Value | Source |
|-----------|-------|--------|
| School year | 180 school days (36 weeks) | Aug 25 – May 29 minus breaks |
| Daily session capacity | 25 sessions/day | PRD default |
| Sessions per subskill (perfect) | 6 | 3 lesson + 3 retests |
| Sessions per subskill (typical) | 7-8 | ~15% retest failure rate |
| Pipeline duration (perfect) | 24 days | 3 + 7 + 14 |
| Pipeline duration (typical) | 28-33 days | With 1-2 failures |
| Curriculum size (estimated) | 200-400 total subskills | Across all subjects |

### 3.2 Steady-State Capacity Model

At steady state, if a student introduces **N new subskills per day**:

```
Daily session load:
  New introductions:     3N  (3 lesson evals each)
  Retests from 3d ago:    N  (Gate 1→2 attempts)
  Retests from 10d ago:   N  (Gate 2→3 attempts)
  Retests from 24d ago:   N  (Gate 3→4 attempts)
  ─────────────────────────
  Total daily load:      6N

Solve for N:  6N = 25  →  N ≈ 4 new subskills/day
```

### 3.3 Year Throughput

```
Introduction window:  180 - 24 = 156 days
  (last subskill introduced on day 156 closes on day 180)

Perfect student:   4 new/day × 156 days = 624 subskills
Typical student:   3 new/day × 150 days = 450 subskills  (accounting for failures consuming capacity)
Struggling:        2 new/day × 140 days = 280 subskills
```

**For a 300-subskill curriculum, even a struggling student finishes with margin.**

### 3.4 Pipeline Visualization (Weeks 1-6)

```
Week 1:  Introduce 20 subskills → 60 lesson sessions + 0 retests = 60 sessions
Week 2:  Introduce 15 subskills → 45 lesson sessions + 20 retests (Gate 1→2) = 65 sessions
Week 3:  Introduce 12 subskills → 36 lesson sessions + 15 retests (G1→2) + 20 retests (G2→3) = 71 sessions
Week 4:  Introduce 10 subskills → 30 lesson sessions + 12 (G1→2) + 15 (G2→3) = 57 sessions
Week 5:  Introduce 10 subskills → 30 lesson sessions + 10 (G1→2) + 12 (G2→3) + 20 (G3→4) = 72 sessions
Week 6:  Steady state → ~30 intro + ~10 + ~10 + ~10 retests = ~60 sessions
         (Plus ~20 closures/week start flowing from here)

Weekly budget: 125 sessions (25/day × 5 days)
Peak load:     ~72 sessions in week 5 (58% utilization)
```

The system never comes close to capacity. There is ample room for failures, re-introductions, and uneven pacing.

### 3.5 Why This Is Conservative

The model above assumes every lesson eval is a separate session. In practice, a student might complete all 3 lesson evals for a subskill in a single sitting (10-15 minutes), consuming 3 "sessions" but only one calendar slot. This means actual throughput is higher than the model predicts.

---

## 4. The Data Model — One Collection

### 4.1 Mastery Lifecycle Document

**Path:** `students/{studentId}/mastery_lifecycle/{subskillId}`

```
{
  student_id: int,
  subskill_id: string,
  subject: string,
  skill_id: string,

  // The only state that matters
  current_gate: int (0-4),

  // Scheduling
  next_retest_eligible: string | null,   // ISO timestamp
  retest_interval_days: int,

  // Gate 1 tracking
  lesson_eval_count: int,                // passing lesson evals (need 3 for Gate 1)

  // Actuarial accounting (practice retests only)
  passes: int,
  fails: int,
  completion_pct: float (0.0-1.0),
  blended_pass_rate: float,
  credit_per_pass: float,
  estimated_remaining_attempts: int,

  // History
  gate_history: [{ gate, timestamp, score, passed, source }],

  // Timestamps
  created_at: string,
  updated_at: string
}
```

### 4.2 Student-Level Aggregates

**Path:** `students/{studentId}` (fields on existing document)

```
{
  // Session capacity
  daily_session_capacity: 25,

  // Global pass rate (for credibility blending)
  global_practice_passes: int,
  global_practice_fails: int,
  global_practice_pass_rate: float
}
```

That's it. No `development_patterns`, no `aggregate_metrics`, no `velocity` snapshots. Those are analytics features, not planning inputs. They can be computed on-read from the mastery_lifecycle subcollection.

### 4.3 What Gets Deleted

| Collection | Engine | Action |
|-----------|--------|--------|
| `students/{id}/skill_status/*` | ReviewEngine | **Delete.** Stop writing, stop reading. |
| `students/{id}` `.development_patterns` | ReviewEngine | **Delete field.** Computed on-read if needed. |
| `students/{id}` `.aggregate_metrics` | ReviewEngine | **Delete field.** Computed on-read if needed. |

---

## 5. The Planner — Reading From One Source

### 5.1 Status Mapping

The planning service currently counts skills by `status` (not_started/learning/in_review/closed). Map gates to these statuses:

| Gate | Planning Status | Meaning |
|------|----------------|---------|
| 0 (no document) | not_started | Never seen |
| 0 (document exists, lesson_eval_count < 3) | learning | In lesson phase |
| 1, 2, 3 | in_review | In retest pipeline |
| 4 | closed | Durable mastery |

### 5.2 Review Queue (Daily Planner)

Replace the dual-source merge with a single query:

```python
# OLD (two sources, potential duplicates):
due_skills = await firestore.get_skills_with_review_due(student_id, today_str)  # skill_status
mastery_due = await firestore.get_mastery_retests_due(student_id, now_iso)      # mastery_lifecycle
review_queue = mastery_retests + review_queue  # merged

# NEW (one source):
review_queue = await firestore.get_mastery_retests_due(student_id, now_iso)
```

Sort by:
1. Days overdue (most overdue first)
2. Gate (lower gates first — earlier in pipeline = more critical to unblock)

### 5.3 New Skill Selection (Daily Planner)

Replace `skill_status` lookups with mastery_lifecycle:

```python
# OLD: check skill_status for "not_started"
all_statuses = await firestore.get_all_skill_statuses(student_id, subject=subj)
tracked_ids = {s.get("skill_id") for s in all_statuses}
not_started = [sid for sid in unlocked if sid not in tracked_ids]

# NEW: check mastery_lifecycle for "no document or gate 0 with lesson_eval_count < 3"
all_lifecycles = await firestore.get_all_mastery_lifecycles(student_id, subject=subj)
lifecycle_by_id = {lc["subskill_id"]: lc for lc in all_lifecycles}
not_started = [
    sid for sid in unlocked
    if sid not in lifecycle_by_id
    or lifecycle_by_id[sid].get("current_gate", 0) == 0
]
```

Gate-blocking check (prerequisite at Gate 4):
```python
# Already implemented correctly — reads mastery_lifecycle
prereq_lc = mastery_by_id.get(sid)
if prereq_lc and prereq_lc.get("current_gate", 0) < 4:
    blocked = True
```

### 5.4 Weekly Planner

Replace `get_all_skill_statuses()` with `get_all_mastery_lifecycles()`:

```python
all_lifecycles = await firestore.get_all_mastery_lifecycles(student_id)

for subj in subject_names:
    subj_lcs = [lc for lc in all_lifecycles if lc.get("subject") == subj]

    closed = sum(1 for lc in subj_lcs if lc.get("current_gate", 0) >= 4)
    in_review = sum(1 for lc in subj_lcs if 1 <= lc.get("current_gate", 0) <= 3)
    learning = sum(1 for lc in subj_lcs if lc.get("current_gate", 0) == 0 and lc.get("lesson_eval_count", 0) > 0)
    not_started = max(0, total_subskills - closed - in_review - learning)
```

### 5.5 Monthly Planner

Same substitution. The forward simulation already works with the abstract concepts of "skills in pipeline" and "closures per week." It just needs to read from mastery_lifecycle instead of skill_status.

The pipeline delay model changes from 2wk/4wk/6wk intervals to the actual mastery_lifecycle intervals:
- Weeks to close (perfect): ceil(24 days / 7) = 4 weeks
- Weeks to close (typical): ceil(30 days / 7) = 5 weeks

---

## 6. The Integration — What Fires When

### 6.1 On Every Evaluation

```
Student submits answer
  → SubmissionService resolves source ("lesson" | "practice")
  → CompetencyService.update_competency_from_problem(source=source)
    → [KEEP] Update competency record (running average, credibility)
    → [KEEP] MasteryLifecycleEngine.process_eval_result(source=source)
    → [REMOVE] ReviewEngine.process_session_result()  ← DELETE THIS CALL
```

### 6.2 On Mastery Lifecycle Update

The engine already handles everything:
- Lesson evals: count toward Gate 1 (need 3 passing)
- Practice evals: check retest eligibility, advance or record failure
- Recalculate completion_pct using actuarial model
- Schedule next retest if applicable
- Update global pass rate after practice evals

No changes needed to the engine itself.

---

## 7. Implementation Plan

### Step 1: Remove ReviewEngine Hook (30 min)

In `competency.py`, delete the review engine call:

```python
# DELETE this block (lines ~410-422):
if self.review_engine:
    try:
        await self.review_engine.process_session_result(...)
    except Exception as re_err:
        ...
```

Remove `self.review_engine = None` from `__init__`.

### Step 2: Update Planning Service Data Source (2-3 hours)

In `planning_service.py`:

**Weekly planner (`get_weekly_plan`):**
- Replace `get_all_skill_statuses()` with `get_all_mastery_lifecycles()`
- Map gate states to status counts (Section 5.4 above)
- Remove `_checkpoint_counts()` helper (checkpoints are a skill_status concept)

**Monthly planner (`get_monthly_plan`):**
- Same substitution
- Update pipeline delay from 2/4/6 weeks to 4/5 weeks (Section 5.5)
- Remove checkpoint breakdown from projections (simplify)

**Daily planner (`get_daily_plan`):**
- Remove `get_skills_with_review_due()` call
- Remove mastery_retests merge (no more dual source)
- Use only `get_mastery_retests_due()` for review queue
- Update new skill selection per Section 5.3

### Step 3: Simplify Models (1 hour)

In `planning.py`:
- Remove `SkillStatus`, `ReviewEntry` models (skill_status concepts)
- Remove `CheckpointBreakdown`, `ReviewsByCheckpoint` (not needed)
- Simplify `SubjectWeeklyStats` (drop `checkpoints` field)
- Simplify `WeekProjection` (drop `projectedReviewsByCheckpoint`)

### Step 4: Update Frontend Types (30 min)

In `PlannerDashboard.tsx`:
- Remove `CheckpointBreakdown` and `ReviewsByCheckpoint` interfaces
- Simplify session item display (single review type, no mastery_retest distinction — all reviews ARE mastery retests now)

### Step 5: Clean Up Dead Code (1 hour)

- Delete or deprecate `review_engine.py`
- Remove `get_all_skill_statuses()`, `get_skill_status()`, `get_skills_with_review_due()`, `upsert_skill_status()` from FirestoreService (or mark deprecated)
- Remove ReviewEngine from dependency injection in `dependencies.py` and `main.py`

### Step 6: Verify End-to-End (1-2 hours)

1. Seed a student with the custom seeder (Language Arts + Math subskills at various gates)
2. Call `GET /api/plan/weekly/{studentId}` → verify counts match mastery_lifecycle state
3. Call `GET /api/plan/daily/{studentId}` → verify no duplicate sessions, retests appear correctly
4. Call `GET /api/plan/monthly/{studentId}` → verify forward simulation uses correct pipeline delay
5. Submit a lesson eval → verify Gate 0→1 transition
6. Submit a practice eval after retest interval → verify Gate 1→2 transition
7. Submit a failing practice eval → verify student stays at current gate, interval resets

---

## 8. What Is Explicitly NOT in This PRD

These features exist in the prior PRDs but are deferred. They are not needed for the core loop to work.

| Feature | Why Deferred |
|---------|-------------|
| Velocity metric (earned mastery, decomposition, trends) | Analytics, not planning input. Can be computed from mastery_lifecycle data on-demand later. |
| Parent overrides (weight multipliers, pauses, review-only mode) | Valuable but not MVP. The planner works without them. |
| Score normalization (problem type weights, guess-rate correction) | The 9.0/10 threshold works for now. Calibrate later with population data. |
| Weekly velocity snapshots (Cloud Function) | Requires infrastructure. Dashboard can compute current velocity on-read. |
| Development patterns (per-subject average ultimates) | The actuarial model in mastery_lifecycle already handles this per-subskill. Subject-level aggregation is analytics. |
| Score calibration feedback loop | Phase 5. Needs BigQuery population data that doesn't exist yet. |
| Activity log tracking (intra-week completions) | The daily planner shows what's due. Whether you did it today is the frontend's responsibility (mark complete on submit). |

---

## 9. Success Criteria

| Criterion | How to Verify |
|-----------|---------------|
| No duplicate sessions in daily plan | Seed student, call daily plan, verify each subskill appears at most once |
| Planning reads only from mastery_lifecycle | Grep codebase for `get_all_skill_statuses`, `get_skill_status`, `get_skills_with_review_due` — zero hits outside deprecated code |
| Gate transitions work end-to-end | Submit lesson evals → Gate 1. Wait 3d, submit practice → Gate 2. Repeat through Gate 4. |
| Weekly planner counts match Firestore | Seed known state, verify closed/in_review/not_started counts match |
| Monthly projection uses correct pipeline delay | 4-5 week pipeline, not 6+ weeks |
| Feasibility math holds | With 25 sessions/day, student can complete 300+ subskills in 180 school days |
| ReviewEngine is fully disconnected | No code path calls ReviewEngine.process_session_result() |

---

## Appendix A: Completion Factor — How It Works

The completion factor is an actuarial metric. It answers: "Given this student's observed pass rate on practice retests for this subskill, how much credit has been earned toward full mastery?"

```
Gate 1 credit:          0.25 (fixed, awarded on initial mastery)
Credit per retest pass:  blended_pass_rate × 0.25
completion_pct:          0.25 + (passes × credit_per_pass), capped at 1.0
```

**Credibility blending** prevents early overreaction:
```
Z = min(subskill_attempts / 10, 1.0)
blended_pass_rate = Z × subskill_pass_rate + (1 - Z) × global_pass_rate
```

A student who has only attempted 2 retests on a subskill gets blended heavily toward their global rate. After 10+ attempts, the subskill-specific rate dominates.

**Why this matters for planning:** The `estimated_remaining_attempts` field tells the planner how much future work this subskill will likely require, which feeds into the monthly projection's capacity model.

## Appendix B: Interleaving — Unchanged

The interleaving algorithm (PRD v2 Section 8) is orthogonal to the lifecycle model. It operates on the session queue regardless of how that queue was built. No changes needed:

1. Tight-loop items first (though with the simplified failure model, this just means "most overdue retests first")
2. New skill blocks interleaved with reviews in the first 60%
3. Remaining reviews in the tail 40%
4. Subject alternation within reviews
