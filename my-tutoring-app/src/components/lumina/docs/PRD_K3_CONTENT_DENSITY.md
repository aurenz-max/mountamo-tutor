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

Current eval mode progressions jump too far between adjacent modes. The IRT model needs granular signal — small steps where a student's P(correct) shifts meaningfully between adjacent modes. Our target: **≤1.0 β between adjacent modes**.

**The systemic cliff:** 13 of 17 K-3 math primitives share the same pattern — betas at 1.5, 2.5, 3.5, then a **1.5 jump to 5.0**. This isn't one-off; it's a template artifact. Every primitive built from the standard 4-tier template has this gap at the top.

### 4.1 Full Audit — Current State (from catalog, verified 2026-04-05)

#### Tier A: Primitives with 1.5+ β gaps (CRITICAL — blocks smooth progression)

**`multiplication-explorer`** — worst offender, 3 consecutive 1.5 gaps:
| Mode | β | Gap | Grade |
|------|---|-----|-------|
| `build` | 1.5 | — | 2 |
| `connect` | 2.5 | 1.0 ✅ | 2 |
| `commutative` | 3.5 | 1.0 ✅ | 2-3 |
| `distributive` | 5.0 | **1.5** ❌ | 3 |
| `missing_factor` | 6.5 | **1.5** ❌ | 3 |
| `fluency` | 8.0 | **1.5** ❌ | 3 |

**`regrouping-workbench`** — the G1-2 workhorse:
| Mode | β | Gap | Grade |
|------|---|-----|-------|
| `add_no_regroup` | 1.5 | — | 1 |
| `subtract_no_regroup` | 2.5 | 1.0 ✅ | 1 |
| `add_regroup` | 3.5 | 1.0 ✅ | 1-2 |
| `subtract_regroup` | 5.0 | **1.5** ❌ | 2 |

**Standard 4-tier template cliff (3.5→5.0)** — affects all of these:
| Primitive | Mode at β 3.5 | Mode at β 5.0 | Grade span |
|-----------|--------------|--------------|------------|
| `fraction-circles` | `compare` | `equivalent` | 3 |
| `fraction-bar` | `compare` | `add_subtract` | 3 |
| `base-ten-blocks` | `regroup` | `operate` | 1-2 |
| `comparison-builder` | `compare_numbers` | `order` | 1-2 |
| `number-line` | `order` | `between` | 2-3 |
| `tape-diagram` | `solve_comparison` | `multi_step` | 2-3 |
| `area-model` | `multiply` | `factor` | 3 |
| `place-value-chart` | `compare` | `expanded_form` | 2 |
| `ten-frame` | `make_ten` | `operate` | K-1 |
| `pattern-builder` | `translate` | `create` | K-1 |
| `number-bond` | `fact_family` | `build_equation` | K-1 |
| `addition-subtraction-scene` | `solve_story` | `create_story` | K-1 |
| `shape-tracer` | `complete` | `draw_from_description` | K |

#### Tier B: Other notable gaps

**`analog-clock`** — 1.5 gap at entry AND top:
| Mode | β | Gap |
|------|---|-----|
| `read` | 1.5 | — |
| `set_time` | 3.0 | **1.5** ❌ |
| `match` | 3.5 | 0.5 ✅ |
| `elapsed` | 5.0 | **1.5** ❌ |

**`measurement-tools`** — 1.5 gap then 2.0 gap:
| Mode | β | Gap |
|------|---|-----|
| `measure` | 1.5 | — |
| `compare` | 3.0 | **1.5** ❌ |
| `convert` | 5.0 | **2.0** ❌ |

**`spatial-scene`** — 1.5 gap at entry AND top:
| Mode | β | Gap |
|------|---|-----|
| `identify` | 1.0 | — |
| `place` | 2.5 | **1.5** ❌ |
| `describe` | 3.5 | 1.0 ✅ |
| `follow_directions` | 5.0 | **1.5** ❌ |

**`number-tracer`** — 1.5 gap in middle AND top:
| Mode | β | Gap |
|------|---|-----|
| `trace` | 1.0 | — |
| `copy` | 2.0 | 1.0 ✅ |
| `write` | 3.5 | **1.5** ❌ |
| `sequence` | 5.0 | **1.5** ❌ |

#### Tier C: Bug — `coin-counter` ordering

The catalog lists `make-amount` (β 3.5) before `compare` (β 3.0). The IRT engine reads these in order — **the beta values are non-monotonic**. This needs a catalog reorder, not just new modes.

Correct sorted order: `identify` 1.0 → `count-like` 1.5 → `count-mixed` 2.5 → `compare` 3.0 → `make-amount` 3.5 → `make-change` 4.5 → `fewest-coins` 5.0

#### Tier D: Well-structured (no changes needed)

| Primitive | Modes | Max gap | Notes |
|-----------|-------|---------|-------|
| `time-sequencer` | 6 | 1.0 | Best progression in the catalog |
| `coin-counter` | 7 | 1.0 | Good after reorder fix |
| `counting-board` | 5 | 1.0 | Uses sub-1.0 steps at bottom |
| `function-machine` | 4 | 1.0 | Tight 2.5→3.0→3.5→4.5 |
| `sorting-station` | 6 | 1.0 | Good model to follow |

### 4.2 Densification Plan — Concrete Mode Insertions

**Target: ≤1.0 β between adjacent modes.** Each insertion below specifies the mode name, beta, scaffolding level, challenge type(s), and the pedagogical rationale.

#### HIGH priority (K-2 critical path)

**`regrouping-workbench`** — insert 2 modes:
| Mode | β | Scaffold | Types | Rationale |
|------|---|----------|-------|-----------|
| `add_no_regroup` | 1.5 | 1 | existing | — |
| `subtract_no_regroup` | 2.5 | 2 | existing | — |
| `add_regroup` | 3.5 | 2 | existing | — |
| **`add_regroup_3digit`** | **4.0** | **3** | `['add_regroup']` | 3-digit addition with regrouping — bridges 2-digit mastery to subtraction regrouping |
| **`subtract_regroup_guided`** | **4.5** | **3** | `['subtract_regroup']` | Subtraction with visual trade animation shown first, student confirms the exchange |
| `subtract_regroup` | 5.0 | 3 | existing | — |

**`multiplication-explorer`** — insert 3 modes:
| Mode | β | Scaffold | Types | Rationale |
|------|---|----------|-------|-----------|
| `commutative` | 3.5 | 2 | existing | — |
| **`distributive_visual`** | **4.0** | **3** | `['distributive']` | Break apart with array model shown — visual scaffolding before abstract |
| `distributive` | 5.0 | 3 | existing | — |
| **`missing_factor_small`** | **5.5** | **3** | `['missing_factor']` | Missing factor with single-digit factors only (≤10×10) |
| `missing_factor` | 6.5 | 4 | existing | — |
| **`fluency_small`** | **7.0** | **4** | `['fluency']` | Timed facts within 5×5 before full 10×10 |
| `fluency` | 8.0 | 4 | existing | — |

**`base-ten-blocks`** — insert 1 mode:
| Mode | β | Scaffold | Types | Rationale |
|------|---|----------|-------|-----------|
| `regroup` | 3.5 | 2 | existing | — |
| **`operate_single_op`** | **4.0** | **3** | `['add_with_blocks']` | Addition only with blocks — before mixed add/subtract |
| `operate` | 5.0 | 3 | existing | — |

**`ten-frame`** — insert 1 mode:
| Mode | β | Scaffold | Types | Rationale |
|------|---|----------|-------|-----------|
| `make_ten` | 3.5 | 2 | existing | — |
| **`add_within_ten`** | **4.0** | **3** | `['operate']` | Addition only within 10 — bridges make-ten concept to mixed operations |
| `operate` | 5.0 | 3 | existing | — |

**`analog-clock`** — insert 2 modes:
| Mode | β | Scaffold | Types | Rationale |
|------|---|----------|-------|-----------|
| `read` | 1.5 | 1 | existing | — |
| **`read_half_hour`** | **2.0** | **1** | `['read']` | Read time to the half-hour — semantic differentiation via post-filter |
| `set_time` | 3.0 | 2 | existing | — |
| `match` | 3.5 | 2 | existing | — |
| **`elapsed_hour`** | **4.0** | **3** | `['elapsed']` | Elapsed time in whole hours only — before arbitrary elapsed |
| `elapsed` | 5.0 | 3 | existing | — |

**`comparison-builder`** — insert 1 mode:
| Mode | β | Scaffold | Types | Rationale |
|------|---|----------|-------|-----------|
| `compare_numbers` | 3.5 | 2 | existing | — |
| **`order_3`** | **4.0** | **3** | `['order']` | Order 3 numbers — before ordering 4-5 numbers |
| `order` | 5.0 | 3 | existing | — |

**`number-bond`** — insert 1 mode:
| Mode | β | Scaffold | Types | Rationale |
|------|---|----------|-------|-----------|
| `fact_family` | 3.5 | 2 | existing | — |
| **`build_equation_guided`** | **4.0** | **3** | `['build_equation']` | Equation building with number bond visual still shown |
| `build_equation` | 5.0 | 3 | existing | — |

**`addition-subtraction-scene`** — insert 1 mode:
| Mode | β | Scaffold | Types | Rationale |
|------|---|----------|-------|-----------|
| `solve_story` | 3.5 | 2 | existing | — |
| **`create_story_guided`** | **4.0** | **3** | `['create_story']` | Create story from given equation — vs create_story which is fully open |
| `create_story` | 5.0 | 3 | existing | — |

#### MEDIUM priority (G2-3 path)

**`fraction-circles`** — insert 1 mode:
| Mode | β | Scaffold | Types | Rationale |
|------|---|----------|-------|-----------|
| `compare` | 3.5 | 2 | existing | — |
| **`equivalent_visual`** | **4.0** | **3** | `['equivalent']` | Equivalent fractions with visual overlay showing equal parts |
| `equivalent` | 5.0 | 3 | existing | — |

**`fraction-bar`** — insert 1 mode:
| Mode | β | Scaffold | Types | Rationale |
|------|---|----------|-------|-----------|
| `compare` | 3.5 | 2 | existing | — |
| **`add_like_denom`** | **4.0** | **3** | `['add_subtract']` | Add/subtract with same denominator only — before mixed |
| `add_subtract` | 5.0 | 3 | existing | — |

**`number-line`** — insert 1 mode:
| Mode | β | Scaffold | Types | Rationale |
|------|---|----------|-------|-----------|
| `order` | 3.5 | 2 | existing | — |
| **`between_whole`** | **4.0** | **3** | `['find_between']` | Find number between two whole numbers — before fractions/decimals |
| `between` | 5.0 | 3 | existing | — |

**`tape-diagram`** — insert 1 mode:
| Mode | β | Scaffold | Types | Rationale |
|------|---|----------|-------|-----------|
| `solve_comparison` | 3.5 | 3 | existing | — |
| **`multi_step_guided`** | **4.0** | **3** | `['multi_step']` | 2-step problems with diagram partially pre-built |
| `multi_step` | 5.0 | 4 | existing | — |

**`area-model`** — insert 1 mode:
| Mode | β | Scaffold | Types | Rationale |
|------|---|----------|-------|-----------|
| `multiply` | 3.5 | 2 | existing | — |
| **`factor_guided`** | **4.0** | **3** | `['factor']` | Given area, find ONE missing dimension (other given) |
| `factor` | 5.0 | 3 | existing | — |

**`place-value-chart`** — insert 1 mode:
| Mode | β | Scaffold | Types | Rationale |
|------|---|----------|-------|-----------|
| `compare` | 3.5 | 3 | existing | — |
| **`expanded_form_3digit`** | **4.0** | **3** | `['expanded_form']` | Expanded form for 3-digit only — before 4+ digit |
| `expanded_form` | 5.0 | 4 | existing | — |

**`measurement-tools`** — insert 2 modes:
| Mode | β | Scaffold | Types | Rationale |
|------|---|----------|-------|-----------|
| `measure` | 1.5 | 1 | existing | — |
| **`estimate`** | **2.0** | **1** | `['compare']` | Estimate before measuring — builds intuition |
| `compare` | 3.0 | 2 | existing | — |
| **`convert_same_system`** | **4.0** | **3** | `['convert']` | Convert within same system (inches→feet) before cross-system |
| `convert` | 5.0 | 3 | existing | — |

**`spatial-scene`** — insert 2 modes:
| Mode | β | Scaffold | Types | Rationale |
|------|---|----------|-------|-----------|
| `identify` | 1.0 | 1 | existing | — |
| **`identify_left_right`** | **1.5** | **1** | `['identify']` | Left/right only — hardest positional words for K |
| `place` | 2.5 | 2 | existing | — |
| `describe` | 3.5 | 2 | existing | — |
| **`follow_2step`** | **4.0** | **3** | `['follow_directions']` | Follow 2-step directions — before multi-step |
| `follow_directions` | 5.0 | 3 | existing | — |

#### LOW priority (defer if needed)

| Primitive | Insert | β | Rationale |
|-----------|--------|---|-----------|
| `pattern-builder` | `create_guided` | 4.0 | Create pattern from given rule — before open create |
| `shape-tracer` | `complete_guided` | 4.0 | Complete shape with dots shown — before freeform |
| `number-tracer` | `write_guided` | 2.5 | Write with dotted guide — between copy and freehand |
| `number-tracer` | `sequence_short` | 4.0 | Write sequence of 3 numbers — before longer sequences |
| `skip-counting-runner` | `find_skip_value_small` | 4.0 | Find skip value for 2s, 5s, 10s only |

### 4.3 Summary

| Priority | Primitives | New modes | Gaps closed |
|----------|-----------|-----------|-------------|
| High | 8 | +12 | All K-2 critical path 1.5 gaps |
| Medium | 8 | +10 | All G2-3 path 1.5 gaps |
| Low | 4 | +5 | Remaining comfort gaps |
| **Total** | **17** | **+27** | **Every 1.5+ gap in K-3 math** |

Plus 1 bug fix: `coin-counter` eval mode reorder.

---

## 5. Execution Plan

### Week 1: Close K-1 Gaps + Fix Foundation

| Day | Task | Deliverable |
|-----|------|-------------|
| Mon | Fix `coin-counter` eval mode ordering bug | Catalog reorder, backend registry sync |
| Mon | Build `CompareObjects` (from existing PRD) | Component, generator, catalog, eval modes |
| Tue | Build `EquationBuilder` primitive | Component, generator, catalog, eval modes |
| Wed | HIGH densification batch 1: `regrouping-workbench` (+2), `ten-frame` (+1), `base-ten-blocks` (+1) | 4 new eval modes — catalog + backend registry + generators |
| Thu | HIGH densification batch 2: `analog-clock` (+2), `comparison-builder` (+1), `number-bond` (+1), `addition-subtraction-scene` (+1) | 5 new eval modes |
| Fri | HIGH densification batch 3: `multiplication-explorer` (+3) | 3 new eval modes — most complex, needs orchestrator changes |
| Fri | `/eval-test` all new eval modes | Fix any generation/eval issues |

**Week 1 output:** +12 HIGH priority eval modes, 1 bug fix, 2 new primitives. Every K-2 critical path gap ≤1.0 β.

### Week 2: G2-3 Content + Medium Densification

| Day | Task | Deliverable |
|-----|------|-------------|
| Mon | Author G2 Unit 1-2 (place value, add/sub) | ~40 subskills |
| Tue | Author G2 Unit 3-5 (mult, measurement, geometry) | ~30 subskills |
| Tue | MEDIUM densification batch 1: `fraction-circles` (+1), `fraction-bar` (+1), `number-line` (+1), `place-value-chart` (+1) | 4 new eval modes |
| Wed | Author G3 Unit 1-2 (multiplication/division, NBT) | ~35 subskills |
| Thu | Author G3 Unit 3-5 (fractions, measurement, geometry) | ~35 subskills |
| Thu | MEDIUM densification batch 2: `tape-diagram` (+1), `area-model` (+1), `measurement-tools` (+2), `spatial-scene` (+2) | 6 new eval modes |
| Fri | `/eval-test` all MEDIUM eval modes | Fix any generation/eval issues |

**Week 2 output:** +10 MEDIUM eval modes, ~140 subskills authored across G2-3. Every G2-3 path gap ≤1.0 β.

### Week 3: Integration Testing + Polish

| Day | Task | Deliverable |
|-----|------|-------------|
| Mon | LOW densification: remaining 5 modes across 4 primitives | 5 eval modes (if time permits) |
| Tue | `/pulse-agent` run: simulate K→G1 student journey | Identify dead ends, difficulty cliffs |
| Wed | `/pulse-agent` run: simulate G1→G3 student journey | Verify G2-3 curriculum connectivity |
| Thu | Fix issues from pulse runs | Smooth K→G3 progression |
| Fri | Final β audit: scan every primitive, verify ≤1.0 gap rule | Publish audit report |

**Week 3 output:** +5 LOW eval modes, validated K→G3 journey, audit report confirming ≤1.0 β invariant.

---

## 6. Success Criteria

**For alpha school deployment, a K-3 math product must pass these tests:**

| Test | Criteria | How to Verify |
|------|----------|---------------|
| **Completeness** | Every Common Core K-3 math standard has ≥1 primitive + eval mode | Audit against CCSS checklist |
| **Progression** | A student can advance K→G3 without hitting a content wall | `/pulse-agent` completes K→G3 journey |
| **Granularity** | Adjacent eval modes differ by ≤1.0 β across all 17 K-3 math primitives | Automated β audit script (Week 3 deliverable) |
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

4. **Eval mode densification scope:** Adding 27 eval modes across 17 primitives is significant but phased: 12 HIGH (Week 1, K-2 critical path), 10 MEDIUM (Week 2, G2-3), 5 LOW (Week 3, comfort). The HIGH batch alone makes K-2 shippable. MEDIUM and LOW can slip if needed.

5. **EquationBuilder vs extending AdditionSubtractionScene:** Could we add a "symbolic" mode to AdditionSubtractionScene instead of building a new primitive? The interaction model is different enough (tile-dragging vs story acting) that a separate primitive is cleaner, but this is a judgment call.
