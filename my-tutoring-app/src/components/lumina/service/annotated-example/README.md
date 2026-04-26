# Annotated Example — Service README

Three-stage pipeline that turns a topic prompt into a [RichAnnotatedExampleData](../../primitives/annotated-example/types.ts) payload for the [AnnotatedExample](../../primitives/AnnotatedExample.tsx) renderer.

## Why three stages instead of one (vs. DeepDive)

[gemini-deep-dive.ts](../core/gemini-deep-dive.ts) uses two stages — orchestrator plans block types and content briefs, then per-block generators run in parallel. That works for editorial / exploratory content where the LLM owns both *what to teach* and *how to render it*.

For worked math examples, that pattern fails: the planner doesn't know if the math is correct, the per-block generators have no shared math state, and the LLM tends to hallucinate intermediate steps. So we split planning from solving:

1. **SOLVER** ([solver.ts](solver.ts)) — `gemini-3-flash-preview` with thinking HIGH and **code execution** writes a free-form prose solution. It separates strategic moves with `---`. It knows nothing about primitives. Code execution is the trick — every numerical step is grounded in a Python run, not LLM arithmetic.
2. **BLOCKS** ([blocks.ts](blocks.ts)) — deterministic split on `---`. No LLM. The solver already decided where one move ends and the next begins; re-deriving that boundary with another LLM just loses information.
3. **PLAN + GENERATE** ([planner.ts](planner.ts) + [registry.ts](registry.ts) + [generators/](generators/)) — the planner sees the *whole* solved problem and produces an ordered `StepSpec[]`. Each spec maps 1:1 to a block, consolidates two adjacent blocks, or is **injected** (no grounding block — e.g. an opening graph for an area-between-curves problem). Per-spec generators run in parallel.

The math is solved exactly once, in stage 1. Stages 2-3 only decide how to *render* it.

## Pipeline contract

```
topic + gradeContext
       │
       ▼
   solver.ts ──► SolvedProblem { title, subject, strategy, problemStatement, body }
       │                                                              │
       ▼                                                              ▼
   blocks.ts ──► SolverBlock[] (1 per `---` move)             (passes through)
       │
       ▼
   planner.ts ──► PlannerDebugPayload { specs, unusedBlockIndices, mergedCount, injectedCount, fallback }
       │              │
       │              └─► StepSpec { stepType, title, pedagogicalGoal, groundingBlockIndices, seedNotes }
       ▼
   registry.ts.generateStep(spec.stepType, ctx)
       │
       └─► generators/<type>.ts → GeneratedStep { content: StepContent, annotations: StepAnnotations }

       (all specs run via Promise.all)
       │
       ▼
   RichAnnotatedExampleData { problem, solutionStrategy, steps[], solverDebug }
```

`solverDebug` is what powers the `PipelineDebugCard` in the renderer — it's how you see whether the planner dropped a block, merged sensibly, or injected a phantom step.

## File responsibilities

| File | Stage | Role |
|---|---|---|
| [solver.ts](solver.ts) | 1 | LLM solve with code execution. Output format is strict (TITLE/SUBJECT/PROBLEM/STRATEGY + `---`-separated moves). |
| [blocks.ts](blocks.ts) | 2 | Pure string split. Re-indexes after filtering empty blocks. |
| [planner.ts](planner.ts) | 3a | Single LLM call (`gemini-3-flash-preview`, thinking HIGH). Picks `stepType` per spec from the registry. Defaults to 1:1; merge/inject are explicitly bounded. Falls back to a 1:1 algebra plan on hard failure (`buildFallbackPlan`). |
| [registry.ts](registry.ts) | 3b | Single source of truth for the primitive catalog. Planner reads `whenToUse` from here; orchestrator looks up `generate` and `extractResult`. |
| [generators/_shared.ts](generators/_shared.ts) | 3b | `PrimitiveDef` interface + `StepGeneratorContext` + the shared annotation schema (steps / strategy / misconceptions / connections — same 4 layers on every step). |
| [generators/<type>.ts](generators/) | 3b | One file per primitive. Owns its Gemini schema, prompt, and post-processing. |
| [mathEvaluator.ts](mathEvaluator.ts) | 3b | Numerical correction — when a transition's "to" disagrees with what `from` actually evaluates to, patch the string. Used by the algebra generator. |
| [gemini-annotated-example.ts](gemini-annotated-example.ts) | orchestrator | Wires all four stages. Public entrypoint. |

## The `PrimitiveDef` contract

Every generator file exports one `PrimitiveDef` (defined in [_shared.ts](generators/_shared.ts)):

```ts
interface PrimitiveDef {
  id: StepType;                                        // matches StepContent['type']
  whenToUse: string;                                   // injected into the planner prompt
  generate: (ctx: StepGeneratorContext) => Promise<GeneratedStep>;
  extractResult: (content: StepContent, explicit?: string) => string;
}
```

The generator gets this context (built by the orchestrator from the planner's spec):

```ts
interface StepGeneratorContext {
  topic: string;
  gradeContext: string;
  problemStatement: string;     // for context — don't re-solve
  solutionStrategy: string;     // for context
  priorStepSummaries: string[]; // titles of preceding specs, for narrative coherence
  pedagogicalGoal: string;      // planner-supplied: what this step TEACHES
  seedNotes: string;            // planner-supplied: what to extract / construct
  groundingProse: string;       // joined prose from grounding solver blocks (empty for injected)
}
```

And returns:

```ts
interface GeneratedStep {
  content: StepContent;          // typed primitive payload (algebra / table / graph-sketch / …)
  annotations: StepAnnotations;  // 4 layers — steps / strategy / misconceptions / connections
  result?: string;               // optional explicit final expression
}
```

**Source of truth rule.** When `groundingProse` is non-empty, the generator must extract from it — *not* re-derive the math. The solver already did the math (with Python). Re-deriving in the per-type prompt is the #1 source of contradictory steps. Look at [generators/algebra.ts](generators/algebra.ts) for the canonical example: extract the KaTeX from the prose, then run `mathEvaluator.tryEvaluateKatex` to verify the LLM didn't fudge a number.

When `groundingProse` is empty (planner-injected step), the generator builds from `seedNotes` + `problemStatement` alone. Keep injection rare — see the planner prompt's "Strict limits on injection" section.

## How to add a new primitive

You need to touch **three** files to add a primitive. There is no auto-registration.

### 1. Add the type to the union

[primitives/annotated-example/types.ts](../../primitives/annotated-example/types.ts):

```ts
export interface MyNewStepContent {
  type: 'my-new';
  // …shape-specific fields…
}

export type StepContent =
  | AlgebraStepContent
  | …
  | MyNewStepContent;   // ← add here
```

`StepType` is derived from `StepContent['type']`, so the planner's enum updates automatically.

### 2. Write the generator

`generators/my-new.ts`. Mirror [generators/algebra.ts](generators/algebra.ts):

```ts
import { Type, Schema } from '@google/genai';
import { ai } from '../../geminiClient';
import {
  ANNOTATIONS_SCHEMA_FIELDS,
  ANNOTATIONS_REQUIRED,
  annotationPromptSuffix,
  buildStepContextPrefix,
  extractAnnotations,
  type PrimitiveDef,
  type StepGeneratorContext,
} from './_shared';

const MY_NEW_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    // …flat fields. Avoid deep nesting — Gemini flash-lite returns malformed JSON
    // on schemas with 6+ types or 3+ nesting levels. Use rowNcolM patterns instead.
    ...ANNOTATIONS_SCHEMA_FIELDS,
  },
  required: [/* your required fields */, ...ANNOTATIONS_REQUIRED],
};

async function generateMyNewStep(ctx: StepGeneratorContext) {
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `…${buildStepContextPrefix(ctx)}…${annotationPromptSuffix(ctx.pedagogicalGoal)}`,
    config: { responseMimeType: 'application/json', responseSchema: MY_NEW_SCHEMA },
  });
  const data = JSON.parse(response.text!);
  return {
    content: { type: 'my-new', /* …reconstruct from flat fields… */ },
    annotations: extractAnnotations(data),
  };
}

export const myNewPrimitive: PrimitiveDef = {
  id: 'my-new',
  whenToUse: 'One paragraph telling the planner exactly when to pick this. Be specific about the shape — vague descriptions cause planner drift.',
  generate: generateMyNewStep,
  extractResult: (c) => (c.type === 'my-new' ? c.someField : ''),
};
```

### 3. Register it

[registry.ts](registry.ts):

```ts
import { myNewPrimitive } from './generators/my-new';

export const PRIMITIVE_REGISTRY: Record<StepType, PrimitiveDef> = {
  algebra: algebraPrimitive,
  // …
  'my-new': myNewPrimitive,
};
```

That's it for the service side. The planner's prompt is built from `formatCatalogForPrompt()` so adding to the registry automatically extends the planner's enum and `whenToUse` list. **No prompt edits in planner.ts.**

### 4. Render it

You also need a renderer in [primitives/annotated-example/StepContentRenderer.tsx](../../primitives/annotated-example/StepContentRenderer.tsx) — that's the React side, not service side, but it's the other half of "adding a primitive."

### Schema gotchas

- **Flatten everything.** `pt0X / pt0Y / pt0Label` rather than `points: [{x,y,label}]`. Flash-lite's JSON mode ships malformed nested arrays for schemas above ~3 nesting levels. See `graph-sketch.ts` for the pattern.
- **Mark optionals `nullable: true`.** Required-with-undefined is a different failure mode than nullable.
- **Always include `ANNOTATIONS_SCHEMA_FIELDS` and `...ANNOTATIONS_REQUIRED`.** All four layers (steps / strategy / misconceptions / connections) on every step is a hard rule of the renderer.

## Generator-as-orchestrator (escalation pattern)

A `PrimitiveDef.generate` is just `(ctx) => Promise<GeneratedStep>`. There's nothing requiring it to be one Gemini call. When a primitive's responsibilities grow — e.g. `canvas-2d` needs to extract curves, then resolve intersection points, then place labels without collision — the generator can fan out into multiple parallel calls internally. Look at how [gemini-deep-dive.ts](../core/gemini-deep-dive.ts)'s `generateDiagram` does this: meta call → image call → vision-model placement call, all inside one block generator.

The contract is what matters: in goes a `StepGeneratorContext`, out comes a `GeneratedStep`. How many LLM calls and what models you use is private to the generator. So **"new primitive" doesn't mean "new monolithic prompt"** — it means a new schema + renderer + planner entry. The generator behind it can be as orchestrated as it needs to be, and over time some sub-steps in a primitive's generation will not be LLM calls at all (deterministic math evaluators, registered checkers, planner-injected scaffolding).

## Debugging via the pipeline debug card

The [PipelineDebugCard](../../primitives/AnnotatedExample.tsx) reads `solverDebug`. The summary line tells you everything:

```
Solver 5 blocks · Planner 6 specs (1 injected) · Rendered 6
```

Failure signatures:

| Symptom | Likely cause |
|---|---|
| `⚠ N unused block(s)` | Planner dropped solver content. Check the planner's grounding for those indices. |
| `⚠ N failed` (renderFailures > 0) | A per-spec generator threw or returned null. Check the per-generator console log. |
| `⚠ planner fallback` | The planner LLM call errored or produced zero specs. Look for a `[Planner] Failed` log line; the render uses `buildFallbackPlan`. |
| `INJECTED` step that duplicates a block | Planner over-injecting. Tighten the primitive's `whenToUse` to make injection less attractive. |
| `MERGED` count > 1 | Probably wrong — see the planner prompt's "consolidating more than once, you're probably wrong" rule. |

The debug card visibly shows planner specs alongside the raw solver blocks so you can spot grounding mismatches without re-running.
