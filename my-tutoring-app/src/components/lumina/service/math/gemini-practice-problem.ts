/**
 * Gemini generator for the `practice-problem` primitive.
 *
 * TWO-STAGE PIPELINE (Option B — own a leaner pipeline):
 *
 *   STAGE 1 — Problem authoring. Reuse `runAnnotatedExampleOrchestrator`. The
 *   orchestrator already handles inset planning + per-type inset payload
 *   authoring; calling it standalone gives us a problem statement +
 *   structured inset for free without dragging in the solver / planner /
 *   per-type-generator / challenger pipeline that the AnnotatedExample primitive
 *   needs for its watch view.
 *
 *   STAGE 2 — Canonical solution. ONE Gemini Lite call takes the authored
 *   problem and produces the lean `PracticeStep[]` shape directly: title +
 *   subject + solutionStrategy + canonicalAnswer + steps[] where each step is
 *   { title, type, canonicalBody, strategy, misconceptions }.
 *
 * Why drop the AnnotatedExample pipeline?
 *   The practice canvas reads only a thin projection of the rich shape — title
 *   + type tag + a body summary + strategy/misconception. The judge prompt
 *   serializes structured step content back to text anyway. Generating
 *   transitions[].subMoves, KaTeX highlights, per-transition challenges, and
 *   four annotation layers is paying for animation/interaction affordances
 *   that practice mode never renders.
 *
 * Validation:
 *   Hard-reject (throw) on missing critical fields. The practice canvas can't
 *   render without a problem, strategy, or steps; silent fallback would ship
 *   a broken interaction.
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import { runAnnotatedExampleOrchestrator } from '../annotated-example/orchestrator';
import { serializeInsetForPrompt } from '../annotated-example/inset-helpers';
import type { Inset } from '../../types';
import type { StepType } from '../../primitives/annotated-example/types';
import type {
  PracticeDifficulty,
  PracticeEvalMode,
  PracticeProblemSolution,
  PracticeStep,
} from '../../primitives/visual-primitives/math/practice-problem-types';

// ── Difficulty steering ──────────────────────────────────────────────

const EVAL_MODE_TO_DIFFICULTY: Record<PracticeEvalMode, PracticeDifficulty> = {
  derive_easy: 'easy',
  derive_medium: 'medium',
  derive_hard: 'hard',
};

const VALID_EVAL_MODES = new Set<PracticeEvalMode>([
  'derive_easy',
  'derive_medium',
  'derive_hard',
]);

const DIFFICULTY_INTENT: Record<PracticeDifficulty, string> = {
  easy:
    'Generate a SHORT 2-3 step derivation problem suitable for a quick warm-up. ' +
    'Use simple algebra (linear equations, single-variable arithmetic). ' +
    'Avoid multi-rule combinations. Keep the problem statement concise. ' +
    'A student should be able to finish in under 90 seconds.',
  medium:
    'Generate a 3-5 step derivation problem at standard practice difficulty. ' +
    'Use multiple rule applications (combine like terms + isolate variable, ' +
    'distribute + factor, apply identity + simplify, etc.). Aim for a problem ' +
    "a student would see on a typical homework set — not trivial, but no " +
    'strategy puzzle either.',
  hard:
    'Generate a 4-6 step derivation problem that requires the student to make ' +
    'a strategy choice (substitution, case split, identity selection, change of ' +
    'variable). Include a non-obvious move at one of the steps — somewhere the ' +
    "student has to recognize which tool to reach for, not just turn a crank. " +
    'Aim for a stretch problem on the topic.',
};

// ── Stage 2 schema: lean canonical solution ──────────────────────────

const VALID_STEP_TYPES: StepType[] = ['algebra', 'table', 'diagram', 'graph-sketch', 'case-split'];

const CANONICAL_SOLUTION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "A short title for this practice problem (e.g. 'Solving 2x + 5 = 13' or 'Integration by parts of x·e^x'). 4-8 words. NOT the topic name itself.",
    },
    subject: {
      type: Type.STRING,
      description:
        "The math subject (Algebra, Calculus, Probability, Linear Algebra, Geometry, etc.). One short capitalized phrase.",
    },
    solutionStrategy: {
      type: Type.STRING,
      description:
        "ONE sentence previewing the strategy (e.g. 'Isolate the variable by undoing operations in reverse order.'). MUST NOT reveal the final answer or any specific intermediate value. Names the approach, not the work.",
    },
    canonicalAnswer: {
      type: Type.STRING,
      description:
        "The expected final answer as KaTeX (e.g. 'x = 4', 'y = \\\\frac{1}{2}x + 3', '\\\\frac{x^3}{3} + C'). Used to ground the judge's verdict and as the 'Expected' pill in the reveal.",
    },
    steps: {
      type: Type.ARRAY,
      description:
        'Canonical solution as ordered steps. Length must match the requested step count for the difficulty band.',
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description:
              "Procedural step title — what move is being made (e.g. 'Subtract 5 from both sides', 'Apply the power rule', 'Identify the row where revenue = 450'). 4-10 words. Reads as a verb phrase.",
          },
          type: {
            type: Type.STRING,
            enum: VALID_STEP_TYPES,
            description:
              "Step type tag. Use 'algebra' for symbolic manipulation (the default for derivations). Use 'table' / 'graph-sketch' / 'case-split' / 'diagram' only when the canonical move is genuinely visual/structural rather than algebraic.",
          },
          canonicalBody: {
            type: Type.STRING,
            description:
              "The work for this step as plain text/KaTeX. For algebra, write the transformation as 'lhs -> [operation] -> rhs' (e.g. '2x + 5 = 13 -> [subtract 5 from both sides] -> 2x = 8'). For non-algebra steps, write one line summarizing the salient body (e.g. 'Read row 3 of the table: revenue = 450, cost = 280'). MUST be concrete and specific — this is what the judge compares the student's work against.",
          },
          strategy: {
            type: Type.STRING,
            description:
              "ONE sentence on WHY this step is the right move (the metacognitive layer). Used by the judge when the student is on track.",
          },
          misconceptions: {
            type: Type.STRING,
            description:
              "ONE sentence naming a common error students make at this step. Used by the judge to cite the misconception when the student diverges (e.g. 'Forgetting to apply the operation to BOTH sides of the equation.').",
          },
        },
        required: ['title', 'type', 'canonicalBody', 'strategy', 'misconceptions'],
      },
    },
  },
  required: ['title', 'subject', 'solutionStrategy', 'canonicalAnswer', 'steps'],
};

interface CanonicalSolutionRaw {
  title: string;
  subject: string;
  solutionStrategy: string;
  canonicalAnswer: string;
  steps: Array<{
    title: string;
    type: string;
    canonicalBody: string;
    strategy: string;
    misconceptions: string;
  }>;
}

// ── Stage 2 prompt ──────────────────────────────────────────────────

function buildCanonicalSolutionPrompt(args: {
  topic: string;
  gradeLevel: string;
  difficulty: PracticeDifficulty;
  problemStatement: string;
  inset?: Inset;
}): string {
  const { topic, gradeLevel, difficulty, problemStatement, inset } = args;
  const stepCountHint = {
    easy: '2-3 steps',
    medium: '3-5 steps',
    hard: '4-6 steps',
  }[difficulty];

  const insetBlock = inset
    ? `\n\n## Visual data attached to the problem\n${serializeInsetForPrompt(inset)}\n\nThe canonical solution must be coherent with this data — if it's a table, your steps should reference specific rows/values; if it's a number line, your steps should reference specific points; etc.`
    : '';

  return `You are authoring the canonical solution for a single practice problem. A student will solve this on a whiteboard canvas; an LLM judge will compare their handwritten work to YOUR canonical steps to produce a verdict.

## The problem (already authored — do NOT rewrite it)
Topic: ${topic}
Grade level: ${gradeLevel}
Difficulty: ${difficulty} (${stepCountHint})

Problem statement:
${problemStatement}${insetBlock}

## Your task

Produce a JSON object with:
1. \`title\` — a short title for this problem.
2. \`subject\` — the math subject (Algebra, Calculus, etc.).
3. \`solutionStrategy\` — one sentence previewing the approach (NEVER reveals the final answer).
4. \`canonicalAnswer\` — the final answer in KaTeX.
5. \`steps\` — the canonical solution as ${stepCountHint}.

## Step authoring rules

1. **Each step is one canonical move.** Don't bundle multiple operations into one step. The whiteboard judge expects each canonical step to correspond to roughly one line of the student's handwritten work.

2. **\`canonicalBody\` is the source of truth.** Write the work clearly enough that a judge can compare a student's handwritten line against it. For algebra, format as \`lhs -> [operation] -> rhs\`. Examples:
   - \`2x + 5 = 13 -> [subtract 5 from both sides] -> 2x = 8\`
   - \`2x = 8 -> [divide both sides by 2] -> x = 4\`
   - \`\\int x e^x \\, dx -> [integration by parts: u = x, dv = e^x dx] -> x e^x - \\int e^x \\, dx\`

   For non-algebra steps, write one concrete line:
   - table: \`Read row 3 of the revenue table: April -> $450\`
   - graph-sketch: \`Sketch parabola y = x^2 - 4 with vertex (0, -4) and roots at x = ±2\`
   - case-split: \`Case 1 (x ≥ 0): |x| = x, equation becomes x + 3 = 7\`

3. **\`strategy\` is the metacognitive WHY.** Not what we're doing — why we're doing it. Example: "Subtraction undoes addition, so we apply the inverse operation to isolate the variable term."

4. **\`misconceptions\` names a SPECIFIC error.** Not a generic warning. Example: "Forgetting to apply the operation to both sides — students often subtract 5 only from the left." This will be cited verbatim when the judge sees a student making that error.

5. **\`canonicalAnswer\` matches the LAST step's result.** If the last step's \`canonicalBody\` ends in \`x = 4\`, then \`canonicalAnswer\` is \`x = 4\`.

6. **\`solutionStrategy\` previews the approach without giving away.** Good: "Isolate the variable by undoing operations in reverse order." Bad: "Subtract 5, then divide by 2 to get x = 4."

7. **Step count matches the difficulty.** Easy: 2-3 steps. Medium: 3-5 steps. Hard: 4-6 steps. If a problem has a natural step count outside the band, prefer the band over splitting/merging artificially.

Output the JSON now.`;
}

// ── Validation + normalization ──────────────────────────────────────

function isStepType(value: string): value is StepType {
  return (VALID_STEP_TYPES as string[]).includes(value);
}

function normalizeCanonicalSolution(
  raw: CanonicalSolutionRaw,
  topic: string,
): {
  title: string;
  subject: string;
  solutionStrategy: string;
  canonicalAnswer: string;
  steps: PracticeStep[];
} {
  if (!raw.title?.trim()) {
    throw new Error(`[PracticeProblem] Stage 2 returned empty title for topic="${topic}"`);
  }
  if (!raw.subject?.trim()) {
    throw new Error(`[PracticeProblem] Stage 2 returned empty subject for topic="${topic}"`);
  }
  if (!raw.solutionStrategy?.trim()) {
    throw new Error(
      `[PracticeProblem] Stage 2 returned empty solutionStrategy for topic="${topic}"`,
    );
  }
  if (!raw.canonicalAnswer?.trim()) {
    throw new Error(
      `[PracticeProblem] Stage 2 returned empty canonicalAnswer for topic="${topic}"`,
    );
  }
  if (!Array.isArray(raw.steps) || raw.steps.length < 2) {
    throw new Error(
      `[PracticeProblem] Stage 2 returned ${raw.steps?.length ?? 0} steps; need at least 2 for topic="${topic}"`,
    );
  }

  const steps: PracticeStep[] = raw.steps.map((s, i) => {
    if (!s.title?.trim()) {
      throw new Error(`[PracticeProblem] Step ${i + 1} missing title for topic="${topic}"`);
    }
    if (!s.canonicalBody?.trim()) {
      throw new Error(
        `[PracticeProblem] Step ${i + 1} missing canonicalBody for topic="${topic}"`,
      );
    }
    if (!s.strategy?.trim() || !s.misconceptions?.trim()) {
      throw new Error(
        `[PracticeProblem] Step ${i + 1} missing strategy or misconceptions for topic="${topic}"`,
      );
    }
    const type: StepType = isStepType(s.type) ? s.type : 'algebra';
    return {
      id: i,
      title: s.title.trim(),
      type,
      canonicalBody: s.canonicalBody.trim(),
      strategy: s.strategy.trim(),
      misconceptions: s.misconceptions.trim(),
    };
  });

  return {
    title: raw.title.trim(),
    subject: raw.subject.trim(),
    solutionStrategy: raw.solutionStrategy.trim(),
    canonicalAnswer: raw.canonicalAnswer.trim(),
    steps,
  };
}

// ── Public entry point ──────────────────────────────────────────────

interface GeneratePracticeProblemConfig {
  /** Eval mode key from the manifest. Drives difficulty + intent. */
  targetEvalMode?: string;
  /** Optional steering text for the orchestrator (overrides difficulty default). */
  intent?: string;
}

/**
 * Generate a single practice problem at the requested difficulty.
 *
 * Two Gemini calls total: orchestrator stage 1 (problem authoring) + stage 2
 * (canonical solution). Plus one optional inset author when the orchestrator
 * picks a non-null inset type. No solver, no planner, no per-type generators,
 * no challenger.
 */
export async function generatePracticeProblem(
  topic: string,
  gradeLevel: string,
  config?: Partial<GeneratePracticeProblemConfig>,
): Promise<PracticeProblemSolution> {
  const requestedEvalMode = config?.targetEvalMode;
  const evalMode: PracticeEvalMode =
    requestedEvalMode && VALID_EVAL_MODES.has(requestedEvalMode as PracticeEvalMode)
      ? (requestedEvalMode as PracticeEvalMode)
      : 'derive_medium';
  const difficulty: PracticeDifficulty = EVAL_MODE_TO_DIFFICULTY[evalMode];
  const intent = config?.intent || DIFFICULTY_INTENT[difficulty];

  console.log('[PracticeProblem] Generating', {
    topic,
    gradeLevel,
    evalMode,
    difficulty,
    requestedEvalMode,
  });

  // ── Stage 1: orchestrator authors the problem statement + inset ──
  const problemPlan = await runAnnotatedExampleOrchestrator({
    topic,
    gradeLevel,
    context: intent,
  });

  if (!problemPlan.problemStatement?.trim()) {
    throw new Error(
      `[PracticeProblem] Orchestrator returned no problem for topic="${topic}"`,
    );
  }

  // ── Stage 2: canonical solution in a single Gemini Lite call ──
  const prompt = buildCanonicalSolutionPrompt({
    topic,
    gradeLevel,
    difficulty,
    problemStatement: problemPlan.problemStatement,
    inset: problemPlan.inset,
  });

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: CANONICAL_SOLUTION_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error(`[PracticeProblem] Stage 2 returned empty response for topic="${topic}"`);
  }

  let parsed: CanonicalSolutionRaw;
  try {
    parsed = JSON.parse(text) as CanonicalSolutionRaw;
  } catch (error) {
    console.error('[PracticeProblem] Stage 2 JSON parse failed:', error);
    throw new Error(`[PracticeProblem] Stage 2 malformed response for topic="${topic}"`);
  }

  const normalized = normalizeCanonicalSolution(parsed, topic);

  const result: PracticeProblemSolution = {
    title: normalized.title,
    subject: normalized.subject,
    problem: {
      statement: problemPlan.problemStatement,
      inset: problemPlan.inset,
    },
    solutionStrategy: normalized.solutionStrategy,
    canonicalAnswer: normalized.canonicalAnswer,
    steps: normalized.steps,
    difficulty,
    evalMode,
    gradeLevel,
  };

  console.log('[PracticeProblem] Generated', {
    title: result.title,
    subject: result.subject,
    difficulty: result.difficulty,
    evalMode: result.evalMode,
    stepCount: result.steps.length,
    hasInset: Boolean(result.problem.inset),
    canonicalAnswer: result.canonicalAnswer,
  });

  return result;
}
