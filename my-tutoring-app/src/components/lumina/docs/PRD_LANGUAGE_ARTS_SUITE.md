# PRD: Language Arts Primitive Suite

## 1. Executive Summary

**Objective:** Bridge the gap between "Early Literacy" (ABCs, tracing) and high-level "Linguistics" (syntax trees) by introducing a suite of primitives focused on **Reading Comprehension**, **Vocabulary Development**, and **Composition Structure**.

**Target Audience:** Grades 3-8 (Middle Grades)

**Success Metrics:**
- Increased engagement with long-form text.
- Improved retention of vocabulary through morphological analysis.
- Better understanding of narrative structure and logical flow.

## 2. New Primitives Overview

We will introduce three new primitives to the Lumina Registry:

1.  **`interactive-passage`** (Reading Comprehension)
2.  **`word-builder`** (Vocabulary & Morphology)
3.  **`text-sequencer`** (Composition & Structure)

---

## 3. Detailed Specifications

### 3.1 Interactive Passage (`interactive-passage`)

**Concept:** A rich text reader that transforms passive reading into active investigation. Students can highlight evidence, click words for context, and answer inline checks.

**Key Features:**
- **Evidence Highlighting:** Users can select text to answer "Find the evidence" prompts.
- **Contextual Definitions:** Clickable difficult words show definitions/synonyms.
- **Focus Mode:** Dim surrounding text to focus on specific paragraphs.
- **Inline Checks:** Small comprehension questions embedded between paragraphs.

**Data Structure (`InteractivePassageData`):**
```typescript
interface HighlightTarget {
  id: string;
  textSegment: string; // The exact text to match
  correct: boolean;
  feedback: string;
}

interface VocabularyTerm {
  word: string;
  definition: string;
  partOfSpeech: string;
}

interface PassageSection {
  id: string;
  content: string; // Markdown or HTML
  vocabulary?: VocabularyTerm[];
  inlineQuestion?: {
    prompt: string;
    options: string[];
    correctIndex: number;
  };
}

interface InteractivePassageData {
  title: string;
  author?: string;
  readingLevel?: string; // e.g., "Lexile 800L"
  sections: PassageSection[];
  highlightTask?: {
    instruction: string; // e.g., "Highlight the sentence that shows the character is angry."
    targets: HighlightTarget[];
  };
}
```

**UI/UX:**
- **Layout:** Single column, comfortable typography (serif for body).
- **Interactions:**
    - Hovering over vocab words shows a tooltip.
    - Selection menu appears on text highlight (like Medium).
    - "Check Answer" button floats when a highlight task is active.

---

### 3.2 Word Builder (`word-builder`)

**Concept:** A "morphology lab" where students construct complex words from roots, prefixes, and suffixes to understand their meaning.

**Key Features:**
- **Drag-and-Drop Construction:** Drag parts into slots to form a word.
- **Visual Breakdown:** Explodes a word into `[Pre] + [Root] + [Suf]`.
- **Meaning Synthesis:** Shows how the parts combine to create the definition (e.g., "Bio" + "Logy" = "Study of Life").

**Data Structure (`WordBuilderData`):**
```typescript
interface WordPart {
  id: string;
  text: string;
  type: 'prefix' | 'root' | 'suffix';
  meaning: string; // e.g., "Life" for "Bio"
}

interface TargetWord {
  word: string;
  parts: string[]; // IDs of the correct parts
  definition: string;
  sentenceContext: string;
}

interface WordBuilderData {
  title: string; // e.g., "Constructing Scientific Terms"
  availableParts: WordPart[]; // Pool of parts to drag from
  targets: TargetWord[]; // Words to build
}
```

**UI/UX:**
- **Layout:** "Workbench" style. Parts bin on the bottom, construction slots in the center.
- **Visuals:** Puzzle piece aesthetic for connectors.
- **Feedback:** Satisfying "snap" sound and animation when parts fit correctly.

---

### 3.3 Text Sequencer (`text-sequencer`)

**Concept:** A logic and structure tool where students arrange text segments to build coherent narratives, arguments, or processes.

**Key Features:**
- **Sortable List:** Drag and drop sentences or paragraphs.
- **Logical Connectors:** Visual indicators of flow (e.g., "Therefore", "However").
- **Structure Templates:** Guides for "Introduction", "Body", "Conclusion".

**Data Structure (`TextSequencerData`):**
```typescript
interface TextSegment {
  id: string;
  content: string;
  type?: 'intro' | 'body' | 'conclusion' | 'step';
}

interface TextSequencerData {
  title: string;
  instruction: string; // e.g., "Reorder the sentences to form a logical paragraph."
  segments: TextSegment[]; // Shuffled order initially
  correctOrder: string[]; // Array of IDs
  showHints?: boolean; // Highlight transition words
}
```

**UI/UX:**
- **Layout:** Vertical list of cards.
- **Interactions:** Drag handles on the left.
- **Validation:** "Check Order" button. Correct items turn green and lock; incorrect items shake.

---

## 4. Technical Implementation Plan

### Phase 1: Type Definitions
1.  Update `src/components/lumina/types.ts`:
    - Add `interactive-passage`, `word-builder`, `text-sequencer` to `ComponentId` enum.
    - Export interfaces defined above.
    - Add to `SpecializedExhibit` union type.

### Phase 2: Component Development
1.  Create `src/components/lumina/primitives/InteractivePassage.tsx`
2.  Create `src/components/lumina/primitives/WordBuilder.tsx`
3.  Create `src/components/lumina/primitives/TextSequencer.tsx`

### Phase 3: Registry Integration
1.  Update `src/components/lumina/config/primitiveRegistry.tsx`:
    - Import new components.
    - Register with appropriate config (e.g., `allowMultiple: true`, `sectionTitle`).

### Phase 4: AI Generation Prompts
1.  Update backend prompt templates to support generating these JSON structures based on "Language Arts" curriculum requests.

## 5. Future Considerations
- **Audio Support:** Read-aloud for the Interactive Passage.
- **Writing Mode:** Allow students to type their own sentences in the Sequencer.
- **Gamification:** Unlock new "Word Parts" for the Word Builder inventory.