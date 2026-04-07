# DeepDive Primitive — Product Requirements Document

| Field   | Value        |
|---------|--------------|
| Version | 1.1          |
| Date    | April 2026   |
| Status  | **Phase 1.5 Complete** (6 blocks shipped, design system overhaul done) |

> **Implementation Status (2026-04-06):**
>
> Phase 1 delivered orchestrator + 4 block types. Phase 1.5 complete: design system overhaul (full-bleed hero, accent borders, block variants, transition cues, progress bar) + PullQuote (zero-cost inline) + Prose (Gemini Flash paragraphs + optional figure via CSS float).
>
> | Component | Status | Notes |
> |-----------|--------|-------|
> | Orchestrator Generator | Done | 2-stage: plan (Flash) + parallel block generation (Flash) |
> | DeepDive Component | Done | Phase summary, scroll tracking, AI tutoring, transition cues, progress bar |
> | Design System Overhaul | Done | Full-bleed hero, BlockWrapper variants/accents, rendered transitionCues |
> | HeroImage Block | Done | Full-bleed, no card wrapper, gradient caption overlay |
> | KeyFacts Block | Done | Hero-fact + 2-col grid, color-tinted cards, blue accent |
> | DataTable Block | Done | Emerald accent, feature variant, tinted header row |
> | MultipleChoice Block | Done | Amber accent, compact variant, amber selection state |
> | PullQuote Block | Done | Phase 1.5 — editorial rhythm block, zero-cost inline generation |
> | Prose Block | Done | Phase 1.5 — narrative text with CSS float figure layout |
> | Catalog Entry | Done | 4 eval modes (explore/recall/apply/analyze), tutoring scaffold |
> | Dedicated Tester | Done | Orchestrator plan view, block inspector, eval mode selector |
> | Backend Registry | Not started | Need problem_type_registry.py entry |
> | Timeline Block | Not started | Phase 2 |
> | CompareContrast Block | Not started | Phase 2 |
> | FillInBlank Block | Not started | Phase 2 |
> | Diagram Block | Not started | Phase 3 |
> | MiniSim Block | Not started | Phase 3 |
> | Reflection Block | Not started | Phase 3 |

---

## 1. Executive Summary

DeepDive is a **meta-primitive** — a single component that orchestrates modular building blocks into cohesive, topic-adaptive learning experiences. Unlike specialist primitives (NumberLine teaches number lines, InclinedPlane teaches physics), DeepDive doesn't know what it teaches until the orchestrator decides. You give it a topic and grade level; it assembles a rich, multi-section lesson from scratch.

This is the difference between a newspaper (fixed sections) and a CMS (assemble per story). DeepDive is Lumina's CMS for learning.

### Why DeepDive

| Problem | How DeepDive Solves It |
|---------|----------------------|
| New subjects require new primitives | DeepDive covers any topic on day one — no new code needed |
| Content density bottleneck | One orchestrator call + parallel Flash calls = full lesson in seconds |
| Manifest monotony | Dynamic block selection creates varied experiences per topic |
| The "quiz at the end" anti-pattern | MC questions are interleaved with content, not appended |
| AI tutoring is per-primitive | DeepDive assembles per-block tutoring briefs into a coherent instruction set |

### What DeepDive Is NOT

- **Not a replacement for specialist primitives.** NumberLine, InclinedPlane, TowerStacker — these handle deep interactivity that blocks can't replicate. DeepDive handles breadth; specialists handle depth.
- **Not a static template.** The orchestrator adapts block selection to the topic. "Photosynthesis" gets a diagram + data table. "The Civil War" gets a timeline + compare/contrast. The topic shapes the structure.
- **Not a lesson planner.** It generates one self-contained scroll experience, not a multi-day curriculum unit.

---

## 2. Design Principles

### 2.1 Orchestrator Intelligence, Block Simplicity

The orchestrator is the brain — it plans which blocks to use, in what order, with what content, and how the AI tutor should behave at each section. Individual blocks are dumb renderers with tight data contracts. This separation means:
- Adding a new block type = ~100-150 lines of React + a schema. No orchestrator changes needed.
- The orchestrator learns about new blocks from its prompt. Update the prompt, it starts using them.
- Block failures are isolated. If the DataTable call fails, the rest of the lesson still renders.

### 2.2 Parallel Generation, Not Sequential

The orchestrator plans first (~500 tokens output), then all block generators run in parallel via `Promise.all`. Total latency = orchestrator call + slowest block call (not sum of all calls). Image generation is the bottleneck (~3-5s); text blocks complete in <1s each.

### 2.3 Every Evaluable Block Is a Phase

MC questions, fill-in-the-blank, and future interactive blocks each map to a phase in the PhaseSummaryPanel. Even a single MC question gets its own phase. This generalizes naturally — 1 question or 10 questions, same code path, same summary UI.

### 2.4 AI Tutoring Is Assembled, Not Static

Each block gets a `tutoringBrief` from the orchestrator — what the AI should say/do when the student reaches that section. The component assembles all briefs into a coherent instruction set and signals `[SECTION_FOCUS]` events as the student scrolls. The AI tutor has narrative context across the entire lesson, not just the current block.

### 2.5 Visual Variety Is a First-Class Concern

Uniform presentation kills engagement. When every block is the same glass card with the same padding, the experience reads as "AI-generated list" regardless of content quality. The orchestrator must plan **visual rhythm** alongside content:

- **Block-type accent colors** — instant differentiation at scroll speed (blue=facts, emerald=data, amber=quiz)
- **Block variants** — `compact`, `default`, `feature` control visual weight. A crucial DataTable gets `feature`; a quick MC gets `compact`.
- **Full-bleed elements** — HeroImage breaks free of card chrome entirely. Not everything belongs in a box.
- **Transition cues** — rendered narrative connectors between blocks create flow ("Now let's look at the data...")
- **Layout variety within blocks** — KeyFacts uses hero-fact + grid, not a flat bullet list. Shape varies with content.

The goal: the same 4 block types should produce experiences that feel **designed**, not **generated**. Adding block types increases content diversity; visual variety is orthogonal and equally important.

### 2.6 Topic Shapes Structure

The orchestrator doesn't follow a fixed template. Given "Photosynthesis, Grade 5" it might produce:

```
HeroImage → KeyFacts → PullQuote → Prose (with figure) → MC → DataTable → MC → Reflection
```

Given "The Civil War, Grade 8" it produces:

```
HeroImage → Prose → PullQuote → Timeline → KeyFacts → MC → CompareContrast → DataTable → MC → MC → Reflection
```

The block mix, count, and ordering adapt to the topic's pedagogical needs. Note the interleaving of rhythm blocks (PullQuote) and narrative blocks (Prose) with structured content — this creates visual and cognitive variety that prevents the "flashcard deck" feel.

---

## 3. Architecture

### 3.1 Generation Pipeline

```
User/Manifest provides: topic + grade level + (optional) eval mode
                              |
                              v
                 +---------------------------+
                 |   ORCHESTRATOR             |
                 |   gemini-2.5-flash         |
                 |                           |
                 |   Input: topic, grade,    |
                 |          eval mode        |
                 |                           |
                 |   Output: block plan      |
                 |   - title, subtitle       |
                 |   - narrativeArc          |
                 |   - blocks[]: {           |
                 |       blockType, label,   |
                 |       brief, tutoring,    |
                 |       transitionCue       |
                 |     }                     |
                 +----------+----------------+
                            |
              +-------------+-------------+
              |             |             |
              v             v             v
       +----------+  +----------+  +----------+
       | Flash #1 |  | Flash #2 |  | Flash #3 |  ... (all parallel)
       | HeroImage|  | KeyFacts |  | MC       |
       | brief -> |  | brief -> |  | brief -> |
       | image    |  | facts[]  |  | question |
       +----------+  +----------+  +----------+
              |             |             |
              +-------------+-------------+
                            |
                            v
                 +---------------------------+
                 |  CLIENT-SIDE ASSEMBLY      |
                 |  - Validate per block      |
                 |  - Order per plan          |
                 |  - Assemble AI briefs      |
                 |  - Render as scroll page   |
                 +---------------------------+
```

### 3.2 Cost Model

| Call | Model | Tokens (est.) | Latency (est.) |
|------|-------|--------------|----------------|
| Orchestrator | gemini-2.5-flash | ~800 output | ~1s |
| KeyFacts | gemini-2.5-flash | ~200 output | <1s |
| DataTable | gemini-2.5-flash | ~400 output | <1s |
| MultipleChoice | gemini-2.5-flash | ~200 output | <1s |
| PullQuote | None | 0 (inline in plan) | 0 |
| Prose | gemini-2.5-flash | ~400 output | <1s |
| Prose figure | gemini-2.5-flash-image | image | ~3-5s |
| HeroImage meta | gemini-2.5-flash | ~150 output | <1s |
| HeroImage render | gemini-2.5-flash-image | image | ~3-5s |

**Total:** 1 orchestrator + 5-8 Flash calls = roughly the same token budget as one current generator call, but with far more structured, diverse output. Wall-clock time dominated by image generation (~5s). PullQuote adds zero latency (orchestrator generates inline).

### 3.3 File Structure

```
lumina/primitives/visual-primitives/core/deep-dive/
  DeepDive.tsx              -- Main component (scroll layout, eval, AI tutoring, transition cues)
  types.ts                  -- All block data interfaces + union type
  blocks/
    index.ts                -- Re-exports all blocks
    BlockWrapper.tsx         -- Shared glass card with variant (compact/default/feature) + accent colors
    HeroImageBlock.tsx       -- Full-bleed AI-generated image, no card wrapper
    KeyFactsBlock.tsx        -- Hero-fact + 2-col grid with color-tinted cards
    DataTableBlock.tsx       -- Emerald-accented structured table
    MultipleChoiceBlock.tsx  -- Amber-accented MC with 2-attempt logic
    PullQuoteBlock.tsx       -- Editorial pull quote, minimal chrome (Phase 1.5)
    ProseBlock.tsx           -- Narrative text with optional text-around-figure (Phase 1.5)
    [Phase 2+]
    TimelineBlock.tsx        -- Chronological events
    FillInBlankBlock.tsx     -- Sentence completion + word bank
    CompareContrastBlock.tsx -- Side-by-side comparison cards
    DiagramBlock.tsx         -- Labeled visual layout
    MiniSimBlock.tsx         -- Slider/toggle interactive
    ReflectionBlock.tsx      -- Open-ended prompt + AI response

lumina/utils/
  editorial-layout.ts       -- Pretext wrapper: font loading, cached prepare(), resize debounce

lumina/service/core/
  gemini-deep-dive.ts       -- Orchestrator + parallel block generators

lumina/components/
  DeepDiveTester.tsx         -- Dedicated tester with inspector UI
```

### 3.4 Registration Points

| File | What |
|------|------|
| `types.ts` | `'deep-dive'` in ComponentId union, `DeepDiveData` re-exported |
| `primitiveRegistry.tsx` | Component registered with `supportsEvaluation: true` |
| `catalog/core.ts` | Catalog entry with 4 eval modes + tutoring scaffold |
| `evaluation/types.ts` | `DeepDiveMetrics` interface + PrimitiveMetrics union |
| `evaluation/index.ts` | `DeepDiveMetrics` exported |
| `coreGenerators.ts` | `generateDeepDive` imported and registered |
| `App.tsx` | `DeepDiveTester` imported and rendered for `'deep-dive-tester'` panel |
| `IdleScreen.tsx` | Developer tools card for tester navigation |

---

## 4. Building Blocks (Complete Catalog)

### 4.1 Phase 1 Blocks (Shipped)

#### HeroImage
| Field | Value |
|-------|-------|
| Type | Display |
| Model | `gemini-2.5-flash-image` |
| Purpose | Anchors attention, creates emotional connection to topic |
| Data | `imageBase64`, `caption`, `altText` |
| Schema | Meta call (Flash) for prompt + caption, then image generation call |
| Notes | 16:9 aspect ratio. Falls back gracefully if image gen fails. |

#### KeyFacts
| Field | Value |
|-------|-------|
| Type | Display |
| Model | `gemini-2.5-flash` |
| Purpose | Fast knowledge transfer — the "what you need to know" |
| Data | `facts[]` — array of `{ icon: string, text: string }` |
| Schema | Flat fields: `fact0Icon`/`fact0Text` through `fact4Icon`/`fact4Text` |
| Validation | Minimum 3 facts required, rejects if fewer |

#### DataTable
| Field | Value |
|-------|-------|
| Type | Display |
| Model | `gemini-2.5-flash` |
| Purpose | Teaches relationships, categories, quantities through structured data |
| Data | `headers[]`, `rows[][]`, `caption` |
| Schema | Flat: `header0-3`, `row0col0` through `row5col3` |
| Validation | Minimum 2 columns, 3 rows. Reconstructs from flat fields. |

#### MultipleChoice
| Field | Value |
|-------|-------|
| Type | Evaluable |
| Model | `gemini-2.5-flash` |
| Purpose | Active recall checkpoint — tests comprehension of display blocks |
| Data | `question`, `options[4]`, `correctIndex`, `explanation` |
| Schema | Flat: `option0-3`, `correctIndex` (0-3), `explanation` |
| Interaction | Select option -> Check Answer. Wrong = try again (max 2 attempts). After 2 wrong, correct answer revealed. |
| Scoring | Correct on 1st attempt = 100%. Correct on 2nd = 50%. Incorrect = 0%. |
| Validation | Validates correctIndex range, requires all 4 options non-empty |

### 4.2 Phase 1.5 Blocks (Design & Narrative)

These blocks address the visual monotony problem identified after Phase 1: DeepDive experiences felt like "generic AI content" because every block was the same shape and there was no narrative prose between structured display blocks.

#### PullQuote
| Field | Value |
|-------|-------|
| Type | Display (rhythm) |
| Model | None — orchestrator generates inline |
| Purpose | Breaks visual monotony, highlights a key insight, creates editorial rhythm |
| Data | `text: string`, `attribution?: string` |
| Schema | No separate generator call — the orchestrator includes the quote text and attribution directly in the block plan's `brief` field |
| Priority | HIGH — cheapest block to add (~30 lines React), biggest visual impact per line of code |

**Design Notes:**

Pull quotes are the visual glue between content blocks. They serve the same role as in magazine layouts: slow the reader down, highlight the most important takeaway, and break up runs of same-shaped blocks.

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  ┃  "The last number you say when counting      │
│  ┃   a group is the total amount — this is      │
│  ┃   called the cardinal number."               │
│  ┃                                              │
│  ┃                   — Number Basics            │
│                                                 │
└─────────────────────────────────────────────────┘
```

Styling: `text-xl font-serif italic text-slate-300 border-l-2 border-indigo-400/40 pl-6`. No card wrapper — the pull quote floats with minimal chrome, using only the left border as its visual anchor. This deliberately contrasts with the glass-card treatment of other blocks.

**Orchestrator guidance:** Use pull quotes after a display block to highlight its most important insight before transitioning to a quiz or new topic. Never place two pull quotes adjacent. A good pull quote is 1-2 sentences — pithy, not a paragraph.

**Generation approach:** The orchestrator generates pull quote content directly in the block plan (no separate Gemini call needed). The `brief` field contains the quote text. This means pull quotes add zero latency to generation. The orchestrator already knows the narrative arc and can extract the key insight from each section's content brief.

#### Prose
| Field | Value |
|-------|-------|
| Type | Display (narrative) |
| Model | `gemini-2.5-flash` |
| Purpose | Explanatory narrative text — the connective tissue between structured blocks |
| Data | `paragraphs: string[]`, `figure?: { imageBase64: string, caption: string, altText: string, placement: 'left' \| 'right' }` |
| Schema | Flat: `paragraph0` through `paragraph3` (1-4 paragraphs), optional `figureCaption`/`figureAltText`/`figurePlacement` |
| Priority | HIGH — fills the critical gap between bullet points (KeyFacts) and structured data (DataTable) |
| Dependency | `@chenglou/pretext` for text-around-figure layout |

**Why this block matters:**

Phase 1 DeepDive has a structural gap: KeyFacts gives you bullet points, DataTable gives you structured data, but there's no way for the orchestrator to say *"explain this concept in 2-3 paragraphs."* This forces Gemini to cram explanations into fact bullets or table captions, which reads as awkward and artificial. Prose is the block type that makes DeepDive feel like an article rather than a flashcard deck.

**Design Notes:**

```
┌─────────────────────────────────────────────────┐
│  COUNTING METHODS                               │
│ ─────────────────────────────────────────────── │
│                                                 │
│  When we count large groups of objects, counting │
│  by ones becomes slow    ┌────────────────┐     │
│  and error-prone. That's │                │     │
│  why mathematicians      │   [FIGURE]     │     │
│  developed skip counting │   Hands with   │     │
│  — counting by twos,     │   fingers      │     │
│  fives, or tens.         │   grouped      │     │
│                          └────────────────┘     │
│  The key insight is that grouping doesn't       │
│  change the total — it just changes how         │
│  efficiently you reach it. A child counting 20  │
│  blocks one-by-one will get the same answer as  │
│  one who counts 4 groups of 5.                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

Text flows around the optional figure using pretext's `layoutNextLine()` API with variable `maxWidth` per line. Without a figure, the block renders as clean serif-styled paragraphs with generous line height — editorial body text, not a web div.

**Pretext integration:**

This is the block that justifies adding `@chenglou/pretext` as a dependency. The key capability: when a Prose block includes an inline figure, pretext calculates line breaks row-by-row with variable widths, so text wraps around the image naturally. CSS `float` cannot reliably achieve this with dynamic Gemini content because:

1. Float interacts unpredictably with glass-card overflow and padding
2. Content length is unknown at render time — text may be 1 paragraph or 4
3. The figure placement (left/right) needs to respect the reading flow the orchestrator planned

Pretext's approach:
1. `prepare(text, font)` — one-time measurement via offscreen canvas (~1ms)
2. `layoutNextLine(prepared, cursor, maxWidth)` — iterates line-by-line, reducing `maxWidth` for lines adjacent to the figure
3. Render lines as positioned `<span>` elements (DOM, not canvas — preserves screen reader access and text selection)

For Prose blocks **without** a figure, pretext is not needed — standard CSS renders clean paragraphs. The pretext path only activates when `figure` is present.

**Typography:**

Prose blocks use editorial styling distinct from other blocks:
- Body: `text-base font-serif leading-relaxed text-slate-200` (serif creates "article" feel)
- No card wrapper accent — prose should feel like the natural reading surface, not a highlighted section
- Paragraph spacing: `mb-4` between paragraphs, with a subtle drop cap on the first paragraph for blocks that open a new topic section

**Orchestrator guidance:** Prose blocks explain *why* something matters, provide context, or connect two structured blocks narratively. Place them between display blocks (KeyFacts → Prose → DataTable) to create reading flow. Never place Prose adjacent to another Prose block. Keep to 2-3 paragraphs — longer explanations should be split across multiple blocks with interleaved visuals.

**Generation approach:** Standard Gemini Flash call with flat schema (`paragraph0` through `paragraph3`). The brief from the orchestrator specifies the explanatory focus and tone. If a figure is included, a second parallel call generates the image (same pattern as HeroImage).

### 4.3 Phase 2 Blocks (Next)

#### Timeline
| Field | Value |
|-------|-------|
| Type | Display |
| Purpose | Causation, sequence, historical context |
| Data | `events[]` — array of `{ date, title, description }` |
| Priority | HIGH — covers history, biology, technology, and narrative topics |
| Design Notes | Vertical timeline with alternating left/right cards. Date badges. Scroll-reveal animation. |

#### FillInBlank
| Field | Value |
|-------|-------|
| Type | Evaluable |
| Purpose | Tests precise vocabulary and concept application |
| Data | `sentence`, `blankIndex`, `correctAnswer`, `wordBank[]` |
| Priority | HIGH — adds a second evaluable block type for phase variety |
| Design Notes | Sentence displayed with a highlighted blank. Word bank below as clickable chips. |

#### CompareContrast
| Field | Value |
|-------|-------|
| Type | Display |
| Purpose | Forces discrimination between related concepts |
| Data | `itemA: { title, points[] }`, `itemB: { title, points[] }` |
| Priority | MEDIUM — useful for science (plant vs animal cell), history (North vs South), etc. |
| Design Notes | Side-by-side glass cards. Shared/unique points highlighted. |

### 4.4 Phase 3 Blocks (Future)

#### Diagram
| Field | Value |
|-------|-------|
| Type | Display |
| Purpose | Spatial/structural understanding — how things connect |
| Data | `imageBase64?`, `labels[]` with `{ text, description }` |
| Priority | MEDIUM — requires image + label overlay, more complex rendering |
| Design Notes | AI-generated image with clickable label hotspots. Click reveals description. |

#### MiniSim
| Field | Value |
|-------|-------|
| Type | Evaluable |
| Purpose | Builds intuition through manipulation, not memorization |
| Data | `prompt`, `sliderLabel`, `sliderMin/Max/Default`, `outcomes[]` with range mapping |
| Priority | LOW — high design effort, niche use cases |
| Design Notes | "What happens if you increase X?" with a slider and outcome text. |

#### Reflection
| Field | Value |
|-------|-------|
| Type | Evaluable (unscored) |
| Purpose | Metacognition — "what surprised you?" / "how does this connect to..." |
| Data | `prompt` |
| Priority | LOW — requires AI response integration, unscored makes eval complex |
| Design Notes | Open-ended text input. AI tutor responds with personalized feedback. Marked as "completed" once student submits any text. |

### 4.5 Block Expansion Strategy

New blocks can be added without changing the orchestrator logic or the DeepDive component:

1. **Define interface** in `types.ts` (add to `BlockType` union + create data interface)
2. **Write block component** in `blocks/` (~100-150 lines of React)
3. **Add generator function** in `gemini-deep-dive.ts` (schema + Gemini call + validation)
4. **Add to block router** in `generateBlock()` switch statement
5. **Update orchestrator prompt** to describe the new block type
6. **Export from `blocks/index.ts`** and **import in `DeepDive.tsx`** render switch

Future block ideas beyond the 10:
- **CodeSnippet** — syntax-highlighted code with "predict the output"
- **MapView** — geography, migration patterns, trade routes
- **EquationStep** — step-by-step derivation with "what comes next?"
- **DebateCards** — opposing viewpoints, student picks a side
- **VocabMatch** — drag-and-drop term/definition pairing
- **AudioClip** — pronunciation, music theory, language learning

---

## 5. Eval Modes

DeepDive eval modes control the orchestrator's block selection and cognitive demand — not challenge types within a single block.

| Eval Mode | Beta | Block Mix | Cognitive Demand |
|-----------|------|-----------|-----------------|
| `explore` | -1.5 | HeroImage + KeyFacts + 1-2 easy MC. Mostly consumption. | Low — basic recall of explicitly stated facts |
| `recall` | -0.5 | More MC blocks. Direct recall from display blocks above. | Medium-low — retrieval practice |
| `apply` | 0.5 | DataTable + MC requiring cross-referencing. Multi-step. | Medium-high — application and analysis |
| `analyze` | 1.5 | 3-4 hard MC + synthesis. Student must connect across blocks. | High — synthesis and transfer |

### Future: `transfer` Mode (beta 2.5)

The orchestrator introduces a novel context the student hasn't seen. "Given what you learned about photosynthesis, how would you explain why coral reefs bleach?" This requires Phase 3 blocks (Reflection, MiniSim) to work well.

---

## 6. AI Tutoring Architecture

### 6.1 Per-Block Briefs

The orchestrator generates a `tutoringBrief` for each block — a 1-2 sentence instruction for the AI tutor. Examples:

| Block | Tutoring Brief |
|-------|---------------|
| HeroImage (photosynthesis) | "Introduce the topic. Ask what the student notices in the image. Point out the chloroplasts if visible." |
| KeyFacts | "Let the student read through the facts. If they seem interested in one, expand on it. Don't quiz them yet." |
| MC (after DataTable) | "If the student struggles, reference the third row of the data table above — that's where the answer lives." |

### 6.2 Assembly + Interference Check

The DeepDive component concatenates all block tutoring briefs into a single AI instruction set, formatted as numbered sections:

```
Section 1 (hero-image): Introduce the topic...
Section 2 (key-facts): Let the student read...
Section 3 (multiple-choice): If the student struggles...
```

**Interference checking** (Phase 2): Before sending to the AI, validate that no two sections give contradictory instructions (e.g., "don't quiz them yet" followed immediately by "ask them a question"). Log warnings for iteration.

### 6.3 Scroll-Triggered Events

The component uses IntersectionObserver to detect which block is in view and sends `[SECTION_FOCUS]` events to the AI tutor as the student scrolls:

```
[SECTION_FOCUS] Student is now viewing: Key Facts (key-facts). Let the student read...
[ANSWER_CORRECT] Student answered "Quick Quiz" correctly in 1 attempt. Brief congratulation.
[ALL_COMPLETE] Phase scores: Knowledge Check 100% (1 attempts). Overall: 100%.
```

---

## 7. UX Specification

### 7.1 Layout

Vertical scroll, single column with **varied visual weight**. Not every block is a glass card — the design system creates hierarchy through intentional variation:

- **Full-bleed blocks** (HeroImage) — edge-to-edge, no card wrapper, maximum visual impact
- **Accented card blocks** (KeyFacts=blue, DataTable=emerald, MC=amber) — glass card with colored left border for instant type recognition
- **Minimal chrome blocks** (PullQuote) — no card wrapper, just a left border and serif text. Floats between cards as editorial punctuation.
- **Editorial blocks** (Prose) — glass card but with serif typography and optional text-around-figure layout. Reads as article body text, not a widget.
- **Transition cues** — italicized narrative text between blocks with fading divider lines. Orchestrator-generated, not hardcoded.

The header card shows:
- "Deep Dive" badge with section and question counts
- Title and subtitle from orchestrator
- Segmented progress bar (one segment per block — display blocks filled, evaluable blocks glow amber until answered then turn emerald)

### 7.2 Scroll Behavior

Blocks render in orchestrator-planned order. No pagination, no tabs — continuous vertical scroll. The progress bar at the top updates via IntersectionObserver as blocks enter/exit the viewport center. Transition cues between blocks create narrative flow as the student scrolls.

### 7.3 Phase Summary

When all evaluable blocks are answered, the PhaseSummaryPanel animates in at the bottom. Each evaluable block type is a phase. Score ring, per-phase breakdown, elapsed time.

### 7.4 Tester UI

The dedicated tester (`DeepDiveTester`) provides developer tooling beyond the standard primitive tester:

```
+-------------------+----------------------------------+
| Controls          | Full Render Preview              |
|                   |                                  |
| [Topic input]     | +------------------------------+ |
| [Grade selector]  | | Deep Dive: Photosynthesis    | |
| [Eval mode]       | |                              | |
| [Generate]        | | [HeroImage]                  | |
|                   | | [KeyFacts]                   | |
| Orchestrator Plan | | [DataTable]                  | |
| +---------------+ | | [MC Question 1]              | |
| | 7 blocks      | | | [MC Question 2]              | |
| | 3 interactive | | | [PhaseSummary]               | |
| | hero-image    | | +------------------------------+ |
| | key-facts     | |                                  |
| | data-table    | | [Raw JSON accordion]             |
| | MC            | |                                  |
| | MC            | |                                  |
| | ...           | |                                  |
| +---------------+ |                                  |
|                   |                                  |
| Block Inspector   |                                  |
| [1][2][3][4][5]   |                                  |
| +---------------+ |                                  |
| | block type    | |                                  |
| | AI brief      | |                                  |
| | transition    | |                                  |
| | raw JSON      | |                                  |
| +---------------+ |                                  |
|                   |                                  |
| Eval Results      |                                  |
| +---------------+ |                                  |
| | Score | Time  | |                                  |
| +---------------+ |                                  |
+-------------------+----------------------------------+
```

---

## 8. Phased Delivery Roadmap

### Phase 1: Prove the Orchestrator (COMPLETE)

**Goal:** Prove that the orchestrator + parallel Flash pattern produces cohesive, renderable lessons.

**Delivered:**
- DeepDive component with scroll tracking, phase summary, AI tutoring
- 4 blocks: HeroImage, KeyFacts, DataTable, MultipleChoice
- Orchestrator generator with eval mode guidance
- Dedicated tester with block inspector
- Full registration: types, registry, catalog, eval metrics, coreGenerators

**Key question answered:** Does the orchestrator produce coherent block plans that render as a unified experience? YES — the block briefs create narrative flow, and parallel generation keeps latency manageable.

### Phase 1.5: Design System + Narrative Blocks (IN PROGRESS)

**Goal:** Make DeepDive feel designed, not generated. Address the visual monotony problem before investing in more block types.

**Problem statement:** Phase 1 produced functional lessons that read as "generic AI content" — every block was the same glass card with the same padding, creating a Notion-page feel rather than an adaptive learning experience. The fix is orthogonal to block diversity: it's about visual variety within the orchestrator's rendering layer.

**Design system overhaul (DONE):**
- HeroImage → full-bleed, no card wrapper, stronger gradient overlay
- BlockWrapper → `variant` prop (compact/default/feature) + `accent` prop (colored left borders)
- KeyFacts → hero-fact + 2-column grid with color-tinted cards
- DataTable → emerald accent, feature variant, tinted header
- MultipleChoice → amber accent, compact variant
- TransitionCues → rendered between blocks as narrative connectors
- ProgressBar → segmented header bar showing block progress

**New blocks:**
- `PullQuoteBlock` — zero-generation-cost editorial rhythm block. Orchestrator generates inline.
- `ProseBlock` — narrative explanatory text with optional text-around-figure layout via `@chenglou/pretext`. Fills the critical gap between bullet points and structured data.

**Pretext integration:**
- Install `@chenglou/pretext` for Prose block's text-around-figure capability
- Shared utility at `lumina/utils/editorial-layout.ts`: font loading, cached `prepare()`, resize debounce
- Pretext only activates when Prose block has an inline figure; plain paragraphs use standard CSS
- This establishes the foundation for future editorial blocks (MagazineSpread, SourceAnalyzer)

**Key question to answer:** Does the visual variety + narrative prose transform the "generic AI" feel into something that reads as authored? Test with the same topics from Phase 1 and compare.

### Phase 2: Eval + Block Expansion

**Goal:** Add evaluable diversity and coverage depth.

**Blocks to add:**
- `TimelineBlock` — covers history/sequence topics the orchestrator currently can't serve
- `FillInBlankBlock` — second evaluable type for richer phase summaries
- `CompareContrastBlock` — A vs B analysis for science, history, geography

**Other work:**
- Backend `problem_type_registry.py` entry for IRT calibration
- AI instruction interference checking
- Eval mode semantic differentiation testing (do explore vs analyze outputs actually differ?)

### Phase 3: Deep Interactivity

**Goal:** Move beyond display + MC into manipulable, reflective blocks.

**Blocks to add:**
- `DiagramBlock` — labeled image with clickable hotspots
- `MiniSimBlock` — slider/toggle "what if" interactives
- `ReflectionBlock` — open-ended prompt with AI response

**Other work:**
- `transfer` eval mode (beta 2.5) — novel context application
- Block-to-block data references (MC question can reference a specific DataTable cell)
- Generation quality metrics (track rejection rates per block type)

### Phase 4: Scale and Polish

**Goal:** Harden for production manifest usage.

**Work:**
- Caching layer for repeated topic generation
- Block rendering quality audit (mobile responsiveness, a11y)
- Orchestrator prompt tuning based on tester feedback
- A/B testing: DeepDive vs traditional manifest for topic comprehension

---

## 9. Metrics & Success Criteria

### 9.1 Generation Quality

| Metric | Target |
|--------|--------|
| Block rejection rate | <10% (blocks that fail generation and are filtered out) |
| Orchestrator plan validity | 100% (no plans with 0 valid blocks) |
| MC answer derivability | 100% (correct answer always in options, correctIndex valid) |
| Image generation success | >80% (graceful fallback when image gen fails) |

### 9.2 Pedagogical Quality

| Metric | Target |
|--------|--------|
| MC questions reference prior display blocks | >90% (not standalone trivia) |
| Block type variety per lesson | >= 3 distinct block types |
| Eval mode differentiation | Explore produces measurably easier MC than Analyze |

### 9.3 Performance

| Metric | Target |
|--------|--------|
| Total generation latency | <8s (including image) |
| Text block generation | <2s each |
| Orchestrator planning | <2s |

---

## 10. Open Questions

1. **Image caching:** Should we cache hero images for repeated topics? A "Photosynthesis" DeepDive always generates a new image. Caching would save cost but reduce variety.

2. **Block-to-block references:** Can the orchestrator tell a MC question "reference the 3rd row of the DataTable"? Currently, blocks are generated independently. Cross-referencing would improve pedagogical coherence but complicates the parallel generation pattern.

3. **Mobile layout:** Blocks are single-column which works on mobile, but DataTable may need horizontal scroll on small screens. How aggressively should we constrain table column count for mobile?

4. **Manifest integration priority:** Should DeepDive be available to the manifest planner immediately, or should we validate quality through the tester first? Recommendation: tester-only until Phase 2 is complete and eval mode differentiation is verified.

5. **Block weight limits:** Should the orchestrator be constrained on how many of each block type it can use? Currently it could plan 5 MC questions and 0 display blocks. The prompt discourages this, but there's no hard constraint.
