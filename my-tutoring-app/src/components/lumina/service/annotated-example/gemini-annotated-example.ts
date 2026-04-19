/**
 * Orchestrated Annotated Example Generator
 *
 * Two-stage architecture with iterative plan validation:
 * 1. SOLUTION ARCHITECT (orchestrator) — plans the step manifest with typed steps
 *    and dependency graph. Uses gemini-3-flash-preview with thinking to ensure
 *    the plan reaches a complete solution.
 * 2. WAVE EXECUTOR — topologically sorts steps, runs each wave in parallel.
 *    Each step type has its own generator with a tight schema.
 *    Steps receive rich context (problem + strategy + prior step summaries).
 *
 * Supports: algebra, substitution, table, diagram, graph-sketch, case-split, verification.
 * All math content uses KaTeX strings with animated transition metadata.
 */

import { Type, Schema, ThinkingLevel } from '@google/genai';
import { ai } from '../geminiClient';
import type {
  SolutionPlan,
  StepPlan,
  RichAnnotatedExampleData,
  RichExampleStep,
  StepContent,
  AlgebraStepContent,
  SubstitutionStepContent,
  TableStepContent,
  DiagramStepContent,
  GraphSketchStepContent,
  CaseSplitStepContent,
  VerificationStepContent,
  StepAnnotations,
  StepType,
} from '../../primitives/annotated-example/types';

// ═══════════════════════════════════════════════════════════════════════
// Stage 1: Solution Architect — plans the step manifest
// ═══════════════════════════════════════════════════════════════════════

const VALID_STEP_TYPES: StepType[] = [
  'algebra', 'substitution', 'table', 'diagram', 'graph-sketch', 'case-split', 'verification',
];

const ORCHESTRATOR_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Descriptive title of the worked example' },
    subject: { type: Type.STRING, description: 'Subject area (e.g. Algebra, Calculus, Physics)' },
    solutionStrategy: {
      type: Type.STRING,
      description: '2-3 sentences: what approach we take and why. This is shown to the student before the steps.',
    },
    problemStatement: { type: Type.STRING, description: 'The problem prompt' },
    problemEquations: { type: Type.STRING, description: 'Semicolon-separated KaTeX equations given in the problem. Empty string if none.', nullable: true },
    problemContext: { type: Type.STRING, description: 'Additional context or given information', nullable: true },
    finalAnswer: { type: Type.STRING, description: 'The CONCRETE final answer this solution reaches (a number, simplified expression, or proven statement). This is used to validate the plan is complete.' },
    // Flat step array — up to 8 steps
    step0Type: { type: Type.STRING, description: 'Step type: algebra, substitution, table, diagram, graph-sketch, case-split, verification' },
    step0Title: { type: Type.STRING, description: 'Short title for this step' },
    step0Brief: { type: Type.STRING, description: 'Detailed brief: what math to show, what expressions to manipulate. Include actual KaTeX expressions.' },
    step0DependsOn: { type: Type.STRING, description: 'Comma-separated step indices this step depends on (e.g. "0,1"). Empty string if independent.' },
    step0AnnotationFocus: { type: Type.STRING, description: 'What annotations should emphasize for this step' },

    step1Type: { type: Type.STRING, description: 'Step type' },
    step1Title: { type: Type.STRING },
    step1Brief: { type: Type.STRING },
    step1DependsOn: { type: Type.STRING },
    step1AnnotationFocus: { type: Type.STRING },

    step2Type: { type: Type.STRING, description: 'Step type' },
    step2Title: { type: Type.STRING },
    step2Brief: { type: Type.STRING },
    step2DependsOn: { type: Type.STRING },
    step2AnnotationFocus: { type: Type.STRING },

    step3Type: { type: Type.STRING, description: 'Step type (REQUIRED — solutions need at least 5 steps)' },
    step3Title: { type: Type.STRING },
    step3Brief: { type: Type.STRING },
    step3DependsOn: { type: Type.STRING },
    step3AnnotationFocus: { type: Type.STRING },

    step4Type: { type: Type.STRING, description: 'Step type — this should usually be verification' },
    step4Title: { type: Type.STRING },
    step4Brief: { type: Type.STRING },
    step4DependsOn: { type: Type.STRING },
    step4AnnotationFocus: { type: Type.STRING },

    step5Type: { type: Type.STRING, nullable: true },
    step5Title: { type: Type.STRING, nullable: true },
    step5Brief: { type: Type.STRING, nullable: true },
    step5DependsOn: { type: Type.STRING, nullable: true },
    step5AnnotationFocus: { type: Type.STRING, nullable: true },

    step6Type: { type: Type.STRING, nullable: true },
    step6Title: { type: Type.STRING, nullable: true },
    step6Brief: { type: Type.STRING, nullable: true },
    step6DependsOn: { type: Type.STRING, nullable: true },
    step6AnnotationFocus: { type: Type.STRING, nullable: true },

    step7Type: { type: Type.STRING, nullable: true },
    step7Title: { type: Type.STRING, nullable: true },
    step7Brief: { type: Type.STRING, nullable: true },
    step7DependsOn: { type: Type.STRING, nullable: true },
    step7AnnotationFocus: { type: Type.STRING, nullable: true },
  },
  required: [
    'title', 'subject', 'solutionStrategy', 'problemStatement', 'finalAnswer',
    'step0Type', 'step0Title', 'step0Brief', 'step0DependsOn', 'step0AnnotationFocus',
    'step1Type', 'step1Title', 'step1Brief', 'step1DependsOn', 'step1AnnotationFocus',
    'step2Type', 'step2Title', 'step2Brief', 'step2DependsOn', 'step2AnnotationFocus',
    'step3Type', 'step3Title', 'step3Brief', 'step3DependsOn', 'step3AnnotationFocus',
    'step4Type', 'step4Title', 'step4Brief', 'step4DependsOn', 'step4AnnotationFocus',
  ],
};

function buildOrchestratorPrompt(
  topic: string,
  gradeContext: string,
  config?: { intent?: string; objectiveText?: string },
): string {
  const objectiveClause = config?.objectiveText
    ? `\n\nLEARNING OBJECTIVE: "${config.objectiveText}"\nThe worked example must directly support this objective.`
    : '';

  return `You are a Solution Architect for an interactive worked example on "${topic}" for ${gradeContext} students.
${objectiveClause}

Your job: plan HOW to solve a representative problem step-by-step, choosing the right step type for each part of the solution.

## Available Step Types

- **algebra**: Standard algebraic manipulation. Brief must include the starting KaTeX expression and the target transformation. Use for: simplification, equation solving, factoring, expanding, evaluating integrals, computing derivatives.
- **substitution**: Plugging values into an expression. Brief must list the template expression and each variable→value pair. Use for: evaluating formulas, plugging in known values, evaluating definite integrals at bounds.
- **table**: Structured computation laid out in rows/columns. Brief must describe headers and what to compute. Use for: sign charts, truth tables, value tables, comparison grids, amortization.
- **diagram**: A visual explanation with labeled parts. Brief must describe the scene and what labels to place. Use for: geometric proofs, free body diagrams, circuit analysis, Venn diagrams.
- **graph-sketch**: Plotting a function with key features. Brief must include the function, domain, and features to highlight. Use for: graphical analysis, optimization, curve sketching.
- **case-split**: Branching into cases by condition. Brief must list the cases and the condition. Use for: piecewise functions, absolute value, proof by cases, sign analysis.
- **verification**: Final answer check — substitute back into the original. ALWAYS include as the last step.

## Dependency Rules

Each step can depend on 0 or more prior steps. The executor runs independent steps in parallel and sequential steps in order.

- Steps that manipulate independent sub-expressions can be parallel (dependsOn = "")
- Steps that need a prior step's result must declare the dependency (dependsOn = "0" or "0,1")
- The verification step always depends on the step that produces the final answer
- IMPORTANT: A step can ONLY depend on steps with LOWER indices. No forward or circular dependencies.

## Planning Principles

1. **One logical move per step.** If you're tempted to write "and then", split it.
2. **Use the right step type.** Don't force everything into algebra — if there's a table, use table. If there's a diagram, use diagram.
3. **Include actual KaTeX in briefs.** The step generators need concrete expressions, not vague descriptions.
4. **5-8 steps total, including verification as the final step.** You MUST fill steps 0 through 4 at minimum.
5. **Make dependencies explicit.** If step 3 combines results from steps 1 and 2, say dependsOn="1,2".
6. **Annotation focus hints.** Tell each step generator what pedagogical angle to emphasize.

## CRITICAL: Complete the Entire Solution — CARRY THROUGH ALL COMPUTATION

The worked example MUST solve the problem all the way to a CONCRETE FINAL NUMERICAL OR SYMBOLIC ANSWER. Do NOT stop after setting up an equation, formulating an expression, or defining an integral. You must carry EVERY computation through to completion.

For example, if the problem asks to find an area between curves:
- Step 0: Find intersection points — SOLVE for actual x values (algebra)
- Step 1: Sketch the region to identify upper/lower curves (graph-sketch or diagram)
- Step 2: Set up the integral with the correct integrand (algebra)
- Step 3: Compute the antiderivative — actually perform the integration (algebra)
- Step 4: Evaluate at bounds — plug in the limits and simplify to a NUMBER (substitution or algebra)
- Step 5: State and simplify the final answer (algebra)
- Step 6: Verify the answer (verification)

If the problem asks to solve an equation:
- Each algebraic manipulation must be its own step
- The solution must end with a concrete value (x = 5, not "solve for x")
- Include verification as the final step

The "finalAnswer" field must contain the CONCRETE answer (e.g. "\\frac{4}{3}", "x = 5", "42"). If you cannot state a concrete final answer, your plan is incomplete.

The second-to-last step must produce this concrete final answer. The last step must be verification.

## Intent
${config?.intent || 'Demonstrate problem-solving process with rich interactive steps'}

Generate a complete solution plan with 5-8 steps now. The solution must reach a final answer.`;
}

function parseDependsOn(raw: string): number[] {
  if (!raw || raw.trim() === '') return [];
  return raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
}

/** Parse the orchestrator response into a SolutionPlan. */
function parseOrchestratorResponse(data: Record<string, unknown>): { plan: SolutionPlan; finalAnswer: string } {
  const steps: StepPlan[] = [];
  for (let i = 0; i < 8; i++) {
    const stepType = data[`step${i}Type`] as string | undefined;
    const title = data[`step${i}Title`] as string | undefined;
    const brief = data[`step${i}Brief`] as string | undefined;
    if (!stepType || !title || !brief) break;

    const validType = VALID_STEP_TYPES.includes(stepType as StepType)
      ? (stepType as StepType)
      : 'algebra';

    steps.push({
      stepIndex: i,
      stepType: validType,
      title,
      brief,
      dependsOn: parseDependsOn(data[`step${i}DependsOn`] as string || ''),
      annotationFocus: (data[`step${i}AnnotationFocus`] as string) || '',
    });
  }

  const eqRaw = data.problemEquations as string | undefined;
  const equations = eqRaw ? eqRaw.split(';').map((s: string) => s.trim()).filter(Boolean) : undefined;

  return {
    plan: {
      title: data.title as string,
      subject: data.subject as string,
      solutionStrategy: data.solutionStrategy as string,
      problem: {
        statement: data.problemStatement as string,
        equations,
        context: (data.problemContext as string) || undefined,
      },
      steps,
    },
    finalAnswer: (data.finalAnswer as string) || '',
  };
}

/**
 * Force-fix structural issues in the plan that the LLM consistently gets wrong.
 * Rather than re-prompting (which burns tokens and often fails), we patch
 * the plan programmatically.
 */
function repairPlan(plan: SolutionPlan, finalAnswer: string): SolutionPlan {
  const steps = [...plan.steps];

  // Fix: ensure last step is verification. If not, append one (or replace last if at 8 steps).
  const lastStep = steps[steps.length - 1];
  if (lastStep.stepType !== 'verification') {
    const verificationStep: StepPlan = {
      stepIndex: steps.length,
      stepType: 'verification',
      title: 'Verify the answer',
      brief: `Substitute the final answer ${finalAnswer || '(from the previous step)'} back into the original problem and confirm it is correct.`,
      dependsOn: [steps.length - 1],
      annotationFocus: 'Why verification matters and how to check your work',
    };

    if (steps.length >= 8) {
      // At max steps — replace last with verification if it's not critical
      console.warn('[AnnotatedExample] Plan repair: replacing step 7 with verification (at 8-step limit)');
      verificationStep.stepIndex = 7;
      verificationStep.dependsOn = [6];
      steps[7] = verificationStep;
    } else {
      console.log(`[AnnotatedExample] Plan repair: appending verification step at index ${steps.length}`);
      steps.push(verificationStep);
    }
  }

  // Fix: re-index steps to ensure stepIndex matches array position
  for (let i = 0; i < steps.length; i++) {
    steps[i] = { ...steps[i], stepIndex: i };
    // Clamp dependencies to valid range
    steps[i].dependsOn = steps[i].dependsOn.filter((d) => d < i);
  }

  return { ...plan, steps };
}

/**
 * Log warnings about plan quality (non-blocking — we proceed regardless).
 */
function auditPlan(plan: SolutionPlan, finalAnswer: string): void {
  if (plan.steps.length < 5) {
    console.warn(`[AnnotatedExample] Plan audit: only ${plan.steps.length} steps (want 5+)`);
  }

  if (!finalAnswer || finalAnswer.trim().length < 2) {
    console.warn('[AnnotatedExample] Plan audit: no concrete final answer declared');
  }

  const penultimate = plan.steps[plan.steps.length - 2];
  if (penultimate) {
    const setupOnly = /\b(set up|formulate|define|identify|establish|write)\b/i;
    const computeAny = /\b(evaluate|compute|calculate|simplify|solve|find|result|answer|substitute|plug in)\b/i;
    if (setupOnly.test(penultimate.brief) && !computeAny.test(penultimate.brief)) {
      console.warn(`[AnnotatedExample] Plan audit: second-to-last step "${penultimate.title}" may only set up without computing`);
    }
  }
}

async function runOrchestrator(
  topic: string,
  gradeContext: string,
  config?: { intent?: string; objectiveText?: string },
): Promise<SolutionPlan> {
  const prompt = buildOrchestratorPrompt(topic, gradeContext, config);

  console.log('[AnnotatedExample] Orchestrator: single call with thinking...');

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.HIGH,
      },
      responseMimeType: 'application/json',
      responseSchema: ORCHESTRATOR_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error('Solution Architect returned empty response');

  const data = JSON.parse(text);
  const { plan, finalAnswer } = parseOrchestratorResponse(data);

  console.log(`[AnnotatedExample] Raw plan: ${plan.steps.length} steps, types: ${plan.steps.map((s) => s.stepType).join(', ')}`);

  // Audit for informational warnings
  auditPlan(plan, finalAnswer);

  // Programmatically fix structural issues
  const repairedPlan = repairPlan(plan, finalAnswer);

  console.log(`[AnnotatedExample] Final plan: ${repairedPlan.steps.length} steps, types: ${repairedPlan.steps.map((s) => s.stepType).join(', ')}`);

  return repairedPlan;
}

// ═══════════════════════════════════════════════════════════════════════
// Stage 2: Step Generators — each type has its own schema + prompt
// ═══════════════════════════════════════════════════════════════════════

// ── Rich context builder for step generators ─────────────────────────

interface StepGeneratorContext {
  brief: string;
  inputExpressions: string[];
  topic: string;
  gradeContext: string;
  annotationFocus: string;
  /** Full problem statement for context */
  problemStatement: string;
  /** Solution strategy for context */
  solutionStrategy: string;
  /** Summaries of prior completed steps */
  priorStepSummaries: string[];
}

function buildStepContextPrefix(ctx: StepGeneratorContext): string {
  const parts: string[] = [];

  parts.push(`PROBLEM: ${ctx.problemStatement}`);
  parts.push(`STRATEGY: ${ctx.solutionStrategy}`);

  if (ctx.priorStepSummaries.length > 0) {
    parts.push(`PRIOR STEPS:\n${ctx.priorStepSummaries.map((s, i) => `  Step ${i}: ${s}`).join('\n')}`);
  }

  if (ctx.inputExpressions.length > 0) {
    parts.push(`INPUT EXPRESSIONS (from dependency steps):\n${ctx.inputExpressions.map((e, i) => `  ${i}: ${e}`).join('\n')}`);
  }

  return parts.join('\n\n');
}

// ── Shared annotations schema (appended to every step generator) ─────

const ANNOTATIONS_SCHEMA_FIELDS: Record<string, Schema> = {
  annSteps: { type: Type.STRING, description: 'WHAT is happening procedurally — action, not reasoning' },
  annStrategy: { type: Type.STRING, description: 'WHY this choice — metacognitive, first person' },
  annMisconceptions: { type: Type.STRING, description: 'Specific common error at this step and why it is tempting' },
  annConnections: { type: Type.STRING, description: 'Link to broader concept, prior knowledge, or generalization' },
};

const ANNOTATIONS_REQUIRED = ['annSteps', 'annStrategy', 'annMisconceptions', 'annConnections'];

function annotationPromptSuffix(focus: string): string {
  return `

## Annotations (include all 4)
- annSteps: WHAT is happening (procedural, no "why")
- annStrategy: WHY this approach (metacognitive, first person, "I notice that...")
- annMisconceptions: A SPECIFIC common error here (not generic warnings)
- annConnections: How this links to a broader concept
Focus emphasis on: ${focus}`;
}

function extractAnnotations(data: Record<string, unknown>): StepAnnotations {
  return {
    steps: (data.annSteps as string) || '',
    strategy: (data.annStrategy as string) || '',
    misconceptions: (data.annMisconceptions as string) || '',
    connections: (data.annConnections as string) || '',
  };
}

// ── Algebra Step Generator ───────────────────────────────────────────

const ALGEBRA_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    trans0From: { type: Type.STRING, description: 'KaTeX: starting expression for transition 1' },
    trans0To: { type: Type.STRING, description: 'KaTeX: result after transition 1' },
    trans0Op: { type: Type.STRING, description: 'Operation label (e.g. "subtract 3 from both sides")' },
    trans1From: { type: Type.STRING, description: 'KaTeX: starting expression for transition 2', nullable: true },
    trans1To: { type: Type.STRING, description: 'KaTeX: result after transition 2', nullable: true },
    trans1Op: { type: Type.STRING, nullable: true },
    trans2From: { type: Type.STRING, nullable: true },
    trans2To: { type: Type.STRING, nullable: true },
    trans2Op: { type: Type.STRING, nullable: true },
    result: { type: Type.STRING, description: 'Final KaTeX expression after this step' },
    ...ANNOTATIONS_SCHEMA_FIELDS,
  },
  required: ['trans0From', 'trans0To', 'trans0Op', 'result', ...ANNOTATIONS_REQUIRED],
};

async function generateAlgebraStep(
  ctx: StepGeneratorContext,
): Promise<{ content: AlgebraStepContent; annotations: StepAnnotations }> {
  const contextPrefix = buildStepContextPrefix(ctx);

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Generate an ALGEBRA step for a worked example on "${ctx.topic}" (${ctx.gradeContext}).

${contextPrefix}

STEP BRIEF: ${ctx.brief}

Write 1-3 algebraic transitions. Each transition has a "from" KaTeX expression, a "to" KaTeX expression, and an operation label.
Use proper KaTeX syntax (\\frac{}{}, \\sqrt{}, ^{}, etc.). The "result" is the final expression after all transitions.
IMPORTANT: If input expressions are provided, the first transition's "from" MUST match or build upon them.
IMPORTANT: Actually carry out the computation described in the brief. Do NOT leave expressions unevaluated.${annotationPromptSuffix(ctx.annotationFocus)}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: ALGEBRA_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error('Algebra generator returned empty');
  const data = JSON.parse(text);

  const transitions = [];
  for (let i = 0; i < 3; i++) {
    const from = data[`trans${i}From`];
    const to = data[`trans${i}To`];
    const op = data[`trans${i}Op`];
    if (from && to && op) {
      transitions.push({ from: { latex: from }, to: { latex: to }, operation: op });
    }
  }

  return {
    content: { type: 'algebra', transitions, result: data.result },
    annotations: extractAnnotations(data),
  };
}

// ── Substitution Step Generator ──────────────────────────────────────

const SUBSTITUTION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    template: { type: Type.STRING, description: 'KaTeX template expression with variables (e.g. "A = \\pi r^{2}")' },
    sub0Var: { type: Type.STRING, description: 'Variable name being substituted' },
    sub0Val: { type: Type.STRING, description: 'KaTeX value being plugged in' },
    sub1Var: { type: Type.STRING, nullable: true },
    sub1Val: { type: Type.STRING, nullable: true },
    sub2Var: { type: Type.STRING, nullable: true },
    sub2Val: { type: Type.STRING, nullable: true },
    sub3Var: { type: Type.STRING, nullable: true },
    sub3Val: { type: Type.STRING, nullable: true },
    result: { type: Type.STRING, description: 'KaTeX expression after all substitutions' },
    ...ANNOTATIONS_SCHEMA_FIELDS,
  },
  required: ['template', 'sub0Var', 'sub0Val', 'result', ...ANNOTATIONS_REQUIRED],
};

async function generateSubstitutionStep(
  ctx: StepGeneratorContext,
): Promise<{ content: SubstitutionStepContent; annotations: StepAnnotations }> {
  const contextPrefix = buildStepContextPrefix(ctx);

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Generate a SUBSTITUTION step for a worked example on "${ctx.topic}" (${ctx.gradeContext}).

${contextPrefix}

STEP BRIEF: ${ctx.brief}

Provide the template expression, the variables being substituted (1-4), and the result after substitution.
Use proper KaTeX syntax. Actually compute the result — do not leave it as an unevaluated expression.${annotationPromptSuffix(ctx.annotationFocus)}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: SUBSTITUTION_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error('Substitution generator returned empty');
  const data = JSON.parse(text);

  const substitutions = [];
  for (let i = 0; i < 4; i++) {
    const variable = data[`sub${i}Var`];
    const value = data[`sub${i}Val`];
    if (variable && value) substitutions.push({ variable, value });
  }

  return {
    content: { type: 'substitution', template: data.template, substitutions, result: data.result },
    annotations: extractAnnotations(data),
  };
}

// ── Table Step Generator ─────────────────────────────────────────────

const TABLE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    caption: { type: Type.STRING, description: 'Table caption' },
    header0: { type: Type.STRING }, header1: { type: Type.STRING },
    header2: { type: Type.STRING, nullable: true }, header3: { type: Type.STRING, nullable: true },
    row0col0: { type: Type.STRING }, row0col1: { type: Type.STRING },
    row0col2: { type: Type.STRING, nullable: true }, row0col3: { type: Type.STRING, nullable: true },
    row1col0: { type: Type.STRING }, row1col1: { type: Type.STRING },
    row1col2: { type: Type.STRING, nullable: true }, row1col3: { type: Type.STRING, nullable: true },
    row2col0: { type: Type.STRING, nullable: true }, row2col1: { type: Type.STRING, nullable: true },
    row2col2: { type: Type.STRING, nullable: true }, row2col3: { type: Type.STRING, nullable: true },
    row3col0: { type: Type.STRING, nullable: true }, row3col1: { type: Type.STRING, nullable: true },
    row3col2: { type: Type.STRING, nullable: true }, row3col3: { type: Type.STRING, nullable: true },
    row4col0: { type: Type.STRING, nullable: true }, row4col1: { type: Type.STRING, nullable: true },
    row4col2: { type: Type.STRING, nullable: true }, row4col3: { type: Type.STRING, nullable: true },
    highlightRow: { type: Type.NUMBER, description: 'Row index of the answer cell (optional)', nullable: true },
    highlightCol: { type: Type.NUMBER, description: 'Col index of the answer cell (optional)', nullable: true },
    result: { type: Type.STRING, description: 'KaTeX expression summarizing the table conclusion' },
    ...ANNOTATIONS_SCHEMA_FIELDS,
  },
  required: ['caption', 'header0', 'header1', 'row0col0', 'row0col1', 'row1col0', 'row1col1', 'result', ...ANNOTATIONS_REQUIRED],
};

async function generateTableStep(
  ctx: StepGeneratorContext,
): Promise<{ content: TableStepContent; annotations: StepAnnotations; result: string }> {
  const contextPrefix = buildStepContextPrefix(ctx);

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Generate a TABLE step for a worked example on "${ctx.topic}" (${ctx.gradeContext}).

${contextPrefix}

STEP BRIEF: ${ctx.brief}

Create a structured table with 2-4 columns and 2-5 rows. Cells can use KaTeX (wrap in $...$).
Include a result field — the KaTeX expression summarizing what we learn from the table.${annotationPromptSuffix(ctx.annotationFocus)}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: TABLE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error('Table generator returned empty');
  const data = JSON.parse(text);

  const headers: string[] = [data.header0, data.header1];
  if (data.header2) headers.push(data.header2);
  if (data.header3) headers.push(data.header3);

  const colCount = headers.length;
  const rows: string[][] = [];
  for (let r = 0; r < 5; r++) {
    const col0 = data[`row${r}col0`];
    if (!col0) break;
    const row: string[] = [col0];
    for (let c = 1; c < colCount; c++) {
      row.push(data[`row${r}col${c}`] || '');
    }
    rows.push(row);
  }

  const highlightCell: [number, number] | undefined =
    data.highlightRow != null && data.highlightCol != null
      ? [data.highlightRow, data.highlightCol]
      : undefined;

  return {
    content: { type: 'table', caption: data.caption, headers, rows, highlightCell },
    annotations: extractAnnotations(data),
    result: data.result,
  };
}

// ── Diagram Step Generator ───────────────────────────────────────────

const DIAGRAM_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    imagePrompt: { type: Type.STRING, description: 'Detailed image generation prompt for the diagram' },
    altText: { type: Type.STRING, description: 'Accessibility alt text' },
    label0Text: { type: Type.STRING, description: 'Label 1 text' },
    label0Desc: { type: Type.STRING, description: 'Label 1 description' },
    label1Text: { type: Type.STRING },
    label1Desc: { type: Type.STRING },
    label2Text: { type: Type.STRING, nullable: true },
    label2Desc: { type: Type.STRING, nullable: true },
    label3Text: { type: Type.STRING, nullable: true },
    label3Desc: { type: Type.STRING, nullable: true },
    label4Text: { type: Type.STRING, nullable: true },
    label4Desc: { type: Type.STRING, nullable: true },
    result: { type: Type.STRING, description: 'KaTeX expression or conclusion from the diagram' },
    ...ANNOTATIONS_SCHEMA_FIELDS,
  },
  required: ['imagePrompt', 'altText', 'label0Text', 'label0Desc', 'label1Text', 'label1Desc', 'result', ...ANNOTATIONS_REQUIRED],
};

async function generateDiagramStep(
  ctx: StepGeneratorContext,
): Promise<{ content: DiagramStepContent; annotations: StepAnnotations; result: string }> {
  const contextPrefix = buildStepContextPrefix(ctx);

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Generate a DIAGRAM step for a worked example on "${ctx.topic}" (${ctx.gradeContext}).

${contextPrefix}

STEP BRIEF: ${ctx.brief}

Describe a diagram with 2-5 labeled parts. The imagePrompt should describe a clean educational diagram.
Include a result — the key conclusion or expression derived from the diagram.${annotationPromptSuffix(ctx.annotationFocus)}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: DIAGRAM_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error('Diagram generator returned empty');
  const data = JSON.parse(text);

  const labels = [];
  for (let i = 0; i < 5; i++) {
    const labelText = data[`label${i}Text`];
    const desc = data[`label${i}Desc`];
    if (labelText && desc) labels.push({ text: labelText, description: desc });
  }

  return {
    content: { type: 'diagram', imagePrompt: data.imagePrompt, altText: data.altText, labels },
    annotations: extractAnnotations(data),
    result: data.result,
  };
}

// ── Graph Sketch Step Generator ──────────────────────────────────────

const GRAPH_SKETCH_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    expression: { type: Type.STRING, description: 'KaTeX function expression (e.g. "f(x) = x^2 - 4")' },
    domainMin: { type: Type.NUMBER }, domainMax: { type: Type.NUMBER },
    rangeMin: { type: Type.NUMBER }, rangeMax: { type: Type.NUMBER },
    pt0X: { type: Type.NUMBER }, pt0Y: { type: Type.NUMBER }, pt0Label: { type: Type.STRING },
    pt1X: { type: Type.NUMBER }, pt1Y: { type: Type.NUMBER }, pt1Label: { type: Type.STRING },
    pt2X: { type: Type.NUMBER, nullable: true }, pt2Y: { type: Type.NUMBER, nullable: true }, pt2Label: { type: Type.STRING, nullable: true },
    pt3X: { type: Type.NUMBER, nullable: true }, pt3Y: { type: Type.NUMBER, nullable: true }, pt3Label: { type: Type.STRING, nullable: true },
    feat0Kind: { type: Type.STRING, description: 'Feature kind: asymptote, intercept, maximum, minimum, inflection', nullable: true },
    feat0Label: { type: Type.STRING, nullable: true },
    feat0Value: { type: Type.STRING, nullable: true },
    feat1Kind: { type: Type.STRING, nullable: true },
    feat1Label: { type: Type.STRING, nullable: true },
    feat1Value: { type: Type.STRING, nullable: true },
    feat2Kind: { type: Type.STRING, nullable: true },
    feat2Label: { type: Type.STRING, nullable: true },
    feat2Value: { type: Type.STRING, nullable: true },
    result: { type: Type.STRING, description: 'KaTeX conclusion from graph analysis' },
    ...ANNOTATIONS_SCHEMA_FIELDS,
  },
  required: ['expression', 'domainMin', 'domainMax', 'rangeMin', 'rangeMax',
    'pt0X', 'pt0Y', 'pt0Label', 'pt1X', 'pt1Y', 'pt1Label', 'result', ...ANNOTATIONS_REQUIRED],
};

async function generateGraphSketchStep(
  ctx: StepGeneratorContext,
): Promise<{ content: GraphSketchStepContent; annotations: StepAnnotations; result: string }> {
  const contextPrefix = buildStepContextPrefix(ctx);

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Generate a GRAPH SKETCH step for a worked example on "${ctx.topic}" (${ctx.gradeContext}).

${contextPrefix}

STEP BRIEF: ${ctx.brief}

Provide the function expression in KaTeX, domain/range, 2-4 key points to plot, and notable features.
Include a result — the conclusion drawn from the graph.${annotationPromptSuffix(ctx.annotationFocus)}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: GRAPH_SKETCH_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error('Graph sketch generator returned empty');
  const data = JSON.parse(text);

  const keyPoints = [];
  for (let i = 0; i < 4; i++) {
    const x = data[`pt${i}X`];
    const y = data[`pt${i}Y`];
    const label = data[`pt${i}Label`];
    if (x != null && y != null && label) keyPoints.push({ x, y, label });
  }

  const validFeatureKinds = new Set(['asymptote', 'intercept', 'maximum', 'minimum', 'inflection']);
  const features: GraphSketchStepContent['features'] = [];
  for (let i = 0; i < 3; i++) {
    const kind = data[`feat${i}Kind`];
    const label = data[`feat${i}Label`];
    const value = data[`feat${i}Value`];
    if (kind && validFeatureKinds.has(kind) && label && value) {
      features.push({ kind: kind as GraphSketchStepContent['features'][number]['kind'], label, value });
    }
  }

  return {
    content: {
      type: 'graph-sketch',
      expression: data.expression,
      keyPoints,
      domain: [data.domainMin, data.domainMax],
      range: [data.rangeMin, data.rangeMax],
      features,
    },
    annotations: extractAnnotations(data),
    result: data.result,
  };
}

// ── Case Split Step Generator ────────────────────────────────────────

const CASE_SPLIT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    condition: { type: Type.STRING, description: 'What we are splitting on (e.g. "sign of x - 2")' },
    case0Label: { type: Type.STRING }, case0Condition: { type: Type.STRING },
    case0Work: { type: Type.STRING, description: 'KaTeX work for this case' },
    case0Result: { type: Type.STRING },
    case1Label: { type: Type.STRING }, case1Condition: { type: Type.STRING },
    case1Work: { type: Type.STRING },
    case1Result: { type: Type.STRING },
    case2Label: { type: Type.STRING, nullable: true }, case2Condition: { type: Type.STRING, nullable: true },
    case2Work: { type: Type.STRING, nullable: true },
    case2Result: { type: Type.STRING, nullable: true },
    result: { type: Type.STRING, description: 'Combined KaTeX result after considering all cases' },
    ...ANNOTATIONS_SCHEMA_FIELDS,
  },
  required: ['condition', 'case0Label', 'case0Condition', 'case0Work', 'case0Result',
    'case1Label', 'case1Condition', 'case1Work', 'case1Result', 'result', ...ANNOTATIONS_REQUIRED],
};

async function generateCaseSplitStep(
  ctx: StepGeneratorContext,
): Promise<{ content: CaseSplitStepContent; annotations: StepAnnotations; result: string }> {
  const contextPrefix = buildStepContextPrefix(ctx);

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Generate a CASE SPLIT step for a worked example on "${ctx.topic}" (${ctx.gradeContext}).

${contextPrefix}

STEP BRIEF: ${ctx.brief}

Split into 2-3 cases. Each case needs a label, condition, KaTeX work, and result.
Provide an overall result combining all cases.${annotationPromptSuffix(ctx.annotationFocus)}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: CASE_SPLIT_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error('Case split generator returned empty');
  const data = JSON.parse(text);

  const cases = [];
  for (let i = 0; i < 3; i++) {
    const label = data[`case${i}Label`];
    const cond = data[`case${i}Condition`];
    const work = data[`case${i}Work`];
    const result = data[`case${i}Result`];
    if (label && cond && work && result) {
      cases.push({ label, condition: cond, work, result });
    }
  }

  return {
    content: { type: 'case-split', condition: data.condition, cases },
    annotations: extractAnnotations(data),
    result: data.result,
  };
}

// ── Verification Step Generator ──────────────────────────────────────

const VERIFICATION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    claim: { type: Type.STRING, description: 'KaTeX: the answer being verified' },
    check0From: { type: Type.STRING, description: 'KaTeX: original equation with answer substituted' },
    check0To: { type: Type.STRING, description: 'KaTeX: simplified to show equality' },
    check0Op: { type: Type.STRING, description: 'Operation description' },
    check1From: { type: Type.STRING, nullable: true },
    check1To: { type: Type.STRING, nullable: true },
    check1Op: { type: Type.STRING, nullable: true },
    verified: { type: Type.BOOLEAN, description: 'Does the check pass? Should always be true.' },
    ...ANNOTATIONS_SCHEMA_FIELDS,
  },
  required: ['claim', 'check0From', 'check0To', 'check0Op', 'verified', ...ANNOTATIONS_REQUIRED],
};

async function generateVerificationStep(
  ctx: StepGeneratorContext,
): Promise<{ content: VerificationStepContent; annotations: StepAnnotations }> {
  const contextPrefix = buildStepContextPrefix(ctx);

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Generate a VERIFICATION step for a worked example on "${ctx.topic}" (${ctx.gradeContext}).

${contextPrefix}

STEP BRIEF: ${ctx.brief}

Substitute the answer back into the original equation/condition and show it checks out.
Provide 1-2 check transitions (from→to with operation label).${annotationPromptSuffix(ctx.annotationFocus)}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: VERIFICATION_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error('Verification generator returned empty');
  const data = JSON.parse(text);

  const checkTransitions = [];
  for (let i = 0; i < 2; i++) {
    const from = data[`check${i}From`];
    const to = data[`check${i}To`];
    const op = data[`check${i}Op`];
    if (from && to && op) {
      checkTransitions.push({ from: { latex: from }, to: { latex: to }, operation: op });
    }
  }

  return {
    content: { type: 'verification', claim: data.claim, checkTransitions, verified: data.verified !== false },
    annotations: extractAnnotations(data),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Step Router — dispatches to the right generator by type
// ═══════════════════════════════════════════════════════════════════════

async function generateStep(
  plan: StepPlan,
  ctx: StepGeneratorContext,
): Promise<{ content: StepContent; annotations: StepAnnotations; result?: string } | null> {
  try {
    switch (plan.stepType) {
      case 'algebra':
        return await generateAlgebraStep(ctx);
      case 'substitution':
        return await generateSubstitutionStep(ctx);
      case 'table':
        return await generateTableStep(ctx);
      case 'diagram':
        return await generateDiagramStep(ctx);
      case 'graph-sketch':
        return await generateGraphSketchStep(ctx);
      case 'case-split':
        return await generateCaseSplitStep(ctx);
      case 'verification':
        return await generateVerificationStep(ctx);
      default:
        console.warn(`[AnnotatedExample] Unknown step type: ${plan.stepType}, falling back to algebra`);
        return await generateAlgebraStep(ctx);
    }
  } catch (error) {
    console.error(`[AnnotatedExample] Failed to generate step ${plan.stepIndex} (${plan.stepType}):`, error);
    return null;
  }
}

/** Extract the result expression from a generated step (for dependency passing). */
function getStepResult(content: StepContent, explicitResult?: string): string {
  if (explicitResult) return explicitResult;
  switch (content.type) {
    case 'algebra': return content.result;
    case 'substitution': return content.result;
    case 'verification': return content.claim;
    default: return '';
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Wave Executor — topological sort + parallel execution with rich context
// ═══════════════════════════════════════════════════════════════════════

/**
 * Groups steps into waves where each wave's steps have all dependencies
 * satisfied by prior waves. Steps within a wave run in parallel.
 */
function buildWaves(steps: StepPlan[]): StepPlan[][] {
  const waves: StepPlan[][] = [];
  const completed = new Set<number>();

  let remaining = [...steps];

  while (remaining.length > 0) {
    const wave: StepPlan[] = [];

    for (const step of remaining) {
      const depsResolved = step.dependsOn.every((dep) => completed.has(dep));
      if (depsResolved) {
        wave.push(step);
      }
    }

    if (wave.length === 0) {
      console.warn('[AnnotatedExample] Dependency cycle detected, forcing remaining steps');
      waves.push(remaining);
      break;
    }

    waves.push(wave);
    for (const step of wave) {
      completed.add(step.stepIndex);
    }
    remaining = remaining.filter((s) => !completed.has(s.stepIndex));
  }

  return waves;
}

async function executeWaves(
  plan: SolutionPlan,
  topic: string,
  gradeContext: string,
): Promise<RichExampleStep[]> {
  const waves = buildWaves(plan.steps);
  /** Map from stepIndex → result expression (for dependency passing) */
  const results = new Map<number, string>();
  /** Map from stepIndex → generated step */
  const generatedSteps = new Map<number, RichExampleStep>();
  /** Map from stepIndex → brief summary for context passing */
  const stepSummaries = new Map<number, string>();

  console.log(`[AnnotatedExample] Executing ${waves.length} wave(s): ${waves.map((w) => `[${w.map((s) => `${s.stepIndex}:${s.stepType}`).join(', ')}]`).join(' → ')}`);

  for (const wave of waves) {
    const promises = wave.map(async (stepPlan) => {
      // Gather input expressions from dependencies
      const inputExpressions = stepPlan.dependsOn
        .map((dep) => results.get(dep))
        .filter((r): r is string => r != null && r !== '');

      // Build ordered summaries of all prior completed steps
      const priorStepSummaries: string[] = [];
      for (let i = 0; i < stepPlan.stepIndex; i++) {
        const summary = stepSummaries.get(i);
        if (summary) priorStepSummaries.push(summary);
      }

      const ctx: StepGeneratorContext = {
        brief: stepPlan.brief,
        inputExpressions,
        topic,
        gradeContext,
        annotationFocus: stepPlan.annotationFocus,
        problemStatement: plan.problem.statement,
        solutionStrategy: plan.solutionStrategy,
        priorStepSummaries,
      };

      const generated = await generateStep(stepPlan, ctx);
      if (!generated) return;

      const resultExpr = getStepResult(generated.content, 'result' in generated ? (generated as { result?: string }).result : undefined);
      results.set(stepPlan.stepIndex, resultExpr);

      // Build a summary for downstream steps
      stepSummaries.set(
        stepPlan.stepIndex,
        `[${stepPlan.stepType}] ${stepPlan.title} → result: ${resultExpr || '(visual/structural)'}`,
      );

      generatedSteps.set(stepPlan.stepIndex, {
        id: stepPlan.stepIndex + 1,
        title: stepPlan.title,
        content: generated.content,
        annotations: generated.annotations,
      });
    });

    await Promise.all(promises);
  }

  // Return in original order
  return plan.steps
    .map((s) => generatedSteps.get(s.stepIndex))
    .filter((s): s is RichExampleStep => s != null);
}

// ═══════════════════════════════════════════════════════════════════════
// Main Export
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generate a Rich Annotated Example using orchestrated two-stage generation.
 *
 * Stage 1: Solution Architect (gemini-3-flash-preview with thinking) plans the
 *          step manifest with dependencies. Validates completeness and re-plans
 *          if the solution doesn't reach a final answer.
 * Stage 2: Wave executor runs step generators in parallel where possible,
 *          passing rich context (problem, strategy, prior step summaries).
 */
export async function generateAnnotatedExample(
  topic: string,
  gradeContext: string,
  config?: {
    intent?: string;
    objectiveText?: string;
    objectiveVerb?: string;
  },
): Promise<RichAnnotatedExampleData> {
  console.log('[AnnotatedExample] Stage 1: Running Solution Architect (gemini-3-flash-preview + thinking)...');
  const plan = await runOrchestrator(topic, gradeContext, config);

  console.log(`[AnnotatedExample] Plan: "${plan.title}" — ${plan.steps.length} steps`);
  console.log(`[AnnotatedExample] Step types: ${plan.steps.map((s) => s.stepType).join(', ')}`);

  console.log('[AnnotatedExample] Stage 2: Executing step generators with rich context...');
  const steps = await executeWaves(plan, topic, gradeContext);

  console.log(`[AnnotatedExample] Complete: ${steps.length} steps generated`);

  return {
    title: plan.title,
    subject: plan.subject,
    problem: plan.problem,
    solutionStrategy: plan.solutionStrategy,
    steps,
  };
}
