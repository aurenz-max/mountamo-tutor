# Lumina Daily Activities Service — Product Requirements Document

**Author:** Chris
**Date:** February 27, 2026
**Status:** Draft

---

## 1. Overview

The Daily Activities Service is a new real-time planning engine for Lumina that determines what each student should work on at weekly and daily granularity. It operates exclusively on Firestore data, replacing the current dependency on BigQuery nightly ETL for recommendation logic.

BigQuery remains the system of record for longitudinal analytics, cross-student reporting, and curriculum design insights. It continues to receive data via nightly ETL but is no longer in the critical path for student-facing planning decisions.

### 1.1 Problem Statement

The current architecture routes all student activity data through a nightly ETL into BigQuery before it can inform recommendations. This creates three problems:

1. **Staleness** — Recommendations are up to 24 hours behind the student's actual state.
2. **Iteration friction** — Adding a new data dimension (e.g., a new primitive type or eval metric) requires modifying the ETL pipeline before the signal can influence planning.
3. **Scalability** — The ETL was never designed to answer per-student, per-session questions. It was designed for aggregate analysis.

### 1.2 Solution

A two-endpoint on-demand service that reads directly from Firestore, where three foundational datasets now live natively:

- **Curriculum** — The full skill inventory per subject, with sequencing.
- **Student Competency State** — Mastery status, review history, and completion factors per skill.
- **Knowledge Graph** — Prerequisite relationships and concept dependencies between skills.

Given these three inputs, the service can resolve "what should this student do this week?" and "what should this student do right now?" without leaving Firestore.

---

## 2. Architecture

### 2.1 System Boundaries

```
┌─────────────────────────────────────────────────────────┐
│  REAL-TIME PATH (Firestore)                             │
│                                                         │
│  Student completes session                              │
│       ↓                                                 │
│  Eval results write to Firestore                        │
│       ↓                                                 │
│  Competency state document updates                      │
│       ↓                                                 │
│  Weekly/Daily endpoints read live state on demand        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  BATCH PATH (BigQuery) — unchanged                      │
│                                                         │
│  Nightly ETL pulls from Firestore                       │
│       ↓                                                 │
│  Cross-student analytics, progress dashboards,          │
│  curriculum effectiveness reports                       │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Data Dependencies

| Dataset | Location | Updated By | Read By |
|---------|----------|------------|---------|
| Curriculum | Firestore `curriculum/{subjectId}` | Admin / curriculum builder | Weekly Planner |
| Student Competency State | Firestore `studentCompetencyState/{studentId}` | Session completion handler | Weekly Planner, Daily Planner |
| Knowledge Graph | Firestore `knowledgeGraph/{subjectId}` | Admin / curriculum builder | Daily Planner |
| School Year Config | Firestore `config/schoolYear` | Admin | Weekly Planner |
| Activity Log | Firestore `activityLog/{studentId}/sessions/{sessionId}` | Session completion handler | Daily Planner |

---

## 3. Review Engine — The Completion Factor Model

The review engine is the core scheduling algorithm. It is modeled after the actuarial chain ladder method: each skill, once initially mastered, carries a future review liability. The system tracks how much of that liability has been fulfilled (the completion factor) and uses aggregate reserve calculations to forecast review burden and constrain new skill introduction.

### 3.1 Mastery Definition

A student achieves **initial mastery** of a skill when they score **90%+** on an assessment. This transitions the skill from "learning" to "review pipeline."

### 3.2 Standard Review Schedule

Once a skill enters the review pipeline, it follows a minimum session schedule with expanding intervals:

| Session | Timing | Purpose |
|---------|--------|---------|
| Session 0 | Initial mastery | Skill enters pipeline |
| Session 1 | +2 weeks | First retention check |
| Session 2 | +4 weeks from Session 0 | Medium-term retention |
| Session 3 | +6 weeks from Session 0 | Long-term retention |

If the student scores **90%+** on all three review sessions, the skill is **closed** (fully complete). The standard ultimate is **4 total sessions**.

### 3.3 Failure Handling — Tight Loop Recovery

When a student scores below 90% on a review session, they enter a tight recovery loop:

**On any review score < 90%:**

1. Schedule a **sooner repeat** — re-assess the same skill in approximately 1 week.
2. If the student scores 90%+ on the repeat, they must **prove stability** by passing two additional reviews at 2-week intervals.
3. If the student fails the repeat, they stay in the tight loop (1-week intervals) until they pass.

**Example — Single failure at Session 2:**

```
Session 0: Initial mastery (90%+)
Session 1: +2 weeks  → 92% ✓
Session 2: +4 weeks  → 82% ✗  ← failure
Session 3: +1 week   → 91% ✓  ← tight loop recovery
Session 4: +2 weeks  → 90% ✓  ← prove stability
Session 5: +2 weeks  → 93% ✓  ← CLOSED
Ultimate: 6 sessions over ~9 weeks
```

**Example — Multiple failures:**

```
Session 0: Initial mastery (90%+)
Session 1: +2 weeks  → 90% ✓
Session 2: +4 weeks  → 78% ✗
Session 3: +1 week   → 75% ✗  ← still in tight loop
Session 4: +1 week   → 84% ✗  ← still in tight loop
Session 5: +1 week   → 92% ✓  ← recovered
Session 6: +2 weeks  → 90% ✓  ← prove stability
Session 7: +2 weeks  → 91% ✓  ← CLOSED
Ultimate: 8 sessions over ~13 weeks
```

### 3.4 Completion Factor Calculation

At any point in a skill's lifecycle:

```
completionFactor = sessionsCompleted / estimatedUltimate
```

The **estimated ultimate** starts at 4 (the standard minimum) and increases by 1 for each failure. It is never revised downward.

| Event | Ultimate Change | Example |
|-------|----------------|---------|
| Initial mastery | Set to 4 | 4 |
| Pass review (90%+) | No change | 4 |
| Fail review (<90%) | +1 | 5 |
| Fail again | +1 | 6 |

**Critical property:** A failure can cause the completion factor to *decrease* even though the student has done more work. This is directly analogous to adverse loss development in insurance — emergence was worse than expected, so the reserve increases.

```
Example:
After Session 1 (pass):   2/4 = 0.50
After Session 2 (fail):   3/5 = 0.60  ← ultimate revised up
  vs. expected if passed:  3/4 = 0.75
```

### 3.5 Student-Specific Development Patterns

Over time, each student accumulates a history of skill closures. Their average actual ultimate by subject becomes a personalized development pattern:

```
// Strong reader, weaker at math:
studentPatterns: {
  math: { averageUltimate: 5.8, skillsClosed: 24 },
  reading: { averageUltimate: 4.2, skillsClosed: 31 },
  engineering: { averageUltimate: 4.5, skillsClosed: 8 }
}
```

This pattern is used to estimate the ultimate for newly opened skills in that subject, improving reserve accuracy.

### 3.6 Reserve Calculation

The **total review reserve** is the aggregate future session liability across all open (non-closed) skills:

```
totalReviewReserve = Σ (estimatedUltimate - sessionsCompleted)
                     for all skills where status ≠ "closed"
```

The **projected daily review load** smooths this over the expected runoff period:

```
projectedDailyReviews = count of skills with nextReviewDate within next 7 days / 7
```

The **sustainable new skill introduction rate** is what remains after accounting for reviews:

```
sustainableNewPerDay = dailySessionCapacity - projectedDailyReviews
```

If `sustainableNewPerDay` is low or negative, the student is over-committed and the system must prioritize reviews over new material. This happens naturally — no manual intervention or threshold required.

---

## 4. Weekly Planner Endpoint

### 4.1 Endpoint

```
GET /api/plan/weekly/{studentId}
```

### 4.2 Purpose

The weekly planner is a **pacing engine**. It answers: "Is this student on track to complete the curriculum by year-end, and if not, what's the gap per subject?"

### 4.3 Inputs

- Curriculum (total skills per subject)
- Student competency state (mastered skills, open skills, review reserves)
- School year config (start date, end date, scheduled breaks)
- Student development patterns (average ultimates by subject)

### 4.4 Logic

```
for each subject:
  totalSkills         = curriculum[subject].skills.length
  closedSkills        = skills where status == "closed"
  inPipelineSkills    = skills where status == "in_review"
  notStartedSkills    = totalSkills - closedSkills - inPipelineSkills

  fractionOfYearElapsed = (today - yearStart) / (yearEnd - yearStart)
  expectedByNow        = totalSkills * fractionOfYearElapsed
  behindBy             = max(0, expectedByNow - closedSkills - inPipelineSkills)

  weeksRemaining       = calcSchoolWeeksRemaining(today, yearEnd, breaks)
  remainingToIntroduce = notStartedSkills
  weeklyNewTarget      = ceil(remainingToIntroduce / weeksRemaining)

  // Factor in review burden
  subjectReviewReserve = Σ (ultimate - completed) for open skills in this subject
  avgUltimate          = studentPattern[subject].averageUltimate or 4
  projectedReviewCost  = weeklyNewTarget * avgUltimate  // future liability of this week's new skills
```

### 4.5 Response Schema

```json
{
  "studentId": "student_abc",
  "weekOf": "2026-03-02",
  "schoolYear": {
    "start": "2025-08-25",
    "end": "2026-05-29",
    "fractionElapsed": 0.52,
    "weeksRemaining": 14
  },
  "dailySessionCapacity": 25,
  "sustainableNewPerDay": 4,
  "subjects": {
    "math": {
      "totalSkills": 120,
      "closed": 34,
      "inReview": 18,
      "notStarted": 68,
      "expectedByNow": 62,
      "behindBy": 10,
      "weeklyNewTarget": 5,
      "reviewReserve": 52,
      "avgUltimate": 5.4
    },
    "reading": {
      "totalSkills": 80,
      "closed": 40,
      "inReview": 8,
      "notStarted": 32,
      "expectedByNow": 42,
      "behindBy": 0,
      "weeklyNewTarget": 3,
      "reviewReserve": 22,
      "avgUltimate": 4.1
    },
    "engineering": {
      "totalSkills": 40,
      "closed": 8,
      "inReview": 5,
      "notStarted": 27,
      "expectedByNow": 21,
      "behindBy": 8,
      "weeklyNewTarget": 2,
      "reviewReserve": 16,
      "avgUltimate": 4.5
    }
  }
}
```

---

## 5. Daily Planner Endpoint

### 5.1 Endpoint

```
GET /api/plan/daily/{studentId}
```

### 5.2 Purpose

The daily planner is a **session router**. It answers: "Given the weekly targets and the student's current state, what specific skills should be served today, in what order?"

### 5.3 Inputs

- Weekly plan targets (from weekly planner logic, computed inline or cached)
- Student competency state (review schedules, completion factors)
- Knowledge graph (prerequisite relationships)
- Activity log for current week (what has already been completed this week)

### 5.4 Logic

```
Step 1: Build the review queue
  For each skill in review pipeline:
    if nextReviewDate <= today:
      add to reviewQueue
  Sort reviewQueue by:
    - Days overdue (most overdue first)
    - Number of downstream dependents in knowledge graph (higher = more critical)
    - Whether skill is in tight loop recovery (prioritize these)

Step 2: Determine remaining capacity for new skills
  completedThisWeek     = activityLog for current week, grouped by subject
  reviewsDueToday       = reviewQueue.length
  remainingCapacity     = dailySessionCapacity - reviewsDueToday
  
  // Safety cap: always leave at least some room for new skills
  maxReviewSlots        = floor(dailySessionCapacity * 0.85)
  actualReviewSlots     = min(reviewsDueToday, maxReviewSlots)
  newSkillSlots         = dailySessionCapacity - actualReviewSlots

Step 3: Select new skills from knowledge graph
  For each subject, proportional to weekly target deficit:
    subjectNewTarget    = weeklyNewTarget - newSkillsCompletedThisWeek[subject]
    subjectSlots        = allocate newSkillSlots proportionally

    candidates = knowledgeGraph[subject]
      .filter(skill => all prerequisites are closed or in stable review)
      .filter(skill => status == "not_started")
      .sort(by curriculum sequence)
      .slice(0, subjectSlots)

Step 4: Merge and prioritize
  dailyPlan = [
    ...reviewQueue (flagged as review, with tight-loop items first),
    ...newSkills (flagged as new, ordered by subject pacing pressure)
  ]
```

### 5.5 Response Schema

```json
{
  "studentId": "student_abc",
  "date": "2026-03-04",
  "dayOfWeek": "Wednesday",
  "capacity": 25,
  "reviewSlots": 16,
  "newSlots": 9,
  "weekProgress": {
    "math": { "newTarget": 5, "newCompleted": 1, "reviewsCompleted": 8 },
    "reading": { "newTarget": 3, "newCompleted": 2, "reviewsCompleted": 3 },
    "engineering": { "newTarget": 2, "newCompleted": 0, "reviewsCompleted": 2 }
  },
  "sessions": [
    {
      "skillId": "math_sub_borrowing",
      "subject": "math",
      "skillName": "Subtraction with Borrowing",
      "type": "review",
      "reason": "tight_loop_recovery",
      "priority": 1,
      "reviewSession": 4,
      "estimatedUltimate": 6,
      "completionFactor": 0.67,
      "daysOverdue": 2
    },
    {
      "skillId": "math_mult_2digit",
      "subject": "math",
      "skillName": "2-Digit Multiplication",
      "type": "review",
      "reason": "scheduled_review",
      "priority": 2,
      "reviewSession": 2,
      "estimatedUltimate": 4,
      "completionFactor": 0.50,
      "daysOverdue": 0
    },
    {
      "skillId": "eng_simple_machines_lever",
      "subject": "engineering",
      "skillName": "Simple Machines: Lever",
      "type": "new",
      "reason": "behind_pace",
      "priority": 3,
      "prerequisitesMet": true
    },
    {
      "skillId": "math_division_intro",
      "subject": "math",
      "skillName": "Introduction to Division",
      "type": "new",
      "reason": "next_in_sequence",
      "priority": 4,
      "prerequisitesMet": true
    }
  ]
}
```

---

## 6. Firestore Data Model

### 6.1 Student Competency State

```
Collection: studentCompetencyState/{studentId}

Document fields:
{
  dailySessionCapacity: 25,
  developmentPatterns: {
    math: { averageUltimate: 5.4, skillsClosed: 24, totalSessions: 138 },
    reading: { averageUltimate: 4.1, skillsClosed: 31, totalSessions: 130 },
    engineering: { averageUltimate: 4.5, skillsClosed: 8, totalSessions: 38 }
  },
  aggregateMetrics: {
    totalReviewReserve: 90,
    projectedDailyReviewLoad: 16,
    sustainableNewPerDay: 4,
    lastRecalculated: Timestamp
  },
  lastUpdated: Timestamp
}
```

### 6.2 Skill Status (Subcollection)

```
Collection: studentCompetencyState/{studentId}/skills/{skillId}

Document fields:
{
  subject: "math",
  skillName: "Subtraction with Borrowing",
  status: "in_review",          // not_started | learning | in_review | closed
  firstIntroduced: Timestamp,
  initialMasteryDate: Timestamp, // when they first scored 90%+

  // Review tracking
  reviewHistory: [
    { date: Timestamp, score: 0.92, session: 1, passed: true },
    { date: Timestamp, score: 0.82, session: 2, passed: false },
    { date: Timestamp, score: 0.91, session: 3, passed: true }
  ],
  sessionsCompleted: 4,         // includes initial mastery session
  estimatedUltimate: 6,         // started at 4, +1 per failure
  completionFactor: 0.67,       // 4/6

  // Scheduling
  nextReviewDate: Timestamp,
  inTightLoop: true,            // currently in failure recovery
  tightLoopPassesNeeded: 2,     // 90%+ passes remaining before resuming normal intervals

  // Closure
  closedDate: null              // set when completionFactor reaches 1.0
}
```

### 6.3 School Year Config

```
Document: config/schoolYear

{
  startDate: "2025-08-25",
  endDate: "2026-05-29",
  breaks: [
    { name: "Thanksgiving", start: "2025-11-24", end: "2025-11-28" },
    { name: "Winter", start: "2025-12-20", end: "2026-01-05" },
    { name: "Spring", start: "2026-03-16", end: "2026-03-20" }
  ],
  schoolDaysPerWeek: 5
}
```

---

## 7. Post-Session Update Flow

When a student completes an assessment session, the following updates occur:

```
1. Write eval results to activityLog/{studentId}/sessions/{sessionId}

2. Update skill document in studentCompetencyState/{studentId}/skills/{skillId}:
   a. Append to reviewHistory
   b. Increment sessionsCompleted
   c. If score >= 90%:
      - If inTightLoop: decrement tightLoopPassesNeeded
        - If tightLoopPassesNeeded == 0: set inTightLoop = false, schedule next at +2 weeks
        - Else: schedule next at +2 weeks
      - If not inTightLoop: schedule next per standard intervals
      - If final session in schedule: set status = "closed", closedDate = now
   d. If score < 90%:
      - Increment estimatedUltimate by 1
      - Set inTightLoop = true
      - Set tightLoopPassesNeeded = 2
      - Schedule next at +1 week
   e. Recalculate completionFactor

3. Update student-level aggregate metrics:
   a. Recalculate totalReviewReserve
   b. Recalculate projectedDailyReviewLoad
   c. Update developmentPatterns for the subject (rolling average ultimate)
```

---

## 8. Edge Cases and Constraints

### 8.1 Capacity Overload

When `projectedDailyReviews > dailySessionCapacity`, the student cannot keep up with reviews. The system should:

- Prioritize reviews by overdue days and downstream dependency count.
- Set `sustainableNewPerDay = 0` — no new skills until review backlog clears.
- Surface this state in the weekly planner response as a warning.

### 8.2 Year-End Crunch

When `remainingSkills / weeksRemaining` exceeds what is sustainable given the review reserve, the system should:

- Report the gap clearly in the weekly planner.
- Not silently drop review quality to cram new skills — the integrity of the completion factor model depends on reviews happening on schedule.
- Let the parent (Chris) decide whether to extend the year, reduce scope, or increase daily capacity.

### 8.3 Knowledge Graph Bottlenecks

If a prerequisite skill is stuck in tight-loop recovery, all downstream skills are blocked. The daily planner should:

- Identify and surface these bottleneck skills.
- Prioritize them in the review queue (they have high downstream dependency counts).
- Suggest alternative paths through the knowledge graph if available.

### 8.4 New Curriculum or Primitives Added Mid-Year

Because the service reads directly from Firestore, new skills or subjects added to the curriculum are immediately visible to the planner. No ETL changes required. The weekly planner will automatically adjust targets based on the new total skill count.

---

## 9. What BigQuery Still Handles

The nightly ETL and BigQuery remain responsible for:

- Cross-student aggregate analysis (e.g., which skills have the highest failure rates across all students)
- Longitudinal progress reports for parents
- Curriculum effectiveness metrics (e.g., average ultimate by skill — identifying poorly designed assessments)
- Development pattern benchmarking (comparing a student's pattern to cohort averages)

None of these workloads are latency-sensitive or student-session-blocking.

---

## 10. Success Metrics

| Metric | Target |
|--------|--------|
| Recommendation latency | < 500ms for daily plan generation |
| Data freshness | Real-time (no ETL delay) |
| Iteration cycle for new dimensions | Code deploy only, no pipeline changes |
| Review adherence | 95%+ of scheduled reviews served on the scheduled day |
| Pacing accuracy | Weekly targets within 10% of achievable given actual capacity |

---

## 11. Implementation Phases

### Phase 1: Weekly Planner

- Implement `GET /api/plan/weekly/{studentId}`
- Read from curriculum, competency state, and school year config
- Return pacing targets per subject with behind/ahead indicators

### Phase 2: Review Engine

- Implement post-session update flow (Section 7)
- Build completion factor tracking and tight-loop recovery logic
- Calculate and maintain reserve metrics on competency state documents

### Phase 3: Daily Planner

- Implement `GET /api/plan/daily/{studentId}`
- Integrate review queue, knowledge graph traversal, and pacing targets
- Return prioritized session queue

### Phase 4: Monitoring and Tuning

- Surface capacity overload and bottleneck warnings
- Build feedback loop: compare predicted ultimates to actual closures
- Tune development pattern estimates as student history accumulates
