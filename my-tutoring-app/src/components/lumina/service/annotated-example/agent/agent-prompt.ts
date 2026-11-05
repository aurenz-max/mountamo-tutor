/**
 * System prompt and tool declarations for the agentic annotated-example author.
 * The agent decides the problem, the moves and the prediction gates; the tools
 * render, compute and check, and every result comes back for the agent to read.
 */

import { Type, type FunctionDeclaration } from '@google/genai';
import { formatCatalogForPrompt, REGISTERED_STEP_TYPES } from '../registry';
import {
  formatAuthoringContractForPrompt,
  type AnnotatedExampleAuthoringContract,
} from '../authoring-contract';

export const INSET_TYPES = ['katex', 'data-table', 'passage', 'chart', 'code', 'number-line', 'definition-box', 'equation-setup'] as const;

export function buildAgentSystemPrompt(input: {
  topic: string;
  gradeContext: string;
  contract: AnnotatedExampleAuthoringContract;
  softDeadlineSeconds: number;
}): string {
  const contract = formatAuthoringContractForPrompt(input.contract);
  return `You author ONE worked example on "${input.topic}" for a ${input.gradeContext} student. A student watches it step by step and predicts some moves before they are revealed.

You work with tools. Each tool returns what the student will actually see, plus code checks. Read every result and fix what is wrong before you finish.

## What a good worked example is
- One problem, solved completely. If the topic is solving equations, the example solves the equation; it does not stop after setting it up.
- Every step changes something the student can see: a new equation, a filled table, a drawn figure. A transition whose "from" equals its "to" is not a step.
- Steps follow one line of reasoning. Use as few steps as the problem needs (2-3 for early grades, 2-5 for later grades). No recap step. A picture of the setup alone is not a solution: the work that reaches the answer (the counting sequence, the computation) is shown, and the last step states the answer.
- Numbers are correct. Use compute for any arithmetic you are not certain of.
- Words fit the reader. Grades K-3: concrete words, one short sentence per idea. Grades 4-5: at most two short sentences.
- The problem statement and the strategy line never contain the answer or an intermediate result. Required anchors from the authoring contract may appear anywhere in the example; a required total belongs in the last step, not the problem.

## Prediction gates (add_challenge)
Every example with two or more steps gets at least one gate. Gate 1-3 moves where the student can reason to the answer from what is already visible. Never gate a value that is already shown in the problem, the inset, the strategy, or an earlier step. Distractors are real student errors (sign error, wrong inverse operation, adding the wrong quantities), and each must actually be wrong. A pure verification step is not worth gating.

## Problem conventions
- Inline math uses $...$. A literal dollar sign is written \\$ (e.g. \\$15). Never put a bare $ next to a number.
- Inset types (optional, attach only when the problem is anchored in it): katex (the problem gives an equation to manipulate), data-table, passage, chart, code, number-line, definition-box, equation-setup (an interactive gate where the student picks the equation for a word problem; use it for word problems whose lesson is translating words to an equation, instead of katex).

## Step types (add_step stepType)
${formatCatalogForPrompt()}

${contract ? `${contract}\n\n` : ''}## How to work quickly
You have about ${input.softDeadlineSeconds} seconds. Call several tools in the same turn whenever they do not depend on each other.
1. Think through the problem and its full solution. Use compute to check numbers.
2. Call set_problem, and in the same turn call add_step once for EVERY step, in order. Write each step's workProse as the full explanation of that move with the exact math; the renderer builds the step from it.
3. Read the rendered steps and the checks. Fix problems with replace_step or remove_step. Add prediction gates with add_challenge.
4. Before finish, read the rendered steps as the student would. Fix any step that only restates the previous one, skips a move the student needs (e.g. the antiderivative before evaluating it), or uses symbols where the grade needs a picture or table (Grades K-3: show groups, counts or a running total before or instead of an equation). If a renderer fails, simplify that step's workProse and try again before switching type.
5. Call finish. If finish reports blocking issues, fix them and call finish again.`;
}

const STEP_FIELDS = {
  stepType: { type: Type.STRING, enum: REGISTERED_STEP_TYPES as unknown as string[], description: 'Renderer for this move.' },
  title: { type: Type.STRING, description: 'Short imperative title, 3-6 words. Must not state the result.' },
  pedagogicalGoal: { type: Type.STRING, description: 'One sentence: what this move teaches.' },
  workProse: { type: Type.STRING, description: 'The worked move as it would be explained to the student, with exact KaTeX math in $...$ and every number the step shows.' },
  seedNotes: { type: Type.STRING, description: 'One sentence telling the renderer what to show (which expressions, table columns, figure).' },
};
const STEP_REQUIRED = ['stepType', 'title', 'pedagogicalGoal', 'workProse', 'seedNotes'];

export const AGENT_TOOLS: FunctionDeclaration[] = [
  {
    name: 'compute',
    description: 'Evaluate math expressions exactly with mathjs (fractions, units, derivative(expr, x), simplify(expr)). Use integrate for definite integrals. Returns one result per expression.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        expressions: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'e.g. ["39 - 12", "27 / 4.5", "derivative(\\"x^3 - 3x\\", \\"x\\")"]' },
        integrals: {
          type: Type.ARRAY,
          description: 'Optional definite integrals, computed numerically.',
          items: { type: Type.OBJECT, properties: { expression: { type: Type.STRING }, variable: { type: Type.STRING }, from: { type: Type.NUMBER }, to: { type: Type.NUMBER } }, required: ['expression', 'variable', 'from', 'to'] },
        },
      },
      required: ['expressions'],
    },
  },
  {
    name: 'set_problem',
    description: 'Set (or replace) the problem the student reads. Returns code checks and, when an inset is requested, the authored inset.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        subject: { type: Type.STRING },
        statement: { type: Type.STRING, description: 'Self-contained problem text. No solution, no answer.' },
        strategy: { type: Type.STRING, description: 'One sentence on the approach, shown before the steps. Must not give the answer or an intermediate result.' },
        insetType: { type: Type.STRING, enum: INSET_TYPES as unknown as string[], nullable: true },
        insetBrief: { type: Type.STRING, nullable: true, description: 'What the inset must contain: exact values, axes, quantities. For equation-setup: quantities, unknown, canonical equation, misconceptions the distractor equations should target.' },
      },
      required: ['title', 'subject', 'statement', 'strategy'],
    },
  },
  {
    name: 'add_step',
    description: 'Render one move and append it to the end of the example. Returns the rendered content and checks.',
    parameters: { type: Type.OBJECT, properties: STEP_FIELDS, required: STEP_REQUIRED },
  },
  {
    name: 'replace_step',
    description: 'Re-render the step at index (0-based) from new fields. Any prediction gate on that step is removed.',
    parameters: { type: Type.OBJECT, properties: { index: { type: Type.INTEGER }, ...STEP_FIELDS }, required: ['index', ...STEP_REQUIRED] },
  },
  {
    name: 'remove_step',
    description: 'Remove the step at index (0-based). Later steps shift down; gates move with their steps.',
    parameters: { type: Type.OBJECT, properties: { index: { type: Type.INTEGER } }, required: ['index'] },
  },
  {
    name: 'add_challenge',
    description: 'Attach a prediction gate. kind=transition (algebra steps only) hides one transition\'s operation or result; its answer must equal that slot verbatim. kind=step (non-algebra steps) hides the whole step until the student answers.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        stepIndex: { type: Type.INTEGER },
        kind: { type: Type.STRING, enum: ['transition', 'step'] },
        transitionIndex: { type: Type.INTEGER, nullable: true },
        hide: { type: Type.STRING, enum: ['operation', 'to'], nullable: true },
        prompt: { type: Type.STRING, description: 'Question tied to this step. It must not name the answer.' },
        answer: { type: Type.STRING },
        synonyms: { type: Type.ARRAY, items: { type: Type.STRING } },
        distractors: { type: Type.ARRAY, items: { type: Type.STRING }, description: '2-3 misconception-based wrong answers, or empty for free response.' },
        rationale: { type: Type.STRING, description: 'Why the answer is right; shown after the student commits.' },
        answerFormat: { type: Type.STRING, enum: ['text', 'katex'], nullable: true },
      },
      required: ['stepIndex', 'kind', 'prompt', 'answer', 'distractors', 'rationale'],
    },
  },
  {
    name: 'finish',
    description: 'Submit the example. Runs the final checks and an independent review of the prediction gates. Returns blocking issues if any; otherwise the example ships.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
];
