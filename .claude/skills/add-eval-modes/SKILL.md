# Add Eval Modes to a Primitive

This skill adds IRT eval mode support to an existing primitive's generator so the session assembly engine can target specific difficulty levels — and the generator produces **only** challenges at that level via schema-level constraints.

## Required Reading

For full details on the architecture and design guidelines, see:
- `my-tutoring-app/src/components/lumina/docs/ADDING_EVAL_MODES.md`

## When to Use This Skill

Use this skill when:
- Adding eval mode support to an existing primitive (multi-mode OR single-mode)
- The IRT calibration system needs β priors registered for a primitive
- You want the generator to produce mode-constrained output without post-filtering

**Two paths exist:**
- **Multi-mode** (2+ challenge types): Full generator refactoring with schema constraining (Phase 3)
- **Single-mode** (no constrainable enum): Catalog + registry + generator wiring for config flow and logging (Phase 3-S)

**DO NOT use this skill for:**
- Creating new primitives (use the `/primitive` skill — it includes eval mode steps)
- Display-only / non-evaluable primitives

## Prerequisites

The primitive must already have:
- A working generator in `service/[domain]/gemini-[primitive].ts`
- A catalog entry in `catalog/[domain].ts` with `supportsEvaluation: true`

For **multi-mode** primitives, additionally:
- A schema with a challenge-type field (see **Schema Field Variants** below)
- 2+ distinct challenge types representing different difficulty levels

### Schema Field Variants

Math primitives use `challenges.items.properties.type`. Literacy primitives use varied field names and locations. The `constrainChallengeTypeEnum()` utility accepts an optional `SchemaConstraintConfig` to handle all patterns:

| Pattern | Config | Examples |
|---------|--------|----------|
| `challenges[].type` (default) | *(none needed)* | TenFrame, CountingBoard, most math |
| `challenges[].mode` | `{ fieldName: 'mode' }` | LetterSpotter, RhymeStudio, WordWorkout |
| `challenges[].operation` | `{ fieldName: 'operation' }` | SoundSwap |
| `challenges[].clueType` | `{ fieldName: 'clueType' }` | ContextCluesDetective |
| `instances[].type` | `{ arrayName: 'instances' }` | FigurativeLanguageFinder |
| `questions[].type` | `{ arrayName: 'questions' }` | ListenAndRespond |
| Root `patternType` | `{ fieldName: 'patternType', rootLevel: true }` | PhonicsBlender, SpellingPatternExplorer |
| Root `sentenceType` | `{ fieldName: 'sentenceType', rootLevel: true }` | SentenceBuilder |
| Root `structureType` | `{ fieldName: 'structureType', rootLevel: true }` | StoryMap, TextStructureAnalyzer |

**In Phase 1, identify which pattern the generator uses** and note the config needed for Phase 3.

## Step-by-Step Workflow

### Phase 1: Analyze the Primitive

1. **Ask the user which primitive to add eval modes to**
   - Get the primitive `id` (e.g., `counting-board`, `number-line`)
   - Confirm the domain (math, literacy, etc.)

2. **Read the generator file**
   - `my-tutoring-app/src/components/lumina/service/[domain]/gemini-[primitive].ts`
   - Identify all challenge types in the schema and prompt
   - Note the schema structure — identify the challenge type field path (see **Schema Field Variants** in Prerequisites)
   - **Determine if this is multi-mode or single-mode:**
     - Multi-mode: Has a constrainable challenge-type enum with 2+ values representing distinct difficulty levels
     - Single-mode: No challenge-type enum, or the enum doesn't map to difficulty levels (e.g., question format types like `multiple-choice`/`short-answer` that aren't difficulty dimensions)

3. **Read the catalog entry**
   - `my-tutoring-app/src/components/lumina/service/manifest/catalog/[domain].ts`
   - Confirm `supportsEvaluation: true` exists
   - Check if `evalModes` already exists (skip if so)

4. **Read the backend problem-type registry** to check if β priors already exist
   - `backend/app/services/calibration/problem_type_registry.py`
   - If the primitive already has entries, use those exact β values for consistency
   - If not, assign β values using the PRD §5.3 mode table (see below)

5. **Design the eval mode progression**
   - Map challenge types to difficulty tiers (concrete → abstract)
   - Assign β values from the PRD §5.3 prior difficulty table:

     | Scaffolding Mode | Description | Prior β |
     |-----------------|-------------|---------|
     | 1 | Concrete manipulatives with full guidance | 1.5 |
     | 2 | Pictorial representation with prompts | 2.5 |
     | 3 | Pictorial, reduced prompts | 3.5 |
     | 4 | Transitional: mixed symbolic/pictorial | 5.0 |
     | 5 | Fully symbolic, single operation | 6.5 |
     | 6 | Symbolic, multi-step or cross-concept | 8.0 |

     Within-mode adjustments of ±0.5–1.0 are allowed for: number range, operation type, distractor quality, and time constraints.

   - **Cross-reference with the backend registry.** The β values in the catalog `evalModes` must match the backend's `PROBLEM_TYPE_REGISTRY`. If they exist in the backend already, use those values. If adding new ones, add them to both places.
   - Present the proposed modes to the user for confirmation

### Phase 2: Add Catalog `evalModes`

6. **Add the `evalModes` array to the catalog entry**

   ```typescript
   {
     id: 'my-primitive',
     description: '...',
     constraints: '...',
     evalModes: [
       {
         evalMode: 'mode_key',           // Key sent via config.targetEvalMode
         label: 'Mode Label (Tier)',      // Human-readable for UI
         beta: 1.5,                       // IRT prior β — MUST match backend registry
         scaffoldingMode: 1,              // PRD scaffolding mode (1-6)
         challengeTypes: ['type1'],       // Generator challenge types for this mode
         description: 'What this mode tests.',
       },
       // ... more modes, ordered lowest β → highest β
     ],
     tutoring: { ... },
     supportsEvaluation: true,
   },
   ```

   **Rules:**
   - Order modes from lowest β (easiest) to highest β (hardest)
   - `challengeTypes` values must match the type strings in the generator schema
   - Use the challenge type name as `evalMode` key when 1:1 (e.g., `build` → `['build']`)
   - Use a descriptive verb when mapping to multiple types (e.g., `operate` → `['add', 'subtract']`)
   - β values must match `backend/app/services/calibration/problem_type_registry.py`

### Phase 3-S: Single-Mode Generator Wiring

> **Use this phase instead of Phase 3 for single-mode primitives** (no constrainable challenge-type enum).
> Even single-mode primitives need generator wiring so `targetEvalMode` flows through the system for logging and future expansion.

7S. **Add imports and config type**

    ```typescript
    import { logEvalModeResolution } from '../evalMode';
    ```

    Update the config parameter type to include `targetEvalMode`:

    ```typescript
    config?: Partial<MyPrimitiveData> & { targetEvalMode?: string }
    ```

8S. **Add logging** at the top of the generator function, after any initial setup:

    ```typescript
    logEvalModeResolution('MyPrimitive', config?.targetEvalMode, null);
    ```

    The `null` third argument indicates no schema constraining — the log output will be:
    - With eval mode: `[MyPrimitive] No targetEvalMode — full schema, mixed difficulty`
    - Without: same (single-mode always generates standard content)

9S. **Skip to Phase 4** — no CHALLENGE_TYPE_DOCS, no schema constraining, no prompt modification needed.

### Phase 3: Refactor the Generator (Multi-Mode)

> **Use this phase for multi-mode primitives** with 2+ constrainable challenge types.

7. **Read the reference implementation** for the pattern:
   - `my-tutoring-app/src/components/lumina/service/math/gemini-ten-frame.ts`

8. **Add imports from the shared eval mode utility**

   ```typescript
   import {
     resolveEvalModeConstraint,
     constrainChallengeTypeEnum,
     buildChallengeTypePromptSection,
     type ChallengeTypeDoc,
     type SchemaConstraintConfig,  // Only needed for non-standard field paths
   } from '../evalMode';
   ```

9. **Define `CHALLENGE_TYPE_DOCS`** — one entry per challenge type

   Add this at the top of the generator file, after imports:

   ```typescript
   const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
     type1: {
       promptDoc:
         `"type1": Description of what the student does. Key constraints and grade notes.`,
       schemaDescription: "'type1' (brief label)",
     },
     type2: {
       promptDoc:
         `"type2": Description of what the student does. Key constraints.`,
       schemaDescription: "'type2' (brief label)",
     },
   };
   ```

   **How to write these:** Extract the challenge type descriptions from the existing prompt. Each `promptDoc` should be the content that was previously inline in the prompt's CHALLENGE TYPES section. Each `schemaDescription` is a short label.

10. **Add eval mode resolution** at the top of the generator function

    ```typescript
    const evalConstraint = resolveEvalModeConstraint(
      'my-primitive',          // Must match the catalog id exactly
      config?.targetEvalMode,
      CHALLENGE_TYPE_DOCS,
    );
    ```

11. **Constrain the schema** before the Gemini call

    For **math primitives** (default `challenges[].type` path):
    ```typescript
    const activeSchema = evalConstraint
      ? constrainChallengeTypeEnum(baseSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
      : baseSchema;
    ```

    For **literacy primitives** with non-standard field paths, pass a `SchemaConstraintConfig`:
    ```typescript
    // Example: challenges[].mode (LetterSpotter, RhymeStudio, WordWorkout)
    const activeSchema = evalConstraint
      ? constrainChallengeTypeEnum(baseSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
          fieldName: 'mode',
        })
      : baseSchema;

    // Example: root-level patternType (PhonicsBlender, SpellingPatternExplorer)
    const activeSchema = evalConstraint
      ? constrainChallengeTypeEnum(baseSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
          fieldName: 'patternType',
          rootLevel: true,
        })
      : baseSchema;

    // Example: instances[].type (FigurativeLanguageFinder)
    const activeSchema = evalConstraint
      ? constrainChallengeTypeEnum(baseSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
          arrayName: 'instances',
        })
      : baseSchema;
    ```

12. **Build the prompt** with mode-scoped challenge type docs

    Replace the hardcoded CHALLENGE TYPES section with:

    ```typescript
    const challengeTypeSection = buildChallengeTypePromptSection(
      evalConstraint,
      CHALLENGE_TYPE_DOCS,
    );
    ```

    Insert `${challengeTypeSection}` where the old CHALLENGE TYPES block was.

    Also wrap any grade-level guidelines in `${!evalConstraint ? `...` : ''}` so they're only included for mixed-difficulty mode.

13. **Pass the constrained schema to Gemini**

    ```typescript
    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,  // ← constrained, not the base schema
      },
    });
    ```

14. **Update the fallback** to use the eval constraint's allowed types

    ```typescript
    if (data.challenges.length === 0) {
      const fallbackType = evalConstraint?.allowedTypes[0] ?? 'default_type';
      // ... build fallback challenge
    }
    ```

15. **Delete old eval mode code** (if any)
    - Remove any hardcoded `evalModeConstraints` map
    - Remove post-generation challenge type filtering
    - Remove eval mode hint strings from the prompt

16. **Add `targetEvalMode` to the config type** if not already present

    ```typescript
    config?: {
      // ... existing fields ...
      /** Target eval mode from the IRT calibration system. */
      targetEvalMode?: string;
    }
    ```

17. **Add logging** for observability using the shared helper

    ```typescript
    import { logEvalModeResolution } from '../evalMode';

    // After resolveEvalModeConstraint():
    logEvalModeResolution('MyPrimitive', config?.targetEvalMode, evalConstraint);
    ```

### Phase 4: Verify the Generator Registration

18. **Check the generator registration passes `item.config` through**

    Open the registration file for the primitive's domain:
    - Math: `my-tutoring-app/src/components/lumina/service/registry/generators/mathGenerators.ts`
    - Literacy: `my-tutoring-app/src/components/lumina/service/registry/generators/literacyGenerators.ts`
    - etc.

    Find the `registerGenerator()` call for this primitive. It **must** spread `item.config` so that `targetEvalMode` flows from the tester/session engine through to the generator function.

    **Broken pattern** (drops `targetEvalMode`):
    ```typescript
    registerGenerator('my-primitive', async (item, topic, gradeContext) => ({
      type: 'my-primitive',
      instanceId: item.instanceId,
      data: await generateMyPrimitive(topic, gradeContext, {
        intent: item.intent || item.title,  // ❌ Only passes intent
      }),
    }));
    ```

    **Correct pattern** (spreads `item.config`):
    ```typescript
    registerGenerator('my-primitive', async (item, topic, gradeContext) => ({
      type: 'my-primitive',
      instanceId: item.instanceId,
      data: await generateMyPrimitive(topic, gradeContext, {
        ...item.config,                     // ✅ Passes targetEvalMode + all config
        intent: item.intent || item.title,
      }),
    }));
    ```

    > **This is a common failure mode.** Without `...item.config`, the generator logs
    > `No targetEvalMode — full schema, mixed difficulty` even when a mode is selected.
    > No errors — just silently unconstrained output.

### Phase 5: Verification

19. **Run type check**
    ```bash
    cd my-tutoring-app && npx tsc --noEmit
    ```

20. **Report results to the user**
    - Catalog modes added (list each with β value)
    - Generator refactored (CHALLENGE_TYPE_DOCS entries, old code removed)
    - Generator registration verified (spreads `item.config`)
    - Files modified

21. **Remind the user to test** in the domain Primitives Tester
    - Select each eval mode → verify all challenges match
    - Select no eval mode → verify mixed difficulty unchanged
    - Check console logs for schema enum and prompt size

## Key Files

| File | Role |
|------|------|
| `service/evalMode/index.ts` | Shared utilities (do NOT modify) |
| `service/manifest/catalog/[domain].ts` | Catalog eval mode definitions |
| `service/[domain]/gemini-[primitive].ts` | Generator with CHALLENGE_TYPE_DOCS |
| `service/registry/generators/[domain]Generators.ts` | Registration — must spread `item.config` |
| `types.ts` | `EvalModeDefinition` interface |
| `components/[Domain]PrimitivesTester.tsx` | Auto-reads evalModes for UI selector |
| `backend/app/services/calibration/problem_type_registry.py` | Backend β priors (must match) |

## Reference Implementation

Ten Frame is the reference. Read these files for the complete pattern:
- Generator: `my-tutoring-app/src/components/lumina/service/math/gemini-ten-frame.ts`
- Catalog: `my-tutoring-app/src/components/lumina/service/manifest/catalog/math.ts` (search `id: 'ten-frame'`)
- Full guide: `my-tutoring-app/src/components/lumina/docs/ADDING_EVAL_MODES.md`

## Checklist

### All Primitives (single-mode and multi-mode)

- [ ] Read the generator to identify schema structure and determine single-mode vs multi-mode
- [ ] Checked backend `problem_type_registry.py` for existing β priors
- [ ] Designed eval mode progression with the user (types → modes → β values)
- [ ] Added `evalModes` array to catalog entry, ordered by β
- [ ] β values match backend `PROBLEM_TYPE_REGISTRY` (or added to both)
- [ ] `targetEvalMode` added to config type
- [ ] Logging added via `logEvalModeResolution()` from `evalMode/index.ts`
- [ ] Generator registration in `registry/generators/[domain]Generators.ts` passes `item.config` through (via `getConfig(item)` or `...item.config`)
- [ ] Backend `PROBLEM_TYPE_REGISTRY` in `problem_type_registry.py` updated with matching β priors (or confirmed existing entries match)
- [ ] TypeScript compiles without errors
- [ ] Reminded user to test each mode in Primitives Tester

### Multi-Mode Only (additional steps)

- [ ] `challengeTypes` values match the generator's schema type strings
- [ ] Added `CHALLENGE_TYPE_DOCS` with `promptDoc` + `schemaDescription` per type
- [ ] Generator calls `resolveEvalModeConstraint()` with correct `componentId`
- [ ] Schema constrained via `constrainChallengeTypeEnum()` before Gemini call
- [ ] Prompt built with `buildChallengeTypePromptSection()` (no hardcoded mode hints)
- [ ] Removed old eval mode code (constraint maps, post-filtering, mode hint strings)
- [ ] Fallback uses `evalConstraint?.allowedTypes[0]` for correct fallback type
