# Evaluation-Based Prompt Improvement Workflow

## Visual Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      EVALUATION-DRIVEN PROMPT WORKFLOW                       │
└─────────────────────────────────────────────────────────────────────────────┘

PHASE 1: GENERATION WITH CONTEXT VARIETY
═══════════════════════════════════════════════════════════════════════════════

  ┌──────────────┐
  │   Frontend   │
  │  UI Request  │
  └──────┬───────┘
         │
         │ POST /api/subskills/{id}/problems/generate
         │ { count: 5, auto_evaluate: true }
         ▼
  ┌──────────────────────────┐
  │  Problem Generator       │
  │  Service                 │
  └──────┬───────────────────┘
         │
         ├─► Step 1: Sample Context Primitives (2× count)
         │   ├─ Objects: "apple, desk, pencil, backpack, ..."
         │   ├─ Characters: "Emma, Mr. Johnson, Sophia, ..."
         │   ├─ Scenarios: "Morning circle, Reading time, ..."
         │   └─ Locations: "classroom, library, playground, ..."
         │
         ├─► Step 2: Build Prompt with Primitives
         │   ┌────────────────────────────────────────────┐
         │   │ You are an expert educator...             │
         │   │                                           │
         │   │ **Context Variety Guidelines**:          │
         │   │ **Objects to use**: apple, desk, ...     │
         │   │ **Characters**: Emma, Mr. Johnson, ...   │
         │   │ **Scenarios**: Morning circle, ...       │
         │   │ **Locations**: classroom, library, ...   │
         │   │                                           │
         │   │ Generate 5 multiple_choice problems...   │
         │   └────────────────────────────────────────────┘
         │
         ├─► Step 3: Generate Problems via Gemini AI
         │   ├─ Problem 1: Uses "apple" and "Emma" in "classroom"
         │   ├─ Problem 2: Uses "desk" and "Sophia" in "library"
         │   ├─ Problem 3: Uses "pencil" and "Mr. Johnson" in "playground"
         │   ├─ Problem 4: Uses "backpack" and "Emma" in "classroom"
         │   └─ Problem 5: Uses "apple" and "Sophia" in "library"
         │
         └─► Step 4: Store in BigQuery
             ┌─────────────────────────────────────────────┐
             │ curriculum_problems                        │
             ├─────────────────────────────────────────────┤
             │ problem_id: "prob-123"                     │
             │ problem_type: "multiple_choice"            │
             │ problem_data: { question, options, ... }   │
             │ generation_prompt: "You are an expert..." │ ◄── Actual prompt!
             │ generation_metadata: {                     │
             │   primitives_used: {                       │
             │     objects: ["apple", "desk"],            │
             │     characters: ["Emma", "Sophia"],        │
             │     scenarios: ["Morning circle"],         │
             │     locations: ["classroom"]               │
             │   }                                        │
             │ }                                          │
             └─────────────────────────────────────────────┘


PHASE 2: EVALUATION
═══════════════════════════════════════════════════════════════════════════════

  Auto-evaluate (if enabled) OR Manual batch evaluate
         │
         ▼
  ┌──────────────────────────┐
  │  Problem Evaluation      │
  │  Service                 │
  └──────┬───────────────────┘
         │
         ├─► For each problem:
         │   ├─ Pedagogical Approach: 8.5/10
         │   ├─ Alignment: 9.0/10
         │   ├─ Clarity: 8.0/10
         │   ├─ Correctness: 9.5/10
         │   ├─ Bias: 9.0/10
         │   └─ Overall: 8.8/10
         │
         └─► Store evaluation in BigQuery
             ┌─────────────────────────────────────────────┐
             │ problem_evaluations                        │
             ├─────────────────────────────────────────────┤
             │ problem_id: "prob-123"                     │
             │ overall_score: 8.8                         │
             │ pedagogical_approach_score: 8.5            │
             │ alignment_score: 9.0                       │
             │ clarity_score: 8.0                         │
             │ correctness_score: 9.5                     │
             │ bias_score: 9.0                            │
             │ final_recommendation: "approve"            │ ◄── Score ≥ 8.5!
             │ detailed_feedback: "Excellent..."          │
             └─────────────────────────────────────────────┘


PHASE 3: ANALYSIS & IDENTIFICATION
═══════════════════════════════════════════════════════════════════════════════

  ┌──────────────────────────────────────────────────────────┐
  │  Query: Find High-Performing Prompts                    │
  ├──────────────────────────────────────────────────────────┤
  │  SELECT p.generation_prompt,                            │
  │         AVG(e.overall_score) as avg_score,              │
  │         COUNT(*) as usage_count                         │
  │  FROM curriculum_problems p                             │
  │  JOIN problem_evaluations e ON p.problem_id = e.id     │
  │  WHERE e.final_recommendation = 'approve'              │
  │    AND e.overall_score >= 8.5                          │
  │  GROUP BY p.generation_prompt                           │
  │  HAVING COUNT(*) >= 5                                   │
  │  ORDER BY avg_score DESC                                │
  └──────────────────────────────────────────────────────────┘
         │
         ▼
  ┌────────────────────────────────────────┐
  │ Results: High-Quality Prompts          │
  ├────────────────────────────────────────┤
  │ 1. Prompt A: 9.2/10 avg (15 uses)     │ ◄── Best performer!
  │ 2. Prompt B: 8.9/10 avg (12 uses)     │
  │ 3. Prompt C: 8.7/10 avg (8 uses)      │
  │ 4. Prompt D: 8.6/10 avg (6 uses)      │
  └────────────────────────────────────────┘


PHASE 4: PROMOTION TO TEMPLATE LIBRARY (Optional)
═══════════════════════════════════════════════════════════════════════════════

  For consistently high-scoring prompts (>85%, 10+ evaluations):

  ┌──────────────────────────┐
  │  Promote to Template     │
  │  Library                 │
  └──────┬───────────────────┘
         │
         └─► Create template entry
             ┌─────────────────────────────────────────────┐
             │ prompt_templates                           │
             ├─────────────────────────────────────────────┤
             │ template_id: "tmpl-456"                    │
             │ template_name: "rhyming_proven_v1"         │
             │ template_type: "problem_generation"        │
             │ template_text: "You are an expert..."      │ ◄── Proven prompt!
             │ version: 1                                 │
             │ is_active: true                            │
             │ performance_metrics: {                     │
             │   avg_evaluation_score: 9.2,               │
             │   approval_rate: 0.93,                     │
             │   total_generations: 15                    │
             │ }                                          │
             └─────────────────────────────────────────────┘


PHASE 5: PRODUCTION USE
═══════════════════════════════════════════════════════════════════════════════

  Production app queries for best prompts:

  GET /api/prompts/production/prompts/best-performing
      ?min_approval_rate=0.85
      &min_evaluations=5

         │
         ▼
  ┌────────────────────────────────────────────────┐
  │  Prompt Manager Service                       │
  │  - Finds all active templates                 │
  │  - Calculates performance metrics             │
  │  - Filters by approval rate >= 85%            │
  │  - Weighted random selection                  │
  └────────────┬───────────────────────────────────┘
               │
               ▼
  ┌────────────────────────────────────────────────┐
  │  Returns Best Prompt                          │
  ├────────────────────────────────────────────────┤
  │  template: { ... }                            │
  │  metrics: {                                   │
  │    avg_evaluation_score: 9.2,                 │
  │    approval_rate: 0.93,                       │
  │    total_generations: 15                      │
  │  }                                            │
  │  selection_pool_size: 4                       │
  │  rationale: "Selected from 4 qualifying..."   │
  └────────────────────────────────────────────────┘
```

## Iteration Cycle

```
    ┌─────────────┐
    │  Generate   │
    │  Problems   │──────┐
    └─────────────┘      │
           ▲             │
           │             ▼
    ┌──────┴──────┐  ┌─────────────┐
    │  Improve    │  │  Evaluate   │
    │  Prompts    │  │  Quality    │
    └──────┬──────┘  └─────────────┘
           │             │
           │             ▼
    ┌──────┴──────────────────┐
    │  Identify High-Scoring  │
    │  Prompts (>85%)         │
    └─────────────────────────┘

    Repeat weekly to build prompt library
```

## Decision Tree

```
Problem Generated
    │
    ├─ Has custom_prompt?
    │   ├─ YES ──► Use custom prompt
    │   └─ NO ───► Use context variety (sample primitives)
    │
    ▼
Problem Stored (with actual prompt)
    │
    ├─ Auto-evaluate enabled?
    │   ├─ YES ──► Evaluate immediately
    │   └─ NO ───► Wait for manual batch evaluate
    │
    ▼
Problem Evaluated
    │
    ├─ Overall score >= 8.5?
    │   ├─ YES ──► Recommendation: APPROVE ✅
    │   │          - Mark for template promotion
    │   │          - Track in high-quality library
    │   │
    │   ├─ 6.0 <= score < 8.5?
    │   │   └─► Recommendation: REVISE ⚠️
    │   │       - Flag for improvement
    │   │       - Analyze feedback
    │   │
    │   └─ score < 6.0?
    │       └─► Recommendation: REJECT ❌
    │           - Add to regeneration queue
    │           - Analyze failure patterns
    │
    ▼
High-Scoring Prompts (>85%)
    │
    ├─ Usage count >= 10?
    │   ├─ YES ──► Promote to template library
    │   │          - Create template entry
    │   │          - Make available for production
    │   │
    │   └─ NO ───► Continue monitoring
    │              - Track performance
    │              - Wait for more data
    │
    ▼
Production Ready Template
    - Available via best-performing endpoint
    - Can be used for consistent generation
    - Metrics tracked over time
```

## Data Flow

```
┌──────────────┐     ┌──────────────────┐     ┌────────────────────┐
│   Frontend   │────▶│   Backend API    │────▶│ Problem Generator  │
│   Request    │     │   Endpoint       │     │    Service         │
└──────────────┘     └──────────────────┘     └────────┬───────────┘
                                                        │
                                          ┌─────────────┴───────────┐
                                          │                         │
                                          ▼                         ▼
                                ┌──────────────────┐    ┌──────────────────┐
                                │ Context Primitives│    │  Foundations     │
                                │    Service        │    │    Service       │
                                └─────────┬─────────┘    └─────────┬────────┘
                                          │                         │
                                          └───────────┬─────────────┘
                                                      │
                                                      ▼
                                            ┌──────────────────┐
                                            │   Gemini AI      │
                                            │   Generation     │
                                            └─────────┬────────┘
                                                      │
                                ┌─────────────────────┴─────────────────────┐
                                │                                           │
                                ▼                                           ▼
                      ┌──────────────────┐                     ┌──────────────────┐
                      │  curriculum_     │                     │  problem_        │
                      │  problems        │◄────────────────────│  evaluations     │
                      │  (BigQuery)      │                     │  (BigQuery)      │
                      └──────────────────┘                     └──────────────────┘
                                │                                           │
                                └───────────────┬───────────────────────────┘
                                                │
                                                ▼
                                  ┌──────────────────────────┐
                                  │  Prompt Performance      │
                                  │  Analysis                │
                                  └─────────────┬────────────┘
                                                │
                                                ▼
                                  ┌──────────────────────────┐
                                  │  prompt_templates        │
                                  │  (High-quality library)  │
                                  └──────────────────────────┘
```

## Example: Real-World Flow

```
USER ACTION: "Generate 5 rhyming problems"
═══════════════════════════════════════════════════════════════

Step 1: Sample Primitives
─────────────────────────────────────────────────────────────
Sample 10 primitives (2× count):
- Objects: cat, hat, dog, log, sun, run
- Characters: Emma, Tom, Ms. Green, David
- Scenarios: Playing outside, Reading a story
- Locations: park, classroom

Step 2: Build Prompt
─────────────────────────────────────────────────────────────
Create prompt with primitives:
"You are an expert educator...

**Context Variety Guidelines**:
**Objects to use**: cat, hat, dog, log
**Characters to feature**: Emma, Tom, Ms. Green
**Scenarios to incorporate**: Playing outside, Reading a story
**Locations to reference**: park, classroom

Generate 5 multiple_choice problems about rhyming..."

Step 3: Generate Problems
─────────────────────────────────────────────────────────────
Problem 1: Emma and the cat/hat rhyme at the park
Problem 2: Tom finds a dog and log in the classroom
Problem 3: Ms. Green reads about sun/run outside
Problem 4: Emma's cat wears a hat (story time)
Problem 5: David sees dog and log at park

Step 4: Store
─────────────────────────────────────────────────────────────
Each problem stored with:
- problem_data: The actual problem
- generation_prompt: Full prompt with primitives
- generation_metadata: Which primitives were used

Step 5: Evaluate
─────────────────────────────────────────────────────────────
AI evaluation runs:
- Problem 1: 9.0/10 → APPROVE ✅
- Problem 2: 8.7/10 → APPROVE ✅
- Problem 3: 8.5/10 → APPROVE ✅
- Problem 4: 7.2/10 → REVISE ⚠️
- Problem 5: 5.8/10 → REJECT ❌

Step 6: Results
─────────────────────────────────────────────────────────────
Approval Rate: 60% (3/5 approved)
Average Score: 7.8/10
Action: Regenerate Problem 5 with new variation

Step 7: Learn & Improve
─────────────────────────────────────────────────────────────
Identify patterns:
- "cat/hat" context works well (9.0)
- "dog/log" context works well (8.7)
- "sun/run" context borderline (8.5)
- Story scenarios outperform park scenarios
```

## Metrics Dashboard (Conceptual)

```
┌────────────────────────────────────────────────────────────┐
│                 PROMPT PERFORMANCE DASHBOARD                │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Total Prompts Generated: 1,247                            │
│  Total Problems: 6,235                                     │
│  Total Evaluations: 5,892                                  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Quality Distribution                                │  │
│  │  ■■■■■■■■■■■■■■■■ Approved (72%)                    │  │
│  │  ■■■■■■ Needs Revision (18%)                        │  │
│  │  ■■■ Rejected (10%)                                 │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Top Performing Prompts (>90% approval)              │  │
│  │  1. Rhyming words prompt v3      - 94% (127 uses)   │  │
│  │  2. Addition word problems v2    - 92% (98 uses)    │  │
│  │  3. Letter recognition v5        - 91% (156 uses)   │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Context Variety Effectiveness                       │  │
│  │  Objects: High variety (87 unique)                   │  │
│  │  Characters: Medium variety (42 unique)              │  │
│  │  Scenarios: High variety (93 unique)                 │  │
│  │  Locations: Medium variety (38 unique)               │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

This workflow ensures continuous improvement through real-world evaluation,
building a library of proven prompts that deliver high-quality educational content.
