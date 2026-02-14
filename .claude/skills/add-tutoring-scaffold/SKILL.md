# Add AI Tutoring Scaffold to a Primitive

This skill guides adding AI tutoring support to Lumina primitives so the AI tutor can provide context-aware scaffolding, hints, and struggle responses during student interactions.

## Required Reading

Before starting, read the full scaffolding guide:
- `my-tutoring-app/src/components/lumina/docs/ADDING_TUTORING_SCAFFOLD.md`

## When to Use This Skill

Use this skill when:
- Adding AI tutoring scaffolding to an existing primitive
- Making the AI tutor context-aware for a specific primitive
- Adding pedagogical speech triggers (`sendText`) to a primitive component
- Improving AI responses for a primitive that currently uses the generic fallback

**DO NOT use this skill for:**
- Creating new primitives (use the `primitive` skill instead)
- Migrating primitives to shadcn/ui (use the `migrate-primitive` skill instead)
- Fixing bugs in existing scaffolding
- Backend changes — the backend is **primitive-agnostic** and requires no modifications

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  catalog/[domain].ts  (SINGLE SOURCE OF TRUTH)              │
│  { id: 'my-primitive', tutoring: { ... } }                  │
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
│  lumina_tutor.py (GENERIC — NO PRIMITIVE-SPECIFIC CODE)      │
│  interpolate_template(scaffold, primitive_data) →            │
│  builds Gemini system prompt section                         │
└─────────────────────────────────────────────────────────────┘
```

Adding scaffolding is a **frontend-only** task. No backend changes needed.

## Step-by-Step Workflow

### Phase 1: Preparation

1. **Ask the user which primitive to scaffold**
   - Get the primitive `id` (e.g., `fraction-bar`, `phonics-blender`)
   - Confirm the domain (math, literacy, biology, etc.)

2. **Read the primitive component**
   - Read the full component file to understand the interaction flow
   - Identify the key interaction states and transitions
   - Note which `primitiveData` fields are sent to the AI context

3. **Read the domain catalog file**
   - Open the relevant `catalog/[domain].ts` file
   - Locate the primitive's existing catalog entry
   - Confirm it doesn't already have a `tutoring` field

4. **Identify pedagogical moments**
   - Ask: "Would a human tutor say something here?"
   - Look for these moment types:

   | Moment Type | Example | AI Should... |
   |-------------|---------|-------------|
   | **Correct answer** | Student builds a word correctly | Celebrate, instruct on next step |
   | **Incorrect answer** | Student arranges sounds wrong | Give a hint without the answer |
   | **Phase transition** | Moving from listening to building | Introduce the new task |
   | **Item progression** | Moving to the next word/problem | Introduce the new item |
   | **Completion** | Finishing all items | Celebrate the full session |
   | **Pronunciation/audio** | Student taps a sound tile | Say the sound (no commentary) |

### Phase 2: Write the Catalog Scaffold

5. **Add the `tutoring` field to the catalog entry**

   Open `catalog/[domain].ts` and add the `tutoring` object:

   ```typescript
   {
     id: 'my-primitive',
     description: '...',      // existing
     constraints: '...',      // existing
     tutoring: {
       taskDescription: 'Describe what the student is doing. Use {{key}} for runtime values.',
       contextKeys: ['relevantKey1', 'relevantKey2'],
       scaffoldingLevels: {
         level1: '"Ask a question or point to a feature"',
         level2: '"Break the task into smaller steps, use {{key}} for specifics"',
         level3: '"Walk through step-by-step with concrete details"',
       },
       commonStruggles: [
         { pattern: 'Observable student behavior', response: 'Actionable tutor response' },
       ],
     },
   },
   ```

6. **Write the `taskDescription`**
   - Describe *what the student is doing*, not what the AI should say
   - Use `{{key}}` for runtime `primitive_data` values
   - Example: `'Help student blend phonemes ({{patternType}} pattern). Word: {{currentWord}}.'`

7. **Define `contextKeys`**
   - List only the `primitive_data` fields the AI needs to see
   - Omit to send all keys (not recommended — keep the AI focused)

8. **Write scaffolding levels** (progressive support)

   | Level | Purpose | Style |
   |-------|---------|-------|
   | Level 1 | Gentle nudge | Ask a question, point to a feature |
   | Level 2 | Specific guidance | Break into smaller steps, reference specific values with `{{key}}` |
   | Level 3 | Detailed walkthrough | Step-by-step instructions with concrete details |

   **Never give the answer at any level.** The AI scaffolds, not solves.

9. **Write `commonStruggles`**
   - Describe *observable* student behavior (not vague labels like "struggling")
   - Provide *actionable* tutor responses
   - Example: `{ pattern: 'Skipping sounds', response: "Let's make sure we say every sound" }`

10. **Add `aiDirectives` (if needed)**
    - Only needed for special AI behaviors (pronunciation commands, drawing instructions, etc.)
    - Each directive becomes a titled section in the system prompt
    - Example:
      ```typescript
      aiDirectives: [
        {
          title: 'PRONUNCIATION COMMANDS',
          instruction:
            'When you receive [PRONOUNCE], say ONLY the requested sound or word. '
            + 'No extra commentary.',
        },
      ],
      ```

### Phase 3: Add Speech Triggers to the Component

11. **Get `sendText` from `useLuminaAI`**

    Verify the component already uses the `useLuminaAI` hook, or add it:
    ```typescript
    const { sendText } = useLuminaAI({
      primitiveType: 'my-primitive',
      instanceId: resolvedInstanceId,
      primitiveData: aiPrimitiveData,
      gradeLevel,
    });
    ```

12. **Add `sendText` calls at each pedagogical moment**

    For each moment identified in Phase 1, add a `sendText` call:

    ```typescript
    // Correct answer
    sendText(
      `[ANSWER_CORRECT] The student answered correctly on attempt ${attempts}. ` +
      `Congratulate briefly and tell them what to do next.`,
      { silent: true }
    );

    // Incorrect answer
    sendText(
      `[ANSWER_INCORRECT] The student chose "${studentAnswer}" but the correct ` +
      `answer is "${correctAnswer}". Attempt ${attempts}. ` +
      `Give a brief hint without revealing the answer.`,
      { silent: true }
    );

    // Next item
    sendText(
      `[NEXT_ITEM] Moving to item ${index} of ${total}: "${newItem.title}". ` +
      `Briefly introduce it.`,
      { silent: true }
    );

    // Completion
    sendText(
      `[ALL_COMPLETE] The student finished all ${total} items! ` +
      `Celebrate the full session.`,
      { silent: true }
    );
    ```

    **Rules for `sendText` messages:**
    - Use bracketed tags like `[BUILD_CORRECT]`, `[NEXT_WORD]`
    - Include context (student answer, correct answer, attempt count)
    - Include brief instructions ("Celebrate briefly", "Give a hint without the answer")
    - Always use `{ silent: true }` — these are system-to-AI, not student chat
    - Don't over-trigger — only at moments where a human tutor would speak

13. **Document special tags in `aiDirectives`**
    - If any `sendText` tag requires non-default AI behavior (e.g., `[PRONOUNCE]` = no commentary), add a matching `aiDirective` in the catalog entry

### Phase 4: Verification

14. **Run type check**
    - Execute: `cd my-tutoring-app && npx tsc --noEmit`
    - Fix any TypeScript errors before proceeding

15. **Report results**
    - Catalog file modified and field added
    - Number of pedagogical moments wired
    - Tags defined (e.g., `[ANSWER_CORRECT]`, `[NEXT_ITEM]`)
    - Any `aiDirectives` added
    - Context keys configured

### Phase 5: Testing Reminder

16. **Remind the user to test**
    - Use the **Lumina Tutor Tester** to verify:
      - Scaffold is sent correctly in the WebSocket auth message
      - `{{key}}` template variables resolve to actual runtime values
      - AI responds with context-aware scaffolding at each trigger
      - `sendText` triggers produce appropriate AI speech
      - Silent messages don't appear in the conversation UI

## Understanding the Two Communication Channels

This is the most critical concept. Getting this wrong causes the AI to go silent.

| Channel | Method | Backend `end_of_turn` | AI Speaks? | Use For |
|---------|--------|----------------------|------------|---------|
| Context update | `updateContext()` | `False` | **No** — silent injection | Background state sync (phase changes, score updates) |
| Text message | `sendText(text, { silent: true })` | `True` | **Yes** — triggers a response | Pedagogical moments where the AI should react |

`updateContext()` happens automatically when `primitiveData` changes. These are absorbed silently.
`sendText()` with `{ silent: true }` triggers an AI response without appearing in the student chat.

**If the AI goes silent after the initial greeting, the primitive is likely missing `sendText` calls at pedagogical moments.**

## TutoringScaffold Interface Reference

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
    title: string;                // Section heading
    instruction: string;          // Instruction text (supports {{key}} interpolation)
  }>;
}
```

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

## Checklist

- [ ] Read the primitive component to understand interaction flow
- [ ] Identified pedagogical moments (correct/incorrect, transitions, progression, completion)
- [ ] Added `tutoring` field to catalog entry in `catalog/[domain].ts`
- [ ] `taskDescription` describes the learning task using `{{key}}` for runtime values
- [ ] `contextKeys` lists only the relevant `primitive_data` fields
- [ ] All three scaffolding levels defined (gentle → specific → detailed)
- [ ] Common struggles describe observable behavior with actionable responses
- [ ] Added `sendText('[TAG] ...', { silent: true })` at each pedagogical moment
- [ ] Each `sendText` includes context (answers, attempt count) and brief instructions
- [ ] Special tags documented in `aiDirectives` if they require non-default AI behavior
- [ ] TypeScript compiles without errors (`npx tsc --noEmit`)
- [ ] Reminded user to test with Lumina Tutor Tester

## Important Notes

- **The backend is primitive-agnostic** — never modify `lumina_tutor.py` for primitive-specific scaffolding
- **Always use `{ silent: true }`** on `sendText` calls — these are system messages, not student chat
- **Don't over-trigger** — not every micro-interaction needs AI speech
- **Never give answers in scaffolding levels** — the AI scaffolds, not solves
- **Run type check** before considering the task done

## Reference Files

- Scaffolding guide: `my-tutoring-app/src/components/lumina/docs/ADDING_TUTORING_SCAFFOLD.md`
- Types: `my-tutoring-app/src/components/lumina/types.ts` — `TutoringScaffold` interface
- Catalog lookup: `my-tutoring-app/src/components/lumina/service/manifest/catalog/index.ts`
- AI context: `my-tutoring-app/src/components/lumina/LuminaAIContext.tsx`
- Backend formatter: `backend/app/api/endpoints/lumina_tutor.py`
- Example primitive with scaffolding: PhonicsBlender in `catalog/literacy.ts`
