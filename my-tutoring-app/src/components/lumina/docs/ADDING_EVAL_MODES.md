# Adding Eval Modes to Primitives

This guide explains how to add IRT eval modes to an existing primitive's generator so the session assembly engine can request specific difficulty levels — and the generator produces **only** challenges at that level.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  catalog/[domain].ts  (SINGLE SOURCE OF TRUTH)               │
│  { id: 'ten-frame', evalModes: [                             │
│    { evalMode: 'build', challengeTypes: ['build'], β: 1.5 }, │
│    { evalMode: 'operate', challengeTypes: ['add','subtract']} │
│  ]}                                                          │
└─────────────┬───────────────────────────────────────────────┘
              │ resolveEvalModeConstraint()
              ▼
┌─────────────────────────────────────────────────────────────┐
│  service/evalMode/index.ts  (SHARED ORCHESTRATION)           │
│  1. Reads EvalModeDefinition from catalog                    │
│  2. Constrains schema enum → Gemini cannot output wrong types│
│  3. Strips irrelevant docs from prompt → fewer tokens        │
└─────────────┬───────────────────────────────────────────────┘
              │ constrained schema + focused prompt
              ▼
┌─────────────────────────────────────────────────────────────┐
│  service/[domain]/gemini-[primitive].ts  (GENERATOR)         │
│  Calls Gemini with constrained schema                        │
│  → All challenges guaranteed to match the target eval mode   │
│  → No post-filtering or wasted tokens                        │
└─────────────────────────────────────────────────────────────┘
```

**Key principle:** The schema `enum` constraint means Gemini *cannot* output disallowed challenge types. This replaces the old approach of asking in the prompt (which Gemini ignores ~30% of the time) and post-filtering.

---

## When to Add Eval Modes

Add eval modes when:
- Your primitive has **2+ distinct challenge types** that represent different difficulty levels
- The IRT calibration system needs to target a specific difficulty tier
- Each challenge type maps to a meaningful pedagogical progression (concrete → abstract)

Skip eval modes for:
- Single-mode primitives (only one challenge type)
- Display-only / non-evaluable primitives
- Primitives where difficulty is controlled purely by numeric parameters (not type)

---

## Quick Start: 4 Changes

| Step | File | What to Do |
|------|------|------------|
| 1 | `catalog/[domain].ts` | Add `evalModes` array to catalog entry |
| 2 | `service/[domain]/gemini-[primitive].ts` | Add `CHALLENGE_TYPE_DOCS` + use shared utilities |
| 3 | `registry/generators/[domain]Generators.ts` | Ensure registration spreads `...item.config` so `targetEvalMode` flows through |
| 4 | Verify | `npx tsc --noEmit` + test in MathPrimitivesTester |

No new files needed — the shared utilities in `service/evalMode/index.ts` already exist.

---

## Step 1: Add `evalModes` to the Catalog Entry

Open the domain catalog file and add an `evalModes` array to your primitive's entry. Each mode maps to an IRT difficulty prior (β).

```typescript
// catalog/math.ts
{
  id: 'my-primitive',
  description: '...',
  constraints: '...',
  evalModes: [
    {
      evalMode: 'build',              // Key sent via config.targetEvalMode
      label: 'Build (Concrete)',       // Human-readable label for UI
      beta: 1.5,                       // IRT prior β (1.0–10.0)
      scaffoldingMode: 1,              // Maps to PRD scaffolding mode (1-6)
      challengeTypes: ['build'],       // Which challenge types the generator should produce
      description: 'Place counters with full guidance. Lowest cognitive load.',
    },
    {
      evalMode: 'operate',
      label: 'Operate (Symbolic)',
      beta: 5.0,
      scaffoldingMode: 4,
      challengeTypes: ['add', 'subtract'],  // Can map to multiple challenge types
      description: 'Addition and subtraction using the frame.',
    },
  ],
  tutoring: { ... },
  supportsEvaluation: true,
},
```

### Design Guidelines for Eval Modes

**Ordering:** List modes from lowest β (easiest) to highest β (hardest). This matches the pedagogical progression.

**Mode naming:** Use the challenge type name when 1:1 (e.g., `build` → `['build']`). Use a descriptive verb when mapping to multiple types (e.g., `operate` → `['add', 'subtract']`).

**β values:** Must follow the PRD §5.3 prior difficulty table (see [lumina_difficulty_calibration_prd.md](lumina_difficulty_calibration_prd.md)):

| Scaffolding Mode | Description | Prior β |
|-----------------|-------------|---------|
| 1 | Concrete manipulatives with full guidance | 1.5 |
| 2 | Pictorial representation with prompts | 2.5 |
| 3 | Pictorial, reduced prompts | 3.5 |
| 4 | Transitional: mixed symbolic/pictorial | 5.0 |
| 5 | Fully symbolic, single operation | 6.5 |
| 6 | Symbolic, multi-step or cross-concept | 8.0 |

Within-mode adjustments of ±0.5–1.0 are allowed for: number range, operation type, distractor quality, and time constraints.

**Cross-reference with the backend.** The β values in catalog `evalModes` must match the backend's `PROBLEM_TYPE_REGISTRY` in [`problem_type_registry.py`](../../../../../backend/app/services/calibration/problem_type_registry.py). If entries already exist there, use those exact values.

**`challengeTypes` must match** the challenge type strings used in your generator schema and the challenge objects your component produces.

---

## Step 2: Add `CHALLENGE_TYPE_DOCS` to the Generator

The generator needs a structured registry of documentation per challenge type. This serves two purposes:
1. **Prompt docs** — only the relevant type's docs are included in the Gemini prompt
2. **Schema description** — used to build the constrained enum description

### 2a: Define the docs registry

Add this at the top of your generator file, after imports:

```typescript
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  type ChallengeTypeDoc,
} from '../evalMode';

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  build: {
    promptDoc:
      `"build": Student places exactly N counters on the frame. targetCount = N. `
      + `Use warm language. Numbers 1-7 for K, 1-10 for grades 1-2.`,
    schemaDescription: "'build' (place counters)",
  },
  subitize: {
    promptDoc:
      `"subitize": Counters flash briefly, student types how many they saw. `
      + `Set flashDuration: 1500-2000ms for K, 1000-1500ms for grades 1-2.`,
    schemaDescription: "'subitize' (flash and identify count)",
  },
  // ... one entry per challenge type
};
```

**Rules for `promptDoc`:**
- Start with the type name in quotes (e.g., `"build":`)
- Describe what the student does, not what Gemini should output
- Include key constraints (number ranges, required fields, grade-level notes)
- Keep it concise — this is injected into the prompt, so every token costs

**Rules for `schemaDescription`:**
- Short label format: `'type_name' (brief description)`
- Used in the schema enum description field

### 2b: Resolve the eval mode constraint

Inside your generator function, replace any hardcoded eval mode mapping with the shared utility:

```typescript
export const generateMyPrimitive = async (
  topic: string,
  gradeLevel: string,
  config?: {
    // ... existing config fields ...
    targetEvalMode?: string;
  }
): Promise<MyPrimitiveData> => {
  // Resolve eval mode from the catalog (single source of truth)
  const evalConstraint = resolveEvalModeConstraint(
    'my-primitive',        // Must match the catalog id
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
```

### 2c: Constrain the schema

Build a mode-constrained schema that narrows the `challenge.type` enum:

```typescript
  // When eval mode is active, schema enum restricts challenge.type
  // so Gemini *cannot* produce disallowed types. No post-filtering needed.
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(baseSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : baseSchema;
```

> **Literacy generators** use non-standard field paths. Pass a `SchemaConstraintConfig` as the 4th arg:
> ```typescript
> // challenges[].mode — e.g., LetterSpotter, RhymeStudio, WordWorkout
> constrainChallengeTypeEnum(schema, types, docs, { fieldName: 'mode' })
> // Root-level patternType — e.g., PhonicsBlender, SpellingPatternExplorer
> constrainChallengeTypeEnum(schema, types, docs, { fieldName: 'patternType', rootLevel: true })
> // instances[].type — e.g., FigurativeLanguageFinder
> constrainChallengeTypeEnum(schema, types, docs, { arrayName: 'instances' })
> ```

### 2d: Build the prompt with only relevant docs

Use `buildChallengeTypePromptSection()` to generate the challenge types section:

```typescript
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );
```

Then insert it into your prompt template:

```typescript
  const prompt = `
Create an educational activity for "${topic}" for ${gradeLevel} students.

CONTEXT:
...

${challengeTypeSection}

${!evalConstraint ? `
GUIDELINES FOR GRADE LEVELS:
... (only include when no eval mode is active)
` : ''}

REQUIREMENTS:
...
`;
```

When an eval mode is active, `challengeTypeSection` produces:

```
## ADAPTIVE DIFFICULTY CONSTRAINT (IRT calibration β=1.5)
Mode: Build (Concrete) — Place counters with full guidance.
Generate ONLY the following challenge type(s):

CHALLENGE TYPES (allowed for this mode):
- "build": Student places exactly N counters on the frame. targetCount = N. ...
```

When no eval mode, it includes all types:

```
CHALLENGE TYPES:
- "build": Student places exactly N counters on the frame. ...
- "subitize": Counters flash briefly, student types how many. ...
- "make_ten": Frame shows some counters, ...
- ...
```

### 2e: Pass the constrained schema to Gemini

```typescript
  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: activeSchema,  // ← constrained schema
    },
  });
```

### 2f: Update fallbacks

If your generator has a fallback for empty challenges, use the eval constraint's allowed types:

```typescript
  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'build';
    // ... build fallback challenge of that type
  }
```

### 2g: Add logging via the shared helper

Use `logEvalModeResolution()` from `evalMode/index.ts` instead of inline logging:

```typescript
import { logEvalModeResolution } from '../evalMode';

// After resolveEvalModeConstraint():
logEvalModeResolution('MyPrimitive', config?.targetEvalMode, evalConstraint);
```

### 2h: Remove old eval mode code

If your generator previously had:
- A hardcoded `evalModeConstraints` map → **delete it** (catalog is the source of truth)
- Post-generation filtering of challenge types → **delete it** (schema enum prevents wrong types)
- Eval mode hint strings in the prompt → **delete them** (replaced by `buildChallengeTypePromptSection`)

---

## Step 3: Verify the Generator Registration

The generator function accepts `targetEvalMode` in its config, but the **registration** in `registry/generators/[domain]Generators.ts` is the bridge between the API route and the generator. If the registration constructs a new config object with only specific fields (e.g., `{ intent: item.title }`), `targetEvalMode` will be silently dropped.

Open the registration file for your domain:
- Math: `service/registry/generators/mathGenerators.ts`
- Literacy: `service/registry/generators/literacyGenerators.ts`
- etc.

Find the `registerGenerator()` call for your primitive and check how it passes config.

**Broken pattern** (drops `targetEvalMode`):
```typescript
registerGenerator('my-primitive', async (item, topic, gradeContext) => ({
  type: 'my-primitive',
  instanceId: item.instanceId,
  data: await generateMyPrimitive(topic, gradeContext, {
    intent: item.intent || item.title,  // ❌ Only passes intent, loses targetEvalMode
  }),
}));
```

**Correct pattern** (spreads `item.config` first):
```typescript
registerGenerator('my-primitive', async (item, topic, gradeContext) => ({
  type: 'my-primitive',
  instanceId: item.instanceId,
  data: await generateMyPrimitive(topic, gradeContext, {
    ...item.config,                     // ✅ Passes targetEvalMode and all other config
    intent: item.intent || item.title,
  }),
}));
```

The `item.config` object comes from the API route, which receives it from the tester UI (or session assembly engine). Spreading it ensures `targetEvalMode` flows through.

> **Why this matters:** The generator logs `No targetEvalMode — full schema, mixed difficulty` even when a mode is selected in the tester if the registration doesn't forward `item.config`. This is a silent failure — no errors, just unconstrained output.

---

## Step 4: Update the Backend Problem Type Registry

The backend's `PROBLEM_TYPE_REGISTRY` in [`problem_type_registry.py`](../../../../../backend/app/services/calibration/problem_type_registry.py) must have matching entries for each eval mode. The IRT calibration system reads β priors from this registry at runtime.

If the primitive previously had a single `"default"` entry, replace it with one entry per eval mode:

```python
# Before (single mode)
"my-primitive": {"default": PriorConfig(2.0, "Description")},

# After (eval modes)
"my-primitive": {
    "mode_key_1":  PriorConfig(1.5, "Concrete: description"),
    "mode_key_2":  PriorConfig(2.5, "Pictorial: description"),
    "mode_key_3":  PriorConfig(3.5, "Strategy: description"),
},
```

**The β values must exactly match** the catalog's `evalModes[].beta`. If they diverge, the IRT system targets different difficulty than what the generator produces.

---

## Step 5: Verify

### Type check

```bash
cd my-tutoring-app && npx tsc --noEmit
```

### Test in the Primitives Tester

The `MathPrimitivesTester` (and other domain testers) automatically reads `evalModes` from the catalog and shows a mode selector dropdown. Select each eval mode and verify:

1. **All generated challenges match the selected mode** — no off-type challenges
2. **Prompt tokens are lower** — check console logs for shorter prompts
3. **Fallback works** — if Gemini returns empty, a sensible default is used
4. **No-eval-mode path unchanged** — without selecting a mode, mixed difficulty works as before

---

## What the Shared Utilities Do

All utilities live in `service/evalMode/index.ts`:

| Function | Purpose | When to Call |
|----------|---------|-------------|
| `resolveEvalModeConstraint()` | Reads the catalog's `EvalModeDefinition`, builds allowed types + prompt docs | Once at the top of your generator |
| `constrainChallengeTypeEnum()` | Deep-clones the schema, narrows challenge-type enum to allowed values. Accepts optional `SchemaConstraintConfig` for non-standard field paths (literacy generators). | Before calling `ai.models.generateContent()` |
| `buildChallengeTypePromptSection()` | Builds the challenge types prompt section with only relevant docs | When constructing the prompt string |
| `logEvalModeResolution()` | Logs the resolved eval mode for observability | After `resolveEvalModeConstraint()` |

### What stays in the generator (domain-specific)

| Concern | Why it stays |
|---------|-------------|
| `CHALLENGE_TYPE_DOCS` | Each primitive has different challenge types with unique docs |
| Domain validation (e.g., startCount inference) | Specific to the primitive's data model |
| Instruction ↔ numeric field consistency checks | Domain-specific invariants |
| Fallback challenge definitions | Each primitive knows what a sensible default looks like |
| Base schema definition | Unique per primitive |

---

## EvalModeDefinition Interface Reference

Defined in `types.ts`:

```typescript
export interface EvalModeDefinition {
  /** Eval mode key sent to the backend (e.g., 'build', 'subitize') */
  evalMode: string;
  /** Human-readable label for UI display */
  label: string;
  /** IRT prior β from the problem-type registry (1.0–10.0 scale) */
  beta: number;
  /** Scaffolding mode (1-6) this eval mode maps to in the PRD mode taxonomy */
  scaffoldingMode: number;
  /** Which challenge types the generator should produce for this eval mode */
  challengeTypes: string[];
  /** Brief description of what this mode tests */
  description: string;
}
```

---

## Reference Implementation

**Ten Frame** is the first primitive with eval modes. Use it as a reference:

| File | What to look at |
|------|----------------|
| [catalog/math.ts](../service/manifest/catalog/math.ts) (search for `id: 'ten-frame'`) | `evalModes` array with 4 modes (build → subitize → make_ten → operate) |
| [gemini-ten-frame.ts](../service/math/gemini-ten-frame.ts) | `CHALLENGE_TYPE_DOCS`, `resolveEvalModeConstraint()`, `constrainChallengeTypeEnum()`, `buildChallengeTypePromptSection()` usage |
| [evalMode/index.ts](../service/evalMode/index.ts) | Shared utilities |
| [types.ts](../types.ts) (search for `EvalModeDefinition`) | Type definitions |

---

## Checklist

- [ ] Identified 2+ challenge types that represent distinct difficulty levels
- [ ] Added `evalModes` array to catalog entry in `catalog/[domain].ts`
- [ ] Each eval mode has `evalMode`, `label`, `beta`, `scaffoldingMode`, `challengeTypes`, `description`
- [ ] Modes ordered from lowest β (easiest) to highest β (hardest)
- [ ] `challengeTypes` values match the challenge type strings in the generator schema
- [ ] Added `CHALLENGE_TYPE_DOCS` registry to the generator with `promptDoc` + `schemaDescription` per type
- [ ] Generator calls `resolveEvalModeConstraint()` with the correct `componentId`
- [ ] Schema constrained via `constrainChallengeTypeEnum()` before Gemini call
- [ ] Prompt built with `buildChallengeTypePromptSection()` (no hardcoded mode hints)
- [ ] Removed any old eval mode code (hardcoded constraint maps, post-generation filtering)
- [ ] Fallback uses `evalConstraint?.allowedTypes[0]` for correct fallback type
- [ ] Logging added via `logEvalModeResolution()` from `evalMode/index.ts`
- [ ] Generator registration in `registry/generators/[domain]Generators.ts` spreads `...item.config` (not just cherry-picked fields)
- [ ] Backend `PROBLEM_TYPE_REGISTRY` in `problem_type_registry.py` updated with matching β priors (or confirmed existing entries match)
- [ ] TypeScript compiles without errors (`npx tsc --noEmit`)
- [ ] Tested each eval mode in the domain Primitives Tester — all challenges match the mode
- [ ] Tested no-eval-mode path — mixed difficulty generation unchanged

## Additional Resources

- **[lumina_difficulty_calibration_prd.md](lumina_difficulty_calibration_prd.md)** - IRT calibration PRD with §5.3 prior difficulty table and full system design
- **[problem_type_registry.py](../../../../../backend/app/services/calibration/problem_type_registry.py)** - Backend β priors per (primitive, eval_mode) — catalog values must match
- **[ADDING_PRIMITIVES.md](ADDING_PRIMITIVES.md)** - Full guide for creating new primitives
- **[ADDING_TUTORING_SCAFFOLD.md](ADDING_TUTORING_SCAFFOLD.md)** - Adding AI tutoring scaffolding
- **[types.ts](../types.ts)** - `EvalModeDefinition` and `ComponentDefinition` interfaces
- **[catalog/index.ts](../service/manifest/catalog/index.ts)** - `getComponentById()` lookup used by the eval mode resolver
