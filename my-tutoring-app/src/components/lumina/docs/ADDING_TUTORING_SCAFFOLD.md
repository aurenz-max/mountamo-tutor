# Adding AI Tutoring Scaffolding to Primitives

This guide explains how to add AI tutoring support to your primitives so the Lumina AI tutor can provide context-aware scaffolding, hints, and struggle responses when students interact with your component.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  catalog/math.ts  (SINGLE SOURCE OF TRUTH)                  │
│  { id: 'fraction-bar', tutoring: { ... } }                  │
└─────────────┬───────────────────────────────────────────────┘
              │ WebSocket connect
              ▼
┌─────────────────────────────────────────────────────────────┐
│  LuminaAIContext.tsx                                         │
│  getComponentById(primitiveType) → sends tutoring scaffold   │
│  as part of primitive_context in auth message                │
└─────────────┬───────────────────────────────────────────────┘
              │ WebSocket auth message
              ▼
┌─────────────────────────────────────────────────────────────┐
│  lumina_tutor.py (GENERIC - NO PRIMITIVE-SPECIFIC CODE)      │
│  interpolate_template(scaffold, primitive_data) →            │
│  builds Gemini system prompt section                         │
└─────────────────────────────────────────────────────────────┘
```

The backend is **primitive-agnostic**. It formats whatever scaffolding the frontend sends. Adding scaffolding to a new primitive is a **single file edit** in the catalog — no backend changes required.

## Quick Start: 1 File Edit

To add AI tutoring scaffolding to a primitive, add a `tutoring` field to its entry in the appropriate `catalog/[domain].ts` file.

### Step 1: Add `tutoring` to the Catalog Entry

Open the domain catalog file where your primitive is defined (e.g., `catalog/math.ts`, `catalog/literacy.ts`) and add the `tutoring` field:

```typescript
// catalog/math.ts
{
  id: 'fraction-bar',
  description: '...',      // existing
  constraints: '...',      // existing
  tutoring: {
    taskDescription: 'Build and compare fractions. Target: {{targetFraction}}. Current: {{currentFraction}}.',
    contextKeys: ['targetFraction', 'currentFraction', 'denominator', 'numerator'],
    scaffoldingLevels: {
      level1: '"How many parts is the whole divided into?"',
      level2: '"You need {{denominator}} equal pieces. How many should be shaded?"',
      level3: '"Denominator = bottom number = total pieces. Numerator = top = shaded pieces."',
    },
    commonStruggles: [
      { pattern: 'Confusing numerator/denominator', response: 'Use "out of" language: 3 out of 4 pieces' },
      { pattern: 'Unequal parts', response: '"Are all the pieces the same size?"' },
    ],
  },
},
```

That's it. No other files need to change.

### Step 2: Verify

Use the **Lumina Tutor Tester** (in App.tsx testers section) to verify the scaffolding is sent correctly and the AI responds with appropriate context.

---

## TutoringScaffold Interface

Defined in `types.ts`:

```typescript
export interface TutoringScaffold {
  taskDescription: string;        // What the AI should help with
  contextKeys?: string[];         // Which primitive_data keys to send (omit = all)
  scaffoldingLevels: {
    level1: string;               // Gentle nudge
    level2: string;               // Specific guidance
    level3: string;               // Detailed walkthrough
  };
  commonStruggles?: Array<{
    pattern: string;              // Observable student behavior
    response: string;             // Recommended AI response
  }>;
  aiDirectives?: Array<{
    title: string;                // Section heading (e.g. "PRONUNCIATION COMMANDS")
    instruction: string;          // Instruction text (supports {{key}} interpolation)
  }>;
}
```

### Template Variables

Use `{{key}}` (Mustache-style) to reference runtime `primitive_data` values:

```typescript
taskDescription: 'Help student blend phonemes ({{patternType}} pattern). Word: {{currentWord}}.'
```

At runtime, if `primitive_data = { patternType: 'CVC', currentWord: 'cat' }`, the AI sees:

> Help student blend phonemes (CVC pattern). Word: cat.

Unresolved keys are replaced with `(not set)`.

You can also use `{{key}}` in `scaffoldingLevels`, `commonStruggles.response`, and `aiDirectives.instruction`:

```typescript
scaffoldingLevels: {
  level2: '"You need {{denominator}} equal pieces."',
}
```

### contextKeys

Specifies which `primitive_data` fields to include in the **RUNTIME STATE** section of the AI prompt. If omitted, all `primitive_data` keys are included.

```typescript
// Only surface these keys to the AI:
contextKeys: ['currentWord', 'targetPhonemes', 'patternType']

// Omit to send everything:
// contextKeys: undefined
```

**Best practice:** Specify `contextKeys` to keep the AI prompt focused and avoid sending irrelevant internal state.

### aiDirectives

Use `aiDirectives` for primitive-specific commands the AI must follow — things like pronunciation modes, drawing instructions, or special interaction protocols. Each directive becomes a titled section in the system prompt. This keeps the backend **primitive-agnostic**: it renders whatever directives you define, with no backend code changes needed.

```typescript
aiDirectives: [
  {
    title: 'PRONUNCIATION COMMANDS',
    instruction:
      'When you receive [PRONOUNCE], say ONLY the requested sound or word. '
      + 'No extra commentary. Examples:\n'
      + '- "[PRONOUNCE] Say the sound /k/" → Just say the /k/ sound\n'
      + '- "[PRONOUNCE] Say the word cat" → Just say "cat"',
  },
],
```

At runtime, this generates:

```
**PRONUNCIATION COMMANDS:**
When you receive [PRONOUNCE], say ONLY the requested sound or word. No extra commentary. Examples:
- "[PRONOUNCE] Say the sound /k/" → Just say the /k/ sound
- "[PRONOUNCE] Say the word cat" → Just say "cat"
```

`aiDirectives` supports `{{key}}` interpolation just like other fields.

**When to use `aiDirectives` vs `taskDescription`:**
- `taskDescription` — describes *what the student is doing* and gives the AI context
- `aiDirectives` — defines *special commands or behaviors* the AI must follow

---

## Triggering AI Speech from Primitives

The catalog scaffold configures *what* the AI knows. But the **primitive component** must also tell the AI *when* to speak. There are two communication channels, and understanding the difference is critical:

| Channel | Method | Backend `end_of_turn` | AI Speaks? | Use For |
|---------|--------|----------------------|------------|---------|
| Context update | `updateContext()` | `False` | **No** — silent injection | Background state sync (phase changes, score updates) |
| Text message | `sendText(text, { silent: true })` | `True` | **Yes** — triggers a response | Pedagogical moments where the AI should react |

### The Problem: Silent Context Updates

The `useLuminaAI` hook automatically sends `updateContext()` whenever `primitiveData` changes. These become `[CONTEXT UPDATE]` messages on the backend, sent to Gemini with `end_of_turn=False`. Gemini absorbs the info but **never responds** — the system prompt explicitly tells it: *"Note it but do not speak unless the student is clearly struggling."*

This means if your primitive only relies on context updates for state transitions, **the AI will go silent** after its initial greeting. The student clicks buttons, the state changes, context updates flow... and Gemini says nothing.

### The Fix: `sendText` at Pedagogical Moments

For key moments where the AI should speak, call `sendText()` with `{ silent: true }`. The `silent` flag only affects the frontend (doesn't add to the conversation UI or set `isAIResponding`). On the backend, it's sent as a regular `type: 'text'` message with `end_of_turn=True`, so Gemini **will** respond with speech.

Use bracketed tags (e.g., `[NEXT_WORD]`, `[BUILD_CORRECT]`) so the AI can distinguish these from student chat messages, and include brief instructions for what kind of response you want.

### Identifying Pedagogical Moments

Every primitive has key interaction points where AI speech adds educational value. Ask yourself: **"Would a human tutor say something here?"**

| Moment Type | Example | AI Should... |
|-------------|---------|-------------|
| **Correct answer** | Student builds a word correctly | Celebrate, instruct on next step |
| **Incorrect answer** | Student arranges sounds wrong | Give a hint without the answer |
| **Phase transition** | Moving from listening to building | Introduce the new task |
| **Item progression** | Moving to the next word/problem | Introduce the new item |
| **Completion** | Finishing all items | Celebrate the full session |
| **Pronunciation/audio** | Student taps a sound tile | Say the sound (no commentary) |

### Implementation Pattern

In your primitive component, use `sendText` from the `useLuminaAI` hook:

```typescript
const { sendText } = useLuminaAI({
  primitiveType: 'my-primitive',
  instanceId: resolvedInstanceId,
  primitiveData: aiPrimitiveData,
  gradeLevel,
});
```

Then call it at each pedagogical moment:

```typescript
// ✅ Correct answer — celebrate and guide to next step
sendText(
  `[ANSWER_CORRECT] The student answered correctly on attempt ${attempts}. ` +
  `Congratulate briefly and tell them what to do next.`,
  { silent: true }
);

// ✅ Incorrect answer — hint without giving the answer
sendText(
  `[ANSWER_INCORRECT] The student chose "${studentAnswer}" but the correct ` +
  `answer is "${correctAnswer}". This is attempt ${attempts}. ` +
  `Give a brief hint without revealing the answer.`,
  { silent: true }
);

// ✅ Moving to next item — introduce it
sendText(
  `[NEXT_ITEM] The student is moving to item ${index} of ${total}: ` +
  `"${newItem.title}". Briefly introduce it.`,
  { silent: true }
);

// ✅ Pronunciation — just say the sound, no commentary
sendText(
  `[PRONOUNCE] Say the word "${word}" clearly. Just the word, nothing else.`,
  { silent: true }
);
```

### Real Example: PhonicsBlender

PhonicsBlender defines these pedagogical moments:

```typescript
// 1. Pronunciation (listen/blend phases) — AI says the sound, nothing else
sendText(`[PRONOUNCE] Say the sound ${phoneme.sound} clearly. Just the sound, nothing else.`, { silent: true });

// 2. Build correct — celebrate and guide to blend phase
sendText(
  `[BUILD_CORRECT] The student arranged the sounds for "${word}" in the correct order` +
  `${firstTry ? ' on the first try!' : ` after ${attempts} attempts.`}` +
  ` Congratulate briefly and tell them to click the word to hear it blended together.`,
  { silent: true }
);

// 3. Build incorrect — hint based on what they placed vs correct order
sendText(
  `[BUILD_INCORRECT] The student tried to build "${word}" but placed: ${placed}. ` +
  `Correct order: ${correct}. Attempt ${attempts}. Give a brief hint without giving the answer.`,
  { silent: true }
);

// 4. Blend complete — brief celebration
sendText(
  `[STUDENT_BLENDED] The student successfully blended "${word}"! Celebrate briefly (one sentence).`,
  { silent: true }
);

// 5. Next word — introduce the new word
sendText(
  `[NEXT_WORD] The student is moving to word ${n} of ${total}: "${nextWord}" (${phonemes}). ` +
  `Briefly introduce the new word and encourage them to tap each sound.`,
  { silent: true }
);
```

### Guidelines for `sendText` Messages

1. **Use bracketed tags** like `[BUILD_CORRECT]`, `[NEXT_WORD]` — makes it easy for the AI to parse intent and for you to add matching `aiDirectives` in the catalog if needed.

2. **Include context** — give the AI the student's answer, the correct answer, attempt count, etc. The more context, the better the pedagogical response.

3. **Include brief instructions** — tell the AI what *kind* of response you want ("Celebrate briefly", "Give a hint without the answer", "Just the word, nothing else"). Keep the AI on-task.

4. **Keep instructions short** — "Congratulate briefly (one sentence)" is better than a paragraph. The AI's system prompt already has the scaffolding strategy and tone.

5. **Always use `{ silent: true }`** — these are system-to-AI messages, not student chat. The `silent` flag prevents them from appearing in the conversation UI.

6. **Don't over-trigger** — not every micro-interaction needs AI speech. Placing a single phoneme tile? Context update is fine. Checking the final answer? That's a `sendText` moment.

7. **Document your tags in `aiDirectives`** — if a tag requires special AI behavior (like `[PRONOUNCE]` requiring no commentary), add an `aiDirective` to the catalog entry so it's part of the system prompt.

---

## What Gets Generated

The backend formats the scaffold into this prompt section:

```
**CURRENT PRIMITIVE: fraction-bar**
Grade Level: 3rd Grade

**TASK:** Build and compare fractions. Target: 3/4. Current: 1/4.

**RUNTIME STATE:**
  targetFraction: 3/4
  currentFraction: 1/4
  denominator: 4
  numerator: 3

**SCAFFOLDING STRATEGY:**
Level 1: "How many parts is the whole divided into?"
Level 2: "You need 4 equal pieces. How many should be shaded?"
Level 3: "Denominator = bottom number = total pieces. Numerator = top = shaded pieces."

**COMMON STRUGGLES:**
- Confusing numerator/denominator → "Use 'out of' language: 3 out of 4 pieces"
- Unequal parts → "Are all the pieces the same size?"
```

This is injected into the larger Gemini system prompt alongside lesson context, student progress, and interaction rules.

---

## Scaffolding Design Guidelines

### Writing Good `taskDescription`

Be specific about what the student is doing, not what the AI should say:

```typescript
// ✅ Good - describes the learning task
taskDescription: 'Help student blend phonemes to read words ({{patternType}} pattern)'

// ❌ Bad - tells the AI what to say
taskDescription: 'Say "Let\'s sound out this word together!"'
```

### Writing Scaffolding Levels

Follow the progressive support pattern:

| Level | Purpose | Example |
|-------|---------|---------|
| Level 1 | Ask a question, point to a feature | "What do you notice about the two sides?" |
| Level 2 | Break into smaller steps | "If we add this to one side, what happens?" |
| Level 3 | Walk through step-by-step | "We need equal weight on both sides. Step 1..." |

**Never give the answer at any level.** The AI's role is to scaffold, not solve.

### Writing Common Struggles

Describe observable student behavior and the recommended response:

```typescript
commonStruggles: [
  // ✅ Good - observable behavior + actionable response
  { pattern: 'Skipping sounds', response: "Let's make sure we say every sound" },

  // ❌ Bad - too vague
  { pattern: 'Struggling', response: 'Help them' },
]
```

---

## Domain Catalog Reference

Add tutoring to the appropriate domain file:

| Domain | File | Example Primitives |
|--------|------|--------------------|
| Math | `catalog/math.ts` | fraction-bar, balance-scale |
| Literacy | `catalog/literacy.ts` | phonics-blender, story-map, evidence-finder |
| Engineering | `catalog/engineering.ts` | lever-lab, bridge-builder |
| Science | `catalog/science.ts` | molecule-viewer |
| Biology | `catalog/biology.ts` | cell-builder, food-web-builder |
| Astronomy | `catalog/astronomy.ts` | solar-system-explorer |

---

## Primitives Without Scaffolding

Primitives without a `tutoring` field still work with the AI tutor — they just get a generic fallback message:

> No specific scaffolding instructions for this primitive type.

The AI will still have lesson context, student progress, and general tutoring instructions. Adding scaffolding improves the AI's responses significantly.

---

## Checklist

- [ ] Added `tutoring` field to catalog entry in `catalog/[domain].ts`
- [ ] `taskDescription` uses `{{key}}` for runtime state values
- [ ] `contextKeys` lists the relevant `primitive_data` fields
- [ ] All three scaffolding levels are defined (gentle → specific → detailed)
- [ ] Common struggles describe observable behavior, not vague labels
- [ ] Any primitive-specific commands (e.g., `[PRONOUNCE]`) are in `aiDirectives`, not hardcoded in the backend
- [ ] Identified pedagogical moments in the component (correct/incorrect, phase transitions, item progression)
- [ ] Added `sendText('[TAG] ...', { silent: true })` calls at each pedagogical moment
- [ ] Each `sendText` includes context (student answer, correct answer, attempt count) and brief instructions
- [ ] Documented any special tags in `aiDirectives` if they require non-default AI behavior
- [ ] Tested with Lumina Tutor Tester to verify scaffold is sent and formatted correctly

## Additional Resources

- **[ADDING_PRIMITIVES.md](ADDING_PRIMITIVES.md)** - Full guide for creating new primitives
- **[types.ts](../types.ts)** - `TutoringScaffold` and `ComponentDefinition` interfaces
- **[catalog/index.ts](../service/manifest/catalog/index.ts)** - `getComponentById()` lookup used by the context
- **[lumina_tutor.py](../../../../backend/app/api/endpoints/lumina_tutor.py)** - Backend generic formatter
