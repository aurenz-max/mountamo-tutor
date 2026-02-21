# PRD: Kindergarten Math Primitives

**Status:** Draft
**Date:** 2026-02-21
**Scope:** 6 new Lumina primitives targeting K-1 math standards

---

## 1. Problem Statement

Our current Lumina math primitive library has strong coverage for grades 2-8 but significant gaps at the kindergarten level. While we have `ten-frame`, `counting-board`, `skip-counting-runner`, `number-line`, and `pattern-builder` covering counting and number sense foundations, we're missing dedicated primitives for:

- **Number comparison & inequalities** (no <, >, = work for K-level)
- **Number sequencing & ordering** (no before/after, missing number work)
- **Number bonds / decomposition** (no part-part-whole visual)
- **Addition & subtraction stories** (no concrete story-based operation primitive)
- **Ordinal numbers** (no position-in-sequence primitive at all)
- **Sorting & classification** (no attribute-based categorization primitive)

These gaps map directly to the student's curriculum — the skills listed below have attempts logged but no purpose-built interactive primitives to practice them.

---

## 2. Skill Coverage Map

### What Existing Primitives Already Cover

| Existing Primitive | K Skills Covered |
|---|---|
| `counting-board` | Count 0-10/11-20 objects, one-to-one correspondence, subitizing, arrangements (scattered/line/circle), cardinality, count-on |
| `ten-frame` | Numbers 0-20, subitizing, compose/decompose (partial), make-ten, addition/subtraction within 10 |
| `number-line` | Number placement 0-20, addition/subtraction as jumps, ordering (partial) |
| `skip-counting-runner` | Count by 2s/5s/10s, multiplication foundations |
| `pattern-builder` | Repeating patterns (AB, AAB, ABC), growing patterns, pattern extension |
| `base-ten-blocks` | Place value for 11-20+ (tens and ones) |
| `regrouping-workbench` | Multi-digit addition/subtraction with carrying/borrowing (grades 1-4) |

### Gaps Requiring New Primitives

| Skill Cluster | Priority | Student Data | Proposed Primitive |
|---|---|---|---|
| Compare groups using "more/less/equal", inequality symbols <, >, = | **High** | 2-17 attempts, 20-69% mastery | `comparison-builder` |
| Before/after, missing numbers, ordering least→greatest | **High** | Logged but no mastery data | `number-sequencer` |
| Decompose numbers into pairs, part-part-whole, fact families | **High** | 4-13 attempts, 40-60% mastery | `number-bond` |
| Represent addition/subtraction with objects, stories, equations | **High** | 1-13 attempts, 9-60% mastery | `addition-subtraction-scene` |
| Ordinal positions 1st-10th, sequencing, word problems | **Medium** | 2-8 attempts, 12-76% mastery | `ordinal-line` |
| Sort by attributes, categorize, count within categories | **Medium** | No attempts logged | `sorting-station` |

---

## 3. New Primitives

### 3.1 `comparison-builder`

**Purpose:** Teach quantity comparison and inequality symbols through visual, concrete representations.

**Grade Band:** K-1 (Difficulty 1-8)

**Skills Addressed:**
- Compare two groups of up to 5 objects using "more than," "less than," "equal to"
- Compare two groups of 6-10 objects using visual patterns
- Compare two written numerals 1-10 using number lines
- Order three or more numbers/groups from least to greatest or greatest to least
- Use inequality symbols (<, >) correctly when comparing numbers up to 10
- Identify numbers that are "one more" or "one less" than a given number up to 20
- Compare two numbers between 11-20 using place value understanding

**Interaction Model:**

Multi-phase challenges with 4 challenge types:

| Phase | Challenge Type | Description |
|---|---|---|
| 1 | `compare-groups` | Two groups of countable objects (bears, stars, etc.) side by side. Student taps each to count, then selects "more," "less," or "equal." One-to-one correspondence lines can be toggled. |
| 2 | `compare-numbers` | Two written numerals displayed large. Student places them on a mini number line, then selects the correct inequality symbol. |
| 3 | `order` | 3-5 number cards or groups that the student drags into order (least→greatest or greatest→least). |
| 4 | `one-more-one-less` | A number is shown. Student identifies the number that is one more, one less, or both. Optional: number line context. |

**Visual Design:**
- Split-screen layout: left group vs. right group
- Animated one-to-one correspondence lines (draw from each object in left group to matching object in right group to show leftover)
- Large, friendly inequality symbols (< as "alligator mouth" eating the bigger number — classic K mnemonic)
- Drag-and-drop number cards for ordering
- Glass card Lumina theming

**Data Shape (key fields):**
```typescript
interface ComparisonBuilderData {
  challenges: Array<{
    type: 'compare-groups' | 'compare-numbers' | 'order' | 'one-more-one-less';
    instruction: string;
    // compare-groups
    leftGroup?: { count: number; objectType: string };
    rightGroup?: { count: number; objectType: string };
    correctAnswer?: 'more' | 'less' | 'equal';
    // compare-numbers
    leftNumber?: number;
    rightNumber?: number;
    correctSymbol?: '<' | '>' | '=';
    // order
    numbers?: number[];
    direction?: 'ascending' | 'descending';
    // one-more-one-less
    targetNumber?: number;
    askFor?: 'one-more' | 'one-less' | 'both';
  }>;
  gradeBand: 'K' | '1';
  showCorrespondenceLines: boolean;
  useAlligatorMnemonic: boolean;
}
```

**AI Tutoring Hooks:**
- Context keys: `challengeType`, `leftCount`, `rightCount`, `correctAnswer`, `studentAnswer`, `attemptNumber`, `useAlligatorMnemonic`
- Scaffolding: L1 "Which group looks like it has more?" → L2 "Count each group. Which number is bigger?" → L3 "Left has 5, right has 3. 5 is more than 3, so 5 > 3."
- Alligator directive: "The alligator always eats the bigger number! Which side has more for the alligator to eat?"

---

### 3.2 `number-sequencer`

**Purpose:** Build sequential number understanding — before/after, missing numbers, counting forward/backward, and number ordering.

**Grade Band:** K-1 (Difficulty 2-7)

**Skills Addressed:**
- Count, recognize, and write numbers 11-20 with proper sequence and order
- Demonstrate sequential understanding through 20 (before/after, missing numbers, backward counting)
- Count and recognize numbers from 21-100 (decade numbers)
- Count forward from any given number up to 100
- Count forward and backward within 5-20 fluently

**Interaction Model:**

A "number train" or "number path" metaphor — numbers displayed in sequence with interactive gaps.

| Phase | Challenge Type | Description |
|---|---|---|
| 1 | `fill-missing` | A number sequence with 1-3 blanks. Student types or selects the missing numbers. E.g., `3, 4, __, 6, 7` |
| 2 | `before-after` | A number is shown. Student identifies what comes before, after, or between two numbers. |
| 3 | `order-cards` | Shuffled number cards that student drags into correct sequential order. |
| 4 | `count-from` | Student is given a starting number and must continue the count (forward or backward) by tapping/typing each successive number. |
| 5 | `decade-fill` | Hundred chart with missing decade numbers (10, 20, 30...) or sequences within a decade. |

**Visual Design:**
- Number path/train: horizontal track with "cars" for each number, some blank
- Bright, chunky number cards with optional dot arrays showing quantity
- Hundred chart view for decade challenges (togglable)
- Animated "hop" when a number is placed correctly
- Number line reference below the train (optional, togglable)

**Data Shape (key fields):**
```typescript
interface NumberSequencerData {
  challenges: Array<{
    type: 'fill-missing' | 'before-after' | 'order-cards' | 'count-from' | 'decade-fill';
    instruction: string;
    sequence: (number | null)[]; // null = blank to fill
    correctAnswers: number[];
    startNumber?: number;       // for count-from
    direction?: 'forward' | 'backward';
    rangeMin: number;
    rangeMax: number;
  }>;
  gradeBand: 'K' | '1';
  showNumberLine: boolean;
  showDotArrays: boolean;       // show quantity dots on number cards
}
```

**AI Tutoring Hooks:**
- Context keys: `challengeType`, `sequence`, `missingPositions`, `studentAnswer`, `direction`, `attemptNumber`
- Scaffolding: L1 "Say the numbers out loud. What comes next?" → L2 "Count from {{before}}: {{before}}, __, {{after}}. What goes in the middle?" → L3 "After 7 comes 8. Before 7 is 6. The sequence is ...6, 7, 8..."

---

### 3.3 `number-bond`

**Purpose:** Visualize part-part-whole relationships and number decomposition — the foundation for addition/subtraction fluency.

**Grade Band:** K-1 (Difficulty 1-7)

**Skills Addressed:**
- Decompose numbers up to 5 into pairs in multiple ways, using objects and drawings
- Decompose numbers up to 5 into pairs using objects and drawings, recording each decomposition
- Express addition situations within 5 using verbal explanations and written equations
- Add and subtract fluently within 5 using mental strategies
- Solve missing number problems within 5 (e.g., 3 + __ = 5)
- Complete fact families for numbers within 5
- Connect addition and subtraction as inverse operations within 10

**Interaction Model:**

Classic number bond diagram (circle-and-branch visual) with 4 challenge types:

| Phase | Challenge Type | Description |
|---|---|---|
| 1 | `decompose` | Given a whole number (e.g., 7), student finds all possible part-part pairs. Uses draggable counters that split between two branches. Tracks completeness ("You found 3 of 6 ways to make 7!"). |
| 2 | `missing-part` | Number bond with whole and one part shown. Student finds the missing part. E.g., whole=8, part1=3, part2=? |
| 3 | `fact-family` | Given a number bond (5 = 2 + 3), student writes all 4 related equations: 2+3=5, 3+2=5, 5-2=3, 5-3=2. |
| 4 | `build-equation` | Student sees a number bond and constructs the matching addition or subtraction equation by dragging number tiles and operation symbols. |

**Visual Design:**
- Large circle at top (the "whole") connected by two branches to two smaller circles below (the "parts")
- Draggable two-color counters (red/blue) that the student distributes between the two part circles
- Equation bar below the bond showing the corresponding equation updating in real-time
- "Ways found" tracker for decompose mode showing all discovered pairs
- Animated counter flow when student moves counters between parts

**Data Shape (key fields):**
```typescript
interface NumberBondData {
  challenges: Array<{
    type: 'decompose' | 'missing-part' | 'fact-family' | 'build-equation';
    instruction: string;
    whole: number;
    part1?: number | null;      // null = student must find
    part2?: number | null;      // null = student must find
    allPairs?: [number, number][]; // for decompose: all valid pairs
    factFamily?: string[];      // for fact-family: all 4 equations
    targetEquation?: string;    // for build-equation
  }>;
  maxNumber: number;            // 5 for K, 10 for grade 1
  showCounters: boolean;
  showEquation: boolean;
  gradeBand: 'K' | '1';
}
```

**AI Tutoring Hooks:**
- Context keys: `challengeType`, `whole`, `part1`, `part2`, `missingValue`, `pairsFound`, `totalPairs`, `attemptNumber`
- Scaffolding: L1 "If the whole is 5, what two groups could you split it into?" → L2 "You put 3 in one part. How many are left for the other part?" → L3 "5 = 3 + 2. Now flip it: 5 = 2 + 3. And the subtraction: 5 - 3 = 2, 5 - 2 = 3. That's the whole fact family!"
- Decompose directive: "Celebrate each new pair found. Guide systematic discovery: start with 0+N, then 1+(N-1), then 2+(N-2)..."

---

### 3.4 `addition-subtraction-scene`

**Purpose:** Represent addition and subtraction with concrete animated stories — objects joining, leaving, or being compared — bridging from manipulatives to equations.

**Grade Band:** K-1 (Difficulty 1-8)

**Skills Addressed:**
- Represent addition within 5 using concrete objects, fingers, acting out situations
- Model addition within 5 using drawings, pictures, and number lines
- Express addition situations within 5 using verbal explanations and written equations
- Solve addition word problems within 10 using objects, drawings, or equations
- Represent subtraction within 5 using concrete objects, fingers, physical actions
- Solve subtraction word problems within 5 using objects, drawings, and equations
- Create and solve real-world subtraction situations within 10
- Use multiple strategies (ten frames, tally marks, doubles) for addition within 10
- Solve and create word problems involving addition and subtraction within 5
- Match visual representations to addition and subtraction equations within 5

**Interaction Model:**

An animated scene with a story context (playground, farm, pond, etc.) where objects appear, move, join, or leave.

| Phase | Challenge Type | Description |
|---|---|---|
| 1 | `act-out` | Animated story plays ("3 ducks are in the pond. 2 more ducks arrive."). Student counts the result. Objects are tappable for counting. |
| 2 | `build-equation` | Same story scene, but now student constructs the matching equation by dragging number and symbol tiles (3 + 2 = 5). |
| 3 | `solve-story` | Word problem displayed as text + scene. Student solves by manipulating objects or entering the answer. |
| 4 | `create-story` | Given an equation (e.g., 7 - 3 = 4), student picks a scene and objects to illustrate it. Open-ended creativity. |

**Story Contexts (generator selects thematically):**
- **Join stories** (addition): "3 frogs on a log. 2 more hop on. How many now?"
- **Separate stories** (subtraction): "5 birds on a branch. 2 fly away. How many left?"
- **Compare stories**: "Sam has 4 apples. Mia has 7 apples. How many more does Mia have?"
- **Part-part-whole**: "There are 8 animals: some are dogs and some are cats. 3 are dogs. How many cats?"

**Visual Design:**
- Themed scene background (pond, farm, playground, space) occupying top 60% of card
- Animated objects with entrance/exit animations
- Equation builder bar at bottom with draggable tiles
- Object counter overlay (shows count as student taps each object)
- Ten-frame helper (optional toggle) for "make ten" strategy visualization

**Data Shape (key fields):**
```typescript
interface AddSubSceneData {
  challenges: Array<{
    type: 'act-out' | 'build-equation' | 'solve-story' | 'create-story';
    instruction: string;
    storyText: string;
    scene: 'pond' | 'farm' | 'playground' | 'space' | 'kitchen' | 'garden';
    objectType: string;         // 'ducks', 'frogs', 'apples', etc.
    operation: 'addition' | 'subtraction';
    storyType: 'join' | 'separate' | 'compare' | 'part-whole';
    startCount: number;
    changeCount: number;
    resultCount: number;
    equation: string;           // "3 + 2 = 5"
    unknownPosition?: 'result' | 'change' | 'start'; // which part student solves for
  }>;
  maxNumber: number;            // 5 for early K, 10 for late K / grade 1
  showTenFrame: boolean;
  showEquationBar: boolean;
  gradeBand: 'K' | '1';
}
```

**AI Tutoring Hooks:**
- Context keys: `storyText`, `operation`, `storyType`, `startCount`, `changeCount`, `resultCount`, `unknownPosition`, `studentAnswer`, `attemptNumber`, `challengeType`
- Scaffolding: L1 "What happened in the story? Did objects come or go?" → L2 "You started with {{startCount}} {{objectType}}. Then {{changeCount}} more came. Count them all!" → L3 "{{startCount}} + {{changeCount}} = {{resultCount}}. The equation matches the story!"
- Directive: "Always connect the story to the math. Narrate what's happening: 'The ducks are joining their friends!' Use the student's own counting as the bridge to the equation."

---

### 3.5 `ordinal-line`

**Purpose:** Teach ordinal positions (1st through 10th) through interactive sequencing, matching, and word problem contexts.

**Grade Band:** K-1 (Difficulty 2-9)

**Skills Addressed:**
- Recognize and name ordinal positions (first through fifth) in a simple line or sequence
- Match ordinal number words (first through fifth) with their corresponding symbols (1st-5th)
- Apply ordinal numbers (first through fifth) to daily routines and story sequences
- Extend ordinal number understanding to tenth position (sixth through tenth)
- Compare and analyze relative positions using ordinal numbers ("What comes before fourth?")
- Create and complete sequences using ordinal numbers (first through tenth)
- Solve simple word problems involving ordinal numbers in real-world contexts

**Interaction Model:**

A line of characters/objects in a queue (race, parade, lunch line, etc.) with ordinal labels.

| Phase | Challenge Type | Description |
|---|---|---|
| 1 | `identify` | A line of 5-10 characters. Student taps the one in the requested position ("Tap the 3rd animal"). |
| 2 | `match` | Match ordinal words ("third") to symbols ("3rd") and vice versa. Drag-to-match. |
| 3 | `relative-position` | "What position is the bear? What comes before it? What comes after?" Student answers about relative positions. |
| 4 | `sequence-story` | Story context: "The rabbit finished the race 2nd. The fox finished right before the rabbit. What position was the fox?" |
| 5 | `build-sequence` | Student arranges characters in a line based on ordinal clues ("Put the cat 3rd and the dog 1st"). |

**Visual Design:**
- Horizontal queue of colorful, distinct animal/character sprites
- Ordinal labels above each position (1st, 2nd, 3rd... or first, second, third...)
- Tap-to-select with highlight glow
- Story panel above the queue for word problem contexts
- Start/finish flags for race scenarios

**Data Shape (key fields):**
```typescript
interface OrdinalLineData {
  challenges: Array<{
    type: 'identify' | 'match' | 'relative-position' | 'sequence-story' | 'build-sequence';
    instruction: string;
    characters: Array<{ name: string; emoji: string }>;
    targetPosition?: number;    // 1-indexed ordinal
    targetOrdinalWord?: string; // "third"
    targetOrdinalSymbol?: string; // "3rd"
    relativeQuery?: 'before' | 'after' | 'between';
    storyText?: string;
    clues?: Array<{ character: string; position: number }>; // for build-sequence
    correctAnswer: string | number;
  }>;
  maxPosition: number;          // 5 for early K, 10 for late K/grade 1
  context: 'race' | 'parade' | 'lunch-line' | 'train' | 'bookshelf';
  showOrdinalLabels: boolean;
  labelFormat: 'word' | 'symbol' | 'both'; // "third" vs "3rd" vs both
  gradeBand: 'K' | '1';
}
```

**AI Tutoring Hooks:**
- Context keys: `challengeType`, `targetPosition`, `characters`, `context`, `storyText`, `studentAnswer`, `attemptNumber`
- Scaffolding: L1 "Count from the front of the line: first, second, third..." → L2 "Point to each character and count: 1st, 2nd, 3rd. Which one is in the {{targetOrdinalWord}} spot?" → L3 "The {{targetOrdinalWord}} position is number {{targetPosition}} from the front. That's the {{characters[targetPosition-1].name}}!"
- Directive: "Use everyday language: 'Who's first in line for lunch?' Connect ordinal to cardinal: 'Third means the 3rd one — count 1, 2, 3 and stop!'"

---

### 3.6 `sorting-station`

**Purpose:** Teach categorization, attribute-based sorting, and data organization — foundational skills connecting to data/statistics and logical reasoning.

**Grade Band:** K-1 (Difficulty 1-8)

**Skills Addressed:**
- Create and sort objects into basic categories based on one observable attribute (color, size, or shape)
- Count and compare objects within categories (up to 5 objects) using "more," "fewer," "equal"
- Sort objects into given categories (up to 3 categories) and count up to 10 objects per category
- Classify objects using two attributes simultaneously (e.g., blue AND round)
- Record and represent category data using tally marks and simple pictographs
- Sort objects by function and create self-designed category systems
- Reclassify objects into new categories and identify items that don't belong

**Interaction Model:**

A workspace with unsorted objects at top and labeled sorting bins/zones below.

| Phase | Challenge Type | Description |
|---|---|---|
| 1 | `sort-by-one` | Objects vary by one attribute (all same shape, different colors). Student drags each into the correct color bin. 2-3 bins. |
| 2 | `sort-by-attribute` | Student chooses the sorting rule (color vs. shape vs. size) then sorts. Multiple valid groupings exist. |
| 3 | `count-and-compare` | After sorting, student counts each group and answers "Which has more? Which has fewer? Are any equal?" |
| 4 | `two-attributes` | "Find all the BLUE CIRCLES." Student must consider two attributes simultaneously. Venn-diagram-style overlap. |
| 5 | `odd-one-out` | A group of objects where one doesn't belong. Student identifies and explains which one and why. |
| 6 | `tally-record` | After sorting, student records counts using tally marks and creates a simple pictograph. |

**Visual Design:**
- Colorful objects (shapes, animals, food, toys) in a "messy pile" at top
- Labeled sorting bins below (2-4 bins depending on challenge)
- Drag-and-drop with satisfying "plop" animation into bins
- Counter badge on each bin showing current count
- Tally chart panel that slides up for recording phases
- Pictograph builder with drag-and-stack icons

**Data Shape (key fields):**
```typescript
interface SortingStationData {
  challenges: Array<{
    type: 'sort-by-one' | 'sort-by-attribute' | 'count-and-compare' | 'two-attributes' | 'odd-one-out' | 'tally-record';
    instruction: string;
    objects: Array<{
      id: string;
      label: string;
      emoji: string;
      attributes: Record<string, string>; // { color: 'red', shape: 'circle', size: 'large' }
    }>;
    sortingAttribute?: string;   // 'color', 'shape', 'size', 'function'
    categories?: Array<{ label: string; rule: Record<string, string> }>;
    oddOneOut?: string;          // id of the object that doesn't belong
    oddOneOutReason?: string;
    comparisonQuestion?: string;
    correctComparison?: 'more' | 'fewer' | 'equal';
  }>;
  maxCategories: number;        // 2-4
  showCounts: boolean;
  showTallyChart: boolean;
  gradeBand: 'K' | '1';
}
```

**AI Tutoring Hooks:**
- Context keys: `challengeType`, `sortingAttribute`, `categories`, `objectsSorted`, `totalObjects`, `studentAnswer`, `attemptNumber`
- Scaffolding: L1 "Look at the objects. What do you notice about them? Do any look alike?" → L2 "Look at the COLORS. Can you put all the red ones together?" → L3 "Great sorting! Now count each bin. Red has 4, blue has 3. Which color group has MORE?"
- Directive: "Celebrate the student's sorting choices. There can be multiple valid ways to sort! Ask 'Why did you put that one there?' to build reasoning skills."

---

## 4. Priority & Sequencing

### Phase 1 — Core (Build First)

These three primitives address the highest-priority skill gaps and have the most student attempt data showing need:

| # | Primitive | Rationale |
|---|---|---|
| 1 | `number-bond` | Decomposition is the single most important K skill for addition/subtraction fluency. Directly addresses the 40-60% mastery gap on decomposition and missing-number skills. |
| 2 | `comparison-builder` | Inequality symbols and quantity comparison are flagged High Priority with only 20-69% mastery. The alligator mnemonic is universally expected at K level. |
| 3 | `addition-subtraction-scene` | Story-based operations bridge the gap between concrete counting (which students do well at) and symbolic equations (where mastery drops). Multiple skills at 9-60% mastery. |

### Phase 2 — Extended (Build Next)

| # | Primitive | Rationale |
|---|---|---|
| 4 | `number-sequencer` | Before/after and missing number skills are foundational but have less student attempt data. Addresses counting forward/backward fluency. |
| 5 | `ordinal-line` | Ordinal numbers show scattered mastery (12-76%) suggesting conceptual gaps. A dedicated primitive gives focused practice. |
| 6 | `sorting-station` | Classification has no logged attempts, suggesting it hasn't been practiced yet. Lower urgency but important for data/statistics foundations. |

---

## 5. Integration with Existing Primitives

The new primitives complement (not replace) existing ones. The AI manifest system will learn to select the right tool:

| Skill | Existing Primitive | New Primitive | When AI Should Choose New |
|---|---|---|---|
| Count objects 1-20 | `counting-board` | — | — |
| Subitizing / make-ten | `ten-frame` | — | — |
| Decompose 5 into pairs | `ten-frame` (partial) | `number-bond` | When the focus is decomposition/fact families, not ten-frame manipulation |
| Compare quantities | `bar-model` (partial) | `comparison-builder` | When the focus is inequality symbols, ordering, or "more/less/equal" language for K |
| Number placement 0-20 | `number-line` | `number-sequencer` | When the focus is sequential order, before/after, or missing numbers (not plotting) |
| Addition within 10 | `ten-frame`, `regrouping-workbench` | `addition-subtraction-scene` | When the skill involves word problems, story contexts, or bridging to equations |
| Skip counting | `skip-counting-runner` | — | — |
| Patterns | `pattern-builder` | — | — |

---

## 6. Cross-Primitive Skill Progressions

The primitives should be sequenced in practice manifests to build on each other:

### Counting → Comparison → Operations Flow
```
counting-board (count objects)
    ↓
comparison-builder (compare groups, introduce <, >, =)
    ↓
number-sequencer (order numbers, before/after)
    ↓
number-bond (decompose numbers, part-part-whole)
    ↓
addition-subtraction-scene (story problems, build equations)
    ↓
ten-frame (fluency strategies, make-ten)
```

### Ordering → Ordinal Flow
```
number-sequencer (sequential order, counting forward/backward)
    ↓
ordinal-line (positional order: 1st, 2nd, 3rd...)
```

### Classification → Data Flow
```
sorting-station (sort by attributes, count categories)
    ↓
dot-plot (existing: represent data, frequency)
```

---

## 7. Shared Infrastructure

All 6 primitives will use the existing multi-phase hooks:

- **`useMultiPhaseEvaluation`** — challenge progress tracking, result recording, phase summaries
- **`useLuminaAI`** — AI tutoring connection with context passing
- **`PhaseSummaryPanel`** — completion screen with score rings and tier badges

Each primitive supports `supportsEvaluation: true` in the catalog.

---

## 8. Generator Guidelines

Each primitive's Gemini generator should:

1. **Accept grade context** — K vs. 1 determines number ranges (K: 0-10, 1: 0-20), challenge complexity, and vocabulary
2. **Generate 4-6 challenges** mixing challenge types with progressive difficulty
3. **Use thematic variety** — rotate object types, scenes, and contexts across generations
4. **Respect the student's skill data** — if mastery is low, generate simpler challenges; if high, increase difficulty
5. **Include clear instructions** — every challenge needs a student-facing `instruction` string written in simple, encouraging language

---

## 9. Implementation Estimate

Per primitive, following the 7-file pattern:
1. Component (`.tsx`) — largest effort, includes all interaction modes
2. Types (data interface)
3. Generator (Gemini prompt + schema)
4. Generator registry entry
5. Catalog entry (math.ts)
6. Primitive registry entry
7. Evaluation types

**Recommended build order:** `number-bond` → `comparison-builder` → `addition-subtraction-scene` → `number-sequencer` → `ordinal-line` → `sorting-station`

---

## 10. Success Metrics

| Metric | Target |
|---|---|
| Skill mastery improvement | 15%+ increase in mastery scores for covered skills within 4 weeks |
| Completion rate | 80%+ of students complete all challenges in a session |
| AI primitive selection accuracy | AI correctly selects the new primitive for matching skills 90%+ of the time |
| Student engagement | Average session duration 5+ minutes per primitive |

---

## Appendix: Full Skill → Primitive Mapping

<details>
<summary>Counting & Number Recognition</summary>

| Skill | Difficulty | Current Mastery | Primary Primitive | Secondary |
|---|---|---|---|---|
| Count and recognize numbers 0-10 | 1-4 | 74.3% | `counting-board` | `number-sequencer` |
| Write numbers 0-10 | 2-4 | 67.0% | `number-sequencer` | — |
| Count, recognize, write numbers 11-20 | 3-5 | — | `number-sequencer` | `base-ten-blocks` |
| Sequential understanding through 20 | 4-6 | — | `number-sequencer` | `number-line` |
| Count by 2s and 5s up to 50 | 5-7 | 93.2% | `skip-counting-runner` | — |
| Count and recognize 21-100 | 6-8 | 32.0% | `number-sequencer` | — |
| Count forward from any number to 100 | 7-9 | — | `number-sequencer` | — |
</details>

<details>
<summary>Object Counting</summary>

| Skill | Difficulty | Current Mastery | Primary Primitive | Secondary |
|---|---|---|---|---|
| Count up to 5 objects (1:1 correspondence) | 1-3 | 67.0% | `counting-board` | — |
| Count up to 10 objects (various arrangements) | 2-4 | 9.5% | `counting-board` | — |
| Counting conservation | 3-5 | 76.0% | `counting-board` | — |
| Count up to 20 objects | 4-6 | 81.5% | `counting-board` | — |
| Compare quantities, count backwards | 5-7 | — | `comparison-builder` | `counting-board` |
| Count in groups of 2 | 6-8 | 6.0% | `skip-counting-runner` | `counting-board` |
| Count visible + hidden objects | 7-9 | — | `number-bond` | `counting-board` |
</details>

<details>
<summary>Comparison & Inequalities</summary>

| Skill | Difficulty | Current Mastery | Primary Primitive | Secondary |
|---|---|---|---|---|
| Compare groups up to 5 (more/less/equal) | 1-3 | 20.0% | `comparison-builder` | — |
| Compare groups 6-10 | 2-4 | — | `comparison-builder` | — |
| Compare written numerals 1-10 | 3-5 | — | `comparison-builder` | `number-line` |
| Order 3+ numbers least→greatest | 4-6 | — | `comparison-builder` | `number-sequencer` |
| Use < and > symbols up to 10 | 5-7 | 66.0% | `comparison-builder` | — |
| One more / one less up to 20 | 6-8 | 69.1% | `comparison-builder` | `number-sequencer` |
| Compare numbers 11-20 with place value | 7-9 | — | `comparison-builder` | `base-ten-blocks` |
</details>

<details>
<summary>Ordinal Numbers</summary>

| Skill | Difficulty | Current Mastery | Primary Primitive |
|---|---|---|---|
| Recognize ordinal positions 1st-5th | 2-4 | 20.0% | `ordinal-line` |
| Match ordinal words to symbols | 3-5 | 58.0% | `ordinal-line` |
| Apply ordinals to daily routines | 3-5 | 14.0% | `ordinal-line` |
| Extend to 10th position | 4-6 | — | `ordinal-line` |
| Compare relative positions | 5-7 | 12.0% | `ordinal-line` |
| Create sequences with ordinals | 6-8 | 14.0% | `ordinal-line` |
| Ordinal word problems | 7-9 | 76.0% | `ordinal-line` |
</details>

<details>
<summary>Sorting & Classification</summary>

| Skill | Difficulty | Current Mastery | Primary Primitive |
|---|---|---|---|
| Sort by one attribute | 1-3 | — | `sorting-station` |
| Count/compare within categories | 2-4 | — | `sorting-station` |
| Sort into 3 categories | 3-5 | — | `sorting-station` |
| Classify by two attributes | 4-6 | — | `sorting-station` |
| Tally marks and pictographs | 4-7 | — | `sorting-station` |
| Sort by function, create systems | 5-7 | — | `sorting-station` |
| Reclassify, odd-one-out | 6-8 | — | `sorting-station` |
</details>

<details>
<summary>Addition</summary>

| Skill | Difficulty | Current Mastery | Primary Primitive | Secondary |
|---|---|---|---|---|
| Addition within 5 with objects | 1-3 | — | `addition-subtraction-scene` | `counting-board` |
| Addition within 5 with drawings/number lines | 2-4 | — | `addition-subtraction-scene` | `number-line` |
| Express addition within 5 as equations | 3-5 | 40.0% | `addition-subtraction-scene` | `number-bond` |
| Decompose numbers up to 5 | 4-6 | — | `number-bond` | — |
| Addition word problems within 10 | 5-7 | 60.4% | `addition-subtraction-scene` | `ten-frame` |
| Multiple strategies within 10 | 6-8 | — | `ten-frame` | `addition-subtraction-scene` |
| Real-world addition stories | 7-9 | — | `addition-subtraction-scene` | — |
</details>

<details>
<summary>Subtraction</summary>

| Skill | Difficulty | Current Mastery | Primary Primitive | Secondary |
|---|---|---|---|---|
| Subtraction within 5 with objects | 1-3 | — | `addition-subtraction-scene` | `counting-board` |
| Decompose for subtraction | 2-4 | 9.5% | `number-bond` | — |
| Subtraction word problems within 5 | 3-5 | — | `addition-subtraction-scene` | — |
| Subtraction within 10 with ten frames | 4-6 | — | `ten-frame` | `addition-subtraction-scene` |
| Real-world subtraction within 10 | 5-7 | 9.5% | `addition-subtraction-scene` | — |
| Missing numbers in subtraction | 6-8 | — | `number-bond` | — |
| Addition/subtraction as inverse ops | 7-9 | — | `number-bond` | — |
</details>

<details>
<summary>Fluency (within 5)</summary>

| Skill | Difficulty | Current Mastery | Primary Primitive | Secondary |
|---|---|---|---|---|
| Count forward/backward within 5 | 1-3 | — | `number-sequencer` | — |
| Add/subtract within 3 | 2-4 | — | `number-bond` | `addition-subtraction-scene` |
| Match visuals to equations within 5 | 3-5 | — | `addition-subtraction-scene` | — |
| Fluency within 5 | 4-6 | — | `number-bond` | `ten-frame` |
| Missing number problems within 5 | 5-7 | — | `number-bond` | — |
| Fact families within 5 | 6-8 | — | `number-bond` | — |
| Word problems within 5 | 7-9 | — | `addition-subtraction-scene` | — |
</details>
