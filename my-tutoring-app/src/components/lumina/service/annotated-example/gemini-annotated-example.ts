/**
 * Annotated Example Generator — pinned-problem hydration pipeline.
 *
 * Stage 1: SOLVER (solver.ts) — smart model with code execution solves the
 *          problem in free-form prose, separating strategic moves with `---`.
 * Stage 2: BLOCKS (blocks.ts) — deterministic split on `---`. No LLM. Each
 *          block is one strategic move.
 * Stage 3: PLAN + GENERATE — planner.ts sees the WHOLE solved problem and
 *          produces an ordered StepSpec[]. Per-spec generators run in
 *          parallel via the registry.
 * Stage 4: CHALLENGER — global gating decisions for prediction prompts.
 *
 * Problem authoring (statement + inset) lives in `orchestrator.ts` — this
 * pipeline expects every call to provide a `pinnedProblem` and (optionally)
 * a `pinnedInset`. The orchestrator runs once upstream; this pipeline then
 * hydrates the worked solution.
 */

import { solveProblem } from './solver';
import { splitSolverBlocks, type SolverBlock } from './blocks';
import { planSteps, buildFallbackPlan } from './planner';
import { assignChallenges } from './challenger';
import { generateStep } from './registry';
import { runAnnotatedExampleOrchestrator } from './orchestrator';
import type { StepGeneratorContext } from './generators/_shared';
import type {
  PlannerDebugPayload,
  RichAnnotatedExampleData,
  RichExampleStep,
  StepSpec,
} from '../../primitives/annotated-example/types';
import type { Inset } from '../../types';

// ═══════════════════════════════════════════════════════════════════════
// Stage 3: Spec → Typed Step
// ═══════════════════════════════════════════════════════════════════════

function joinGroundingProse(spec: StepSpec, blocks: SolverBlock[]): string {
  if (spec.groundingBlockIndices.length === 0) return '';
  return spec.groundingBlockIndices
    .map((idx) => {
      const block = blocks[idx];
      return block ? `[Block ${idx}]\n${block.prose}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
}

/**
 * User-facing variant of {@link joinGroundingProse}: same source data, but
 * stripped of the `[Block N]` debug prefixes so the prose reads as a natural
 * paragraph in the Narrative annotation layer.
 */
function joinNarrativeProse(spec: StepSpec, blocks: SolverBlock[]): string {
  if (spec.groundingBlockIndices.length === 0) return '';
  return spec.groundingBlockIndices
    .map((idx) => blocks[idx]?.prose ?? '')
    .filter(Boolean)
    .join('\n\n');
}

function specToContext(
  spec: StepSpec,
  blocks: SolverBlock[],
  priorSpecTitles: string[],
  topic: string,
  gradeContext: string,
  problemStatement: string,
  solutionStrategy: string,
): StepGeneratorContext {
  return {
    topic,
    gradeContext,
    problemStatement,
    solutionStrategy,
    priorStepSummaries: priorSpecTitles,
    pedagogicalGoal: spec.pedagogicalGoal,
    seedNotes: spec.seedNotes,
    groundingProse: joinGroundingProse(spec, blocks),
  };
}

async function generateAllSteps(
  specs: StepSpec[],
  blocks: SolverBlock[],
  topic: string,
  gradeContext: string,
  problemStatement: string,
  solutionStrategy: string,
): Promise<RichExampleStep[]> {
  console.log(`[AnnotatedExample] Generating ${specs.length} step(s) in parallel...`);
  const titles = specs.map((s) => s.title);

  const filled = await Promise.all(
    specs.map(async (spec, i) => {
      const ctx = specToContext(
        spec,
        blocks,
        titles.slice(0, i),
        topic,
        gradeContext,
        problemStatement,
        solutionStrategy,
      );
      const generated = await generateStep(spec.stepType, ctx);
      if (!generated) {
        console.warn(`[AnnotatedExample] Spec ${i} (${spec.stepType}) "${spec.title}" failed to generate`);
        return null;
      }
      const narrative = joinNarrativeProse(spec, blocks);
      return {
        id: i + 1,
        title: spec.title,
        content: generated.content,
        annotations: {
          ...generated.annotations,
          ...(narrative ? { narrative } : {}),
        },
      } as RichExampleStep;
    }),
  );

  return filled.filter((s): s is RichExampleStep => s != null);
}

// ═══════════════════════════════════════════════════════════════════════
// Pinned-problem pipeline — solver → planner → step generation → challenger.
// ═══════════════════════════════════════════════════════════════════════

export interface HydratePinnedProblemOptions {
  intent?: string;
  objectiveText?: string;
  objectiveVerb?: string;
  /** Pre-authored problem statement. The solver echoes this; never picks its own. */
  pinnedProblem: string;
  /** Pre-authored inset (when the problem has visual context). */
  pinnedInset?: Inset;
  /** Forwarded to the solver via `intent` so a "hard" slot doesn't get a trivial walkthrough. */
  difficulty?: 'easy' | 'medium' | 'hard';
}

async function hydratePinnedProblem(
  topic: string,
  gradeContext: string,
  options: HydratePinnedProblemOptions,
): Promise<RichAnnotatedExampleData> {
  console.log('[AnnotatedExample] Stage 1: solver (prose with code execution)...');
  // Difficulty rides on intent — solver doesn't have a dedicated field, but
  // the orchestrator already authored the problem at the right difficulty,
  // so the solver just needs a faithful walkthrough.
  const solverIntent = options.difficulty
    ? [options.intent, `Targeted difficulty: ${options.difficulty}.`].filter(Boolean).join(' ')
    : options.intent;
  const solved = await solveProblem(topic, gradeContext, {
    intent: solverIntent,
    objectiveText: options.objectiveText,
    objectiveVerb: options.objectiveVerb,
    pinnedProblem: options.pinnedProblem,
    pinnedInset: options.pinnedInset,
  });

  console.log('[AnnotatedExample] Stage 2: block split (deterministic)...');
  const blocks = splitSolverBlocks(solved.body);

  console.log('[AnnotatedExample] Stage 3a: planner (global step selection)...');
  const planner = await runPlanner(topic, solved.problemStatement, solved.strategy, blocks);

  console.log('[AnnotatedExample] Stage 3b: per-spec generation...');
  const steps = await generateAllSteps(
    planner.specs,
    blocks,
    topic,
    gradeContext,
    solved.problemStatement,
    solved.strategy,
  );

  console.log(`[AnnotatedExample] Step generation complete: ${steps.length}/${planner.specs.length} step(s) rendered from ${blocks.length} block(s)`);
  if (steps.length !== planner.specs.length) {
    console.warn(`[AnnotatedExample] ${planner.specs.length - steps.length} spec(s) failed to render — see per-generator logs`);
  }

  console.log('[AnnotatedExample] Stage 4: challenge layer (global gating decisions)...');
  const challenger = await assignChallenges({
    topic,
    gradeContext,
    problemStatement: solved.problemStatement,
    solutionStrategy: solved.strategy,
    steps,
  });
  if (challenger.failed) {
    console.warn('[AnnotatedExample] Challenger failed — example renders without prediction gates.');
  } else {
    console.log(
      `[AnnotatedExample] Challenges merged: ${challenger.assignments.length} attached, ${challenger.dropped.length} dropped`,
    );
  }

  const separatorCount = (solved.body.match(/^\s*---\s*$/gm) || []).length;

  return {
    title: solved.title,
    subject: solved.subject,
    problem: {
      statement: solved.problemStatement,
      ...(options.pinnedInset ? { inset: options.pinnedInset } : {}),
    },
    solutionStrategy: solved.strategy,
    steps,
    solverDebug: {
      body: solved.body,
      separatorCount,
      blocks: blocks.map((b) => ({ index: b.index, prose: b.prose })),
      planner,
      challenger,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Production entry — orchestrator authors a single problem; the pipeline
// hydrates its worked solution.
// ═══════════════════════════════════════════════════════════════════════

export interface GenerateAnnotatedExampleInput {
  topic: string;
  gradeContext: string;
  /** Optional steering text forwarded to the orchestrator. */
  intent?: string;
}

export async function generateAnnotatedExample(
  input: GenerateAnnotatedExampleInput,
): Promise<RichAnnotatedExampleData> {
  const { topic, gradeContext, intent } = input;

  const plan = await runAnnotatedExampleOrchestrator({
    topic,
    gradeLevel: gradeContext,
    context: intent,
  });

  console.log('[AnnotatedExample] Hydrating problem:', {
    difficulty: plan.difficulty,
    insetType: plan.insetType ?? 'none',
  });

  return hydratePinnedProblem(topic, gradeContext, {
    pinnedProblem: plan.problemStatement,
    pinnedInset: plan.inset,
    difficulty: plan.difficulty,
  });
}

/**
 * Run the planner. On any failure, fall back to a 1:1 algebra plan so the
 * render path always has something to work with. The fallback is flagged in
 * the debug payload so the failure is visible.
 */
async function runPlanner(
  topic: string,
  problemStatement: string,
  solutionStrategy: string,
  blocks: SolverBlock[],
): Promise<PlannerDebugPayload> {
  try {
    return await planSteps({ topic, problemStatement, solutionStrategy, blocks });
  } catch (error) {
    console.warn('[Planner] Failed — falling back to 1:1 algebra plan:', error);
    return buildFallbackPlan(blocks);
  }
}
