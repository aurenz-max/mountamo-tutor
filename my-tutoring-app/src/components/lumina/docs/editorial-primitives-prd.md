# Editorial Primitives PRD

## Overview

A set of text-layout-first primitives that use [`@chenglou/pretext`](https://github.com/chenglou/pretext) for canvas-based text measurement and rich editorial layouts. These primitives target **reading-heavy learning experiences** — the gap between short-form card primitives (ConceptCard, CuratorBrief) and full interactive exercises (KnowledgeCheck, InteractivePassage).

### Why pretext?

Gemini generates variable-length content. Current primitives either truncate or accept awkward whitespace because CSS alone can't pre-calculate multiline text dimensions without DOM reflows. Pretext solves this:

- **`layout()`** returns exact paragraph height in ~0.09ms — no `getBoundingClientRect`, no layout thrash
- **`layoutNextLine()`** enables row-by-row text routing with variable widths — text flows around images, callouts, and interactive widgets
- **`layoutWithLines()`** exposes individual line data for column balancing, widow/orphan control, and virtualized scrolling

This unlocks editorial layouts that feel designed rather than generated.

### Target Audience

- **Grades 3–12** (reading comprehension, primary source analysis, science/history articles)
- **All subjects** — any content where students need to engage deeply with extended text

---

## Primitive 1: `MagazineSpread`

### What it does

A magazine-style editorial layout that presents Gemini-generated long-form content with professional typography: multi-column text, pull quotes, text wrapping around embedded figures, and inline interactive checkpoints.

Think of the "Situational Awareness" article layout — large serif headlines, body text flowing around images, callout boxes — but with embedded learning interactions.

### Learning goals

| Grade Band | Focus |
|------------|-------|
| 3–5 | Reading comprehension, vocabulary in context, identifying main idea |
| 6–8 | Analyzing author's purpose, evidence identification, cross-referencing sources |
| 9–12 | Rhetorical analysis, synthesizing arguments, evaluating claims with evidence |

### Interaction model

1. **Read phase** — Student reads through a multi-section article. Text flows in 1–3 columns depending on viewport width (pretext handles column balancing). Images, diagrams, and pull quotes are placed inline with text flowing around them via `layoutNextLine()` variable-width routing.

2. **Engage phase** — Inline checkpoints appear at natural break points within the text:
   - **Highlight & Annotate** — Student highlights a passage and tags it (claim, evidence, opinion, vocabulary)
   - **Inline Question** — A question appears between paragraphs; student answers before text continues revealing
   - **Vocabulary Hover** — Bolded terms expand definitions on hover/tap without disrupting layout

3. **Reflect phase** — After reading, a summary panel asks students to identify the main argument, strongest evidence, and one question they still have.

### How pretext is used

| Feature | Pretext API | Why not CSS alone |
|---------|-------------|-------------------|
| Multi-column balancing | `layout()` to pre-calculate total height, split evenly across columns | CSS `column-count` can't guarantee equal column heights with mixed content (images, callouts) |
| Text around figures | `layoutNextLine()` with variable `maxWidth` per row | CSS `float` doesn't work reliably with dynamic Gemini content + inline interactive widgets |
| Virtualized scrolling | `layoutWithLines()` for line-level height data | Long articles need virtualization for mobile; CSS gives no line-level height info |
| Widow/orphan control | `layout()` to detect single-line remainders, adjust column breaks | CSS `orphans`/`widows` is unreliable across browsers, especially with custom fonts |

### Layout structure

```
┌─────────────────────────────────────────────────────┐
│  HEADLINE (large, serif)                            │
│  Subject • Grade • Est. reading time                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────┐  Body text flows in columns,      │
│  │              │  wrapping around the figure.       │
│  │   FIGURE /   │  Pretext calculates line breaks   │
│  │   DIAGRAM    │  row-by-row with variable widths. │
│  │              │                                   │
│  └──────────────┘  Text continues after the figure  │
│                    returns to full width.            │
│                                                     │
│  ┌─ INLINE CHECKPOINT ─────────────────────────┐    │
│  │  Q: What claim does the author make here?   │    │
│  │  [ Student response area ]                  │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  "Pull quote text styled                            │
│   prominently" — Author                             │
│                                                     │
│  Column 1            │  Column 2                    │
│  Text continues...   │  Text balanced by pretext    │
│                      │  layout() height calc.       │
│                                                     │
├─────────────────────────────────────────────────────┤
│  REFLECT: Main argument? Strongest evidence?        │
└─────────────────────────────────────────────────────┘
```

### Evaluable?

Yes.

### Evaluation metrics

```typescript
interface MagazineSpreadMetrics extends BasePrimitiveMetrics {
  type: 'magazine-spread';

  // Reading engagement
  readingTimeMs: number;
  sectionsViewed: number;
  totalSections: number;
  scrollDepthPercent: number;

  // Inline checkpoints
  checkpointsCompleted: number;
  totalCheckpoints: number;
  checkpointAccuracy: number;          // 0–1

  // Annotations
  annotationsMade: number;
  annotationsByType: Record<'claim' | 'evidence' | 'opinion' | 'vocabulary', number>;

  // Reflection quality (AI-scored)
  reflectionScore: number;             // 0–1, Gemini evaluation
  mainIdeaIdentified: boolean;
  evidenceCited: boolean;
}
```

### Gemini generation schema

```typescript
interface MagazineSpreadData {
  primitive: 'magazine-spread';
  headline: string;
  subheadline?: string;
  subject: string;
  gradeLevel: string;
  estimatedReadingTime: string;
  author?: string;

  sections: MagazineSection[];

  reflectionPrompts: {
    mainIdea: string;                  // "What is the central argument?"
    evidence: string;                  // "What evidence supports it?"
    openQuestion: string;              // "What question do you still have?"
  };
}

interface MagazineSection {
  type: 'text' | 'figure' | 'pullquote' | 'checkpoint' | 'vocabulary-block';

  // type: 'text'
  body?: string;                       // Markdown-lite (bold, italic only)
  columnHint?: 'single' | 'multi';    // Pretext decides actual breaks

  // type: 'figure'
  figure?: {
    description: string;              // Alt text / AI image prompt
    caption: string;
    placement: 'left' | 'right' | 'full-width';
    widthPercent: number;             // 30–100
  };

  // type: 'pullquote'
  pullquote?: {
    text: string;
    attribution?: string;
  };

  // type: 'checkpoint'
  checkpoint?: {
    question: string;
    expectedResponse: string;         // For AI scoring
    questionType: 'open' | 'highlight' | 'multiple-choice';
    choices?: string[];               // If multiple-choice
  };

  // type: 'vocabulary-block'
  terms?: Array<{
    word: string;
    definition: string;
    contextSentence: string;
  }>;
}
```

---

## Primitive 2: `SourceAnalyzer`

### What it does

A side-by-side primary source analysis primitive. One panel shows the source document (letter, speech excerpt, scientific abstract, historical document) with professional editorial typography. The adjacent panel is an annotation workspace where students build structured analysis.

Designed for close reading — the kind of activity where students spend 15–20 minutes with a single page of text.

### Learning goals

| Grade Band | Focus |
|------------|-------|
| 3–5 | Identifying facts vs. opinions, author's purpose, basic sourcing (who wrote this? when?) |
| 6–8 | SOAP analysis (Speaker, Occasion, Audience, Purpose), corroborating sources, contextualizing evidence |
| 9–12 | Rhetorical triangle (ethos/pathos/logos), historiography, bias detection, argument mapping |

### Interaction model

1. **Source panel (left)** — The document is rendered with editorial typography. Pretext handles the layout so the text feels like a real printed document rather than a web div. Students can:
   - **Select & tag** — Highlight spans and assign tags from a configurable palette (claim, evidence, rhetoric, bias, context)
   - **Margin notes** — Tap the margin to add a short annotation anchored to a specific line (pretext provides line-level positioning)

2. **Analysis panel (right)** — A structured workspace that guides analysis:
   - **Source card** — Auto-filled or student-completed: Author, Date, Type, Audience, Purpose
   - **Evidence board** — Tagged highlights are automatically collected here, grouped by tag type
   - **Guided questions** — Scaffolded questions that adapt based on grade level and what the student has tagged so far

3. **Synthesis** — Final step: student writes a 2–3 sentence claim using evidence they tagged, with AI feedback on argument quality.

### How pretext is used

| Feature | Pretext API | Why not CSS alone |
|---------|-------------|-------------------|
| Document-faithful rendering | `prepare()` + `layout()` with period-appropriate fonts | Source documents need exact line-break control to feel authentic; CSS reflows break the illusion |
| Line-anchored margin notes | `layoutWithLines()` provides per-line Y positions | Margin annotations need pixel-accurate line anchoring; CSS line-height is approximate with mixed content |
| Highlight-to-line mapping | `walkLineRanges()` maps text offsets to visual positions | Selections that span lines need accurate per-line bounding info for highlight overlays |
| Responsive reflow without jank | `layout()` pre-calculates new dimensions before render | Resizing the source/analysis panel split must not cause visible text reflow |

### Layout structure

```
┌──────────────────────────┬──────────────────────────┐
│  SOURCE DOCUMENT         │  ANALYSIS WORKSPACE      │
│                          │                          │
│  ┌── margin ──┐          │  ┌─ Source Card ───────┐ │
│  │ [note 1]   │ Text of  │  │ Author:  __________ │ │
│  │            │ the      │  │ Date:    __________ │ │
│  │            │ primary  │  │ Type:    __________ │ │
│  │ [note 2]   │ source   │  │ Purpose: __________ │ │
│  │            │ with     │  └─────────────────────┘ │
│  │            │ [highlighted   │                    │
│  │            │  spans]  │  ┌─ Evidence Board ────┐ │
│  │            │ shown in │  │ Claims:    (2 tags)  │ │
│  │            │ editorial│  │ Evidence:  (3 tags)  │ │
│  │            │ layout   │  │ Rhetoric:  (1 tag)   │ │
│  │            │          │  └─────────────────────┘ │
│  └────────────┘          │                          │
│                          │  ┌─ Guided Question ──┐  │
│  Tag palette:            │  │ Based on your tags, │  │
│  [claim] [evidence]      │  │ what is the author  │  │
│  [rhetoric] [bias]       │  │ trying to convince  │  │
│                          │  │ the reader of?      │  │
│                          │  └─────────────────────┘  │
├──────────────────────────┴──────────────────────────┤
│  SYNTHESIS: Write your claim using tagged evidence   │
└─────────────────────────────────────────────────────┘
```

### Evaluable?

Yes.

### Evaluation metrics

```typescript
interface SourceAnalyzerMetrics extends BasePrimitiveMetrics {
  type: 'source-analyzer';

  // Engagement
  timeOnSourceMs: number;
  timeOnAnalysisMs: number;

  // Annotation quality
  totalHighlights: number;
  highlightsByTag: Record<string, number>;
  marginNotesCount: number;
  sourceCardCompleted: boolean;

  // Guided questions
  questionsAnswered: number;
  totalQuestions: number;
  questionScores: number[];            // 0–1 per question, AI-scored

  // Synthesis
  synthesisWritten: boolean;
  synthesisScore: number;              // 0–1, AI-scored
  evidenceCitedInSynthesis: number;    // How many tagged highlights referenced
  claimClarityScore: number;           // 0–1
}
```

### Gemini generation schema

```typescript
interface SourceAnalyzerData {
  primitive: 'source-analyzer';
  subject: string;
  gradeLevel: string;
  analysisFramework: 'soap' | 'rhetorical-triangle' | 'fact-opinion' | 'bias-detection';

  source: {
    title: string;
    author: string;
    date: string;
    type: 'letter' | 'speech' | 'article' | 'abstract' | 'diary' | 'legal' | 'other';
    text: string;                      // The source document text
    context: string;                   // Historical/scientific context for the teacher
    font?: string;                     // Period-appropriate font suggestion
  };

  tagPalette: Array<{
    tag: string;                       // 'claim', 'evidence', etc.
    color: string;                     // Tailwind color name
    description: string;               // Tooltip for students
  }>;

  sourceCardFields: Array<{
    label: string;
    prefilled?: string;                // Auto-filled for younger grades
    hint: string;
  }>;

  guidedQuestions: Array<{
    question: string;
    scaffoldLevel: 1 | 2 | 3;         // 1 = basic, 3 = advanced
    expectedInsights: string[];        // For AI scoring
    prerequisiteTags?: string[];       // Only show after student tags these
  }>;

  synthesisPrompt: string;            // "Using your evidence, argue that..."
}
```

---

## Technical Integration

### Installing pretext

```bash
cd my-tutoring-app && npm install @chenglou/pretext
```

### Shared layout utility

Both primitives share text measurement needs. A thin wrapper should live at:

```
my-tutoring-app/src/components/lumina/utils/editorial-layout.ts
```

This wrapper handles:
- Font loading detection (pretext needs fonts loaded before `prepare()`)
- Caching prepared text handles across re-renders
- Responsive recalculation on container resize (debounced, using `layout()` for instant re-measurement)
- Column balancing algorithm using `layout()` binary search on split points

### Rendering approach

Pretext measures text but doesn't render it. The rendering strategy:

1. **Measure** — `prepare()` + `layoutWithLines()` to get line-level geometry
2. **Position** — Map lines to absolutely-positioned `<span>` elements (DOM rendering) or draw to `<canvas>` for performance-critical paths
3. **Overlay** — Highlights, margin notes, and checkpoints are positioned using line geometry data, layered on top of the text

DOM rendering is preferred for accessibility (screen readers, text selection). Canvas rendering is a future optimization for very long documents.

### Lumina theming

Both primitives use the standard glass-card system but with editorial typography additions:

```css
/* Editorial text styles — extend Lumina's existing Tailwind config */
.editorial-headline { @apply text-4xl font-serif font-light tracking-tight text-slate-100; }
.editorial-body     { @apply text-base font-serif leading-relaxed text-slate-200; }
.editorial-caption  { @apply text-xs font-mono uppercase tracking-widest text-slate-400; }
.editorial-pullquote { @apply text-2xl font-serif italic text-slate-300 border-l-2 border-white/20 pl-6; }
```

Outer containers remain `backdrop-blur-xl bg-slate-900/40 border-white/10`.

---

## Implementation priority

| Order | Item | Rationale |
|-------|------|-----------|
| 1 | `editorial-layout.ts` utility | Shared foundation — both primitives need it |
| 2 | `MagazineSpread` | Simpler interaction model, broader subject applicability |
| 3 | `SourceAnalyzer` | More complex (dual-panel, annotation system), but high pedagogical value |

### Dependencies

- `@chenglou/pretext` — text measurement engine
- Existing: `shadcn/ui`, `lucide-react`, `useLuminaAI` hook, Gemini generator pattern
- No new backend endpoints required — these are pure frontend primitives with Gemini generation
