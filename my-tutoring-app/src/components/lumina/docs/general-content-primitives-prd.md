# General Content Primitives — Product Requirements Document

| Field   | Value        |
|---------|--------------|
| Version | 1.0          |
| Date    | March 2026   |
| Status  | **Complete** ✅ (all 4 primitives shipped — 2026-04-04 audit) |

> **Implementation Status (2026-04-04):** All 4 primitives fully implemented with components, Gemini generators, catalog entries (3 eval modes each with correct β values), backend problem type registry, evaluation metrics interfaces, and AI tutor integration via `useLuminaAI`. No gaps detected.
>
> | Primitive | Component | Generator | Catalog | Eval Modes | AI Tutor | Backend Registry |
> |-----------|-----------|-----------|---------|------------|----------|-----------------|
> | Fact File | ✅ 673 LOC | ✅ 495 LOC | ✅ β 1.5/3.5/5.0 | ✅ explore/recall/apply | ✅ 5 events | ✅ |
> | How It Works | ✅ 1,179 LOC | ✅ 520 LOC | ✅ β 1.5/3.5/5.5 | ✅ guided/sequence/predict | ✅ 4 events | ✅ |
> | Timeline Explorer | ✅ 982 LOC | ✅ 510 LOC | ✅ β 1.5/3.5/5.5 | ✅ explore/order/connect | ✅ 4 events | ✅ |
> | Vocabulary Explorer | ✅ 833 LOC | ✅ 389 LOC | ✅ β 1.5/3.5/5.5 | ✅ explore/recall/apply | ✅ 6 events | ✅ |

---

## 1. Executive Summary

This PRD defines four new **general-purpose content primitives** for Lumina that fill the gap between domain-specific interactive STEM primitives and the small set of existing core content components. Today, Lumina has ~75 interactive STEM primitives but only ~8 general content delivery primitives (Curator Brief, Concept Card Grid, Comparison Panel, Foundation Explorer, Image Panel, Image Comparison, Media Player, Feature Exhibit). Once a manifest gets past the introduction and a few images, it runs out of general ways to present rich, topic-agnostic educational content.

These four primitives — **Fact File**, **How It Works**, **Timeline Explorer**, and **Vocabulary Explorer** — are designed to work for *any* topic (trash trucks, volcanoes, ancient Rome, photosynthesis) and fill the missing middle layer between "here's your intro" and "now do a quiz."

### Why These Four

| Primitive | Gap It Fills | Example: "Trash Trucks" |
|-----------|-------------|------------------------|
| **Fact File** | Rich stats/profile card (Concept Card is too brief, Machine Profile is engineering-locked) | Weight: 64,000 lbs, Capacity: 25 tons, Fun fact: drivers make 1,000+ stops/day |
| **How It Works** | Step-by-step process breakdown (Bio Process Animator is biology-locked) | Hydraulic arm grabs bin → tips into hopper → compactor plate pushes → dump at landfill |
| **Timeline Explorer** | Visual chronological progression (Evolution Timeline is biology-locked) | 1900s horse carts → 1930s open trucks → 1950s rear-loaders → modern automated side-loaders |
| **Vocabulary Explorer** | Topic vocabulary with context (no general glossary exists) | Hydraulic, Compactor, Hopper, Payload — with definitions, example sentences, pronunciation |

---

## 2. Design Principles

1. **Topic-Agnostic**: Every primitive must work for any subject — science, history, engineering, art, animals, vehicles, cooking, geography. The Gemini generator receives only a `topic` and `gradeLevel` and produces appropriate content.

2. **Content-First, Assessment-Second**: These are primarily *content delivery* primitives. Assessment is layered on top through optional eval modes, not baked into the core experience. A student can explore a Fact File purely for the joy of learning; eval modes add structured practice when needed.

3. **AI Tutor Integration**: Every primitive signals pedagogical moments to the AI tutor. Even "display" primitives become learning conversations when the AI can react to what the student is exploring.

4. **Grade-Adaptive**: Content complexity, vocabulary, and interaction expectations scale with grade level. K-2 gets simpler language, larger touch targets, and more visual cues. 6-8 gets richer text, more data, and deeper analysis prompts.

5. **Manifest Composability**: These primitives should appear naturally alongside existing ones. A trash truck manifest might flow: Curator Brief → Fact File → How It Works → Image Comparison → Timeline Explorer → Vocabulary Explorer → Knowledge Check.

---

## 3. Primitives

### 3.1 Fact File

**Primitive ID:** `fact-file`
**Domain:** Core
**Grade Range:** K-8
**Type:** Interactive + Evaluable

#### 3.1.1 Problem Statement

Concept Card Grid provides 3-4 terms with brief definitions. Machine Profile is rich but engineering-locked. There's no general-purpose "baseball card" primitive that gives a comprehensive, visually engaging profile of *any* topic with stats, fun facts, records, and contextual details. This is arguably the single most useful content primitive missing from the system.

#### 3.1.2 Core Concept

A magazine-style profile card with multiple sections that students explore by clicking/tapping through tabs or expandable sections. Think of a Pokémon card, a baseball card, or a National Geographic fact sheet — rich, visual, structured, and engaging.

```
┌──────────────────────────────────────────────────┐
│  🗂️  FACT FILE: Garbage Truck                     │
│  ─────────────────────────────────────────────── │
│                                                  │
│   ┌──────────────────────────────────────────┐   │
│   │          🎨 Hero Image                    │   │
│   │     (AI-generated topic illustration)     │   │
│   └──────────────────────────────────────────┘   │
│                                                  │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│   │ 64,000  │ │  25     │ │ $350K   │          │
│   │  lbs    │ │  tons   │ │  cost   │          │
│   │ Weight  │ │Capacity │ │ Price   │          │
│   └─────────┘ └─────────┘ └─────────┘          │
│                                                  │
│   [Quick Facts] [Deep Dive] [Records] [Did You  │
│                                        Know?]   │
│   ┌──────────────────────────────────────────┐   │
│   │ • First garbage truck built in 1920      │   │
│   │ • A driver averages 1,000 stops per day  │   │
│   │ • Side-loaders have a robotic arm that   │   │
│   │   can lift bins up to 96 gallons         │   │
│   └──────────────────────────────────────────┘   │
│                                                  │
│   💡 "The average garbage truck compresses       │
│       trash to 1/6 of its original volume!"      │
└──────────────────────────────────────────────────┘
```

#### 3.1.3 Data Structure

```typescript
export interface FactFileData {
  title: string;
  subtitle: string;                    // e.g., "The Workhorses of Waste Management"
  heroImagePrompt: string;             // For AI image generation
  category: string;                    // e.g., "Vehicle", "Animal", "Place", "Person", "Concept"

  // Key stats — the "baseball card numbers"
  keyStats: Array<{
    value: string;                     // "64,000"
    unit: string;                      // "lbs"
    label: string;                     // "Weight"
  }>;                                  // 3-5 stats

  // Quick facts — bullet-point essentials
  quickFacts: Array<{
    fact: string;
    icon?: string;                     // Optional emoji
  }>;                                  // 4-6 facts

  // Deep dive sections — expandable detail
  deepDive: Array<{
    heading: string;                   // e.g., "How It's Built"
    body: string;                      // 2-3 sentences
    detail?: string;                   // Optional extra detail for older students
  }>;                                  // 2-4 sections

  // Records & superlatives
  records: Array<{
    label: string;                     // "World's Largest"
    value: string;                     // "The Liebherr T 282C can haul 400 tons"
  }>;                                  // 2-3 records

  // "Did You Know?" callouts
  didYouKnow: Array<{
    text: string;
    source?: string;                   // Optional attribution
  }>;                                  // 2-3 callouts

  // Self-check questions (for eval modes)
  selfChecks?: Array<{
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    difficulty: 'easy' | 'medium' | 'hard';
    relatedSection: 'quickFacts' | 'deepDive' | 'records' | 'didYouKnow';
  }>;

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<FactFileMetrics>) => void;
}
```

#### 3.1.4 Interaction Flow

**Phase 1: Explore**
- Student explores the Fact File by clicking through tabs (Quick Facts, Deep Dive, Records, Did You Know?)
- Each tab reveals content with smooth Lumina glass-card animations
- Key stats are always visible at the top as the "headline numbers"
- AI tutor reacts to which sections the student explores

**Phase 2: Self-Check (Eval Mode Only)**
- After exploring all sections, self-check questions appear
- Questions reference specific sections ("Based on the Deep Dive section...")
- Student must answer to complete the evaluation
- Difficulty scales with grade level and eval mode

#### 3.1.5 Eval Modes

| Eval Mode | Label | β | Scaffolding Mode | Challenge Types | Description |
|-----------|-------|---|-----------------|-----------------|-------------|
| `explore` | Explore & Recall (Guided) | 1.5 | 1 | `['recall_easy']` | Student explores all sections, then answers 3 easy recall questions with section hints visible |
| `recall` | Recall (Unguided) | 3.5 | 3 | `['recall_easy', 'recall_medium']` | Student reads the Fact File, then answers 4 questions without section hints. Mix of easy and medium. |
| `apply` | Apply & Analyze | 5.0 | 4 | `['recall_medium', 'recall_hard']` | Student answers harder questions requiring inference, comparison, or application of facts to new scenarios |

**Challenge type definitions:**

| Challenge Type | What Student Does | Example |
|---------------|-------------------|---------|
| `recall_easy` | Identify a fact directly stated in the card | "How much does a garbage truck weigh?" (answer visible in key stats) |
| `recall_medium` | Recall a fact from a specific section without hints | "What year was the first garbage truck built?" (must remember from Quick Facts) |
| `recall_hard` | Apply or connect facts across sections | "If a garbage truck compresses to 1/6 volume and carries 25 tons, roughly how much uncompressed trash is that?" |

#### 3.1.6 AI Tutoring Scaffold

```typescript
tutoring: {
  taskDescription:
    'Guide the student through a Fact File about "{{title}}" ({{category}}). '
    + 'The student explores key stats, quick facts, deep dive sections, records, and "did you know" callouts. '
    + 'Currently viewing: {{activeTab}}. Sections explored: {{sectionsExplored}} of {{totalSections}}. '
    + 'Self-check progress: {{checksCompleted}} of {{totalChecks}}.',
  contextKeys: [
    'title', 'category', 'activeTab', 'sectionsExplored', 'totalSections',
    'checksCompleted', 'totalChecks', 'currentKeyStats',
  ],
  scaffoldingLevels: {
    level1: '"Look at the key stats at the top. What number surprises you the most?"',
    level2: '"Click on the {{activeTab}} tab and read through the details. '
      + 'What connection do you see between this and the key stats?"',
    level3: '"Let me walk you through this. Start with the key stats — {{title}} has some amazing numbers. '
      + 'Now click Deep Dive to understand WHY those numbers matter. '
      + 'Finally, check the Records section for the most extreme examples."',
  },
  commonStruggles: [
    { pattern: 'Student only looks at key stats and skips other tabs', response: 'The key stats are just the beginning! Click on the other tabs — Deep Dive has the best details, and Did You Know has surprising facts.' },
    { pattern: 'Student clicks through tabs too quickly without reading', response: 'Slow down and read each section carefully. There are some amazing details hidden in there that you will want to remember.' },
    { pattern: 'Student struggles with self-check questions', response: 'Go back and re-read the section related to this question. The answer is in the facts you just explored.' },
    { pattern: 'Student does not connect facts across sections', response: 'Try to connect what you learned in different sections. How do the key stats relate to the deep dive details?' },
  ],
  aiDirectives: [
    {
      title: 'TAB EXPLORATION',
      instruction:
        'When you receive [TAB_OPENED], briefly introduce the section the student opened. '
        + 'Highlight one interesting detail to look for. If this is Deep Dive, connect it to a key stat. '
        + 'If this is Did You Know, build excitement. Keep to 1-2 sentences.',
    },
    {
      title: 'KEY STAT REACTION',
      instruction:
        'When you receive [STAT_TAPPED], react to the specific stat the student tapped. '
        + 'Provide a relatable comparison (e.g., "That is as heavy as 8 elephants!"). '
        + 'Keep to 1-2 sentences.',
    },
    {
      title: 'SELF-CHECK FEEDBACK',
      instruction:
        'When you receive [CHECK_CORRECT], celebrate briefly and reinforce the fact. '
        + 'When you receive [CHECK_INCORRECT], hint at which section contains the answer '
        + 'without revealing it. Keep to 1-2 sentences.',
    },
    {
      title: 'ALL EXPLORED',
      instruction:
        'When you receive [ALL_SECTIONS_EXPLORED], congratulate the student on reading everything. '
        + 'Ask them what their favorite fact was. If self-checks are coming, preview them. '
        + 'Keep to 2-3 sentences.',
    },
  ],
},
supportsEvaluation: true,
```

#### 3.1.7 Evaluation Metrics

```typescript
export interface FactFileMetrics extends BasePrimitiveMetrics {
  type: 'fact-file';
  sectionsExplored: number;
  totalSections: number;
  explorationCompleteness: number;     // 0-100%
  selfCheckAccuracy: number;           // 0-100%
  selfCheckAttempts: number;
  averageTimePerSection: number;       // ms
  tabsVisitedOrder: string[];          // Tracks exploration pattern
}
```

---

### 3.2 How It Works

**Primitive ID:** `how-it-works`
**Domain:** Core
**Grade Range:** K-8
**Type:** Interactive + Evaluable

#### 3.2.1 Problem Statement

Procedural knowledge — understanding how something happens step by step — is fundamental to every subject. How does a trash truck compact garbage? How does water become rain? How does a bill become a law? How does your body digest food? Currently, Bio Process Animator handles this for biology only. Media Player can narrate a process but is linear and audio-focused. There's no general-purpose step-by-step process breakdown primitive.

#### 3.2.2 Core Concept

An interactive step-by-step process diagram where students progress through a sequence of stages. Each step has a title, description, visual, and an optional "what's happening" detail. Students can navigate forward/back, and in eval mode, must demonstrate understanding by sequencing, identifying, or predicting steps.

```
┌──────────────────────────────────────────────────┐
│  ⚙️  HOW IT WORKS: Garbage Collection             │
│  ─────────────────────────────────────────────── │
│                                                  │
│   Step 2 of 5                                    │
│   ● ● ◉ ○ ○                                     │
│                                                  │
│   ┌──────────────────────────────────────────┐   │
│   │          🎨 Step Illustration              │   │
│   │    (Hydraulic arm grabbing trash bin)      │   │
│   └──────────────────────────────────────────┘   │
│                                                  │
│   🏷️ "The Hydraulic Arm Grabs the Bin"           │
│                                                  │
│   The truck's robotic arm reaches out and        │
│   clamps onto the trash bin. A sensor detects    │
│   the bin's position so the arm grabs it in      │
│   exactly the right spot.                        │
│                                                  │
│   ┌ What's Happening? ─────────────────────┐    │
│   │ Hydraulic fluid is pressurized by a     │    │
│   │ pump, pushing pistons that extend the   │    │
│   │ arm with over 2,000 lbs of force.       │    │
│   └─────────────────────────────────────────┘    │
│                                                  │
│        ◀ Previous          Next ▶               │
└──────────────────────────────────────────────────┘
```

#### 3.2.3 Data Structure

```typescript
export interface HowItWorksData {
  title: string;                       // "How Garbage Collection Works"
  subtitle: string;                    // "From curbside to landfill"
  overview: string;                    // 1-2 sentence process summary

  steps: Array<{
    stepNumber: number;
    title: string;                     // "The Hydraulic Arm Grabs the Bin"
    description: string;               // 2-3 sentences, grade-appropriate
    whatsHappening?: string;           // Deeper "science behind it" explanation
    imagePrompt: string;               // For AI image generation
    keyTerm?: {                        // Optional vocabulary callout
      term: string;
      definition: string;
    };
    funFact?: string;                  // Optional engaging detail
  }>;                                  // 4-6 steps

  // Summary / conclusion
  summary: {
    text: string;                      // "From bin to landfill, the whole process takes..."
    totalTime?: string;                // "About 15 seconds per house"
    keyTakeaway: string;               // "Modern trucks use hydraulics and sensors..."
  };

  // Challenges for eval modes
  challenges?: Array<{
    type: 'sequence' | 'identify' | 'predict' | 'explain';
    question: string;
    // For sequence: items to reorder
    sequenceItems?: Array<{ id: string; text: string }>;
    correctOrder?: string[];
    // For identify/predict: multiple choice
    options?: string[];
    correctIndex?: number;
    // For explain: key points to mention
    keyPoints?: string[];
    explanation: string;
    relatedStep: number;               // Which step this tests
  }>;

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<HowItWorksMetrics>) => void;
}
```

#### 3.2.4 Interaction Flow

**Phase 1: Step-Through Exploration**
- Student navigates through steps sequentially (or freely in older grades)
- Each step reveals with a transition animation
- "What's Happening?" section is an expandable Accordion for deeper learners
- Key terms are highlighted and tappable for inline definitions
- Progress indicator shows position in the process

**Phase 2: Comprehension Challenges (Eval Mode Only)**
- After completing the walkthrough, challenges appear based on eval mode
- Challenge types range from simple sequencing to prediction and explanation

#### 3.2.5 Eval Modes

| Eval Mode | Label | β | Scaffolding Mode | Challenge Types | Description |
|-----------|-------|---|-----------------|-----------------|-------------|
| `guided` | Guided Walkthrough | 1.5 | 1 | `['identify']` | Student walks through all steps with full guidance, then answers 3 "identify" questions (which step does X?) with steps still visible |
| `sequence` | Sequence & Identify | 3.5 | 3 | `['sequence', 'identify']` | Student must drag steps into correct order AND answer identify questions without step details visible |
| `predict` | Predict & Explain | 5.5 | 4 | `['predict', 'explain']` | Student sees partial process and must predict next step or explain why a step happens. Requires inference beyond memorization. |

**Challenge type definitions:**

| Challenge Type | What Student Does | Example |
|---------------|-------------------|---------|
| `identify` | Match a description to the correct step | "Which step involves hydraulic fluid?" → Step 2: Hydraulic Arm |
| `sequence` | Drag steps into chronological order | Reorder: [Compact → Grab bin → Dump → Drive to house → Tip into hopper] |
| `predict` | Given context, predict what happens next | "The arm just tipped the bin. What happens next?" → The trash falls into the hopper |
| `explain` | Explain why a step is necessary | "Why does the truck compact the trash?" → To fit more trash and make fewer trips |

#### 3.2.6 AI Tutoring Scaffold

```typescript
tutoring: {
  taskDescription:
    'Guide the student through a step-by-step process: "{{title}}". '
    + 'Total steps: {{totalSteps}}. Currently on step {{currentStep}}: "{{currentStepTitle}}". '
    + 'Student has explored "What\'s Happening?" detail: {{detailExpanded}}. '
    + 'Challenge progress: {{challengesCompleted}} of {{totalChallenges}}.',
  contextKeys: [
    'title', 'totalSteps', 'currentStep', 'currentStepTitle',
    'detailExpanded', 'challengesCompleted', 'totalChallenges',
  ],
  scaffoldingLevels: {
    level1: '"Read step {{currentStep}} carefully. What do you think happens next?"',
    level2: '"Look at the description for step {{currentStep}}: {{currentStepTitle}}. '
      + 'Can you explain in your own words what is happening here?"',
    level3: '"Let me walk you through this. Step {{currentStep}} is about {{currentStepTitle}}. '
      + 'Read the description first. Then open the What\'s Happening section for the science behind it. '
      + 'Think about how this connects to the previous step."',
  },
  commonStruggles: [
    { pattern: 'Student skips steps by clicking Next rapidly', response: 'Slow down! Each step builds on the last. Go back and read step {{currentStep}} — there is an important detail you need.' },
    { pattern: 'Student never opens the What\'s Happening accordion', response: 'Try opening the "What\'s Happening?" section — it explains the science behind this step and has some cool details.' },
    { pattern: 'Student struggles with sequencing challenges', response: 'Think about cause and effect. What has to happen BEFORE this step can occur? What does this step make possible?' },
    { pattern: 'Student gets predict question wrong', response: 'Go back and re-read the step before this one. The clue to what happens next is in how the previous step ends.' },
  ],
  aiDirectives: [
    {
      title: 'STEP NAVIGATION',
      instruction:
        'When you receive [STEP_CHANGED], briefly introduce the new step. '
        + 'Connect it to the previous step with a transition like "Now that X happened..." '
        + 'If the student skipped ahead, gently remind them what they missed. '
        + 'Keep to 1-2 sentences.',
    },
    {
      title: 'DETAIL EXPANSION',
      instruction:
        'When you receive [DETAIL_EXPANDED], react with enthusiasm about the deeper explanation. '
        + 'Add one relatable comparison or extra context. Keep to 1-2 sentences.',
    },
    {
      title: 'CHALLENGE FEEDBACK',
      instruction:
        'When you receive [CHALLENGE_CORRECT], celebrate and reinforce the connection. '
        + 'When you receive [CHALLENGE_INCORRECT], hint at the relevant step without giving the answer. '
        + 'For sequence challenges, ask "What needs to happen BEFORE this?" '
        + 'Keep to 1-2 sentences.',
    },
    {
      title: 'PROCESS COMPLETE',
      instruction:
        'When you receive [ALL_COMPLETE], celebrate the student\'s understanding. '
        + 'Summarize the full process in one sentence and highlight the most important takeaway. '
        + 'Keep to 2-3 sentences.',
    },
  ],
},
supportsEvaluation: true,
```

#### 3.2.7 Evaluation Metrics

```typescript
export interface HowItWorksMetrics extends BasePrimitiveMetrics {
  type: 'how-it-works';
  stepsExplored: number;
  totalSteps: number;
  detailsExpanded: number;             // How many "What's Happening?" sections opened
  sequenceAccuracy: number;            // 0-100% for sequence challenges
  identifyAccuracy: number;            // 0-100% for identify challenges
  predictAccuracy: number;             // 0-100% for predict challenges
  challengeAttempts: number;
  averageTimePerStep: number;          // ms
}
```

---

### 3.3 Timeline Explorer

**Primitive ID:** `timeline-explorer`
**Domain:** Core
**Grade Range:** K-8
**Type:** Interactive + Evaluable

#### 3.3.1 Problem Statement

Chronological understanding is fundamental across every domain: the history of aviation, the evolution of computers, the life cycle of a star, the development of a city. Evolution Timeline exists but is locked to biology. There's no general-purpose timeline that works for any topic. Generative Table can show dates, but it's a flat table — not a visual, explorable timeline.

#### 3.3.2 Core Concept

A horizontal scrollable timeline with event cards that students explore. Each event has a date/era, title, description, and visual. Events are connected by a visual "thread" showing progression. In eval mode, students must demonstrate chronological understanding through ordering, dating, or connecting events.

```
┌──────────────────────────────────────────────────┐
│  📅  TIMELINE: The History of Garbage Trucks      │
│  ─────────────────────────────────────────────── │
│                                                  │
│  1900       1930       1960       1990     2020  │
│  ──●─────────●─────────●─────────●────────●──── │
│    │         │         │         │        │     │
│    ▼         ▼         ▼       [▼]        ▼     │
│  Horse    Open-top   Rear     [Side     Smart   │
│  Carts    Trucks     Loaders  Loaders]  Trucks  │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │  📅 1969 — Side-Loading Trucks            │   │
│  │                                           │   │
│  │  🎨 [illustration of side-loader]         │   │
│  │                                           │   │
│  │  The first automated side-loader was      │   │
│  │  invented, using a mechanical arm to      │   │
│  │  pick up standardized bins. This meant    │   │
│  │  one driver could operate without a       │   │
│  │  crew of lifters.                         │   │
│  │                                           │   │
│  │  💡 Impact: Reduced crew from 3 to 1      │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│    ◀ Previous Event       Next Event ▶          │
└──────────────────────────────────────────────────┘
```

#### 3.3.3 Data Structure

```typescript
export interface TimelineExplorerData {
  title: string;                       // "The History of Garbage Trucks"
  subtitle: string;                    // "From horse-drawn carts to smart trucks"
  overview: string;                    // 1-2 sentence context-setting intro
  timeSpan: {
    start: string;                     // "1900" or "65 million years ago"
    end: string;                       // "2024" or "Present"
  };

  events: Array<{
    id: string;
    date: string;                      // "1969", "500 BC", "Cretaceous Period"
    sortOrder: number;                 // Numeric for chronological sorting
    title: string;                     // "The First Side-Loader"
    description: string;               // 2-3 sentences, grade-appropriate
    imagePrompt: string;               // For AI image generation
    impact?: string;                   // Short "why this matters" callout
    connection?: string;               // How it connects to next event
  }>;                                  // 5-8 events

  // Summary / so-what
  summary: {
    text: string;                      // "Over 120 years, garbage trucks evolved from..."
    keyTheme: string;                  // "Automation and efficiency"
    lookingForward?: string;           // "The next revolution: electric and autonomous trucks"
  };

  // Challenges for eval modes
  challenges?: Array<{
    type: 'order' | 'date' | 'cause_effect' | 'identify';
    question: string;
    // For order: events to sort
    orderItems?: Array<{ id: string; text: string }>;
    correctOrder?: string[];
    // For date/identify: multiple choice
    options?: string[];
    correctIndex?: number;
    // For cause_effect: match pairs
    causes?: string[];
    effects?: string[];
    correctPairs?: Array<[number, number]>;
    explanation: string;
    relatedEventId: string;
  }>;

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<TimelineExplorerMetrics>) => void;
}
```

#### 3.3.4 Interaction Flow

**Phase 1: Timeline Exploration**
- Student scrolls/navigates through events on the timeline
- Clicking an event node expands its detail card
- Events have visual connections showing progression
- AI tutor narrates transitions between eras
- "Impact" badges highlight why each event mattered

**Phase 2: Chronological Challenges (Eval Mode Only)**
- After exploring the timeline, challenges test chronological understanding
- Range from simple ordering to cause-effect reasoning

#### 3.3.5 Eval Modes

| Eval Mode | Label | β | Scaffolding Mode | Challenge Types | Description |
|-----------|-------|---|-----------------|-----------------|-------------|
| `explore` | Guided Exploration | 1.5 | 1 | `['identify']` | Student explores all events with full guidance, then answers 3 "which event?" identification questions with timeline visible |
| `order` | Chronological Ordering | 3.5 | 3 | `['order', 'identify']` | Student must arrange events chronologically AND identify events by description, timeline hidden during challenges |
| `connect` | Cause & Effect | 5.5 | 4 | `['cause_effect', 'date']` | Student matches causes to effects across events and places events in correct time periods. Requires understanding of *why* things happened, not just *when*. |

**Challenge type definitions:**

| Challenge Type | What Student Does | Example |
|---------------|-------------------|---------|
| `identify` | Identify an event from its description | "Which event introduced the robotic arm?" → Side-Loading Trucks (1969) |
| `order` | Drag events into chronological sequence | Reorder: [Smart trucks, Horse carts, Side-loaders, Open-top, Rear-loaders] |
| `date` | Match events to their time periods | "Place each event in the correct decade" |
| `cause_effect` | Connect what happened to why it mattered | "The side-loader was invented" → "Crew size reduced from 3 to 1" |

#### 3.3.6 AI Tutoring Scaffold

```typescript
tutoring: {
  taskDescription:
    'Guide the student through a timeline: "{{title}}" spanning {{timeSpan}}. '
    + 'Total events: {{totalEvents}}. Currently viewing event {{currentEventIndex}}: "{{currentEventTitle}}" ({{currentEventDate}}). '
    + 'Events explored: {{eventsExplored}} of {{totalEvents}}. '
    + 'Challenge progress: {{challengesCompleted}} of {{totalChallenges}}.',
  contextKeys: [
    'title', 'timeSpan', 'totalEvents', 'currentEventIndex',
    'currentEventTitle', 'currentEventDate', 'eventsExplored',
    'challengesCompleted', 'totalChallenges',
  ],
  scaffoldingLevels: {
    level1: '"Look at event {{currentEventIndex}}. When did this happen? What changed?"',
    level2: '"Read about {{currentEventTitle}} ({{currentEventDate}}). '
      + 'How is it different from the event before it? What made it possible?"',
    level3: '"Let me help you connect the dots. {{currentEventTitle}} happened in {{currentEventDate}}. '
      + 'Look at the Impact section — it tells you why this was a turning point. '
      + 'Now think about what came before and what came after."',
  },
  commonStruggles: [
    { pattern: 'Student jumps to the end without reading middle events', response: 'The middle events are where the most interesting changes happen. Go back and explore them — each one builds on the last.' },
    { pattern: 'Student struggles with chronological ordering', response: 'Think about what technology or idea had to exist FIRST before the next one could happen. Cause comes before effect.' },
    { pattern: 'Student confuses similar events', response: 'Look at the dates and the key difference between those two events. What changed between them?' },
    { pattern: 'Student does not read the Impact sections', response: 'The Impact line tells you WHY this event mattered. Read it — it helps you understand the whole timeline story.' },
  ],
  aiDirectives: [
    {
      title: 'EVENT EXPLORATION',
      instruction:
        'When you receive [EVENT_SELECTED], introduce the event with historical context. '
        + 'Connect it to the previous event with a phrase like "X years later..." or "Building on..." '
        + 'Highlight the impact. Keep to 1-2 sentences.',
    },
    {
      title: 'TIMELINE NAVIGATION',
      instruction:
        'When you receive [TIMELINE_SCROLLED], orient the student in the timeline. '
        + 'Mention what era they are looking at and what to expect. Keep to 1 sentence.',
    },
    {
      title: 'CHALLENGE FEEDBACK',
      instruction:
        'When you receive [CHALLENGE_CORRECT], reinforce the chronological connection. '
        + 'When you receive [CHALLENGE_INCORRECT], ask about cause-and-effect to guide thinking. '
        + 'For ordering: "Think about what had to happen first." '
        + 'Keep to 1-2 sentences.',
    },
    {
      title: 'TIMELINE COMPLETE',
      instruction:
        'When you receive [ALL_COMPLETE], summarize the arc of the timeline in one sentence. '
        + 'Highlight the key theme and ask the student what they think comes next. '
        + 'Keep to 2-3 sentences.',
    },
  ],
},
supportsEvaluation: true,
```

#### 3.3.7 Evaluation Metrics

```typescript
export interface TimelineExplorerMetrics extends BasePrimitiveMetrics {
  type: 'timeline-explorer';
  eventsExplored: number;
  totalEvents: number;
  orderingAccuracy: number;            // 0-100% for sequence challenges
  identifyAccuracy: number;            // 0-100% for identification
  causeEffectAccuracy: number;         // 0-100% for cause-effect matching
  challengeAttempts: number;
  averageTimePerEvent: number;         // ms
  explorationPattern: string;          // 'sequential' | 'random' | 'reverse'
}
```

---

### 3.4 Vocabulary Explorer

**Primitive ID:** `vocabulary-explorer`
**Domain:** Core
**Grade Range:** K-8
**Type:** Interactive + Evaluable

#### 3.4.1 Problem Statement

Every topic introduces specialized vocabulary. Concept Card Grid gives brief definitions for 3-4 terms but lacks context, example sentences, pronunciation, and active practice. Flashcard Deck is for rote memorization, not understanding. There's no general-purpose vocabulary primitive that teaches terms *in context* — with definitions, examples, related words, and usage — then actively tests comprehension through matching, fill-in-blank, and contextual usage challenges.

#### 3.4.2 Core Concept

A vocabulary exploration interface where students learn topic-specific terms through rich contextual definitions, then practice through progressively harder challenges. Each term has a definition, example sentence, related words, and optional pronunciation guide. Think of it as a mini-dictionary built for a specific topic, with built-in active recall.

```
┌──────────────────────────────────────────────────┐
│  📖  VOCABULARY: Garbage Truck Terms              │
│  ─────────────────────────────────────────────── │
│                                                  │
│   [Hydraulic] [Compactor] [Hopper] [Payload]     │
│    ✅          ✅          ◉        ○             │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │  📘 Hopper                                │   │
│  │                                           │   │
│  │  DEFINITION:                              │   │
│  │  The large open area at the top of the    │   │
│  │  truck where trash is dumped before being  │   │
│  │  compacted.                               │   │
│  │                                           │   │
│  │  IN A SENTENCE:                           │   │
│  │  "The hydraulic arm tipped the bin and     │   │
│  │   the trash fell into the hopper."         │   │
│  │                                           │   │
│  │  🔗 RELATED: compactor, payload, bin       │   │
│  │                                           │   │
│  │  💡 WORD PARTS:                           │   │
│  │  From "hop" — originally a container for   │   │
│  │  grain that you could "hop" things into    │   │
│  │                                           │   │
│  │  🗣️ Pronunciation: HOP-er                 │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│   ◀ Previous Term        Next Term ▶            │
│                                                  │
│   Progress: 3 of 6 terms explored                │
└──────────────────────────────────────────────────┘
```

#### 3.4.3 Data Structure

```typescript
export interface VocabularyExplorerData {
  title: string;                       // "Garbage Truck Vocabulary"
  topic: string;                       // "Garbage Trucks"
  introduction: string;                // "Learn the key terms used by..."

  terms: Array<{
    id: string;
    word: string;                      // "Hopper"
    pronunciation?: string;            // "HOP-er"
    partOfSpeech: string;              // "noun"
    definition: string;                // Grade-appropriate definition
    exampleSentence: string;           // Uses the word in topic context
    relatedWords: string[];            // Other terms in this list
    wordOrigin?: string;               // Etymology / word parts (older grades)
    imagePrompt?: string;              // Optional visual
  }>;                                  // 5-8 terms

  // Challenges for eval modes
  challenges?: Array<{
    type: 'match' | 'fill_blank' | 'context' | 'identify';
    question: string;
    // For match: pairs to connect
    matchPairs?: Array<{ term: string; definition: string }>;
    // For fill_blank: sentence with blank
    sentence?: string;
    blankWord: string;
    options?: string[];                // Distractor options
    correctIndex?: number;
    // For context: use in new sentence
    correctUsage?: string;
    // For identify: pick the right definition
    explanation: string;
    relatedTermId: string;
  }>;

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<VocabularyExplorerMetrics>) => void;
}
```

#### 3.4.4 Interaction Flow

**Phase 1: Term Exploration**
- Student navigates through vocabulary terms by clicking tabs or cards
- Each term reveals: definition, example sentence, related words, word origin
- Terms connect to each other through "Related Words" links
- AI tutor introduces each term conversationally
- Checkmarks indicate explored terms

**Phase 2: Vocabulary Challenges (Eval Mode Only)**
- After exploring all terms, challenges test comprehension
- Progressive difficulty: matching → fill-in-blank → contextual usage

#### 3.4.5 Eval Modes

| Eval Mode | Label | β | Scaffolding Mode | Challenge Types | Description |
|-----------|-------|---|-----------------|-----------------|-------------|
| `explore` | Explore & Match (Guided) | 1.5 | 1 | `['match']` | Student explores all terms, then matches terms to definitions with term cards still visible |
| `recall` | Recall & Fill (Unguided) | 3.5 | 3 | `['match', 'fill_blank']` | Student matches terms to definitions AND fills in blanks in sentences, without definitions visible |
| `apply` | Apply in Context | 5.5 | 4 | `['fill_blank', 'context']` | Student fills blanks and uses terms in new sentences/scenarios. Requires transferring vocabulary to novel contexts. |

**Challenge type definitions:**

| Challenge Type | What Student Does | Example |
|---------------|-------------------|---------|
| `match` | Drag terms to their definitions | Connect "Hopper" → "The open area where trash is dumped" |
| `fill_blank` | Choose the correct word for a sentence blank | "The ___ arm lifted the bin." → Hydraulic |
| `context` | Identify correct usage in a new context | "Which sentence uses 'compactor' correctly?" with 4 options |
| `identify` | Pick the correct definition from distractors | "What does 'payload' mean?" → The total weight of cargo carried |

#### 3.4.6 AI Tutoring Scaffold

```typescript
tutoring: {
  taskDescription:
    'Guide the student through vocabulary exploration for "{{topic}}". '
    + 'Total terms: {{totalTerms}}. Currently viewing: "{{currentWord}}" ({{partOfSpeech}}). '
    + 'Terms explored: {{termsExplored}} of {{totalTerms}}. '
    + 'Challenge progress: {{challengesCompleted}} of {{totalChallenges}}.',
  contextKeys: [
    'topic', 'totalTerms', 'currentWord', 'partOfSpeech',
    'termsExplored', 'challengesCompleted', 'totalChallenges',
  ],
  scaffoldingLevels: {
    level1: '"Read the definition of {{currentWord}}. Have you heard this word before?"',
    level2: '"Look at the example sentence for {{currentWord}}. '
      + 'Can you see how it connects to the related words listed below?"',
    level3: '"Let me help you learn {{currentWord}}. First, read the definition out loud. '
      + 'Then read the example sentence. Now look at the Word Origin section — '
      + 'knowing where a word comes from helps you remember what it means."',
  },
  commonStruggles: [
    { pattern: 'Student skips reading definitions and goes straight to challenges', response: 'Go back and read each definition carefully first. The challenges will be much easier if you understand the terms.' },
    { pattern: 'Student confuses similar terms', response: 'Compare those two terms side by side. Read both definitions and example sentences — what makes them different?' },
    { pattern: 'Student struggles with fill-in-blank challenges', response: 'Think about which word makes the sentence make sense. Try reading the sentence with each option and see which one sounds right.' },
    { pattern: 'Student does not read example sentences', response: 'The example sentence shows you how the word is actually used. Read it out loud — it makes the definition click.' },
  ],
  aiDirectives: [
    {
      title: 'TERM INTRODUCTION',
      instruction:
        'When you receive [TERM_SELECTED], pronounce the word and give a brief, '
        + 'kid-friendly introduction. Connect it to something the student might already know. '
        + 'If the word has an interesting origin, tease it. Keep to 1-2 sentences.',
    },
    {
      title: 'RELATED WORD CONNECTION',
      instruction:
        'When you receive [RELATED_WORD_CLICKED], briefly explain how the two terms '
        + 'connect to each other. Build a mental web of vocabulary. Keep to 1-2 sentences.',
    },
    {
      title: 'CHALLENGE FEEDBACK',
      instruction:
        'When you receive [CHALLENGE_CORRECT], celebrate and use the word in a new sentence '
        + 'to reinforce understanding. '
        + 'When you receive [CHALLENGE_INCORRECT], give a contextual hint — use the word\'s '
        + 'definition or origin to guide the student without giving the answer. '
        + 'Keep to 1-2 sentences.',
    },
    {
      title: 'ALL TERMS EXPLORED',
      instruction:
        'When you receive [ALL_TERMS_EXPLORED], congratulate the student and challenge them '
        + 'to use one of the new words in their own sentence. Preview the vocabulary challenges. '
        + 'Keep to 2-3 sentences.',
    },
    {
      title: 'VOCABULARY MASTERY',
      instruction:
        'When you receive [ALL_COMPLETE], celebrate vocabulary mastery. '
        + 'Mention the total terms learned and encourage the student to use them '
        + 'when talking about the topic. Keep to 2-3 sentences.',
    },
  ],
},
supportsEvaluation: true,
```

#### 3.4.7 Evaluation Metrics

```typescript
export interface VocabularyExplorerMetrics extends BasePrimitiveMetrics {
  type: 'vocabulary-explorer';
  termsExplored: number;
  totalTerms: number;
  matchAccuracy: number;               // 0-100%
  fillBlankAccuracy: number;           // 0-100%
  contextAccuracy: number;             // 0-100%
  challengeAttempts: number;
  averageTimePerTerm: number;          // ms
  relatedWordClicks: number;           // Measures curiosity/engagement
}
```

---

## 4. Manifest Integration Examples

### 4.1 Example: "Trash Trucks" (Grade 2)

```
1. curator-brief         — "Let's learn about the amazing machines that keep our streets clean!"
2. fact-file             — Key stats, fun facts, records about garbage trucks
3. image-panel           — Illustrations of different truck types
4. how-it-works          — "How a Garbage Truck Collects Trash" (5 steps)
5. image-comparison      — Before/after: empty truck vs full truck compaction
6. timeline-explorer     — "The History of Garbage Trucks" (1900–2024)
7. vocabulary-explorer   — Hydraulic, Compactor, Hopper, Payload, Landfill, Recycling
8. comparison-panel      — Side-loader vs Rear-loader
9. knowledge-check       — Final comprehension quiz
10. take-home-activity   — "Build a model garbage truck from a milk carton"
```

### 4.2 Example: "Volcanoes" (Grade 4)

```
1. curator-brief         — "Discover Earth's most powerful natural force!"
2. fact-file             — Stats: 1,500 active volcanoes, hottest lava 2,200°F, etc.
3. how-it-works          — "How a Volcano Erupts" (6 steps: pressure → magma → eruption → ash → lava → cooling)
4. image-panel           — Types of volcanoes (shield, stratovolcano, cinder cone)
5. timeline-explorer     — "Famous Eruptions Through History" (Pompeii → Krakatoa → Mt. St. Helens → Tonga)
6. vocabulary-explorer   — Magma, Lava, Tectonic Plates, Pyroclastic Flow, Caldera, Seismograph
7. foundation-explorer   — "Identify the parts of a volcano"
8. comparison-panel      — Shield volcano vs Stratovolcano
9. knowledge-check       — Assessment
```

### 4.3 Example: "Ancient Egypt" (Grade 5)

```
1. curator-brief         — "Journey back 5,000 years to the land of pharaohs and pyramids!"
2. fact-file             — Key facts: 3,000 years of civilization, 170 pharaohs, Great Pyramid stats
3. timeline-explorer     — "Ancient Egyptian History" (Old Kingdom → Middle → New → Ptolemaic)
4. how-it-works          — "How the Pyramids Were Built" (quarrying → transport → ramps → placement → casing)
5. vocabulary-explorer   — Pharaoh, Hieroglyphics, Papyrus, Sarcophagus, Dynasty, Mummification
6. image-comparison      — Ancient Nile flooding vs modern dam-controlled Nile
7. comparison-panel      — Egyptian gods: Ra vs Osiris
8. knowledge-check       — Final assessment
```

---

## 5. Implementation Priority

| Order | Primitive | Rationale |
|-------|-----------|-----------|
| 1 | **Fact File** | Simplest to build (primarily display with optional eval), fills the biggest content gap, immediately enriches every manifest |
| 2 | **How It Works** | Highest pedagogical value — procedural knowledge is universal and currently has no home |
| 3 | **Timeline Explorer** | Universal applicability — every topic has a history or progression |
| 4 | **Vocabulary Explorer** | Natural complement — once the other three exist, vocabulary ties them together |

---

## 6. Backend Integration Notes

Each eval mode defined above requires a corresponding entry in `backend/app/services/calibration/problem_type_registry.py`. The β values in the catalog `evalModes` arrays must match the backend registry exactly.

| Primitive | Eval Mode | Problem Type Key | β |
|-----------|-----------|-----------------|---|
| fact-file | explore | `fact-file:explore` | 1.5 |
| fact-file | recall | `fact-file:recall` | 3.5 |
| fact-file | apply | `fact-file:apply` | 5.0 |
| how-it-works | guided | `how-it-works:guided` | 1.5 |
| how-it-works | sequence | `how-it-works:sequence` | 3.5 |
| how-it-works | predict | `how-it-works:predict` | 5.5 |
| timeline-explorer | explore | `timeline-explorer:explore` | 1.5 |
| timeline-explorer | order | `timeline-explorer:order` | 3.5 |
| timeline-explorer | connect | `timeline-explorer:connect` | 5.5 |
| vocabulary-explorer | explore | `vocabulary-explorer:explore` | 1.5 |
| vocabulary-explorer | recall | `vocabulary-explorer:recall` | 3.5 |
| vocabulary-explorer | apply | `vocabulary-explorer:apply` | 5.5 |

---

## 7. Gemini Schema Complexity Guidelines

Per CLAUDE.md: "When Gemini schemas are too complex (6+ types, deeply nested), the LLM will produce malformed JSON."

**Mitigation strategies for these primitives:**

- **Fact File**: Keep `selfChecks` flat — no nested objects within check items. Limit to 4 checks max.
- **How It Works**: Keep `challenges` array separate from `steps`. Don't nest challenge data inside step objects.
- **Timeline Explorer**: Keep `events` array flat. Challenge data references events by `relatedEventId` string, not nested objects.
- **Vocabulary Explorer**: Keep `challenges` and `terms` as separate top-level arrays. Use `relatedTermId` for cross-reference.

All generators should use `gemini-flash-lite-latest` with `responseMimeType: "application/json"` and validate/default after parsing.
