# Lumina PRD: Daily Learning Experience

**Covers: Session Runner, Lesson Architecture, Earned-Level Planning, Pulse Integration**
**Version 2.0 | March 2026**

> **What's new in v2.0:** Architectural redesign. Daily session is now a two-phase pipeline: Lessons (focused instruction on weak areas) followed by Pulse (adaptive practice with spaced repetition + frontier probing). Earned Level (theta) drives subject selection and frontier targeting. Session runner is a lightweight orchestrator inspired by CuratorBrief — it explains what's happening and what's coming, but all pedagogical intelligence lives in the planning engine and Pulse. Sections 1, 3, 4 rewritten. Sections 2, 5, 6 retained with minor updates. Implementation status (sections 9-10) updated for v2.0 scope.
>
> **Prior versions:** v1.2 shipped session transitions, break screens, curriculum context wiring. v1.1 shipped frontend session driver and backend planning API.

---

## 1. Overview

### 1.1 The Daily Loop

A student's day on Lumina has two phases:

```
LESSON PHASE (20-30 min)                    PULSE PHASE (30-45 min)
Focused instruction on weak subjects   →    Adaptive practice across all subjects
Bloom's-scaffolded lesson groups       →    3-band item selection (review/current/frontier)
Earned Level drives subject selection  →    IRT theta drives mode & difficulty
Results seed Pulse's "current" band    →    Results feed back to next day's planning
```

**Phase 1: Lessons** — The planner identifies 1-3 subjects where the student has the lowest Earned Level relative to grade expectations. It assembles lesson groups from realistically groupable subskills at the student's current location and near-frontier. Each lesson takes 10-20 minutes and uses Bloom's-scaffolded exhibits (Identify → Explain → Apply). This is the **teaching** phase.

**Phase 2: Pulse** — After lessons complete, the student transitions to Pulse for adaptive practice. Pulse assembles items across three bands: trailing review (spaced repetition of previously learned material), current work (reinforcing today's lesson topics + other frontier skills), and frontier probes (skills 1-5 DAG edges ahead that the student has a good chance of demonstrating). This is the **practice + acceleration** phase.

The session runner orchestrates both phases with CuratorBrief-style transition screens that explain what the student is doing and what's coming next.

```
Curriculum (674 subskills)
  → Earned Level analysis (identify weak subjects)
    → Lesson Groups (subskills bundled by domain + Bloom's)
      → Session Runner (explains what's coming, manages transitions)
        → Lesson Phase (1-3 focused exhibits)
          → Break + Pulse Transition (CuratorBrief-style preview)
            → Pulse Phase (review + current + frontier)
              → Telemetry (per-subskill performance)
                → Mastery Engine (gates, IRT, leapfrog)
                  → Planning Engine (next day's Earned Level → subject selection)
```

The daily loop is: **Assess EL → Teach weak areas → Practice adaptively → Capture → Update → Repeat.**

### 1.2 Why Two Phases

The v1.x model treated all daily activity as lesson blocks — 4-5 blocks filling a 75-minute budget. This created two problems:

1. **All lesson, no acceleration.** Every block was a full Bloom's-cycle exhibit. A student who already understood the material couldn't skip ahead — they had to complete every phase. Pulse (with frontier probes and leapfrog logic) was a separate panel the student had to manually navigate to.

2. **Lesson blocks as practice.** Review and retest blocks used the same exhibit generation pipeline as new lessons, producing unnecessarily heavy scaffolding for material the student already knew. Pulse's IRT-calibrated mode selection (theta → mode) is a better fit for review.

The two-phase model assigns each system to what it does best:
- **Lessons** teach new material with structured scaffolding (Bloom's phases, full exhibits)
- **Pulse** practices, reviews, and probes with adaptive difficulty (IRT theta, 3-band selection)

### 1.3 Earned Level as the Driver

The Earned Level (EL) is a 0.0-10.0 continuous scale derived from IRT theta, computed per-subskill via Bayesian grid-approximation EAP update (see `CalibrationSimulator.tsx` for the full implementation). Key properties:

- **Per-subskill theta** tracks ability on a continuous scale, not just pass/fail gates
- **Mode mapping** (theta → mode 1-6) determines scaffolding level automatically
- **Gate thresholds** are derived from each primitive's beta range: `spread = max(2.5, maxBeta + 1.0 - minBeta)`, gates at 20/45/75/100% of spread
- **Subject-level EL** = weighted average of subskill thetas within the subject, weighted by curriculum importance

The planner uses subject-level EL to answer: "Which subjects does this student most need lesson time in?" Low EL subjects get more lesson blocks. High EL subjects get Pulse practice only.

---

## 2. Lesson Architecture

### 2.1 The Core Insight

The lesson is the atomic unit of *time*. The subskill is the atomic unit of *tracking*. A single 15-20 minute lesson advances 2-5 related subskills simultaneously because Bloom's taxonomy naturally scaffolds from simpler to more complex within the same domain.

This resolves the structural pacing problem:

| Model | Total Instruction Time | Fits in School Year? |
|---|---|---|
| **Ungrouped** (1 subskill = 1 lesson) | 674 x 15 min + reviews ~ 21,000 min | No (~70 weeks needed) |
| **Grouped** (3 subskills = 1 lesson) | 225 x 18 min + reviews ~ 8,550 min | Yes (~28.5 weeks + 7.5 week buffer) |

### 2.2 Lesson Group Definition

A **Lesson Group** is a set of 2-5 related subskills that share a domain and form a natural Bloom's progression.

```
lesson_group: {
  id: string,
  domain: string,                     // curriculum unit path
  subskill_ids: string[],            // ordered by Bloom's level
  bloom_mapping: {
    identify: [subskill_id, ...],
    explain: [subskill_id, ...],
    apply: [subskill_id, ...]
  },
  tier: "core" | "extended" | "enrichment",
  estimated_duration_minutes: number,
  primitive_affinities: string[],     // preferred primitive types
  is_standalone: boolean              // true if ungroupable (1 subskill)
}
```

#### Grouping Rules

1. **Same domain.** Subskills must belong to the same curriculum unit or closely related units.
2. **Bloom's-orderable.** Subskills must form a natural Identify -> Explain -> Apply progression.
3. **Prerequisite-compatible.** If subskill B requires A, they can be grouped only if A maps to an earlier Bloom's phase.
4. **Size: 2-5 subskills.** Fewer than 2 adds no value. More than 5 dilutes depth.
5. **Ungroupable subskills remain standalone.** Complex subskills that need a full lesson keep the 1:1 mapping.

#### Prerequisite Handling

The Bloom's progression within a lesson IS the prerequisite chain. "Recognize if two spoken words rhyme" (Identify) is taught before "Identify the rhyming word from a set of three" (Explain) because that's how the lesson naturally flows. The prerequisite is satisfied within the lesson rather than across separate sessions on separate days.

The gate system still enforces mastery prerequisites at the tracking level: if a student passes the Identify phase but fails Apply, the tracker advances the Identify subskill's gate while rescheduling Apply for additional practice. Teaching is bundled; tracking stays granular.

For long prerequisite chains (A -> B -> C -> D -> E), split into groups of 2-3 at natural breakpoints:
- Group 1: A + B (Identify + Explain)
- Group 2: C + D (Explain + Apply, with Group 1 as prerequisite)
- Group 3: E standalone (capstone)

### 2.3 Lesson Structure

Each lesson retains the proven structure:

| Phase | Bloom's Level | Primitives | Duration |
|---|---|---|---|
| Phase 1 | Identify | 3-4 primitives targeting recognition/identification | ~5-6 min |
| Phase 2 | Explain | 3-4 primitives targeting discrimination/explanation | ~5-6 min |
| Phase 3 | Apply | 3-4 primitives targeting production/application | ~5-6 min |

Total: 9-12 primitives, 15-20 minutes.

Each phase's learning objective targets a *different subskill* within the lesson group, rather than three objectives targeting the same subskill.

### 2.4 Worked Example: Rhyming Lesson

**Grouped model (1 lesson, 1 day):**

| Phase | Learning Objective | Subskill Advanced | Primitives | Time |
|---|---|---|---|---|
| Identify | Recognize when two words rhyme | PA-RRP-01 | Rhyme Studio (listen + identify pairs), Sound Swap (rhyming vs. non-rhyming), Phoneme Explorer (rhyme family visual) | ~6 min |
| Explain | Pick the rhyming word from a group | PA-RRP-02 | Rhyme Studio (select from 3), Knowledge Check (which rhymes with "cat"?), Fast Fact (rhyme ID speed round) | ~6 min |
| Apply | Generate a rhyming word | PA-RRP-03 | Sound Swap (change onset), Phonics Blender (build rhyming words), Self-Check ("tell me a word that rhymes with 'sun'") | ~6 min |
| **Total** | | **3 subskills** | **9 primitives** | **~18 min, 1 day** |

### 2.5 Mixed Gate States

In practice, subskills within a group won't always be at the same gate. The lesson generator adapts:

| Scenario | Generator Behavior |
|---|---|
| All NEW | Full lesson depth: rich scaffolding, examples, guided exploration |
| Some NEW, some REVIEW | NEW subskills get lesson-depth primitives (more scaffolding). REVIEW subskills get practice-depth primitives (less scaffolding, more assessment). Phase order unchanged. |
| All REVIEW | Practice session: reduced scaffolding, assessment-heavy, faster pacing. Shorter duration (~10 min). |
| One needs RETEST | Retest primitives at the appropriate Bloom's phase. Other phases proceed at their gate level. |

### 2.6 Partial Group Scheduling

When some subskills in a group are already mastered, the planner schedules a partial group:

```
{
  lesson_group: "rhyme-recognition-production",
  active_subskills: ["PA-RRP-03"],      // only unmastered
  gates: ["practice"],
  supplementary_review: ["PA-RRP-01"],  // light touch on mastered
  time_estimate: 10 min
}
```

### 2.7 Lesson Generation Requirements

**Input:** The generator receives a lesson group spec:

```
{
  lesson_group_id: "rhyme-recognition-production",
  subskills: [
    { id: "PA-RRP-01", bloom_phase: "identify", gate: "lesson", status: "new" },
    { id: "PA-RRP-02", bloom_phase: "explain", gate: "lesson", status: "new" },
    { id: "PA-RRP-03", bloom_phase: "apply",   gate: "lesson", status: "new" }
  ],
  domain: "Phonological & Phonemic Awareness / Rhyme Recognition & Production",
  grade: "K",
  primitive_preferences: ["rhyme_studio", "sound_swap", "phoneme_explorer"]
}
```

**Output:** 3 phases x 3-4 primitives, each phase tagged with its target subskill ID for telemetry attribution.

---

## 3. Planning Engine

### 3.1 Earned-Level Subject Selection

The planner's first job is deciding **which subjects need lessons today**. This is driven entirely by Earned Level:

```
Algorithm: select_lesson_subjects(student_id)

1. LOAD SUBJECT ELs
   For each subject in curriculum:
     subskill_thetas = [ability.theta for ability in subject_abilities]
     subject_el = weighted_avg(subskill_thetas, weights=curriculum_importance)
     grade_target = expected_el_for_grade(subject, current_date)
     el_deficit = grade_target - subject_el

2. RANK BY DEFICIT
   Sort subjects by el_deficit DESC (largest gap first)
   Filter to subjects with el_deficit > 0 (below grade level)

3. SELECT 1-3 SUBJECTS
   Take top 1-3 subjects by deficit
   If all subjects are at or above grade level:
     Select 1 subject with the most frontier skills available

4. ALLOCATE LESSON TIME
   lesson_budget = daily_budget_minutes * lesson_phase_pct  // e.g., 75 * 0.35 = ~26 min
   Distribute proportionally by el_deficit
   Each subject gets at least 1 lesson group
```

This ensures the student spends lesson time on subjects where they're falling behind, not uniformly across all subjects.

### 3.2 Frontier Skill Selection

Within each selected subject, the planner picks lesson groups from subskills the student has a **realistic chance of accomplishing**:

```
Algorithm: select_lesson_groups(student_id, subject, budget_minutes)

1. COMPUTE FRONTIER
   unlocked = LearningPathsService.get_unlocked_entities(student_id, subject)
   gate_0_or_1 = [lc for lc in lifecycles if lc.current_gate in (0, 1)]
   candidates = unlocked & gate_0_or_1

2. FILTER BY REACHABILITY
   For each candidate subskill:
     theta = student_ability[skill_id].theta
     target_gate_1_theta = compute_gate_thresholds(maxBeta, minBeta)[0].minTheta
     gap = target_gate_1_theta - theta
   Sort by gap ASC (closest to Gate 1 first = highest chance of success)

3. GROUP INTO LESSON BLOCKS
   group_subskills_into_blocks(candidates)
   Fill budget_minutes with lesson groups
   Prefer groups where all subskills are near-frontier (high success probability)
```

The key insight: pick subskills where the student's theta is close to the Gate 1 threshold, not just the next subskill in the curriculum sequence. A student with theta 2.8 on a primitive with G1 at 2.0 is a better lesson candidate than one with theta 1.0 and G1 at 3.5.

### 3.3 Time Budget Split

```
daily_budget_minutes: 75  (configurable per student)

lesson_phase_pct: 0.35        // ~26 min for lessons
pulse_phase_pct: 0.65         // ~49 min for Pulse
transition_overhead: 5 min    // CuratorBrief screens, breaks

Actual split adjusts based on available content:
  - Cold start (no mastery docs): 60% lesson / 40% Pulse
  - Heavy review backlog:         20% lesson / 80% Pulse
  - All subjects at grade level:  15% lesson / 85% Pulse (enrichment)
  - Major deficits in 2+ subjects: 45% lesson / 55% Pulse
```

### 3.4 Session Shape

The planner assembles the full daily plan:

```
daily_plan: {
  // Lesson phase
  lesson_blocks: [
    {
      lesson_group_id: string,
      subject: string,
      subskills: [{ id, bloom_phase, gate, status, theta }],
      estimated_minutes: number,
      rationale: string      // e.g., "ELA Earned Level 2.3 — below grade target 4.0"
    }
  ],
  lesson_budget_minutes: number,

  // Pulse phase
  pulse_config: {
    subjects: string[],              // all subjects, not just lesson subjects
    review_pct: 0.15,                // spaced rep
    current_pct: 0.65,               // includes today's lesson topics
    frontier_pct: 0.20,              // probe ahead
    item_count: 15,
    include_lesson_topics: true,     // seed current band with today's lesson subskills
  },
  pulse_budget_minutes: number,

  // Session metadata
  total_budget_minutes: number,
  subjects_targeted: string[],
  el_deficits: Record<string, number>,
}
```

**Session structure:**

```
+---------------------------------------------+
|  LESSON PHASE                                |
|                                              |
|  CuratorBrief: "Today's Focus"               |
|    - Subject A: what you'll learn, why       |
|    - Subject B: what you'll learn, why       |
|    - Estimated time, what's coming next      |
|                                              |
|  Block 1: Lesson Group (~15-20 min)          |
|    Subject A — full Bloom's cycle            |
|    Phase 1: Identify (3-4 primitives)        |
|    Phase 2: Explain  (3-4 primitives)        |
|    Phase 3: Apply    (3-4 primitives)        |
|                                              |
|  Transition: "Great work! One more lesson."  |
|                                              |
|  Block 2: Lesson Group (~10-15 min)          |
|    Subject B — Bloom's cycle (may be shorter)|
|                                              |
|  Break + Pulse Preview                       |
|    "Now let's practice! Here's what's coming"|
|    - Review: skills you've seen before       |
|    - Practice: today's lesson + frontier      |
|    - Explore: can you do something new?      |
+---------------------------------------------+
|  PULSE PHASE                                 |
|                                              |
|  Pulse takes over with 3-band session        |
|  (see Lumina_PRD_Pulse.md)                   |
|                                              |
|  Items interleaved:                          |
|    review → current → current → frontier →   |
|    current → review → current → frontier ... |
|                                              |
|  Leapfrog celebrations inline                |
|  Session summary at end                      |
+---------------------------------------------+
|  SESSION COMPLETE                            |
|  Celebration + EL progress summary           |
+---------------------------------------------+
```

---

## 4. Session Runner

### 4.1 Design Philosophy

The session runner is intentionally "dumb." It does not make pedagogical decisions — those live in the planning engine (subject selection, lesson group assembly) and Pulse (IRT-driven item selection, leapfrog logic). The session runner's job is:

1. **Explain what's happening** — CuratorBrief-style screens before each phase
2. **Show what's coming** — Preview of upcoming blocks and the Pulse phase
3. **Manage transitions** — Breaks, celebrations, phase handoffs
4. **Track progress** — Visual indicators of session completion

Inspiration: `CuratorBrief.tsx` — a section-by-section walkthrough with navigation, previews, and encouragement. The session runner applies this pattern to the session level: each phase gets a brief that orients the student.

### 4.2 Session Phases

The session runner manages three sequential phases:

**Phase 1: Session Brief (2-3 min)**

A CuratorBrief-style introduction to today's session:

```
Session Brief Sections:
  - "Today's Focus" — which subjects and why
    "We're going to work on reading today because you're building
     your skills there. Then we'll practice everything!"
  - "What You'll Learn" — lesson objectives in student-friendly language
    "You'll learn about rhyming words and how stories are put together."
  - "The Plan" — roadmap showing lesson → practice → explore
    Phase 1: Learn (2 lessons, ~25 min)
    Phase 2: Practice & Explore (Pulse, ~40 min)
  - "Let's Go!" — CTA to start
```

This is NOT an interactive learning component. It's a 30-60 second orientation that the student clicks through or skips.

**Phase 2: Lesson Phase (20-30 min)**

Standard lesson block execution from v1.x:
- Block cards showing lesson groups with Bloom's phase pills
- Sequential block completion (start → exhibit → break → next block)
- Curriculum context wiring (real subskill IDs to Firestore)
- Between-block transitions with progress dots

The only v2.0 change: fewer blocks (1-3 instead of 4-5) because review/retest duties move to Pulse.

**Phase 3: Pulse Phase (30-45 min)**

After the last lesson block completes, the session runner transitions to Pulse:
- Break screen with Pulse preview (CuratorBrief-style: "Now let's practice!")
- Preview shows the three bands: "Quick reviews, today's topics, and something new"
- Student clicks "Start Pulse" → PulseSession component takes over
- Pulse runs independently (its own session hook, item hydration, result processing)
- When Pulse completes, session runner shows the unified session summary

### 4.3 Transition Design

**Lesson Brief → First Lesson Block:**
CuratorBrief auto-advances or student clicks "Let's Go!" Block loads immediately (pre-generated during brief display if possible).

**Between Lesson Blocks:**
Existing `SessionBreakScreen` with progress dots, 60s countdown, next-block preview. Unchanged from v1.2.

**Last Lesson Block → Pulse:**
Special transition screen (not the standard break screen):

```
Transition: Lesson Complete → Pulse
  - "Lesson Phase Complete!" celebration
  - Progress: "You finished 2 lesson blocks"
  - Preview: "Now it's time to practice!"
  - Three-band preview:
    "Review" — "Quick check on things you've learned before"
    "Practice" — "More work on today's topics plus other skills"
    "Explore" — "Can you handle something you haven't seen yet?"
  - CTA: "Start Practice" → launches PulseSession
```

**Pulse Complete → Session Summary:**
Pulse fires its own completion callback. Session runner aggregates lesson phase results + Pulse summary into one unified view.

### 4.4 Session Lifecycle

```
STATES:
  NOT_STARTED
    → BRIEFING (CuratorBrief session preview)
    → LESSON_ACTIVE (executing lesson blocks)
    → LESSON_BREAK (between lesson blocks)
    → LESSON_COMPLETE (transition to Pulse)
    → PULSE_ACTIVE (Pulse running)
    → COMPLETED | ENDED_EARLY

Events:
  session_start      → show session brief
  brief_complete     → start first lesson block
  lesson_block_start → load exhibit
  lesson_block_end   → break screen or Pulse transition
  pulse_start        → launch PulseSession with session config
  pulse_complete     → show unified summary
  session_complete   → celebration, write telemetry
  session_end_early  → partial telemetry, note incomplete phases
```

### 4.5 Unified Session Summary

At session end, combine both phases:

```
Session Summary:
  LESSON PHASE
    - Blocks completed: 2
    - Subskills introduced: 5
    - Avg score: 82%
    - Subjects: ELA, Math

  PULSE PHASE
    - Items completed: 14/15
    - Reviews passed: 3/3
    - Current work score: 78%
    - Frontier probes: 1 passed → leapfrog! (4 skills skipped)
    - EL changes: ELA 2.3 → 2.8, Math 3.1 → 3.4

  TODAY'S HIGHLIGHTS
    - "You learned about rhyming words!"
    - "You jumped ahead 4 skills in math!"
    - "You reviewed counting and got 100%!"

  STREAK: Day 7
```

### 4.6 Parent Controls

Unchanged from v1.x. Available via PIN-protected panel:

| Control | Behavior |
|---|---|
| **Pause** | Freezes session. Works in both lesson and Pulse phases. |
| **Skip block/item** | Lesson: skip current block. Pulse: skip current item. |
| **End session** | Completes session with partial data. |
| **Adjust time** | Extend or shorten budget. Planner/Pulse adjust. |
| **View progress** | Overlay showing blocks/items completed, time, EL. |

---

## 5. Session Telemetry

### 5.1 Unified Telemetry Schema

v2.0 captures both phases in a single session record:

```
session_telemetry: {
  session_id: string,
  student_id: string,
  date: date,
  started_at: timestamp,
  completed_at: timestamp,
  status: "completed" | "ended_early" | "abandoned",
  planned_budget_minutes: number,
  actual_duration_minutes: number,

  // Lesson phase
  lesson_phase: {
    blocks_planned: number,
    blocks_completed: number,
    duration_minutes: number,
    subjects: string[],
    el_deficits_at_start: Record<string, number>,

    blocks: [
      {
        block_id: string,
        lesson_group_id: string,
        subject: string,
        started_at: timestamp,
        completed_at: timestamp,
        duration_minutes: number,
        phases: [
          {
            bloom_phase: "identify" | "explain" | "apply",
            subskill_id: string,
            primitives: [
              {
                primitive_type: string,
                duration_seconds: number,
                score: number | null,
                passed: boolean | null,
              }
            ],
            phase_score: number,
            phase_passed: boolean,
          }
        ],
        block_score: number
      }
    ]
  },

  // Pulse phase
  pulse_phase: {
    pulse_session_id: string,       // reference to pulse_sessions/{id}
    items_completed: number,
    items_total: number,
    duration_minutes: number,
    bands: {
      review:   { items: number, avg_score: number },
      current:  { items: number, avg_score: number },
      frontier: { items: number, avg_score: number },
    },
    leapfrogs: number,
    skills_advanced: number,
  },

  // Session-level aggregates
  total_subskills_advanced: number,
  el_changes: Record<string, { before: number, after: number }>,
  new_introductions: number,
  reviews_completed: number,
}
```

### 5.2 Telemetry -> Calibration Pipeline

After each session, telemetry flows into calibration:

**Primitive time calibration:**
```
For each primitive completion:
  Update primitive_type running average
  Recalculate credibility weight: Z = min(1, total_completions / 20)
  New calibrated_time = Z x actual_avg + (1 - Z) x assumed
```

**Lesson group time calibration:**
```
For each completed lesson group:
  actual_duration = block.duration_minutes
  Update lesson_group running average
  Planner uses calibrated lesson group time for future scheduling
```

**EL velocity tracking:**
```
For each session:
  Track el_change per subject per session
  Compute trailing average: el_velocity = avg(el_changes[-5:])
  Planner uses el_velocity to predict time-to-grade-level per subject
```

---

## 6. Lesson Group Creation

### 6.1 Automated Grouping Engine

A rule-based system groups subskills within the same curriculum unit:

```
Algorithm: auto_group(unit_subskills)

1. Filter to subskills within the same unit
2. For each subskill, assign a Bloom's level based on:
   - Verb analysis: "recognize", "identify" -> Identify
   - Verb analysis: "explain", "compare", "match" -> Explain
   - Verb analysis: "produce", "create", "sort", "apply" -> Apply
3. Group subskills that share a domain concept:
   - Same parent skill in the curriculum hierarchy
   - Or: semantic similarity above threshold (LLM-assisted)
4. Within each group, order by Bloom's level
5. Validate:
   - Group size 2-5? If >5, split at natural breakpoint
   - Prerequisite chain respected? (earlier Bloom's = earlier prereq)
   - Estimated duration reasonable? (< 25 min)
6. Output: lesson_group records ready for Firestore
```

Coverage expectation: ~70% of subskills auto-group cleanly. The remaining 30% need AI-assisted or manual grouping.

### 6.2 AI-Assisted Grouping

For edge cases -- subskills that span units, ambiguous Bloom's mappings, or complex prerequisite chains -- use the LLM to propose groupings. Human review before committing.

### 6.3 Experience-Driven Regrouping

After sufficient telemetry, analyze co-mastery patterns:
- If students who master subskill A almost always master B in the same session -> group them
- If a lesson group consistently has one phase with low scores while others pass -> consider splitting
- If a lesson group consistently completes in < 10 min -> consider merging with an adjacent group

---

## 7. Pulse Integration

### 7.1 Lesson Phase Feeds Pulse

When the lesson phase completes, the planning engine passes context to Pulse's session assembler:

```
pulse_seed: {
  lesson_subskills: string[],       // subskills from today's lessons
  lesson_subjects: string[],        // subjects that received lesson time
  lesson_scores: Record<string, number>,  // per-subskill scores from lessons
}
```

Pulse uses this to bias the "current" band toward today's lesson topics. If a student scored 7/10 on rhyming in the lesson phase, Pulse will include 1-2 rhyming items in the current band at a slightly higher difficulty (theta-calibrated mode) to reinforce the learning.

### 7.2 Pulse's Three Bands in Daily Context

In the daily session context, the three bands serve specific roles:

**Trailing Review (15%)** — Spaced repetition for previously mastered material. Pulls from mastery lifecycle docs where `next_retest_eligible <= now`. This is the review that was previously handled by lesson-phase review blocks.

**Current Work (65%)** — Reinforcement of frontier skills. Includes:
- Today's lesson subskills (seeded from lesson phase results)
- Other frontier subskills from all subjects (not just lesson subjects)
- Gate 0/1 items needing eval accumulation toward Gate 1

**Frontier Probes (20%)** — Skills 1-5 DAG edges ahead. Selected for high success probability based on the student's theta in adjacent skills. On pass, leapfrog logic infers mastery of ancestor skills and skips weeks of lesson time.

### 7.3 Daily Session vs. Standalone Pulse

Pulse can run in two modes:

| Mode | Entry Point | Differences |
|---|---|---|
| **Daily session** | After lesson phase completes | `include_lesson_topics: true`, current band seeded with today's lesson subskills, session telemetry linked to daily session record |
| **Standalone** | Student clicks "Practice" from idle screen | No lesson seed, normal 3-band assembly, independent session record |

Both modes use the same `PulseEngine.assemble_session()` backend. The only difference is whether `lesson_subskills` are injected into the current band candidates.

---

## 8. Requirements Summary

### P0 -- Phase 1 (Weeks 1-4)

| Req ID | Requirement | Description |
|---|---|---|
| DL-001 | Lesson group data model | Firestore schema for lesson groups with Bloom's mapping (Section 2.2) |
| DL-002 | Automated grouping engine | Rule-based grouping of K curriculum subskills (Section 6.1) |
| DL-003 | Lesson generator: multi-subskill input | Generator accepts lesson group, maps phases to subskills (Section 2.7) |
| DL-004 | EL-driven subject selection | Planner selects 1-3 subjects by EL deficit for lesson phase (Section 3.1) |
| DL-005 | Frontier skill selection | Planner picks lesson groups by success probability (Section 3.2) |
| DL-006 | Session runner: two-phase flow | Lesson phase -> break -> Pulse phase orchestration (Section 4.2) |
| DL-007 | Session brief (CuratorBrief) | Session preview showing today's focus, plan, and encouragement (Section 4.2) |
| DL-008 | Lesson-to-Pulse transition | Special transition screen with 3-band Pulse preview (Section 4.3) |
| DL-009 | Pulse seed from lessons | Pass lesson subskills/scores to Pulse's current band (Section 7.1) |
| DL-010 | Unified session telemetry | Single session record capturing both phases (Section 5.1) |
| DL-011 | Unified session summary | Combined lesson + Pulse results with EL changes (Section 4.5) |

### P1 -- Phase 2 (Weeks 5-10)

| Req ID | Requirement | Description |
|---|---|---|
| DL-012 | Mixed gate state handling | Generator adapts when subskills in a group are at different gates (Section 2.5) |
| DL-013 | Partial group scheduling | Planner schedules subset of group when some subskills mastered (Section 2.6) |
| DL-014 | Dynamic budget split | Adjust lesson/Pulse ratio based on review backlog and EL state (Section 3.3) |
| DL-015 | Session shape optimization | Interleaving rules for lesson blocks, cognitive load alternation (Section 3.4) |
| DL-016 | Parent controls | Pause, skip, end early across both phases (Section 4.6) |
| DL-017 | Streak tracking | Consecutive-day tracking with milestone celebrations |
| DL-018 | EL velocity tracking | Track EL change per subject per session for pacing projections (Section 5.2) |

### P2 -- Phase 3 (Weeks 11-17)

| Req ID | Requirement | Description |
|---|---|---|
| DL-019 | AI-assisted grouping | LLM proposes groups for edge cases (Section 6.2) |
| DL-020 | Experience-driven regrouping | Adjust groups from co-mastery patterns (Section 6.3) |
| DL-021 | Adaptive session brief | CuratorBrief personalizes based on streak, recent performance, EL trajectory |
| DL-022 | Warm-up block | Optional light opening activity before first lesson group |
| DL-023 | Cross-session EL dashboards | Student-facing EL progress visualization per subject |

---

## 9. Success Metrics

| Metric | Current | Phase 1 Target | Phase 2 Target |
|---|---|---|---|
| Skills closed per week | 0 | >= 5 | >= 12 |
| Sessions completed per week | 0 | >= 3 | >= 4 |
| Avg session duration (min) | N/A | 45-90 | 60-90 |
| Avg subskills advanced per session | 0 | >= 8 | >= 15 |
| EL growth per session (avg across subjects) | N/A | >= 0.3 | >= 0.5 |
| Lesson phase completion rate | N/A | >= 80% | >= 90% |
| Pulse phase completion rate | N/A | >= 60% | >= 80% |
| Leapfrog rate (frontier probes passed) | N/A | >= 20% | >= 30% |
| Introduction rate | 3% | >= 25% | >= 40% |

---

## 10. Phase 1 Implementation Status

Status as of v2.0 (March 2026). Covers what shipped in v1.x and what changes for v2.0.

### 10.1 Carried Forward from v1.x

These shipped components remain valid and are reused in v2.0:

| Component | File | Status |
|---|---|---|
| Lesson plan models | `backend/app/models/lesson_plan.py` | Reuse |
| Lesson group service | `backend/app/services/lesson_group_service.py` | Reuse |
| Planning service | `backend/app/services/planning_service.py` | Modify (add EL-driven selection) |
| Session plan API | `my-tutoring-app/src/lib/sessionPlanAPI.ts` | Modify (add pulse_config) |
| Daily lesson plan UI | `my-tutoring-app/src/components/lumina/DailyLessonPlan.tsx` | Reuse (fewer blocks) |
| Session break screen | `my-tutoring-app/src/components/lumina/components/SessionBreakScreen.tsx` | Reuse |
| Exhibit complete footer | `my-tutoring-app/src/components/lumina/components/ExhibitCompleteFooter.tsx` | Reuse |
| PulseSession component | `my-tutoring-app/src/components/lumina/pulse/PulseSession.tsx` | Modify (accept lesson seed) |
| Session driver (App.tsx) | `my-tutoring-app/src/components/lumina/App.tsx` | Modify (two-phase state machine) |

### 10.2 New for v2.0

| Component | Description | Priority |
|---|---|---|
| EL-driven subject selector | Backend: compute subject ELs, rank by deficit, select 1-3 for lessons | P0 |
| Frontier reachability scorer | Backend: rank candidate subskills by theta proximity to G1 | P0 |
| Session brief component | Frontend: CuratorBrief-style session preview (sections 4.2) | P0 |
| Lesson-to-Pulse transition | Frontend: special break screen with 3-band Pulse preview | P0 |
| Pulse seed injection | Backend: `assemble_session()` accepts `lesson_subskills` param | P0 |
| Two-phase session state machine | Frontend: App.tsx `sessionPhase` expanded to `briefing/lesson/pulse` | P0 |
| Unified session summary | Frontend: combined lesson + Pulse results screen | P0 |
| Dynamic budget split | Backend: adjust lesson/Pulse ratio by review backlog and EL state | P1 |
| EL velocity telemetry | Backend: track per-subject EL change per session | P1 |

### 10.3 Key Architecture Decisions (v2.0)

**Session runner stays dumb.** All pedagogical intelligence is in the planning engine (subject selection, lesson group assembly) and Pulse (IRT-driven item selection, leapfrog logic). The session runner is pure orchestration: show brief, run lessons, transition to Pulse, show summary.

**Pulse is embedded, not navigated to.** In v1.x, Pulse was a separate panel (`activePanel === 'practice-mode'`). In v2.0, Pulse is embedded within the daily session flow. The `PulseSession` component receives a `lessonSeed` prop and its completion triggers the session summary — no panel navigation needed.

**EL drives planning, not gate counts.** v1.x used gate states and review urgency to fill a time budget. v2.0 uses Earned Level deficits to select subjects for focused lesson time, then hands off to Pulse for adaptive practice. Gates and lifecycle still matter for individual subskill tracking, but the top-level planning question changes from "which blocks fill the budget?" to "which subjects need teaching?"

**CuratorBrief pattern for transitions.** Every phase transition gets a brief that explains what's happening in student-friendly language. This replaces the generic break screen for the lesson-to-Pulse handoff and adds a session-level brief at the start. Keeps the student oriented without adding cognitive load.

---

## 11. Backend Session Integration

### 11.1 API Changes for v2.0

The existing session endpoints (§10 of v1.x) are extended:

#### `GET /daily-plan/{student_id}/session`

**v2.0 changes:** Response now includes `pulse_config` and `el_deficits`:

```json
{
  "day_of_week": "Monday",
  "blocks": [ /* lesson blocks only — 1-3 instead of 4-5 */ ],
  "estimated_total_minutes": 75,
  "lesson_budget_minutes": 26,
  "pulse_budget_minutes": 44,
  "pulse_config": {
    "subjects": ["ELA", "Math", "Science"],
    "review_pct": 0.15,
    "current_pct": 0.65,
    "frontier_pct": 0.20,
    "item_count": 15,
    "include_lesson_topics": true
  },
  "el_deficits": {
    "ELA": 1.7,
    "Math": 0.4,
    "Science": 0.0
  },
  "warnings": []
}
```

#### `POST /api/pulse/sessions` (existing)

**v2.0 change:** Accepts optional `lesson_seed`:

```json
{
  "subject": "ELA",
  "lesson_seed": {
    "subskill_ids": ["PA-RRP-01", "PA-RRP-02", "PA-RRP-03"],
    "scores": { "PA-RRP-01": 8.5, "PA-RRP-02": 7.0, "PA-RRP-03": 6.5 }
  }
}
```

When `lesson_seed` is provided, `PulseEngine.assemble_session()` injects these subskills into the current band candidates with boosted priority.

### 11.2 Session Record Schema (v2.0)

Extends v1.x schema to include `session_type` and `pulse_session_id`:

```
Collection: students/{studentId}/sessions/{sessionId}

{
  session_id: string,
  student_id: string,
  session_type: "daily" | "pulse_standalone",  // NEW
  plan_date: string,
  started_at: Timestamp,
  completed_at: Timestamp | null,
  status: "in_progress" | "completed" | "abandoned",

  // Lesson phase (null for pulse_standalone)
  lesson_phase: {
    budget_min: number,
    elapsed_min: number,
    blocks: [ /* same as v1.x */ ],
    blocks_completed: number,
    blocks_total: number,
  } | null,

  // Pulse phase
  pulse_phase: {
    pulse_session_id: string,    // FK to pulse_sessions collection
    budget_min: number,
    elapsed_min: number,
    items_completed: number,
    items_total: number,
  } | null,

  // Session-level aggregates
  total_budget_min: number,
  elapsed_min: number,
  total_evals: number,
  avg_score: number | null,
  el_changes: Record<string, { before: number, after: number }>,
}
```
