# PRD: Kindergarten Operations & Algebraic Thinking Primitives

**Status:** Draft
**Date:** 2026-02-22
**Scope:** 2 new Lumina primitives + generator enhancements for existing primitives, targeting K-1 OAT standards

---

## 1. Problem Statement

Unlike the geometry domain (where we had zero K-level coverage), Operations & Algebraic Thinking is partially covered by several existing primitives. However, the coverage has two structural gaps:

1. **No fluency/automaticity primitive.** Every existing primitive is designed for conceptual exploration (act out stories, discover decompositions, manipulate counters). The curriculum explicitly requires fluency **within 3 seconds** and **mental strategies** — there is no speed-focused practice mode anywhere in the system. Students with 0-40% mastery on "fluently add and subtract within 5" need rapid-fire fact practice, not another story scene.

2. **No multi-strategy comparison primitive.** The curriculum requires students to "use multiple strategies (ten frames, tally marks, doubles) to solve addition problems within 10." Each existing primitive teaches one strategy in isolation (`ten-frame` → make-ten, `number-line` → jumps, `counting-board` → count-all). No primitive lets students see the same problem solved multiple ways and choose their preferred strategy.

Beyond these two gaps, some subskills have **weak or indirect coverage** — they're theoretically reachable through an existing primitive but the AI generator would need targeted enhancements to actually produce challenges for them. This PRD addresses both the new primitives and the generator improvements.

### Student Data Summary

| Skill | Attempts | Mastery | Priority |
|---|---|---|---|
| Express addition within 5 as equations | 4 | 40.0% | High |
| Solve addition word problems within 10 | 13 | 60.4% | High |
| Decompose for subtraction within 5 | 1 | 9.5% | Medium |
| Create/solve real-world subtraction within 10 | 1 | 9.5% | Medium |
| Solve/create word problems within 5 | 2 | 0.0% | High |

---

## 2. Skill Coverage Map

### What Existing Primitives Already Cover

| Existing Primitive | OAT Skills Covered |
|---|---|
| `addition-subtraction-scene` | Represent add/sub with objects (act-out), model with drawings (story scene), express as equations (build-equation), solve word problems (solve-story), create stories (create-story) |
| `number-bond` | Decompose numbers into pairs, missing-part problems, fact families, inverse operations, build equations from bonds |
| `ten-frame` | Compose/decompose with counters, make-ten strategy, add/subtract within 10 using frame, subitizing |
| `counting-board` | Count objects (1:1 correspondence), count-on strategy, compare groups |
| `number-line` | Add/subtract as jumps, number placement, ordering |
| `number-sequencer` | Count forward/backward within 5-100 |
| `comparison-builder` | Compare quantities, one-more/one-less |

### Coverage Assessment: Understand Addition

| Subskill | Difficulty | Mastery Data | Covered By | Gap? |
|---|---|---|---|---|
| Represent addition within 5 with objects | 1-3 | — | `addition-subtraction-scene` (act-out), `counting-board` | **No gap** |
| Model addition within 5 with drawings/number lines | 2-4 | — | `addition-subtraction-scene`, `number-line` | **No gap** |
| Express addition within 5 as equations | 3-5 | 40.0% (4 att.) | `addition-subtraction-scene` (build-equation) | **Weak** — only in story context, no standalone equation practice |
| Decompose numbers up to 5 into pairs | 4-6 | — | `number-bond` (decompose) | **No gap** |
| Solve addition word problems within 10 | 5-7 | 60.4% (13 att.) | `addition-subtraction-scene` (solve-story) | **No gap** — needs more practice, not a new primitive |
| Use multiple strategies for addition within 10 | 6-8 | — | `ten-frame` (make-ten only) | **GAP** — no multi-strategy comparison |
| Create/solve addition stories with real-world/money | 7-9 | — | `addition-subtraction-scene` (create-story) | **Weak** — no money context in generator |

### Coverage Assessment: Understand Subtraction

| Subskill | Difficulty | Mastery Data | Covered By | Gap? |
|---|---|---|---|---|
| Represent subtraction within 5 with objects | 1-3 | — | `addition-subtraction-scene` (act-out) | **No gap** |
| Decompose within 5, recording decompositions | 2-4 | 9.5% (1 att.) | `number-bond` (decompose) | **No gap** — needs more exposure |
| Solve subtraction word problems within 5 | 3-5 | — | `addition-subtraction-scene` (solve-story) | **No gap** |
| Model subtraction within 10 with ten frames/number lines | 4-6 | — | `ten-frame`, `number-line` | **No gap** |
| Create/solve real-world subtraction within 10 | 5-7 | 9.5% (1 att.) | `addition-subtraction-scene` (create-story) | **Weak** — generator needs variety |
| Find missing numbers in subtraction within 10 | 6-8 | — | `number-bond` (missing-part) | **Weak** — number-bond K limit is 5, need Grade 1 range |
| Connect add/sub as inverse operations within 10 | 7-9 | — | `number-bond` (fact-family) | **Weak** — same range limitation |

### Coverage Assessment: Fluently Add and Subtract Within 5

| Subskill | Difficulty | Mastery Data | Covered By | Gap? |
|---|---|---|---|---|
| Count forward/backward within 5 fluently (3 sec) | 1-3 | — | `number-sequencer` | **Weak** — no timed/fluency mode |
| Add/subtract within 3 with mental strategies | 2-4 | — | None specifically | **GAP** — no rapid fact practice |
| Match visuals to equations within 5 | 3-5 | — | `addition-subtraction-scene` (partial) | **GAP** — no dedicated matching activity |
| Add/subtract fluently within 5 with mental strategies | 4-6 | — | None specifically | **GAP** — no fluency drill |
| Missing number problems within 5 | 5-7 | — | `number-bond` (missing-part) | **No gap** |
| Fact families within 5 | 6-8 | — | `number-bond` (fact-family) | **No gap** |
| Solve/create word problems within 5 | 7-9 | 0.0% (2 att.) | `addition-subtraction-scene` | **No gap** — needs more exposure |

---

## 3. New Primitives

### 3.1 `math-fact-fluency`

**Purpose:** Build rapid recall and automaticity for basic addition and subtraction facts through timed practice, progressive speed targets, and adaptive difficulty — the "flash card" mode that no existing primitive provides.

**Grade Band:** K-1 (Difficulty 1-8)

**Skills Addressed:**
- Count forward and backward within 5 fluently (within 3 seconds)
- Add and subtract fluently within 3 using objects and mental strategies
- Add and subtract fluently within 5 using mental strategies
- Match visual representations to addition and subtraction equations within 5
- Solve missing number problems within 5 (e.g., 3 + __ = 5, 5 - __ = 2)
- Express addition situations within 5 using verbal explanations and written equations

**Interaction Model:**

A rapid-fire challenge system with 5 challenge types that progressively remove visual scaffolding:

| Phase | Challenge Type | Description |
|---|---|---|
| 1 | `visual-fact` | An equation is shown with a visual aid (dot array, finger image, or mini ten-frame) alongside it. Student selects the answer from 3-4 choices. Generous time (8 sec). Bridges from concrete to abstract. |
| 2 | `equation-solve` | A bare equation is shown (3 + 2 = ?). Student taps the answer from choices or types it. No visual aid. Moderate time (5 sec). |
| 3 | `missing-number` | An equation with a blank: 3 + __ = 5, or __ - 2 = 1. Student fills in the missing number. Moderate time (5 sec). |
| 4 | `match` | A visual (dot array, object group, or ten-frame configuration) and 3-4 equations. Student taps the matching equation. Or: an equation and 3-4 visuals. Moderate time (6 sec). |
| 5 | `speed-round` | Rapid-fire bare equations. Student answers as fast as possible. Timer shows elapsed time per fact. No choices — student types/taps the number. Target: under 3 seconds. Streak tracking ("5 in a row!"). |

**Adaptive Difficulty System:**
- Starts with facts the student has attempted but not mastered (from competency data)
- Falls back to easier facts (within 3) if accuracy drops below 60%
- Advances to harder facts (within 10) when accuracy exceeds 90%
- Interleaves add and subtract facts at higher levels
- Tracks per-fact response time — re-queues slow facts even if correct

**Visual Design:**
- Clean, distraction-free layout — big equation in center, answer options below
- Countdown timer arc around the equation (green → yellow → red)
- Streak counter with flame animation ("🔥 5 in a row!")
- Visual aids (phase 1): simple dot arrays in familiar 5-frame layout, or finger images showing the count
- Correct: green flash + satisfying pop sound. Wrong: gentle shake + show correct answer briefly
- Session summary: facts mastered, average speed, streak record, facts to review
- Glass card Lumina theming

**Data Shape (key fields):**
```typescript
interface MathFactFluencyData {
  challenges: Array<{
    type: 'visual-fact' | 'equation-solve' | 'missing-number' | 'match' | 'speed-round';
    instruction: string;
    equation: string;              // "3 + 2 = 5"
    operation: 'addition' | 'subtraction';
    operand1: number;
    operand2: number;
    result: number;
    unknownPosition: 'result' | 'operand1' | 'operand2';
    correctAnswer: number;
    // visual-fact & match
    visualType?: 'dot-array' | 'fingers' | 'ten-frame' | 'objects';
    visualCount?: number;
    // equation-solve & speed-round
    options?: number[];             // multiple choice (null for type-in mode)
    timeLimit?: number;             // seconds
    // match
    matchDirection?: 'visual-to-equation' | 'equation-to-visual';
    equationOptions?: string[];
    visualOptions?: Array<{ type: string; count: number }>;
  }>;
  maxNumber: number;               // 3, 5, or 10
  includeSubtraction: boolean;
  showVisualAids: boolean;
  targetResponseTime: number;       // seconds (goal: 3)
  adaptiveDifficulty: boolean;
  gradeBand: 'K' | '1';
}
```

**AI Tutoring Hooks:**
- Context keys: `challengeType`, `equation`, `operation`, `unknownPosition`, `correctAnswer`, `studentAnswer`, `responseTime`, `attemptNumber`, `streak`, `accuracy`, `averageTime`
- Scaffolding: L1 "Take your time! Look at the numbers. What do you get when you put {{operand1}} and {{operand2}} together?" → L2 "Think: {{operand1}}... then count on {{operand2}} more: {{operand1 + 1}}, {{operand1 + 2}}..." → L3 "{{operand1}} + {{operand2}} = {{result}}. Try to remember this one — you'll see it again!"
- Directive: "This primitive is about building SPEED, not just accuracy. Celebrate fast correct answers enthusiastically: 'Lightning fast! You knew that one by heart!' When a student is slow but correct, affirm and encourage: 'Correct! With more practice, you'll get even faster.' Track which facts are slow and re-queue them. Never punish wrong answers — show the correct answer and move on quickly. For missing-number, encourage 'think backwards' strategy: 'If 3 + __ = 5, think: what do I add to 3 to get to 5?'"

---

### 3.2 `strategy-picker`

**Purpose:** Teach students to solve the same problem using multiple strategies, compare approaches, and develop flexibility — directly addressing the "use multiple strategies" standard that no single-strategy primitive can cover.

**Grade Band:** K-1 (Difficulty 4-9)

**Skills Addressed:**
- Use multiple strategies (ten frames, tally marks, doubles) to solve addition problems within 10
- Model addition within 5 using drawings, pictures, and number lines, connecting to concrete representations
- Model and solve subtraction problems within 10 using ten frames and number lines
- Create and solve real-world addition/subtraction situations within 10 using various representations

**Interaction Model:**

A problem is presented, and the student works through it using 2-3 different strategies in sequence:

| Phase | Challenge Type | Description |
|---|---|---|
| 1 | `guided-strategy` | A problem (e.g., "6 + 3 = ?") is shown. A specific strategy is assigned: "Solve using counting on." Student executes the strategy step-by-step with visual scaffold (animated number line hops, or counting-on finger animation). After solving, the answer locks in. |
| 2 | `try-another` | Same problem, different strategy: "Now solve using a ten frame." Student places counters on a ten frame to find the same answer. The previous strategy's answer is shown dimmed for confirmation. |
| 3 | `compare` | Both strategies are shown side by side. Student answers: "Which strategy was faster for you?" "Did both give the same answer?" Builds metacognitive awareness that strategies are interchangeable. |
| 4 | `choose-your-strategy` | A new problem is shown. Student picks their preferred strategy from a menu, then solves. Tracks which strategies students gravitate toward. |
| 5 | `match-strategy` | A problem and a partially-worked solution are shown. Student identifies which strategy is being used: "Is this counting on, make-ten, or doubles?" |

**Available Strategies:**

| Strategy | Visual Scaffold | Best For |
|---|---|---|
| Counting On | Number line with animated hops from first addend | Any addition |
| Counting Back | Number line with backward hops from minuend | Subtraction |
| Make Ten | Ten frame with two-color counters showing decomposition | Adding to 8 or 9 (e.g., 8+5 → 8+2+3) |
| Doubles | Mirror image dot arrays (3+3, 4+4) | Doubles and near-doubles |
| Near Doubles | Doubles array + 1 extra dot (3+4 = 3+3+1) | Near-doubles |
| Tally Marks | Tally mark groups of 5 | Any addition/subtraction |
| Draw Objects | Simple object drawings (circles, stars) | Concrete representation |

**Visual Design:**
- Problem displayed prominently at top ("6 + 3 = ?")
- Strategy workspace below, adapting to the current strategy:
  - **Counting On:** horizontal number line with hop arcs animated in sequence
  - **Make Ten:** ten frame with two-color counters and decomposition arrows
  - **Doubles:** split-screen mirror image dot arrays
  - **Tally Marks:** tally mark area where student draws/taps marks in groups of 5
  - **Draw Objects:** simple canvas with stamp tool for circles/stars
- Strategy menu: icon cards for each strategy (number line icon, ten frame icon, tally marks icon, etc.)
- Compare view: split-screen showing two strategies side by side with the same answer highlighted
- "Same answer!" confirmation badge when both strategies reach the same result
- Glass card Lumina theming

**Data Shape (key fields):**
```typescript
interface StrategyPickerData {
  challenges: Array<{
    type: 'guided-strategy' | 'try-another' | 'compare' | 'choose-your-strategy' | 'match-strategy';
    instruction: string;
    problem: {
      equation: string;            // "6 + 3 = ?"
      operation: 'addition' | 'subtraction';
      operand1: number;
      operand2: number;
      result: number;
    };
    // guided-strategy & try-another
    assignedStrategy?: 'counting-on' | 'counting-back' | 'make-ten' | 'doubles' | 'near-doubles' | 'tally-marks' | 'draw-objects';
    strategySteps?: string[];      // step-by-step scaffold
    // compare
    strategies?: string[];         // the two strategies to compare
    comparisonQuestion?: string;
    // choose-your-strategy
    availableStrategies?: string[];
    // match-strategy
    workedSolution?: string;       // description of a worked solution
    strategyOptions?: string[];
    correctStrategy?: string;
  }>;
  maxNumber: number;               // 5 for K, 10 for grade 1
  operations: ('addition' | 'subtraction')[];
  strategiesIntroduced: string[];  // which strategies are available in this session
  gradeBand: 'K' | '1';
}
```

**AI Tutoring Hooks:**
- Context keys: `challengeType`, `equation`, `assignedStrategy`, `strategySteps`, `studentAnswer`, `attemptNumber`, `chosenStrategy`, `strategiesCompleted`
- Scaffolding: L1 "Let's try this problem a different way! This time, we'll use {{assignedStrategy}}." → L2 "For counting on, start at {{operand1}} and hop forward {{operand2}} times: {{operand1+1}}, {{operand1+2}}..." → L3 "Great! Both strategies gave us {{result}}. It doesn't matter which way you solve it — the answer is always the same!"
- Directive: "The goal is FLEXIBILITY, not preference. Celebrate every strategy attempt: 'You solved it two different ways!' In compare mode, ask 'Which felt easier to you?' — there's no wrong answer. For make-ten, narrate the decomposition: '8 + 5: I need 2 more to make 10, so I split the 5 into 2 and 3. 8 + 2 = 10, then 10 + 3 = 13!' Never say one strategy is 'better' — say 'different problems can use different strategies.'"

---

## 4. Generator Enhancements for Existing Primitives

These skills are already covered by existing primitives but need targeted generator improvements:

### 4.1 `addition-subtraction-scene` Generator Enhancements

| Enhancement | Subskill Addressed | Detail |
|---|---|---|
| **Money context** | Create/solve addition stories with money | Generator should produce challenges with coin themes: "You have 3 pennies. Mom gives you 2 more pennies. How many pennies do you have?" Use coin emojis (🪙) as objects. Scene: `store` or `piggy-bank`. |
| **Equation-first mode** | Express addition within 5 as equations | Generator should produce more `build-equation` challenges at K level, not just as phase 2 after story. Standalone equation practice: show 3 objects + 2 objects, student writes `3 + 2 = 5`. |
| **Unknown position variety** | Find missing numbers in subtraction within 10 | Generator should produce `solve-story` challenges where the unknown is not always the result. E.g., "Some birds were on a branch. 3 flew away. Now there are 4. How many were there before?" (`unknownPosition: 'start'`). |
| **Real-world variety** | Create/solve real-world subtraction within 10 | Generator should rotate through more diverse real-world contexts beyond the 6 current scenes. Add: `store`, `birthday-party`, `classroom`, `bus`. |

### 4.2 `number-bond` Generator Enhancements

| Enhancement | Subskill Addressed | Detail |
|---|---|---|
| **Range extension** | Missing numbers in subtraction within 10 / inverse ops within 10 | For students working above K level, generator should produce `maxNumber: 10` challenges even when grade is K, if the skill targets require it. The component already supports it — the generator just needs to use it. |
| **Recording emphasis** | Decompose within 5, recording each decomposition | Generator should produce `decompose` challenges with explicit recording: "Find ALL the ways to make 5. Write each pair." Track completeness more prominently. |

### 4.3 `ten-frame` Generator Enhancements

| Enhancement | Subskill Addressed | Detail |
|---|---|---|
| **Subtraction mode** | Model subtraction within 10 with ten frames | Generator should produce explicit subtraction challenges: "Start with 7 counters. Take away 3. How many are left?" rather than only addition/compose challenges. |

---

## 5. Priority & Sequencing

### Phase 1 — Core (Build First)

| # | Primitive | Rationale |
|---|---|---|
| 1 | `math-fact-fluency` | The clearest gap — 3 subskills have ZERO coverage, and the "fluently within 3 seconds" standard can't be met by any existing exploratory primitive. Student data shows 0-40% mastery on skills this would target. Fastest to implement (simpler UI than story scenes). |
| 2 | Generator enhancements | Low-effort, high-impact. Money contexts, unknown-position variety, and range extension for existing primitives close several "weak" gaps without building new components. |

### Phase 2 — Extended (Build Next)

| # | Primitive | Rationale |
|---|---|---|
| 3 | `strategy-picker` | Important for the multi-strategy standard, but more complex to build (must render 7 different strategy visualizations). Also depends on students having baseline fact knowledge from `math-fact-fluency` first. |

---

## 6. Integration with Existing Primitives

The new primitives complement (not replace) existing ones. The AI manifest system should select based on the **learning goal**:

| Learning Goal | Choose This | Not This |
|---|---|---|
| "I need to understand what addition means" | `addition-subtraction-scene` | — |
| "I need to understand part-part-whole" | `number-bond` | — |
| "I need to memorize my facts quickly" | `math-fact-fluency` | `addition-subtraction-scene` |
| "I know the answer but I'm slow" | `math-fact-fluency` (speed-round) | `number-bond` |
| "I only know one way to solve this" | `strategy-picker` | `ten-frame` |
| "I need to solve a word problem" | `addition-subtraction-scene` | `math-fact-fluency` |
| "I need to practice missing numbers" | `number-bond` (primary), `math-fact-fluency` (for speed) | — |
| "I need to see 3+2 with objects" | `counting-board` or `addition-subtraction-scene` | `math-fact-fluency` |

### Progression Flow

```
counting-board (count objects, 1:1 correspondence)
    ↓
addition-subtraction-scene (understand what add/sub means with stories)
    ↓
number-bond (decompose numbers, part-part-whole)
    ↓
math-fact-fluency [NEW] (build speed and automaticity)
    ↓
strategy-picker [NEW] (learn multiple solution strategies)
    ↓
ten-frame (make-ten strategy for within-10 fluency)
```

### Key Distinction: Understanding vs. Fluency

The existing primitives teach **understanding** (why does 3+2=5?). The new `math-fact-fluency` builds **automaticity** (I just know 3+2=5 without counting). The `strategy-picker` builds **flexibility** (I can solve 8+5 three different ways). All three are necessary for full OAT mastery.

---

## 7. Cross-Primitive Skill Progressions

### Addition Mastery Flow
```
counting-board (count objects → "I have 3 and 2, that's 5")
    ↓
addition-subtraction-scene (act-out → "3 frogs + 2 frogs = 5 frogs")
    ↓
addition-subtraction-scene (build-equation → "3 + 2 = 5")
    ↓
number-bond (decompose → "5 = 3 + 2 = 4 + 1 = ...")
    ↓
math-fact-fluency (visual-fact → "I can see 3+2=5")
    ↓
math-fact-fluency (equation-solve → "3+2=? → 5!")
    ↓
math-fact-fluency (speed-round → "3+2=5" in under 3 seconds)
    ↓
strategy-picker (compare strategies → "I can solve 8+5 by counting on OR make-ten")
```

### Subtraction Mastery Flow
```
addition-subtraction-scene (act-out → "5 birds, 2 fly away, 3 left")
    ↓
number-bond (inverse → "5 = 3 + 2, so 5 - 3 = 2")
    ↓
math-fact-fluency (equation-solve → "5-2=? → 3!")
    ↓
math-fact-fluency (missing-number → "__-2=3 → 5!")
    ↓
strategy-picker (counting-back vs. think-addition → "5-3: count back 3 from 5, OR think 3+?=5")
```

### Fluency Progression
```
math-fact-fluency (within 3, visual aids, 8 sec)
    ↓
math-fact-fluency (within 5, no visuals, 5 sec)
    ↓
math-fact-fluency (within 5, missing-number, 5 sec)
    ↓
math-fact-fluency (within 5, speed-round, 3 sec target)
    ↓
math-fact-fluency (within 10, with strategies from strategy-picker)
```

---

## 8. Shared Infrastructure

Both new primitives will use the existing multi-phase hooks:

- **`useMultiPhaseEvaluation`** — challenge progress tracking, result recording, phase summaries
- **`useLuminaAI`** — AI tutoring connection with context passing
- **`PhaseSummaryPanel`** — completion screen with score rings and tier badges

`math-fact-fluency` additionally needs:
- **Response time tracking** — per-challenge elapsed time recorded in `ChallengeResult` extras
- **Adaptive fact selection** — re-queuing slow/incorrect facts (could be generator-side or component-side logic)
- **Streak counter** — consecutive correct answers tracked for engagement

Each primitive supports `supportsEvaluation: true` in the catalog.

---

## 9. Generator Guidelines

### `math-fact-fluency` Generator

1. **Accept fact range** — maxNumber determines the pool (3, 5, or 10)
2. **Prioritize struggling facts** — if student competency data is available, over-sample facts with low mastery
3. **Mix challenge types** — start with `visual-fact`, progress through `equation-solve` and `missing-number`, end with `speed-round`
4. **Generate 10-15 challenges** per session (more than other primitives, since each is quick)
5. **Balance operations** — if `includeSubtraction` is true, alternate addition and subtraction facts
6. **Vary unknown position** — for `missing-number`, rotate between result, operand1, and operand2 positions

### `strategy-picker` Generator

1. **Select problems suited to multiple strategies** — e.g., 8+5 works well for counting-on AND make-ten; 4+4 is ideal for doubles
2. **Pair strategies intelligently** — don't pair counting-on with counting-back for the same problem; pair make-ten with counting-on, or doubles with near-doubles
3. **Generate 3-4 multi-strategy problems** per session (each problem takes longer since it's solved multiple ways)
4. **Include a comparison question** after each multi-strategy pair
5. **End with choose-your-strategy** to build student agency
6. **Limit introduced strategies** — K sessions introduce 2-3 strategies max; grade 1 can use all 7

---

## 10. Implementation Estimate

### New Primitives

Per primitive, following the 7-file pattern:
1. Component (`.tsx`)
2. Types (data interface)
3. Generator (Gemini prompt + schema)
4. Generator registry entry
5. Catalog entry (math.ts)
6. Primitive registry entry
7. Evaluation types

**`math-fact-fluency`** — Moderate complexity. Simple UI (equation + choices), but needs timer logic, streak tracking, and adaptive difficulty. The speed-round mode requires precise timing.

**`strategy-picker`** — Higher complexity. Must render 7 different strategy visualizations (mini number line, mini ten frame, tally marks, dot arrays, etc.). The compare view requires split-screen layout. Consider reusing visual subcomponents from existing primitives where possible.

### Generator Enhancements

Generator changes are prompt-only updates (no new components):
- `addition-subtraction-scene` generator: add money theme, equation-first mode, unknown-position variety
- `number-bond` generator: extend K range to 10 for advanced students, recording emphasis
- `ten-frame` generator: explicit subtraction challenges

**Recommended build order:** `math-fact-fluency` → generator enhancements → `strategy-picker`

---

## 11. Success Metrics

| Metric | Target |
|---|---|
| Fluency speed improvement | Average response time drops to ≤3 seconds for within-5 facts after 2 weeks of `math-fact-fluency` |
| Fact mastery | 90%+ accuracy on within-5 facts after 10 sessions |
| Strategy breadth | Students use ≥2 different strategies in `strategy-picker` sessions |
| Existing primitive mastery lift | 15%+ mastery increase on subskills targeted by generator enhancements |
| Session engagement | Average 8+ minutes per `math-fact-fluency` session |
| AI selection accuracy | AI correctly selects fluency vs. exploration primitives 90%+ of the time |

---

## Appendix: Full Skill → Primitive Mapping

<details>
<summary>Understand Addition as Putting Together and Adding To (7 subskills)</summary>

| Skill | Difficulty | Mastery | Primary Primitive | Secondary |
|---|---|---|---|---|
| Represent addition within 5 with objects | 1-3 | — | `addition-subtraction-scene` | `counting-board` |
| Model addition within 5 with drawings/number lines | 2-4 | — | `addition-subtraction-scene` | `number-line` |
| Express addition within 5 as equations | 3-5 | 40.0% | `addition-subtraction-scene` | `math-fact-fluency` |
| Decompose numbers up to 5 into pairs | 4-6 | — | `number-bond` | — |
| Solve addition word problems within 10 | 5-7 | 60.4% | `addition-subtraction-scene` | — |
| Use multiple strategies for addition within 10 | 6-8 | — | `strategy-picker` | `ten-frame` |
| Create/solve addition stories with money/real-world | 7-9 | — | `addition-subtraction-scene` | — |
</details>

<details>
<summary>Understand Subtraction as Taking Apart and Taking From (7 subskills)</summary>

| Skill | Difficulty | Mastery | Primary Primitive | Secondary |
|---|---|---|---|---|
| Represent subtraction within 5 with objects | 1-3 | — | `addition-subtraction-scene` | `counting-board` |
| Decompose within 5, recording decompositions | 2-4 | 9.5% | `number-bond` | — |
| Solve subtraction word problems within 5 | 3-5 | — | `addition-subtraction-scene` | — |
| Model subtraction within 10 with ten frames/number lines | 4-6 | — | `ten-frame` | `number-line` |
| Create/solve real-world subtraction within 10 | 5-7 | 9.5% | `addition-subtraction-scene` | — |
| Find missing numbers in subtraction within 10 | 6-8 | — | `number-bond` | `math-fact-fluency` |
| Connect add/sub as inverse operations within 10 | 7-9 | — | `number-bond` | `strategy-picker` |
</details>

<details>
<summary>Fluently Add and Subtract Within 5 (7 subskills)</summary>

| Skill | Difficulty | Mastery | Primary Primitive | Secondary |
|---|---|---|---|---|
| Count forward/backward within 5 fluently (3 sec) | 1-3 | — | `math-fact-fluency` | `number-sequencer` |
| Add/subtract within 3 with mental strategies | 2-4 | — | `math-fact-fluency` | — |
| Match visuals to equations within 5 | 3-5 | — | `math-fact-fluency` (match) | `addition-subtraction-scene` |
| Add/subtract fluently within 5 with mental strategies | 4-6 | — | `math-fact-fluency` | — |
| Missing number problems within 5 | 5-7 | — | `number-bond` | `math-fact-fluency` |
| Fact families within 5 | 6-8 | — | `number-bond` | — |
| Solve/create word problems within 5 | 7-9 | 0.0% | `addition-subtraction-scene` | — |
</details>
