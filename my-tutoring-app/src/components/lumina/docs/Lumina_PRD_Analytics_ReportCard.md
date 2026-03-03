# Lumina PRD: Report Card, Analytics & Solvency Engine

**Covers: Student Analytics, Parent Report Card, Solvency Engine, Parent Portal**
**Version 1.0 | March 2026**

---

## 1. Overview

This PRD defines how Lumina communicates student progress to parents and how the system assesses whether a student's learning trajectory is adequate. It covers four systems:

1. **Report Card** — The parent-facing view of student progress, designed from the end backward
2. **Analytics Engine** — The data aggregation and analysis layer that powers the report card
3. **Solvency Engine** — Continuous assessment of whether the student will meet curriculum goals (the insurance cash flow testing equivalent)
4. **Parent Portal** — The interface that surfaces all of the above

These systems consume telemetry produced by the Daily Learning system (see companion PRD). The dependency is one-directional:

```
Daily Learning PRD                    This PRD
─────────────────                    ──────────
Session Runner                       
  → Telemetry ──────────────────────→ Analytics Engine
                                       → Report Card
                                       → Solvency Engine
                                       → Parent Portal
                                       → Interventions
```

---

## 2. Design Principle: Start from the End

The current analytics report the data we have and visualize it well — velocity decomposition, weekly projections, skill-level breakdowns. But the output looks like an actuarial exhibit, not a report card. A parent should open the analytics and *immediately* know:

1. Is my child on track?
2. What did they learn this week?
3. What should I worry about?
4. What should I celebrate?

Everything else is drill-down. The design works backward from the final artifact — what the parent sees — through the data strategy that supports it.

---

## 3. Report Card: Four-Level Design

### 3.1 Level 0: The Headline (2 seconds)

A single glanceable view that answers "is everything okay?" The parent sees this on the portal home screen and in weekly notification emails.

```
┌─────────────────────────────────────────────────┐
│  This Week                                       │
│                                                   │
│  📖 Language Arts    ██████████░░░  On Track      │
│  🔢 Mathematics      ████████░░░░░  Needs Push    │
│  🔬 Science          ██░░░░░░░░░░░  Getting Started│
│  🌍 Social Studies   ░░░░░░░░░░░░░  Not Active    │
│                                                   │
│  ⏱ 4h 32m this week  │  🌟 8 subskills advanced  │
│  🔥 5-day streak     │  🏆 3 skills mastered      │
└─────────────────────────────────────────────────┘
```

**Status definitions:**

| Status | Internal Criteria | Color |
|---|---|---|
| On Track | Solvency ratio ≥ 0.8 | Green |
| Needs Push | Solvency ratio 0.5–0.8 | Yellow |
| Behind | Solvency ratio 0.3–0.5 | Orange |
| Critically Behind | Solvency ratio < 0.3 | Red |
| Getting Started | < 2 weeks of data | Blue |
| Not Active | No sessions logged for this subject | Gray |

The parent never sees the solvency ratio number. They see the status label and a progress bar.

### 3.2 Level 1: Weekly Summary (30 seconds)

Tapping a subject or viewing the weekly email shows a plain-language summary of what happened:

```
This week, [Child] worked on:

📖 Language Arts
  • Blending sounds to make words — practicing, getting stronger 📈
  • Recognizing rhyming words — just started, looking good ✨
  • Story sequencing — needs more practice, we'll keep at it

🔢 Mathematics  
  • Identifying shapes — reviewed, nearly mastered! 🌟
  • Counting to 20 — new this week
  • Sorting objects by category — needs more practice

🎉 Celebrations
  • Mastered: Rhyme Recognition (100% on retest!)
  • Perfect score on Dinosaur Fast Facts
  • 5-day learning streak!

📅 Coming next week
  • Letter formation practice (Language Arts)
  • Addition within 5 (Mathematics)
  • First science lesson: plant parts!
```

No gates. No completion factors. No velocity numbers. Just what happened, what was celebrated, and what's coming.

**Key requirement:** Every subskill needs a **parent-friendly description.** "Blend onset and rime (/c/ + /at/ → cat)" becomes "Blending sounds to make words." This is a content field that must be populated for every subskill in the curriculum.

### 3.3 Level 2: Progress Report (2 minutes)

The quarterly report card equivalent. Subject-by-subject breakdown with trajectory:

```
Language Arts — Grade K
───────────────────────────
Competencies mastered:  4 of 42   ██░░░░░░░░  10%
Subskills closed:      12 of 264

Strengths
  ✅ Rhyme Recognition & Production — all 3 subskills mastered
  ✅ Syllable Blending — 2 of 2 mastered

In Progress
  🔄 Letter Recognition — 2 of 4 subskills practicing
  🔄 Onset-Rime — reviewing, retest due this week

Needs Attention
  ⚠️ Letter Formation — struggling with fine motor components
  ⚠️ Reading Foundations — not yet started, behind schedule

Trajectory
  At current pace: projected 140–180 subskills mastered by May 29
  This covers 53–68% of the Language Arts curriculum.
  Recommendation: On track for core competencies. Extended 
  skills will carry into next year.
                                              [See detail →]
```

**Competency reporting:** Subskills roll up into parent-facing **competencies** (distinct from lesson groups, which are a teaching unit). A competency is a parent-readable cluster like "Rhyme Recognition & Production" that contains 2–6 subskills. A competency is "mastered" when all its component subskills are closed. Parents see competency counts; the detail view shows subskills.

### 3.4 Level 3: Advanced Analytics (For the Developer-Parent)

This is where the current analytics dashboards live — velocity decomposition, completion factors, projection models, weekly detail tables, prerequisite chain visualization, A/E ratios. Accessible under an "Advanced" or "Developer View" toggle.

This level is valuable but is the supplement, not the primary statement. It serves the parent who also happens to be building the platform.

---

## 4. Data Strategy

### 4.1 Working Backward from the Report Card

Each report card element requires specific data. Here's the gap analysis:

| Report Card Element | Required Data | Current State | Gap |
|---|---|---|---|
| Subject status (On Track / Behind) | Solvency ratio per subject | ❌ Not calculated | Solvency engine (Section 6) |
| Progress bar | Subskills closed / total per subject | ✅ Exists | Need closures to happen (mastery loop) |
| Time spent this week | Session timestamps + duration | ❌ Not tracked | Session telemetry (Daily Learning PRD) |
| "What they worked on" | Subskill → friendly description | ❌ Technical names only | `parent_description` field per subskill |
| Strength / needs attention | Performance aggregated by domain | ⚠️ Attempt data exists | Aggregation logic by unit |
| Celebrations | Achievement events (streaks, perfect scores, mastery) | ⚠️ Partial (Fast Fact tracking) | Achievement event system |
| Trajectory statement | Solvency projection + plain-language rendering | ⚠️ Projection exists | Plain-language template engine |
| Coming next week | Planner lookahead | ✅ Planner exists | Friendly name rendering |
| Competency rollup | Subskill → competency mapping | ❌ Not defined | Competency mapping table |
| Streak tracking | Consecutive session days | ❌ Not tracked | Session date tracking |

### 4.2 New Data Requirements

#### 4.2.1 Parent-Friendly Skill Descriptions

Every subskill needs a `parent_description` field:

```
{
  subskill_id: "PA-RRP-01",
  technical_name: "Recognize if two spoken words rhyme (e.g., 'Do cat and hat rhyme?')",
  parent_description: "Recognizing rhyming words",
  parent_detail: "Your child listens to two words and decides if they rhyme — like 'cat' and 'hat'.",
  celebration_text: "is a rhyming detective! 🔍"
}
```

The `parent_description` appears in Level 1 summaries. The `parent_detail` appears when a parent taps for more info. The `celebration_text` is used in achievement notifications.

This is a content task: 674 subskills need these three fields populated. Can be partially automated with LLM generation + human review.

#### 4.2.2 Competency Mapping

Competencies are parent-facing groupings distinct from lesson groups:

```
competency: {
  id: string,
  name: string,                    // "Rhyme Recognition & Production"
  parent_description: string,      // "Recognizing and creating rhyming words"
  subject: string,
  unit: string,
  subskill_ids: string[],         // the subskills that compose this competency
  mastery_rule: "all" | "majority", // "all" = every subskill closed; "majority" = ≥ 75% closed
  tier: "core" | "extended" | "enrichment"
}
```

Competency count per subject (estimated):

| Subject | Subskills | Est. Competencies | Avg Subskills/Competency |
|---|---|---|---|
| Language Arts | 264 | ~42 | ~6 |
| Mathematics | 163 | ~30 | ~5 |
| Science | 88 | ~18 | ~5 |
| Social Studies | 159 | ~28 | ~6 |
| **Total** | **674** | **~118** | **~5.7** |

Parents see ~118 competencies instead of 674 subskills. Much more digestible.

#### 4.2.3 Achievement Event System

A lightweight event bus that fires on milestones:

```
achievement_event: {
  id: string,
  student_id: string,
  timestamp: timestamp,
  type: "subskill_mastered" | "competency_mastered" | "perfect_score" | 
        "streak_milestone" | "time_milestone" | "subject_milestone" | 
        "first_in_domain" | "speed_record",
  payload: {
    subskill_id?: string,
    competency_id?: string,
    score?: number,
    streak_days?: number,
    total_minutes?: number,
    subject?: string,
    detail: string              // human-readable description
  }
}
```

Achievement events feed into:
- Level 1 weekly summary ("Celebrations" section)
- Push notifications
- Session runner celebrations (real-time, if mastery threshold crossed mid-session)
- Streak tracking

#### 4.2.4 Session Aggregation Tables

Materialized views (or Firestore aggregation documents) that pre-compute report card data:

```
weekly_summary: {
  student_id: string,
  week_start: date,
  total_sessions: number,
  total_minutes: number,
  by_subject: {
    [subject]: {
      minutes: number,
      sessions: number,
      subskills_advanced: number,
      subskills_closed: number,
      competencies_closed: number,
      new_introductions: number,
      reviews_completed: number,
      avg_score: number,
      top_strength: string,       // highest-performing domain
      needs_attention: string     // lowest-performing domain
    }
  },
  achievements: achievement_event[],
  streak_current: number,
  streak_best: number
}
```

Updated nightly (or on session completion). The report card reads from this table, not raw telemetry.

---

## 5. Analytics Engine

### 5.1 Aggregation Pipeline

```
Raw telemetry (per session)
  → Session-level aggregates (computed on session completion)
    → Daily summary (computed nightly)
      → Weekly summary (computed Sunday night or on-demand)
        → Monthly summary (computed end of month)
          → Quarterly progress report (on-demand generation)
```

Each level computes progressively higher-level metrics:

| Level | Key Metrics |
|---|---|
| Session | Duration, blocks completed, subskills advanced/closed, scores by phase |
| Daily | Total learning time, subskills advanced, closures, streak status |
| Weekly | Subject-level progress, solvency ratios, strengths/weaknesses, achievements |
| Monthly | Trajectory update, A/E ratios, competency progress, solvency scenario re-run |
| Quarterly | Full progress report, curriculum coverage, grade-level assessment |

### 5.2 Derived Metrics

#### Subject Health Score

A composite score that drives the Level 0 status indicator:

```
subject_health = weighted_average(
  solvency_ratio × 0.4,           // are we on pace?
  recent_mastery_rate × 0.3,      // are recent sessions producing closures?
  engagement_consistency × 0.2,   // is the student showing up regularly?
  score_trend × 0.1               // are scores improving or declining?
)

Mapping:
  health ≥ 0.8  → "On Track"
  health 0.5–0.8 → "Needs Push"
  health 0.3–0.5 → "Behind"
  health < 0.3  → "Critically Behind"
```

#### Strength & Weakness Detection

```
For each curriculum domain (unit level):
  domain_performance = avg(phase_scores) across last 14 days
  domain_trajectory = slope of phase_scores over last 14 days

Strength: domain_performance > subject_avg AND trajectory ≥ 0
Weakness: domain_performance < subject_avg AND trajectory ≤ 0
Emerging: domain_performance < subject_avg BUT trajectory > 0
```

Report card shows the top 2 strengths and top 2 weaknesses per subject.

#### Trajectory Statement

A plain-language rendering of the solvency projection:

```
template: "At current pace: projected {min_skills}–{max_skills} subskills 
mastered by {end_date}. This covers {min_pct}–{max_pct}% of the 
{subject} curriculum. {recommendation}"

recommendation logic:
  if max_pct >= 90%: "Excellent pace — on track to complete the full curriculum."
  if max_pct >= 70%: "On track for core competencies. Extended skills will carry into next year."
  if max_pct >= 50%: "Core skills are achievable with consistent sessions. Consider prioritizing {weak_domain}."
  if max_pct < 50%: "Current pace needs adjustment. See recommendations below."
```

---

## 6. Solvency Engine

### 6.1 Purpose

The solvency engine continuously evaluates whether the student's learning trajectory will meet curriculum goals — the direct equivalent of insurance cash flow testing and reserve adequacy assessment.

It answers one question: **Given what we know about this student's actual throughput, will they reach their targets, and if not, what needs to change?**

### 6.2 Inputs

| Input | Source | Fallback (Pre-Data) |
|---|---|---|
| Curriculum targets | Curriculum service: total skills per subject, tier tags | Always available |
| Current position | Mastery engine: closed, in-review, not-started by subject | Always available |
| Demonstrated throughput | Session telemetry: actual items/day, mastery rates, time/item | Use assumed values |
| Calendar | Config: remaining school days, planned breaks, days/week | Always available |
| Student capacity | Config: daily time budget in minutes | Default 75 min |

### 6.3 Core Calculations

#### 6.3.1 Required Daily Run Rate

```
For each subject:
  remaining_skills = target_skills - closed_skills
  remaining_days = school_days_left × (subject_days_per_week / total_days_per_week)
  required_closures_per_day = remaining_skills / remaining_days
```

If using tiered curriculum, `target_skills` = Core skills only (or Core + Extended depending on pacing strategy).

#### 6.3.2 Demonstrated Daily Run Rate

```
actual_closures_per_day = closures_last_N_days / N

Where N = rolling window:
  If < 14 days of data: use all available data
  If 14–28 days: use 14-day window
  If > 28 days: use 28-day window (more recent = more relevant)
```

#### 6.3.3 Solvency Ratio

```
solvency = actual_closures_per_day / required_closures_per_day
```

- ≥ 1.0: Surplus (closing skills faster than required)
- 0.8–1.0: On Track (minor deficit, sustainable)
- 0.5–0.8: Needs Push (actionable deficit)
- 0.3–0.5: Behind (intervention recommended)
- < 0.3: Critically Behind (structural change needed)

#### 6.3.4 Credibility-Weighted Projections

Before sufficient real student data exists, projections blend assumed and actual throughput using Bühlmann credibility:

```
Z = min(1, actual_sessions / full_credibility_sessions)
projected_rate = Z × actual_rate + (1 - Z) × assumed_rate

full_credibility_sessions = 30  (approximately 6 weeks of daily sessions)
```

This mirrors small group renewal pricing credibility exactly. With 0 sessions, projections use 100% assumed rates. At 15 sessions, it's 50/50. At 30+ sessions, it's fully experience-rated.

**Assumed rates (initial):**

| Parameter | Assumed Value | Basis |
|---|---|---|
| Items per day | 20 | Conservative for K student |
| First-attempt mastery rate | 60% | Moderate difficulty |
| Days per week | 4 | Allows for off days |
| Time per lesson group | 18 min | Based on primitive estimates |
| Time per practice group | 10 min | Reduced scaffolding |
| Time per retest | 5 min | Targeted assessment |

These assumed values should be reviewed and adjusted based on curriculum design intent and early observations.

### 6.4 Scenario Testing

Run three scenarios weekly (or on demand):

| Scenario | Throughput Assumption | Purpose |
|---|---|---|
| **Base** | Credibility-weighted demonstrated rate | Most likely outcome |
| **Stress** | 70% of base rate | Bad weeks, illness, motivation dips |
| **Optimistic** | 130% of base rate | Good weeks, acceleration |

Each scenario projects forward week-by-week:

```
For each future week w:
  new_introductions[w] = min(intro_capacity, remaining_not_started)
  reviews[w] = items_due_for_review(w)  // from spaced repetition schedule
  closures[w] = pipeline_in_review × mastery_rate_per_review_cycle
  
  open_inventory[w] = open_inventory[w-1] + new_introductions[w] - closures[w]
  cumulative_mastered[w] = cumulative_mastered[w-1] + closures[w]
```

Output: projected cumulative mastery at end of year under each scenario.

#### Trigger: Structural Intervention

If the **stress scenario** shows < 50% of Core curriculum covered by year end:

```
STRUCTURAL INTERVENTION RECOMMENDED

Current trajectory (stress case) reaches only 45% of core Language Arts 
skills by May 29.

Options:
1. Reduce scope: Focus on 150 highest-priority core skills (covers reading 
   foundations + basic comprehension)
2. Extend timeline: Treat K curriculum as a 2-year program 
   (student is 3 — ample time)
3. Increase capacity: Add 15 min/day or 1 day/week
4. Reprioritize: Shift 20% of Math time to Language Arts for 4 weeks
```

### 6.5 Reserve Adequacy Test

The pipeline of skills "in review" is analogous to case reserves. The question: is the current pipeline large enough to produce the closures we need?

```
required_pipeline = required_closures_per_week / closure_rate_per_review_cycle
actual_pipeline = count(skills in review)
pipeline_adequacy = actual_pipeline / required_pipeline

If pipeline_adequacy < 0.5:
  → "Pipeline deficit: introduction rate needs to increase to build 
     sufficient review inventory"

If pipeline_adequacy > 2.0:
  → "Pipeline surplus: review burden may be crowding introductions. 
     Consider accelerating closures or graduating stable reviews 
     to longer intervals."
```

This is the metric that directly addresses the introduction bottleneck identified in the velocity decomposition. A pipeline deficit means we need to introduce faster. A pipeline surplus means reviews are dominating.

### 6.6 Intervention Playbook

The solvency engine doesn't just report — it recommends specific actions:

| Condition | Detection | Recommendation |
|---|---|---|
| Introduction bottleneck | Pipeline adequacy < 0.5 | "Review burden is high. Options: (a) graduate stable reviews to longer intervals, (b) enforce review budget cap at 40% of daily time, (c) fast-track near-mastery skills to closure" |
| Subject imbalance | One subject solvency < 0.5 while another > 1.0 | "Reallocate {N} minutes/day from {strong} to {weak} for {N} weeks" |
| Increasing time-per-item | Rolling avg time/item trending up > 20% | "Sessions may be too long or difficulty is increasing. Consider: shorter sessions, more breaks, or easier primitive types for struggling domains" |
| Stuck skill | Skill in review > 21 days without closure | "Skill {X} may need a different approach: try a different primitive, revisit prerequisites, or defer and return later" |
| Rushing | Session completing in < 50% of expected time with low scores | "Student may be rushing. Consider: reflection prompts, increase difficulty verification, or verify understanding before advancing" |
| Consistent session non-completion | < 60% of planned blocks completed for 5+ sessions | "Daily plan may be too ambitious. Recommend reducing daily budget from {current} to {reduced} minutes" |

### 6.7 IBNR Equivalent: Exhibit Shadow Credit

Skills the student has been exposed to through exhibits or free-form exploration but haven't been formally assessed against curriculum subskills. This is incurred learning that hasn't been reported.

```
shadow_credit: {
  exhibit_id: string,
  topic: string,
  learning_objectives: [
    {
      objective: string,
      bloom_level: string,
      mapped_subskills: [subskill_id, ...],  // curriculum subskills this covers
      confidence: "high" | "medium" | "low",
      assessment_score: number | null         // if exhibit included assessment
    }
  ]
}
```

If an exhibit's assessment score exceeds a threshold for a mapped subskill, offer to credit the subskill (skip Gate 1, go directly to Gate 2 practice, or direct to mastery retest). This converts shadow credit to formal credit.

Parent notification: "Your child scored 100% on dinosaur identification in the Dinosaurs exhibit. This aligns with the Science curriculum skill 'Identify different types of animals by physical features.' Would you like to credit this toward curriculum progress?"

---

## 7. Parent Portal

### 7.1 Architecture

The pre-Lumina parent portal backend exists and needs migration to Firestore. The migration plan:

```
Legacy backend (pre-Lumina)
  → Extract: data models, API contracts, auth patterns
  → Transform: align to current Firestore schema + new data requirements
  → Load: Firestore collections for portal data
  → Rebuild: frontend against new Firestore-backed API
```

The portal consumes:
- Weekly summary aggregation tables (Section 4.2.4)
- Solvency engine outputs (Section 6)
- Achievement events (Section 4.2.3)
- Session telemetry summaries (from Daily Learning PRD)
- Planner lookahead data

### 7.2 Screen Specifications

#### 7.2.1 Home (Daily View)

The default screen when a parent opens the portal.

**Components:**
- **Session status card:** Not Started / In Progress (with live stats) / Complete (with summary)
- **"Start Session" button:** Launches session runner. Prominent, primary action.
- **Today's plan preview:** 3–5 lesson group names with subject icons and estimated time. Friendly names, not technical. Example: "Rhyming sounds (18 min) • Shape review (10 min) • Story sequencing (18 min)"
- **Quick stats strip:** Streak count, total time this week, subskills advanced this week
- **Alert banner:** If solvency engine has an active intervention recommendation, show a non-alarming banner: "Language Arts could use a boost — tap for suggestions"

**Not shown on home:** Velocity numbers, completion factors, gate details, raw subskill counts.

#### 7.2.2 Progress (Report Card)

Default view: Level 0 headline (Section 3.1).

**Navigation:**
- Tap subject → Level 1 weekly summary (Section 3.2)
- Tap "Full Report" → Level 2 progress report (Section 3.3)
- Toggle "Advanced View" → Level 3 analytics dashboard (Section 3.4)

**Time range selector:** This Week / Last 4 Weeks / This Quarter / All Time

**Export:** "Download Progress Report" generates a PDF of the Level 2 view for homeschool compliance/portfolio.

#### 7.2.3 Schedule

**Weekly plan view:**
- Calendar grid showing which lesson groups are planned for each day
- Friendly names with subject color-coding
- Estimated time per day
- Ability to swap days (drag a lesson group from Monday to Tuesday)
- Ability to defer a lesson group ("skip this week, reschedule")
- Mark days off (vacation, sick) — system automatically recalculates pacing and re-runs solvency

**Schedule impact preview:** When marking days off or deferring content, show the impact on trajectory: "Skipping Thursday will push the stress-case projection from 62% to 59% curriculum coverage."

#### 7.2.4 Explore

Gateway to Exhibit mode with curriculum-aware suggestions:

- **Suggested topics:** Based on current curriculum position. "Your child is learning about plants — try the Botany exhibit!"
- **Recent exhibits:** History of completed exhibits with scores
- **Shadow credit offers:** If a completed exhibit maps to curriculum skills, show the credit offer (Section 6.7)
- **Browse by subject:** Filter exhibits by curriculum alignment
- **Free exploration:** Open topic entry (the existing free-form input)

#### 7.2.5 Settings

| Setting | Options | Default |
|---|---|---|
| Student name & age | Free text | Required at setup |
| Grade level | K–6 | K |
| School year dates | Start/end date pickers | Aug 25 – May 29 |
| Days per week | 1–7 | 4 |
| Daily time target | 30–120 min slider | 75 min |
| Break frequency | Every N min or N blocks | Every 25 min |
| Pacing strategy | Balanced / Depth-first / Breadth-first | Balanced |
| Review budget cap | 30–70% of daily time | 50% |
| Notifications | Daily summary / Weekly report / Milestones / Interventions | All on |
| Advanced view | Show/hide developer analytics | Hidden |

### 7.3 Notification System

| Trigger | Content | Channel | Timing |
|---|---|---|---|
| Session not started | "Ready to learn today? Today's plan: rhyming + shapes (~45 min)" | Push | Configurable (default 10am) |
| Session complete | "Great session! Completed 4 blocks in 52 minutes. 🌟" | Push | Immediately |
| Skill mastered | "[Child] mastered rhyming words! 🏆" | Push | Immediately |
| Weekly summary | Level 1 report card content | Email | Sunday evening |
| Streak milestone | "5-day streak! Consistency is the secret! 🔥" | Push | On milestone |
| Solvency alert | "Language Arts is falling behind pace. Here are 3 suggestions..." | Email + in-app banner | Weekly (if triggered) |
| Progress milestone | "50 subskills mastered! Halfway through core Language Arts!" | Push | On milestone |
| Monthly report | Level 2 report card content | Email | 1st of month |

---

## 8. Data Model Additions

### 8.1 New Firestore Collections

```
/students/{student_id}/weekly_summaries/{week_start}
  → weekly_summary document (Section 4.2.4)

/students/{student_id}/achievements/{achievement_id}
  → achievement_event document (Section 4.2.3)

/students/{student_id}/solvency/{date}
  → solvency snapshot: ratios, projections, scenarios, interventions

/curriculum/competencies/{competency_id}
  → competency document (Section 4.2.2)

/curriculum/subskills/{subskill_id}
  → add fields: parent_description, parent_detail, celebration_text

/students/{student_id}/exhibit_credits/{exhibit_id}
  → shadow_credit document (Section 6.7)

/students/{student_id}/settings
  → portal configuration (Section 7.2.5)

/students/{student_id}/notifications/{notification_id}
  → notification history and read status
```

### 8.2 Subskill Field Additions

Every subskill document gains three new fields:

```
parent_description: string    // "Recognizing rhyming words"
parent_detail: string         // "Your child listens to two words and decides..."
celebration_text: string      // "is a rhyming detective! 🔍"
competency_id: string         // maps to parent-facing competency
tier: "core" | "extended" | "enrichment"
```

**Population strategy:** LLM batch generation with human review. Estimate: 674 subskills × ~2 min review each = ~22 hours of content review. Can be parallelized.

---

## 9. Requirements Summary

### P0 — Phase 1 (Weeks 1–4)

These requirements establish the data foundation. Many depend on session telemetry from the Daily Learning PRD.

| Req ID | Requirement | Description |
|---|---|---|
| RA-001 | Solvency ratio calculation | Per-subject solvency ratio from demonstrated throughput (Section 6.3) |
| RA-002 | 3-scenario projection | Base/stress/optimistic projections run weekly (Section 6.4) |
| RA-003 | Pipeline adequacy test | Reserve adequacy equivalent for review pipeline (Section 6.5) |
| RA-004 | Credibility weighting | Bühlmann blend of assumed and actual throughput (Section 6.3.4) |
| RA-005 | Weekly summary aggregation | Nightly aggregation pipeline producing weekly_summary documents (Section 4.2.4) |
| RA-006 | Achievement event system | Event bus for milestones, streaks, mastery events (Section 4.2.3) |
| RA-007 | Skill tier tagging | Tag all 674 subskills as Core / Extended / Enrichment |

### P1 — Phase 2 (Weeks 5–10)

These requirements build the parent experience layer.

| Req ID | Requirement | Description |
|---|---|---|
| RA-008 | Parent-friendly descriptions | Populate parent_description, parent_detail, celebration_text for all 674 subskills (Section 8.2) |
| RA-009 | Competency mapping | Define ~118 competencies with subskill mappings (Section 4.2.2) |
| RA-010 | Report card Level 0 | Headline status view with subject health indicators (Section 3.1) |
| RA-011 | Report card Level 1 | Weekly summary with friendly language, celebrations, lookahead (Section 3.2) |
| RA-012 | Report card Level 2 | Progress report with competency progress and trajectory (Section 3.3) |
| RA-013 | Parent portal: Home | Daily view with session status, start button, quick stats (Section 7.2.1) |
| RA-014 | Parent portal: Progress | Report card integration with drill-down (Section 7.2.2) |
| RA-015 | Intervention recommendations | Solvency engine produces plain-language recommendations (Section 6.6) |
| RA-016 | Subject health score | Composite metric driving Level 0 status (Section 5.2) |
| RA-017 | Notification system | Push + email notifications per trigger table (Section 7.3) |
| RA-018 | Strength/weakness detection | Per-domain performance analysis with trend (Section 5.2) |

### P2 — Phase 3 (Weeks 11–17)

| Req ID | Requirement | Description |
|---|---|---|
| RA-019 | Parent portal: Schedule | Weekly plan view with swap/defer/day-off controls (Section 7.2.3) |
| RA-020 | Parent portal: Explore | Exhibit gateway with curriculum suggestions (Section 7.2.4) |
| RA-021 | Exhibit shadow credit | Map exhibit learning objectives to curriculum subskills (Section 6.7) |
| RA-022 | Experience study v1 | A/E analysis from 6+ weeks of telemetry data (Section 6.3.4) |
| RA-023 | Progress report PDF export | Downloadable report for homeschool compliance (Section 7.2.2) |
| RA-024 | Schedule impact preview | Show trajectory impact when deferring or marking days off (Section 7.2.3) |
| RA-025 | Monthly automated report | Level 2 report card generated and emailed monthly (Section 7.3) |
| RA-026 | Solvency dashboard (advanced) | Full actuarial view with reserve adequacy, A/E, scenario detail |

---

## 10. Success Metrics

| Metric | Current | Phase 1 Target | Phase 2 Target | Phase 3 Target |
|---|---|---|---|---|
| Solvency ratio (Core, any subject) | N/A | Calculated | ≥ 0.7 (2+ subjects) | ≥ 0.8 (all active) |
| Parent portal daily opens | N/A | N/A | ≥ 4/week | ≥ 5/week |
| Weekly summary generated | No | Yes | Yes + emailed | Yes + emailed |
| Parent-friendly descriptions populated | 0/674 | 0 | 674/674 | 674/674 |
| Competencies defined | 0 | 0 | ~118 | ~118 |
| Intervention recommendations acted on | N/A | N/A | Track | ≥ 60% acted on |
| A/E ratio (items/day) | N/A | N/A | N/A | 0.8–1.2 |
| Credibility weight (Z) | 0 | 0.1–0.3 | 0.5–0.8 | ≥ 0.8 |
| Notification engagement rate | N/A | N/A | Track | ≥ 40% opened |
