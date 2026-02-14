# K-5 Mathematics Visual Primitives — Phase 2
## Product Requirements Document — Lumina Platform

### Overview

This document defines Phase 2 interactive visual primitives for K-5 mathematics education within the Lumina platform. Phase 1 established 23 math primitives covering number sense through calculus preparation. **Phase 2 addresses the gaps uncovered in K-5 delivery** — the grade band where foundational mathematical thinking is built and where the platform's existing primitives are thinnest.

The Phase 1 math PRD was written as a technical specification — configuration tables, TypeScript interfaces, K-12+ breadth. It predated the platform's multimodal capabilities: AI tutoring scaffolds, Gemini-native content generation, image generation, and the evaluation system. **Phase 2 adopts the Lumina-native PRD format** established by the vehicles/flight primitives, giving every primitive the full treatment: wonder-driven pedagogy, grade-by-grade learning progressions, four-phase interaction models, Gemini JSON schemas, AI tutoring scaffolds, image generation hooks, and evaluation metrics.

Phase 2 has two tracks:

1. **12 new primitives** filling critical K-5 gaps — the manipulatives and tools every elementary math classroom uses that the platform currently lacks (ten frames, pattern blocks, clocks, rulers, money, regrouping)
2. **8 existing primitive upgrades** — bringing Phase 1 primitives up to Lumina-native standard with interaction phases, grade-band adaptivity, challenges, and enhanced interactivity

When a kindergartner drags counters onto a ten frame, or a third-grader unfolds a cube into its net, or a fifth-grader measures angles with a virtual protractor — the AI tutor sees what they're doing, speaks at the right moment, and scaffolds understanding with progressive hints. **Every primitive is a conversation between student, manipulative, and tutor.**

### Design Principles

1. **Hands That Think**: Elementary math is built through touch — snapping cubes, folding paper, stacking blocks, drawing lines. Every primitive must feel like a physical manipulative translated into light, not a textbook page with buttons. Drag, snap, stack, fold, rotate, pour.
2. **See the Pattern**: Mathematics is the science of patterns. Every primitive should make patterns visible — the rhythm of skip counting, the symmetry of equivalent fractions, the predictability of place value, the regularity of geometric tilings. When a child sees the pattern, they own the concept.
3. **Real Numbers, Real Stuff**: When a child counts money, they count real coins. When they measure, they measure real objects. When they tell time, it's a real clock. Abstract math grows from concrete experience — every primitive anchors in physical reality before lifting to abstraction.
4. **Wonder-Driven**: Start from the questions kids actually ask — "Why is a quarter worth more than a nickel if it's not that much bigger?", "How do you know it's 3:45 without counting every minute?", "Is there a pattern that goes on forever?" — and build primitives that answer through exploration.
5. **Gemini-Native Generation**: Every primitive schema is designed for single-shot Gemini API generation via JSON mode. Problem contexts, word problem scenarios, measurement challenges, and pattern sequences are all AI-generated from structured prompts with grade-band awareness.
6. **AI Tutoring at Every Moment**: The AI tutor sees what the student is doing in real-time — which blocks they've placed, what time they've set, how they've partitioned the fraction — and responds like a real teacher: celebrating discoveries, asking the next question, catching misconceptions before they solidify.
7. **Evaluation Hooks**: Every interactive primitive exposes evaluation metrics that capture student interaction data for the backend evaluation and competency services.
8. **Cross-Primitive Connections**: Math concepts are interconnected. Fractions connect to decimals connect to percents. Arrays connect to area models connect to multiplication. Primitives should reference and bridge to related primitives wherever natural.
9. **State Serialization**: All primitives serialize to JSON for problem authoring, student response capture, and session replay.

---

## Current State Audit

### Phase 1 Primitives — K-5 Relevant

| Primitive | K-5 Grade Coverage | Has Evaluation | Has AI Scaffold | Interactivity Level | Gap |
|-----------|-------------------|----------------|-----------------|--------------------|----|
| `number-line` | K-8 | No | Yes (catalog) | **Display only** — no drag, no zoom, no operations | Needs full rebuild: drag-to-plot, jump animations, operations-as-movement |
| `base-ten-blocks` | K-5 | No | Yes (catalog) | **Display only** — hover effects only, no drag, no regrouping | Needs full rebuild: drag blocks, snap to columns, animated regrouping |
| `place-value-chart` | 3-6 | Yes | Yes (catalog) | Interactive — digit editing, expanded form | Good foundation, needs grade-band modes |
| `fraction-bar` | 2-5 | Yes | Yes (catalog) | Interactive — click to shade, partition editing | Strong implementation, model for others |
| `fraction-circles` | 2-5 | Yes | Yes (catalog) | Interactive — shade sections, comparison | Good, needs equivalence linking |
| `area-model` | 3-Algebra | Yes | Yes (catalog) | Interactive — student enters products, validation | Strong implementation with shadcn/ui |
| `array-grid` | 2-5 | Yes | Yes (catalog) | Interactive — row/column building, highlighting | Good, needs skip counting animation |
| `tape-diagram` | 1-Algebra | Yes | Yes (catalog) | Interactive — segment clicking, phases | Strong implementation |
| `factor-tree` | 4-6 | Yes | Yes (catalog) | Interactive — splitting nodes, validation | Good implementation |
| `bar-model` | K-5 | No | Yes (catalog) | Display — comparative bars | Thin, overlaps with tape-diagram |
| `balance-scale` | 1-8 | No | Yes (catalog) | Interactive — operations, drag blocks | Good interaction, needs evaluation |
| `function-machine` | 3-8 | No | Yes (catalog) | Interactive — input/output, rule guessing | Good, needs evaluation |
| `geometric-shape` | K-5 | No | Yes (catalog) | Display — labeled properties | Needs rebuild: construction tools, measurement |
| `coordinate-graph` | 5-Precalc | No | Yes (catalog) | Interactive — plotting, equations | Good but advanced for K-5 |
| `ratio-table` | 5-7 | Yes | Yes (catalog) | Interactive — scaling, challenges | Strong implementation |
| `double-number-line` | 5-7 | Yes | Yes (catalog) | Interactive — problem-solving phases | Strong implementation |
| `percent-bar` | 5-8 | Yes | Yes (catalog) | Interactive — shading, phases | Strong implementation |
| `dot-plot` | 2-7 | No | Yes (catalog) | Interactive — add/remove points, statistics | Good, needs evaluation |
| `histogram` | 6-Statistics | No | Yes (catalog) | Interactive — bin width, curves | Good, mostly grade 6+ |
| `two-way-table` | 7-Statistics | No | Yes (catalog) | Interactive — cells, Venn toggle | Beyond K-5 scope |
| `slope-triangle` | 7-Algebra | No | Yes (catalog) | Interactive — drag, resize | Beyond K-5 scope |
| `systems-equations-visualizer` | 8-Algebra | No | Yes (catalog) | Interactive — methods, animation | Beyond K-5 scope |
| `matrix-display` | 7-Algebra 2 | No | Yes (catalog) | Interactive — operations, steps | Beyond K-5 scope |

### Available Multimodal Infrastructure

| Capability | Service | Current Usage | Phase 2 Math Usage |
|-----------|---------|---------------|-------------------|
| **AI Tutoring Scaffold** | `TutoringScaffold` in catalog → `useLuminaAI` hook → Gemini Live WebSocket → real-time speech | `phonics-blender`, `fraction-bar`, literacy & vehicle primitives | Context-aware tutoring at every pedagogical moment — the AI sees counters on ten frames, clock hand positions, coin selections, and responds with progressive scaffolding. See [ADDING_TUTORING_SCAFFOLD.md](ADDING_TUTORING_SCAFFOLD.md). |
| **Image Generation** | Gemini image generation | `image-panel`, `species-profile`, `machine-profile` | Word problem illustrations, real-world measurement contexts, pattern examples |
| **Drag-and-Drop** | React DnD patterns | `word-builder`, engineering & vehicle primitives | Counter placement, block manipulation, coin dragging, shape construction |
| **Rich Evaluation** | `usePrimitiveEvaluation` + metrics system | 10 of 23 math primitives, engineering, literacy | All 12 new primitives + 8 upgraded primitives |
| **Animation/Simulation** | Canvas/SVG animation | Engineering physics, vehicle simulations | Regrouping animations, skip counting jumps, clock hand rotation, pattern extension |


---

## TRACK 1: New Primitives

---

## DOMAIN 1: Foundational Number Sense (K-2)

### 1. `ten-frame` — The Gateway to Number Sense

**Purpose:** The ten frame is the single most important K-1 manipulative — a 2×5 grid where students place counters to build numbers 0-20. It builds subitizing (instant recognition of quantity), addition/subtraction strategies, and the critical understanding that 10 is the foundation of our number system. When a child sees 7 on a ten frame, they instantly see "3 away from 10" — the birth of number sense.

**Grade Band:** K-2

**Cognitive Operation:** Subitizing, composing/decomposing numbers, addition/subtraction strategies, making ten

**Multimodal Features:**
- **Visual:** 2×5 grid with rounded cells. Counter tokens in configurable colors (red/yellow for two-color counters). Fill animation when counters are placed. "Full frame" celebration glow when 10 is reached. Double ten frame mode (side-by-side) for numbers 11-20. Dot pattern overlay option for subitizing practice.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees counter count, placement positions, and current challenge. Builds number sense language: "I see 6 counters. How many empty spaces? That means 6 and ___ make 10!" Celebrates make-ten discoveries, coaches addition strategies ("Can you move some counters from the second frame to fill the first one?"), and guides subitizing ("Quick — how many do you see? Don't count!").
- **Image Generation:** AI-generated real-world groupings of 10 (egg cartons, muffin tins, bowling pins) to connect ten frames to daily life.
- **Interactive:** Drag counters onto frame cells. Tap to place/remove. Two-color counter flipping (red ↔ yellow for decomposition). Double frame toggle. "Flash" mode for subitizing (shows briefly, then hides). Shake to clear.

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| K | Place counters to show numbers 1-10. "How many?" "How many empty?" |
| K | Subitizing: see the quantity without counting one-by-one |
| 1 | Make 10: "7 + ___ = 10" using the empty spaces as the answer |
| 1 | Addition with ten frame: 8 + 5 → fill the frame to 10, then 3 more = 13 |
| 2 | Double ten frame for teen numbers. Subtraction as "taking away" counters |

**Interaction Model:**
- Phase 1 (Build): Place counters to show a given number. "Show me 7."
- Phase 2 (Subitize): Counters flash briefly — identify the quantity without counting.
- Phase 3 (Make Ten): Given a partially filled frame, determine what's needed to make 10.
- Phase 4 (Operate): Use double ten frames for addition/subtraction of numbers to 20.

**Schema:**
```json
{
  "primitiveType": "ten-frame",
  "mode": "string (single | double)",
  "counters": {
    "count": "number (0-20)",
    "color": "string (red | yellow | blue | green)",
    "positions": "number[] (cell indices 0-9 or 0-19 for double)"
  },
  "twoColorMode": {
    "enabled": "boolean",
    "color1Count": "number",
    "color2Count": "number",
    "color1": "string",
    "color2": "string"
  },
  "challenges": [
    {
      "id": "string",
      "type": "string (build | subitize | make_ten | add | subtract)",
      "instruction": "string (e.g., 'Show me 7 on the ten frame')",
      "targetCount": "number",
      "flashDuration": "number | null (ms, for subitize mode)",
      "hint": "string",
      "narration": "string (AI tutor context for this challenge)"
    }
  ],
  "showOptions": {
    "showCount": "boolean (display number below frame)",
    "showEquation": "boolean (display equation being modeled)",
    "showEmptyCount": "boolean (show how many spaces are empty)",
    "allowFlip": "boolean (enable two-color counter flipping)"
  },
  "imagePrompt": "string | null (real-world groups of 10 for context)",
  "gradeBand": "K | 1-2"
}
```

**Gemini Generation Notes:** At grade K, generate simple "show me" and subitizing challenges. Always include the `narration` field — these feed into the AI tutor's context and should be conversational ("Ooh, the student is building 7. When they're done, ask them how many empty spaces they see."). At grades 1-2, generate addition/subtraction scenarios with story contexts ("Maria has 8 stickers. Her friend gives her 5 more. Use the ten frames to find the total."). Two-color mode should decompose numbers: "Show 7 as 5 red and 2 yellow."

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'ten-frame'`
- `challengesCompleted` / `challengesTotal`
- `subitizeAccuracy` (correct / total flash challenges)
- `subitizeAverageTime` (ms to respond in flash mode)
- `makeTenCorrect` / `makeTenTotal`
- `usedMakeTenStrategy` (boolean — in addition, did they fill to 10 first)
- `counterPlacementEfficiency` (did they place without removing/replacing)
- `twoColorDecompositionsExplored` (count of different decompositions tried)
- `attemptsCount`

---

### 2. `counting-board` — Subitizing, Counting & Early Number

**Purpose:** A flexible counting workspace with draggable objects, configurable arrangements (scattered, lined up, grouped), and counting strategies. Before children can add, they must count — and before they count, they must subitize (instantly recognize small quantities). This primitive trains the progression from "count all" to "count on" to "just know" that underlies all arithmetic.

**Grade Band:** K-1

**Cognitive Operation:** One-to-one correspondence, cardinality, subitizing, counting strategies

**Multimodal Features:**
- **Visual:** Workspace with draggable countable objects (bears, apples, stars, blocks — kid-relevant icons). Arrangement modes: scattered (harder), lined (easier), grouped (strategic). Count highlight animation — objects light up as counted. Running total display. "How many?" prompt card.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees object count, arrangement, and student counting actions. Coaches counting: "Touch each bear as you count. One... two... three... how many bears altogether?" Corrects double-counting: "Oops, you counted that one twice! Move counted bears to one side." Celebrates cardinality: "Yes! There are 5 bears. 5 is the last number you said!"
- **Interactive:** Drag objects into workspace. Tap to count (objects animate). Drag to rearrange. Toggle arrangement modes. Grouping circles (draw a circle to group objects).

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| K (early) | Count objects 1-10 with one-to-one correspondence (tap each one) |
| K (mid) | Subitize small groups (1-5): instant recognition without counting |
| K (late) | Count to 20. "How many?" after counting (cardinality principle) |
| 1 | Count on from a known quantity. Group and count by 2s, 5s, 10s |

**Interaction Model:**
- Phase 1 (Count): Tap objects one at a time. Each object lights up and the count increments. "How many altogether?"
- Phase 2 (Subitize): Small groups (1-5) flash briefly. Name the quantity without counting.
- Phase 3 (Organize): Scattered objects — drag them into groups to count more efficiently.
- Phase 4 (Count On): "There are 5 bears in this group. Count on to find the total."

**Schema:**
```json
{
  "primitiveType": "counting-board",
  "objects": {
    "type": "string (bears | apples | stars | blocks | fish | butterflies | custom)",
    "count": "number (1-30)",
    "arrangement": "string (scattered | line | groups | circle)",
    "groupSize": "number | null (for grouped arrangement)"
  },
  "challenges": [
    {
      "id": "string",
      "type": "string (count_all | subitize | count_on | group_count | compare)",
      "instruction": "string",
      "targetAnswer": "number",
      "flashDuration": "number | null (ms for subitize)",
      "startFrom": "number | null (for count_on)",
      "hint": "string",
      "narration": "string"
    }
  ],
  "showOptions": {
    "showRunningCount": "boolean",
    "showGroupCircles": "boolean",
    "highlightOnTap": "boolean",
    "showLastNumber": "boolean (emphasize cardinality)"
  },
  "imagePrompt": "string | null (context illustration)",
  "gradeBand": "K | 1"
}
```

**Gemini Generation Notes:** At early K, use small counts (1-5) with scattered arrangement and concrete objects (bears, apples). As confidence builds, increase to 6-10, then 11-20. Always use objects kids recognize. For subitizing, use common dot patterns (dice, domino). For count-on challenges, always establish the starting group visually before asking for the total.

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'counting-board'`
- `countingAccuracy` (correct final count / total challenges)
- `oneToOneCorrespondence` (boolean — did they tap each object exactly once)
- `subitizeAccuracy` / `subitizeSpeed`
- `countOnUsed` (boolean — did they count on from a group instead of starting from 1)
- `groupingUsed` (boolean — did they organize objects before counting)
- `cardinalityUnderstood` (boolean — did they state the total as "how many")
- `attemptsCount`

---

### 3. `pattern-builder` — The Seeds of Algebraic Thinking

**Purpose:** Patterns are where algebra begins — long before variables and equations, children recognize and extend repeating and growing patterns. This primitive lets students build, identify, extend, and create patterns with colors, shapes, sounds, and numbers. From ABAB to growing sequences to function rules, pattern recognition is the throughline from kindergarten to calculus.

**Grade Band:** K-3

**Cognitive Operation:** Pattern recognition, extension, creation, generalization, prediction

**Multimodal Features:**
- **Visual:** Pattern strip with configurable tokens (colored blocks, shapes, emoji, numbers). Pattern unit highlighting (bracket showing the repeating core). Growing pattern visualization with step numbers. Rule display (once discovered). "What comes next?" prediction zone.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees the pattern sequence, student's extension attempts, and pattern type. Coaches pattern finding: "I see red, blue, red, blue... what do you think comes next?" Guides core identification: "Can you find the part that keeps repeating?" Celebrates pattern creation: "You made your own pattern! Can you describe its rule?" Bridges to math: "Your pattern goes 2, 4, 6, 8... that's counting by 2s!"
- **Interactive:** Drag tokens to build patterns. Tap prediction zone to extend. Pattern core highlighting with drag selection. Create-your-own mode. Audio pattern mode (clap-snap-clap-snap). Growing pattern with number labels.

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| K | AB, AAB, ABB repeating patterns with colors/shapes. Identify and extend. |
| 1 | ABC, AABB patterns. Create original patterns. Translate between representations (color pattern → shape pattern with same structure) |
| 2 | Growing patterns: 1, 3, 5, 7... and 2, 4, 8, 16... Describe the rule in words |
| 3 | Number patterns with rules. "Add 3 each time." Input-output pattern connection to function machines |

**Interaction Model:**
- Phase 1 (Copy): Given a pattern, continue it by dragging the correct next tokens.
- Phase 2 (Identify): Given a long pattern, find and highlight the repeating core unit.
- Phase 3 (Create): Build an original pattern and describe its rule.
- Phase 4 (Translate): Given a color pattern (red-blue-red-blue), create the same pattern with shapes (circle-square-circle-square).

**Schema:**
```json
{
  "primitiveType": "pattern-builder",
  "patternType": "string (repeating | growing | number)",
  "sequence": {
    "given": ["string (tokens shown to student)"],
    "hidden": ["string (tokens student must fill in)"],
    "core": ["string (the repeating unit, for repeating patterns)"],
    "rule": "string | null (e.g., 'add 3 each time' for growing patterns)"
  },
  "tokens": {
    "available": ["string (tokens the student can use)"],
    "type": "string (colors | shapes | numbers | emoji | mixed)",
    "customIcons": "boolean"
  },
  "challenges": [
    {
      "id": "string",
      "type": "string (extend | identify_core | create | translate | find_rule)",
      "instruction": "string",
      "answer": ["string"] | "string",
      "hint": "string",
      "narration": "string"
    }
  ],
  "showOptions": {
    "showCore": "boolean (highlight the repeating unit)",
    "showStepNumbers": "boolean (for growing patterns)",
    "showRule": "boolean",
    "audioMode": "boolean (play pattern as sounds)"
  },
  "translationTarget": {
    "enabled": "boolean",
    "sourceType": "string (colors)",
    "targetType": "string (shapes)",
    "mapping": "object (e.g., {red: 'circle', blue: 'square'})"
  },
  "imagePrompt": "string | null (real-world pattern context: brick wall, beaded necklace, tiled floor)",
  "gradeBand": "K-1 | 2-3"
}
```

**Gemini Generation Notes:** At K-1, use 2-element repeating patterns (AB, AAB, ABB) with bright colors or familiar shapes. Include the `narration` field with conversational prompts. At grades 2-3, generate growing number patterns with clear rules and connect to skip counting and multiplication. Always include a real-world `imagePrompt` showing the pattern in nature or daily life (brick patterns, flower petals, tile floors).

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'pattern-builder'`
- `extensionsCorrect` / `extensionsTotal`
- `coreIdentifiedCorrectly` (boolean — did they find the repeating unit)
- `ruleArticulated` (boolean — could they describe the rule)
- `patternCreated` (boolean — did they build an original valid pattern)
- `translationCorrect` (boolean — same structure in different representation)
- `patternTypesExplored` (count: repeating, growing, number)
- `attemptsCount`

---

### 4. `skip-counting-runner` — Rhythmic Number Patterns

**Purpose:** Skip counting is the bridge between counting and multiplication — when a child counts 5, 10, 15, 20, they're doing 5×1, 5×2, 5×3, 5×4 without knowing it. This primitive turns skip counting into a rhythmic, visual, physical experience: an animated character jumps along a number line in equal leaps, landing on the multiples. The rhythm of the jumps, the pattern of the highlighted numbers, and the growing array that builds alongside create multiple representations of the same multiplicative structure.

**Grade Band:** 1-3

**Cognitive Operation:** Skip counting fluency, multiplication foundation, pattern recognition, multiple representations

**Multimodal Features:**
- **Visual:** Number line with animated character making equal jumps. Landing spots glow and persist. Jump arc trails. Parallel array that builds a new row with each jump (visual link to multiplication). Rhythm pulse on each landing (visual beat). Number pattern display showing the sequence.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees skip count value, current position, landing accuracy, and array state. Counts along rhythmically: "5... 10... 15... what comes next?" Connects to multiplication: "You landed on 15 — that's 3 jumps of 5. Three fives!" Coaches pattern recognition: "Look at the ones digits: 5, 0, 5, 0... do you see a pattern?" Celebrates streaks.
- **Interactive:** Tap/click to make the character jump. Choose skip count value (2, 3, 4, 5, 10, custom). Speed control. Prediction mode (tap where you think the next landing will be before the jump). Array toggle. "Catch the number" game mode.

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| 1 | Skip count by 2s, 5s, and 10s. Watch the jumps, say the numbers |
| 2 | Skip count by 3s, 4s. Predict the next landing. Notice patterns in digits |
| 2 | Connect to arrays: 4 jumps of 3 = 4 rows of 3 = 12 |
| 3 | Skip count as multiplication fact practice. Backward skip counting (division preview) |

**Interaction Model:**
- Phase 1 (Watch): The character jumps automatically. Student says each number aloud (AI listens or student taps).
- Phase 2 (Jump): Student taps to make each jump. Must land on correct multiples.
- Phase 3 (Predict): Number line labels are hidden. Student predicts each landing spot before jumping.
- Phase 4 (Connect): Array builds alongside. Student states the multiplication fact for each position.

**Schema:**
```json
{
  "primitiveType": "skip-counting-runner",
  "skipValue": "number (2, 3, 4, 5, 10, or custom)",
  "startFrom": "number (default 0)",
  "endAt": "number (e.g., 50)",
  "direction": "string (forward | backward)",
  "character": {
    "type": "string (frog | kangaroo | rabbit | rocket | custom)",
    "imagePrompt": "string"
  },
  "challenges": [
    {
      "id": "string",
      "type": "string (count_along | predict | fill_missing | find_skip_value | connect_multiplication)",
      "instruction": "string",
      "hiddenPositions": "number[] (positions where labels are hidden for prediction)",
      "targetFact": "string | null (e.g., '4 × 5 = 20' for multiplication connection)",
      "hint": "string",
      "narration": "string"
    }
  ],
  "showOptions": {
    "showArray": "boolean (parallel array visualization)",
    "showJumpArcs": "boolean",
    "showEquation": "boolean (display n × skipValue = position)",
    "showDigitPattern": "boolean (highlight patterns in ones/tens digits)",
    "autoPlay": "boolean (character jumps automatically vs student-triggered)"
  },
  "gameMode": {
    "enabled": "boolean",
    "type": "string (catch_the_number | fill_the_gaps | speed_count)",
    "timeLimit": "number | null (seconds)"
  },
  "gradeBand": "1-2 | 2-3"
}
```

**Gemini Generation Notes:** Always pair skip counting with a fun character and story context. At grade 1, stick to 2s, 5s, and 10s with `autoPlay: true` for the first phase. At grade 2-3, include prediction challenges and multiplication connections. Backward skip counting is division preview — generate these for grade 3. The `narration` fields should be rhythmic and encouraging.

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'skip-counting-runner'`
- `landingsCorrect` / `landingsTotal` (in jump mode)
- `predictionsCorrect` / `predictionsTotal`
- `skipValuesExplored` (which skip values practiced)
- `backwardCountingAttempted` (boolean)
- `multiplicationConnectionMade` (boolean — stated the fact)
- `patternIdentified` (boolean — noticed digit pattern)
- `longestCorrectStreak`
- `attemptsCount`

---

## DOMAIN 2: Operations & Computation (1-4)

### 5. `regrouping-workbench` — Addition & Subtraction with Carrying/Borrowing

**Purpose:** The moment a child encounters 27 + 15 and realizes they can't just add the ones (7+5=12 — that's too many for the ones place!), they need regrouping. This primitive makes the "carry" and "borrow" of standard algorithms visible and manipulable: 12 ones become 1 ten and 2 ones through animated regrouping. The base-ten blocks physically break apart and recombine while the written algorithm updates in parallel.

**Grade Band:** 1-4

**Cognitive Operation:** Place value understanding, regrouping/trading, standard algorithm connection, multi-digit arithmetic

**Multimodal Features:**
- **Visual:** Split view: base-ten blocks workspace (left) and written algorithm (right), synchronized. Regrouping animation: 10 ones cubes merge into a tens rod (or vice versa) with satisfying snap animation. Place value columns with headers. Carry/borrow digits appear in the algorithm as the student regroups blocks. Step-by-step highlighting.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees current operation, block state, algorithm step, and whether regrouping is needed. Guides the critical moment: "7 plus 5 is 12. Can you fit 12 ones cubes in the ones column? What can you do?" Connects blocks to algorithm: "See how the 1 you carried is the tens rod you just made?" Catches common errors: "Wait — you subtracted the smaller from the larger in the ones place, but that's not how borrowing works."
- **Interactive:** Drag base-ten blocks to add. Tap groups of 10 ones to regroup into a ten. Tap a ten to break into 10 ones. Written algorithm updates in parallel. Step-through mode or free exploration.

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| 1 | Two-digit + one-digit with no regrouping, then with regrouping (14 + 8) |
| 2 | Two-digit + two-digit with regrouping (27 + 45). Subtraction with borrowing (42 - 17) |
| 3 | Three-digit addition/subtraction with multiple regroups. Connection to standard algorithm |
| 4 | Multi-digit operations fluency. Decimal addition/subtraction with regrouping |

**Interaction Model:**
- Phase 1 (Explore): Given an addition problem and pre-placed blocks, combine them. Discover that 10+ ones need regrouping.
- Phase 2 (Regroup): Tap 10 ones cubes to trade for a tens rod. See the carry appear in the written algorithm.
- Phase 3 (Solve): Work through the full algorithm using blocks, regrouping as needed at each place.
- Phase 4 (Connect): Given only the written algorithm, explain each step by pointing to what would happen with blocks.

**Schema:**
```json
{
  "primitiveType": "regrouping-workbench",
  "operation": "string (addition | subtraction)",
  "operand1": "number",
  "operand2": "number",
  "maxPlace": "string (tens | hundreds | thousands)",
  "decimalMode": "boolean (false for grades 1-3, true for grade 4+)",
  "initialState": {
    "blocksPlaced": "boolean (pre-populate blocks or start empty)",
    "algorithmVisible": "boolean"
  },
  "regroupingSteps": [
    {
      "place": "string (ones | tens | hundreds)",
      "type": "string (carry | borrow)",
      "fromValue": "number",
      "toValue": "number",
      "narration": "string (AI tutor explanation for this step)"
    }
  ],
  "challenges": [
    {
      "id": "string",
      "problem": "string (e.g., '27 + 45')",
      "requiresRegrouping": "boolean",
      "regroupCount": "number (how many times regrouping is needed)",
      "hint": "string",
      "narration": "string"
    }
  ],
  "showOptions": {
    "showAlgorithm": "boolean (written algorithm panel)",
    "showCarryBorrow": "boolean (carry/borrow digits in algorithm)",
    "showPlaceColumns": "boolean",
    "animateRegrouping": "boolean",
    "stepByStepMode": "boolean (guided vs free exploration)"
  },
  "wordProblemContext": {
    "enabled": "boolean",
    "story": "string (e.g., 'A farmer has 27 apples and picks 45 more...')",
    "imagePrompt": "string"
  },
  "gradeBand": "1-2 | 3-4"
}
```

**Gemini Generation Notes:** Always generate problems that require regrouping — that's the whole point of this primitive. At grades 1-2, stick to two-digit problems with one regroup. At grades 3-4, use three-digit problems with multiple regroups and include word problem contexts. The `regroupingSteps` narrations should be conversational: "Whoa, 7 + 5 = 12! That's more than 9. Time to trade 10 ones for 1 ten!" For subtraction, explain borrowing as "trading a ten for 10 ones to help the ones place."

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'regrouping-workbench'`
- `problemsCompleted` / `problemsTotal`
- `regroupingCorrect` / `regroupingTotal` (each regroup step)
- `algorithmConnectionMade` (boolean — linked block action to written step)
- `incorrectRegroupAttempts` (count of wrong trades)
- `stepByStepUsed` (boolean — used guided mode)
- `wordProblemContextEngaged` (boolean)
- `averageTimePerProblem`
- `attemptsCount`

---

### 6. `multiplication-explorer` — From Arrays to Algorithms

**Purpose:** Multiplication is the biggest conceptual leap in elementary math — the transition from additive to multiplicative thinking. This primitive provides a unified workspace connecting the five key representations of multiplication: equal groups → arrays → repeated addition → skip counting → area model. Students see that 3 × 4 means "3 groups of 4" AND "a 3×4 array" AND "4 + 4 + 4" AND "skip count by 4 three times" AND "a rectangle that's 3 by 4." The AI tutor bridges between representations.

**Grade Band:** 2-4

**Cognitive Operation:** Multiplicative thinking, multiple representation linking, fact fluency, commutative property

**Multimodal Features:**
- **Visual:** Multi-panel view showing the same fact across representations: equal groups (circles with dots), array (rows × columns), repeated addition equation, number line with jumps, and area model grid. All synchronized — changing the fact updates all panels. Commutative property toggle (3×4 ↔ 4×3) with animation showing the array rotate. Fact family display.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees current fact, active representation, and student interactions. Bridges: "You showed 3 groups of 4. Now look at the array — 3 rows with 4 in each row. Same thing!" Coaches commutative property: "Flip the array sideways — 4 rows of 3. Is the total the same?" Builds fact fluency: "You've figured out 3×4=12 three different ways. You really know this one!"
- **Interactive:** Toggle between representation panels. Build equal groups by dragging objects. Resize array by dragging edges. Step through repeated addition. Connect to skip counting runner. Fact family display. Fact quiz mode.

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| 2 | Equal groups and arrays for × 2, × 5, × 10. "How many in all?" |
| 3 | All representations linked for facts through 10×10. Commutative property. Distributive property introduction (break hard facts into easier ones: 7×8 = 7×5 + 7×3) |
| 3 | Fact fluency with timed practice. Missing factor problems |
| 4 | Multi-digit × single-digit with area model connection. Division as inverse |

**Interaction Model:**
- Phase 1 (Groups): Build equal groups for a given fact. Count to find the product.
- Phase 2 (Array): Build the array. Notice rows × columns = total.
- Phase 3 (Connect): Same fact shown in all 5 representations simultaneously. Student identifies the connection.
- Phase 4 (Strategy): Use known facts to derive unknown ones (distributive property: 7×6 = 5×6 + 2×6).

**Schema:**
```json
{
  "primitiveType": "multiplication-explorer",
  "fact": {
    "factor1": "number",
    "factor2": "number",
    "product": "number"
  },
  "representations": {
    "equalGroups": "boolean",
    "array": "boolean",
    "repeatedAddition": "boolean",
    "numberLine": "boolean",
    "areaModel": "boolean"
  },
  "activeRepresentation": "string (groups | array | repeated_addition | number_line | area_model | all)",
  "challenges": [
    {
      "id": "string",
      "type": "string (build | connect | commutative | distributive | missing_factor | fluency)",
      "instruction": "string",
      "targetFact": "string (e.g., '3 × 4 = 12')",
      "hiddenValue": "string | null (factor1 | factor2 | product)",
      "timeLimit": "number | null (seconds, for fluency mode)",
      "hint": "string",
      "narration": "string"
    }
  ],
  "showOptions": {
    "showProduct": "boolean",
    "showFactFamily": "boolean (×/÷ relationship)",
    "showCommutativeFlip": "boolean",
    "showDistributiveBreakdown": "boolean"
  },
  "imagePrompt": "string | null (real-world multiplication context: rows of desks, packs of crayons, egg cartons)",
  "gradeBand": "2-3 | 3-4"
}
```

**Gemini Generation Notes:** At grade 2, focus on ×2, ×5, ×10 with equal groups and arrays. Always use concrete contexts kids know (packs of gum = 5 per pack, wheels on cars = 4 per car). At grade 3, include all facts through 10×10 and emphasize strategy (known facts → unknown facts). At grade 4, connect to multi-digit multiplication via area model. The distributive property should feel like a "trick" not a rule: "Don't know 7×8? You know 5×8=40 and 2×8=16. Add them: 56!"

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'multiplication-explorer'`
- `factsCorrect` / `factsTotal`
- `representationsUsed` (which of the 5 did they engage with)
- `commutativePropertyExplored` (boolean)
- `distributiveStrategyUsed` (boolean)
- `factFamilyCompleted` (boolean — connected multiplication and division)
- `fluencySpeed` (average time per fact in quiz mode)
- `missingFactorCorrect` / `missingFactorTotal`
- `attemptsCount`

---

## DOMAIN 3: Measurement & Real-World Math (1-5)

### 7. `clock-explorer` — Telling Time & Elapsed Time

**Purpose:** Time is one of the most practical math skills — and one of the hardest to teach abstractly. This primitive provides an interactive analog clock with movable hands, digital display synchronization, and elapsed time tools. The student doesn't just read time — they physically move the minute hand and watch the hour hand follow, discovering the gear-like relationship between hours and minutes. Elapsed time problems use a timeline visualization.

**Grade Band:** 1-4

**Cognitive Operation:** Analog clock reading, time notation, elapsed time calculation, duration estimation

**Multimodal Features:**
- **Visual:** Analog clock face with draggable hands (minute hand drives hour hand proportionally). Digital display synchronized below. Color-coded clock sectors: hour shading (what hour are we in), minute markers (5-minute intervals highlighted). Elapsed time timeline (start time → duration → end time). AM/PM indicator.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees hand positions, digital time, and challenge context. Teaches clock reading: "The short hand is between 2 and 3 — that means it's 2-something. Now count the minutes from 12..." Guides elapsed time: "From 2:15 to 3:00 is 45 minutes. Then from 3:00 to 3:30 is another 30 minutes. 45 + 30 = ?" Connects to daily life: "That's when school starts! How long until lunch?"
- **Image Generation:** AI-generated daily schedule contexts (school day, soccer practice, bedtime routine) for elapsed time problems.
- **Interactive:** Drag minute hand (hour hand follows proportionally). Tap hour numbers for quick setting. Toggle digital display. Elapsed time mode with start/end clocks and timeline. "What time will it be in 45 minutes?" challenges.

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| 1 | Tell time to the hour and half hour. "The short hand points to 3, so it's 3 o'clock" |
| 2 | Tell time to 5 minutes. Quarter past, half past, quarter to. AM/PM |
| 3 | Tell time to the minute. Elapsed time within the same hour. Duration problems |
| 4 | Elapsed time across hours. Converting hours ↔ minutes. Schedule-based problems |

**Interaction Model:**
- Phase 1 (Read): Clock shows a time — student reads it and types the digital time.
- Phase 2 (Set): Given a digital time, student moves the hands to match.
- Phase 3 (Elapsed): Given a start time and duration, find the end time using the timeline tool.
- Phase 4 (Schedule): Real-world schedule problems — "Soccer practice starts at 3:30 and lasts 1 hour 15 minutes. When does it end?"

**Schema:**
```json
{
  "primitiveType": "clock-explorer",
  "currentTime": {
    "hours": "number (1-12)",
    "minutes": "number (0-59)",
    "period": "string (AM | PM)"
  },
  "precision": "string (hour | half_hour | quarter_hour | five_min | minute)",
  "elapsedTime": {
    "enabled": "boolean",
    "startTime": "string (e.g., '2:15 PM')",
    "endTime": "string | null",
    "duration": "string | null (e.g., '45 minutes')",
    "findWhat": "string (end_time | duration | start_time)"
  },
  "challenges": [
    {
      "id": "string",
      "type": "string (read | set | elapsed | schedule | convert)",
      "instruction": "string",
      "targetAnswer": "string",
      "context": "string | null (real-world scenario)",
      "hint": "string",
      "narration": "string"
    }
  ],
  "showOptions": {
    "showDigitalDisplay": "boolean",
    "showMinuteMarkers": "boolean",
    "showFiveMinuteHighlight": "boolean",
    "showHourShading": "boolean",
    "showTimeline": "boolean (for elapsed time)",
    "showAMPM": "boolean"
  },
  "scheduleContext": {
    "enabled": "boolean",
    "activities": [
      {
        "name": "string",
        "startTime": "string",
        "duration": "string",
        "imagePrompt": "string"
      }
    ]
  },
  "gradeBand": "1-2 | 3-4"
}
```

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'clock-explorer'`
- `readTimeCorrect` / `readTimeTotal`
- `setTimeCorrect` / `setTimeTotal`
- `elapsedTimeCorrect` / `elapsedTimeTotal`
- `precisionLevel` (highest precision achieved accurately: hour → half → quarter → 5min → minute)
- `hourMinuteRelationshipUnderstood` (boolean — moved minute hand and noticed hour hand movement)
- `scheduleProblemsCorrect` / `scheduleProblemsTotal`
- `attemptsCount`

---

### 8. `measurement-tools` — Length, Weight, Capacity & Temperature

**Purpose:** Measurement connects math to the physical world. This primitive provides virtual versions of the tools students use in hands-on measurement: rulers, scales, measuring cups, and thermometers. Students don't just read measurements — they choose the appropriate tool, estimate first, then measure. The critical skills are choosing units, estimating reasonably, and reading instruments accurately.

**Grade Band:** 1-5

**Cognitive Operation:** Measurement sense, unit selection, estimation, instrument reading, unit conversion

**Multimodal Features:**
- **Visual:** Tool-specific visualizations: ruler/tape with zoom for precision, pan balance or digital scale, graduated cylinder/measuring cup with fill level, thermometer with temperature rise/fall animation. Object-to-measure shown alongside the tool. Estimation prompt before measuring. Unit conversion chart overlay.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees selected tool, measurement attempt, estimation, and actual value. Coaches tool selection: "Would you use a ruler or a scale to find how heavy the watermelon is?" Teaches reading: "Look at where the water level meets the cup markings — read at eye level." Celebrates accurate estimates: "You guessed 15 cm and it's 14 cm — excellent estimating!" Guides conversion: "There are 100 centimeters in a meter. If the table is 120 cm, how many meters?"
- **Image Generation:** AI-generated objects to measure in real-world contexts (school supplies, kitchen ingredients, animals, sports equipment).
- **Interactive:** Drag tool to object. Zoom ruler for precision. Pour liquid to fill container. Place objects on scale. Estimation input before measuring reveals. Unit selector (cm/m, g/kg, mL/L, °C/°F).

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| 1 | Non-standard units (paper clips, hand spans). Compare: longer/shorter, heavier/lighter |
| 2 | Standard units: inches/centimeters (length), pounds/kilograms (weight). Estimate then measure |
| 3 | Units within a system: cm → m, g → kg, mL → L. Half-inch and half-cm precision |
| 4 | Larger and smaller units. Convert within metric system. Two-step measurement problems |
| 5 | Convert within customary system. Multi-step word problems. Choose most appropriate unit |

**Interaction Model:**
- Phase 1 (Explore): Free measurement — pick any tool, measure any object. Build intuition.
- Phase 2 (Estimate): See an object, estimate its measurement before using the tool.
- Phase 3 (Precision): Read measurements to the nearest half-unit or quarter-unit.
- Phase 4 (Convert): Measure in one unit, convert to another. "The desk is 120 cm. How many meters?"

**Schema:**
```json
{
  "primitiveType": "measurement-tools",
  "toolType": "string (ruler | tape_measure | scale | balance | measuring_cup | thermometer)",
  "measurementType": "string (length | weight | capacity | temperature)",
  "unit": {
    "primary": "string (cm | m | in | ft | g | kg | lb | mL | L | cup | °C | °F)",
    "secondary": "string | null (for conversion)",
    "precision": "string (whole | half | quarter | tenth)"
  },
  "objectToMeasure": {
    "name": "string (e.g., 'Pencil')",
    "actualValue": "number",
    "imagePrompt": "string",
    "category": "string (school | kitchen | nature | sports | animals)"
  },
  "challenges": [
    {
      "id": "string",
      "type": "string (measure | estimate | compare | convert | choose_tool | choose_unit)",
      "instruction": "string",
      "targetAnswer": "number | string",
      "acceptableRange": { "min": "number", "max": "number" },
      "hint": "string",
      "narration": "string"
    }
  ],
  "nonStandardUnits": {
    "enabled": "boolean (for grade 1)",
    "unitName": "string (e.g., 'paper clips')",
    "unitLength": "number"
  },
  "conversionReference": {
    "enabled": "boolean",
    "conversions": [
      {
        "from": "string",
        "to": "string",
        "factor": "number",
        "description": "string"
      }
    ]
  },
  "imagePrompt": "string | null (measurement context illustration)",
  "gradeBand": "1-2 | 3-5"
}
```

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'measurement-tools'`
- `measurementsCorrect` / `measurementsTotal`
- `estimationAccuracy` (average % error between estimate and actual)
- `toolSelectionCorrect` / `toolSelectionTotal`
- `unitSelectionCorrect` / `unitSelectionTotal`
- `conversionCorrect` / `conversionTotal`
- `precisionAchieved` (whole, half, quarter, tenth)
- `measurementTypesExplored` (length, weight, capacity, temperature)
- `attemptsCount`

---

### 9. `money-counter` — Coins, Bills & Making Change

**Purpose:** Money is where math gets real for kids. This primitive provides draggable coins and bills for counting, combining, and making change. It builds place value understanding through a natural context (1 dime = 10 pennies = the same as regrouping), decimal notation (dollars and cents), and real-world problem solving. When a child figures out that two quarters, a dime, and three pennies make $0.63, they've just done multi-step addition with decimals.

**Grade Band:** 1-3

**Cognitive Operation:** Coin identification, counting mixed coins, making change, decimal notation

**Multimodal Features:**
- **Visual:** Realistic coin and bill images (penny, nickel, dime, quarter, dollar coin, $1, $5, $10, $20 bills). Coin purse/wallet workspace. Running total display in cents and dollar notation. Making change visualization: price tag → amount paid → change returned. Skip counting helper (count by 25s for quarters, 10s for dimes, 5s for nickels).
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees coins placed, running total, and target amount. Coaches counting strategy: "Start with the biggest coins first — count the quarters: 25, 50... now add the dimes: 60, 70... now the nickels: 75... and the pennies: 76, 77, 78!" Teaches making change: "The price is $3.50 and you paid $5.00. Count up from $3.50 to $5.00." Celebrates: "You made exactly $1.25 using just 5 coins!"
- **Image Generation:** AI-generated store/market scenes for word problem contexts.
- **Interactive:** Drag coins and bills from supply tray to workspace. Tap coins to hear their value. Running total updates as coins are placed. "Make this amount" challenges. "Make change" mode. "Fewest coins" optimization challenge.

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| 1 | Identify coins and their values. Count same-type coins (5 dimes = 50¢) |
| 2 | Count mixed coins. Dollar notation ($0.75). "Make this amount" with coins |
| 2 | Skip count with coins: quarters by 25s, dimes by 10s |
| 3 | Making change (count up method). Bills and coins together. Multi-step purchase problems |

**Interaction Model:**
- Phase 1 (Identify): Tap each coin to learn its name and value. Sort by value.
- Phase 2 (Count): Given a pile of coins, find the total by skip counting (biggest first).
- Phase 3 (Make): Given a target amount, drag coins to make exactly that amount.
- Phase 4 (Change): Given a price and amount paid, figure out the change.

**Schema:**
```json
{
  "primitiveType": "money-counter",
  "availableCoins": ["string (penny | nickel | dime | quarter | dollar_coin)"],
  "availableBills": ["string (one | five | ten | twenty)"],
  "challenges": [
    {
      "id": "string",
      "type": "string (identify | count | make_amount | make_change | fewest_coins | word_problem)",
      "instruction": "string",
      "targetAmount": "number (in cents)",
      "givenCoins": "object | null (for counting: {quarter: 3, dime: 2, nickel: 1, penny: 4})",
      "pricePaid": "number | null (for making change)",
      "hint": "string",
      "narration": "string"
    }
  ],
  "showOptions": {
    "showRunningTotal": "boolean",
    "showDollarNotation": "boolean ($0.75 format)",
    "showSkipCountHelper": "boolean",
    "showCoinValues": "boolean (labels on coins)"
  },
  "wordProblemContext": {
    "enabled": "boolean",
    "store": "string (e.g., 'School Bookstore')",
    "items": [
      {
        "name": "string",
        "price": "number (cents)",
        "imagePrompt": "string"
      }
    ]
  },
  "imagePrompt": "string | null (store/market context)",
  "gradeBand": "1-2 | 2-3"
}
```

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'money-counter'`
- `countingCorrect` / `countingTotal`
- `makeAmountCorrect` / `makeAmountTotal`
- `makeChangeCorrect` / `makeChangeTotal`
- `fewestCoinsUsed` (boolean — found optimal coin combination)
- `skipCountStrategyUsed` (boolean — counted by coin value instead of one-by-one)
- `dollarNotationCorrect` (boolean — wrote amount correctly with $ and decimal)
- `coinIdentificationCorrect` / `coinIdentificationTotal`
- `attemptsCount`

---

## DOMAIN 4: Geometry & Spatial Reasoning (K-5)

### 10. `shape-builder` — Geometric Construction & Properties

**Purpose:** Geometry in K-5 is about seeing, building, and reasoning about shapes — not formal proofs. This primitive upgrades the thin `geometric-shape` display into a full construction environment where students build shapes from vertices and edges, discover properties by measuring, sort and classify shapes, and compose/decompose figures. The AI tutor names properties as students discover them: "You made a shape with 4 equal sides and 4 right angles — that's a square! A square is a special rectangle."

**Grade Band:** K-5

**Cognitive Operation:** Shape identification, property discovery, classification, composition/decomposition, spatial reasoning

**Multimodal Features:**
- **Visual:** Dot grid or coordinate grid workspace. Shape construction with vertex placement and edge snapping. Property readouts (side lengths, angles, parallel/perpendicular markers). Classification badges ("Quadrilateral → Parallelogram → Rectangle → Square"). Composition mode: combine shapes. Decomposition mode: cut shapes apart. Symmetry line overlay.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees vertices, edges, angles, and property measurements. Names discoveries: "3 sides, 3 angles — you built a triangle!" Guides classification: "Is this a regular hexagon or irregular? Check if all the sides are the same length." Celebrates hierarchy understanding: "Yes! Every square IS a rectangle, but not every rectangle is a square." Coaches composition: "Can you make a rectangle from two triangles?"
- **Image Generation:** AI-generated real-world shape examples (architecture, nature, art, sports fields).
- **Interactive:** Click to place vertices. Edges auto-connect. Drag vertices to adjust. Measure tool (ruler for sides, protractor for angles). Sort shapes into categories. Pattern block mode (predefined shapes to compose). Symmetry drawing tool.

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| K | Name basic shapes: circle, square, triangle, rectangle. Sort by shape |
| 1 | 2D vs 3D. Compose shapes from other shapes (two triangles → rectangle) |
| 2 | Properties: number of sides, vertices, angles. Quadrilateral vocabulary |
| 3 | Parallel and perpendicular sides. Classify quadrilaterals (rhombus, trapezoid) |
| 4 | Angle measurement (connect to protractor). Line symmetry. Regular vs irregular |
| 5 | Shape hierarchy (square ⊂ rectangle ⊂ parallelogram ⊂ quadrilateral). Coordinate geometry |

**Interaction Model:**
- Phase 1 (Build): Place vertices on a grid to construct a named shape ("Build a pentagon").
- Phase 2 (Discover): Measure sides and angles of a given shape. State its properties.
- Phase 3 (Classify): Given several shapes, sort them into categories based on properties.
- Phase 4 (Compose/Decompose): Combine simple shapes into complex ones, or cut complex shapes into simpler ones.

**Schema:**
```json
{
  "primitiveType": "shape-builder",
  "mode": "string (build | discover | classify | compose | decompose | symmetry)",
  "grid": {
    "type": "string (dot | coordinate | none)",
    "size": { "rows": "number", "columns": "number" },
    "showCoordinates": "boolean"
  },
  "targetShape": {
    "name": "string | null (e.g., 'Regular Hexagon')",
    "properties": {
      "sides": "number",
      "rightAngles": "number | null",
      "parallelPairs": "number | null",
      "equalSides": "string | null (all | pairs | none)",
      "lineOfSymmetry": "number | null"
    }
  },
  "preloadedShapes": [
    {
      "id": "string",
      "vertices": [{ "x": "number", "y": "number" }],
      "name": "string",
      "locked": "boolean"
    }
  ],
  "challenges": [
    {
      "id": "string",
      "type": "string (build | measure | classify | compose | find_symmetry | coordinate_shape)",
      "instruction": "string",
      "targetProperties": "object | null",
      "hint": "string",
      "narration": "string"
    }
  ],
  "tools": {
    "ruler": "boolean",
    "protractor": "boolean",
    "symmetryLine": "boolean",
    "parallelMarker": "boolean"
  },
  "classificationCategories": ["string (e.g., 'triangles', 'quadrilaterals', 'pentagons', 'hexagons')"],
  "patternBlocks": {
    "enabled": "boolean",
    "availableShapes": ["string (triangle | square | rhombus | trapezoid | hexagon | circle)"]
  },
  "imagePrompt": "string | null (real-world shape examples)",
  "gradeBand": "K-2 | 3-5"
}
```

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'shape-builder'`
- `shapesBuiltCorrectly` / `shapesTotal`
- `propertiesIdentified` / `propertiesTotal`
- `classificationCorrect` / `classificationTotal`
- `compositionsCompleted` / `compositionsTotal`
- `symmetryLinesFound` / `symmetryLinesTotal`
- `hierarchyUnderstood` (boolean — correctly stated subset relationships)
- `toolsUsed` (which measurement tools were employed)
- `attemptsCount`

---

### 11. `net-folder` — 3D Shapes & Surface Area

**Purpose:** The connection between 2D and 3D is one of the hardest spatial reasoning skills — and one of the most powerful. This primitive shows the relationship between 3D solids and their 2D nets through animated folding/unfolding. Students select a 3D shape, watch it unfold flat, identify faces on both the net and solid, and calculate surface area from the flat net. The "aha!" of watching a cube unfold into a cross-shaped net is unforgettable.

**Grade Band:** 3-5

**Cognitive Operation:** 2D-3D visualization, spatial reasoning, surface area concepts, face identification

**Multimodal Features:**
- **Visual:** 3D solid rendering with rotation (simplified Three.js or CSS 3D transforms). Unfolding animation: solid smoothly opens into flat net. Face highlighting: tap a face on the net and the corresponding face glows on the solid (and vice versa). Grid overlay on net faces for area counting. Dimension labels. Multiple valid nets for the same solid.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees which solid is selected, fold/unfold state, and face identification attempts. Guides spatial reasoning: "If you fold this net up, which face becomes the top of the cube?" Coaches surface area: "Count the unit squares on each face of the net. Add them all up — that's the surface area!" Celebrates spatial insight: "You found all 11 possible nets of a cube!"
- **Image Generation:** AI-generated real-world 3D shapes (cereal boxes, cans, dice, pyramids of Giza) and packaging design contexts.
- **Interactive:** Rotate 3D solid with mouse/touch. Toggle fold/unfold animation. Tap faces to highlight correspondence. Drag dimension labels. "Is this a valid net?" challenges (some nets don't fold correctly). Grid overlay for area counting.

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| 3 | Name 3D shapes: cube, rectangular prism, cylinder, cone, sphere, pyramid. Identify faces, edges, vertices |
| 4 | Unfold 3D shapes into nets. Identify which face goes where. Multiple valid nets |
| 5 | Surface area from nets: count unit squares on each face and add. Formula connection for rectangular prisms |

**Interaction Model:**
- Phase 1 (Explore): Rotate a 3D solid. Count faces, edges, vertices. Name the shape.
- Phase 2 (Unfold): Watch the solid unfold into a net. Tap faces to see the correspondence.
- Phase 3 (Identify): Given a flat net, predict which 3D shape it folds into. Sort valid vs invalid nets.
- Phase 4 (Calculate): Use the grid overlay on the net to calculate surface area.

**Schema:**
```json
{
  "primitiveType": "net-folder",
  "solid": {
    "type": "string (cube | rectangular_prism | triangular_prism | square_pyramid | triangular_pyramid | cylinder | cone)",
    "name": "string",
    "dimensions": {
      "length": "number | null",
      "width": "number | null",
      "height": "number | null",
      "radius": "number | null"
    },
    "faces": "number",
    "edges": "number",
    "vertices": "number"
  },
  "net": {
    "layout": "string (cross | t_shape | l_shape | strip | custom)",
    "faceLabels": ["string (e.g., 'top', 'front', 'right', 'back', 'left', 'bottom')"],
    "gridOverlay": "boolean"
  },
  "challenges": [
    {
      "id": "string",
      "type": "string (identify_solid | match_faces | valid_net | surface_area | count_faces_edges_vertices)",
      "instruction": "string",
      "targetAnswer": "string | number",
      "hint": "string",
      "narration": "string"
    }
  ],
  "alternativeNets": [
    {
      "layout": "string",
      "valid": "boolean",
      "explanation": "string (why it does or doesn't fold)"
    }
  ],
  "showOptions": {
    "showDimensions": "boolean",
    "showFaceLabels": "boolean",
    "showGridOverlay": "boolean",
    "showFaceCorrespondence": "boolean",
    "allowRotation": "boolean",
    "animationSpeed": "number (fold/unfold speed)"
  },
  "imagePrompt": "string | null (real-world 3D objects: cereal box, gift box, tent, pyramid)",
  "gradeBand": "3-4 | 4-5"
}
```

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'net-folder'`
- `solidsIdentified` / `solidsTotal`
- `facesMatchedCorrectly` / `facesTotal`
- `validNetsIdentified` / `netsTotal`
- `surfaceAreaCorrect` / `surfaceAreaTotal`
- `facesEdgesVerticesCounted` (boolean — correctly stated all three)
- `solidTypesExplored` (count of different shapes viewed)
- `rotationUsed` (boolean — rotated the 3D model)
- `attemptsCount`

---

### 12. `angle-explorer` — Protractor, Angle Types & Relationships

**Purpose:** Angles are everywhere — clock hands, pizza slices, ramps, open doors — but students need tools to measure and classify them precisely. This primitive provides a virtual protractor for measurement, angle construction tools, and classification activities. Students discover that angles aren't about line length (a common misconception) but about rotation — the amount of turn between two rays.

**Grade Band:** 3-5

**Cognitive Operation:** Angle measurement, classification, estimation, angle relationships (supplementary, complementary)

**Multimodal Features:**
- **Visual:** Protractor overlay with degree markings. Adjustable angle arms (rays) with vertex. Angle arc with degree readout. Classification color coding (acute = green, right = blue, obtuse = orange, straight = purple, reflex = red). Benchmark angle reference (45°, 90°, 180°, 270°, 360°). "Door analogy" — animated door opening shows the angle concept.
- **AI Tutoring ([Scaffold](ADDING_TUTORING_SCAFFOLD.md)):** AI tutor sees angle measure, student classification, and challenge context. Teaches measurement: "Line up the center of the protractor with the vertex. The bottom ray goes along the 0° line. Read where the top ray crosses." Corrects misconceptions: "The angle isn't bigger because the lines are longer — it's the amount of turn that matters." Celebrates: "135° — that's an obtuse angle! More than a right angle but less than a straight angle."
- **Image Generation:** AI-generated real-world angles (clock hands at different times, doors opened to different widths, ramps, scissors, pizza slices).
- **Interactive:** Drag rays to create angles. Position protractor to measure. Estimation mode (guess the angle before measuring). Construct angles of specific measures. Find angles in real-world images. Angle addition (two angles that make a right angle or straight angle).

**Learning Progression:**
| Grade | Focus |
|-------|-------|
| 3 | Angle as a turn. Right angles in the world. "More than" or "less than" a right angle |
| 4 | Measure angles with a protractor. Acute, right, obtuse classification. Benchmark angles (30°, 45°, 60°, 90°) |
| 4 | Construct angles of specific measures. Angles on a straight line add to 180° |
| 5 | Complementary (sum = 90°) and supplementary (sum = 180°) angle pairs. Angles around a point = 360° |

**Interaction Model:**
- Phase 1 (Discover): Open a door (animated) and see the angle change. Classify: "Is this more or less than a right angle?"
- Phase 2 (Measure): Use the protractor to measure given angles. Learn the tool.
- Phase 3 (Construct): "Build a 135° angle." Drag the ray to the target.
- Phase 4 (Reason): "If one angle on a straight line is 70°, what's the other?" Use angle relationships.

**Schema:**
```json
{
  "primitiveType": "angle-explorer",
  "mode": "string (measure | construct | classify | estimate | relationships)",
  "angle": {
    "measure": "number (degrees)",
    "vertex": { "x": "number", "y": "number" },
    "ray1Angle": "number (degrees from horizontal)",
    "ray2Angle": "number (degrees from horizontal)"
  },
  "protractor": {
    "type": "string (half | full)",
    "draggable": "boolean",
    "showDegrees": "boolean"
  },
  "challenges": [
    {
      "id": "string",
      "type": "string (measure | construct | classify | estimate | find_complement | find_supplement | angle_addition)",
      "instruction": "string",
      "targetAngle": "number | null",
      "targetClassification": "string | null (acute | right | obtuse | straight | reflex)",
      "tolerance": "number (degrees of acceptable error)",
      "hint": "string",
      "narration": "string"
    }
  ],
  "angleRelationships": {
    "complementary": "boolean (show pairs that sum to 90°)",
    "supplementary": "boolean (show pairs that sum to 180°)",
    "aroundPoint": "boolean (show angles summing to 360°)"
  },
  "realWorldExamples": [
    {
      "context": "string (e.g., 'Clock hands at 3:00')",
      "angle": "number",
      "imagePrompt": "string"
    }
  ],
  "showOptions": {
    "showClassification": "boolean",
    "showArc": "boolean",
    "showDegreeMeasure": "boolean",
    "showBenchmarks": "boolean (45°, 90°, 180° reference lines)",
    "showRealWorldOverlay": "boolean"
  },
  "gradeBand": "3-4 | 4-5"
}
```

**Evaluable:** Yes.

**Evaluation Metrics:**
- `type: 'angle-explorer'`
- `measurementAccuracy` (average degree error from actual)
- `constructionAccuracy` (average degree error from target)
- `classificationCorrect` / `classificationTotal`
- `estimationAccuracy` (average degree error before measuring)
- `complementaryPairsFound` / `complementaryPairsTotal`
- `supplementaryPairsFound` / `supplementaryPairsTotal`
- `protractorSkill` (boolean — correctly positioned and read the protractor)
- `attemptsCount`

---

## TRACK 2: Existing Primitive Upgrades

The following 8 existing primitives need upgrades to reach Lumina-native standard. These are not rewrites — they're enhancements layered onto the existing implementations.

---

### Upgrade 1: `number-line` → Interactive Number Line

**Current State:** Display-only with hover highlights. No drag, no zoom, no operations-as-movement, no evaluation.

**Upgrades Required:**

| Feature | Current | Target |
|---------|---------|--------|
| **Drag-to-plot** | None | Drag points onto the line; snap to integers/fractions/decimals |
| **Operations as movement** | None | Animated "jumps" for addition (right) and subtraction (left) |
| **Zoom** | None | Pinch/scroll to zoom for fraction and decimal precision |
| **Number types** | Integer only | Toggle between integer, fraction, decimal, mixed number |
| **Grade-band adaptivity** | Single mode | K-2 mode (0-20, large ticks, counting focus) vs 3-5 mode (negative numbers, fractions, decimals) |
| **Evaluation** | None | `usePrimitiveEvaluation` with accuracy metrics |
| **Interaction phases** | None | Explore → Plot → Operate → Compare |
| **Challenges** | None | "Plot 3/4 on the number line", "Show the jump from 5 to 12", "Order these fractions" |

**New Schema Fields:**
```json
{
  "interactionMode": "string (plot | jump | compare | order)",
  "numberType": "string (integer | fraction | decimal | mixed)",
  "operations": [
    {
      "type": "string (add | subtract)",
      "startValue": "number",
      "changeValue": "number",
      "showJumpArc": "boolean"
    }
  ],
  "challenges": [
    {
      "type": "string (plot_point | show_jump | order_values | find_between)",
      "instruction": "string",
      "targetValues": "number[]",
      "hint": "string"
    }
  ],
  "gradeBand": "K-2 | 3-5"
}
```

---

### Upgrade 2: `base-ten-blocks` → Interactive Base-Ten Manipulative

**Current State:** Display-only with hover highlighting. No drag, no grouping/ungrouping, no regrouping animation.

**Upgrades Required:**

| Feature | Current | Target |
|---------|---------|--------|
| **Drag blocks** | None | Drag blocks from supply tray into place value columns |
| **Regroup** | None | Tap 10 ones → animate merge into 1 ten. Tap 1 ten → break into 10 ones |
| **Place value columns** | Visual only | Snap-to columns with labels and running totals |
| **Decimal mode** | None | Extend to tenths and hundredths (flat = 1, rod = 0.1, unit = 0.01) |
| **Evaluation** | None | `usePrimitiveEvaluation` with regrouping and representation accuracy |
| **Operations** | None | Two-number mode: represent both operands and combine/subtract with regrouping |
| **Challenges** | None | "Build 347 with blocks", "What number do these blocks show?", "Regroup to subtract" |

**New Schema Fields:**
```json
{
  "interactionMode": "string (build | decompose | regroup | operate)",
  "decimalMode": "boolean",
  "maxPlace": "string (ones | tens | hundreds | thousands)",
  "supplyTray": "boolean (show block supply for dragging)",
  "challenges": [
    {
      "type": "string (build_number | read_blocks | regroup | add_with_blocks | subtract_with_blocks)",
      "instruction": "string",
      "targetNumber": "number",
      "hint": "string"
    }
  ],
  "gradeBand": "K-1 | 2-3 | 4-5"
}
```

---

### Upgrade 3: `balance-scale` → Full Evaluation + Enhanced Interaction

**Current State:** Good interactivity (operations, drag blocks) but no evaluation integration, no interaction phases, no challenges schema.

**Upgrades Required:**

| Feature | Current | Target |
|---------|---------|--------|
| **Evaluation** | None | `usePrimitiveEvaluation` with equation-solving metrics |
| **Interaction phases** | None | Explore → Identify → Solve → Verify |
| **Challenges** | None | Grade-banded challenges: equality (K-2), one-step equations (3-4), two-step equations (5) |
| **Grade-band modes** | Single mode | K-2: concrete objects only, no variables. 3-5: variables, algebraic operations |
| **Step tracking** | Basic | Rich step history with operation justification |

---

### Upgrade 4: `function-machine` → Full Evaluation + Chaining

**Current State:** Good interactivity (input/output, rule guessing) but no evaluation, no machine chaining.

**Upgrades Required:**

| Feature | Current | Target |
|---------|---------|--------|
| **Evaluation** | None | `usePrimitiveEvaluation` with rule discovery and application metrics |
| **Machine chaining** | None | Connect output of one machine to input of next (composition preview) |
| **Interaction phases** | None | Observe → Predict → Discover → Create |
| **Grade-band modes** | Single mode | 3-4: one-step rules (add, multiply). 5: two-step rules. Advanced: expressions |

---

### Upgrade 5: `geometric-shape` → Redirect to `shape-builder`

**Current State:** Display-only labeled shape with properties. Very thin.

**Recommendation:** Deprecate `geometric-shape` and redirect to the new `shape-builder` primitive (Primitive #10 above), which provides full construction, measurement, classification, and composition capabilities. Maintain backward compatibility by rendering existing `geometric-shape` data in a read-only mode within `shape-builder`.

---

### Upgrade 6: `array-grid` → Skip Counting Animation + Evaluation Enhancement

**Current State:** Good interactivity with evaluation. Missing animated skip counting and fact connection.

**Upgrades Required:**

| Feature | Current | Target |
|---------|---------|--------|
| **Skip counting animation** | None | Animate row-by-row highlighting with running count (connects to `skip-counting-runner`) |
| **Fact display** | None | Show multiplication fact as array builds: "4 rows × 3 columns = 12" |
| **Commutative visualization** | None | Rotate array 90° to show 4×3 = 3×4 |
| **Partition animation** | Static | Animate splitting array for distributive property |

---

### Upgrade 7: `dot-plot` → Full Evaluation Integration

**Current State:** Good interactivity (add/remove points, statistics display) but no evaluation.

**Upgrades Required:**

| Feature | Current | Target |
|---------|---------|--------|
| **Evaluation** | None | `usePrimitiveEvaluation` with data analysis metrics |
| **Challenges** | None | "What is the mode?", "Find the median", "Compare datasets" |
| **Grade-band modes** | Single | 2-3: counting and mode only. 4-5: mean, median. 6+: distribution shape |

---

### Upgrade 8: `fraction-bar` + `fraction-circles` → Equivalence Linking

**Current State:** Both are strong implementations with evaluation. They work independently but don't link to each other or show equivalence across representations.

**Upgrades Required:**

| Feature | Current | Target |
|---------|---------|--------|
| **Cross-representation linking** | None | Same fraction shown simultaneously as bar and circle, changes synchronized |
| **Equivalence proof** | None | Visual proof mode: overlay bars of 1/2 and 2/4 to show they cover the same amount |
| **Number line connection** | None | Optional number line below showing fraction position |
| **Mixed numbers** | None | Extend beyond 1 whole (e.g., 5/3 as 1 and 2/3) |

---

## Technical Requirements

### State Management

All new primitives must implement the standard `PrimitiveState` interface and integrate with the manifest/catalog system.

### Simulation Requirements

Phase 2 math primitives have lighter simulation needs than vehicles but still require:

- **Clock simulation**: Proportional hour/minute hand movement (minute drives hour at 1/12 rate)
- **3D rendering**: Net folder requires basic 3D solid display with fold/unfold animation (CSS 3D transforms preferred over Three.js for bundle size)
- **Regrouping animation**: Smooth merge/split of base-ten block groups
- **Skip counting animation**: Character movement along number line with arc trails
- **Protractor overlay**: Accurate degree measurement with ray snapping

Performance targets:
- Initial render: < 100ms (< 150ms for net-folder 3D)
- State update: < 16ms (60fps interactions)
- Animation: 60fps for regrouping, skip counting, clock hands
- Serialization: < 50ms
- Maximum bundle size per primitive: 50KB gzipped (75KB for net-folder)

### Accessibility Requirements

Each primitive must support:
- Full keyboard navigation (critical for manipulatives: arrow keys to move counters, tab to select blocks)
- Screen reader descriptions of manipulative state ("Ten frame: 7 of 10 filled, 3 empty")
- High contrast mode
- Reduced motion mode (step-by-step instead of animations)
- Touch and pointer input (drag-and-drop with touch alternatives)
- Minimum touch target size (44x44px — especially important for coins and small counters)

### Data Requirements

- Realistic coin and bill images (US currency for initial release, extensible to other currencies)
- Accurate clock face geometry (proportional hand movement)
- Standard 3D solid dimensions and net layouts
- Grade-appropriate word problem contexts (Gemini-generated)
- Real-world measurement object data (approximate dimensions of common objects)

---

## Catalog & Domain Structure

### Updated Catalog Module: `catalog/math.ts`

All 12 new primitives join the existing `MATH_CATALOG`. The 8 upgraded primitives retain their existing catalog entries with enhanced descriptions and evaluation fields.

**New entries:**

| Subcategory | New Primitives |
|---|---|
| Foundational Number Sense (K-2) | `ten-frame`, `counting-board`, `pattern-builder`, `skip-counting-runner` |
| Operations & Computation (1-4) | `regrouping-workbench`, `multiplication-explorer` |
| Measurement & Real-World (1-5) | `clock-explorer`, `measurement-tools`, `money-counter` |
| Geometry & Spatial Reasoning (K-5) | `shape-builder`, `net-folder`, `angle-explorer` |

### Generator Domain

New directory: `service/math-phase2/` with individual generator files. Alternatively, extend existing math generators.

---

## File Inventory

### New Files (per primitive: component + generator = 2 files)

| # | Primitive | Component File | Generator File |
|---|-----------|---------------|---------------|
| 1 | `ten-frame` | `primitives/visual-primitives/math/TenFrame.tsx` | `service/math-phase2/gemini-ten-frame.ts` |
| 2 | `counting-board` | `primitives/visual-primitives/math/CountingBoard.tsx` | `service/math-phase2/gemini-counting-board.ts` |
| 3 | `pattern-builder` | `primitives/visual-primitives/math/PatternBuilder.tsx` | `service/math-phase2/gemini-pattern-builder.ts` |
| 4 | `skip-counting-runner` | `primitives/visual-primitives/math/SkipCountingRunner.tsx` | `service/math-phase2/gemini-skip-counting-runner.ts` |
| 5 | `regrouping-workbench` | `primitives/visual-primitives/math/RegroupingWorkbench.tsx` | `service/math-phase2/gemini-regrouping-workbench.ts` |
| 6 | `multiplication-explorer` | `primitives/visual-primitives/math/MultiplicationExplorer.tsx` | `service/math-phase2/gemini-multiplication-explorer.ts` |
| 7 | `clock-explorer` | `primitives/visual-primitives/math/ClockExplorer.tsx` | `service/math-phase2/gemini-clock-explorer.ts` |
| 8 | `measurement-tools` | `primitives/visual-primitives/math/MeasurementTools.tsx` | `service/math-phase2/gemini-measurement-tools.ts` |
| 9 | `money-counter` | `primitives/visual-primitives/math/MoneyCounter.tsx` | `service/math-phase2/gemini-money-counter.ts` |
| 10 | `shape-builder` | `primitives/visual-primitives/math/ShapeBuilder.tsx` | `service/math-phase2/gemini-shape-builder.ts` |
| 11 | `net-folder` | `primitives/visual-primitives/math/NetFolder.tsx` | `service/math-phase2/gemini-net-folder.ts` |
| 12 | `angle-explorer` | `primitives/visual-primitives/math/AngleExplorer.tsx` | `service/math-phase2/gemini-angle-explorer.ts` |

### Existing Files Modified

| File | Changes |
|---|---|
| `types.ts` | Add 12 new ComponentIds to union |
| `config/primitiveRegistry.tsx` | Add 12 new registry entries + update 8 existing |
| `evaluation/types.ts` | Add 12 new metrics interfaces + union members |
| `evaluation/index.ts` | Export new metrics types |
| `service/manifest/catalog/math.ts` | Add 12 new catalog entries with tutoring scaffolds |
| `service/registry/generators/index.ts` | Import math-phase2 generators |
| Existing primitive components (8) | Upgrades per Track 2 specs |

**Total: 24 new files + 6 existing file modifications + 8 component upgrades.**

---

## Multimodal Integration Summary

| Modality | Primitives Using It | Infrastructure |
|---|---|---|
| **AI Tutoring Scaffold** | All 12 new + 8 upgraded = 20 primitives | `TutoringScaffold` in catalog → `useLuminaAI` hook → Gemini Live WebSocket → real-time speech. Existing pattern. See [ADDING_TUTORING_SCAFFOLD.md](ADDING_TUTORING_SCAFFOLD.md). |
| **AI Image Generation** | `ten-frame`, `counting-board`, `pattern-builder`, `clock-explorer`, `measurement-tools`, `money-counter`, `shape-builder`, `net-folder`, `angle-explorer` (9 primitives) | Gemini image generation (exists). Real-world context illustrations. |
| **Drag-and-Drop** | `ten-frame`, `counting-board`, `regrouping-workbench`, `money-counter`, `shape-builder`, `base-ten-blocks` upgrade, `number-line` upgrade (7 primitives) | React DnD patterns (exists). |
| **Rich Evaluation** | All 12 new + 8 upgraded = 20 primitives | `usePrimitiveEvaluation` + metrics (exists). |
| **Animation** | `skip-counting-runner`, `regrouping-workbench`, `clock-explorer`, `net-folder`, `number-line` upgrade (5 primitives) | Canvas/SVG animation (exists). |
| **3D Rendering** | `net-folder` | CSS 3D transforms (new, lightweight). |

### New Infrastructure Required

| Capability | Used By | Complexity |
|---|---|---|
| **Clock face renderer** | `clock-explorer` | Low — SVG clock with proportional hands |
| **Protractor overlay** | `angle-explorer` | Low-Medium — rotatable protractor with degree readout |
| **3D net fold/unfold** | `net-folder` | Medium — CSS 3D transforms with face mapping |
| **Regrouping animation** | `regrouping-workbench`, `base-ten-blocks` upgrade | Low-Medium — merge/split animations for block groups |
| **Character hop animation** | `skip-counting-runner` | Low — sprite with arc trajectory on number line |
| **Coin/bill assets** | `money-counter` | Low — static SVG assets for US currency |

---

## Implementation Priority

### Sprint 1: K-2 Foundations
1. `ten-frame` — highest-impact K-1 primitive
2. `counting-board` — foundational counting skills
3. `number-line` upgrade — most-used primitive needs interactivity
4. `base-ten-blocks` upgrade — second most-used, needs drag/regroup

### Sprint 2: Operations
5. `regrouping-workbench` — critical 1-3 skill, builds on base-ten-blocks
6. `skip-counting-runner` — multiplication foundation
7. `multiplication-explorer` — core 2-4 primitive
8. `array-grid` upgrade — skip counting animation + fact display

### Sprint 3: Real-World Math
9. `clock-explorer` — practical measurement, high demand
10. `money-counter` — real-world math, student engagement
11. `measurement-tools` — covers 4 measurement types in one primitive

### Sprint 4: Geometry
12. `shape-builder` — replaces thin `geometric-shape`
13. `angle-explorer` — protractor skills, grade 3-5
14. `net-folder` — 3D geometry, hardest to build (3D rendering)
15. `pattern-builder` — algebraic thinking seeds

### Sprint 5: Evaluation & Polish
16. `balance-scale` upgrade — add evaluation
17. `function-machine` upgrade — add evaluation + chaining
18. `dot-plot` upgrade — add evaluation
19. `fraction-bar` + `fraction-circles` upgrade — equivalence linking
20. Full evaluation integration pass across all 20 primitives

---

## Appendix: K-5 Grade Coverage After Phase 2

| Grade | Phase 1 Primitives | Phase 2 New Primitives | Phase 2 Upgrades | Total |
|-------|-------------------|----------------------|-----------------|-------|
| K | Number Line, Base-10 Blocks, Array Grid, Geometric Shape, Bar Model | **Ten Frame**, **Counting Board**, **Pattern Builder**, **Shape Builder** | Number Line ⬆, Base-10 Blocks ⬆, Geometric Shape → Shape Builder | ~9 |
| 1 | Number Line, Base-10 Blocks, Tape Diagram, Balance Scale, Fraction Bar | **Ten Frame**, **Counting Board**, **Skip Counting Runner**, **Regrouping Workbench**, **Clock Explorer**, **Money Counter**, **Measurement Tools** | Number Line ⬆, Base-10 Blocks ⬆, Balance Scale ⬆ | ~13 |
| 2 | Number Line, Base-10 Blocks, Fraction Bar, Fraction Circles, Array Grid, Tape Diagram, Dot Plot | **Skip Counting Runner**, **Regrouping Workbench**, **Multiplication Explorer**, **Clock Explorer**, **Money Counter**, **Measurement Tools**, **Pattern Builder**, **Shape Builder** | Number Line ⬆, Base-10 Blocks ⬆, Array Grid ⬆, Dot Plot ⬆, Fraction ⬆ | ~17 |
| 3 | Fraction Bar, Fraction Circles, Area Model, Array Grid, Tape Diagram, Factor Tree | **Regrouping Workbench**, **Multiplication Explorer**, **Skip Counting Runner**, **Clock Explorer**, **Money Counter**, **Measurement Tools**, **Pattern Builder**, **Shape Builder**, **Net Folder**, **Angle Explorer** | Array Grid ⬆, Fraction ⬆ | ~18 |
| 4 | Fraction Bar, Area Model, Factor Tree, Tape Diagram, Place Value Chart | **Regrouping Workbench**, **Multiplication Explorer**, **Clock Explorer**, **Measurement Tools**, **Shape Builder**, **Net Folder**, **Angle Explorer** | Fraction ⬆ | ~14 |
| 5 | Coordinate Graph, Area Model, Tape Diagram, Dot Plot, Ratio Table, Double Number Line, Percent Bar, Balance Scale, Function Machine | **Measurement Tools**, **Shape Builder**, **Net Folder**, **Angle Explorer**, **Multiplication Explorer** | Balance Scale ⬆, Function Machine ⬆, Dot Plot ⬆ | ~17 |

**Phase 2 transforms K-5 from 14 primitives (many display-only) to 35 interactive, AI-tutored, evaluated primitives spanning every major math domain.**
