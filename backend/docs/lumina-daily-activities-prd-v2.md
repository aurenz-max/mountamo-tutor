# Lumina Daily Activities Service — Product Requirements Document

**Author:** Chris
**Date:** February 28, 2026
**Status:** Draft v2

---

## 1. Overview

The Daily Activities Service is a new real-time planning engine for Lumina that determines what each student should work on at monthly, weekly, and daily granularity. It operates exclusively on Firestore data, replacing the current dependency on BigQuery nightly ETL for recommendation logic.

BigQuery remains the system of record for longitudinal analytics, cross-student reporting, and curriculum design insights. It continues to receive data via nightly ETL but is no longer in the critical path for student-facing planning decisions.

### 1.1 Problem Statement

The current architecture routes all student activity data through a nightly ETL into BigQuery before it can inform recommendations. This creates three problems:

1. **Staleness** — Recommendations are up to 24 hours behind the student's actual state.
2. **Iteration friction** — Adding a new data dimension (e.g., a new primitive type or eval metric) requires modifying the ETL pipeline before the signal can influence planning.
3. **Scalability** — The ETL was never designed to answer per-student, per-session questions. It was designed for aggregate analysis.

### 1.2 Solution

A three-tier on-demand planning service that reads directly from Firestore, where three foundational datasets now live natively:

- **Curriculum** — The full skill inventory per subject, with sequencing.
- **Student Competency State** — Mastery status, review history, and completion factors per skill.
- **Knowledge Graph** — Prerequisite relationships and concept dependencies between skills.

Given these three inputs, the service can resolve "where will this student be in 8 weeks?", "what should this student do this week?", and "what should this student do right now?" without leaving Firestore.

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
│  Monthly/Weekly/Daily endpoints read live state          │
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
| Curriculum | Firestore `curriculum/{subjectId}` | Admin / curriculum builder | All planners |
| Student Competency State | Firestore `studentCompetencyState/{studentId}` | Session completion handler | All planners |
| Knowledge Graph | Firestore `knowledgeGraph/{subjectId}` | Admin / curriculum builder | Daily Planner |
| School Year Config | Firestore `config/schoolYear` | Admin | Weekly and Monthly Planners |
| Activity Log | Firestore `activityLog/{studentId}/sessions/{sessionId}` | Session completion handler | Daily Planner |
| Parent Overrides | Firestore `overrides/{studentId}` | Parent (admin UI) | All planners |

---

## 3. Review Engine — The Completion Factor Model

The review engine is the core scheduling algorithm. It is modeled after the actuarial chain ladder method: each skill, once initially mastered, carries a future review liability. The system tracks how much of that liability has been fulfilled (the completion factor) and uses aggregate reserve calculations to forecast review burden and constrain new skill introduction.

### 3.1 Mastery Definition

A student achieves **initial mastery** of a skill when they score **90%+** on a mastery quiz (see Section 9: Statistical Mastery Framework). This transitions the skill from "learning" to "review pipeline."

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

**Cold Start:** When a student is new or a subject has fewer than 5 closed skills, use a prior of 5.0 (slightly pessimistic). Update via credibility-weighted blending as data accumulates:

```
credibility = min(1.0, skillsClosed / 10)
estimatedUltimate = credibility * observedAvgUltimate + (1 - credibility) * 5.0
```

After 10 closures, the estimate is fully driven by the student's own data.

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

## 4. Monthly Planner Endpoint

### 4.1 Endpoint

```
GET /api/plan/monthly/{studentId}
```

### 4.2 Purpose

The monthly planner is a **projection model**. It does not assign work — it forecasts where the student will be in 4, 8, and 12 weeks given their current pace, development patterns, and review reserve trajectory. It is the early warning system that surfaces problems weeks before they become crises.

The actuarial analogy: this is a cash flow projection. New skill introductions are premium, skill closures are claim settlements, and the open review pipeline is the outstanding reserve.

### 4.3 Inputs

- Curriculum (total skills per subject)
- Student competency state (all open skills, review schedules, completion factors)
- Student development patterns (average ultimates by subject)
- School year config (remaining weeks, scheduled breaks)
- Parent overrides (any active subject weight modifications or pauses)

### 4.4 Logic — Forward Simulation

The monthly planner runs a week-by-week forward simulation:

```
for each future week w from 1 to weeksRemaining:

  // Estimate reviews due this week
  // Skills with known nextReviewDate landing in week w are exact
  // Skills introduced between now and week w use average interval spacing
  projectedReviewsDue[w] = knownReviewsDue[w]
                         + estimatedReviewsFromNewSkills(w, avgUltimate)

  // Estimate closures this week
  // Skills where projectedSession == ultimate and week aligns
  projectedClosures[w] = skillsProjectedToClose(w)

  // Capacity for new skills
  projectedNewCapacity[w] = weeklyCapacity - projectedReviewsDue[w]
  projectedNewIntroductions[w] = min(projectedNewCapacity[w], pacingTarget)

  // Running totals
  projectedOpenInventory[w] = openInventory[w-1]
                             + projectedNewIntroductions[w]
                             - projectedClosures[w]
  projectedCumulativeMastered[w] = mastered[w-1] + projectedClosures[w]

  // Check for danger signals
  if projectedOpenInventory[w] > dailyCapacity * 5:
    flag("review_overload_projected", week=w)
  if projectedNewCapacity[w] <= 0:
    flag("zero_new_capacity_projected", week=w)
```

**Confidence bands:** Using the variance in the student's actual ultimates, generate optimistic (75th percentile performance) and pessimistic (25th percentile) scenarios alongside the best estimate. This produces three trajectory lines per subject.

### 4.5 Response Schema

```json
{
  "studentId": "student_abc",
  "generatedAt": "2026-03-04T10:00:00Z",
  "schoolYear": {
    "fractionElapsed": 0.52,
    "weeksRemaining": 14
  },
  "projections": {
    "math": {
      "currentState": {
        "total": 120,
        "closed": 34,
        "inReview": 18,
        "notStarted": 68
      },
      "weekByWeek": [
        {
          "week": 1,
          "weekOf": "2026-03-09",
          "projectedReviewsDue": 12,
          "projectedNewIntroductions": 5,
          "projectedClosures": 3,
          "projectedOpenInventory": 20,
          "cumulativeMastered": {
            "optimistic": 40,
            "bestEstimate": 37,
            "pessimistic": 35
          }
        }
      ],
      "endOfYearProjection": {
        "optimistic": { "closed": 118, "remainingGap": 2 },
        "bestEstimate": { "closed": 105, "remainingGap": 15 },
        "pessimistic": { "closed": 92, "remainingGap": 28 }
      },
      "warnings": [
        {
          "type": "review_overload_projected",
          "week": 8,
          "message": "Review burden projected to exceed daily capacity in week of April 27"
        }
      ]
    }
  }
}
```

---

## 5. Weekly Planner Endpoint

### 5.1 Endpoint

```
GET /api/plan/weekly/{studentId}
```

### 5.2 Purpose

The weekly planner is a **pacing engine**. It answers: "Is this student on track to complete the curriculum by year-end, and if not, what's the gap per subject?"

### 5.3 Inputs

- Curriculum (total skills per subject)
- Student competency state (mastered skills, open skills, review reserves)
- School year config (start date, end date, scheduled breaks)
- Student development patterns (average ultimates by subject)
- Parent overrides (subject weight multipliers, pauses)

### 5.4 Logic

```
for each subject:
  // Apply any active parent overrides
  subjectWeight = overrides[subject].weightMultiplier or 1.0
  if overrides[subject].paused: skip subject, weeklyNewTarget = 0

  totalSkills         = curriculum[subject].skills.length
  closedSkills        = skills where status == "closed"
  inPipelineSkills    = skills where status == "in_review"
  notStartedSkills    = totalSkills - closedSkills - inPipelineSkills

  fractionOfYearElapsed = (today - yearStart) / (yearEnd - yearStart)
  expectedByNow        = totalSkills * fractionOfYearElapsed
  behindBy             = max(0, expectedByNow - closedSkills - inPipelineSkills)

  weeksRemaining       = calcSchoolWeeksRemaining(today, yearEnd, breaks)
  remainingToIntroduce = notStartedSkills
  weeklyNewTarget      = ceil(remainingToIntroduce / weeksRemaining) * subjectWeight

  // Factor in review burden
  subjectReviewReserve = Σ (ultimate - completed) for open skills in this subject
  avgUltimate          = studentPattern[subject].averageUltimate or 5.0
  projectedReviewCost  = weeklyNewTarget * avgUltimate
```

### 5.5 Response Schema

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
  "activeOverrides": [
    { "subject": "math", "type": "weight", "multiplier": 2.0, "expiresAt": "2026-03-21" }
  ],
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

## 6. Daily Planner Endpoint

### 6.1 Endpoint

```
GET /api/plan/daily/{studentId}
```

### 6.2 Purpose

The daily planner is a **session router**. It answers: "Given the weekly targets and the student's current state, what specific skills should be served today, in what order?"

### 6.3 Inputs

- Weekly plan targets (from weekly planner logic, computed inline or cached)
- Student competency state (review schedules, completion factors)
- Knowledge graph (prerequisite relationships)
- Activity log for current week (what has already been completed this week)
- Parent overrides (pauses, weight multipliers)

### 6.4 Logic

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

Step 4: Sequence using interleaving rules (see Section 8)

Step 5: Merge and return prioritized session queue
```

### 6.5 Response Schema

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
      "skillId": "eng_simple_machines_lever",
      "subject": "engineering",
      "skillName": "Simple Machines: Lever",
      "type": "new",
      "reason": "behind_pace",
      "priority": 2,
      "prerequisitesMet": true,
      "assessmentConfig": {
        "formativeProblems": 8,
        "masteryQuizProblems": 10,
        "masteryThreshold": 0.90
      }
    },
    {
      "skillId": "reading_inference_context",
      "subject": "reading",
      "skillName": "Inference from Context",
      "type": "review",
      "reason": "scheduled_review",
      "priority": 3,
      "reviewSession": 2,
      "estimatedUltimate": 4,
      "completionFactor": 0.50,
      "daysOverdue": 0
    },
    {
      "skillId": "math_mult_2digit",
      "subject": "math",
      "skillName": "2-Digit Multiplication",
      "type": "review",
      "reason": "scheduled_review",
      "priority": 4,
      "reviewSession": 2,
      "estimatedUltimate": 4,
      "completionFactor": 0.50,
      "daysOverdue": 0
    },
    {
      "skillId": "math_division_intro",
      "subject": "math",
      "skillName": "Introduction to Division",
      "type": "new",
      "reason": "next_in_sequence",
      "priority": 5,
      "prerequisitesMet": true,
      "assessmentConfig": {
        "formativeProblems": 8,
        "masteryQuizProblems": 10,
        "masteryThreshold": 0.90
      }
    }
  ]
}
```

---

## 7. Firestore Data Model

### 7.1 Student Competency State

```
Collection: studentCompetencyState/{studentId}

Document fields:
{
  dailySessionCapacity: 25,
  developmentPatterns: {
    math: { averageUltimate: 5.4, skillsClosed: 24, totalSessions: 138, variance: 1.8 },
    reading: { averageUltimate: 4.1, skillsClosed: 31, totalSessions: 130, variance: 0.6 },
    engineering: { averageUltimate: 4.5, skillsClosed: 8, totalSessions: 38, variance: 1.2 }
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

### 7.2 Skill Status (Subcollection)

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
    { date: Timestamp, score: 0.92, session: 1, passed: true,
      normalizedScore: 0.92, problemType: "mixed", problemCount: 10 },
    { date: Timestamp, score: 0.82, session: 2, passed: false,
      normalizedScore: 0.78, problemType: "free_response", problemCount: 10 },
    { date: Timestamp, score: 0.91, session: 3, passed: true,
      normalizedScore: 0.91, problemType: "mixed", problemCount: 10 }
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

### 7.3 School Year Config

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

### 7.4 Parent Overrides

```
Collection: overrides/{studentId}

Document fields:
{
  subjectOverrides: [
    {
      subject: "math",
      type: "weight",              // weight | pause | capacity
      weightMultiplier: 2.0,       // for type "weight": 2.0 = double priority
      createdAt: Timestamp,
      expiresAt: Timestamp,        // auto-expire, no stale overrides
      reason: "Accelerate math to catch up before spring break"
    },
    {
      subject: "engineering",
      type: "pause",
      pauseNewIntroductions: true, // stop new skills, reviews still run
      createdAt: Timestamp,
      expiresAt: Timestamp,
      reason: "Family trip, pausing new material for 1 week"
    }
  ],
  globalOverrides: {
    capacityOverride: null,        // temporarily increase/decrease daily capacity
    reviewOnlyMode: false,         // if true, no new skills introduced, reviews only
    reviewOnlyUntil: null
  }
}
```

### 7.5 Score Calibration Config

```
Document: config/scoreCalibration

{
  problemTypeWeights: {
    multiple_choice: { difficultyWeight: 0.80, guessRate: 0.25 },
    free_response: { difficultyWeight: 1.00, guessRate: 0.00 },
    visual_primitive: { difficultyWeight: 1.10, guessRate: 0.05 },
    drag_and_drop: { difficultyWeight: 0.90, guessRate: 0.10 },
    verbal_response: { difficultyWeight: 1.05, guessRate: 0.00 }
  },
  // Per-skill overrides when population data shows miscalibration
  skillOverrides: {
    "math_fractions_equiv": { difficultyWeight: 1.20 }
  }
}
```

---

## 8. Session Sequencing — Interleaving

### 8.1 Rationale

Research on learning science strongly favors interleaving — mixing different skills and subjects within a session — over blocking (completing all problems for one skill before moving to the next). Interleaving forces the student to practice retrieval and discrimination between problem types, which strengthens long-term retention.

However, there is an important exception: **new skill introductions**. When a student is encountering a concept for the first time, the lesson instruction and the subsequent mastery quiz should be presented as a contiguous block. Interleaving during initial learning creates confusion rather than desirable difficulty.

### 8.2 Sequencing Rules

The daily planner emits an ordered session list following these rules:

**Rule 1: New skill introductions are contiguous blocks.** A new skill block consists of formative instruction (lesson problems) followed immediately by the mastery quiz. These are never split.

**Rule 2: Review items are interleaved between new skill blocks and between each other.** Reviews from different subjects are woven together rather than grouped.

**Rule 3: Tight-loop recovery items are served first.** These are skills in active failure recovery and need priority attention while the student is fresh.

**Rule 4: Subject alternation within reviews.** Consecutive review items should be from different subjects when possible.

### 8.3 Sequencing Algorithm

```
Given:
  tightLoopReviews = [R1_math, R2_reading]
  scheduledReviews = [R3_math, R4_eng, R5_reading, R6_math, ...]
  newSkillBlocks   = [N1_eng (lesson + quiz), N2_math (lesson + quiz), ...]

Output sequence:
  1. R1_math          ← tight loop first
  2. R2_reading       ← tight loop
  3. N1_eng           ← new skill block (contiguous)
  4. R3_math          ← interleaved review
  5. R5_reading       ← alternate subject
  6. R4_eng           ← alternate subject
  7. N2_math          ← new skill block (contiguous)
  8. R6_math          ← remaining reviews
  ...

Pattern: tight loops → [new block, review, review, new block, review, review, ...]
```

### 8.4 Fatigue Awareness

New skill blocks are cognitively demanding. They should be front-loaded in the session while the student is fresh, with lighter review items filling the back half. The sequencing algorithm places new skill blocks in the first 60% of the session and distributes remaining reviews toward the end.

---

## 9. Statistical Mastery Framework

### 9.1 The Measurement Problem

Determining whether a student has truly mastered a skill from a small number of problems is a hypothesis testing problem. The system must distinguish between:

- **H₀:** Student's true ability is below 90% (not mastered)
- **H₁:** Student's true ability is at or above 90% (mastered)

With few problems, the false positive rate is unacceptably high. A student with 70% true ability has a 16.8% chance of scoring 5/5 by luck. The system addresses this through a two-stage assessment design combined with the review schedule as a statistical backstop.

### 9.2 Two-Stage Assessment

**Stage 1: Formative Assessment (Lesson Evals)**

During instruction, the student works through practice problems. These are learning opportunities, not measurement instruments. The system tracks accuracy to determine readiness for the mastery quiz.

Readiness signal: The student answers the last 5 consecutive lesson problems correctly (or 8 out of the last 10). This triggers the mastery quiz.

If the student does not reach the readiness threshold after a configurable maximum number of lesson problems (default: 20), the skill is flagged for additional instruction rather than proceeding to the quiz.

**Stage 2: Summative Assessment (Mastery Quiz)**

A focused assessment of **10 problems** on the target skill. The pass threshold is **90%** (9+ correct).

Why 10 problems:

- Balances statistical power with session length for young learners.
- A true 90% student passes approximately 74% of the time on any given attempt — acceptable, since a false negative simply means they retake the quiz, not that they are penalized.
- A true 70% student passes approximately 15% of the time — the review schedule catches these false positives.

### 9.3 The Review Schedule as Statistical Backstop

The mastery quiz is a screening gate, not a final determination. The compound probability of a false mastery surviving the full review cascade provides the true statistical power:

```
Probability of false mastery surviving all assessments:

  Single quiz (10 questions, true ability = 70%):
    P(pass) ≈ 0.15

  Full review schedule (4 independent assessments):
    P(pass all 4) ≈ 0.15^4 ≈ 0.05%

  Even with generous correlation between assessments:
    P(false mastery surviving) < 1%
```

A student who genuinely hasn't mastered a skill will almost certainly fail at least one review, enter the tight loop, and either demonstrate mastery through repeated practice or carry a high ultimate (correctly reflecting that the skill requires more work).

### 9.4 Problem Count by Assessment Context

| Context | Problem Count | Threshold | Notes |
|---------|-------------|-----------|-------|
| Formative (lesson) | Variable (5-20) | Readiness signal | Not a mastery gate |
| Mastery quiz (initial) | 10 | 90% (9+) | Enters review pipeline |
| Review quiz | 10 | 90% (9+) | Same standard throughout |

### 9.5 Score Normalization Across Problem Types

Raw scores are normalized before applying the 90% threshold to account for difficulty differences across problem formats. Not all problems measure the same construct with equal precision.

**The problem:** 90% on multiple choice (where guessing yields ~25%) is not equivalent to 90% on free response (where guessing yields ~0%). A student with 70% true ability scores significantly higher on multiple choice due to lucky guesses.

**The solution:** Apply a difficulty weight and guess-rate correction per problem type:

```
normalizedScore = (rawScore - guessRate) / (1.0 - guessRate) * difficultyWeight

Example:
  Multiple choice: raw 90%, guess rate 25%
    normalized = (0.90 - 0.25) / (0.75) * 0.80 = 0.693  ← below threshold

  Free response: raw 90%, guess rate 0%
    normalized = (0.90 - 0.00) / (1.00) * 1.00 = 0.900  ← meets threshold
```

The mastery threshold is applied to the **normalized** score. This means the effective raw threshold is higher for easier problem types and lower for harder ones, correctly reflecting the true difficulty of demonstrating mastery.

Calibration weights are stored in `config/scoreCalibration` (see Section 7.5) and can be updated as new problem types are introduced or as population-level data reveals miscalibration.

### 9.6 Mixed-Format Assessments

When a mastery quiz or review contains a mix of problem types, the normalized score is the weighted average:

```
normalizedScore = Σ (normalizedScore_i * weight_i) / Σ weight_i

where weight_i = difficultyWeight for problem i's type
```

This allows assessments to combine multiple choice, free response, and visual primitives while maintaining a consistent mastery standard.

---

## 10. Score Calibration System

### 10.1 Purpose

As Lumina's primitive library grows — multiple choice, free response, visual primitives, drag-and-drop, verbal response — the system must ensure that mastery thresholds are meaningful and comparable across formats. A 90% on a visual primitive eval should represent the same level of mastery as 90% on a text-based quiz.

### 10.2 Calibration Approach

**Initial weights** are set based on theoretical difficulty and guess rates (see Section 7.5). These serve as priors.

**Empirical calibration** uses BigQuery cross-student data to validate and adjust weights over time. The key metric: for skills assessed using multiple problem types, do students who pass on one format also pass on others at similar rates? If students consistently pass multiple choice but fail free response for the same skill, the multiple choice weight is too generous.

### 10.3 Calibration Feedback Loop (Quarterly)

```
1. Pull from BigQuery: for each skill assessed on multiple formats,
   compare pass rates by problem type
2. If passRate[format_A] >> passRate[format_B] for the same skills:
   → format_A's difficultyWeight is too high (making it too easy to pass)
   → Decrease format_A weight or increase format_B weight
3. Update config/scoreCalibration in Firestore
4. New assessments immediately use updated weights
```

### 10.4 Per-Skill Overrides

Some skills are inherently harder to assess in certain formats. For example, spatial reasoning skills assessed via visual primitives may be appropriately harder than text-based assessment of the same concept. The `skillOverrides` field in the calibration config allows fine-grained adjustment without changing the global weights.

---

## 11. Parent Controls and Manual Overrides

### 11.1 Purpose

The algorithm optimizes for pacing and retention, but the parent-educator has context the algorithm does not: an upcoming developmental leap, a family trip, a child's shifting interests, or a pedagogical judgment that a subject needs more or less emphasis. The override system provides first-class controls that the planner respects and that auto-expire to prevent stale state.

### 11.2 Available Controls

**Subject Weight Multiplier**

Adjusts the relative priority of a subject in the weekly and daily planners. A multiplier of 2.0 doubles the subject's weekly new skill target (at the expense of other subjects' share of capacity). A multiplier of 0.5 halves it.

```
Override: { subject: "math", type: "weight", multiplier: 2.0, expiresAt: "2026-03-21" }
Effect: Math weekly target doubles for 3 weeks, other subjects absorb the capacity reduction
```

**Subject Pause**

Stops all new skill introductions for a subject while continuing scheduled reviews. Useful for breaks, transitions, or when a subject needs consolidation time.

```
Override: { subject: "engineering", type: "pause", pauseNewIntroductions: true, expiresAt: "2026-03-14" }
Effect: No new engineering skills for 1 week. Reviews still fire on schedule.
```

**Review-Only Mode (Global)**

Stops all new skill introductions across all subjects. The student works exclusively on reviews. Useful for post-break re-entry or when review burden has spiked.

```
Override: { globalOverrides: { reviewOnlyMode: true, reviewOnlyUntil: "2026-01-10" } }
Effect: No new skills in any subject until January 10. Full capacity dedicated to reviews.
```

**Capacity Override**

Temporarily increases or decreases the student's daily session capacity. Useful for light days (field trips, sick days) or intensive catch-up periods.

```
Override: { globalOverrides: { capacityOverride: 35 } }
Effect: Daily capacity increases from 25 to 35 sessions until expiry
```

### 11.3 Override Rules

- All overrides require an `expiresAt` timestamp. There are no permanent overrides — they must be explicitly renewed. This prevents forgotten overrides from silently distorting the plan.
- Multiple overrides can be active simultaneously (e.g., weight math 2x AND pause engineering).
- Conflicting overrides are resolved by most recent creation date.
- The weekly and daily planner responses include an `activeOverrides` field so the parent always sees what's currently in effect.
- Overrides are logged to the activity log for retrospective analysis (e.g., "we paused engineering for 3 weeks in March — did that help or hurt?").

### 11.4 Parent Dashboard Integration

The parent-facing UI should surface:

- Currently active overrides with countdown to expiry
- One-tap actions: "Pause this subject for 1 week", "Double this subject", "Review-only mode"
- Override history with correlation to student performance (did the override help?)

---

## 12. Frontend Visualization

### 12.1 View 1: Weekly Dashboard (Current State)

The primary daily view. Shows this week's target vs. completed per subject, split by new skills and reviews.

**Layout:** Horizontal progress bars per subject with color coding.

```
Math        ████████░░░░░░░░  8/15  (5 review ✓, 3 new ✓)     ON PACE
Reading     ██████░░░░░░░░░░  6/12  (4 review ✓, 2 new ✓)     ON PACE
Engineering ██░░░░░░░░░░░░░░  2/8   (2 review ✓, 0 new)       BEHIND
```

Color coding:

- **Green:** On pace or ahead for the week
- **Yellow:** Behind by 1-2 sessions
- **Red:** Behind by 3+ sessions or capacity constrained

Below the bars, show today's session queue as an ordered card list. Each card shows the skill name, subject, type (new/review), and reason. Cards can be tapped to begin the session.

### 12.2 View 2: Trajectory Chart (Monthly Projection)

A burndown-style line chart showing skills remaining vs. weeks remaining.

**X-axis:** Weeks remaining in school year (left = now, right = year end)
**Y-axis:** Skills remaining (not started + in review)
**Lines:**

- **Target line (dashed):** Linear pace to finish on time
- **Projected best estimate (solid):** Based on current throughput and reserve model
- **Confidence band (shaded):** Optimistic and pessimistic scenarios based on development pattern variance

Render per-subject (tabs) and as an aggregate total. When the projected line is above the target line, the gap between them is the deficit, shaded in red.

**Break markers:** Vertical lines showing scheduled breaks. The projection should flatten during breaks (no progress) and show the expected post-break review spike.

### 12.3 View 3: Reserve Health Indicator

A simplified view of the review reserve and its trajectory. Not a full development triangle (too complex for a parent-facing UI) but a meaningful health signal.

**Layout:** One gauge per subject showing the ratio of actual aggregate completion factor to expected.

```
Subject Health Score = Σ actualCompletionFactor / Σ expectedCompletionFactor
                       for all open skills in the subject
```

- **Above 1.0:** Student is retaining better than forecast. Reviews are going well. Green.
- **0.8 - 1.0:** Normal range. On track. Yellow-green.
- **Below 0.8:** Review debt is accumulating. Skills are developing slower than expected. Red.

Below the gauge, show the key driver: "3 math skills in tight-loop recovery are pulling this down. Top bottleneck: Subtraction with Borrowing (4 consecutive failures)."

### 12.4 View 4: Skill Pipeline Visualization

A flow diagram showing skills moving through lifecycle stages:

```
Not Started → Learning → In Review → Closed
   (68)         (2)        (18)       (34)
```

Each stage shows the count per subject. Skills in tight-loop recovery are called out separately within "In Review." Bottleneck skills (those blocking downstream prerequisites) are highlighted.

This view answers the parent's question: "Where is all the time going?" If 80% of sessions are reviews and new skill introduction has stalled, this visualization makes the reason visible.

---

## 13. Post-Session Update Flow

When a student completes an assessment session, the following updates occur:

```
1. Write eval results to activityLog/{studentId}/sessions/{sessionId}
   Include: skillId, rawScore, normalizedScore, problemType, problemCount, positionInSession

2. Update skill document in studentCompetencyState/{studentId}/skills/{skillId}:
   a. Append to reviewHistory (with normalizedScore and problemType)
   b. Increment sessionsCompleted
   c. If normalizedScore >= 90%:
      - If inTightLoop: decrement tightLoopPassesNeeded
        - If tightLoopPassesNeeded == 0: set inTightLoop = false, schedule next at +2 weeks
        - Else: schedule next at +2 weeks
      - If not inTightLoop: schedule next per standard intervals
      - If final session in schedule: set status = "closed", closedDate = now
   d. If normalizedScore < 90%:
      - Increment estimatedUltimate by 1
      - Set inTightLoop = true
      - Set tightLoopPassesNeeded = 2
      - Schedule next at +1 week
   e. Recalculate completionFactor

3. Update student-level aggregate metrics:
   a. Recalculate totalReviewReserve
   b. Recalculate projectedDailyReviewLoad
   c. Update developmentPatterns for the subject (rolling average ultimate, variance)
```

---

## 14. Edge Cases and Constraints

### 14.1 Capacity Overload

When `projectedDailyReviews > dailySessionCapacity`, the student cannot keep up with reviews. The system should:

- Prioritize reviews by overdue days and downstream dependency count.
- Set `sustainableNewPerDay = 0` — no new skills until review backlog clears.
- Surface this state in the weekly planner response as a warning.
- Suggest the parent activate review-only mode via override controls.

### 14.2 Year-End Crunch

When `remainingSkills / weeksRemaining` exceeds what is sustainable given the review reserve, the system should:

- Report the gap clearly in the weekly planner and monthly projection.
- Not silently drop review quality to cram new skills — the integrity of the completion factor model depends on reviews happening on schedule.
- Let the parent decide whether to extend the year, reduce scope, or increase daily capacity.
- The monthly projection's confidence bands make this visible weeks in advance.

### 14.3 Knowledge Graph Bottlenecks

If a prerequisite skill is stuck in tight-loop recovery, all downstream skills are blocked. The daily planner should:

- Identify and surface these bottleneck skills.
- Prioritize them in the review queue (they have high downstream dependency counts).
- Suggest alternative paths through the knowledge graph if available.
- Show bottlenecks in the Skill Pipeline visualization.

### 14.4 New Curriculum or Primitives Added Mid-Year

Because the service reads directly from Firestore, new skills or subjects added to the curriculum are immediately visible to the planner. No ETL changes required. The weekly planner will automatically adjust targets based on the new total skill count. Score calibration weights for new problem types should be added to the calibration config before the new primitives are used in assessments.

---

## 15. What BigQuery Still Handles

The nightly ETL and BigQuery remain responsible for:

- Cross-student aggregate analysis (e.g., which skills have the highest failure rates across all students)
- Longitudinal progress reports for parents
- Curriculum effectiveness metrics (e.g., average ultimate by skill — identifying poorly designed assessments)
- Development pattern benchmarking (comparing a student's pattern to cohort averages)
- Score calibration validation (comparing pass rates across problem types — see Section 10.3)

None of these workloads are latency-sensitive or student-session-blocking.

---

## 16. Success Metrics

| Metric | Target |
|--------|--------|
| Recommendation latency | < 500ms for daily plan generation |
| Monthly projection latency | < 2s for full forward simulation |
| Data freshness | Real-time (no ETL delay) |
| Iteration cycle for new dimensions | Code deploy only, no pipeline changes |
| Review adherence | 95%+ of scheduled reviews served on the scheduled day |
| Pacing accuracy | Weekly targets within 10% of achievable given actual capacity |
| False mastery survival rate | < 1% of skills that pass initial quiz and complete full review schedule without true mastery |
| Score calibration drift | < 5% pass rate difference between problem types for the same skill |

---

## 17. Implementation Phases

### Phase 1: Weekly Planner + Review Engine

- Implement `GET /api/plan/weekly/{studentId}`
- Implement post-session update flow (Section 13)
- Build completion factor tracking and tight-loop recovery logic
- Calculate and maintain reserve metrics on competency state documents
- Deploy score normalization using initial calibration weights

### Phase 2: Daily Planner

- Implement `GET /api/plan/daily/{studentId}`
- Integrate review queue, knowledge graph traversal, and pacing targets
- Implement interleaving sequencing (Section 8)
- Return prioritized, sequenced session queue

### Phase 3: Monthly Projection + Visualization

- Implement `GET /api/plan/monthly/{studentId}`
- Build forward simulation engine with confidence bands
- Implement frontend views: weekly dashboard, trajectory chart, reserve health, skill pipeline

### Phase 4: Parent Controls

- Implement override Firestore model and admin UI
- Subject weight, pause, review-only mode, capacity override
- Auto-expiry and override history logging

### Phase 5: Calibration and Tuning

- Build quarterly calibration feedback loop using BigQuery data
- Surface capacity overload and bottleneck warnings
- Compare predicted ultimates to actual closures, tune cold-start priors
- Validate score normalization weights against cross-format pass rates
