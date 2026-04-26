/**
 * Planner — global step selection for the annotated-example pipeline.
 *
 * Single LLM call that sees the WHOLE solved problem (problem statement,
 * strategy, every solver block) plus the primitive catalog. Produces an
 * ordered list of `StepSpec`s that may:
 *   - map 1:1 with a solver block (the common case),
 *   - consolidate two consecutive blocks that share strategic purpose, or
 *   - inject a brand-new step that no block grounds (e.g. a graph-sketch at
 *     the start of an area-between-curves problem).
 *
 * Catalog (whenToUse strings) is read from registry.ts. Adding a new primitive
 * does NOT require editing this file's prompts.
 *
 * On any failure the orchestrator falls back to `buildFallbackPlan(blocks)` —
 * a 1:1 algebra plan that always works.
 */

import { Type, Schema, ThinkingLevel } from '@google/genai';
import { ai } from '../geminiClient';
import type { SolverBlock } from './blocks';
import type { StepType, StepSpec, PlannerDebugPayload } from '../../primitives/annotated-example/types';
import { REGISTERED_STEP_TYPES, formatCatalogForPrompt } from './registry';

// ── Schema ───────────────────────────────────────────────────────────
//
// Nested array of step objects. Each item is fully required so the model
// can't ship a step with empty title/goal/seed. groundingBlockIndices is a
// real INTEGER[] — no CSV parsing, no "empty string means injected" footgun.
// gemini-3-flash-preview handles nested object schemas reliably; the prior
// flat-fielded design was a flash-lite workaround we no longer need.

const PLANNER_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    steps: {
      type: Type.ARRAY,
      description: 'Ordered list of steps to render. Typically the same count as solver blocks; use 1 fewer when consolidating two redundant blocks; use 1 more only when injecting a step the solver did not write.',
      items: {
        type: Type.OBJECT,
        properties: {
          stepType: {
            type: Type.STRING,
            enum: REGISTERED_STEP_TYPES as unknown as string[],
            description: 'The primitive that best renders this step.',
          },
          title: {
            type: Type.STRING,
            description: 'Short imperative title (3-6 words), e.g. "Find points of intersection".',
          },
          pedagogicalGoal: {
            type: Type.STRING,
            description: 'One sentence — what this step TEACHES the student, not what it computes.',
          },
          groundingBlockIndices: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
            description: 'Solver block indices this step is built from. Almost always non-empty: [i] for a 1:1 mapping, [i, j] when consolidating two blocks. Empty array ONLY for a step you are injecting that no solver block describes.',
          },
          seedNotes: {
            type: Type.STRING,
            description: 'One sentence telling the per-type generator what to extract from the grounding prose (specific KaTeX, numbers, features). For injected steps, describe what to construct from scratch.',
          },
        },
        required: ['stepType', 'title', 'pedagogicalGoal', 'groundingBlockIndices', 'seedNotes'],
      },
    },
  },
  required: ['steps'],
};

// ── Prompt ───────────────────────────────────────────────────────────

interface PlannerInput {
  topic: string;
  problemStatement: string;
  solutionStrategy: string;
  blocks: SolverBlock[];
}

function buildPlannerPrompt(ctx: PlannerInput): string {
  const blockList = ctx.blocks
    .map((b) => `### Block ${b.index}\n${b.prose}`)
    .join('\n\n');

  return `You are planning how to render a worked mathematical solution as an ordered series of interactive primitives. You see the WHOLE solved problem and decide which primitives, in which order, best teach it.

## The problem
"${ctx.problemStatement}"
Topic: ${ctx.topic}

## Strategy
${ctx.solutionStrategy}

## Solver blocks (${ctx.blocks.length} total — these are the strategic moves the solver wrote)

${blockList}

## Available primitives

${formatCatalogForPrompt()}

## Your job — produce an ORDERED list of steps

**The default is 1:1 with the solver's blocks.** The solver thought hard about its strategic moves; trust them. For most problems your output should have exactly ${ctx.blocks.length} steps, where step \`i\` has \`groundingBlockIndices: [i]\`.

Only deviate from 1:1 in these specific situations:

### Consolidate (rare) — two consecutive blocks → one step
Use when two adjacent blocks do the SAME strategic work. Example: solver wrote "find the antiderivative" as block N and "evaluate at the limits" as block N+1. Both are "evaluate the definite integral" — set \`groundingBlockIndices: [N, N+1]\`. Producing fewer steps than blocks should be the EXCEPTION; if you're consolidating more than once, you're probably wrong.

### Inject (very rare) — add a step with no grounding block
Use ONLY when a primitive teaches something the solver's prose fundamentally cannot. The canonical case: an area-between-curves or geometry problem benefits from a graph-sketch up front showing the curves, even if the solver never wrote "graph it." Set \`groundingBlockIndices: []\`.

**Strict limits on injection:**
- At most ONE injected step per plan.
- Never inject a step whose content overlaps a solver block — if the solver covered the move, ground in that block instead.
- An injected \`algebra\` step is almost always wrong. Algebra is for symbolic work; the solver already wrote it.
- An injected \`table\` for two test points is wrong — that's prose, not a table.

## Rules

- **Cover every block.** Every solver block must appear in some step's \`groundingBlockIndices\` (unless consolidated with an adjacent block). Dropping a block silently is a failure.
- **Pick the primitive type per step from what THAT step does**, not what the whole problem does. A step computing $x(x-2)=0$ is \`algebra\`, not \`graph-sketch\`, even if the problem benefits from a graph elsewhere.
- **Default to \`algebra\`** for symbolic work. Use specific primitives only when they're a clear pedagogical win for that step.
- **pedagogicalGoal teaches, doesn't compute.** "Show why the curves bound a region by finding intersection points" — not "solve x^2 = 2x".
- **seedNotes is concrete.** Name the actual KaTeX expressions, numbers, or features the generator should pull from the grounding prose. For injected steps, describe what to construct.

## Sanity check before you respond

Count: do your steps cover every block index from 0 to ${ctx.blocks.length - 1}? If not, fix it. Is your injected count ≤ 1? If not, fix it.`;
}

// ── Parse ────────────────────────────────────────────────────────────

interface RawStep {
  stepType?: string;
  title?: string;
  pedagogicalGoal?: string;
  groundingBlockIndices?: unknown;
  seedNotes?: string;
}

function parseGroundingArray(raw: unknown, totalBlocks: number): number[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => (typeof v === 'number' ? v : parseInt(String(v), 10)))
    .filter((n) => Number.isInteger(n) && n >= 0 && n < totalBlocks);
}

function parseSpecs(data: Record<string, unknown>, totalBlocks: number): StepSpec[] {
  const rawSteps = Array.isArray(data.steps) ? (data.steps as RawStep[]) : [];
  const specs: StepSpec[] = [];

  for (let i = 0; i < rawSteps.length; i++) {
    const raw = rawSteps[i];
    const stepType = raw.stepType;
    const title = raw.title;

    if (!stepType || !title) continue;
    if (!(REGISTERED_STEP_TYPES as string[]).includes(stepType)) {
      console.warn(`[Planner] step ${i} has unknown type "${stepType}", skipping`);
      continue;
    }

    specs.push({
      stepType: stepType as StepType,
      title: title.trim(),
      pedagogicalGoal: (raw.pedagogicalGoal || '').trim(),
      groundingBlockIndices: parseGroundingArray(raw.groundingBlockIndices, totalBlocks),
      seedNotes: (raw.seedNotes || '').trim(),
    });
  }
  return specs;
}

function summarize(specs: StepSpec[], totalBlocks: number, fallback: boolean): PlannerDebugPayload {
  const covered = new Set<number>();
  let injectedCount = 0;
  let mergedCount = 0;
  for (const s of specs) {
    if (s.groundingBlockIndices.length === 0) injectedCount++;
    else if (s.groundingBlockIndices.length > 1) mergedCount++;
    for (const idx of s.groundingBlockIndices) covered.add(idx);
  }
  const unusedBlockIndices: number[] = [];
  for (let i = 0; i < totalBlocks; i++) {
    if (!covered.has(i)) unusedBlockIndices.push(i);
  }
  return { specs, unusedBlockIndices, injectedCount, mergedCount, fallback };
}

/**
 * Build a 1:1 fallback plan when the planner errors out: one algebra step per
 * solver block, no merging, no injection. Ensures the render path always has
 * something to work with even if the planner errors out.
 */
export function buildFallbackPlan(blocks: SolverBlock[]): PlannerDebugPayload {
  const specs: StepSpec[] = blocks.map((b) => ({
    stepType: 'algebra' as StepType,
    title: `Step ${b.index + 1}`,
    pedagogicalGoal: 'Render this strategic move from the solver prose.',
    groundingBlockIndices: [b.index],
    seedNotes: 'Extract the algebraic transitions from the grounding prose verbatim.',
  }));
  return summarize(specs, blocks.length, true);
}

// ── Public entry ─────────────────────────────────────────────────────

/**
 * Plan the rendering of a solved problem. Returns the planner's proposed
 * StepSpec[] plus coverage telemetry. Throws on hard failures; the orchestrator
 * catches and falls back to `buildFallbackPlan(blocks)`.
 */
export async function planSteps(input: PlannerInput): Promise<PlannerDebugPayload> {
  console.log(`[Planner] Planning ${input.blocks.length} block(s) globally with thinking model...`);

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: buildPlannerPrompt(input),
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      responseMimeType: 'application/json',
      responseSchema: PLANNER_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error('Planner returned no text');

  const data = JSON.parse(text) as Record<string, unknown>;
  const specs = parseSpecs(data, input.blocks.length);
  if (specs.length === 0) throw new Error('Planner produced zero specs');

  const summary = summarize(specs, input.blocks.length, false);

  console.log(
    `[Planner] Plan: ${specs.length} step(s) from ${input.blocks.length} block(s) — ${summary.mergedCount} merged, ${summary.injectedCount} injected, ${summary.unusedBlockIndices.length} block(s) unused`,
  );
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i];
    const grounding = s.groundingBlockIndices.length === 0
      ? 'INJECTED'
      : `blocks=[${s.groundingBlockIndices.join(',')}]`;
    console.log(`[Planner]   step ${i} (${s.stepType}) "${s.title}" — ${grounding}`);
    console.log(`[Planner]     goal: ${s.pedagogicalGoal}`);
    console.log(`[Planner]     seed: ${s.seedNotes}`);
  }
  if (summary.unusedBlockIndices.length > 0) {
    console.warn(`[Planner] ⚠ Unused blocks: [${summary.unusedBlockIndices.join(',')}] — planner dropped solver content`);
  }

  return summary;
}
