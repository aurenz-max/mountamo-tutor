# Lumina PRD: Diagnostic & Placement Engine

**Covers: Initial Assessment, Knowledge Graph Seeding, Mastery Frontier, Embedded Review-Through-Teaching**
**Version 1.1 | March 2026**

---

## 1. The Problem

Lumina currently assumes zero proficiency for every student. A 3-year-old who already knows his letters, can count to 20, and recognizes basic shapes starts at the same place as a student with no exposure. This creates three compounding problems:

**Problem 1: Wasted time.** If a student already knows 30% of K skills, the current system forces them through ~100 hours of instruction on material they've mastered. At 75 min/day, that's ~80 wasted sessions — nearly a full semester.

**Problem 2: False pacing pressure.** The solvency engine sees 674 skills to cover and calculates the run rate accordingly. But if 200 of those skills are already known, the actual target is 474. The difference between "critically behind" and "on track" might be entirely explained by failing to account for existing knowledge.

**Problem 3: Engagement death.** Nothing kills a kindergartener's motivation faster than being forced to demonstrate things they already know, day after day. The system should meet the student where they are, not where the curriculum starts.

### 1.1 The Math Academy Insight

Justin Skycak's framework at Math Academy compresses grade levels of learning by identifying existing knowledge, overlaying it on a prerequisite graph, and teaching only the **knowledge frontier** — topics where the student has mastered the prerequisites but hasn't yet mastered the topic itself.

Lumina already implements most of this framework:

| Skycak Principle | Lumina Status | Gap |
|---|---|---|
| 1. Identify what the student already knows | ❌ **Missing** | No diagnostic/placement system |
| 2. Overlay on a knowledge graph | ✅ Built | Prerequisite chains exist across all 674 subskills |
| 3. Teach only the knowledge frontier | ⚠️ Partially | Planner respects prerequisites but starts everyone at the bottom |
| 4. Minimum effective dose of instruction + practice | ✅ Built | Bloom's 3-phase lesson structure (Identify → Explain → Apply) |
| 5. Enforce mastery, continue on parallel paths | ✅ Built | Gate system + multi-subject interleaving |
| 6. Spaced repetition review | ✅ Built | Completion factor model + interval scheduling |
| 7. Review old by learning new | ⚠️ Partially | Lesson groups cover multiple subskills, but not explicitly designed for embedded review |

**The diagnostic placement engine closes gap #1 and fully activates #3. Embedded review-through-teaching addresses #7.**

### 1.2 Impact Modeling

Conservative estimate of impact on a student who already knows ~30% of K material:

```
Current model (zero proficiency assumed):
  674 subskills × 100% = 674 to teach
  225 lesson groups needed
  ~28.5 weeks of instruction + 7.5 week buffer = 36 weeks

With diagnostic placement (30% known):
  674 × 70% = 472 to teach
  ~157 lesson groups needed
  ~20 weeks of instruction + 16 weeks buffer

Time saved: ~8.5 weeks of instruction
Solvency ratio improvement: from ~0.8 to ~1.3 (surplus capacity)
```

That surplus can be redirected to enrichment, exhibits, deeper mastery on hard topics, or simply less daily time pressure. The student goes from "needs push" to "ahead of pace" without changing anything about their actual learning — just by accurately recognizing what they already know.

---

## 2. Diagnostic Assessment System

### 2.1 Design Principles

The diagnostic must be:

- **Fast.** A kindergartener won't sit through a 2-hour placement test. Target: 20–30 minutes total, split across 2–3 sessions if needed.
- **Adaptive.** Don't test every skill. Use the prerequisite graph to skip large branches. If a student demonstrates mastery of a downstream skill, infer mastery of its prerequisites.
- **Fun.** It should feel like playing Lumina, not taking a test. Use the same primitives the student will encounter in lessons.
- **Conservative.** It's better to under-credit than over-credit. A student who gets placed too far ahead will hit a wall; a student placed slightly behind will breeze through a few easy lessons and get appropriately challenged quickly.
- **Subject-parallel.** Test all four subjects concurrently to map the full profile in one diagnostic window rather than four sequential tests.

### 2.2 Adaptive Testing Algorithm

The diagnostic uses the prerequisite graph to minimize the number of questions needed. The core insight: **the knowledge graph is a DAG (directed acyclic graph), and you can binary-search it.**

```
Algorithm: adaptive_diagnostic(subject)

1. INITIALIZE
   - Load prerequisite DAG for subject
   - Identify all "leaf" nodes (skills with no dependents — terminal skills)
   - Identify all "root" nodes (skills with no prerequisites — foundational)
   - Set all skills to UNKNOWN status

2. SELECT PROBE POINTS
   - Find the topological midpoints of the longest paths in the DAG
   - These are skills roughly halfway through the prerequisite chains
   - Start testing here — they maximize information per question

3. TEST LOOP
   For each probe skill:
     a. Present 3–5 assessment items using appropriate primitives
     b. Score: PASS (≥ 75%) or FAIL (< 75%)
     
     If PASS:
       - Mark skill as MASTERED
       - Mark all ancestor skills (prerequisites) as INFERRED_MASTERED
       - Move probe point DEEPER (toward leaf nodes)
     
     If FAIL:
       - Mark skill as NOT_MASTERED
       - Mark all descendant skills as INFERRED_NOT_MASTERED
       - Move probe point SHALLOWER (toward root nodes)
   
   Continue until:
     - All skills have a status (MASTERED, INFERRED_MASTERED, NOT_MASTERED, 
       INFERRED_NOT_MASTERED), OR
     - Time budget exhausted (20–30 min total across subjects), OR
     - Confidence threshold met (≥ 90% of skills classified)

4. IDENTIFY FRONTIER
   Knowledge frontier = skills where:
     - All prerequisites are MASTERED or INFERRED_MASTERED
     - The skill itself is NOT_MASTERED or UNKNOWN
   These are the first skills to teach.
```

#### Efficiency Analysis

For a linear prerequisite chain of length N, binary search finds the frontier in O(log N) probes. For a DAG with branching, the inference propagation (ancestors marked mastered, descendants marked not-mastered) prunes large portions of the graph per probe.

Estimated probes needed per subject:

| Subject | Total Skills | Est. Chain Depth | Est. Probes Needed | Items per Probe | Time |
|---|---|---|---|---|---|
| Language Arts | 264 | ~8–12 | ~15–20 | 3–4 | ~8 min |
| Mathematics | 163 | ~6–10 | ~10–15 | 3–4 | ~6 min |
| Science | 88 | ~4–6 | ~6–10 | 3–4 | ~4 min |
| Social Studies | 159 | ~5–8 | ~8–12 | 3–4 | ~5 min |
| **Total** | **674** | | **~40–57 probes** | | **~23 min** |

That's within the 20–30 minute target. For a 3-year-old who fatigues quickly, split across two sessions: Language Arts + Math on day 1, Science + Social Studies on day 2.

### 2.3 Inference Rules

The power of graph-based placement is the inference propagation. Testing one skill can resolve the status of many:

**Upward inference (PASS → ancestors mastered):**

```
If student PASSES "Identify the rhyming word from a set of three":
  → Infer MASTERED: "Recognize if two spoken words rhyme" (direct prerequisite)
  → Infer MASTERED: any skill that is a prerequisite of the prerequisite
  → Rationale: You can't reliably pick the rhyming word if you can't 
    recognize rhymes. Passing the harder skill implies the easier one.
```

**Downward inference (FAIL → descendants not mastered):**

```
If student FAILS "Model addition within 5 using drawings and number lines":
  → Infer NOT_MASTERED: "Express addition within 5 using verbal explanations"
  → Infer NOT_MASTERED: "Match visual representations to addition equations"
  → Infer NOT_MASTERED: all skills that depend on this one
  → Rationale: If you can't model basic addition, you can't do the things 
    that build on it.
```

**Cross-domain inference (optional, lower confidence):**

```
If student PASSES several counting skills up to 20:
  → Weak inference: likely knows number recognition to 20
  → Action: probe number recognition directly rather than skipping
  → Rationale: correlation but not strict dependency; verify before crediting
```

Cross-domain inferences should be flagged as lower confidence and verified with a quick probe before crediting.

### 2.4 Assessment Primitives

The diagnostic uses the same primitives the student will encounter in lessons, but in assessment mode (reduced scaffolding, no teaching, scoring-focused):

| Skill Type | Assessment Primitive | Items per Probe |
|---|---|---|
| Recognition/identification | Fast Fact (speed round) | 4 items |
| Selection/discrimination | Knowledge Check (multiple choice) | 3 items |
| Production/creation | Self-Check (verbal/drawing prompt) | 3 items |
| Comparison | Comparison Explorer (select correct) | 3 items |
| Sequencing | Story Map (ordering task) | 3 items |
| Phonological | Phonics Blender / Rhyme Studio (assessment mode) | 4 items |
| Mathematical | Math Primitives (assessment mode) | 4 items |

Each probe is 3–5 items targeting a single subskill. Scoring: ≥ 75% correct = PASS. This threshold is deliberately set at the same level as the mastery gate threshold for consistency.

### 2.5 Student Experience

The diagnostic should feel like an exciting first day, not a test:

```
DIAGNOSTIC FLOW

Welcome Screen:
  "Welcome to Lumina! Before we start learning, 
   let's see what you already know! 🌟
   This isn't a test — just some fun activities. 
   Don't worry if something is tricky!"

Activity Loop:
  → Subject transition: "Let's try some reading!" (subject icon + animation)
  → Probe presented as a normal primitive activity
  → No "correct/incorrect" feedback during diagnostic (avoid discouragement)
  → After each probe: encouraging transition ("Nice work! Let's try another!")
  → Between subjects: short break option

Progress:
  → Show stars/progress ("You've done 8 activities! Almost there!")
  → Never show scores or pass/fail during the diagnostic

Completion:
  "All done! 🎉 We learned a lot about what you know! 
   Now we can build the perfect learning plan just for you."

Parent View (simultaneous):
  Real-time display of skills being assessed
  Preliminary knowledge profile building as probes complete
  "Your child demonstrated knowledge of 12 Language Arts skills so far..."
```

---

## 3. Knowledge Profile

### 3.1 Profile Schema

The diagnostic produces a **knowledge profile** — a complete snapshot of the student's assessed and inferred mastery state across the curriculum:

```
knowledge_profile: {
  student_id: string,
  created_at: timestamp,
  diagnostic_session_ids: string[],
  
  total_probed: number,           // skills directly tested
  total_inferred: number,         // skills inferred from graph propagation
  total_classified: number,       // probed + inferred
  coverage_pct: number,           // classified / total curriculum
  
  by_subject: {
    [subject]: {
      total_skills: number,
      mastered: number,            // PASS or INFERRED_MASTERED
      not_mastered: number,        // FAIL or INFERRED_NOT_MASTERED
      unknown: number,             // not yet classified
      mastery_pct: number,
      frontier_skills: string[],   // the knowledge frontier
      frontier_lesson_groups: string[]  // lesson groups to teach first
    }
  },
  
  skills: {
    [subskill_id]: {
      status: "mastered" | "inferred_mastered" | "not_mastered" | 
              "inferred_not_mastered" | "unknown",
      confidence: "high" | "medium" | "low",
      source: "probed" | "upward_inference" | "downward_inference" | 
              "cross_domain_inference",
      probe_score: number | null,  // if directly probed
      probe_items: number | null
    }
  }
}
```

### 3.2 Profile → Curriculum Seeding

The knowledge profile seeds the mastery tracking system:

```
For each subskill in knowledge_profile.skills:

  If status == "mastered" (directly probed, high confidence):
    → Set gate = CLOSED
    → Set mastery_score = probe_score
    → Mark as "placement_credited"
    → No further review needed unless student struggles with dependents

  If status == "inferred_mastered" (upward inference):
    → Set gate = GATE_2_PRACTICE (skip lesson, go to practice)
    → Schedule a verification practice session
    → If verification passes → CLOSED
    → If verification fails → back to GATE_1_LESSON
    → Mark as "placement_inferred"

  If status == "not_mastered" (directly probed):
    → Set gate = GATE_1_LESSON (normal starting point)
    → Mark as "placement_assessed"
    → This skill is on the knowledge frontier if its prereqs are mastered

  If status == "inferred_not_mastered" (downward inference):
    → Set gate = NOT_STARTED
    → Will be reached when prerequisites are mastered

  If status == "unknown":
    → Set gate = NOT_STARTED
    → Standard treatment — will be assessed or taught when reached
```

**The conservative bias:** Directly probed mastery → full credit (CLOSED). Inferred mastery → partial credit (skip to practice gate, but verify). This ensures a student is never placed beyond their actual ability on skills that weren't directly tested.

### 3.3 Verification Sessions

For inferred-mastered skills, the system schedules lightweight verification sessions in the first 1–2 weeks after placement. These are short practice-depth blocks (not full lessons) that confirm the inference:

```
verification_session: {
  subskill_id: string,
  source: "placement_inferred",
  type: "practice",
  primitives: 2–3 assessment-oriented items,
  duration: ~3 min,
  
  on_pass: → confirm CLOSED, no further review
  on_fail: → revert to GATE_1_LESSON, schedule full lesson group
}
```

Verification sessions are lower priority than new learning but should complete within the first 2 weeks. The planner sprinkles 2–3 verification items per session alongside regular lesson groups.

### 3.4 Impact on Knowledge Frontier

With the profile seeded, the planner's behavior changes fundamentally:

```
BEFORE (zero proficiency):
  All 674 skills start at NOT_STARTED
  Frontier = root nodes only (most basic skills)
  Student forced to start from absolute beginning

AFTER (diagnostic placement):
  ~200 skills seeded as MASTERED/INFERRED_MASTERED (30% estimate)
  ~474 skills remain NOT_MASTERED or UNKNOWN
  Frontier = skills whose prerequisites are all mastered but the skill itself isn't
  Student starts at their actual learning edge
```

The frontier is typically much wider than the root set. Instead of 10–15 starting skills (all foundational), the student might have 40–60 frontier skills across subjects — a rich set of options for the planner to build sessions from. This enables better subject interleaving, cognitive variety, and engagement.

---

## 4. Embedded Review-Through-Teaching

### 4.1 Skycak's Principle #7

"Review old stuff by learning new stuff. Knock out as much review as possible by learning new material that exercises those review topics as subskills."

This is the most subtle principle and one that the lesson group architecture is uniquely positioned to implement.

### 4.2 How It Works

When a student learns a new skill, they necessarily exercise the prerequisite skills. If a lesson group for "Identify the rhyming word from a set of three" (Explain level) includes primitives that require the student to first recognize whether words rhyme (Identify level), the earlier skill is being reviewed *implicitly* — not through a dedicated review session, but as a component of learning the new skill.

The lesson generator can be explicitly designed for this:

```
Embedded Review Strategy:

When generating a lesson group:
1. Identify the prerequisite subskills for each subskill in the group
2. For prerequisites that are MASTERED but due for spaced repetition review:
   → Embed review items as scaffolding within the lesson
   → The "guided instruction" phase of a new skill uses mastered prerequisites
   → This counts as a review touch for the prerequisite's spaced repetition schedule
3. Track review credit:
   → When a prerequisite is exercised as part of a new skill's lesson,
     reset its spaced repetition timer
   → The student gets review credit without a dedicated review session
```

### 4.3 Concrete Example

Student is learning "Express addition situations within 5 using verbal explanations" (new skill). Prerequisites include "Count objects up to 5" and "Recognize number symbols 0–5" (both mastered, both due for review).

**Without embedded review:**
```
Session plan:
  Block 1: Counting review (10 min)          ← dedicated review
  Block 2: Number recognition review (10 min) ← dedicated review  
  Block 3: Addition lesson (18 min)           ← new learning
  Total: 38 min, 1 subskill advanced
```

**With embedded review:**
```
Session plan:
  Block 1: Addition lesson (18 min)
    Phase 1 (Identify): "Count these objects, then count these objects. 
      How many are there altogether?"
      → Counting is exercised as part of addition instruction
      → Number recognition is exercised when reading "3 + 2 = ?"
    Phase 2 (Explain): "Match the picture to the equation"
      → Both prerequisites exercised again
    Phase 3 (Apply): "Tell me a story about 3 apples and 2 oranges"
      → New skill practiced; prerequisites embedded
  Total: 18 min, 1 subskill advanced, 2 prerequisites reviewed
```

**Result:** Same learning outcome. Half the time. No dedicated review sessions for those prerequisites. The review budget opens up for skills that *can't* be reviewed through new learning.

### 4.4 Review Classification

Not all reviews can be embedded. The system should classify review obligations:

| Review Type | Definition | Strategy |
|---|---|---|
| **Embeddable** | Prerequisite of a skill currently being taught | Embed in lesson; count as review touch |
| **Adjacent** | In the same domain as current teaching but not a direct prerequisite | Include as a warm-up item in the lesson group |
| **Standalone** | Unrelated domain, cannot be naturally embedded | Requires dedicated review session in the queue |

The planner should maximize embeddable and adjacent reviews, then allocate remaining review budget to standalone reviews.

### 4.5 Impact on Review Budget

If 40–60% of due reviews can be satisfied through embedded review-through-teaching:

```
Current model:
  Review budget: 50% of 75 min = 37.5 min
  Introduction budget: 37.5 min
  Subskills advanced per session: ~4–6

With embedded review:
  Standalone review budget: 20–30% of 75 min = 15–22.5 min
  Introduction budget: 52.5–60 min
  Embedded reviews handled within lesson groups: +0 time cost
  Subskills advanced per session: ~6–10
  Review obligations met: same or higher
```

This is a 50–70% increase in introduction capacity without any change to daily time. The solvency math improves dramatically.

### 4.6 Lesson Generator Changes

The generator needs a new input: the student's review queue, filtered to embeddable prerequisites:

```
lesson_group_request: {
  lesson_group_id: "addition-within-5",
  subskills: [
    { id: "MATH-OA-01", bloom_phase: "identify", gate: "lesson", status: "new" },
    { id: "MATH-OA-02", bloom_phase: "explain", gate: "lesson", status: "new" },
    { id: "MATH-OA-03", bloom_phase: "apply",   gate: "lesson", status: "new" }
  ],
  
  // NEW: embeddable review context
  embeddable_reviews: [
    { id: "MATH-CC-05", name: "Count objects up to 5", review_due: true },
    { id: "MATH-CC-02", name: "Recognize number symbols 0-5", review_due: true }
  ],
  
  generator_instruction: "Incorporate MATH-CC-05 and MATH-CC-02 as scaffolding 
    within the lesson. Students should exercise counting and number recognition 
    as part of learning addition. Track these as review touches."
}
```

The generator weaves prerequisite exercises into the instruction naturally — not as separate review items, but as the building blocks of the new skill's teaching.

### 4.7 Telemetry: Review Credit Tracking

Session telemetry needs to capture embedded review credit:

```
phase: {
  bloom_phase: "identify",
  subskill_id: "MATH-OA-01",           // primary target
  gate: "lesson",
  // ... existing fields ...
  
  embedded_reviews: [                    // NEW
    {
      subskill_id: "MATH-CC-05",
      exercised: true,
      performance_adequate: true,        // student demonstrated competence
      review_credit_awarded: true        // resets spaced repetition timer
    },
    {
      subskill_id: "MATH-CC-02",
      exercised: true,
      performance_adequate: true,
      review_credit_awarded: true
    }
  ]
}
```

The mastery engine processes embedded review credits the same as standalone review completions: reset the spaced repetition timer, update the completion factor, and potentially trigger closure if the skill has been consistently demonstrated across enough review touches.

---

## 5. Knowledge Frontier Visualization

### 5.1 Parent View

The knowledge frontier is a powerful concept but needs a parent-friendly representation:

```
┌─────────────────────────────────────────────────┐
│  [Child]'s Learning Map — Language Arts          │
│                                                   │
│  ✅ Already Knows (87 skills)                    │
│  ██████████████████████████████░░░░░░░░░░░  33%  │
│                                                   │
│  🔥 Ready to Learn Next:                         │
│  • Blending sounds to make words                  │
│  • Sequencing story events                        │
│  • Writing simple sentences                       │
│  • Identifying story characters                   │
│                                                   │
│  🔒 Coming Later (needs prerequisites first):    │
│  • Reading short stories independently            │
│  • Comparing two stories                          │
│  • Writing paragraphs                             │
└─────────────────────────────────────────────────┘
```

The parent sees: what's known, what's next, and what's coming later. No graph theory required.

### 5.2 Developer View

The prerequisite DAG with mastery overlay — nodes colored by status:

- Green: MASTERED / INFERRED_MASTERED
- Blue: FRONTIER (ready to learn)
- Gray: NOT_STARTED (prerequisites not yet met)
- Yellow: IN_REVIEW (in the learning pipeline)
- Red: STRUGGLING (failed recent attempts)

This is the graph that Math Academy visualizes. Lumina's version would show the K curriculum as a DAG with the student's current position highlighted.

---

## 6. Ongoing Proficiency Updates

### 6.1 The Profile Is Living

The initial diagnostic produces a snapshot. But proficiency evolves continuously as the student learns. The knowledge profile should update in real time:

```
Profile update triggers:

1. Skill closure → mark MASTERED, propagate to dependents' prerequisite status
2. Skill failure after placement credit → revert to appropriate gate
3. New lesson group completed → update frontier (new skills may become available)
4. Verification session result → confirm or revert inferred mastery
5. Exhibit completion with assessment → potential shadow credit → frontier expansion
```

### 6.2 Re-Diagnostic

Offer an optional re-diagnostic after major milestones:

- After first quarter (6–8 weeks): re-probe UNKNOWN skills to narrow uncertainty
- After subject completion: placement test for next grade level
- On demand: parent requests re-assessment (e.g., after summer break)

The re-diagnostic is faster than the initial one because the knowledge profile is already partially populated. Only UNKNOWN and low-confidence skills need probing.

### 6.3 Grade Transition

When a student completes sufficient Core skills in a subject to be considered grade-level proficient, the system can offer next-grade diagnostic placement:

```
If K Language Arts core skills ≥ 80% MASTERED:
  → Offer Grade 1 Language Arts diagnostic
  → Run adaptive placement against Grade 1 prerequisite DAG
  → Seed Grade 1 profile
  → Student may already know 10–20% of Grade 1 from K enrichment
```

This enables continuous, grade-boundary-free progression — exactly what Math Academy does.

---

## 7. Integration Points

### 7.1 With Daily Learning PRD

| Daily Learning Component | Integration |
|---|---|
| Lesson Group scheduling | Frontier skills determine which lesson groups are eligible for scheduling. Only groups where all prerequisite subskills are mastered can be queued. |
| Time-based capacity | Diagnostic placement reduces total skills to teach, which directly reduces required time and improves solvency ratio. |
| Mixed gate states | Placement produces groups where some subskills are CLOSED (mastered), some GATE_2 (inferred, verify), and some GATE_1 (not mastered). The mixed-gate lesson generator handles this naturally. |
| Session runner | Verification sessions appear as lightweight blocks in the daily session, interleaved with regular lesson groups. |
| Review budget | Embedded review-through-teaching reduces standalone review needs, freeing more introduction capacity. |
| Telemetry | Embedded review credit tracked per-phase alongside primary subskill scoring. |

### 7.2 With Analytics & Report Card PRD

| Analytics Component | Integration |
|---|---|
| Solvency engine | Uses placement-adjusted skill counts (total minus mastered) for required run rate. Solvency ratio immediately improves post-diagnostic. |
| Report card Level 0 | Status indicators reflect placement-adjusted targets, not raw curriculum totals. |
| Report card Level 2 | Shows "Already Knew: 87 skills" as a distinct category alongside mastered-through-learning. |
| Competency reporting | Competencies where all component subskills were placement-credited show as "Already Known" with a distinct badge. |
| Trajectory projections | Dramatic improvement: 200 fewer skills to teach means projections shift from "behind" to "on track" with the same throughput. |
| Achievement events | "Placement complete! Already knows 142 skills across 4 subjects! 🌟" |
| A/E ratios | Placement-credited skills excluded from learning throughput calculations (they weren't taught, so they shouldn't inflate A/E). |

---

## 8. Skycak Alignment Scorecard (Post-Implementation)

| # | Principle | Lumina Implementation | Status |
|---|---|---|---|
| 1 | Identify what the student already knows | Adaptive diagnostic with graph-based inference propagation | ✅ |
| 2 | Overlay on a knowledge graph | Prerequisite DAG across 674 K subskills with mastery overlay | ✅ |
| 3 | Teach only the knowledge frontier | Planner schedules only lesson groups whose prerequisites are mastered | ✅ |
| 4 | Minimum effective dose of instruction + practice | Bloom's 3-phase lessons: Identify → Explain → Apply, 9–12 primitives | ✅ |
| 5 | Enforce mastery, continue on parallel paths | Gate system (Lesson → Practice → Retest → Closed) + multi-subject interleaving | ✅ |
| 6 | Spaced repetition review | Completion factor model + interval scheduling (3/7/14/28 days) | ✅ |
| 7 | Review old by learning new | Embedded review-through-teaching: prerequisites exercised within new skill lessons | ✅ |

All seven principles implemented. The diagnostic placement engine is the keystone that activates the full framework.

---

## 9. Requirements Summary

### P0 — Phase 1 (Weeks 1–4)

| Req ID | Requirement | Description |
|---|---|---|
| DP-001 | Prerequisite DAG export | Export curriculum prerequisite chains as a traversable graph structure for the diagnostic algorithm |
| DP-002 | Adaptive diagnostic algorithm | Binary-search-style probing with upward/downward inference propagation (Section 2.2) |
| DP-003 | Assessment primitive modes | Configure existing primitives for diagnostic mode: reduced scaffolding, no teaching, score-only (Section 2.4) |
| DP-004 | Diagnostic session UX | Child-friendly assessment flow with encouragement, no pass/fail feedback (Section 2.5) |
| DP-005 | Knowledge profile schema | Firestore document capturing per-subskill status, confidence, source (Section 3.1) |
| DP-006 | Profile → curriculum seeding | Map profile statuses to gate levels and seed the mastery tracking system (Section 3.2) |
| DP-007 | Frontier identification | Algorithm to compute knowledge frontier from profile + prerequisite DAG (Section 3.4) |
| DP-008 | Planner: frontier-aware scheduling | Only schedule lesson groups whose prerequisite subskills are mastered (existing behavior enhanced with placement data) |

### P1 — Phase 2 (Weeks 5–10)

| Req ID | Requirement | Description |
|---|---|---|
| DP-009 | Verification sessions | Lightweight practice blocks to confirm inferred mastery (Section 3.3) |
| DP-010 | Embedded review-through-teaching | Generator incorporates prerequisite review into new skill lessons (Section 4.6) |
| DP-011 | Review credit telemetry | Track embedded review touches per phase (Section 4.7) |
| DP-012 | Review classification engine | Classify due reviews as embeddable / adjacent / standalone (Section 4.4) |
| DP-013 | Planner: embedded review optimization | Maximize embedded review when selecting lesson groups for daily queue |
| DP-014 | Parent: knowledge map view | Friendly visualization of known / frontier / locked skills (Section 5.1) |
| DP-015 | Cross-domain inference rules | Lower-confidence inference across related skill domains (Section 2.3) |

### P2 — Phase 3 (Weeks 11–17)

| Req ID | Requirement | Description |
|---|---|---|
| DP-016 | Re-diagnostic capability | Abbreviated re-assessment targeting UNKNOWN and low-confidence skills (Section 6.2) |
| DP-017 | Grade transition diagnostic | Placement test for next grade level when current grade substantially mastered (Section 6.3) |
| DP-018 | Developer: DAG visualization | Interactive prerequisite graph with mastery overlay (Section 5.2) |
| DP-019 | Living profile updates | Real-time profile updates on skill closure, failure, exhibit credit (Section 6.1) |
| DP-020 | Solvency engine: placement-adjusted targets | Solvency calculations use placement-adjusted skill counts |

---

## 10. Success Metrics

| Metric | Without Placement | With Placement (Target) |
|---|---|---|
| Skills credited at onboarding | 0 | ≥ 100 (conservative) |
| Time to first frontier lesson | Day 1 (foundational skills) | Day 1 (at student's actual level) |
| Diagnostic duration | N/A | ≤ 30 min |
| Solvency ratio at onboarding | ~0.8 (tight) | ~1.2 (comfortable surplus) |
| Wasted sessions on known material | ~80 sessions | 0 |
| Introduction rate (week 1) | Slow (starting from bottom) | High (wide frontier) |
| Review-through-teaching coverage | 0% | ≥ 40% of due reviews |
| Standalone review budget needed | 50% of daily time | 25–35% of daily time |
| Student engagement (first week) | Risk of boredom on known material | Appropriately challenging from day 1 |

---

## 11. Implementation Status (v1.1)

### What Was Built — Backend Core (March 2026)

The backend diagnostic placement engine is implemented and covers **DP-001, DP-002, DP-005, DP-006, DP-007, and DP-008** from the requirements. The system is a clean addition to the existing architecture with no modifications to the planning service (it feeds directly into the mastery lifecycle that the planner already reads).

#### 11.1 New Files

| File | Purpose |
|------|---------|
| `backend/app/models/diagnostic.py` | Pydantic models: `DiagnosticSession`, `SubskillClassification`, `NodeMetrics`, `ProbeRequest`, enums (`DiagnosticStatus`, `DiagnosticSessionState`), gate/completion mapping constants |
| `backend/app/services/dag_analysis.py` | **Pure DAG algorithms** — stateless, IO-free, fully unit-tested. Implements: Kahn's topological sort, longest-path depth/height via DP, BFS ancestor/descendant traversal, Union-Find connected components, midpoint probe selection, inference propagation, frontier identification |
| `backend/app/services/diagnostic_service.py` | **Session orchestrator** — wraps DAGAnalysisEngine with Firestore persistence. Manages session lifecycle: create → probe-result → complete. Handles mastery lifecycle seeding and unlock recalculation |
| `backend/app/api/endpoints/diagnostic.py` | REST API: 5 endpoints + health check |
| `backend/tests/test_dag_analysis.py` | **34 unit tests** covering all algorithm paths (all passing) |

#### 11.2 Modified Files

| File | Change |
|------|--------|
| `backend/app/schemas/problem_submission.py` | Added `"diagnostic"` to `ProblemSubmission.source` Literal type |
| `backend/app/models/mastery_lifecycle.py` | Added `"diagnostic"` to `GateHistoryEntry.source` Literal type |
| `backend/app/services/competency.py` | Guard: skip mastery lifecycle hook when `source == "diagnostic"` (diagnostic seeds in bulk at completion) |
| `backend/app/db/firestore_service.py` | Added: `batch_write_mastery_lifecycles()`, `save_diagnostic_session()`, `get_diagnostic_session()`, `get_student_diagnostic_sessions()` |
| `backend/app/dependencies.py` | Added `DiagnosticService` singleton + `get_diagnostic_service()` getter |
| `backend/app/main.py` | Registered diagnostic router at `/api/diagnostic` |

#### 11.3 API Endpoints

```
POST /api/diagnostic/sessions
  Body: { subjects?: ["MATHEMATICS", "LANGUAGE_ARTS"] }
  Returns: { session_id, student_id, subjects, total_nodes, probes: [...] }

POST /api/diagnostic/sessions/{id}/probe-result
  Body: { subskill_id, score (0-1), items_completed }
  Returns: { status: "continue"|"complete", classified_count, total_count,
             coverage_pct, probes: [...], inferences_made: [...] }

GET  /api/diagnostic/sessions/{id}
  Returns: Full session state (for resume / parent real-time view)

POST /api/diagnostic/sessions/{id}/complete
  Returns: { session_id, student_id, seeded_count, frontier_skills,
             knowledge_profile: {...} }

GET  /api/diagnostic/sessions/{id}/knowledge-profile
  Returns: { by_subject: {...}, frontier_skills, coverage_pct }
```

#### 11.4 DAG Midpoint Algorithm (Transparent)

The probe selection is deterministic and explainable. Every `ProbeRequest` includes:
- `depth` — how far from the root this skill is
- `chain_length` — the longest path through this skill
- `reason` — human-readable explanation (e.g., "midpoint of 12-node chain at depth 6")

**Algorithm:**
1. Load subskill DAG per subject from `curriculum_graphs` (existing Firestore collection)
2. Topological sort (Kahn's algorithm — detects cycles)
3. Forward DP: `depth[n] = max(depth[pred] + 1)` — longest path from any root
4. Reverse DP: `height[n] = max(height[succ] + 1)` — longest path to any leaf
5. `chain_length[n] = depth + height` — longest chain passing through n
6. Group nodes into independent chains (Union-Find connected components)
7. Pick one midpoint per chain (node where `depth ≈ chain_length / 2`)
8. After each probe result, binary search within the remaining UNKNOWN region

**Inference propagation:**
- PASS on node X → BFS upward: all ancestors become `INFERRED_MASTERED`
- FAIL on node X → BFS downward: all descendants become `INFERRED_NOT_MASTERED`
- Direct evidence (probed) NEVER overwritten by inference

#### 11.5 Mastery Seeding (PRD §3.2 Implementation)

When `POST /complete` is called, the diagnostic service writes mastery lifecycle docs in bulk:

| Diagnostic Status | Gate | completion_pct | Behavior |
|---|---|---|---|
| `probed_mastered` | 4 (CLOSED) | 1.0 | Full credit, no retests needed |
| `inferred_mastered` | 2 (RETEST_1) | 0.5 | Skip lessons, verification retest scheduled in 3 days |
| `probed_not_mastered` | 0 (NOT_STARTED) | 0.0 | Needs full lesson path |
| `inferred_not_mastered` | 0 (NOT_STARTED) | 0.0 | Not started, queued when prerequisites met |
| `unknown` | — | — | No doc created — standard treatment |

After seeding, `recalculate_unlocks()` fires for each subject so the planner immediately sees the new frontier.

#### 11.6 Integration with Existing Submission Pipeline

Diagnostic probe answers flow through the existing `POST /api/problems/submit` endpoint with `source: "diagnostic"`. This:
- **Saves** the attempt and review to Firestore (record-keeping)
- **Skips** mastery lifecycle processing (no gate transitions during diagnostic)
- **Skips** unlock recalculation (diagnostic handles this at completion)

The diagnostic service aggregates scores independently and reports them via `/probe-result`. No parallel evaluation system was created.

#### 11.7 Planning Service — Zero Changes Required

The existing `PlanningService.get_daily_plan()` reads `mastery_lifecycle` docs from Firestore in real-time. After diagnostic seeding:
- Gate 4 (probed_mastered) skills are filtered out of review queues — already mastered
- Gate 2 (inferred_mastered) skills appear in retest queue when `next_retest_eligible` passes (3 days)
- Gate 0 skills appear as new-skill candidates when their prerequisites are met
- The knowledge frontier is automatically wider, giving the planner more scheduling options

---

## 12. Next Steps

### Immediate (to make the backend fully testable end-to-end)

1. **Integration test with real curriculum graph** — Create a test that starts a diagnostic session against the actual MATHEMATICS curriculum graph, simulates probe results, verifies inference propagation, completes the session, and checks that mastery lifecycle docs were written correctly to Firestore.

2. **Run `npx tsc --noEmit` / Python syntax check** — The DAG analysis engine has 34 passing unit tests. The service and endpoint layers need integration testing against Firestore (or a mock).

### Frontend (DP-003, DP-004 — not yet started)

3. **Diagnostic session UX component** — A new Lumina flow that:
   - Calls `POST /api/diagnostic/sessions` to start
   - Presents probe items using existing primitives in "assessment mode" (reduced scaffolding, no teaching, no pass/fail feedback)
   - Submits each item via `POST /api/problems/submit` with `source: "diagnostic"`
   - After all items for a probe, calls `POST /api/diagnostic/sessions/{id}/probe-result` with the aggregated score
   - Shows encouraging transitions between probes ("Nice work! Let's try another!")
   - Displays progress ("You've done 8 activities! Almost there!")
   - On completion, calls `POST /api/diagnostic/sessions/{id}/complete`

4. **Assessment primitive modes** — Configure existing primitives (FastFact, KnowledgeCheck, etc.) for diagnostic mode: score-only, no teaching scaffolding, 3-5 items per probe.

5. **Parent real-time view** — Poll `GET /api/diagnostic/sessions/{id}/knowledge-profile` during the diagnostic to show parents a live view of skills being assessed and preliminary profile.

### P1 Features (DP-009 through DP-015)

6. **Verification sessions** — The backend already seeds `inferred_mastered` skills at Gate 2 with a 3-day retest. The planner will schedule these automatically. Consider adding a `placement_inferred` tag to distinguish verification retests from regular retests in the daily plan UI.

7. **Embedded review-through-teaching** — Requires changes to the lesson generator to accept `embeddable_reviews` context. The planner would classify due reviews as embeddable/adjacent/standalone and pass embeddable prereqs to the generator. This is a separate workstream from the diagnostic engine itself.

8. **Parent knowledge map view** — The `/knowledge-profile` endpoint already returns per-subject summaries with frontier skills. Build a frontend component that visualizes "Already Knows / Ready to Learn / Coming Later" (PRD §5.1).

### P2 Features (DP-016 through DP-020)

9. **Re-diagnostic** — The session infrastructure supports this naturally. A re-diagnostic would load the existing knowledge profile, mark previously-classified skills, and only probe UNKNOWN + low-confidence skills. The backend would need a `POST /api/diagnostic/sessions` variant that accepts an existing profile to seed from.

10. **Living profile updates** — Hook into mastery lifecycle events (skill closure, failure) to update the knowledge profile in real-time. Currently the profile is a snapshot from the diagnostic session; making it live requires a listener or periodic recomputation.

11. **Solvency engine integration** — The weekly planner already uses mastery lifecycle state. After diagnostic seeding, `total_skills - closed - in_review` automatically decreases, improving the solvency ratio. No code change needed — the planner's existing math handles this. Consider adding a "placement-credited" count to the weekly plan response for visibility.
