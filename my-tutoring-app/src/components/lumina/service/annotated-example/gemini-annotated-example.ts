/**
 * Annotated Example Generator — three-stage pipeline.
 *
 * Stage 1: SOLVER (solver.ts) — smart model with code execution solves the
 *          problem in free-form prose, separating strategic moves with `---`.
 * Stage 2: BLOCKS (blocks.ts) — deterministic split on `---`. No LLM. Each
 *          block is one strategic move.
 * Stage 3: PLAN + GENERATE — planner.ts sees the WHOLE solved problem and
 *          produces an ordered StepSpec[]. Each spec maps 1:1 with a block,
 *          consolidates two blocks, or is injected (e.g. a graph for an
 *          area-between-curves problem). Per-spec generators run in parallel
 *          via the registry.
 *
 * To add a new primitive: register it in registry.ts. No changes here.
 */

import { solveProblem } from './solver';
import { splitSolverBlocks, type SolverBlock } from './blocks';
import { planSteps, buildFallbackPlan } from './planner';
import { assignChallenges } from './challenger';
import { generateStep } from './registry';
import type { StepGeneratorContext } from './generators/_shared';
import type {
  PlannerDebugPayload,
  RichAnnotatedExampleData,
  RichExampleStep,
  StepSpec,
} from '../../primitives/annotated-example/types';

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
// Main Export
// ═══════════════════════════════════════════════════════════════════════

export interface GenerateExampleOptions {
  intent?: string;
  objectiveText?: string;
  objectiveVerb?: string;
  /**
   * When set, the solver echoes this problem statement instead of picking
   * its own. Used by the sibling-problem pipeline so the pre-authored
   * isomorphic problem flows through the same scaffolding (planner →
   * per-step generators) as the original worked example.
   */
  pinnedProblem?: string;
  /**
   * When true, skip the challenger stage 4 pass — no prediction gates are
   * attached. Used for sibling problems where the student is doing the
   * solve themselves on the canvas; gates layered on top of that would be
   * redundant.
   */
  skipChallenger?: boolean;
}

export async function generateAnnotatedExample(
  topic: string,
  gradeContext: string,
  config?: GenerateExampleOptions,
): Promise<RichAnnotatedExampleData> {
  console.log('[AnnotatedExample] Stage 1: solver (prose with code execution)...');
  const solved = await solveProblem(topic, gradeContext, config);

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

  // Stage 4: challenge layer. Skipped when the caller is generating a
  // sibling problem — the student does the solve themselves on the canvas
  // in Try mode, so layered prediction gates are redundant.
  let challenger;
  if (config?.skipChallenger) {
    console.log('[AnnotatedExample] Stage 4: challenger SKIPPED (sibling problem).');
    challenger = { assignments: [], dropped: [], failed: false };
  } else {
    console.log('[AnnotatedExample] Stage 4: challenge layer (global gating decisions)...');
    challenger = await assignChallenges({
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
  }

  const separatorCount = (solved.body.match(/^\s*---\s*$/gm) || []).length;

  return {
    title: solved.title,
    subject: solved.subject,
    problem: { statement: solved.problemStatement },
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
