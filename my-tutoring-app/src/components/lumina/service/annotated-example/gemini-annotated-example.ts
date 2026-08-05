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

import { solveProblem, type SolvedProblem } from './solver';
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
import {
  buildAnnotatedExampleAuthoringContract,
  buildPinnedSolverGuidance,
  deriveDeterministicRepeatedAdditionModel,
  validateTextAgainstAuthoringContract,
  type AnnotatedExampleAuthoringContract,
} from './authoring-contract';

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
  authoringGuidance?: string,
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
    authoringGuidance,
  };
}

async function generateAllSteps(
  specs: StepSpec[],
  blocks: SolverBlock[],
  topic: string,
  gradeContext: string,
  problemStatement: string,
  solutionStrategy: string,
  authoringGuidance?: string,
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
        authoringGuidance,
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
  /** Structured contract accepted at the problem-authoring boundary. */
  authoringContract?: AnnotatedExampleAuthoringContract;
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
  const solverConfig = {
    intent: solverIntent,
    objectiveText: options.objectiveText,
    objectiveVerb: options.objectiveVerb,
    pinnedProblem: options.pinnedProblem,
    pinnedInset: options.pinnedInset,
  };
  let solved = await solveProblem(topic, gradeContext, solverConfig);

  if (options.authoringContract) {
    const firstViolations = validateTextAgainstAuthoringContract(
      solved.body,
      options.authoringContract,
    );
    const echoMismatch = solved.problemStatement !== options.pinnedProblem;
    if (echoMismatch || firstViolations.length > 0) {
      const violationCodes = [
        ...(echoMismatch ? ['pinned-problem-echo'] : []),
        ...firstViolations.map((violation) => violation.code),
      ];
      console.warn('[AnnotatedExample] Retrying pinned solver after contract rejection', {
        binding: options.authoringContract.binding,
        canonicalGrade: options.authoringContract.canonicalGrade ?? 'unspecified',
        attempt: 1,
        violationCodes: Array.from(new Set(violationCodes)),
      });
      solved = await solveProblem(topic, gradeContext, {
        ...solverConfig,
        intent: `${solverIntent ?? ''} REPAIR REQUIRED: the prior solution violated these binding contract checks: ${Array.from(new Set(violationCodes)).join(', ')}. Solve the exact same pinned problem again and remove every violation; do not mention or demonstrate a forbidden method even as a verification.`.trim(),
      });
    }

    const remainingViolations = validateTextAgainstAuthoringContract(
      solved.body,
      options.authoringContract,
    );
    if (
      solved.problemStatement !== options.pinnedProblem ||
      remainingViolations.length > 0
    ) {
      const deterministic = deriveDeterministicRepeatedAdditionModel(options.authoringContract);
      if (deterministic) {
        solved = buildDeterministicPinnedSolution(
          topic,
          options.pinnedProblem,
          options.authoringContract,
          deterministic,
        );
        console.warn('[AnnotatedExample] Using deterministic pinned-solver fallback', {
          binding: options.authoringContract.binding,
          canonicalGrade: options.authoringContract.canonicalGrade ?? 'unspecified',
          violationCodes: Array.from(
            new Set(remainingViolations.map((violation) => violation.code)),
          ),
        });
      }
    }
  }

  if (solved.problemStatement !== options.pinnedProblem) {
    console.error('[AnnotatedExample] Solver violated pinned-problem echo', {
      expectedLength: options.pinnedProblem.length,
      actualLength: solved.problemStatement.length,
    });
    throw new Error('[AnnotatedExample] Solver PROBLEM echo was not byte-faithful to pinnedProblem');
  }

  if (options.authoringContract) {
    assertHydrationContract('solver', solved.body, options.authoringContract);
  }

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
    options.authoringContract
      ? buildPinnedSolverGuidance(options.authoringContract)
      : undefined,
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
    authoringGuidance: options.authoringContract
      ? buildPinnedSolverGuidance(options.authoringContract)
      : undefined,
  });
  if (challenger.failed) {
    console.warn('[AnnotatedExample] Challenger failed — example renders without prediction gates.');
  } else {
    console.log(
      `[AnnotatedExample] Challenges merged: ${challenger.assignments.length} attached, ${challenger.dropped.length} dropped`,
    );
  }

  if (options.authoringContract) {
    let finalText = serializeStudentVisibleSteps(solved.body, steps);
    let finalViolations = validateTextAgainstAuthoringContract(
      finalText,
      options.authoringContract,
    );
    if (finalViolations.length > 0 && hasAnyChallenge(steps)) {
      clearChallenges(steps);
      challenger.assignments = [];
      challenger.failed = true;
      console.warn('[AnnotatedExample] Dropped challenge layer after contract rejection', {
        binding: options.authoringContract.binding,
        canonicalGrade: options.authoringContract.canonicalGrade ?? 'unspecified',
        violationCodes: Array.from(new Set(finalViolations.map((violation) => violation.code))),
      });
      finalText = serializeStudentVisibleSteps(solved.body, steps);
      finalViolations = validateTextAgainstAuthoringContract(finalText, options.authoringContract);
    }
    if (finalViolations.length > 0) {
      const deterministic = deriveDeterministicRepeatedAdditionModel(options.authoringContract);
      if (deterministic) {
        steps.splice(
          0,
          steps.length,
          buildDeterministicRepeatedAdditionStep(options.authoringContract, deterministic),
        );
        challenger.assignments = [];
        challenger.failed = true;
        console.warn('[AnnotatedExample] Using deterministic step-chain fallback', {
          binding: options.authoringContract.binding,
          canonicalGrade: options.authoringContract.canonicalGrade ?? 'unspecified',
          violationCodes: Array.from(new Set(finalViolations.map((violation) => violation.code))),
        });
        finalText = serializeStudentVisibleSteps(solved.body, steps);
        finalViolations = validateTextAgainstAuthoringContract(finalText, options.authoringContract);
      }
    }
    assertHydrationViolations('serialized-step-chain', finalViolations, options.authoringContract);
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
      problemEcho: solved.problemStatement,
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
  /** Optional manifest steering promoted into a structured authoring contract. */
  intent?: string;
  /** Canonical curriculum grade from `ctx.grade`; never inferred from grade prose. */
  canonicalGrade?: string;
}

export async function generateAnnotatedExample(
  input: GenerateAnnotatedExampleInput,
): Promise<RichAnnotatedExampleData> {
  const { topic, gradeContext, intent, canonicalGrade } = input;
  const authoringContract = buildAnnotatedExampleAuthoringContract({
    intent,
    canonicalGrade,
  });

  const plan = await runAnnotatedExampleOrchestrator({
    topic,
    gradeLevel: gradeContext,
    authoringContract,
  });

  console.log('[AnnotatedExample] Hydrating problem:', {
    difficulty: plan.difficulty,
    insetType: plan.insetType ?? 'none',
  });

  return hydratePinnedProblem(topic, gradeContext, {
    pinnedProblem: plan.problemStatement,
    pinnedInset: plan.inset,
    difficulty: plan.difficulty,
    intent: buildPinnedSolverGuidance(authoringContract),
    authoringContract,
  });
}

function assertHydrationContract(
  stage: 'solver' | 'serialized-step-chain',
  text: string,
  contract: AnnotatedExampleAuthoringContract,
): void {
  const violations = validateTextAgainstAuthoringContract(text, contract);
  assertHydrationViolations(stage, violations, contract);
}

function assertHydrationViolations(
  stage: 'solver' | 'serialized-step-chain',
  violations: ReturnType<typeof validateTextAgainstAuthoringContract>,
  contract: AnnotatedExampleAuthoringContract,
): void {
  if (violations.length === 0) return;
  console.error('[AnnotatedExample] Hydration contract rejected output', {
    stage,
    binding: contract.binding,
    canonicalGrade: contract.canonicalGrade ?? 'unspecified',
    violationCodes: Array.from(new Set(violations.map((violation) => violation.code))),
  });
  throw new Error(
    `[AnnotatedExample] ${stage} violated accepted authoring contract: ${Array.from(
      new Set(violations.map((violation) => violation.code)),
    ).join(', ')}`,
  );
}

function serializeStudentVisibleSteps(body: string, steps: RichExampleStep[]): string {
  return `${body}\n${JSON.stringify(
    steps.map((step) => ({
      content: step.content,
      narrative: step.annotations.narrative,
      challenge: step.challenge,
    })),
  )}`;
}

function hasAnyChallenge(steps: RichExampleStep[]): boolean {
  return steps.some(
    (step) =>
      Boolean(step.challenge) ||
      (step.content.type === 'algebra' &&
        step.content.transitions.some((transition) => Boolean(transition.challenge))),
  );
}

function clearChallenges(steps: RichExampleStep[]): void {
  for (const step of steps) {
    delete step.challenge;
    if (step.content.type === 'algebra') {
      step.content.transitions = step.content.transitions.map((transition) => {
        const { challenge: _challenge, ...rest } = transition;
        return rest;
      });
    }
  }
}

function buildDeterministicPinnedSolution(
  topic: string,
  pinnedProblem: string,
  contract: AnnotatedExampleAuthoringContract,
  model: NonNullable<ReturnType<typeof deriveDeterministicRepeatedAdditionModel>>,
): SolvedProblem {
  const entityLabel = `${model.entity}${model.count === 1 ? '' : 's'}`;
  const sequence = model.rows.map((row) => row[1]).join(', ');
  const body = `The pinned worked example specifies ${model.count} ${entityLabel}, ${model.increment} ${model.unit} for each one, and a target of ${model.target} ${model.unit}. Use the requested skip-counting method and keep the exact scenario: ${contract.intent ?? pinnedProblem}
---
Skip-count by ${model.increment} ${model.unit} once for each ${model.entity}: ${sequence}. This is repeated addition using the same increment each time.
---
The ${model.count}th count in the sequence is ${model.target}. Therefore the final total is ${model.target} ${model.unit}.`;
  const strategy = `Use skip-counting by ${model.increment} ${model.unit} for each of the ${model.count} ${entityLabel}, stopping at the pinned target of ${model.target} ${model.unit}.`;
  const title = `Skip-Counting ${entityLabel}`;
  const rawText = `TITLE: ${title}\nSUBJECT: Mathematics\nPROBLEM: ${pinnedProblem}\n\nSTRATEGY: ${strategy}\n\n${body}`;
  return {
    title,
    subject: 'Mathematics',
    problemStatement: pinnedProblem,
    strategy,
    body,
    rawText,
  };
}

function buildDeterministicRepeatedAdditionStep(
  contract: AnnotatedExampleAuthoringContract,
  model: NonNullable<ReturnType<typeof deriveDeterministicRepeatedAdditionModel>>,
): RichExampleStep {
  const entityLabel = `${model.entity}${model.count === 1 ? '' : 's'}`;
  return {
    id: 1,
    title: 'Skip-count to the exact target',
    content: {
      type: 'table',
      caption: `Skip-count ${model.count} ${entityLabel} by ${model.increment} ${model.unit}`,
      headers: [`${model.entity} count`, `Running total (${model.unit})`],
      rows: model.rows,
      highlightCell: [model.rows.length - 1, 1],
    },
    annotations: {
      steps: `Count each ${model.entity} once and add ${model.increment} ${model.unit} to the running total.`,
      strategy: `I use the same increment for every ${model.entity} and stop after ${model.count} counts.`,
      misconceptions: `Keep the item count separate from the running total in ${model.unit}.`,
      connections: 'This is repeated addition represented as a running-total table.',
      narrative: `${contract.intent ?? ''} The final row reaches ${model.target} ${model.unit}.`,
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
