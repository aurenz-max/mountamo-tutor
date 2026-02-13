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

You can also use `{{key}}` in `scaffoldingLevels` and `commonStruggles.response`:

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
- [ ] Tested with Lumina Tutor Tester to verify scaffold is sent and formatted correctly

## Additional Resources

- **[ADDING_PRIMITIVES.md](ADDING_PRIMITIVES.md)** - Full guide for creating new primitives
- **[types.ts](../types.ts)** - `TutoringScaffold` and `ComponentDefinition` interfaces
- **[catalog/index.ts](../service/manifest/catalog/index.ts)** - `getComponentById()` lookup used by the context
- **[lumina_tutor.py](../../../../backend/app/api/endpoints/lumina_tutor.py)** - Backend generic formatter
