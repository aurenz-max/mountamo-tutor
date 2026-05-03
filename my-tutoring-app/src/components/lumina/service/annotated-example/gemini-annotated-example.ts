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
import { authorAnnotatedProblem } from './problem-author';
import type { AuthorableInsetType } from './inset-helpers';
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
   * Pre-authored inset to attach to `problem.inset` and inject into the
   * solver / planner / judge prompts as visual context. Sibling callers
   * pass this through after the shared author returns it; fresh callers
   * set it via `insetType` instead and let the pipeline author it upstream.
   */
  pinnedInset?: Inset;
  /**
   * Request a fresh problem with a matching inset of this type. Triggers
   * an upstream call to `authorAnnotatedProblem` BEFORE the solver runs;
   * the resulting statement + inset are pinned through to the solver.
   * Mutually exclusive with `pinnedProblem` (which already implies the
   * problem was authored upstream).
   */
  insetType?: AuthorableInsetType;
  /**
   * Orchestrator brief (fresh mode only). Forwarded to the upstream author
   * as the primary spec for this slot — overrides the default "pick any
   * representative problem" behavior. Ignored when `pinnedProblem` is set.
   */
  brief?: string;
  /**
   * Targeted difficulty band (fresh mode only). Forwarded to the author
   * AND surfaced to the solver via `intent` so a "hard" slot doesn't get a
   * trivial walkthrough.
   */
  difficulty?: 'easy' | 'medium' | 'hard';
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
  // Stage 0 (optional): when no upstream author already supplied a pinned
  // problem AND the caller passed an orchestrator brief OR an insetType,
  // run the shared annotated author to produce {statement, inset?}.
  // Sibling callers author upstream and pass `pinnedProblem` +
  // `pinnedInset`, so they skip this hop. A bare `generateAnnotatedExample`
  // call with no brief / no insetType keeps the legacy "solver picks the
  // problem" behavior.
  let pinnedProblem = config?.pinnedProblem;
  let pinnedInset = config?.pinnedInset;
  const shouldAuthorUpstream = !pinnedProblem && (config?.brief || config?.insetType);
  if (shouldAuthorUpstream) {
    console.log('[AnnotatedExample] Stage 0: authoring problem upstream...', {
      insetType: config?.insetType ?? null,
      hasBrief: Boolean(config?.brief),
      difficulty: config?.difficulty ?? null,
    });
    const authored = await authorAnnotatedProblem({
      mode: 'fresh',
      topic,
      gradeContext,
      insetType: config?.insetType,
      brief: config?.brief,
      difficulty: config?.difficulty,
    });
    pinnedProblem = authored.problemStatement;
    pinnedInset = authored.inset;
    console.log(`[AnnotatedExample] Stage 0 authored: "${authored.problemStatement}"`);
  }

  console.log('[AnnotatedExample] Stage 1: solver (prose with code execution)...');
  const solved = await solveProblem(topic, gradeContext, {
    ...config,
    pinnedProblem,
    pinnedInset,
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
    problem: {
      statement: solved.problemStatement,
      ...(pinnedInset ? { inset: pinnedInset } : {}),
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
// Plan-driven entry — produces ONE example from an orchestrator slot.
//
// Mirrors the knowledge-check `generateFromPlan` shape but returns the full
// `RichAnnotatedExampleData` (KC returns a flat ProblemData). Callers
// iterate the plan one slot at a time as the student progresses; the
// per-example surface is too big to batch in parallel.
// ═══════════════════════════════════════════════════════════════════════

import type { AnnotatedExampleProblemPlan } from '../../primitives/annotated-example/types';

export async function generateAnnotatedExampleFromPlan(
  plan: AnnotatedExampleProblemPlan,
  topic: string,
  gradeContext: string,
): Promise<RichAnnotatedExampleData> {
  console.log('[AnnotatedExample] Generating from plan slot:', {
    index: plan.index,
    difficulty: plan.difficulty,
    insetType: plan.insetType ?? 'none',
  });

  // Stage 1: hydrate the watched worked example.
  const watch = await generateAnnotatedExample(topic, gradeContext, {
    brief: plan.brief,
    difficulty: plan.difficulty,
    insetType: plan.insetType ?? undefined,
  });

  // Stage 2: hydrate the isomorphic Try problem off the watched example.
  // Multi-phase primitives load all phases upfront — the primitive never
  // authors mid-flight. Sibling failure degrades to "Try unavailable"
  // rather than blocking the Watch render the student already paid for.
  // Dynamic import to avoid the gemini-annotated-example ↔ sibling cycle.
  console.log('[AnnotatedExample] Bundling tryProblem (sibling of watch)...');
  let tryProblem: RichAnnotatedExampleData | undefined;
  try {
    const { generateSiblingExample } = await import('./sibling');
    const sibling = await generateSiblingExample({
      originalProblem: watch.problem.statement,
      originalStrategy: watch.solutionStrategy,
      subject: watch.subject,
      gradeContext,
      originalInset: watch.problem.inset,
    });
    tryProblem = sibling.data;
    console.log('[AnnotatedExample] tryProblem bundled.');
  } catch (error) {
    console.warn(
      '[AnnotatedExample] tryProblem hydration failed; Watch will render without Try:',
      error,
    );
  }

  return { ...watch, tryProblem };
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
