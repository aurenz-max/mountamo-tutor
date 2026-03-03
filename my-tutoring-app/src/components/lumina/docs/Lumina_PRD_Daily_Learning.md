# Lumina PRD: Daily Learning Experience

**Covers: Session Runner, Lesson Architecture, Capacity Model, Planning Engine**
**Version 1.0 | March 2026**

---

## 1. Overview

This PRD defines how a student experiences a day of learning on Lumina. It covers three tightly coupled systems:

1. **Lesson Architecture** — How subskills are grouped into coherent lessons with Bloom's-aligned phases
2. **Planning Engine** — How the system assembles a daily session from lesson groups, reviews, and retests within a time budget
3. **Session Runner** — How the student moves through that session from start to celebration

These three systems form a single pipeline:

```
Curriculum (674 subskills)
  → Lesson Groups (subskills bundled by domain + Bloom's)
    → Planning Engine (fills a daily time budget with lesson groups)
      → Session Runner (guides the student through the plan)
        → Telemetry (captures per-subskill performance)
          → Mastery Engine (updates gates, schedules reviews)
            → Planning Engine (next day's session)
```

The daily loop is: **Plan → Run → Capture → Update → Plan.**

---

## 2. Lesson Architecture

### 2.1 The Core Insight

The lesson is the atomic unit of *time*. The subskill is the atomic unit of *tracking*. A single 15–20 minute lesson advances 2–5 related subskills simultaneously because Bloom's taxonomy naturally scaffolds from simpler to more complex within the same domain.

This resolves the structural pacing problem:

| Model | Total Instruction Time | Fits in School Year? |
|---|---|---|
| **Ungrouped** (1 subskill = 1 lesson) | 674 × 15 min + reviews ≈ 21,000 min | No (~70 weeks needed) |
| **Grouped** (3 subskills = 1 lesson) | 225 × 18 min + reviews ≈ 8,550 min | Yes (~28.5 weeks + 7.5 week buffer) |

### 2.2 Lesson Group Definition

A **Lesson Group** is a set of 2–5 related subskills that share a domain and form a natural Bloom's progression.

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
2. **Bloom's-orderable.** Subskills must form a natural Identify → Explain → Apply progression.
3. **Prerequisite-compatible.** If subskill B requires A, they can be grouped only if A maps to an earlier Bloom's phase. The lesson flow itself satisfies the prerequisite.
4. **Size: 2–5 subskills.** Fewer than 2 adds no value. More than 5 dilutes depth.
5. **Ungroupable subskills remain standalone.** Complex subskills that need a full lesson keep the 1:1 mapping.

#### Prerequisite Handling

The Bloom's progression within a lesson IS the prerequisite chain. "Recognize if two spoken words rhyme" (Identify) is taught before "Identify the rhyming word from a set of three" (Explain) because that's how the lesson naturally flows. The prerequisite is satisfied within the lesson rather than across separate sessions on separate days.

The gate system still enforces mastery prerequisites at the tracking level: if a student passes the Identify phase but fails Apply, the tracker advances the Identify subskill's gate while rescheduling Apply for additional practice. Teaching is bundled; tracking stays granular.

For long prerequisite chains (A → B → C → D → E), split into groups of 2–3 at natural breakpoints:
- Group 1: A + B (Identify + Explain)
- Group 2: C + D (Explain + Apply, with Group 1 as prerequisite)
- Group 3: E standalone (capstone)

### 2.3 Lesson Structure (Unchanged)

Each lesson retains the proven structure:

| Phase | Bloom's Level | Primitives | Duration |
|---|---|---|---|
| Phase 1 | Identify | 3–4 primitives targeting recognition/identification | ~5–6 min |
| Phase 2 | Explain | 3–4 primitives targeting discrimination/explanation | ~5–6 min |
| Phase 3 | Apply | 3–4 primitives targeting production/application | ~5–6 min |

Total: 9–12 primitives, 15–20 minutes.

What changes: each phase's learning objective targets a *different subskill* within the lesson group, rather than three objectives targeting the same subskill.

### 2.4 Worked Example: Rhyming Lesson

**Current model (3 separate lessons across 3 days):**

| Day | Subskill | Lesson | Time |
|---|---|---|---|
| Monday | Recognize if two spoken words rhyme | Full 15-min lesson | 15 min |
| Wednesday | Identify the rhyming word from a set of three | Full 15-min lesson | 15 min |
| Friday | Produce a word that rhymes with a given word | Full 15-min lesson | 15 min |
| **Total** | | | **45 min over 5 days** |

**Grouped model (1 lesson, 1 day):**

| Phase | Learning Objective | Subskill Advanced | Primitives | Time |
|---|---|---|---|---|
| Identify | Recognize when two words rhyme | PA-RRP-01 | Rhyme Studio (listen + identify pairs), Sound Swap (rhyming vs. non-rhyming), Phoneme Explorer (rhyme family visual) | ~6 min |
| Explain | Pick the rhyming word from a group | PA-RRP-02 | Rhyme Studio (select from 3), Knowledge Check (which rhymes with "cat"?), Fast Fact (rhyme ID speed round) | ~6 min |
| Apply | Generate a rhyming word | PA-RRP-03 | Sound Swap (change onset), Phonics Blender (build rhyming words), Self-Check ("tell me a word that rhymes with 'sun'") | ~6 min |
| **Total** | | **3 subskills** | **9 primitives** | **~18 min, 1 day** |

Same depth per subskill. 60% less time. 100% fewer scheduling days.

### 2.5 Mixed Gate States

In practice, subskills within a group won't always be at the same gate. The lesson generator adapts:

| Scenario | Generator Behavior |
|---|---|
| All NEW | Full lesson depth: rich scaffolding, examples, guided exploration |
| Some NEW, some REVIEW | NEW subskills get lesson-depth primitives (more scaffolding). REVIEW subskills get practice-depth primitives (less scaffolding, more assessment). Phase order unchanged. |
| All REVIEW | Practice session: reduced scaffolding, assessment-heavy, faster pacing. Shorter duration (~10 min). |
| One needs RETEST | Retest primitives at the appropriate Bloom's phase. Other phases proceed at their gate level. |

A single 18-minute session can simultaneously introduce one subskill, review another, and retest a third — all within the same domain, flowing naturally through Bloom's phases.

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

This prevents re-teaching mastered material just because it shares a group with an unmastered subskill.

### 2.7 Lesson Generation Requirements

**Input change:** The generator receives a lesson group spec instead of a single subskill:

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

**Output:** Unchanged structure (3 phases × 3–4 primitives), but each phase is tagged with its target subskill ID for telemetry attribution.

---

## 3. Planning Engine

### 3.1 Planning Unit

The planner schedules **lesson groups** (not individual subskills) as its primary unit. Each queue item is a lesson group with a time estimate and the subskills it will advance.

```
queue_item: {
  type: "lesson_group" | "standalone" | "practice_group" | "retest",
  lesson_group_id: string,
  subskills: [{ id, gate, status }],
  time_estimate_minutes: number,
  subskills_advanced: number,       // for velocity tracking
  subject: string,
  priority_score: number
}
```

### 3.2 Time-Based Capacity Model

The planner fills a daily **time budget** rather than an item count:

```
daily_budget_minutes: 75  (configurable per student)
```

**Primitive-specific time estimates** drive lesson group duration. Each primitive type has an estimated duration that starts as an assumption and calibrates from telemetry:

```
primitive_time_estimates: {
  phonics_blender:  { assumed: 2.5 min, actual: null, credibility: 0 },
  story_map:        { assumed: 7.0 min, actual: null, credibility: 0 },
  rhyme_studio:     { assumed: 3.0 min, actual: null, credibility: 0 },
  knowledge_check:  { assumed: 4.0 min, actual: null, credibility: 0 },
  fast_fact:        { assumed: 3.0 min, actual: null, credibility: 0 },
  decodable_reader: { assumed: 5.0 min, actual: null, credibility: 0 },
  // ... all primitive types
}

// Credibility-weighted calibration:
Z = min(1, completions / 20)   // full credibility at 20 completions
calibrated_time = Z × actual_avg + (1 - Z) × assumed
```

A lesson group's time estimate = sum of its component primitives' calibrated times + transition overhead (~30 sec per primitive transition).

### 3.3 Queue Assembly Algorithm

The planner fills the daily time budget using the following priority order:

```
1. OVERDUE RETESTS          (mastery retests past their scheduled date)
2. SCHEDULED RETESTS        (retests due today)
3. INTERVAL REVIEWS         (spaced repetition reviews at 3/7/14/28 day marks)
4. NEW INTRODUCTIONS        (lesson groups entering the pipeline for the first time)
5. EXHIBIT / ENRICHMENT     (optional, fills remaining time)

For each priority tier:
  Sort by: urgency (days overdue), subject balance, cognitive variety
  While budget_remaining > next_item.time_estimate:
    Add item to queue
    budget_remaining -= item.time_estimate
```

**Review budget cap:** To prevent the introduction bottleneck identified in the velocity decomposition, reviews are capped at a configurable percentage of the daily budget (default: 50%). Once the review cap is hit, remaining budget goes to new introductions even if reviews are queued.

```
review_budget = daily_budget_minutes × review_cap_pct   // e.g., 75 × 0.50 = 37.5 min
intro_budget = daily_budget_minutes - review_budget       // 37.5 min guaranteed for new material
```

This structurally prevents the "review burden crowding out introductions" problem.

### 3.4 Session Shape

The planner doesn't just fill time — it shapes the session for a kindergartener's attention and engagement:

**Interleaving rules:**
- Never schedule two lesson groups from the same subject back-to-back
- Alternate cognitive load: heavy lesson → lighter practice → heavy lesson
- Front-load new material when attention is highest
- Place retests mid-session (warmed up but not fatigued)

**Session structure template:**

```
┌─────────────────────────────────────────────┐
│  WARM-UP (optional, 3–5 min)                │
│  Light review or fun exhibit snippet         │
├─────────────────────────────────────────────┤
│  BLOCK 1: New Lesson Group (~18 min)        │
│  Subject A — full Bloom's cycle              │
│    Phase 1: Identify (3-4 primitives)        │
│    Phase 2: Explain  (3-4 primitives)        │
│    Phase 3: Apply    (3-4 primitives)        │
│  🌟 Lesson Complete micro-celebration        │
├─────────────────────────────────────────────┤
│  BLOCK 2: Practice/Review (~10 min)         │
│  Subject B — review group at practice depth  │
│  🌟 Practice Complete                        │
├─────────────────────────────────────────────┤
│  ☕ BREAK PROMPT (configurable interval)     │
│  "Great job! Stretch, get water, come back"  │
├─────────────────────────────────────────────┤
│  BLOCK 3: New Lesson Group (~18 min)        │
│  Subject C — full Bloom's cycle              │
│  🌟 Lesson Complete                          │
├─────────────────────────────────────────────┤
│  BLOCK 4: Retest (~5 min)                   │
│  Quick mastery check on mature skill         │
│  🌟 Mastered! (or: scheduled for review)     │
├─────────────────────────────────────────────┤
│  BLOCK 5: Practice/Review (~10 min)         │
│  Subject A — different domain                │
│  🌟 Practice Complete                        │
├─────────────────────────────────────────────┤
│  SESSION COMPLETE (~75 min total)            │
│  🎉 Celebration + summary                   │
└─────────────────────────────────────────────┘
```

This is the natural synergy between lesson groups and the session runner. The lesson group defines the internal structure of each block (3 Bloom's phases × 3–4 primitives). The session runner defines the block sequence, transitions, breaks, and celebrations. Together they create a session that is:

- **Cognitively varied** — alternating subjects and difficulty levels
- **Time-bounded** — fills a minute budget, not an item count
- **Structurally coherent** — each block is a complete learning arc (Identify → Explain → Apply)
- **Celebratory at the right moments** — micro-celebrations after each lesson group, big celebration at session end

---

## 4. Session Runner

### 4.1 Three-Tier Navigation

The session runner operates at three nested levels, each with its own navigation, progress tracking, and celebration moments:

**Tier 1: Session Level**
- "You have 5 learning blocks today — let's go!"
- Shows block count, estimated time, subject icons
- Progress bar tracks blocks completed
- Handles breaks, pause/resume, end-early

**Tier 2: Lesson Level (within a block)**
- "Let's explore rhyming sounds!"
- Shows 3 Bloom's phases as steps: Learn → Practice → Show What You Know
- Progress indicator: "Phase 2 of 3"
- Micro-celebration at lesson completion ("You learned about rhyming! 🌟")

**Tier 3: Primitive Level (within a phase)**
- Individual primitive renders (Rhyme Studio, Sound Swap, etc.)
- Auto-advance between primitives with brief transition (~2 sec)
- Per-primitive score captured for telemetry
- No celebration at this level — keep flow moving

```
Session
  └── Block 1: Rhyming Lesson Group (18 min)
  │     └── Phase 1: Identify (6 min)
  │     │     └── Primitive: Rhyme Studio — listen & identify
  │     │     └── Primitive: Sound Swap — rhyming vs. non-rhyming
  │     │     └── Primitive: Phoneme Explorer — rhyme families
  │     └── Phase 2: Explain (6 min)
  │     │     └── Primitive: Rhyme Studio — select from 3
  │     │     └── Primitive: Knowledge Check — which rhymes?
  │     │     └── Primitive: Fast Fact — speed round
  │     └── Phase 3: Apply (6 min)
  │           └── Primitive: Sound Swap — change onset
  │           └── Primitive: Phonics Blender — build words
  │           └── Primitive: Self-Check — produce a rhyme
  │     🌟 "Nice! You're a rhyming star!"
  │
  └── Block 2: Shape Review (10 min)
  │     └── Phase 1–3 at practice depth
  │     🌟 "Shapes? You got this!"
  │
  └── ☕ Break
  │
  └── Block 3: Story Elements Lesson (18 min)
  │     └── Phase 1–3 full lesson depth
  │     🌟 "You're becoming a storyteller!"
  │
  └── Block 4: Onset-Rime Retest (5 min)
  │     └── Targeted assessment primitives
  │     🌟 "Mastered!" or "We'll practice more tomorrow"
  │
  └── Block 5: Counting Practice (10 min)
        └── Phase 1–3 at practice depth
        🌟 "Numbers are your thing!"

  🎉 SESSION COMPLETE
  "You finished 5 blocks in 72 minutes!
   You started learning rhyming and storytelling today!
   You mastered onset and rime! 🏆"
```

### 4.2 Transition Design

Transitions happen at two levels:

**Between primitives (within a phase):** Minimal — 1–2 second crossfade or slide. No interaction required from the student. The goal is flow, not friction.

**Between blocks (between lesson groups):** Brief transition screen (3–5 seconds) showing:
- Subject icon + friendly block name ("Time for a story!")
- Estimated time ("About 18 minutes")
- Progress ("Block 3 of 5")
- Optional: student can see what's coming but can't skip

**Between phases (within a lesson group):** Light transition (2–3 seconds) with Bloom's-level cue:
- Identify → Explain: "Now let's see if you can spot the right one!"
- Explain → Apply: "Your turn to try it yourself!"

These micro-transitions reinforce the scaffolding without breaking flow.

### 4.3 Break System

Breaks are inserted between blocks, never mid-block. A lesson group is always completed as a unit — you don't pause between the Identify and Explain phases.

```
break_config: {
  trigger: "time" | "blocks" | "both",
  time_interval_minutes: 25,      // offer break every 25 min
  block_interval: 2,              // or every 2 blocks
  min_break_minutes: 2,           // minimum break if taken
  break_activities: [             // optional activities during break
    "stretch_suggestion",
    "fun_fact",
    "free_draw",
    "movement_game"
  ],
  skip_allowed: true              // student can decline break
}
```

Break prompt: "You've been working hard! Want to take a quick break or keep going?"

The student (or parent) chooses. If they skip, the next break is offered after another interval. If sessions consistently run without breaks, the solvency engine flags this as a potential fatigue risk.

### 4.4 Session Lifecycle

```
STATES:
  NOT_STARTED → ACTIVE → PAUSED → ACTIVE → ... → COMPLETED | ENDED_EARLY

Events:
  session_start     → log start time, display preview
  block_start       → log block start, load lesson group
  phase_start       → log phase start, load primitives
  primitive_complete → capture score, time, hints; auto-advance
  phase_complete     → aggregate phase metrics, transition to next phase
  block_complete     → micro-celebration, aggregate block metrics, transition
  break_offered      → log; student accepts or skips
  session_pause      → log pause time
  session_resume     → log resume time, recalculate remaining budget
  session_complete   → celebration screen, generate summary, write telemetry
  session_end_early  → partial telemetry, note incomplete blocks
```

### 4.5 Parent Controls (During Session)

Available via a parent control panel (PIN-protected or hidden gesture to prevent child access):

| Control | Behavior |
|---|---|
| **Pause** | Freezes session timer. Student sees "paused" screen. Resumes where left off. |
| **Skip block** | Marks current block as skipped in telemetry. Advances to next block. Skipped subskills are not penalized but are rescheduled. |
| **End session** | Completes session with partial data. Remaining blocks rescheduled for tomorrow. |
| **Adjust time** | Extend or shorten remaining budget mid-session. Planner recalculates which blocks to keep. |
| **View progress** | Non-intrusive overlay showing blocks completed, time elapsed, current subskill. |
| **Replay block** | Re-run a completed block (e.g., child wants to do the rhyming lesson again). Telemetry captures as supplementary attempt. |

### 4.6 Celebration & Summary

**Micro-celebrations (after each block):**
- Short animation (confetti burst, star spin, character reaction)
- One-line encouragement tied to the content: "You're a rhyming pro!" / "Shapes are no match for you!"
- Duration: 3–5 seconds, auto-dismisses

**Session celebration (at completion):**
- Full-screen celebration with character/mascot
- Summary in child-friendly language:
  - "You finished 5 blocks today!"
  - "You started learning: rhyming, storytelling"
  - "You mastered: onset and rime 🏆" (if any closures happened)
  - "Time: 72 minutes — you worked really hard!"
- Optional: "Want to explore something fun?" → links to Exhibit mode
- "See you tomorrow!" → session ends

**Streak tracking:**
- Consecutive days with a completed session
- Milestone celebrations at 3, 7, 14, 30 days
- Streak visible on session start screen

---

## 5. Session Telemetry

### 5.1 Why This Matters

Session telemetry is the **experience study data** that calibrates every other system in Lumina. Without it, projections use assumptions. With it, projections use demonstrated reality. It feeds:

- Projection model calibration (actual items/day, actual time/item, actual mastery rates)
- Capacity model (convert from assumed to measured time-per-primitive)
- Primitive effectiveness analysis (which primitives produce mastery fastest?)
- Intervention triggers (detecting struggle patterns in real time)
- Solvency engine (demonstrated throughput → credibility-weighted projections)
- A/E ratios by subject and primitive type

### 5.2 Telemetry Schema

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
  
  planned_blocks: number,
  completed_blocks: number,
  skipped_blocks: number,
  
  breaks_offered: number,
  breaks_taken: number,
  total_break_minutes: number,
  
  blocks: [
    {
      block_id: string,
      lesson_group_id: string,
      type: "lesson" | "practice" | "retest",
      subject: string,
      started_at: timestamp,
      completed_at: timestamp,
      duration_minutes: number,
      
      phases: [
        {
          bloom_phase: "identify" | "explain" | "apply",
          subskill_id: string,
          gate: "lesson" | "practice" | "retest",
          started_at: timestamp,
          completed_at: timestamp,
          duration_seconds: number,
          
          primitives: [
            {
              primitive_type: string,
              primitive_id: string,
              started_at: timestamp,
              completed_at: timestamp,
              duration_seconds: number,
              score: number | null,
              passed: boolean | null,
              attempts: number,
              hints_used: number,
              ai_tutor_engaged: boolean
            }
          ],
          
          // Phase-level aggregates
          phase_score: number,        // avg of primitive scores
          phase_passed: boolean,      // meets gate threshold?
          total_hints: number
        }
      ],
      
      // Block-level aggregates
      subskills_advanced: number,
      subskills_passed: number,
      block_score: number
    }
  ],
  
  // Session-level aggregates
  total_subskills_advanced: number,
  total_subskills_passed: number,
  total_subskills_closed: number,    // crossed mastery threshold
  new_introductions: number,
  reviews_completed: number,
  retests_completed: number,
  retests_passed: number
}
```

### 5.3 Telemetry → Calibration Pipeline

After each session, telemetry flows into calibration:

**Primitive time calibration:**
```
For each primitive completion:
  Update primitive_type running average
  Recalculate credibility weight: Z = min(1, total_completions / 20)
  New calibrated_time = Z × actual_avg + (1 - Z) × assumed
```

**Lesson group time calibration:**
```
For each completed lesson group:
  actual_duration = block.duration_minutes
  Update lesson_group running average
  Planner uses calibrated lesson group time for future scheduling
```

**Mastery rate calibration:**
```
For each gate attempt:
  Track pass/fail rate by gate type, subject, and primitive type
  Feed into solvency engine's projection model
  Update A/E ratio: actual_pass_rate / assumed_pass_rate
```

---

## 6. Lesson Group Creation

### 6.1 Automated Grouping Engine

A rule-based system groups subskills within the same curriculum unit:

```
Algorithm: auto_group(unit_subskills)

1. Filter to subskills within the same unit
2. For each subskill, assign a Bloom's level based on:
   - Verb analysis: "recognize", "identify" → Identify
   - Verb analysis: "explain", "compare", "match" → Explain
   - Verb analysis: "produce", "create", "sort", "apply" → Apply
3. Group subskills that share a domain concept:
   - Same parent skill in the curriculum hierarchy
   - Or: semantic similarity above threshold (LLM-assisted)
4. Within each group, order by Bloom's level
5. Validate: 
   - Group size 2–5? If >5, split at natural breakpoint
   - Prerequisite chain respected? (earlier Bloom's = earlier prereq)
   - Estimated duration reasonable? (< 25 min)
6. Output: lesson_group records ready for Firestore
```

Coverage expectation: ~70% of subskills auto-group cleanly. The remaining 30% need AI-assisted or manual grouping.

### 6.2 AI-Assisted Grouping

For edge cases — subskills that span units, ambiguous Bloom's mappings, or complex prerequisite chains — use the LLM to propose groupings:

```
Prompt: Given these subskills from [domain], propose lesson groups of 2-5 
subskills each. For each group, provide:
- Which subskills belong together and why
- Bloom's phase mapping for each subskill
- Whether any prerequisite constraints are violated
- Estimated lesson duration
```

Human review before committing. Flag low-confidence groupings for manual validation.

### 6.3 Experience-Driven Regrouping

After sufficient telemetry (Phase 3 timeline), analyze co-mastery patterns:

- If students who master subskill A almost always master B in the same session → group them
- If a lesson group consistently has one phase with low scores while others pass → consider splitting
- If a lesson group consistently completes in < 10 min → consider merging with an adjacent group

---

## 7. Requirements Summary

### P0 — Phase 1 (Weeks 1–4)

| Req ID | Requirement | Description |
|---|---|---|
| DL-001 | Lesson group data model | Firestore schema for lesson groups with Bloom's mapping (Section 2.2) |
| DL-002 | Automated grouping engine | Rule-based grouping of K curriculum subskills (Section 6.1) |
| DL-003 | Lesson generator: multi-subskill input | Generator accepts lesson group, maps phases to subskills (Section 2.7) |
| DL-004 | Time-based capacity model | Planner fills minute budget with primitive-specific time estimates (Section 3.2) |
| DL-005 | Queue assembly with review cap | Priority-based queue building with configurable review budget (Section 3.3) |
| DL-006 | Session runner: core flow | Three-tier navigation with block/phase/primitive progression (Section 4.1) |
| DL-007 | Session runner: transitions | Between-block and between-phase transitions (Section 4.2) |
| DL-008 | Session runner: breaks | Configurable break prompts between blocks (Section 4.3) |
| DL-009 | Session telemetry capture | Full telemetry schema written to Firestore per session (Section 5.2) |
| DL-010 | Per-subskill scoring within lessons | Attribute phase-level scores to individual subskills (Section 5.2) |
| DL-011 | Celebration: micro + session | Block-level and session-level celebration screens (Section 4.6) |

### P1 — Phase 2 (Weeks 5–10)

| Req ID | Requirement | Description |
|---|---|---|
| DL-012 | Mixed gate state handling | Generator adapts when subskills in a group are at different gates (Section 2.5) |
| DL-013 | Partial group scheduling | Planner schedules subset of group when some subskills mastered (Section 2.6) |
| DL-014 | Primitive time calibration | Credibility-weighted time estimates from telemetry (Section 5.3) |
| DL-015 | Session shape optimization | Interleaving rules, cognitive load alternation (Section 3.4) |
| DL-016 | Parent controls | Pause, skip, end early, adjust time, view progress (Section 4.5) |
| DL-017 | Streak tracking | Consecutive-day tracking with milestone celebrations (Section 4.6) |
| DL-018 | Session lifecycle management | Full state machine with pause/resume/end-early (Section 4.4) |

### P2 — Phase 3 (Weeks 11–17)

| Req ID | Requirement | Description |
|---|---|---|
| DL-019 | AI-assisted grouping | LLM proposes groups for edge cases with rationale (Section 6.2) |
| DL-020 | Experience-driven regrouping | Adjust groups from co-mastery patterns in telemetry (Section 6.3) |
| DL-021 | Mastery rate calibration | A/E ratios by subject and primitive type (Section 5.3) |
| DL-022 | Warm-up block | Optional light opening activity before first lesson group (Section 3.4) |
| DL-023 | Exhibit integration | Map exhibit completions to subskill credit within lesson groups |

---

## 8. Success Metrics

| Metric | Current | Phase 1 Target | Phase 2 Target |
|---|---|---|---|
| Skills closed per week | 0 | ≥ 5 | ≥ 12 |
| Sessions completed per week | 0 | ≥ 3 | ≥ 4 |
| Avg session duration (min) | N/A | 45–90 | 60–90 |
| Avg subskills advanced per session | 0 | ≥ 8 | ≥ 12 |
| Lesson groups created (K) | 0 | ~225 | ~225 (calibrated) |
| Introduction rate | 3% | ≥ 20% | ≥ 40% |
| Session completion rate | N/A | ≥ 60% | ≥ 80% |
| Primitive time calibration coverage | 0% | N/A | ≥ 50% of primitive types |
