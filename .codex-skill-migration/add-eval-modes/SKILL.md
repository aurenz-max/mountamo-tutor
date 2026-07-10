# Add Eval Modes to a Primitive

This skill adds eval mode support to an existing primitive's generator. **Eval modes are distinct SKILLS (task identities), not difficulty levels** — e.g. ten-frame's `make_ten` (complements to 10) is a different skill from `build` (counting). The generator resolves *which* mode(s) to run from the component's **intent** and constrains its output via the schema enum so it produces **only** those challenge types — no post-filtering.

**Three outcomes, decided per generation by `resolveEvalModes`:**
- **single** — intent maps to one skill → that mode only
- **curated blend** — intent spans 2-3 skills → the union of those modes
- **mixed** — intent is broad / no single skill → schema left unconstrained (all types). Mixed is a legitimate pedagogical choice, not a failure.

An explicit `config.targetEvalMode` (the eval-test tester, or a curator override) **pins one mode directly with NO LLM call** and short-circuits intent resolution.

## Required Reading

For full details on the architecture and design guidelines, see:
- `my-tutoring-app/src/components/lumina/docs/ADDING_EVAL_MODES.md`

## When to Use This Skill

Use this skill when:
- Adding eval mode support to an existing primitive (multi-mode OR single-mode)
- The IRT calibration system needs β priors registered for a primitive
- You want the generator to produce mode-constrained output without post-filtering

**Two paths exist:**
- **Multi-mode** (2+ challenge types): Full generator refactoring with the `resolveEvalModes` resolver + schema constraining (Phase 3)
- **Single-mode** (no constrainable enum): Catalog + registry + generator wiring for config flow and logging (Phase 3-S)

**Newborn densification (the standard entry path):** `/primitive` births primitives at lifecycle **L0** — ONE core challenge type, the challenge-type field already in the schema, `supportsEvaluation: true`, NO `evalModes` field, and a generator registration that already spreads `...item.config` + passes `intent`. Running this skill on a newborn is the **L0→L1** step, not an exception. Before Phase 1, read the birth certificate (`my-tutoring-app/qa/eval-reports/<id>-birth.md`) — it lists the ladder candidates the design or PRD implied, written while the design was fresh. Ladder definitions: `my-tutoring-app/src/components/lumina/docs/PRIMITIVE_LIFECYCLE.md`.

**DO NOT use this skill for:**
- Display-only / non-evaluable primitives
- Building the primitive itself (that's `/primitive` — it deliberately ships NO eval-mode ladder; this skill is the single source of truth for it)

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

> **Pilot-then-sweep gate (mandatory):** never fan this skill out across multiple primitives (workflow / parallel subagents) until ONE pilot's new modes have been exercised **at runtime** — pinned in the Primitives Tester or `/eval-test`-generated for real — and the user has seen the result. A type-checked pilot is not a validated pilot (CLAUDE.md Verification Doctrine).

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
     resolveEvalModes,
     constrainChallengeTypeEnum,
     buildModeConstraintSection,
     type ChallengeTypeDoc,
     type SchemaConstraintConfig,  // Only needed for non-standard field paths
   } from '../evalMode';
   ```

   > **The generator function must be `async`** (it already is — it awaits the Gemini call). `resolveEvalModes` makes its own micro-call, so it's awaited too.

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
    const resolution = await resolveEvalModes(
      'my-primitive',          // Must match the catalog id exactly
      { targetEvalMode: config?.targetEvalMode, intent: config?.intent, objectiveText: config?.objectiveText },
      CHALLENGE_TYPE_DOCS,
    );
    const allowedTypes = resolution?.allowedTypes;
    ```

    `resolveEvalModes` returns `EvalModeResolution | null`:
    - **explicit pin** (`config.targetEvalMode` set) → that one mode, no LLM call.
    - **intent resolution** (no pin, primitive has ≥2 modes) → one flash-lite enum micro-call scoped to THIS primitive's modes → single | blend.
    - **`null`** → mixed (no constraint). `resolution.allowedTypes` is the union of the selected modes' challenge types; `resolution.modes` are the selected definitions; `resolution.source` is `'explicit' | 'resolved'`.

11. **Constrain the schema** before the Gemini call

    For **math primitives** (default `challenges[].type` path):
    ```typescript
    const activeSchema = resolution
      ? constrainChallengeTypeEnum(baseSchema, resolution.allowedTypes, CHALLENGE_TYPE_DOCS)
      : baseSchema;
    ```

    For **literacy primitives** with non-standard field paths, pass a `SchemaConstraintConfig`:
    ```typescript
    // Example: challenges[].mode (LetterSpotter, RhymeStudio, WordWorkout)
    const activeSchema = resolution
      ? constrainChallengeTypeEnum(baseSchema, resolution.allowedTypes, CHALLENGE_TYPE_DOCS, {
          fieldName: 'mode',
        })
      : baseSchema;

    // Example: root-level patternType (PhonicsBlender, SpellingPatternExplorer)
    const activeSchema = resolution
      ? constrainChallengeTypeEnum(baseSchema, resolution.allowedTypes, CHALLENGE_TYPE_DOCS, {
          fieldName: 'patternType',
          rootLevel: true,
        })
      : baseSchema;

    // Example: instances[].type (FigurativeLanguageFinder)
    const activeSchema = resolution
      ? constrainChallengeTypeEnum(baseSchema, resolution.allowedTypes, CHALLENGE_TYPE_DOCS, {
          arrayName: 'instances',
        })
      : baseSchema;
    ```

12. **Build the prompt** with mode-scoped challenge type docs

    Replace the hardcoded CHALLENGE TYPES section with:

    ```typescript
    const challengeTypeSection = buildModeConstraintSection(resolution, CHALLENGE_TYPE_DOCS);
    ```

    `buildModeConstraintSection` renders all three cases (single mode / curated blend / mixed-all). Insert `${challengeTypeSection}` where the old CHALLENGE TYPES block was.

    Also wrap any grade-level guidelines in `${!resolution ? `...` : ''}` so they're only included for the mixed (unconstrained) case.

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

14. **Update the fallback** to use the resolution's allowed types

    ```typescript
    if (data.challenges.length === 0) {
      const fallbackType = resolution?.allowedTypes[0] ?? 'default_type';
      // ... build fallback challenge
    }
    ```

14b. **⚠️ Fork A pool-service generators — build the mixed path explicitly (SP-21).**
    If the generator is Fork A (Gemini emits only a session wrapper; local code builds all N
    challenges from ONE root-level `challengeType`), constraining the schema enum handles the
    pinned and blend cases — but the unconstrained path (`resolution === null`: the tester's
    "Auto (mixed)" button and the manifest's no-pin path) does NOT mix tiers. Gemini picks one
    enum value and every challenge in the session is that type: the "mixed" label is a lie, and
    per-mode eval-test won't catch it (each pinned mode is correctly single-type).

    Build a `selectMixed<Name>Challenges(count)` sibling of the per-type selector:
    - rotate a shuffled `TIER_ORDER` so every tier appears ≥1× (count > 4, covering all tiers)
    - dedup via the existing `canonKey`
    - sort tier-rank first, in-tier difficulty driver as tiebreaker (easy → hard)
    - assign index-derived IDs after selection
    - route `resolution === null` to it; pinned/blend paths stay untouched

    The component must already render per-challenge from `currentChallenge.type` — never the
    top-level `challengeType`, which on the mixed path is representative metadata only.
    Reference fixes: `service/math/gemini-polygon-area-builder.ts`
    (`selectMixedPolygonAreaChallenges`), `service/math/gemini-circle-explorer.ts`
    (`selectMixedCircleExplorerChallenges`). See EVAL_TRACKER SP-21.

15. **Apply the within-mode support tier ONLY for a single resolved mode**

    `config.difficulty` ('easy' | 'medium' | 'hard') is the structural SUPPORT tier — how much on-screen scaffolding the student gets *within one skill* (see ten-frame's `resolveSupportStructure`). A curated **blend** has no single tier surface, so gate it:

    ```typescript
    const tierScaffold =
      resolution && resolution.modes.length === 1 && pinnedType && supportTier
        ? resolveSupportStructure(pinnedType, supportTier)
        : null;
    ```

    The tier is support only — it NEVER changes the target numbers (the scope owns those).

16. **Delete old eval mode code** (if any)
    - Remove any hardcoded `evalModeConstraints` map
    - Remove post-generation challenge type filtering
    - Remove eval mode hint strings from the prompt

17. **Add the routing fields to the config type** if not already present

    ```typescript
    config?: {
      // ... existing fields ...
      /** Eval mode pinned by the tester/curator. Wins over intent resolution, no LLM call. */
      targetEvalMode?: string;
      /** Component intent — the routing signal when no mode is pinned. */
      intent?: string;
      /** Parent objective text (stamped by flattenManifestToLayout) — secondary routing signal. */
      objectiveText?: string;
    }
    ```

18. **Add logging** for observability

    ```typescript
    console.log(
      `[MyPrimitive] modes: ${resolution ? `${resolution.modes.map(m => m.evalMode).join('+')} (${resolution.source})` : 'mixed'} → types [${(resolution?.allowedTypes ?? ['all']).join(', ')}]`,
    );
    ```

### Phase 4: Verify the Generator Registration

19. **Check the generator registration passes BOTH `item.config` AND `intent`**

    Open the registration file for the primitive's domain:
    - Math: `my-tutoring-app/src/components/lumina/service/registry/generators/mathGenerators.ts`
    - Literacy: `my-tutoring-app/src/components/lumina/service/registry/generators/literacyGenerators.ts`
    - etc.

    Find the `registerGenerator()` call for this primitive. It **must** spread `item.config` (carries `targetEvalMode` from the tester + `objectiveText` stamped by `flattenManifestToLayout`) **and** pass `intent` (the routing signal for unpinned resolution).

    **Broken pattern** (drops `targetEvalMode` + `objectiveText`):
    ```typescript
    registerGenerator('my-primitive', async (item, topic, gradeContext) => ({
      type: 'my-primitive',
      instanceId: item.instanceId,
      data: await generateMyPrimitive(topic, gradeContext, {
        intent: item.intent || item.title,  // ❌ Only passes intent — no config
      }),
    }));
    ```

    **Correct pattern** (spreads `item.config`, passes `intent`):
    ```typescript
    registerGenerator('my-primitive', async (item, topic, gradeContext) => ({
      type: 'my-primitive',
      instanceId: item.instanceId,
      data: await generateMyPrimitive(topic, gradeContext, {
        ...item.config,                     // ✅ targetEvalMode + objectiveText + all config
        intent: item.intent || item.title,  // ✅ routing signal for intent resolution
      }),
    }));
    ```

    > **This is a common failure mode.** Without `...item.config` the tester's `targetEvalMode`
    > is dropped; without `intent` the unpinned path has no signal and falls back to mixed.
    > No errors — just silently unconstrained output.

### Phase 5: Verification

20. **Run type check**
    ```bash
    cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit
    ```
    (Project-local binary, absolute path — bare `npx tsc` false-passes. Zero NEW errors vs. baseline.)

21. **Report results to the user**
    - Catalog modes added (list each with β value)
    - Generator refactored (CHALLENGE_TYPE_DOCS entries, `resolveEvalModes` wired, old code removed)
    - Generator registration verified (spreads `item.config` + passes `intent`)
    - Files modified

22. **Remind the user to test**
    - In the Primitives Tester: select each eval mode (explicit pin) → verify all challenges match.
    - Via `/topic-trace` on a topic whose objective implies one skill → verify intent resolves to the right single mode (this is the path the Tester can't exercise, since it pins `targetEvalMode`).
    - Select no eval mode → verify mixed is unchanged.
    - Check console logs for the resolved modes + schema enum.

## Key Files

| File | Role |
|------|------|
| `service/evalMode/index.ts` | Shared utilities (do NOT modify) |
| `service/manifest/catalog/[domain].ts` | Catalog eval mode definitions |
| `service/[domain]/gemini-[primitive].ts` | Generator with CHALLENGE_TYPE_DOCS |
| `service/registry/generators/[domain]Generators.ts` | Registration — must spread `item.config` + pass `intent` |
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
- [ ] `discrimination` (a) values mirrored from backend `discrimination_priors.py` on each catalog mode (omit → 1.4 default, matching the backend fallback)
- [ ] `targetEvalMode`, `intent`, and `objectiveText` added to config type
- [ ] Generator registration in `registry/generators/[domain]Generators.ts` passes `item.config` through (via `getConfig(item)` or `...item.config`) AND passes `intent`
- [ ] Backend `PROBLEM_TYPE_REGISTRY` in `problem_type_registry.py` updated with matching β priors (or confirmed existing entries match)
- [ ] **Within-mode difficulty = STRUCTURAL support tier, NOT numeric.** (See [[structural-difficulty-not-numeric]] — the older POOL-SERVICE numeric band pattern in `service/difficulty/difficultyContext.ts` is RETIRED; numeric jitter changes the numbers, not the difficulty.) `config.difficulty` ('easy'|'medium'|'hard') withdraws on-screen SCAFFOLDING within a single pinned mode — ten-frame's `resolveSupportStructure` is the reference (showCount/showEquation off as tier hardens, subitize flash window shrinks), applied DETERMINISTICALLY post-generation, never touching target numbers (the scope owns those). Apply ONLY when `resolution.modes.length === 1` (a blend has no single tier surface). Define the structural changes per-primitive (more steps, harder unknown position, plausible-distractor). mode = WHICH SKILL (resolved from intent); difficulty = HOW MUCH SUPPORT within it.
- [ ] TypeScript compiles without errors
- [ ] Reminded user to test each mode in Primitives Tester (explicit pin) + `/topic-trace` for intent resolution, then run the `/eval-test` Step 2b sweep (support tier easy/med/hard + scope-conflict case)

### Multi-Mode Only (additional steps)

- [ ] `challengeTypes` values match the generator's schema type strings
- [ ] Added `CHALLENGE_TYPE_DOCS` with `promptDoc` + `schemaDescription` per type
- [ ] Generator function is `async` and `await`s `resolveEvalModes(componentId, { targetEvalMode, intent, objectiveText }, CHALLENGE_TYPE_DOCS)`
- [ ] Schema constrained via `constrainChallengeTypeEnum(baseSchema, resolution.allowedTypes, ...)` before Gemini call
- [ ] Prompt built with `buildModeConstraintSection(resolution, ...)` (no hardcoded mode hints)
- [ ] Removed old eval mode code (constraint maps, post-filtering, mode hint strings, legacy `resolveEvalModeConstraint`/`buildChallengeTypePromptSection` calls)
- [ ] Fallback uses `resolution?.allowedTypes[0]` for correct fallback type
- [ ] **Fork A pool-service: unconstrained (mixed) path routes to a `selectMixed<Name>Challenges` builder covering all tiers (SP-21)** — never built from one Gemini-picked tier
- [ ] Support tier gated on `resolution.modes.length === 1` (single mode only)
---
name: add-eval-modes
description: >-
  Add evaluation-mode support to an existing Lumina primitive generator. Use when introducing distinct task identities, wiring resolveEvalModes, constraining schemas by intent, or validating single, blended, and mixed evaluation modes.
---
