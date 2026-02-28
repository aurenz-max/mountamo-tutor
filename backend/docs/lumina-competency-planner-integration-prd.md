# Lumina: Competency–Planner Integration PRD

## Completion Factor Model & Mastery Lifecycle

**Version:** 1.0
**Date:** February 28, 2026
**Author:** Chris (Lead Architect)
**Status:** Draft

---

## 1. Problem Statement

Lumina currently has two independent systems that need to be linked:

1. **The Planner** — a daily/weekly/monthly scheduler that selects the next curriculum item and manages spaced repetition intervals.
2. **The Competency System** — a Firestore-backed record that updates each time a student completes a problem, storing a running average score and attempt count per subskill.

These systems are not connected. The competency record stores a flat average (e.g., "subskill A: score 9.67, 12 attempts") with no distinction between lesson-mode evaluations and practice-mode evaluations, no lifecycle stage tracking, and no mechanism for the planner to determine whether a student has truly mastered a subskill or merely been exposed to it.

This PRD defines the integration architecture: a **completion factor model** that introduces mastery gates, dual-mode eval tagging, and an actuarial forecasting layer that allows the planner to enforce mastery-before-advancement and forecast student workload.

---

## 2. Core Design Principles

**2.1. Mastery before advancement.** A student does not advance past a subskill until they have demonstrated durable mastery through initial evaluation and three spaced retests. This is the default behavior with no exceptions other than the dependency bottleneck case defined in Section 7.

**2.2. Two learning modes, one lifecycle.** Lesson mode (integrated instructional material with embedded evaluations) and practice mode (focused practice questions only) serve different pedagogical functions but write to the same mastery lifecycle. Lesson-mode evals can satisfy initial mastery. Practice-mode evals satisfy retest gates.

**2.3. Completion is earned, not given.** The completion factor is an actuarial metric that adjusts per-gate credit based on the student's observed pass rate. Students who fail retests don't just retry — their expected workload increases because each successful pass is worth less.

**2.4. Don't break what works.** The existing competency record (running averages, credibility metrics, dashboard analytics) remains unchanged. The mastery lifecycle is a new parallel document that the planner reads.

---

## 3. Mastery Lifecycle Model

### 3.1 Gate Structure

Each subskill follows a 4-gate mastery lifecycle:

| Gate | Name | Source | Requirement | Credit (Base) |
|------|------|--------|-------------|---------------|
| 0 | Not Started | — | — | 0% |
| 1 | Initial Mastery | Lesson Mode | Score ≥ 90% with sufficient lesson exposure | 25% |
| 2 | Retest 1 | Practice Mode | Score ≥ 90% on spaced practice eval | 25% |
| 3 | Retest 2 | Practice Mode | Score ≥ 90% on spaced practice eval | 25% |
| 4 | Retest 3 | Practice Mode | Score ≥ 90% on spaced practice eval | 25% |

A student at Gate 4 with 100% completion is considered to have **durable mastery** of the subskill.

### 3.2 Mastery Threshold

The mastery bar is **90%** at every gate. This is uniform — there is no reduced threshold for initial mastery or elevated threshold for later retests.

### 3.3 Gate Transitions

- **Gate 0 → 1:** Achieved when the student scores ≥ 90% on a lesson-mode evaluation for this subskill. The student must have completed the instructional material before the evaluation counts.
- **Gate 1 → 2, 2 → 3, 3 → 4:** Achieved when the student scores ≥ 90% on a practice-mode evaluation after the spaced retest interval has elapsed.
- **Failed retest:** The student remains at their current gate. The completion factor is recalculated (see Section 4). The retest interval resets to the shortest interval for the current gate.

---

## 4. Completion Factor Calculation

### 4.1 Base Model

In the ideal case (student passes every evaluation), completion is simple:

```
completion_pct = gates_passed × 25%
```

4 passes = 100%. Done.

### 4.2 Adjusted Model (Actuarial Completion Factor)

When a student fails retests, the system adjusts the credit awarded per successful pass based on the student's observed reliability for that subskill.

**Definitions:**

- `passes` = count of practice evals scoring ≥ 90% for this subskill
- `fails` = count of practice evals scoring < 90% for this subskill
- `pass_rate` = passes / (passes + fails)
- `credit_per_pass` = pass_rate × 25%
- `completion_pct` = passes × credit_per_pass
- `completion_pct` is capped at 100%

**Examples:**

| Student Profile | Pass Rate | Credit/Pass | Passes to Complete | Expected Total Attempts |
|----------------|-----------|-------------|-------------------|------------------------|
| Strong learner | 100% | 25.0% | 4 | 4 |
| Solid learner | 80% | 20.0% | 5 | ~6 |
| Developing learner | 70% | 17.5% | ~6 | ~9 |
| Struggling learner | 40% | 10.0% | 10 | 25 |

**Expected total attempts** = passes needed to complete / pass_rate, which gives the planner a workload forecast.

### 4.3 Credibility Blending

A student's subskill-level pass rate may not be credible in the early stages (only 1–3 attempts). To avoid overreacting to small samples, the pass rate is blended with the student's global practice pass rate using a credibility weight:

```
Z = min(subskill_attempts / credibility_standard, 1.0)
blended_pass_rate = Z × subskill_pass_rate + (1 - Z) × global_pass_rate
```

Where `credibility_standard` = 10 (consistent with existing subskill credibility thresholds).

A student with 2 subskill attempts and a 50% subskill pass rate but an 80% global pass rate will have a blended rate much closer to 80%, preventing premature workload inflation.

### 4.4 Initial Mastery Gate

Gate 1 (initial mastery) is evaluated differently. It is satisfied by lesson-mode performance and does not participate in the pass/fail accounting for the completion factor. The completion factor and pass rate calculations apply only to practice-mode retest gates (Gates 2–4). However, the 25% base credit for Gate 1 is still awarded upon clearing it.

---

## 5. Spaced Retest Intervals

### 5.1 Interval Schedule

After clearing each gate, the next retest is scheduled at an increasing interval:

| Transition | Base Interval | After Failed Retest |
|------------|--------------|-------------------|
| Gate 1 → Retest 1 | 3 days | Reset to 3 days |
| Gate 2 → Retest 2 | 7 days | Reset to 3 days |
| Gate 3 → Retest 3 | 14 days | Reset to 7 days |

### 5.2 Interval Behavior

- The retest interval is the **minimum** time before the planner will schedule a practice eval for this subskill. The planner may schedule it later if higher-priority items exist.
- A failed retest resets the interval to a shorter value (see table above), ensuring the student revisits the material sooner.
- A passed retest advances the gate and sets the next (longer) interval.
- The planner stores `next_retest_eligible` as an ISO timestamp. It does not schedule a retest before this time.

---

## 6. Data Model Changes

### 6.1 Eval Event Tagging (Required Change)

Every evaluation event emitted by lesson mode or practice mode must include a `source` field.

**Current eval event shape:**
```json
{
  "student_id": "stu_001",
  "subskill_id": "COUNT-001-01-A",
  "score": 9.2,
  "timestamp": "2026-02-28T10:30:00Z"
}
```

**Required eval event shape:**
```json
{
  "student_id": "stu_001",
  "subskill_id": "COUNT-001-01-A",
  "score": 9.2,
  "timestamp": "2026-02-28T10:30:00Z",
  "source": "lesson | practice"
}
```

This is the **minimum viable change** to the existing eval pipeline. No other fields in the existing event need to change.

### 6.2 Mastery Lifecycle Document (New)

A new Firestore document per student per subskill, stored in a `mastery_lifecycle` collection.

**Path:** `mastery_lifecycle/{student_id}_{subskill_id}`

```json
{
  "student_id": "stu_001",
  "subskill_id": "COUNT-001-01-A",

  "current_gate": 2,
  "completion_pct": 0.45,

  "passes": 2,
  "fails": 1,
  "subskill_pass_rate": 0.667,
  "blended_pass_rate": 0.743,
  "credit_per_pass": 0.186,

  "estimated_remaining_attempts": 4,

  "next_retest_eligible": "2026-03-07T10:30:00Z",
  "retest_interval_days": 7,

  "gate_history": [
    {
      "gate": 1,
      "timestamp": "2026-02-20T14:00:00Z",
      "score": 9.5,
      "passed": true,
      "source": "lesson"
    },
    {
      "gate": 2,
      "timestamp": "2026-02-25T09:00:00Z",
      "score": 7.8,
      "passed": false,
      "source": "practice"
    },
    {
      "gate": 2,
      "timestamp": "2026-02-28T10:30:00Z",
      "score": 9.2,
      "passed": true,
      "source": "practice"
    }
  ],

  "created_at": "2026-02-20T14:00:00Z",
  "updated_at": "2026-02-28T10:30:00Z"
}
```

### 6.3 Existing Competency Record (No Change)

The existing competency document continues to store running averages, total attempts, and credibility scores. It is updated on every eval event regardless of source. The mastery lifecycle document is updated in parallel.

### 6.4 Global Pass Rate (Student-Level Aggregate)

A student-level document (or field on the student profile) that tracks the student's overall practice pass rate across all subskills:

**Path:** `students/{student_id}` (add fields to existing document)

```json
{
  "global_practice_passes": 47,
  "global_practice_fails": 12,
  "global_practice_pass_rate": 0.797
}
```

Updated on every practice-mode eval event. Used for credibility blending in Section 4.3.

---

## 7. Planner Integration

### 7.1 Core Planner Rule

The planner enforces a strict prerequisite check: **do not recommend a subskill whose prerequisites have `current_gate < 4`.**

When selecting the next curriculum item, the planner:

1. Checks all subskills with pending retests where `next_retest_eligible ≤ now`. These are highest priority — schedule a practice eval.
2. If no retests are due, looks for the next subskill in the curriculum sequence whose prerequisites are all at Gate 4 (complete). Schedule lesson mode for initial exposure.
3. If no subskill is eligible under rule 2, the student is in a **dependency bottleneck** (see 7.2).

### 7.2 Dependency Bottleneck (Special Case)

A dependency bottleneck occurs when every available next subskill in the curriculum is blocked by incomplete prerequisites, and no retests are currently due.

In this case, the planner relaxes the prerequisite constraint using the following priority:

1. Select the blocked subskill whose prerequisite has the highest `completion_pct` (closest to complete).
2. If multiple are tied, prefer the subskill with the fewest remaining prerequisite gates.
3. Flag this recommendation with `bottleneck: true` so analytics can track how often this occurs.

This should be rare in a well-structured curriculum with sufficient breadth. If it occurs frequently, it indicates the curriculum sequencing needs revision (too linear, not enough parallel paths).

### 7.3 Planner Scheduling Priority

When multiple actions are available, the planner prioritizes:

1. **Overdue retests** — practice evals where `next_retest_eligible` has already passed
2. **Due retests** — practice evals where `next_retest_eligible ≤ now`
3. **New subskill introduction** — lesson mode for the next curriculum item with all prerequisites complete
4. **Bottleneck advancement** — the relaxed prerequisite case

### 7.4 Workload Forecasting

The planner uses the completion factor to generate forecasts at the unit and subject level:

- **Subskill ETA** = `estimated_remaining_attempts × average_days_between_attempts`
- **Unit ETA** = max(subskill ETAs within unit), since the unit isn't complete until all subskills are
- **Subject ETA** = sum of sequential unit ETAs (accounting for prerequisite chains)

These forecasts are for the parent dashboard and curriculum pacing analytics. They do not affect the planner's scheduling logic.

---

## 8. Competency Service Changes

### 8.1 Updated Eval Processing Flow

When the competency service receives an eval event:

```
receive_eval_event(event):
  
  1. Update existing competency record (no change to current logic)
     → running average, total attempts, credibility
  
  2. Route to lifecycle update based on source:
     
     IF event.source == "lesson":
       → Check if student is at Gate 0 for this subskill
       → If yes AND score ≥ 9.0: advance to Gate 1
       → Set next_retest_eligible = now + 3 days
       → Award 25% base completion credit
     
     IF event.source == "practice":
       → Check if student is at Gate 1, 2, or 3
       → Check if next_retest_eligible ≤ event.timestamp
       → If retest is eligible:
           IF score ≥ 9.0:
             → Record pass, advance gate
             → Update pass_rate, credit_per_pass, completion_pct
             → Set next_retest_eligible based on new gate interval
           ELSE:
             → Record fail
             → Update pass_rate, credit_per_pass, completion_pct
             → Reset retest interval to failed-retest value
       → Update global_practice_pass_rate on student document
  
  3. Append to gate_history
```

### 8.2 Score Threshold

The mastery threshold is a score of **9.0 out of 10.0** (90%). All gate evaluations use this threshold uniformly.

### 8.3 Practice Evals Before Retest Eligibility

If a student completes a practice eval for a subskill before `next_retest_eligible`, the eval is recorded in the competency record (running average) but **does not count** toward the mastery lifecycle. The student must wait for the retest interval to elapse. This prevents gaming the system by rapid-firing practice attempts.

---

## 9. Analytics & Reporting

### 9.1 Student Dashboard Metrics

The following metrics should be available per student:

- **Completion by subskill:** Visual indicator showing gate progress (0/4, 1/4, 2/4, etc.)
- **Completion by skill/unit/subject:** Aggregated from underlying subskill completion percentages
- **Estimated time to unit completion:** Based on workload forecasting (Section 7.4)
- **Pass rate trend:** Student's practice pass rate over time, showing improvement or regression

### 9.2 Parent Dashboard Metrics

- **Overall curriculum completion:** Weighted by the completion factor, not just exposure
- **Pacing forecast:** "At current pace, [student] is expected to complete [unit] by [date]"
- **Reliability indicator:** A simple signal (e.g., "strong retention" / "needs reinforcement") derived from the global pass rate

### 9.3 System Health Metrics

- **Bottleneck frequency:** How often the planner triggers the dependency bottleneck case
- **Average gates to completion:** Should be close to 4 for strong learners; higher values indicate curriculum difficulty or student struggles
- **Retest interval distribution:** Whether retests are happening on schedule or being delayed by other priorities

---

## 10. Migration & Rollout

### 10.1 Phase 1: Eval Tagging

Add the `source` field to all eval events. This is backward-compatible — the existing competency service ignores it. Deploy and verify that both lesson and practice modes are correctly tagging events.

### 10.2 Phase 2: Lifecycle Document

Deploy the mastery lifecycle document and the updated competency service routing logic. For existing students with historical data, initialize lifecycle documents conservatively:

- Subskills with average score ≥ 90% and credibility ≥ 10: set to Gate 1 (initial mastery assumed)
- All others: set to Gate 0
- No retroactive retest credit — students earn retest gates going forward

### 10.3 Phase 3: Planner Integration

Wire the planner to read lifecycle state. Enable the gate-blocking prerequisite check and the retest scheduling logic. Monitor bottleneck frequency to validate curriculum sequencing.

### 10.4 Phase 4: Forecasting & Dashboards

Add completion factor forecasting to the parent dashboard. Surface estimated completion dates and reliability indicators.

---

## 11. Open Questions

1. **Should the initial mastery gate (Gate 1) require a minimum number of lesson-mode attempts before the 90% threshold is evaluated?** A student who scores 10/10 on their very first lesson problem technically clears Gate 1, but this may not represent sufficient exposure. Consider requiring a minimum of 3–5 lesson evals before Gate 1 can be cleared.

2. **Should the completion factor ever reset?** If a student is away for an extended period (e.g., summer break), should their pass rate be decayed or recalculated? The current model is memoryless about time gaps.

3. **Per-subskill vs per-skill completion blocking:** The current model blocks at the subskill level. Should there be a skill-level gate as well (e.g., "80% of subskills in this skill must be complete before advancing to the next skill")? This adds curriculum pacing control but increases complexity.

4. **Retest content variation:** Should practice retests for the same subskill present different problems than the initial evaluation, or can they reuse problems from the same pool? Different problems test transfer; same problems test retention. Both are valid but serve different pedagogical goals.
