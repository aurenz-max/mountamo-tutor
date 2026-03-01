# Interactive Book — Primitive PRD

## Overview

**Primitive ID:** `interactive-book`
**Domain:** Literacy (Reading Comprehension)
**Grade Range:** K-2
**Type:** Interactive + Evaluable
**Serves:** Text Features, Story Elements, and Comparing Texts subskills

---

## Problem Statement

K-2 students need to develop **print awareness and reading comprehension** through direct interaction with books. There are 27 subskills across three Reading Comprehension areas that involve working with book content, book structure, and comparing texts. No existing primitive simulates the experience of actually looking at and interacting with a book.

### Subskill Coverage

This single primitive can serve objectives across three strands by configuring its **mode**:

| Mode | Strand | Example Objectives |
|------|--------|-------------------|
| `text-features` | Text Features | Identify titles, author names, page numbers, headings, captions, TOC |
| `story` | Story Elements | Identify characters/settings, sequence events, find problems/solutions, recognize patterns |
| `compare` | Comparing Texts | Match characters/settings across books, compare events, express preferences |

---

## Core Concept: A Simulated Book

The primitive renders a **realistic, page-flippable book** in Lumina glass-card style. Students interact with it the way they would a real book — looking at the cover, turning pages, tapping on elements, answering questions about what they read.

```
 ┌──────────────────────────────────────────┐
 │              📖 Book Detective            │
 │  ──────────────────────────────────────  │
 │                                          │
 │   ┌─────────────────────────────────┐    │
 │   │                                 │    │
 │   │     ~~~~ 🎨 ~~~~               │    │
 │   │   The Amazing                   │    │
 │   │     Rainforest                  │    │
 │   │                                 │    │
 │   │     by Maria Santos             │    │
 │   │                                 │    │
 │   └─────────────────────────────────┘    │
 │                                          │
 │    ◀  Cover  ●○○○○  ▶                   │
 │                                          │
 │   ┌─────────────────────────────────┐    │
 │   │  💬 "Tap the title of this      │    │
 │   │       book!"                    │    │
 │   └─────────────────────────────────┘    │
 └──────────────────────────────────────────┘
```

---

## Mode 1: Text Features (`text-features`)

**Serves:** All 9 Text Features subskills (Difficulty 1-6)

### What the Book Contains
- **Cover:** Title, author name, illustration description
- **Title page:** Title, author, publisher
- **Table of contents:** 3-4 chapter headings with page numbers
- **Interior pages (3-4):** Headings, body text (1-2 short paragraphs), illustrations with captions, labels on diagrams, page numbers

### Interaction Flow

**Phase 1: Explore the Book**
- Student flips through the book freely
- Each page has tappable hotspots on text features
- Tapping reveals a label badge (e.g., "Title", "Heading", "Caption", "Page Number")
- AI tutor narrates: *"You found the title! The title tells us what this book is about."*

**Phase 2: Find the Features**
- Student is given prompts: *"Tap the heading on this page"*, *"Where is the page number?"*
- Must navigate to the correct page and tap the correct element
- Difficulty scales:
  - Easy (Diff 1-2): Cover features only — title, author
  - Medium (Diff 2-4): Interior features — headings, page numbers, labels
  - Hard (Diff 3-6): Captions, table of contents usage, creating labels

**Phase 3: Use the Features**
- Functional questions: *"Which chapter talks about animals? Use the table of contents."*
- Student navigates using features they've learned
- Tests application, not just identification

### Difficulty Scaling for Text Features

| Difficulty | Features in Play | Page Count | Question Types |
|-----------|-----------------|------------|---------------|
| 1-2 | Title, author, pictures | Cover + 1 page | Point to / name |
| 2-4 | + Page numbers, headings, labels | Cover + 3 pages | Locate / match |
| 3-5 | + Captions, TOC | Cover + TOC + 4 pages | Use to find info |
| 4-6 | All features + labeling | Full book | Create labels, dictionary entries |

---

## Mode 2: Story Reading (`story`)

**Serves:** All 9 Story Elements subskills (Difficulty 1-7)

### What the Book Contains
- **Cover:** Title, author, illustration hint
- **Pages (4-6):** Short narrative with beginning, middle, end structure
- Each page: 2-3 sentences + illustration description
- Story includes: identifiable characters, a setting, a problem, a resolution, optional repeated phrases/patterns

### Interaction Flow

**Phase 1: Read the Story**
- Student flips through pages at their own pace
- AI tutor reads aloud or provides support as needed
- Key story elements are subtly highlighted (character names in one color, setting descriptions in another)

**Phase 2: Story Challenges**
- Challenges are generated based on the target subskill:
  - **Characters (Diff 1-3):** *"Who is the main character?"* with picture-card options showing character traits
  - **Settings (Diff 2-4):** *"Where does the story take place?"* with illustration matching
  - **Sequencing (Diff 2-4):** Drag-to-order 3-4 event cards labeled Beginning/Middle/End
  - **Problem/Solution (Diff 3-5):** *"What problem did [character] have?"* → *"How was it solved?"*
  - **Patterns (Diff 3-5):** *"What phrase keeps repeating?"* → fill-in-the-pattern
  - **Illustrations & Mood (Diff 3-5):** *"How is [character] feeling on this page?"* with emotion cards
  - **Retelling (Diff 4-6):** Sequence cards + *"What did [character] say?"*
  - **Predictions & Morals (Diff 4-6):** *"What lesson does this story teach?"*
  - **Comparing versions (Diff 5-7):** Handled by Compare mode instead

### Difficulty Scaling for Story Elements

| Difficulty | Story Complexity | Question Depth |
|-----------|-----------------|----------------|
| 1-3 | 3 pages, 1 character, simple plot | Identify with picture clues |
| 3-5 | 4 pages, 2 characters, problem/solution | Analyze elements, connect illustrations |
| 4-7 | 5-6 pages, 2+ characters, pattern/moral | Retell, predict, evaluate |

---

## Mode 3: Compare (`compare`)

**Serves:** All 9 Comparing Texts subskills (Difficulty 1-7)

### What It Shows
- **Two books side by side** (split view or tabbed view on small screens)
- Each is a shorter book (cover + 2-3 pages)
- Books share some elements (similar character type, similar setting) but differ in others

### Interaction Flow

**Phase 1: Read Both Books**
- Student reads Book A, then Book B (or switches freely)
- AI highlights: *"Pay attention to the characters in each book"*

**Phase 2: Compare Challenges**
- Based on target subskill:
  - **Match characters (Diff 2-4):** *"Which character in Book B is like [character] in Book A?"*
  - **Match settings (Diff 2-4):** Visual matching of settings across books
  - **Describe similarities (Diff 3-5):** Fill-in: *"Both characters are ___"*
  - **Describe differences (Diff 3-5):** *"[Character A] is ___ but [Character B] is ___"*
  - **Venn diagram (Diff 4-6):** Drag traits into overlapping circles
  - **Preferences (Diff 4-7):** *"Which story did you like more? Tell me why."* (open response evaluated by AI)
  - **Compare events (Diff 5-7):** Sequence cards from both stories, match parallel events

### Visual: Compare Mode Split View
```
┌───────────────────┬───────────────────┐
│   📗 Book A       │   📘 Book B       │
│  ┌─────────────┐  │  ┌─────────────┐  │
│  │  The Brave  │  │  │  The Clever  │  │
│  │   Rabbit    │  │  │    Fox       │  │
│  │  by J. Lee  │  │  │  by K. Park  │  │
│  └─────────────┘  │  └─────────────┘  │
│                   │                   │
│  ◀ Page 1 of 3 ▶ │  ◀ Page 1 of 3 ▶ │
└───────────────────┴───────────────────┘
│                                       │
│  "How are Rabbit and Fox similar?"    │
│  ┌──────┐ ┌──────┐ ┌──────┐          │
│  │ Both │ │ Both │ │ Both │          │
│  │brave │ │small │ │kind  │          │
│  └──────┘ └──────┘ └──────┘          │
```

---

## Data Model

```typescript
export interface InteractiveBookData {
  title: string;              // Activity title (e.g., "Book Detective", "Story Time")
  description: string;        // Brief activity description
  gradeLevel: string;         // "K", "1", or "2"
  mode: 'text-features' | 'story' | 'compare';

  // The book(s) — 1 for text-features/story, 2 for compare
  books: Array<{
    id: string;
    coverColor: string;           // "blue", "emerald", "amber", "purple", "rose"
    bookTitle: string;
    author: string;
    coverIllustration: string;    // Description of cover art

    pages: Array<{
      id: string;
      pageNumber: number;
      heading?: string;           // Section heading (text-features mode)
      paragraphs: string[];       // 1-2 short paragraphs per page
      illustration?: string;      // Description of page illustration
      caption?: string;           // Caption for the illustration
      labels?: string[];          // Diagram labels (text-features mode)
    }>;

    // Story metadata (story/compare modes)
    characters?: Array<{
      name: string;
      trait: string;              // e.g., "brave", "curious", "kind"
      feeling?: string;           // Emotion for mood questions
    }>;
    setting?: string;
    problem?: string;
    solution?: string;
    moral?: string;
    repeatedPhrase?: string;      // For pattern recognition

    // Table of contents (text-features mode)
    tableOfContents?: Array<{
      chapter: string;
      pageNumber: number;
    }>;
  }>;

  // Challenges for Phase 2+
  challenges: Array<{
    id: string;
    phase: 'explore' | 'identify' | 'apply';
    type: ChallengeType;
    prompt: string;               // Question or instruction
    targetPage?: number;          // Which page to navigate to (if applicable)
    targetFeature?: string;       // Which element to tap (text-features)
    options?: Array<{             // Multiple choice options
      id: string;
      label: string;
      correct: boolean;
    }>;
    correctAnswer?: string;       // For fill-in or open response
  }>;

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<InteractiveBookMetrics>) => void;
}

type ChallengeType =
  | 'tap-feature'          // Tap a text feature on a page
  | 'find-page'            // Navigate to the right page using TOC/page numbers
  | 'multiple-choice'      // Choose from options
  | 'sequence'             // Order event cards
  | 'match'                // Match elements across books
  | 'fill-in'              // Complete a sentence
  | 'preference';          // Express and justify a preference
```

---

## Book Cover Visual Design

The book cover is the centerpiece. Rendered as a **tall card with gradient background**:

```
┌─────────────────────────────────┐
│  ┌───────────────────────────┐  │
│  │   ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒   │  │ ← Gradient bg from coverColor
│  │                           │  │
│  │   🌿 A tall tree with     │  │ ← Illustration description
│  │   colorful parrots        │  │    (italic, muted text)
│  │   perched on branches     │  │
│  │                           │  │
│  │ ─────────────────────── │  │ ← Subtle divider
│  │                           │  │
│  │   The Amazing             │  │ ← Title: text-3xl font-bold
│  │   Rainforest              │  │    text-white
│  │                           │  │
│  │   by Maria Santos         │  │ ← Author: text-sm text-slate-300
│  │                           │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

Cover color palette (maps to Tailwind gradients):
- `"blue"` → `from-blue-900/80 to-blue-700/60`
- `"emerald"` → `from-emerald-900/80 to-emerald-700/60`
- `"amber"` → `from-amber-900/80 to-amber-700/60`
- `"purple"` → `from-purple-900/80 to-purple-700/60`
- `"rose"` → `from-rose-900/80 to-rose-700/60`

Interior pages use a lighter `bg-slate-800/60` with clear typography.

---

## Page Navigation

- **Page dots** at bottom showing position (Cover ● ○ ○ ○ ○)
- **Arrow buttons** (◀ ▶) on either side
- **Swipe support** (optional, for touch)
- **Page flip animation** — subtle slide transition
- Current page indicator: `"Cover"`, `"Title Page"`, `"Page 1"`, etc.

---

## AI Tutoring Integration

### Pedagogical Moments

| Tag | When | Context Sent |
|-----|------|-------------|
| `[ACTIVITY_START]` | Mount | Mode, grade, book title(s) |
| `[PAGE_TURN]` | Student navigates to new page | Page number, what's on it |
| `[FEATURE_FOUND]` | Student taps a text feature (explore) | Feature type, book title |
| `[CHALLENGE_CORRECT]` | Correct answer | Challenge type, prompt, attempt # |
| `[CHALLENGE_INCORRECT]` | Wrong answer | Challenge type, student answer, correct answer, attempt # |
| `[HINT_REQUESTED]` | Student asks for help | Challenge context |
| `[PHASE_TRANSITION]` | Moving between phases | From → To |
| `[ALL_COMPLETE]` | Done | Phase scores, overall |

### Scaffolding

**Level 1 (gentle nudge):**
- Text Features: *"Look carefully at the top of the page. What do you notice?"*
- Story: *"Think about what happened first in the story."*
- Compare: *"Look at both characters. What do they both do?"*

**Level 2 (specific guidance):**
- Text Features: *"The heading is the bold text above each section. It tells you what that section is about."*
- Story: *"The problem is what goes wrong for the character. What made {{character}} sad or worried?"*
- Compare: *"In Book A, {{characterA}} is {{traitA}}. Is {{characterB}} in Book B also like that?"*

**Level 3 (detailed walkthrough):**
- Text Features: *"See these big bold words '{{heading}}'? That's a heading. It tells us this section is about {{topic}}."*
- Story: *"Let's go back to page {{page}}. See where it says '{{excerpt}}'? That's when the problem started."*
- Compare: *"{{characterA}} and {{characterB}} are both {{sharedTrait}}, but {{characterA}} solves the problem by {{approachA}} while {{characterB}} does it by {{approachB}}."*

---

## Evaluation Metrics

```typescript
export interface InteractiveBookMetrics extends BasePrimitiveMetrics {
  type: 'interactive-book';
  mode: 'text-features' | 'story' | 'compare';
  pagesVisited: number;
  featuresExplored: number;       // text-features mode
  challengeAccuracy: number;      // % correct across all challenges
  totalAttempts: number;
  correctOnFirstTry: number;
  averageAttemptsPerChallenge: number;
}
```

---

## Gemini Generator Behavior

The generator adapts based on `mode` and `gradeLevel`:

| Mode | Grade | Books | Pages/Book | Challenges |
|------|-------|-------|------------|------------|
| text-features | K | 1 nonfiction | Cover + 2 pages | 4-5 tap/find |
| text-features | 1 | 1 nonfiction | Cover + TOC + 3 pages | 5-6 tap/find/use |
| text-features | 2 | 1 nonfiction | Cover + TOC + 4 pages | 6-7 all types |
| story | K | 1 fiction | Cover + 3 pages | 3-4 identify |
| story | 1 | 1 fiction | Cover + 4 pages | 4-5 analyze |
| story | 2 | 1 fiction | Cover + 5 pages | 5-6 evaluate |
| compare | K | 2 fiction | Cover + 2 pages each | 3 match/choice |
| compare | 1 | 2 fiction | Cover + 3 pages each | 4-5 compare |
| compare | 2 | 2 fiction | Cover + 3 pages each | 5-6 compare/prefer |

Content requirements:
- **Nonfiction topics** (text-features): Animals, weather, seasons, community helpers, food, habitats
- **Fiction stories**: Simple narrative arc, relatable characters, concrete settings
- **Compare books**: Same genre/topic but different characters/approaches
- All text age-appropriate: simple sentences, high-frequency words for K; slightly longer for grades 1-2
- Paragraphs: 2-3 sentences max per paragraph for K, 3-4 for grades 1-2

---

## Scope & Boundaries

### In Scope
- Book cover rendering with tappable elements
- Page-by-page navigation with flip animation
- Text features identification (title, author, headings, page numbers, captions, TOC, labels)
- Story reading with comprehension challenges (characters, settings, events, problems, patterns, morals)
- Side-by-side book comparison with matching/preference challenges
- AI tutoring with mode-appropriate scaffolding
- Per-phase evaluation

### Out of Scope (future extensions)
- Actual audio read-aloud (use ReadAloudStudio for that)
- User-generated writing within the book (use ParagraphArchitect/OpinionBuilder)
- Real book content or copyrighted material
- Drag-and-drop sequencing (simplify to tap-to-order for v1)

---

## Implementation Priority

**V1 (this implementation):** `text-features` mode — serves the immediate learning objective ("Recognize that books have titles on their covers") and the full Text Features subskill strand.

**V2 (future):** `story` mode — adds story comprehension challenges.

**V3 (future):** `compare` mode — adds dual-book comparison view.

The data model and component structure support all three modes from day one, but V1 only renders and handles `text-features` mode. The generator also only produces `text-features` content in V1.
