# Lumina — Adaptive Difficulty Calibration & Assessment Engine

**Product Requirements Document**

| Field   | Value        |
|---------|--------------|
| Version | 1.2          |
| Date    | March 2026   |
| Author  | Chris        |
| Status  | Phase 2 Complete |

---

## 1. Executive Summary

This PRD defines Lumina's Adaptive Difficulty Calibration and Assessment Engine, a system inspired by Coaching Actuaries' ADAPT platform that brings Item Response Theory (IRT), Bayesian ability estimation, and credibility-weighted item calibration to K–5 adaptive learning.

The core insight is that difficulty is not a property of individual problems but an emergent property of session assembly. The system calibrates item difficulty empirically through student response data, estimates student ability as a continuously updating Bayesian posterior, and composes assessment sessions by drawing from a difficulty-weighted distribution of problems across the existing mode taxonomy (Modes 1–6). The student-facing experience surfaces a transparent "Earned Level" (EL) score that provides a credible, motivating trajectory of growth — transforming early low scores from discouraging failures into expected data points on a visible path.

---

## 2. Problem Statement

### 2.1 Current State

Lumina's existing math primitives include 5–6 evaluation modes per skill ranging from manipulative-supported introductory modes (Modes 1–4) to abstract advanced modes (Modes 5–6). However, difficulty is currently implicit in mode selection and not parameterized, calibrated, or surfaced to the student. There is no mechanism to assemble sessions at a target difficulty level, no empirical measurement of item difficulty, and no visible trajectory of student ability growth.

### 2.2 Desired State

A system where every item has an empirically calibrated difficulty parameter, every student has a continuously updated ability estimate, session composition is governed by the gap between the two, and the student sees a transparent, credible Earned Level climbing over time. The system should produce the same motivational dynamic as ADAPT: early low scores are expected and contextualized, and progress is mathematically visible.

---

## 3. Design Principles

**Difficulty lives in assembly, not in items.** Individual problems are generated consistently within their mode. Session difficulty emerges from the distribution of modes selected. A difficulty 7 session is 80% Modes 5–6; a difficulty 3 session is 70% Modes 1–3. The Gemini prompt for any given mode does not change based on difficulty level.

**Item difficulty is empirical, not editorial.** Difficulty ratings are not assigned by curriculum designers. They are estimated from observed student performance data using IRT models and converge toward ground truth as observations accumulate.

**Cold-start uses credibility-weighted priors.** New items receive a prior difficulty based on structural features (mode, scaffolding level, number range). As response data accumulates, the posterior shifts toward the empirical estimate at a rate governed by credibility (volume of observations).

**The student trajectory is the product.** The Earned Level is not a hidden internal metric. It is the primary student-facing signal of progress, designed to reframe early failure as expected and make growth visible and motivating.

---

## 4. System Architecture

### 4.1 Component Overview

The engine consists of four services that operate in a pipeline from item-level calibration through student-facing display.

| Component | Responsibility | Key Output |
|-----------|---------------|------------|
| **Item Calibration Service** | Maintains and updates difficulty parameters for all items/problem-types using IRT and credibility weighting | Calibrated item difficulty (β) per problem-type |
| **Student Ability Estimator** | Computes and updates per-student, per-skill ability estimate (θ) using Bayesian updating after each session | Student ability posterior (θ) and Earned Level (EL) |
| **Session Assembly Engine** | Composes problem sets by selecting items from the calibrated pool to match a target difficulty distribution based on student θ | Ordered problem manifest with target difficulty metadata |
| **Progress Display Service** | Translates ability estimates and trajectories into student-facing Earned Level display with historical trend | EL score, trajectory chart, contextual messaging |

### 4.2 Data Flow

1. The Session Assembly Engine requests a problem set for Student S on Skill K at the student's current ability estimate θ.
2. It queries the Item Calibration Service for all available problem-types for Skill K with their calibrated difficulty parameters β.
3. It assembles a set of N problems by sampling from the pool, weighted toward items where β is near or slightly above θ (the zone of desirable difficulty).
4. The manifest is sent to the Lumina frontend with difficulty metadata and the student's current EL.
5. After the session, responses flow back: the Item Calibration Service updates β for each encountered problem-type, and the Student Ability Estimator updates θ.
6. The Progress Display Service renders the updated EL and trajectory.

---

## 5. Item Calibration Service

### 5.1 IRT Model Selection

The system uses a 1-Parameter Logistic (1PL / Rasch) model for item calibration. The probability that student i with ability θᵢ answers item j with difficulty βⱼ correctly is:

```
P(correct) = 1 / (1 + exp(-(θᵢ - βⱼ)))
```

The 1PL model is chosen over 2PL/3PL for several reasons: it requires fewer observations to converge (critical for cold-start), difficulty is the single calibrated parameter per item which simplifies the data pipeline, and the K–5 context has less need for discrimination and guessing parameters than high-stakes professional exams.

### 5.2 Credibility-Weighted Calibration

Each problem-type maintains a difficulty estimate that blends a structural prior with empirical observations using actuarial credibility weighting.

```
βⱼ = Zⱼ · βⱼ(empirical) + (1 - Zⱼ) · βⱼ(prior)
```

The credibility factor Z is computed using a limited fluctuation approach as `Z = min(1, sqrt(n / k))`, where n is the number of student responses observed for the item and k is the full-credibility threshold. A reasonable initial value for k is 200 observations, meaning an item reaches full credibility (Z = 1.0, purely empirical difficulty) after 200 student attempts.

### 5.3 Prior Difficulty Assignment

New items that have never been attempted receive a prior difficulty based on their structural features. The prior assignment table maps mode and structural characteristics to an initial β estimate.

| Mode | Description | Scaffolding | Prior β | Rationale |
|------|-------------|-------------|---------|-----------|
| 1 | Concrete manipulatives with full guidance | Full visual + haptic | 1.5 | Lowest cognitive load; most support |
| 2 | Pictorial representation with prompts | Visual with prompts | 2.5 | One layer of abstraction removed |
| 3 | Pictorial, reduced prompts | Visual, minimal prompts | 3.5 | Student must self-organize approach |
| 4 | Transitional: mixed symbolic/pictorial | Partial scaffolding | 5.0 | Bridge between concrete and abstract |
| 5 | Fully symbolic, single operation | None | 6.5 | Abstract reasoning required |
| 6 | Symbolic, multi-step or cross-concept | None | 8.0 | Highest integration demand |

Within-mode adjustments to the prior can account for additional structural features: number range (single-digit vs. multi-digit: +0.5–1.0), operation type (addition vs. subtraction vs. mixed: +0.5), distractor quality (no distractors vs. plausible near-miss: +0.5), and time constraint (untimed vs. timed: +0.5).

### 5.4 Calibration Update Cycle

**Implemented (Phase 1):** Item difficulty parameters update inline on every submission — not in a nightly batch. Each submission triggers `CalibrationEngine.process_submission()` which updates β incrementally using credibility-weighted IRT. This is the same hook pattern used by `MasteryLifecycleEngine.process_eval_result()`.

The nightly batch approach is deferred to Phase 5 when cross-student pooling requires aggregation across the full observation corpus.

---

## 6. Student Ability Estimator

### 6.1 Bayesian Ability Estimation

Each student maintains a per-skill ability estimate θ that updates after every assessment session. The system uses Expected A Posteriori (EAP) estimation, which integrates over the full posterior distribution rather than relying on point estimates. This produces more stable estimates, especially with small sample sizes typical of early sessions.

The prior for a new student on a new skill is set at θ = 3.0 (roughly Mode 2–3 level), reflecting an assumption that the student is encountering the skill for the first time. If diagnostic placement data exists from the Placement Engine, that estimate is used as the prior instead.

### 6.2 Update Mechanics

After a session of N problems, the ability estimate updates as follows. For each item j answered, compute the likelihood P(response | θ, βⱼ) from the 1PL model. Multiply the likelihoods across all items to get the session likelihood. Multiply by the prior distribution to get the unnormalized posterior. Compute the EAP estimate as the mean of the posterior distribution.

In practice, a grid approximation over θ from 0 to 10 in increments of 0.1 is computationally cheap and sufficient for this application. The posterior from each session becomes the prior for the next session, creating a natural Bayesian updating chain.

### 6.3 Earned Level (EL) Computation

The Earned Level is a student-facing transformation of θ designed for interpretability and motivation. The mapping is:

```
EL = round(θ, 1)
```

The EL is displayed to one decimal place (e.g., 5.3) and ranges from 0.0 to 10.0. The direct mapping to θ ensures the EL is not cosmetic — it is the actual statistical estimate of the student's latent ability, which gives it the credibility that makes the ADAPT experience so compelling.

The system also maintains and displays the EL trajectory: the sequence of EL values after each session, visualized as a line chart showing growth over time. This is the core motivational artifact — the student sees 2.1 → 3.4 → 4.2 → 5.1 and understands viscerally that they are improving.

### 6.4 Contextual Messaging

The Progress Display Service pairs the EL with contextual messages calibrated to the student's trajectory phase. These messages reframe low scores as expected and celebrate growth.

| Phase | Condition | Message Pattern |
|-------|-----------|-----------------|
| First Assessment | Session 1 for this skill | "You're starting at Level [EL]. This is your baseline — let's see how fast you can climb!" |
| Early Growth | EL increased >0.5 since last session | "You jumped from [prev] to [current]! That's real progress." |
| Steady Climb | EL increased 0.1–0.5 | "You moved from [prev] to [current]. Consistent work is paying off." |
| Plateau | EL unchanged across 3+ sessions | "You're holding steady at [EL]. Let's try a focused practice set to break through." |
| Near Target | EL within 1.0 of skill mastery threshold | "You're at [EL] — mastery is at [threshold]. Almost there." |
| Mastery Achieved | EL >= mastery threshold | "You've reached Level [EL]! You've demonstrated mastery of [skill]." |

---

## 6.5 Relationship to Mastery Lifecycle (4-Gate Model)

### 6.5.1 The Dual-System Problem

Lumina already tracks student ability through the 4-gate mastery lifecycle: Gate 0 (not started) → Gate 1 (initial mastery via 3 lesson evals ≥ 9.0) → Gate 2 (+3d retest) → Gate 3 (+7d retest) → Gate 4 (closed/mastered). The Earned Level (EL) from this PRD introduces a second, parallel ability signal — a continuous Bayesian estimate (θ) vs. a discrete gate state machine. These must coexist without conflicting.

### 6.5.2 Phase 1: Parallel Systems (Option B)

**For Phase 1, EL operates as a parallel, student-facing motivational signal. The mastery lifecycle remains the system-of-record for planning and gate progression. The planning service reads gates, not θ.**

This means:
- The `PlanningService` continues to read `mastery_lifecycle` docs from Firestore unchanged. No modifications to weekly pacing, daily session queues, or monthly projections.
- The `MasteryLifecycleEngine` continues to process gate transitions based on lesson eval counts and practice scores. EL does not influence gate decisions.
- θ and EL are computed and stored in a separate `students/{id}/ability/{skill_id}` subcollection. The planning service does not read this subcollection.
- The frontend displays EL as a motivational trajectory alongside the existing gate-based progress indicators. Students see both "Gate 2 — Practice" (what to do next) and "EL 4.2" (how strong they are).

**Rationale:** The mastery lifecycle is battle-tested and tightly coupled to the planner. Introducing θ as a gate input before the IRT model is validated with real data risks destabilizing the entire planning pipeline. Keeping EL parallel lets us validate the model's accuracy (do θ estimates correlate with gate progression speed?) before trusting it for planning decisions.

### 6.5.3 Future Migration: EL Feeds Gate Decisions (Option A)

Once the IRT model has been validated (Phase 3+, after sufficient calibration data), migrate gate transition criteria to incorporate θ:

- **Gate 0 → 1:** Replace "3 lesson evals ≥ 9.0" with "θ ≥ skill mastery threshold AND at least 1 lesson session completed." This allows a student who demonstrates high ability in practice to advance faster while still requiring at least one teaching interaction.
- **Gate 1 → 2/3/4:** Replace fixed retest intervals with adaptive intervals based on the gap between θ and the gate threshold. A student with θ well above threshold gets shorter retest intervals; a student barely above gets standard intervals.
- **Planning input:** The session assembly engine's θ estimate becomes an input to the daily planner, allowing it to select lesson groups at the appropriate difficulty frontier rather than always starting at Mode 1.

This migration is explicitly **not in scope for Phase 1**. It will be designed as a separate PRD addendum once Phase 2 EL trajectory data demonstrates the model's predictive validity.

### 6.5.4 Per-Primitive Gate Thresholds (θ-Based)

When θ eventually feeds gate decisions (Option A), gates must be defined per-primitive based on the primitive's difficulty range. Each primitive has a beta range (minBeta to maxBeta) determined by its available evaluation modes. The gate thresholds define what θ values constitute emerging, developing, proficient, and mastered for that specific primitive.

#### Gate Threshold Formula

Gates are placed proportionally across a **spread** from `minBeta` (starting θ) to `minBeta + spread`:

```
MIN_GATE_SPREAD = 2.5  (minimum θ units from start to Gate 4)

rawSpread = maxBeta + 1.0 - minBeta
spread    = max(MIN_GATE_SPREAD, rawSpread)

G1 = minBeta + spread × 0.20   (20% — emerging)
G2 = minBeta + spread × 0.45   (45% — developing)
G3 = minBeta + spread × 0.75   (75% — proficient)
G4 = minBeta + spread × 1.00   (100% — mastered)
```

Starting θ = minBeta for each primitive, ensuring no gates are pre-passed.

#### Design Rationale

The `MIN_GATE_SPREAD` floor solves two problems discovered during calibration simulator tuning:

1. **Non-monotonic gates.** Without a minimum, single-mode primitives (where minBeta = maxBeta) produce collapsed or inverted gate thresholds (e.g., G3 < G1).

2. **Instant mastery on easy primitives.** The Bayesian EAP update starts with σ=2.0 (high uncertainty), producing large θ jumps on early observations. Without a spread floor, easy primitives with narrow beta ranges (Sorting Station: spread=1.0, Counting Board: spread=2.5) could be fully mastered in 2-3 correct answers — too few observations for statistical confidence.

The value 2.5 was chosen so that Gate 4 for high-beta single-mode primitives (Area Model, β=5.0) lands at θ=7.5 rather than θ=8.0. At θ=7.5 with item β=5.0, the expected correct rate is ~92% (via 1PL: P = 1/(1+exp(-(7.5-5.0)))). This represents confident mastery without requiring near-perfection.

#### Per-Primitive Gate Table

| Primitive | β Range | Spread | G1 | G2 | G3 | G4 | Est. Correct to G4 |
|-----------|---------|--------|----|----|----|----|--------------------|
| Sorting Station | 1.5 | 2.5 (clamped) | 2.0 | 2.63 | 3.38 | 4.0 | ~6-8 |
| Counting Board | 1.0–2.5 | 2.5 | 1.5 | 2.13 | 2.88 | 3.5 | ~5-7 |
| True/False | 2.0 | 2.5 (clamped) | 2.5 | 3.13 | 3.88 | 4.5 | ~6-8 |
| Number Line | 1.5–3.5 | 3.0 | 2.1 | 2.85 | 3.75 | 4.5 | ~7-9 |
| Knowledge Check | 3.0 | 2.5 (clamped) | 3.5 | 4.13 | 4.88 | 5.5 | ~8-10 |
| Pattern Builder | 2.5–4.0 | 2.5 | 3.0 | 3.63 | 4.38 | 5.0 | ~7-9 |
| Function Machine | 2.5–4.5 | 3.0 | 3.1 | 3.85 | 4.75 | 5.5 | ~8-10 |
| Math Fact Fluency | 4.0 | 2.5 (clamped) | 4.5 | 5.13 | 5.88 | 6.5 | ~10-12 |
| Ten Frame | 1.5–5.0 | 4.5 | 2.4 | 3.53 | 4.88 | 6.0 | ~10-14 |
| Area Model | 5.0 | 2.5 (clamped) | 5.5 | 6.13 | 6.88 | 7.5 | ~15-20 |
| Strategy Picker | 5.0 | 2.5 (clamped) | 5.5 | 6.13 | 6.88 | 7.5 | ~15-20 |

#### IRT Ceiling Effect

The proportional gate formula works in concert with a natural IRT property: when θ is well above item β, correct answers provide minimal information (the outcome was expected). This creates a natural ceiling — grinding easy modes alone cannot reach high gates. For example, a student answering only Counting Board "count" mode (β=1.0) will see θ plateau around 2.5-3.0, well short of G4=3.5. They must succeed at harder modes (compare, count_on at β=2.5) to keep climbing.

This ceiling effect is pedagogically correct: demonstrating mastery requires proving competence across the full difficulty range of a primitive, not just acing the easiest challenges repeatedly.

#### Relationship to Pulse Session Assembly

The per-primitive beta ranges that determine these gate thresholds are the *same* beta values the Pulse engine uses for session assembly (§3.1 θ→Mode Mapping in Lumina_PRD_Pulse.md). A student with low θ receives sessions biased toward easy primitives (Counting Board, Sorting Station) because those primitives' modes have low β. A student with high θ receives harder primitives (Ten Frame operate mode, Area Model). The gate thresholds don't change session assembly — they only define what θ level constitutes mastery *within* each primitive.

#### Calibration Simulator

The `CalibrationSimulator.tsx` component implements this formula and provides interactive visualization for tuning. It includes preset scenarios (full mastery, grinding stalls, struggle + recovery) and an SVG trajectory chart showing θ, σ, and gate thresholds per primitive.

---

## 7. Session Assembly Engine

### 7.1 Assembly Strategy

The Session Assembly Engine composes each assessment session by drawing problems from the calibrated item pool. The key principle is that session difficulty is controlled by the distribution of item difficulties in the assembled set, not by modifying individual items.

Given a student with ability estimate θ, the engine targets a session where approximately 60–70% of items have β near θ (within ±1.0), 20–25% of items have β above θ+1.0 (stretch items), and 10–15% of items have β below θ-1.0 (confidence builders). This distribution ensures the session is appropriately challenging while including enough achievable items to prevent frustration.

### 7.2 Mode-to-Difficulty Mapping

The assembly engine uses the calibrated β values of available problem-types to select items. Because modes correlate strongly with difficulty, the practical effect is that higher-θ students see sessions dominated by Modes 5–6 while lower-θ students see sessions anchored in Modes 1–3. But the mapping is empirical, not hardcoded — if a particular Mode 4 item has converged to β = 7.0 (because students consistently struggle with it), the assembly engine treats it as a high-difficulty item regardless of its mode label.

### 7.3 Session Size and Composition

| Parameter | Default | Range | Notes |
|-----------|---------|-------|-------|
| Session Size | 15 problems | 10–20 | Adjustable per skill/age |
| Target Difficulty | θ + 0.5 | θ to θ + 1.5 | Slightly above ability for desirable difficulty |
| Core Band (β ≈ θ) | 65% | 55–75% | Items near student ability |
| Stretch Band (β > θ+1) | 20% | 15–30% | Challenge items for growth signal |
| Confidence Band (β < θ-1) | 15% | 10–20% | Reinforcement and frustration buffer |

### 7.4 Manifest Integration

The assembled session is delivered to the Lumina frontend via the existing manifest format. The manifest is extended with difficulty metadata seeded from the backend:

```json
{
  "session_id": "sess_abc123",
  "skill_id": "K.OA.A.1",
  "student_theta": 4.2,
  "session_target_difficulty": 4.7,
  "earned_level": 4.2,
  "items": [
    { "item_id": "...", "mode": 4, "beta": 4.8, "band": "core" },
    { "item_id": "...", "mode": 5, "beta": 5.9, "band": "stretch" },
    { "item_id": "...", "mode": 2, "beta": 2.8, "band": "confidence" }
  ]
}
```

The frontend receives fully assembled sessions and renders them without needing to understand the difficulty engine's internals. Difficulty intelligence is entirely server-side.

---

## 8. Student-Facing Difficulty Slider

### 8.1 Purpose and Design

The difficulty slider is an optional student-facing control that allows students (or parents/educators) to manually adjust the target difficulty of a session. It serves two purposes: giving the student agency over their challenge level (mirroring ADAPT's slider), and enabling deliberate "reach" sessions where the student attempts problems above their current EL to accelerate growth.

### 8.2 Slider Mechanics

The slider ranges from 1.0 to 10.0 and defaults to the system-recommended target (θ + 0.5). When the student adjusts the slider, the Session Assembly Engine re-composes the session around the new target difficulty. The EL update after a slider-adjusted session uses the actual item difficulties encountered, not the slider setting, so the Bayesian estimation remains statistically valid regardless of slider position.

If a student sets the slider to difficulty 8.0 but their θ is 4.0, the system should display a contextual message such as: "This is a challenge session! Your current level is 4.0. A lower score is expected at this difficulty — use it to learn where to focus." This prevents the demoralizing 7/30 experience without patronizing the student.

### 8.3 Guardrails

For younger students (K–2), the slider may be hidden by default and accessible only through parent/educator settings. The system enforces a floor of θ - 2.0 (sessions that are too easy provide no signal) and a ceiling of θ + 4.0 (sessions that are too hard produce only noise and frustration). Within those bounds, the student has full control.

---

## 9. Data Flywheel and Network Effects

The system creates a self-reinforcing data flywheel. Every student attempt updates item difficulty estimates, improving the accuracy of item β parameters. Better item calibration improves session assembly, producing sessions that are more precisely targeted to the student's zone of proximal development. Better-targeted sessions produce more informative student responses (because items near θ carry the most information in IRT), which in turn produce better ability estimates and better item calibration.

This means the system gets measurably better with usage. A Lumina instance with 1,000 student-hours of data will produce materially better adaptive sessions than one with 100 hours, entirely through the empirical calibration of item difficulty — no curriculum design changes required.

The credibility-adjusted experience system ensures this flywheel is grounded: items that are consistently missed by high-ability students will see their β climb, and items that high-ability students find easy will see their β drop, all weighted by the statistical credibility of the evidence.

---

## 10. Continuous Leapfrog: Ongoing Skip-Ahead via Stretch Performance

### 10.1 The Sequential Curriculum Problem

Lumina's current mastery gate model requires sequential progression: a student must complete lessons, pass practice retests at prescribed intervals, and clear each gate before the planner schedules dependent skills. This is correct for a student who is behind — every skill needs to be taught and verified. But for a student who is ahead, or who is rapidly developing ability beyond the current curriculum position, the gate model creates a ceiling: **the student cannot demonstrate competence on future skills because the planner never serves them.**

The Diagnostic Placement Engine (see `Lumina_PRD_Diagnostic_Placement.md`) solves this at onboarding — it probes the prerequisite graph, infers mastery, and seeds the knowledge frontier. But diagnostic placement is a one-time event. After placement, the student returns to sequential gate progression and the ceiling re-emerges.

**The difficulty calibration system solves this continuously.** The stretch band in every assembled session is the ongoing mechanism for a student to prove they can handle content beyond their current gate position. If they succeed, the system should recognize that and accelerate their progression.

### 10.2 Design: Stretch Items as Implicit Probes

Every session assembled by the Session Assembly Engine includes a stretch band (20–25% of items, β > θ+1). These stretch items naturally sample from higher modes — Modes 5–6 for a student currently working through Modes 3–4. A student who consistently passes stretch items is demonstrating ability on content they haven't been formally taught through Lumina's lesson pipeline.

**This is the same signal the diagnostic placement engine uses** (passing a harder skill implies mastery of its prerequisites), but captured continuously rather than in a one-time test.

The system treats stretch band performance as implicit probes into future content:

```
Stretch Performance Signal:
  Student θ = 4.2 on skill K.OA.A.1
  Session includes stretch items from Mode 5 (β ≈ 6.5) and Mode 6 (β ≈ 8.0)

  If student passes 2/3 stretch items at β ≈ 6.5:
    → Signal: student has latent ability at ~6.5 on this skill
    → θ update: Bayesian posterior shifts significantly upward
    → Implication: Modes 1–4 content is below this student's ability

  If student passes 1/2 stretch items at β ≈ 8.0:
    → Signal: student can handle the most abstract content
    → Implication: this student may not need the full lesson sequence
```

### 10.3 Leapfrog Trigger: From EL Signal to Gate Acceleration

In Phase 1 (parallel systems), the leapfrog mechanism operates through a **recommendation signal** rather than direct gate manipulation. The calibration engine detects acceleration-eligible students and flags them for the planner:

```
Leapfrog Detection (per student, per skill):

  CONDITION: θ exceeds the β of the student's current gate level by ≥ 2.0
    AND credibility Z ≥ 0.3 (at least ~9 observations backing the estimate)
    AND θ increased ≥ 1.0 over the last 3 sessions (upward trajectory)

  SIGNAL: Write a leapfrog_eligible flag to the student's ability doc:
    students/{student_id}/ability/{skill_id}: {
      ...
      leapfrog_eligible: true,
      leapfrog_target_gate: 2,  // suggested gate to skip to
      evidence: {
        current_theta: 6.5,
        current_gate: 0,
        gate_0_beta_ceiling: 3.5,  // highest β in Mode 1-2 content
        stretch_pass_rate: 0.72,
        sessions_analyzed: 5,
        credibility: 0.45
      }
    }
```

In Phase 1 this flag is informational — surfaced to parents/educators as "Your child is showing strong ability beyond the current lesson level. Consider advancing to practice mode." The educator can manually advance the gate.

In the future Option A migration (§6.5.3), the leapfrog trigger directly advances the gate:

```
Leapfrog Execution (Option A, future):

  IF leapfrog_eligible AND θ ≥ gate_beta_ceiling + 2.0:
    → Advance gate: skip GATE_1_LESSON → GATE_2_PRACTICE
    → Schedule verification practice (same as diagnostic inferred_mastered)
    → If verification passes → continue gate progression normally
    → If verification fails → revert to GATE_1_LESSON

  IF leapfrog_eligible AND θ ≥ skill_mastery_threshold:
    → Advance gate: skip directly to GATE_3_RETEST or GATE_4_CLOSED
    → Apply same conservative bias as diagnostic placement:
      direct evidence (stretch performance) → skip to practice
      inferred evidence (θ estimate) → verification required
```

### 10.4 Cross-Skill Leapfrog via Prerequisite Inference

The most powerful application extends the diagnostic placement engine's inference logic to the continuous case. If a student demonstrates high θ on a downstream skill, the system can infer competence on prerequisite skills — the same upward inference the diagnostic uses, but triggered by ongoing performance rather than a placement test.

```
Cross-Skill Inference (continuous):

  Student demonstrates θ = 7.0 on "Model addition within 10 using drawings"
  Prerequisite: "Count objects up to 10" (currently at Gate 1)

  Inference: If the student can do addition-with-drawings at a high level,
    they can count objects to 10. The prerequisite is implicitly mastered.

  Action: Flag "Count objects up to 10" as leapfrog_eligible with
    source: "cross_skill_inference"
    evidence_skill: "Model addition within 10 using drawings"
    confidence: "medium" (inference, not direct observation)
```

This reuses the DAG traversal algorithms already built in `dag_analysis.py` for diagnostic placement. The difference is the trigger: diagnostic runs on explicit probe results; continuous leapfrog runs on θ updates from the calibration engine.

### 10.5 Complementary Relationship with Diagnostic Placement

| Mechanism | Diagnostic Placement | Continuous Leapfrog |
|-----------|---------------------|---------------------|
| **When** | Onboarding (one-time) | Every session (ongoing) |
| **Signal source** | Explicit probes (3-5 items per skill) | Stretch band performance in regular sessions |
| **Inference method** | DAG binary search + upward/downward propagation | θ exceeds gate ceiling + prerequisite inference |
| **Gate effect** | Bulk seeding (Gate 0/2/4 per skill) | Individual gate advancement recommendations |
| **Confidence** | High (dedicated assessment) | Medium (incidental signal from practice) |
| **Conservative bias** | Inferred mastery → Gate 2 (verify) | Leapfrog → verification practice required |

Together, they solve the full skip-ahead problem: diagnostic placement sets the initial frontier accurately, and continuous leapfrog keeps expanding it as the student demonstrates ability beyond their current position. A student who is accelerating never hits a ceiling — the system continuously detects and responds to their growth.

### 10.6 Product Impact

For the target use case — a student who is ahead or rapidly improving — this transforms the Lumina experience:

```
WITHOUT leapfrog:
  Student knows addition but hasn't done Lumina's Mode 1-4 lessons
  → Planner serves Mode 1 lesson (concrete manipulatives)
  → Student breezes through, bored
  → Must complete 3 lesson evals ≥ 9.0 to reach Gate 1
  → Then wait 3 days for retest → Gate 2
  → Then wait 7 days for retest → Gate 3
  → Minimum time to closure: ~2-3 weeks even for trivially easy content

WITH leapfrog:
  Student's first session includes stretch items from Modes 5-6
  → Student passes most stretch items → θ jumps to 6.5
  → Leapfrog trigger fires: θ (6.5) >> Gate 0 ceiling (3.5)
  → System recommends: skip to practice verification
  → Student passes verification → Gate 2 or higher
  → Minimum time to closure: 2-3 sessions (days, not weeks)
```

The time savings compound: for a student who is ahead on 50 skills, the gate model requires ~100–150 wasted sessions. Continuous leapfrog compresses that to ~10–15 verification sessions.

---

## 11. Phase 1 Implementation Status

Phase 1 (Foundation) is **complete**. The following components have been built and verified.

### 11.1 What Was Built

| Component | File(s) | Description |
|-----------|---------|-------------|
| **Problem-Type Registry** | `backend/app/services/calibration/problem_type_registry.py` | Static dict mapping `(primitive_type, eval_mode)` → prior β. Covers all 50+ primitive/mode combinations across math, assessment, literacy, engineering, and science. Fallback chain: exact mode → `"default"` mode → global default (3.0). |
| **Calibration Models** | `backend/app/models/calibration.py` | Pydantic models: `ItemCalibration` (top-level, shared), `StudentAbility` (per-student per-skill), `ThetaHistoryEntry`. Constants: `IRT_CORRECT_THRESHOLD=9.0`, `ITEM_CREDIBILITY_STANDARD=200`, `DEFAULT_STUDENT_THETA=3.0`, `DEFAULT_THETA_SIGMA=2.0`. |
| **Calibration Engine** | `backend/app/services/calibration_engine.py` | Main service. `process_submission()` entry point. `_update_item_beta()` implements credibility-weighted 1PL MLE (§5.2). `_update_student_theta()` implements grid-approximation EAP over 101 points from θ=0.0 to 10.0 (§6.2). Earned Level = `round(θ, 1)`. |
| **Firestore Schema** | `backend/app/db/firestore_service.py` (modified) | 6 new CRUD methods. Top-level collection: `item_calibration/{primitive_type}_{eval_mode}`. Student subcollection: `students/{id}/ability/{skill_id}`. Pattern matches `mastery_lifecycle` subcollection. |
| **Singleton Registration** | `backend/app/dependencies.py` (modified) | `CalibrationEngine` registered as singleton, injected into `CompetencyService` — same pattern as `MasteryLifecycleEngine`. |
| **Pipeline Hook** | `backend/app/services/competency.py` (modified) | Calibration hook fires after mastery lifecycle hook in `update_competency_from_problem()`. Gated on `primitive_type` (only Lumina primitives trigger calibration). Non-fatal: exceptions are logged but don't block the submission pipeline. Skips diagnostic submissions. |
| **Submission Threading** | `backend/app/services/submission_service.py` (modified) | `primitive_type` and `eval_mode` extracted in `_handle_lumina_primitive()` and threaded through `_update_competency()` to `CompetencyService`. Non-Lumina call sites don't pass `primitive_type`, so calibration hook naturally skips them. |
| **Frontend: evalMode** | `evaluation/types.ts`, `evaluation/api/evaluationApi.ts`, all 9 math primitives (modified) | `evalMode` added to `BasePrimitiveMetrics` interface. Multi-phase primitives set `evalMode` dynamically (e.g., TenFrame: `challenges[0]?.type`, FunctionMachine: `phase`). Single-mode primitives set `evalMode: 'default'`. `eval_mode` included in `primitive_response` sent to backend. |

### 11.2 Data Flow (As Built)

```
Frontend                          Backend
────────                          ───────
Student completes primitive
  ↓
PrimitiveComponent sets evalMode
in metrics (e.g., "subitize")
  ↓
evaluationApi builds
primitive_response with
eval_mode field
  ↓
POST /api/problems/submit ──────→ SubmissionService._handle_lumina_primitive()
                                    extracts primitive_type + eval_mode
                                      ↓
                                  SubmissionService._update_competency()
                                    passes primitive_type, eval_mode
                                      ↓
                                  CompetencyService.update_competency_from_problem()
                                    ↓ (Hook 1: existing)
                                  MasteryLifecycleEngine.process_eval_result()
                                    ↓ (Hook 2: NEW)
                                  CalibrationEngine.process_submission()
                                    ├─ _update_item_beta()    → Firestore: item_calibration/
                                    └─ _update_student_theta() → Firestore: students/{id}/ability/
```

### 11.3 Firestore Schema (As Built)

```
# Top-level (shared across all students)
item_calibration/
  ten-frame_subitize:
    primitive_type: "ten-frame"
    eval_mode: "subitize"
    prior_beta: 2.5
    empirical_beta: 2.8
    calibrated_beta: 2.52    # Z-weighted blend
    total_observations: 3
    total_correct: 2
    sum_respondent_theta: 9.6
    credibility_z: 0.122     # sqrt(3/200)
    created_at: ...
    updated_at: ...

# Per-student, per-skill
students/{student_id}/
  ability/
    {skill_id}:
      skill_id: "K.OA.A.1"
      student_id: 42
      theta: 3.24
      sigma: 1.85
      earned_level: 3.2
      total_items_seen: 5
      prior_source: "default"
      theta_history:
        - { theta: 3.1, earned_level: 3.1, timestamp: ..., primitive_type: "ten-frame", eval_mode: "subitize", score: 9.5 }
        - ...
      created_at: ...
      updated_at: ...
```

### 11.4 What Is NOT Built Yet

- **EL display** — θ/EL values are stored but not surfaced in the student dashboard UI
- **Session Assembly Engine** — sessions are not yet composed using calibrated β values
- **Leapfrog detection** — no `leapfrog_eligible` flag logic yet
- **Progress Display Service** — no contextual messaging or EL trajectory chart
- **Difficulty slider** — deferred to Phase 5
- **Cross-student pooling** — each student's submissions update the shared `item_calibration/` docs, but no batch aggregation or outlier detection
- **Diagnostic placement integration** — diagnostic θ is not yet used as the prior for `StudentAbility` (currently defaults to θ=3.0)

---

## 12. Implementation Roadmap (v1.2)

| Phase | Milestone | Deliverables | Status |
|-------|-----------|-------------|--------|
| Phase 1 | Foundation | Problem-type registry (50+ primitives), calibration models, CalibrationEngine with inline 1PL IRT β/θ updates, Firestore schema, submission pipeline hook, frontend evalMode threading. EL stored but not displayed. | **COMPLETE** |
| Phase 2 | Display & Diagnostic Integration | EL trajectory chart in student dashboard. Progress Display Service with contextual messaging (§6.4). Seed StudentAbility prior from diagnostic placement θ instead of default 3.0. Admin view of item calibration convergence. Per-primitive gate threshold formula with proportional placement and MIN_GATE_SPREAD floor (§6.5.4). CalibrationSimulator.tsx for interactive tuning. | **COMPLETE** |
| Phase 3 | Assembly & Leapfrog | Session Assembly Engine: compose sessions using calibrated β values with core/stretch/confidence bands (§7). Leapfrog detection: flag `leapfrog_eligible` when θ >> gate ceiling (§10.3). Parent-facing leapfrog recommendations. | Planned |
| Phase 4 | Calibration Maturity | Cross-skill leapfrog via prerequisite inference using `dag_analysis.py` (§10.4). Monitoring dashboard for β convergence and leapfrog accuracy. Configurable full-credibility threshold per subject. | Planned |
| Phase 5 | Flywheel & Migration | Option A migration: EL feeds gate decisions (§6.5.3). Cross-student item calibration (pooled batch aggregation). Difficulty slider (§8). A/B testing framework for assembly strategies. | Planned |

### Phase 2 — Recommended Next Steps (in priority order)

1. **EL trajectory in dashboard.** Read `students/{id}/ability/` subcollection, render `theta_history[]` as a line chart per skill. This is the core motivational artifact — making the stored data visible.

2. **Contextual messaging.** Implement the messaging table from §6.4 (first assessment, early growth, plateau, near target, mastery achieved). Display alongside the EL trajectory chart.

3. **Diagnostic placement integration.** When the Diagnostic Placement Engine produces a θ estimate for a skill, write it as the `theta` and `prior_source: "diagnostic"` on the StudentAbility doc. This replaces the default θ=3.0 prior with a data-driven starting point.

4. **Admin calibration view.** Surface `item_calibration/` collection in an admin panel: show β convergence per primitive/mode, observation counts, credibility Z. Helps validate that priors are reasonable and empirical estimates are converging.

5. **Non-math primitive evalMode.** The registry covers literacy, engineering, and science primitives, but those frontend components don't yet set `evalMode` in their metrics. Add as those primitives are built or updated.

---

## 13. Success Metrics

**Item Calibration Convergence:** 80% of items with >200 observations have β stable within ±0.3 across consecutive recalculations.

**EL Trajectory Visibility:** 90% of students who complete 5+ sessions on a skill show a non-trivial EL increase (≥0.5).

**Session Targeting Accuracy:** Mean student accuracy per session falls within 55–75% (the IRT-optimal range for information gain).

**Frustration Signal:** Session abandonment rate below 10% across all difficulty levels.

**Flywheel Effect:** Session targeting accuracy improves measurably (>5% reduction in variance) after the first 1,000 student-hours of data.

**Leapfrog Accuracy:** Of students flagged as leapfrog-eligible and advanced past lessons, ≥80% pass verification practice on first attempt (confirming the θ estimate was correct).

**Skip-Ahead Compression:** Students who are ahead on ≥20 skills reach closure on those skills in ≤25% of the time required by sequential gate progression (target: days instead of weeks per skill).

---

## 14. Dependencies and Assumptions

This system depends on the existing Lumina mode taxonomy (Modes 1–6) remaining stable as the problem-type foundation. It assumes the daily planning service can accept a session manifest from the assembly engine and pass it through to the frontend. It requires Firestore schema extensions for item β, student θ, and session history.

The system assumes a minimum viable data volume: meaningful item calibration requires approximately 50–100 observations per item before the credibility weight begins to dominate the prior. For a single-family homeschool deployment, this means full empirical calibration may take weeks to months per item; cross-student pooling (Phase 5) significantly accelerates this for multi-user deployments.

The continuous leapfrog mechanism (§10) depends on the Diagnostic Placement Engine's DAG analysis infrastructure (`dag_analysis.py`) for cross-skill prerequisite inference. The leapfrog trigger depends on the ability estimator (§6) producing reliable θ estimates, which requires Phase 2 to be complete before Phase 3 leapfrog detection can be trusted.

---

## 15. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Slow calibration convergence in single-student deployment | Item β values remain prior-dominated for extended periods | Conservative priors based on mode structure; priors are designed to be directionally correct even without data |
| Student frustration from early low EL | Disengagement before the trajectory becomes visible | Contextual messaging that normalizes early scores; confidence band items in every session |
| Mode taxonomy changes invalidate calibrated β values | Recalibration needed across affected items | Decouple β from mode label; β is per problem-type, not per mode |
| Gemini-generated items have high variance in effective difficulty within a mode | Calibrated β for a problem-type may not generalize to all Gemini outputs | Seed calibration at the problem-type level (mode + structural features), not individual generated instances; monitor variance |
| Leapfrog false positives (student advanced past content they actually need) | Student hits a wall on dependent skills; requires backtracking | Conservative bias: leapfrog always requires verification practice before gate advancement. Cross-skill inference flagged as medium confidence, requires direct confirmation |
| EL and gate model produce contradictory signals to students/parents | Confusion: "Why does it say Level 6 but I'm still on Gate 1?" | Phase 1: clear UI separation — EL is "your ability level," gates are "your learning progress." Phase 2+: migrate gates to incorporate EL so signals converge |
