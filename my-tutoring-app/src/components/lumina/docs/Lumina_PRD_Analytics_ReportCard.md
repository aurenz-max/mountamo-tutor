# Lumina PRD: Report Card, Analytics & Solvency Engine

**Covers: Student Analytics, Parent Report Card, Solvency Engine, Parent Portal**
**Version 1.1 | March 2026**
**Pulse Integration Update: v1.1 aligns all telemetry sources with Pulse (see companion Lumina_PRD_Pulse.md)**

---

## 1. Overview

This PRD defines how Lumina communicates student progress to parents and how the system assesses whether a student's learning trajectory is adequate. It covers four systems:

1. **Report Card** — The parent-facing view of student progress, designed from the end backward
2. **Analytics Engine** — The data aggregation and analysis layer that powers the report card
3. **Solvency Engine** — Continuous assessment of whether the student will meet curriculum goals (the insurance cash flow testing equivalent)
4. **Parent Portal** — The interface that surfaces all of the above

These systems consume telemetry produced by the Pulse adaptive learning loop (see companion Pulse PRD). The dependency is one-directional:

```
Pulse PRD                             This PRD
─────────                             ──────────
PulseEngine
  → pulse_sessions telemetry ────────→ Analytics Engine
  → mastery_lifecycle gate changes ──→   → Report Card
  → ability theta trajectory ────────→   → Solvency Engine
  → leapfrog inference events ───────→   → Parent Portal
                                         → Interventions
                                         → Knowledge Graph Progress
```

**Pulse context:** With Pulse, every practice session simultaneously produces diagnostic, instructional, and assessment data through a three-band model (Frontier Probes, Current Work, Trailing Review). Telemetry is richer than the legacy Daily Learning pipeline — each item carries band classification, IRT theta/beta updates, mode level, and potential leapfrog events. All analytics in this PRD consume `pulse_sessions` as the primary data source.

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
  • Blending sounds to make words — strengthening, getting stronger 📈
  • Recognizing rhyming words — just started, looking good ✨
  • Story sequencing — reviewing, nearly locked in! 🌟

🔢 Mathematics
  • Identifying shapes — reviewed, nearly mastered! 🌟
  • Counting to 20 — new this week
  • Multiplication basics — explored ahead and jumped 3 skills! 🚀
  • Sorting objects by category — needs more practice

🎉 Celebrations
  • Mastered: Rhyme Recognition (100% on retest!)
  • Jumped ahead 3 skills in Math — explored multiplication and aced it!
  • Perfect score on Dinosaur Fast Facts
  • 5-day learning streak!

📅 Coming next week
  • Letter formation practice (Language Arts)
  • Addition within 5 (Mathematics)
  • First science lesson: plant parts!
```

No gates. No completion factors. No velocity numbers. Just what happened, what was celebrated, and what's coming.

**Band-aware parent language:** Pulse bands map to natural parent-friendly verbs:

| Band | Parent Label | Example |
|---|---|---|
| Current | "strengthening" / "building" / "new this week" | "Blending sounds — strengthening" |
| Frontier (passed) | "explored ahead" / "jumped N skills" | "Multiplication — explored ahead and jumped 3 skills!" |
| Frontier (failed) | omitted from summary | No penalty; system learned the ceiling |
| Review | "reviewing" / "locked in" | "Story sequencing — reviewing, nearly locked in!" |

Leapfrog events are highlighted in the Celebrations section as they are naturally compelling parent moments.

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
        "first_in_domain" | "speed_record" |
        // Pulse-native achievement types:
        "leapfrog" | "frontier_success" | "earned_level_milestone" |
        "cold_start_complete" | "primitive_coverage_mastery",
  payload: {
    subskill_id?: string,
    competency_id?: string,
    score?: number,
    streak_days?: number,
    total_minutes?: number,
    subject?: string,
    detail: string,              // human-readable description
    // Pulse-specific payload fields:
    skills_inferred?: number,    // for leapfrog: how many skills were skipped
    session_id?: string,         // Pulse session that triggered the event
    earned_level?: number,       // for earned_level_milestone: new EL value
    frontier_probed?: string[],  // for frontier_success: which skills were probed
    primitives_covered?: string[] // for primitive_coverage_mastery: which primitives passed
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
      subskills_inferred: number,         // Pulse: skills gained via leapfrog inference
      competencies_closed: number,
      new_introductions: number,
      reviews_completed: number,
      avg_score: number,
      top_strength: string,               // highest-performing domain
      needs_attention: string,            // lowest-performing domain

      // Pulse-native fields:
      leapfrog_count: number,             // number of leapfrog events this week
      frontier_probes_attempted: number,  // frontier items attempted
      frontier_probes_passed: number,     // frontier items that triggered inference
      frontier_probe_success_rate: number,// passed / attempted
      avg_earned_level_delta: number,     // average theta change per session
      band_time_split: {                  // % of session time per band
        frontier_pct: number,
        current_pct: number,
        review_pct: number
      },
      cold_start_sessions: number         // sessions that were cold-start diagnostics
    }
  },
  achievements: achievement_event[],
  streak_current: number,
  streak_best: number
}
```

Updated nightly (or on Pulse session completion). The report card reads from this table, not raw `pulse_sessions` documents. The Pulse-native fields enable band-aware parent language (Section 3.2) and feed the solvency engine's leapfrog-adjusted run rate (Section 6.3).

---

## 5. Analytics Engine

### 5.1 Aggregation Pipeline

```
pulse_sessions (per session)
  → Session-level aggregates (computed on Pulse session completion)
    → Daily summary (computed nightly)
      → Weekly summary (computed Sunday night or on-demand)
        → Monthly summary (computed end of month)
          → Quarterly progress report (on-demand generation)
```

Each level computes progressively higher-level metrics:

| Level | Key Metrics |
|---|---|
| Session | Duration, items by band (frontier/current/review), theta changes, gate transitions, leapfrog events, primitive diversity, scores by band |
| Daily | Total learning time, subskills advanced (direct + inferred), closures, streak status, frontier probe success rate |
| Weekly | Subject-level progress, solvency ratios (leapfrog-adjusted), strengths/weaknesses, achievements, band time distribution, avg earned level delta |
| Monthly | Trajectory update, A/E ratios, competency progress, solvency scenario re-run, leapfrog acceleration factor |
| Quarterly | Full progress report, curriculum coverage, grade-level assessment, knowledge graph coverage map |

### 5.2 Derived Metrics

#### Subject Health Score

A composite score that drives the Level 0 status indicator:

```
subject_health = weighted_average(
  solvency_ratio × 0.35,              // are we on pace? (leapfrog-adjusted, see §6.3.2)
  recent_mastery_rate × 0.25,         // are recent sessions producing closures? (direct + inferred)
  engagement_consistency × 0.20,      // is the student showing up regularly?
  frontier_expansion_rate × 0.10,     // Pulse: how fast is the DAG frontier moving?
  score_trend × 0.10                  // are theta trajectories improving or declining?
)

frontier_expansion_rate:
  = new_frontier_nodes_unlocked_last_14d / total_remaining_not_started
  Measures how quickly the student is opening up new territory in the knowledge graph.
  High rate + low solvency → student is exploring broadly but not closing
  Low rate + high solvency → student is consolidating depth (healthy)

Mapping:
  health ≥ 0.8  → "On Track"
  health 0.5–0.8 → "Needs Push"
  health 0.3–0.5 → "Behind"
  health < 0.3  → "Critically Behind"
```

#### Strength & Weakness Detection

```
For each curriculum domain (unit level):
  domain_theta = avg(theta) across skills in domain (from ability docs)
  domain_trajectory = slope of theta over last 14 days
  domain_gate_progress = avg(current_gate) across subskills in domain

  // Theta is a more calibrated signal than raw scores because IRT
  // accounts for item difficulty — a 7/10 on a hard item (high beta)
  // is stronger evidence than 9/10 on an easy item (low beta).

Strength: domain_theta > subject_avg_theta AND trajectory ≥ 0
Weakness: domain_theta < subject_avg_theta AND trajectory ≤ 0
Emerging: domain_theta < subject_avg_theta BUT trajectory > 0
```

Report card shows the top 2 strengths and top 2 weaknesses per subject.

**Frontier awareness:** Domains where frontier probes have succeeded (leapfrog events) are boosted in strength detection — if the student jumped ahead in a domain, that's a strong signal even if theta data is sparse.

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
| Demonstrated throughput | `pulse_sessions`: items/day, mastery rates, time/item, leapfrog rate | Use assumed values |
| Leapfrog acceleration | `pulse_sessions`: skills inferred per session, frontier probe success rate | Use 0 (conservative) |
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

#### 6.3.2 Demonstrated Daily Run Rate (Pulse-Adjusted)

```
// Decompose closures into direct and inferred (leapfrog)
direct_closures_per_day = direct_gate_transitions_last_N_days / N
inferred_closures_per_day = leapfrog_inferred_skills_last_N_days / N

// Inferred closures enter at Gate 2 — they still need retest verification.
// Apply a conversion factor: what % of inferred skills survive retest?
// Early default: 0.85 (conservative; most inferred mastery should hold).
// Updated from experience data once available.
inferred_conversion_rate = 0.85

actual_closures_per_day = direct_closures_per_day
                        + (inferred_closures_per_day × inferred_conversion_rate)

Where N = rolling window:
  If < 14 days of data: use all available data
  If 14–28 days: use 14-day window
  If > 28 days: use 28-day window (more recent = more relevant)
```

**Leapfrog timing caveat:** A student who leapfrogs 5 skills today will show a temporarily inflated run rate. But those 5 skills all come due for retest in 3 days, creating a review surge. The solvency engine should model this pipeline effect — leapfrog gains are real but create a delayed review cost. The pipeline adequacy test (Section 6.5) catches this.

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

**Assumed rates (initial, Pulse-native):**

| Parameter | Assumed Value | Basis |
|---|---|---|
| Items per Pulse session | 15 | Default PulseEngine session size |
| Sessions per day | 1.3 | ~1 full session + occasional second |
| Frontier probe success rate | 30% | Conservative; most probes fail (finding the ceiling) |
| Leapfrog yield (skills per success) | 3 | Average DAG inference chain length |
| Inferred-to-closed conversion rate | 85% | % of inferred skills that survive retest |
| First-attempt mastery rate (current band) | 60% | Moderate difficulty |
| Days per week | 4 | Allows for off days |
| Time per Pulse session | 25 min | 15 items, ~100s per item average |

These assumed values should be reviewed and adjusted based on curriculum design intent and early Pulse session observations.

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

// Pulse adjustment: leapfrog dumps batches of skills into Gate 2 simultaneously.
// Track the "leapfrog surge" — inferred skills pending first retest.
leapfrog_pending = count(skills where gate == 2 AND prior_source == "pulse_leapfrog"
                         AND next_retest_eligible <= now + 7d)
pipeline_with_surge = actual_pipeline + leapfrog_pending

If pipeline_adequacy < 0.5:
  → "Pipeline deficit: introduction rate needs to increase to build
     sufficient review inventory"

If pipeline_adequacy > 2.0 AND leapfrog_pending > 0.5 × actual_pipeline:
  → "Leapfrog review surge: recent breakthroughs created a review backlog.
     Next 2-3 sessions will be review-heavy — this is expected and temporary."

If pipeline_adequacy > 2.0 AND leapfrog_pending < 0.2 × actual_pipeline:
  → "Pipeline surplus: review burden may be crowding introductions.
     Consider accelerating closures or graduating stable reviews
     to longer intervals."
```

This is the metric that directly addresses the introduction bottleneck identified in the velocity decomposition. A pipeline deficit means we need to introduce faster. A pipeline surplus means reviews are dominating. With Pulse, leapfrog events create temporary but predictable review surges that should not be treated as chronic pipeline surplus.

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
| Frontier ceiling reached | 5+ consecutive frontier probe failures in a subject | "Student has reached their current ceiling in {subject}. Pulse will consolidate current skills before probing further ahead." |
| Leapfrog review surge | Leapfrog created >10 pending retests in one session | "Recent breakthroughs created a review backlog. Next 2-3 sessions will be review-heavy — this is expected and temporary." |
| Theta plateau | Theta flat (< 0.2 change) for 10+ items in a skill | "Student may need a different approach for {skill}. Pulse will vary primitive types and scaffolding modes." |
| Inferred mastery retest failure | >30% of leapfrog-inferred skills fail first retest | "Frontier probes may be over-crediting mastery. Consider: tightening the probe pass threshold or reducing inference chain depth." |

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
- **Session status card:** Not Started / In Progress (with live stats) / Complete (with summary including band breakdown)
- **"Start Pulse" button:** Launches Pulse session. Prominent, primary action. Subject selector if multiple subjects active.
- **Knowledge map preview:** Mini DAG visualization showing current frontier position and recent expansion. Replaces the static "today's plan preview" — with Pulse, sessions are assembled dynamically so there is no pre-planned lesson list.
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
| Session not started | "Ready to learn today? Tap to start a Pulse session (~25 min)" | Push | Configurable (default 10am) |
| Session complete | "Great Pulse session! Completed 15 items in 24 minutes. 🌟" | Push | Immediately |
| Skill mastered | "[Child] mastered rhyming words! 🏆" | Push | Immediately |
| Leapfrog event | "[Child] jumped ahead 4 skills in Math today! 🚀" | Push | Immediately |
| Earned level milestone | "[Child] reached Level 7.0 in Addition — that's expert level! ⭐" | Push | On milestone |
| Weekly summary | Level 1 report card content (with band-aware language) | Email | Sunday evening |
| Streak milestone | "5-day streak! Consistency is the secret! 🔥" | Push | On milestone |
| Solvency alert | "Language Arts could use a boost — here are 3 suggestions..." | Email + in-app banner | Weekly (if triggered) |
| Progress milestone | "50 subskills mastered! Halfway through core Language Arts!" | Push | On milestone |
| Monthly report | Level 2 report card content | Email | 1st of month |

---

## 8. Knowledge Graph Progress (Pulse-Native)

### 8.1 Purpose

The knowledge graph progress endpoint is the anchor analytics view for Pulse. It surfaces the DAG structure that Pulse operates on — showing parents and developers where the student sits in the curriculum graph, how their frontier is expanding, and where leapfrog inference has accelerated progress.

This powers:
- The **knowledge map preview** on the parent portal home (Section 7.2.1)
- The **knowledge map delta** in PulseSummary (Pulse PRD Section 9.1)
- The **Level 3 advanced analytics** prerequisite chain visualization (Section 3.4)
- The **competency rollup** by showing which competency clusters are mastered vs in-progress

### 8.2 Data Model

```
knowledge_graph_progress: {
  student_id: int,
  subject: string,
  generated_at: timestamp,

  // DAG coverage summary
  total_nodes: number,                  // total subskills in subject DAG
  mastered_direct: number,              // Gate 4 via direct lesson/practice path
  mastered_inferred: number,            // Gate 2+ via leapfrog inference (pending retest verification)
  in_progress: number,                  // Gate 0-1, actively being worked on
  in_review: number,                    // Gate 1-3, retests pending
  not_started: number,                  // no mastery_lifecycle doc or Gate 0 unlocked but untouched
  locked: number,                       // prerequisites not met

  // Frontier
  frontier_node_ids: string[],          // currently unlocked Gate 0 nodes
  frontier_depth: number,               // average topological depth of frontier
  max_depth: number,                    // deepest node in DAG
  frontier_expansion_velocity: number,  // new frontier nodes per session (rolling 7d avg)

  // Leapfrog history
  total_leapfrogs: number,
  total_skills_inferred: number,
  leapfrog_retest_pass_rate: number,    // % of inferred skills that survived retest (A/E)

  // Per-node detail (for graph visualization)
  nodes: [
    {
      subskill_id: string,
      skill_id: string,
      description: string,
      parent_description?: string,       // parent-friendly name if populated
      depth: number,                      // topological depth in DAG
      status: "mastered" | "inferred" | "in_review" | "in_progress" |
              "frontier" | "not_started" | "locked",
      current_gate: number,               // 0-4
      theta?: number,                     // student ability for this skill
      earned_level?: number,
      inferred_from?: string,             // if status=inferred, which leapfrog probe triggered it
      competency_id?: string,
      prerequisite_ids: string[],         // parent node IDs in DAG
      dependent_ids: string[]             // child node IDs in DAG
    }
  ],

  // Competency rollup
  competencies: [
    {
      competency_id: string,
      name: string,
      total_subskills: number,
      mastered: number,                   // direct + inferred that survived retest
      in_progress: number,
      status: "mastered" | "in_progress" | "not_started"
    }
  ]
}
```

### 8.3 API Endpoint

```
GET /api/analytics/student/{student_id}/knowledge-graph?subject={subject}

Response: knowledge_graph_progress

Query params:
  subject (required): Subject to query DAG for
  include_nodes (optional, default true): Include per-node detail array
  depth_limit (optional): Only return nodes up to this topological depth
```

This endpoint reads from:
- `curriculum_graphs/{subject}/published` — DAG structure (nodes + edges)
- `students/{id}/mastery_lifecycle/{subskill_id}` — gate state per node
- `students/{id}/ability/{skill_id}` — theta per skill
- `pulse_sessions` — leapfrog history for inference tracking

### 8.4 Parent vs Developer View

| Field | Parent View (Level 0-2) | Developer View (Level 3) |
|---|---|---|
| Coverage summary | "65% of Math explored" | `mastered_direct: 40, mastered_inferred: 12, in_progress: 8, ...` |
| Frontier | "Working on: Addition, Subtraction" | Full frontier node list with theta values |
| Leapfrog | "Jumped ahead 3 times this month!" | `leapfrog_retest_pass_rate: 0.87, total_skills_inferred: 14` |
| Graph visualization | Simplified cluster map (competency bubbles) | Full DAG with node-level status coloring |
| Competency rollup | "4 of 30 math skills mastered" | Per-competency with subskill breakdown |

---

## 9. Data Model Additions

### 9.1 New Firestore Collections

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

### 9.2 Subskill Field Additions

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

## 10. Requirements Summary

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
| RA-027 | Knowledge graph progress endpoint | Per-subject DAG coverage, frontier position, leapfrog history, per-node status (Section 8) |
| RA-028 | Pulse session aggregation | Weekly summary consumes `pulse_sessions` with band splits, theta deltas, leapfrog counts (Section 4.2.4) |
| RA-029 | Leapfrog-adjusted solvency | Solvency run rate decomposes direct + inferred closures with conversion factor (Section 6.3.2) |
| RA-030 | Pulse achievement events | Achievement system includes leapfrog, frontier_success, earned_level_milestone, cold_start_complete (Section 4.2.3) |

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

## 11. Success Metrics

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
| Leapfrog retest pass rate | N/A | Track | ≥ 80% | ≥ 85% |
| Frontier probe success rate | N/A | Track | Track | 25-40% (calibrated) |
| Knowledge graph coverage (any subject) | N/A | Endpoint live | Visualized in portal | Parent-friendly cluster map |
| Avg earned level delta per week | N/A | Track | Positive trend | Positive trend |
