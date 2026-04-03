# PRD: K-3 Math Content Density — From Primitive Library to Learning Product

**Status:** Draft
**Date:** 2026-04-02
**Priority:** Critical — this is the difference between a demo and an alpha product
**Audience:** Product, Engineering, Curriculum

---

## 1. Problem Statement

We have 45 math primitives and a sophisticated adaptive engine (IRT, 4-gate mastery, daily planning, monthly projection). But we don't have a learning product yet.

**The evidence:**

| Layer | State | Problem |
|-------|-------|---------|
| Primitives (K-1) | 18 built, 3 catalog-only | Good coverage, but 3 critical standards have zero interactive practice |
| Primitives (G2-3) | ~10 exist but idle | Built for higher grades, no authored curriculum connects them |
| Curriculum (K) | 166 subskills authored | Mostly covered by primitives |
| Curriculum (G1) | 115 subskills authored | Mostly covered, some gaps |
| Curriculum (G2) | **Not authored** | Zero skill progressions. Primitives sit idle. |
| Curriculum (G3) | **Not authored** | Zero skill progressions. Primitives sit idle. |
| Adaptive engine | Full pipeline built | Routing students through ~2 grade levels of content |

A student who masters K-1 content hits a wall. The engine has nowhere to send them. The "jump ahead" promise of the IRT model requires content to jump *into*.

### What This PRD Covers

This is NOT a PRD for individual primitives (those exist in `PRD_NEW_K_PRIMITIVES.md`, `PRD-KINDERGARTEN-MATH.md`, etc). This is a **content density plan** — the minimum work to make K-3 math feel like a complete product for an alpha school deployment.

Three workstreams:
1. **Build** — 5 new primitives that close critical standard gaps
2. **Author** — G2-3 curriculum using existing primitives
3. **Connect** — Wire authored curriculum to primitives with 1-step difficulty progressions

---

## 2. Workstream 1: New Primitives

### 2.1 Inventory of What's Built vs Not

| Primitive | Component | Generator | Catalog | Eval Modes | Status |
|-----------|-----------|-----------|---------|------------|--------|
| MathFactFluency | ✅ | ✅ | ✅ | ✅ | **Built** |
| StrategyPicker | ✅ | ✅ | ✅ | ✅ | **Built** |
| NumberTracer | ✅ | ✅ | ✅ | ✅ | **Built** |
| SpatialScene | ✅ | ✅ | ✅ | ✅ | **Complete** |
| CompareObjects | ❌ | ❌ | ❌ | ❌ | **PRD exists, not built** |
| CoinCounter | ✅ | ✅ | ✅ | ✅ | **Complete** |
| TimeSequencer | ✅ | ✅ | ✅ | ✅ | **Complete** |
| EquationBuilder | ❌ | ❌ | ❌ | ❌ | **Not designed** |

### 2.2 Priority Build Order

#### P0 — Build This Week

**Primitive A: `CoinCounter`**

Every K-3 math product has money. Parents notice its absence immediately.

**Rationale:** K.MD (classify/count by attribute), 1.MD.C (tell and write time, use coins), 2.MD.C.8 (solve problems with coins), 2.NBT (place value reinforcement). Money is the single most relatable real-world math context for young children.

**Concept:** Interactive coin workspace. Students identify coins (penny, nickel, dime, quarter), count mixed coin sets, make change, and solve "How much?" problems. Visual: realistic coin images, draggable into a counting area.

**Schema:**
```ts
interface CoinCounterChallenge {
  id: string;
  type: 'identify' | 'count' | 'make-amount' | 'compare' | 'make-change';
  instruction: string;

  // identify — "Which coin is a nickel?"
  coins?: CoinDef[];
  targetCoin?: CoinType;

  // count — "How much money is shown?"
  displayedCoins?: CoinDef[];
  correctTotal?: number; // in cents

  // make-amount — "Make 47¢ using the fewest coins"
  targetAmount?: number;
  availableCoins?: CoinType[];
  acceptableSolutions?: CoinDef[][]; // multiple valid answers

  // compare — "Which group has more money?"
  groupA?: CoinDef[];
  groupB?: CoinDef[];
  correctGroup?: 'A' | 'B' | 'equal';

  // make-change — "You pay 75¢ with $1. What coins do you get back?"
  paidAmount?: number;
  itemCost?: number;
  correctChange?: number;
}

type CoinType = 'penny' | 'nickel' | 'dime' | 'quarter' | 'half-dollar' | 'dollar';

interface CoinDef {
  type: CoinType;
  count: number;
}
```

**Eval Modes:**

| Eval Mode | β | Scaffold | Challenge Types | Grade | Description |
|-----------|---|----------|-----------------|-------|-------------|
| `identify` | 1.0 | 1 | `['identify']` | K | Name coins by appearance; match coin to value |
| `count-like` | 1.5 | 1 | `['count']` | K-1 | Count sets of same coin type (5 pennies = 5¢) |
| `count-mixed` | 2.5 | 2 | `['count']` | 1-2 | Count mixed coin sets (2 dimes + 3 pennies = 23¢) |
| `make-amount` | 3.5 | 2 | `['make-amount']` | 1-2 | Drag coins to build a target amount |
| `compare` | 3.0 | 2 | `['compare']` | 1-2 | Which coin group has more money? |
| `make-change` | 4.5 | 3 | `['make-change']` | 2-3 | Calculate change from a purchase |
| `fewest-coins` | 5.0 | 3 | `['make-amount']` | 2-3 | Make amount using minimum coins (greedy algorithm) |

**AI Tutoring Hooks:**
- Scaffolding: L1 "What coin is this? Look at its size and color." → L2 "A dime is 10¢. Count by 10s for each dime, then add the pennies." → L3 "You have 2 dimes and 3 pennies. 10, 20... then 21, 22, 23. The total is 23¢."
- Common struggles: Confusing dime/penny (small vs large), skip-counting by mixed values, making change requires subtraction
- Directive: Always connect to skip-counting. "Count the quarters: 25, 50, 75..."

**Curriculum Standards:**
- K.MD.3 — Classify objects into categories, count per category (coin sorting)
- 1.MD.C — Relate counting to coins
- 2.MD.C.8 — Solve word problems involving dollar bills, quarters, dimes, nickels, pennies
- 2.NBT — Reinforces place value (10 pennies = 1 dime = concept of "ten")

---

**Primitive B: `TimeSequencer`**

K-1 time concepts have zero coverage. `AnalogClock` starts at telling time to the hour — it skips the foundational concepts entirely.

**Rationale:** K.MD.B (daily routines, sequencing), 1.MD.B.3 (tell time to hour/half-hour), 2.MD.C.7 (tell time to 5 minutes). More importantly: sequencing events is a pre-mathematical reasoning skill that underpins all procedural thinking.

**Concept:** Two modes. (1) Event sequencer: drag daily routine cards (wake up, eat breakfast, go to school, eat lunch, play, dinner, bedtime) into order. (2) Time-of-day matcher: match events to times of day (morning, afternoon, evening) or clock faces. Bridges to AnalogClock's hour-reading mode.

**Schema:**
```ts
interface TimeSequencerChallenge {
  id: string;
  type: 'sequence-events' | 'match-time-of-day' | 'before-after' | 'duration-compare' | 'read-schedule';
  instruction: string;

  // sequence-events — "Put these in order: wake up, breakfast, school, lunch"
  events?: EventCard[];
  correctOrder?: string[]; // event IDs in order

  // match-time-of-day — "Does this happen in the morning or evening?"
  event?: EventCard;
  correctPeriod?: 'morning' | 'afternoon' | 'evening' | 'night';

  // before-after — "What do you do BEFORE lunch?"
  referenceEvent?: EventCard;
  relation?: 'before' | 'after';
  options?: EventCard[];
  correctEvent?: string;

  // duration-compare — "Which takes longer: brushing teeth or sleeping?"
  eventA?: EventCard;
  eventB?: EventCard;
  correctAnswer?: 'A' | 'B' | 'same';

  // read-schedule — "What happens at 3:00?"
  schedule?: ScheduleEntry[];
  targetTime?: string;
  correctActivity?: string;
}

interface EventCard {
  id: string;
  label: string;
  emoji: string; // 🌅 ☀️ 🌙 🍳 🎒 📚 🏃 🍽️ 🛁 😴
  typicalTime?: string; // "7:00 AM" — used in later modes
}

interface ScheduleEntry {
  time: string;
  activity: string;
  emoji: string;
}
```

**Eval Modes:**

| Eval Mode | β | Scaffold | Challenge Types | Grade | Description |
|-----------|---|----------|-----------------|-------|-------------|
| `sequence-3` | 1.0 | 1 | `['sequence-events']` | K | Order 3 daily events |
| `time-of-day` | 1.5 | 1 | `['match-time-of-day']` | K | Match events to morning/afternoon/night |
| `sequence-5` | 2.0 | 2 | `['sequence-events']` | K-1 | Order 5 daily events |
| `before-after` | 2.5 | 2 | `['before-after']` | K-1 | What happens before/after X? |
| `duration-compare` | 3.0 | 2 | `['duration-compare']` | 1 | Which takes longer? |
| `read-schedule` | 4.0 | 3 | `['read-schedule']` | 1-2 | Read a simple daily schedule with clock times |

**Bridge to AnalogClock:** `read-schedule` mode shows times in both digital and clock-face format. Students who master this naturally transition to AnalogClock's `read` eval mode (tell time to the hour). This is the missing on-ramp.

**AI Tutoring Hooks:**
- Scaffolding: L1 "Think about your day. What do you do first when you wake up?" → L2 "Breakfast comes in the morning. Is the morning before or after lunchtime?" → L3 "Here's the order: wake up comes first, then breakfast, then school. You got 2 out of 3 right!"
- Directive: Connect to personal experience. "What do YOU do in the morning?"

---

#### P1 — Build Next Week

**Primitive C: `SpatialScene`** (PRD exists in `PRD_NEW_K_PRIMITIVES.md`)

K.G.1 — positional language (above, below, beside). PRD is complete. Build per existing spec.

**Primitive D: `CompareObjects`** (PRD exists in `PRD_NEW_K_PRIMITIVES.md`)

K.MD.1-2 — describe and compare measurable attributes. PRD is complete. Build per existing spec.

#### P2 — Build Week 3

**Primitive E: `EquationBuilder`**

Standalone equation construction without story context. `AdditionSubtractionScene` teaches operations through stories; this teaches the symbolic language itself.

**Rationale:** 1.OA.7 (understand the meaning of the equal sign), 1.OA.8 (determine unknown number in equations), 2.OA.1 (use addition/subtraction within 100 to solve word problems). The transition from concrete (counters, stories) to abstract (3 + ? = 7) is where many students stall. No current primitive isolates this.

**Concept:** Drag-and-drop equation workspace. Number tiles, operator tiles (+, -, =), and a blank tile (?). Students build equations from parts, fill in missing values, or determine if an equation is true/false. Visual: tile-based, not handwriting — this is about understanding structure, not writing.

**Schema:**
```ts
interface EquationBuilderChallenge {
  id: string;
  type: 'build' | 'missing-value' | 'true-false' | 'balance' | 'rewrite';
  instruction: string;

  // build — "Build the equation: 3 plus 2 equals 5"
  targetEquation?: string; // "3 + 2 = 5"
  availableTiles?: string[]; // ["3", "2", "5", "+", "=", "4", "-"]

  // missing-value — "What number makes this true? 4 + ? = 7"
  equation?: string;
  missingPosition?: number; // index of the blank
  correctValue?: number;
  options?: number[]; // for MC mode

  // true-false — "Is 3 + 2 = 6 true or false?"
  displayEquation?: string;
  isTrue?: boolean;

  // balance — "Make both sides equal: 3 + 4 = ? + 2"
  leftSide?: string;
  rightSide?: string; // contains ?
  correctAnswer?: number;

  // rewrite — "Write this another way: 5 = 2 + ?"
  originalEquation?: string;
  rewriteTemplate?: string;
  correctRewrite?: string;
}
```

**Eval Modes:**

| Eval Mode | β | Scaffold | Challenge Types | Grade | Description |
|-----------|---|----------|-----------------|-------|-------------|
| `build-simple` | 1.0 | 1 | `['build']` | K-1 | Drag tiles to build a spoken/shown equation |
| `missing-result` | 1.5 | 1 | `['missing-value']` | K-1 | 3 + 2 = ? (unknown is the answer) |
| `missing-operand` | 2.5 | 2 | `['missing-value']` | 1 | 3 + ? = 5 (unknown is an addend) |
| `true-false` | 2.0 | 2 | `['true-false']` | 1 | Is 4 + 1 = 6 true or false? |
| `balance-both-sides` | 3.5 | 3 | `['balance']` | 1-2 | 3 + 4 = ? + 2 (equal sign means "same as") |
| `rewrite` | 4.0 | 3 | `['rewrite']` | 2 | Express the same relationship differently |

**Why this matters:** The equal sign is the most misunderstood symbol in elementary math. Most K-1 students think "=" means "the answer comes next." `balance` and `rewrite` modes directly combat this misconception — they teach that "=" means "the same amount is on both sides." This is foundational for algebra readiness.

**AI Tutoring Hooks:**
- Scaffolding: L1 "What does the plus sign mean? It means we're putting groups together." → L2 "3 + ? = 5. You have 3, you need 5. How many more do you need?" → L3 "Count up from 3: 4, 5. That's 2 more. So 3 + 2 = 5."
- Common struggles: "=" means "answer" misconception, left-to-right reading bias (can't parse 5 = 3 + 2)
- Directive: Always emphasize balance. "Both sides must show the same amount!"

---

## 3. Workstream 2: Author G2-3 Curriculum

This is the higher-leverage work. We have primitives that cover G2-3 skills but zero authored curriculum connecting them.

### 3.1 Grade 2 Math — Curriculum Skeleton

Use `/curriculum-author` to create these skill trees. Each subskill maps to a specific primitive + eval mode.

**Unit 1: Place Value & Number Sense (2.NBT)**

| Skill | Subskills | Primary Primitive | Eval Modes |
|-------|-----------|-------------------|------------|
| Understand hundreds, tens, ones | Count in hundreds (100, 200...) | `base-ten-blocks` | `build_number` (hundreds) |
| | Read/write numbers to 1000 | `place-value-chart` | `identify-3digit`, `build-3digit` |
| | Expanded form (300 + 40 + 7 = 347) | `place-value-chart` | `expanded-form` |
| | Compare 3-digit numbers using <, >, = | `comparison-builder` | (extend to 3-digit) |
| Skip count by 5s, 10s, 100s | Within 1000 | `skip-counting-runner` | (extend to 100s) |
| | Patterns on hundreds chart | `hundreds-chart` | `highlight`, `complete` |

**Unit 2: Addition & Subtraction Within 1000 (2.NBT, 2.OA)**

| Skill | Subskills | Primary Primitive | Eval Modes |
|-------|-----------|-------------------|------------|
| Add/subtract within 100 mentally | Add/subtract 10 from any number | `base-ten-blocks` | `add_with_blocks` |
| | Add two 2-digit numbers (no regroup) | `regrouping-workbench` | `add_no_regroup` |
| | Add two 2-digit numbers (with regroup) | `regrouping-workbench` | `add_regroup` |
| | Subtract 2-digit (no regroup) | `regrouping-workbench` | `subtract_no_regroup` |
| | Subtract 2-digit (with regroup) | `regrouping-workbench` | `subtract_regroup` |
| Add up to four 2-digit numbers | Column addition | `regrouping-workbench` | (extend) |
| Add/subtract within 1000 | 3-digit + 3-digit using models | `base-ten-blocks` | `add_with_blocks` (3-digit) |
| | 3-digit algorithm | `regrouping-workbench` | `add_regroup` (3-digit) |

**Unit 3: Foundations for Multiplication (2.OA)**

| Skill | Subskills | Primary Primitive | Eval Modes |
|-------|-----------|-------------------|------------|
| Determine odd/even | Use pairing/arrays | `array-grid` | `build_array` (2×N) |
| Work with equal groups | Repeated addition with objects | `array-grid` | `count_array` |
| | Rectangular arrays (rows × columns) | `array-grid` | `multiply_array` |
| | Connect repeated addition to arrays | `multiplication-explorer` | `build` (equal groups) |

**Unit 4: Measurement (2.MD)**

| Skill | Subskills | Primary Primitive | Eval Modes |
|-------|-----------|-------------------|------------|
| Measure length in standard units | Inches, feet, centimeters, meters | `measurement-tools` | `measure` |
| | Estimate lengths | `measurement-tools` | `compare` |
| | Compare lengths, find differences | `measurement-tools` | `compare` |
| | Add/subtract length (word problems) | `tape-diagram` | `solve-part-whole` |
| Tell/write time | To the nearest 5 minutes | `analog-clock` | `read` (5-min intervals) |
| | A.M. vs P.M. | `time-sequencer` | `read-schedule` |
| Money | Count coin combinations | `coin-counter` | `count-mixed` |
| | Solve money word problems | `coin-counter` | `make-change` |
| Represent data | Line plots with whole-number units | `dot-plot` | (extend to G2 mode) |
| | Picture/bar graphs | `bar-model` | (extend to data mode) |

**Unit 5: Geometry (2.G)**

| Skill | Subskills | Primary Primitive | Eval Modes |
|-------|-----------|-------------------|------------|
| Recognize shapes by attributes | Triangles, quadrilaterals, pentagons, hexagons | `shape-sorter` | (extend attribute set) |
| | Identify faces of 3D shapes as 2D | `3d-shape-explorer` | `properties` |
| Partition rectangles | Rows and columns of same-size squares | `array-grid` | `build_array` |
| Partition circles/rectangles | Halves, thirds, fourths | `fraction-circles` | `identify` (early intro) |

---

### 3.2 Grade 3 Math — Curriculum Skeleton

**Unit 1: Multiplication & Division (3.OA)**

| Skill | Subskills | Primary Primitive | Eval Modes |
|-------|-----------|-------------------|------------|
| Interpret products | Equal groups, arrays | `multiplication-explorer` | `build` (groups + arrays) |
| Interpret quotients | Partition/measurement division | `multiplication-explorer` | `missing_factor` |
| Multiply/divide within 100 | Fact families | `multiplication-explorer` | `connect`, `fluency` |
| | Properties (commutative, associative, distributive) | `multiplication-explorer` | `commutative`, `distributive` |
| | Fluency within 100 | `math-fact-fluency` | (extend to multiplication) |
| Solve 2-step word problems | All four operations | `tape-diagram` | `solve-comparison`, `multi-step` |
| Identify arithmetic patterns | Even/odd rules, patterns in addition table | `hundreds-chart` | `identify`, `find-skip-value` |

**Unit 2: Number & Operations in Base Ten (3.NBT)**

| Skill | Subskills | Primary Primitive | Eval Modes |
|-------|-----------|-------------------|------------|
| Round to nearest 10 or 100 | Using number line | `number-line` | `plot_point` (rounding) |
| Add/subtract within 1000 fluently | Multi-digit algorithms | `regrouping-workbench` | 3-digit modes |
| Multiply one-digit × multiples of 10 | 3 × 40 = 120 | `area-model` | `build` (single-digit × decade) |

**Unit 3: Fractions (3.NF)**

| Skill | Subskills | Primary Primitive | Eval Modes |
|-------|-----------|-------------------|------------|
| Understand fractions as parts of whole | Unit fractions 1/b | `fraction-circles` | `identify` |
| | Non-unit fractions a/b | `fraction-bar` | Phase 1-3 |
| Fractions on a number line | Partition 0-1 into equal parts | `number-line` | `plot_point` (fraction mode) |
| | Locate fractions beyond 1 | `number-line` | `plot_point` (mixed number) |
| Equivalent fractions | 1/2 = 2/4 = 3/6 visual proof | `fraction-circles` | `equivalent` |
| Compare fractions | Same numerator or same denominator | `fraction-circles` | `compare` |
| | Justify with visual models | `fraction-bar` | compare mode |

**Unit 4: Measurement & Data (3.MD)**

| Skill | Subskills | Primary Primitive | Eval Modes |
|-------|-----------|-------------------|------------|
| Tell time to the minute | On analog clock | `analog-clock` | `read` (1-min) |
| | Elapsed time | `analog-clock` | `elapsed` |
| Measure liquid volumes & masses | Grams, kilograms, liters | `compare-objects` | `non_standard` (extend) |
| Represent data | Scaled picture/bar graphs | `bar-model` | data mode |
| | Line plots with fractions | `dot-plot` | fraction mode |
| Perimeter | Find perimeter of polygons | `shape-builder` | `build` (perimeter mode) |
| Area | Count unit squares | `array-grid` | `count_array` (area) |
| | Relate area to multiplication | `area-model` | `build` |
| | Tiling and multiplication | `area-model` | `calculate-partial-products` |

**Unit 5: Geometry (3.G)**

| Skill | Subskills | Primary Primitive | Eval Modes |
|-------|-----------|-------------------|------------|
| Categorize shapes by attributes | Rhombus, rectangle, square relationships | `shape-builder` | `classify` |
| | Quadrilateral hierarchy | `shape-sorter` | (extend classification rules) |
| Partition shapes into equal areas | Express as unit fractions | `fraction-circles` | `build` |

---

## 4. Workstream 3: 1-Step Progressions

### The Problem

Current eval mode progressions often jump 2-3 difficulty levels. The IRT model needs granular signal — small steps where a student's probability of success shifts meaningfully between adjacent modes.

### The Fix

For each primitive used in K-3, ensure eval modes form a ladder where adjacent modes differ by at most 1.0 β.

**Example — `regrouping-workbench` current gaps:**

| Current Mode | β | Gap to Next |
|-------------|---|-------------|
| `add_no_regroup` (2-digit) | 1.5 | |
| `subtract_no_regroup` (2-digit) | 2.0 | 0.5 ✅ |
| `add_regroup` (2-digit) | 3.0 | **1.0** — borderline |
| `subtract_regroup` (2-digit) | 3.5 | 0.5 ✅ |
| `add_regroup` (3-digit) | 4.5 | **1.0** — borderline |

**Proposed insertion:**
- `add_regroup_guided` (β 2.5) — regrouping with carry arrow shown, student confirms
- `subtract_regroup_guided` (β 3.0) — borrowing with trade animation, student confirms
- `add_3digit_no_regroup` (β 3.5) — 3-digit without carrying first

### Primitives Needing Eval Mode Densification

| Primitive | Current Modes | Needed Additions | Priority |
|-----------|--------------|-----------------|----------|
| `regrouping-workbench` | 4 | +3 intermediate modes | High |
| `multiplication-explorer` | 6 | +2 (single-digit before multi-digit) | High |
| `fraction-circles` | 4 | +2 (unit fractions before non-unit) | High |
| `analog-clock` | 4 | +1 (hour-only before half-hour) | Medium |
| `base-ten-blocks` | 4 | +2 (2-digit build before 3-digit) | Medium |
| `comparison-builder` | 4 | +1 (extend to 3-digit for G2) | Medium |
| `skip-counting-runner` | 5 | +1 (count by 100s for G2) | Low |

---

## 5. Execution Plan

### Week 1: Close K-1 Gaps + Start G2 Authoring

| Day | Task | Deliverable |
|-----|------|-------------|
| Mon | Build `CoinCounter` primitive | Component, generator, catalog, eval modes |
| Tue | Build `TimeSequencer` primitive | Component, generator, catalog, eval modes |
| Wed | Build `SpatialScene` (from existing PRD) | Component, generator, catalog, eval modes |
| Thu | Build `CompareObjects` (from existing PRD) | Component, generator, catalog, eval modes |
| Fri | `/eval-test` all 4 new primitives | Fix any generation/eval issues |

### Week 2: G2-3 Curriculum Authoring

| Day | Task | Deliverable |
|-----|------|-------------|
| Mon | Author G2 Unit 1-2 (place value, add/sub) | ~40 subskills with primitive mappings |
| Tue | Author G2 Unit 3-5 (mult foundations, measurement, geometry) | ~30 subskills |
| Wed | Author G3 Unit 1-2 (multiplication/division, NBT) | ~35 subskills |
| Thu | Author G3 Unit 3-5 (fractions, measurement, geometry) | ~35 subskills |
| Fri | Build `EquationBuilder` primitive | Component, generator, catalog, eval modes |

### Week 3: Densification + Integration Testing

| Day | Task | Deliverable |
|-----|------|-------------|
| Mon-Tue | Add intermediate eval modes to 7 primitives | ~12 new eval modes |
| Wed | Wire all G2-3 subskills to primitive eval modes | Curriculum ↔ primitive mapping complete |
| Thu | `/pulse-agent` run: simulate K→G3 student journeys | Identify dead ends, difficulty cliffs |
| Fri | Fix issues from pulse run | Smooth K→G3 progression |

---

## 6. Success Criteria

**For alpha school deployment, a K-3 math product must pass these tests:**

| Test | Criteria | How to Verify |
|------|----------|---------------|
| **Completeness** | Every Common Core K-3 math standard has ≥1 primitive + eval mode | Audit against CCSS checklist |
| **Progression** | A student can advance K→G3 without hitting a content wall | `/pulse-agent` completes K→G3 journey |
| **Granularity** | Adjacent eval modes differ by ≤1.0 β | Scan all eval mode β values |
| **Diversity** | Daily sessions include ≥3 different primitives | Check daily planner output |
| **Fluency** | Timed practice available for +/- within 20 and × within 100 | `MathFactFluency` covers both |
| **Real-world** | Money + time primitives present | `CoinCounter` + `TimeSequencer` exist |
| **Parent demo** | A parent can watch 5 minutes and understand the product | Qualitative — no "what is this?" confusion |

---

## 7. What This PRD Does NOT Cover

- **K-3 ELA/Literacy primitives** — separate workstream
- **Diagnostic placement test** — covered by `Lumina_PRD_Diagnostic_Placement.md`
- **IRT model tuning** — no changes needed; the model works, it just needs content
- **Backend infrastructure** — no new services required; existing curriculum authoring + primitive registration patterns handle everything
- **Curriculum service refactoring** — explicitly deprioritized. The service works. Feed it content.

---

## 8. Open Questions

1. **MathFactFluency multiplication mode:** The current implementation covers addition/subtraction within 5/10. Does it already support multiplication facts, or does it need a mode extension for G3 fluency (× within 100)?

2. **CoinCounter visual assets:** Realistic coin images vs stylized/emoji. Realistic is more recognizable but requires assets. Recommendation: use high-quality SVG illustrations (not photos) — clear enough for recognition, lightweight enough for the component.

3. **Grade 2-3 curriculum authoring approach:** Use `/curriculum-author` with Gemini to generate subskill trees from the skeletons above, or hand-author? Recommendation: Gemini-generate from the skeleton, then human-review for correctness and primitive mapping accuracy.

4. **Eval mode densification scope:** Adding 12+ eval modes across 7 primitives is significant. Should we prioritize only the K-2 path (where students will be first) and defer G3 densification?

5. **EquationBuilder vs extending AdditionSubtractionScene:** Could we add a "symbolic" mode to AdditionSubtractionScene instead of building a new primitive? The interaction model is different enough (tile-dragging vs story acting) that a separate primitive is cleaner, but this is a judgment call.
