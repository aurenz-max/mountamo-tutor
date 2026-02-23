# PRD: FastFact — Core Fluency Drill Primitive

**Status:** Draft
**Date:** 2026-02-23
**Author:** Claude (PRD), Human (vision)
**Origin:** Generalized from `MathFactFluency` primitive

---

## 1. Problem Statement

MathFactFluency is one of our most engaging primitives — timed challenges, streak tracking, visual aids, speed metrics — but its value is locked inside math. The same "rapid recall" pattern applies across every subject:

| Subject | Fluency Target |
|---------|---------------|
| **Math** | 3 + 2 = ?, 7 x 8 = ?, fraction equivalents |
| **Literacy** | Sight word recognition, phoneme → grapheme, vocabulary → definition |
| **Science** | Element symbol → name, organ → function, planet → position |
| **History/Social Studies** | Date → event, figure → contribution, capital → country |
| **World Languages** | Word → translation, verb → conjugation |
| **Music** | Note → name, key signature → scale |

Today, building fluency drills for a new subject means cloning 1,000+ lines of MathFactFluency and rewriting domain-specific logic. FastFact eliminates this by extracting the **timed drill engine** into a core primitive with pluggable content.

---

## 2. Goals

1. **One primitive, all subjects.** A single `FastFact` component in `primitives/core/` that any Gemini generator can target.
2. **Preserve what works.** Timer arc, streak tracking, speed metrics, phase progression, PhaseSummaryPanel, AI tutoring hooks — all carry over from MathFactFluency.
3. **Domain content via generators.** Subject-specific knowledge (math equations, vocab definitions, element symbols) lives entirely in generators and catalog entries, not in the component.
4. **Visual extensibility.** Support optional rich visuals (images, SVG, emoji, LaTeX) without requiring them — text-only drills should work out of the box.
5. **Backward compatibility.** MathFactFluency continues to work as-is. FastFact is a *new* core primitive, not a rewrite.

---

## 3. Non-Goals

- Replacing MathFactFluency (it has math-specific visual renderers like DotArray and TenFrame that don't generalize).
- Adaptive difficulty within a single session (generator handles difficulty at generation time).
- Multiplayer / competitive mode.
- Audio-only challenges (future extension).

---

## 4. Data Model

### 4.1 FastFactChallenge (Individual Drill Item)

```ts
interface FastFactChallenge {
  id: string;

  // Phase grouping (drives PhaseSummaryPanel)
  type: string;                        // e.g. 'recall', 'match', 'fill-in', 'speed-round'

  // Prompt — what the student sees
  prompt: {
    text: string;                      // Primary prompt text: "What is 3 + 2?" or "What element has symbol Fe?"
    subtext?: string;                  // Optional secondary line: "Choose the correct answer"
    visual?: FastFactVisual;           // Optional rich visual
  };

  // Answer
  correctAnswer: string;              // Canonical correct answer (always string for uniformity)
  acceptableAnswers?: string[];       // Alternative acceptable answers (case-insensitive): ["iron", "Iron", "Fe"]

  // Response mode (how the student answers)
  responseMode: 'choice' | 'type' | 'match';

  // Choice mode
  options?: string[];                 // ["5", "4", "6", "3"] — choice buttons

  // Match mode
  matchPairs?: {                      // Left-to-right matching
    left: string;                     // What's shown (prompt side)
    right: string;                    // What student selects from
  };

  // Timing
  timeLimit?: number;                 // Override per-challenge (seconds)

  // Metadata for AI tutoring
  explanation?: string;               // Brief explanation shown after answer: "Fe comes from Latin 'ferrum'"
  difficulty?: 'easy' | 'medium' | 'hard';
}
```

### 4.2 FastFactVisual (Pluggable Visuals)

```ts
interface FastFactVisual {
  type: 'emoji' | 'image' | 'latex' | 'svg-inline' | 'text-large';

  // Exactly one of these, matching type:
  emoji?: string;                     // "🔬" or "🇫🇷"
  imageUrl?: string;                  // URL to image asset
  latex?: string;                     // LaTeX string: "\\frac{3}{4}"
  svgMarkup?: string;                 // Inline SVG string (for simple diagrams)
  largeText?: string;                 // Big styled text: "Fe" for element symbol

  alt?: string;                       // Accessibility description
}
```

### 4.3 FastFactData (Top-Level Props)

```ts
interface FastFactData {
  title: string;
  description?: string;
  subject: string;                    // 'math' | 'literacy' | 'science' | 'history' | 'language' | string
  challenges: FastFactChallenge[];

  // Timing
  defaultTimeLimit: number;           // Default seconds per challenge (3-10)
  targetResponseTime: number;         // "Fast" threshold in seconds

  // Phase config (drives PhaseSummaryPanel theming)
  phaseConfig: Record<string, {
    label: string;
    icon: string;
    accentColor: string;
  }>;

  // Display options
  showStreakCounter: boolean;          // Show "X in a row!" badge
  showAccuracy: boolean;              // Show running accuracy %
  maxAttemptsPerChallenge: number;    // 1 for speed-rounds, 2 for normal

  // Grade context
  gradeBand?: string;                 // 'K' | '1' | '2' | '3-5' | '6-8' | '9-12'

  // Evaluation props (auto-injected)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<FastFactMetrics>) => void;
}
```

### 4.4 FastFactMetrics (Evaluation)

```ts
interface FastFactMetrics extends BasePrimitiveMetrics {
  type: 'fast-fact';
  subject: string;
  accuracy: number;                   // 0-100
  averageResponseTime: number;        // ms
  fastAnswerCount: number;            // Answers within targetResponseTime
  bestStreak: number;
  attemptsCount: number;
  challengesTotal: number;
  challengesCorrect: number;
}
```

---

## 5. Component Architecture

### 5.1 File Location

```
primitives/
├── core/
│   └── FastFact.tsx          ← NEW: The core primitive
├── visual-primitives/
│   └── math/
│       └── MathFactFluency.tsx   ← UNCHANGED (kept for math-specific visuals)
```

### 5.2 Internal Structure

```
FastFact.tsx
├── FastFactVisualRenderer     — Renders visual by type (emoji/image/latex/svg/text)
├── TimerArc                   — Reused circular countdown (extracted or copied from MathFactFluency)
├── ChoiceGrid                 — Renders option buttons
├── TypedInput                 — +/- stepper or free-text input (auto-detected)
├── MatchSelector              — Left→right match UI
├── useChallengeProgress()     — Shared hook (existing)
├── usePhaseResults()          — Shared hook (existing)
├── usePrimitiveEvaluation()   — Shared hook (existing)
├── useLuminaAI()              — Shared hook (existing)
└── PhaseSummaryPanel          — Shared component (existing)
```

### 5.3 Key Behaviors

| Behavior | Implementation |
|----------|---------------|
| **Timer** | Countdown arc per challenge. Color transitions: green > amber > red. Time-up = auto-wrong. |
| **Streak** | Consecutive correct counter. Displayed as animated badge at 2+. Best streak tracked for metrics. |
| **Speed scoring** | `responseTime <= targetResponseTime` → "fast" answer. Highlighted in feedback. |
| **Feedback** | Brief text: "Correct!" / "Lightning fast!" / "Not quite. The answer is X." + optional `explanation`. |
| **Auto-advance** | After showing feedback for 1.5s on incorrect, enable "Next" button. Correct answers show "Next" immediately. |
| **Phase summary** | Groups challenges by `type` field. PhaseSummaryPanel renders scores per phase at completion. |
| **Input detection** | `responseMode: 'choice'` → buttons. `'type'` → if all answers are numeric, show +/- stepper; otherwise free text input. `'match'` → match UI. |

---

## 6. Generator Pattern

Each subject gets its own generator file. The generator's job is to produce `FastFactData` tailored to the subject and grade level.

### 6.1 Example: Science Facts Generator

```
service/
├── science/
│   └── gemini-science-fast-fact.ts    ← NEW
├── literacy/
│   └── gemini-literacy-fast-fact.ts   ← NEW
├── math/
│   └── gemini-math-fast-fact.ts       ← NEW (separate from gemini-math-fact-fluency.ts)
```

### 6.2 Generator Contract

Every FastFact generator must:

1. **Import** `FastFactData` and `FastFactChallenge` from the component.
2. **Define** a Gemini JSON schema matching the interface (simplified — flat where possible).
3. **Validate** output: ensure `correctAnswer` is in `options` (for choice mode), strip duplicate challenges, verify `phaseConfig` keys match challenge types.
4. **Return** a valid `FastFactData` object.

### 6.3 Catalog Entries (One Per Subject)

```ts
// catalog/core.ts — add to CORE_CATALOG
{
  id: 'fast-fact',
  description: 'Timed fluency drill for rapid recall across any subject. '
    + 'Supports choice, type-in, and match response modes. '
    + 'Configurable phases, time limits, and visual prompts. '
    + 'Use for: math facts, sight words, vocabulary, element symbols, '
    + 'dates & events, translations — any domain requiring automaticity.',
  constraints: 'Best for factual recall (not reasoning or multi-step problems). '
    + 'Challenges should have single correct answers. '
    + 'Keep to 8-15 challenges per session for engagement.',
  supportsEvaluation: true,
  tutoring: {
    taskDescription: '...',
    contextKeys: [
      'subject', 'challengeType', 'promptText', 'correctAnswer',
      'responseMode', 'attemptNumber', 'streak', 'accuracy',
      'averageTime', 'totalChallenges', 'currentIndex',
      'gradeBand', 'targetResponseTime', 'difficulty',
    ],
    scaffoldingLevels: { ... },
    commonStruggles: [ ... ],
    aiDirectives: [ ... ],
  },
}
```

---

## 7. How This Differs from MathFactFluency

| Aspect | MathFactFluency | FastFact |
|--------|----------------|----------|
| **Location** | `visual-primitives/math/` | `core/` |
| **Challenge model** | Math-specific: `operand1`, `operand2`, `result`, `operation`, `unknownPosition` | Domain-agnostic: `prompt.text`, `correctAnswer`, `options` |
| **Visual aids** | Built-in SVG renderers (DotArray, TenFrame, Fingers) | Pluggable `FastFactVisual` (emoji, image, latex, svg, text) |
| **Answer input** | Numeric-only (buttons or +/- stepper) | String-based (buttons, free text, or match) |
| **Equation formatting** | `formatEquation()` with math operator symbols | Generator provides ready-to-display `prompt.text` |
| **Generator validation** | Math correctness (operand1 + operand2 = result) | Generic (correctAnswer in options, types match) |
| **Shared infrastructure** | Timer, streaks, phases, evaluation, AI hooks | Same — reuses all shared hooks |

**MathFactFluency is NOT deprecated.** It provides richer math-specific experiences (visual dot arrays, ten-frames, equation formatting, operand-level tracking). FastFact is for everything else — and for simpler math drills where the full MathFactFluency visual suite isn't needed.

---

## 8. Subject Examples

### 8.1 Literacy — Sight Word Fluency

```json
{
  "title": "Sight Word Speed Drill",
  "subject": "literacy",
  "defaultTimeLimit": 5,
  "targetResponseTime": 3,
  "gradeBand": "K",
  "phaseConfig": {
    "recognize": { "label": "Recognize", "icon": "👁️", "accentColor": "blue" },
    "spell": { "label": "Spell", "icon": "✏️", "accentColor": "purple" },
    "speed-round": { "label": "Speed Round", "icon": "⚡", "accentColor": "orange" }
  },
  "challenges": [
    {
      "id": "sw-1",
      "type": "recognize",
      "prompt": { "text": "Which word is 'the'?", "visual": { "type": "text-large", "largeText": "the" } },
      "correctAnswer": "the",
      "responseMode": "choice",
      "options": ["the", "teh", "hte", "eth"],
      "timeLimit": 5
    },
    {
      "id": "sw-2",
      "type": "spell",
      "prompt": { "text": "Type the word you see:", "visual": { "type": "text-large", "largeText": "said" } },
      "correctAnswer": "said",
      "acceptableAnswers": ["Said", "SAID"],
      "responseMode": "type",
      "timeLimit": 8
    }
  ]
}
```

### 8.2 Science — Element Symbol Recall

```json
{
  "title": "Element Symbol Flash",
  "subject": "science",
  "defaultTimeLimit": 5,
  "targetResponseTime": 3,
  "gradeBand": "6-8",
  "phaseConfig": {
    "symbol-to-name": { "label": "Symbol → Name", "icon": "🔬", "accentColor": "emerald" },
    "name-to-symbol": { "label": "Name → Symbol", "icon": "📝", "accentColor": "blue" },
    "speed-round": { "label": "Speed Round", "icon": "⚡", "accentColor": "orange" }
  },
  "challenges": [
    {
      "id": "elem-1",
      "type": "symbol-to-name",
      "prompt": { "text": "What element is this?", "visual": { "type": "text-large", "largeText": "Fe" } },
      "correctAnswer": "Iron",
      "acceptableAnswers": ["iron", "IRON"],
      "responseMode": "choice",
      "options": ["Iron", "Fluorine", "Francium", "Fermium"],
      "explanation": "Fe comes from the Latin 'ferrum'"
    }
  ]
}
```

### 8.3 World Languages — Vocabulary Speed

```json
{
  "title": "Spanish Vocab Sprint",
  "subject": "language",
  "defaultTimeLimit": 6,
  "targetResponseTime": 3,
  "gradeBand": "3-5",
  "phaseConfig": {
    "translate": { "label": "Translate", "icon": "🌍", "accentColor": "blue" },
    "reverse": { "label": "Reverse", "icon": "🔄", "accentColor": "purple" },
    "speed-round": { "label": "Speed Round", "icon": "⚡", "accentColor": "orange" }
  },
  "challenges": [
    {
      "id": "sp-1",
      "type": "translate",
      "prompt": { "text": "What does 'gato' mean in English?", "visual": { "type": "emoji", "emoji": "🐱" } },
      "correctAnswer": "cat",
      "acceptableAnswers": ["Cat", "a cat"],
      "responseMode": "choice",
      "options": ["cat", "dog", "bird", "fish"]
    }
  ]
}
```

---

## 9. Implementation Plan

### Phase 1: Core Component (MVP)

| Step | Files | Description |
|------|-------|-------------|
| 1 | `primitives/core/FastFact.tsx` | Component with `choice` and `type` response modes. Timer, streak, phases, evaluation, AI hooks. |
| 2 | `types.ts` | Add `'fast-fact'` to ComponentId union, export `FastFactData` |
| 3 | `evaluation/types.ts` | Add `FastFactMetrics` interface and union member |
| 4 | `config/primitiveRegistry.tsx` | Register component with `supportsEvaluation: true` |
| 5 | `service/manifest/catalog/core.ts` | Add catalog entry with tutoring metadata |

### Phase 2: First Generators

| Step | Files | Description |
|------|-------|-------------|
| 6 | `service/math/gemini-math-fast-fact.ts` | Math facts generator (simpler than MathFactFluency — no visual renderers) |
| 7 | `service/literacy/gemini-literacy-fast-fact.ts` | Sight words, phonics, vocabulary |
| 8 | `service/science/gemini-science-fast-fact.ts` | Element symbols, body systems, planet facts |
| 9 | `service/registry/generators/` | Register all three generators |

### Phase 3: Match Mode + Visuals

| Step | Files | Description |
|------|-------|-------------|
| 10 | `FastFact.tsx` | Add `match` response mode UI |
| 11 | `FastFact.tsx` | Add `image` and `latex` visual renderers |
| 12 | Additional generators | History, world languages, music |

### Phase 4: Migration Pathway (Optional, Future)

- Evaluate whether MathFactFluency sessions that don't use visual aids (DotArray, TenFrame) could use FastFact instead.
- MathFactFluency remains the "premium" math drill with specialized visual pedagogical tools.

---

## 10. Success Metrics

| Metric | Target |
|--------|--------|
| **Subject coverage** | 3+ subjects using FastFact within 2 weeks of launch |
| **Generator LOC** | Each new subject generator < 200 lines (vs 420 for MathFactFluency) |
| **Component reuse** | 0 lines of timer/streak/phase logic duplicated across subject drills |
| **Student engagement** | Streak counter drives 2+ minute average session time |
| **Fluency tracking** | `averageResponseTime` decreases across repeated sessions per student |

---

## 11. Open Questions

1. **Should FastFact support audio prompts?** (e.g., "Listen and type the word you hear" for phonics). Could add `audio?: { url: string }` to `FastFactVisual`. Deferred to Phase 3+.
2. **Should `match` mode support many-to-many?** Current design is one-to-one (single match per challenge). Batch matching (connect 4 pairs) is a separate UX. Recommend keeping single-match for speed drills and considering a separate `MatchBoard` primitive for complex matching.
3. **LaTeX rendering dependency.** Does the project already have KaTeX/MathJax? If not, `latex` visual type deferred until added.
4. **Image hosting.** `imageUrl` visuals need a CDN or asset pipeline. For MVP, recommend `emoji` and `text-large` visual types only.
