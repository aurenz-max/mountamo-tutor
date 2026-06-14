# Adding Eval Modes to Primitives

This guide explains how to add eval modes to an existing primitive's generator. **Eval modes are distinct SKILLS (task identities), not difficulty levels.** The generator resolves *which* mode(s) to run from the component's **intent** and constrains its output via the schema enum so it produces **only** those challenge types — no post-filtering.

## What changed (2026-06-13) — read this first

The old design treated eval modes as a difficulty ladder and had the generator read a single pinned mode (`resolveEvalModeConstraint`). That had two problems:

1. **Modes aren't difficulty tiers — they're different skills.** ten-frame's `make_ten` (complements to 10) is not a "harder build"; it's a different thing to learn. Framing modes as easy→hard made the curator pick the lowest rung every time, contradicting its own intent. See [[structural-difficulty-not-numeric]].
2. **The manifest can't pick the mode reliably.** The valid mode set is a *function of the primitive* (`componentId`), and Gemini's `responseSchema` can't express a dependent/conditional enum. So a manifest-level mode field is either a free string (no constraint) or a union-of-all-modes enum (cognitively brutal, and lets ten-frame get a number-line mode). The per-primitive enum is only expressible **downstream, in the generator**, where the one primitive is known.

**The new design: `resolveEvalModes` (generator-driven).** Each generator resolves its own mode set from intent, producing one of three outcomes:

- **single** — intent maps to one skill → that mode only
- **curated blend** — intent spans 2-3 skills → the union of those modes' challenge types
- **mixed** — intent is broad / no single skill → schema left unconstrained (all types). Mixed is a legitimate pedagogical choice, not a failure.

An explicit `config.targetEvalMode` (the eval-test tester, or a curator override) **pins one mode with NO LLM call** and short-circuits intent resolution.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  catalog/[domain].ts  (SINGLE SOURCE OF TRUTH)               │
│  { id: 'ten-frame', evalModes: [                             │
│    { evalMode: 'build', challengeTypes: ['build'], β: 1.5 }, │
│    { evalMode: 'operate', challengeTypes: ['add','subtract']}│
│  ]}                                                          │
└─────────────┬───────────────────────────────────────────────┘
              │ resolveEvalModes(id, { targetEvalMode, intent, objectiveText }, docs)
              ▼
┌─────────────────────────────────────────────────────────────┐
│  service/evalMode/index.ts  (SHARED RESOLVER)               │
│  1. targetEvalMode set? → that ONE mode, NO LLM call         │
│  2. else ≥2 modes + intent → flash-lite enum micro-call      │
│       scoped to THIS primitive's mode keys                   │
│  3. selection → union challengeTypes → EvalModeResolution    │
│       (one=single · several=blend · all/none=null=mixed)     │
└─────────────┬───────────────────────────────────────────────┘
              │ resolution (or null) → constrained schema + focused prompt
              ▼
┌─────────────────────────────────────────────────────────────┐
│  service/[domain]/gemini-[primitive].ts  (GENERATOR)         │
│  Schema enum = union of selected modes' challenge types      │
│  → Gemini cannot output other types. No post-filtering.      │
│  → null resolution = mixed (schema left open, all types)     │
└─────────────────────────────────────────────────────────────┘
```

**Key principle:** The schema `enum` constraint means Gemini *cannot* output disallowed challenge types. This replaces asking in the prompt (which Gemini ignores ~30% of the time) and post-filtering. The resolver decides *which* types are allowed; the schema enforces it.

---

## When to Add Eval Modes

Add eval modes when:
- Your primitive has **2+ distinct challenge types**, each a meaningful **skill** (not just a numeric difficulty knob)
- The skills map to different things the student does (concrete → abstract is a fine progression, but each rung is its own skill)

Skip eval modes for:
- Single-mode primitives (only one challenge type)
- Display-only / non-evaluable primitives
- Primitives where difficulty is controlled purely by numeric parameters (not type)

---

## Quick Start: 4 Changes

| Step | File | What to Do |
|------|------|------------|
| 1 | `catalog/[domain].ts` | Add `evalModes` array to catalog entry |
| 2 | `service/[domain]/gemini-[primitive].ts` | Add `CHALLENGE_TYPE_DOCS` + wire `resolveEvalModes` |
| 3 | `registry/generators/[domain]Generators.ts` | Registration spreads `...item.config` **and** passes `intent` |
| 4 | Verify | `npx tsc --noEmit` + Primitives Tester (pins) + `/topic-trace` (intent resolution) |

No new files needed — the shared utilities in `service/evalMode/index.ts` already exist.

---

## Step 1: Add `evalModes` to the Catalog Entry

Open the domain catalog file and add an `evalModes` array to your primitive's entry. Each mode is a distinct skill with an IRT difficulty prior (β) used by the calibration system.

```typescript
// catalog/math.ts
{
  id: 'my-primitive',
  description: '...',
  constraints: '...',
  evalModes: [
    {
      evalMode: 'build',              // Key matched by config.targetEvalMode / resolver
      label: 'Build (Concrete)',       // Human-readable label for UI
      beta: 1.5,                       // IRT prior β (1.0–10.0)
      scaffoldingMode: 1,              // Maps to PRD scaffolding mode (1-6)
      challengeTypes: ['build'],       // Which challenge types this skill produces
      description: 'Place counters with full guidance. Lowest cognitive load.',
    },
    {
      evalMode: 'operate',
      label: 'Operate (Symbolic)',
      beta: 5.0,
      scaffoldingMode: 4,
      challengeTypes: ['add', 'subtract'],  // A mode can own multiple challenge types
      description: 'Addition and subtraction using the frame.',
    },
  ],
  tutoring: { ... },
  supportsEvaluation: true,
},
```

### Design Guidelines for Eval Modes

**Ordering:** List modes from lowest β to highest β. This is a catalog convention for readability and the IRT priors — it is **not** a ladder the curator climbs. β is deliberately NOT shown to the curator/resolver; modes are matched to intent by SKILL, never by β proximity or lesson position.

**Mode naming:** Use the challenge type name when 1:1 (e.g., `build` → `['build']`). Use a descriptive verb when mapping to multiple types (e.g., `operate` → `['add', 'subtract']`). The resolver unions `challengeTypes` across selected modes, so a `make_ten + operate` blend allows exactly `make_ten/add/subtract`.

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

## Step 2: Wire `resolveEvalModes` in the Generator

### 2a: Define the docs registry

The generator needs a structured registry of documentation per challenge type:
1. **Prompt docs** — only the allowed types' docs are injected into the Gemini prompt
2. **Schema description** — used to build the constrained enum description

Add this at the top of your generator file, after imports:

```typescript
import {
  resolveEvalModes,
  constrainChallengeTypeEnum,
  buildModeConstraintSection,
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

**Rules for `promptDoc`:** start with the type name in quotes; describe what the student does; include key constraints (ranges, required fields, grade notes); keep it concise — every token costs.

**Rules for `schemaDescription`:** short label format `'type_name' (brief description)`; used in the schema enum description field.

### 2b: Resolve the eval mode(s)

The generator function must be `async` (it already awaits Gemini). `resolveEvalModes` makes its own micro-call, so it is awaited too:

```typescript
export const generateMyPrimitive = async (
  topic: string,
  gradeLevel: string,
  config?: {
    // ... existing config fields ...
    /** Eval mode pinned by the tester/curator. Wins over intent resolution, NO LLM call. */
    targetEvalMode?: string;
    /** Component intent — the routing signal when no mode is pinned. */
    intent?: string;
    /** Parent objective text (stamped by flattenManifestToLayout) — secondary signal. */
    objectiveText?: string;
  }
): Promise<MyPrimitiveData> => {
  // Resolve which skill(s) this component should teach.
  const resolution = await resolveEvalModes(
    'my-primitive',        // Must match the catalog id
    { targetEvalMode: config?.targetEvalMode, intent: config?.intent, objectiveText: config?.objectiveText },
    CHALLENGE_TYPE_DOCS,
  );
  const allowedTypes = resolution?.allowedTypes;
```

`resolveEvalModes` returns `EvalModeResolution | null`:
- **explicit pin** (`targetEvalMode` set) → that one mode, no LLM call.
- **intent resolution** (no pin, primitive has ≥2 modes) → single | blend.
- **`null`** → mixed (no constraint). `resolution.allowedTypes` = union of selected modes' challenge types; `resolution.modes` = the selected `EvalModeDefinition`s; `resolution.source` = `'explicit' | 'resolved'`.

### 2c: Constrain the schema

```typescript
  // When mode(s) resolved, the schema enum restricts challenge.type to the union
  // of selected types so Gemini *cannot* produce others. null → mixed (open schema).
  const activeSchema = resolution
    ? constrainChallengeTypeEnum(baseSchema, resolution.allowedTypes, CHALLENGE_TYPE_DOCS)
    : baseSchema;
```

> **Literacy generators** use non-standard field paths. Pass a `SchemaConstraintConfig` as the 4th arg:
> ```typescript
> // challenges[].mode — e.g., LetterSpotter, RhymeStudio, WordWorkout
> constrainChallengeTypeEnum(schema, resolution.allowedTypes, docs, { fieldName: 'mode' })
> // Root-level patternType — e.g., PhonicsBlender, SpellingPatternExplorer
> constrainChallengeTypeEnum(schema, resolution.allowedTypes, docs, { fieldName: 'patternType', rootLevel: true })
> // instances[].type — e.g., FigurativeLanguageFinder
> constrainChallengeTypeEnum(schema, resolution.allowedTypes, docs, { arrayName: 'instances' })
> ```

### 2d: Build the prompt with only the relevant docs

`buildModeConstraintSection` renders all three cases (single / curated blend / mixed-all):

```typescript
  const challengeTypeSection = buildModeConstraintSection(resolution, CHALLENGE_TYPE_DOCS);
```

Insert it into your prompt, and wrap any grade-level guidelines so they only appear for the mixed case:

```typescript
  const prompt = `
Create an educational activity for "${topic}" for ${gradeLevel} students.

CONTEXT:
...

${challengeTypeSection}

${!resolution ? `
GUIDELINES FOR GRADE LEVELS:
... (only include when no mode is resolved — i.e. mixed)
` : ''}

REQUIREMENTS:
...
`;
```

**Single mode** produces:

```
## EVAL MODE: Build (Concrete) (β=1.5)
Place counters with full guidance. Lowest cognitive load.
Generate ONLY the following challenge type(s):

- "build": Student places exactly N counters on the frame. targetCount = N. ...
```

**Curated blend** produces:

```
## EVAL MODES — CURATED BLEND: Make Ten (Strategy) + Operate (Symbolic)
Generate a MIX of ONLY the challenge types below, distributed across the session (do not collapse to just one):

- "make_ten": Frame shows some counters, student enters how many more to fill ...
- "add": ...
- "subtract": ...
```

**Mixed** (`null`) includes all types:

```
CHALLENGE TYPES (mixed session — vary across all of these):
- "build": ...
- "subitize": ...
- "make_ten": ...
```

### 2e: Pass the constrained schema to Gemini

```typescript
  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: activeSchema,  // ← constrained schema (or base, when mixed)
    },
  });
```

### 2f: Within-mode support tier (single mode only)

`config.difficulty` ('easy' | 'medium' | 'hard') is the structural **support tier** — how much on-screen scaffolding the student gets *within one skill*, applied deterministically **post-generation** (code owns the support structure; the LLM only chose numbers). It NEVER changes the target numbers — the pedagogical scope owns those. A curated **blend** has no single tier surface, so gate it on a single resolved mode:

```typescript
  const pinnedType = allowedTypes?.[0] as ChallengeType | undefined;
  const supportTier = normalizeSupportTier(config?.difficulty);
  const tierScaffold =
    resolution && resolution.modes.length === 1 && pinnedType && supportTier
      ? resolveSupportStructure(pinnedType, supportTier)   // primitive-defined
      : null;
```

ten-frame's `resolveSupportStructure` is the reference: showCount/showEquation withdraw as the tier hardens, the subitize flash window shrinks (2000/1500/1000ms). Define the structural changes per-primitive. (See [[structural-difficulty-not-numeric]] — the older numeric pool-service band pattern in `service/difficulty/difficultyContext.ts` is RETIRED; numeric jitter changes the numbers, not the difficulty.)

### 2g: Update fallbacks

```typescript
  if (data.challenges.length === 0) {
    const fallbackType = resolution?.allowedTypes[0] ?? 'build';
    // ... build fallback challenge of that type
  }
```

### 2h: Add logging

```typescript
  console.log(
    `[MyPrimitive] modes: ${resolution ? `${resolution.modes.map(m => m.evalMode).join('+')} (${resolution.source})` : 'mixed'} → types [${(resolution?.allowedTypes ?? ['all']).join(', ')}]`,
  );
```

### 2i: Remove old eval mode code

If your generator previously had:
- A hardcoded `evalModeConstraints` map → **delete it** (catalog is the source of truth)
- Post-generation filtering of challenge types → **delete it** (schema enum prevents wrong types)
- Legacy `resolveEvalModeConstraint` / `buildChallengeTypePromptSection` calls → **replace** with `resolveEvalModes` / `buildModeConstraintSection`
- Eval mode hint strings in the prompt → **delete them**

---

## Step 3: Verify the Generator Registration

The registration in `registry/generators/[domain]Generators.ts` is the bridge between the API route and the generator. It must spread `item.config` (carries `targetEvalMode` from the tester + `objectiveText` stamped by `flattenManifestToLayout`) **and** pass `intent` (the routing signal for unpinned resolution).

Open the registration file for your domain (e.g. `service/registry/generators/mathGenerators.ts`), find the `registerGenerator()` call, and check both are forwarded.

**Broken pattern** (drops `targetEvalMode` + `objectiveText`):
```typescript
registerGenerator('my-primitive', async (item, topic, gradeContext) => ({
  type: 'my-primitive',
  instanceId: item.instanceId,
  data: await generateMyPrimitive(topic, gradeContext, {
    intent: item.intent || item.title,  // ❌ Only intent — config lost
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

> **Why this matters:** without `...item.config` the tester's `targetEvalMode` is dropped; without `intent` the unpinned path has no signal and silently falls back to mixed. No errors — just unconstrained output.

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

**The β values must exactly match** the catalog's `evalModes[].beta`. If they diverge, the IRT system targets a different difficulty than what the generator produces.

---

## Step 5: Verify

### Type check

```bash
cd my-tutoring-app && npx tsc --noEmit
```

### Test the two paths

1. **Primitives Tester (explicit pin).** The `MathPrimitivesTester` (and other domain testers) reads `evalModes` from the catalog and shows a mode selector. It passes `targetEvalMode`, exercising the **explicit** path. Select each mode → verify all challenges match, prompt tokens are lower, fallback works.
2. **`/topic-trace` (intent resolution).** The Tester can't exercise the unpinned path (it always pins). Run `/topic-trace` on a topic whose objective implies one skill → verify intent resolves to the right single mode. Try a broad objective → verify it resolves to a blend or mixed.
3. **No-mode path** — verify mixed (unconstrained) generation is unchanged.

---

## What the Shared Utilities Do

All utilities live in `service/evalMode/index.ts`:

| Function | Purpose | When to Call |
|----------|---------|-------------|
| `resolveEvalModes()` | **(current)** Resolves single \| blend \| mixed from intent (or an explicit pin). Returns `EvalModeResolution \| null`. Makes a flash-lite enum micro-call only when unpinned. | Once at the top of your generator (`await`) |
| `constrainChallengeTypeEnum()` | Deep-clones the schema, narrows the challenge-type enum to `resolution.allowedTypes`. Accepts optional `SchemaConstraintConfig` for non-standard field paths (literacy). | Before `ai.models.generateContent()` |
| `buildModeConstraintSection()` | Builds the challenge-types prompt section for all three cases (single/blend/mixed). | When constructing the prompt string |
| `resolveEvalModeConstraint()` | **(legacy, single-mode only)** Reads one `EvalModeDefinition` → allowed types + docs. Still used by generators not yet migrated to `resolveEvalModes`. | — (prefer `resolveEvalModes`) |
| `buildChallengeTypePromptSection()` | **(legacy)** Single-mode prompt section. Superseded by `buildModeConstraintSection`. | — |
| `logEvalModeResolution()` | Legacy single-mode logger. New code uses the inline `console.log` in 2h. | — |

### What stays in the generator (domain-specific)

| Concern | Why it stays |
|---------|-------------|
| `CHALLENGE_TYPE_DOCS` | Each primitive has different challenge types with unique docs |
| `resolveSupportStructure` / support-tier scaffolding | Structural support is per-primitive (what "less scaffolding" means) |
| Domain validation (e.g., startCount inference) | Specific to the primitive's data model |
| Instruction ↔ numeric field consistency checks | Domain-specific invariants |
| Fallback challenge definitions | Each primitive knows what a sensible default looks like |
| Base schema definition | Unique per primitive |

---

## EvalModeDefinition Interface Reference

Defined in `types.ts`:

```typescript
export interface EvalModeDefinition {
  /** Eval mode key (e.g., 'build', 'subitize') */
  evalMode: string;
  /** Human-readable label for UI display */
  label: string;
  /** IRT prior β from the problem-type registry (1.0–10.0 scale) */
  beta: number;
  /** Scaffolding mode (1-6) this eval mode maps to in the PRD mode taxonomy */
  scaffoldingMode: number;
  /** Which challenge types the generator should produce for this mode */
  challengeTypes: string[];
  /** Brief description of what this mode tests — also feeds the resolver's enum prompt */
  description: string;
}
```

`resolveEvalModes` returns:

```typescript
export interface EvalModeResolution {
  /** Selected mode definitions. length 1 = single skill, 2+ = curated blend. */
  modes: EvalModeDefinition[];
  /** Union of challenge types across the selected modes (schema-enum source). */
  allowedTypes: string[];
  /** Prompt fragment: docs for the allowed challenge types only. */
  promptDocs: string;
  /** How the selection was made — observability only. */
  source: 'explicit' | 'resolved';
}
// null return = MIXED (caller leaves the schema unconstrained)
```

---

## Reference Implementation

**Ten Frame** is the reference for the new design (4 modes: build → subitize → make_ten → operate):

| File | What to look at |
|------|----------------|
| [catalog/math.ts](../service/manifest/catalog/math.ts) (search `id: 'ten-frame'`) | `evalModes` array (`operate` → `['add','subtract']` shows the union case) |
| [gemini-ten-frame.ts](../service/math/gemini-ten-frame.ts) | `CHALLENGE_TYPE_DOCS`, `resolveEvalModes()`, `constrainChallengeTypeEnum()`, `buildModeConstraintSection()`, `resolveSupportStructure()` (single-mode tier) |
| [evalMode/index.ts](../service/evalMode/index.ts) | `resolveEvalModes`, `buildModeConstraintSection`, `EvalModeResolution` |
| [types.ts](../types.ts) (search `EvalModeDefinition`) | Type definitions |

> **Rollout status:** ten-frame is the migrated reference. The other ~57 mode-bearing generators still call the legacy single-mode `resolveEvalModeConstraint` path and will be migrated incrementally. When migrating one, follow Step 2 above.

---

## Checklist

- [ ] Identified 2+ challenge types that are distinct **skills** (not just numeric difficulty)
- [ ] Added `evalModes` array to catalog entry in `catalog/[domain].ts`
- [ ] Each eval mode has `evalMode`, `label`, `beta`, `scaffoldingMode`, `challengeTypes`, `description`
- [ ] Modes ordered low β → high β (catalog convention; β is NOT shown to the resolver)
- [ ] `challengeTypes` values match the challenge type strings in the generator schema
- [ ] Added `CHALLENGE_TYPE_DOCS` registry with `promptDoc` + `schemaDescription` per type
- [ ] Generator is `async` and `await`s `resolveEvalModes(id, { targetEvalMode, intent, objectiveText }, docs)`
- [ ] `targetEvalMode`, `intent`, `objectiveText` added to the config type
- [ ] Schema constrained via `constrainChallengeTypeEnum(baseSchema, resolution.allowedTypes, ...)` before the Gemini call
- [ ] Prompt built with `buildModeConstraintSection(resolution, ...)` (no hardcoded mode hints)
- [ ] Support tier (`config.difficulty`) gated on `resolution.modes.length === 1`
- [ ] Removed old eval mode code (constraint maps, post-filtering, legacy `resolveEvalModeConstraint`/`buildChallengeTypePromptSection`, mode hint strings)
- [ ] Fallback uses `resolution?.allowedTypes[0]`
- [ ] Logging added (inline `console.log` from 2h)
- [ ] Generator registration spreads `...item.config` **and** passes `intent`
- [ ] Backend `PROBLEM_TYPE_REGISTRY` updated with matching β priors (or confirmed existing match)
- [ ] TypeScript compiles without errors (`npx tsc --noEmit`)
- [ ] Tested explicit pins in the Primitives Tester + intent resolution via `/topic-trace`
- [ ] Tested no-mode (mixed) path — unchanged

## Additional Resources

- **[lumina_difficulty_calibration_prd.md](lumina_difficulty_calibration_prd.md)** - IRT calibration PRD with §5.3 prior difficulty table and full system design
- **[problem_type_registry.py](../../../../../backend/app/services/calibration/problem_type_registry.py)** - Backend β priors per (primitive, eval_mode) — catalog values must match
- **[ADDING_PRIMITIVES.md](ADDING_PRIMITIVES.md)** - Full guide for creating new primitives
- **[ADDING_TUTORING_SCAFFOLD.md](ADDING_TUTORING_SCAFFOLD.md)** - Adding AI tutoring scaffolding
- **[types.ts](../types.ts)** - `EvalModeDefinition` and `ComponentDefinition` interfaces
- **[catalog/index.ts](../service/manifest/catalog/index.ts)** - `getComponentById()` lookup used by the resolver
