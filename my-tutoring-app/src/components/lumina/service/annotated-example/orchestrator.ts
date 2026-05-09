/**
 * Annotated-Example Orchestrator — Stage 0.
 *
 * Two-stage pipeline (mirrors the knowledge-check orchestrator):
 *
 *   STAGE 1 — PLAN. One Gemini Lite call frames a single worked-example
 *   problem on a topic. It picks insetType and authors the *problem
 *   statement*, but it does NOT author the structured inset payload — the
 *   planning schema is intentionally light so Gemini Lite can produce valid
 *   JSON reliably.
 *
 *   STAGE 2 — AUTHOR INSET. When the planned insetType is non-null, a
 *   per-type Gemini call with a *monomorphic* schema authors the inset
 *   payload. Required fields are properly marked because each schema covers
 *   exactly one inset variant.
 *
 * Why two stages?
 *   A flat union schema (where `inset` could be any variant) can only mark
 *   `insetType` as required — every variant-specific field must be optional,
 *   so Gemini Lite frequently drops them and the slot falls back to plain
 *   text. The monomorphic per-type schema in `inset-helpers.ts` marks the
 *   right fields required for the chosen variant.
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import {
  isAuthorableInsetType,
  getInsetGeminiSchema,
  buildInsetPromptGuidance,
  type AuthorableInsetType,
} from './inset-helpers';
import type {
  AnnotatedExampleDifficulty,
  AnnotatedExampleProblemPlan,
  AnnotatedPlannedInsetType,
} from '../../primitives/annotated-example/types';
import type { Inset } from '../../types';

// ── Stage 1: planning schema (no inset payload) ──────────────────────

const PLANNING_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    difficulty: {
      type: Type.STRING,
      enum: ['easy', 'medium', 'hard'],
      description: 'Targeted difficulty band for the problem.',
    },
    insetType: {
      type: Type.STRING,
      nullable: true,
      enum: ['katex', 'data-table', 'passage', 'chart', 'code', 'number-line', 'definition-box', 'equation-setup'],
      description: 'Inset to attach, or null for plain text.',
    },
    problemStatement: {
      type: Type.STRING,
      description:
        'The problem as a student will read it on a worksheet. Self-contained, no meta-commentary, no solution. Reference the inset by label when applicable.',
    },
    insetBrief: {
      type: Type.STRING,
      nullable: true,
      description:
        'When insetType is set: 1-3 sentence brief of what the inset must contain (specific values, structure, anchoring data) so a separate authoring pass can produce it coherent with the problem statement. Null when insetType is null.',
    },
    rationale: {
      type: Type.STRING,
      description: 'One sentence on the problem design — what skill is exercised.',
    },
  },
  required: ['difficulty', 'insetType', 'problemStatement', 'rationale'],
};

// ── Stage 1: prompt ──────────────────────────────────────────────────

function buildPlanningPrompt(topic: string, gradeLevel: string, context?: string): string {
  return `You are an expert lesson designer.

Plan a single problem on "${topic}" for a ${gradeLevel} student.

You decide:
1. Difficulty band (easy / medium / hard).
2. Whether to attach a visual inset (and which type — see below).
3. The actual problem statement.
4. A 1-3 sentence brief of what the inset must contain (when an inset is attached). A separate authoring pass produces the structured inset payload from this brief, so be concrete: name specific quantities, values, axes, etc.
5. A one-sentence design rationale.

You are NOT authoring the structured inset payload. Just plan the problem and describe what the inset should contain.

## Prose conventions in \`problemStatement\` (CRITICAL)

The problem statement is rendered through a KaTeX-aware renderer. \`$...$\` is reserved for inline math.

- For currency, prices, or any literal dollar sign, write \`\\$\` (backslash-dollar). Examples: \`\\$15\`, \`a profit of \\$45\`.
- For inline math (variables, expressions, equations), use \`$...$\`. Examples: \`Solve $2x + 3 = 7$\`, \`let $c$ be the number of cups\`.
- Never leave bare \`$\` next to a number — \`$15\` will be paired with the next \`$\` in the sentence and the prose between them will render as italicized math.

## Available inset types

- **katex**: a LaTeX expression the problem hinges on. Use when the problem GIVES the equation and the lesson is manipulation ("Solve $2x + 3 = 7$").
- **data-table**: 3-6 columns × 3-8 rows. The problem MUST require reading specific cells.
- **passage**: prose / poem / quote. Use only for reading-heavy topics.
- **chart**: 3-8 data points (bar / line / pie). The problem MUST require chart interpretation.
- **code**: 5-20 line snippet. The problem MUST require tracing or debugging.
- **number-line**: range, ticks, optional named points. For number-sense / inequalities / fractions.
- **definition-box**: term + definition + example. Use sparingly.
- **equation-setup**: INTERACTIVE modeling gate for word problems. The student commits to an equation via MCQ before the algebra reveals. Use when the topic is a word problem and the lesson is **translating prose into the equation**.
- **null**: plain text problem, no inset.

## Inset brief expectations per type

The \`insetBrief\` is consumed by a separate per-type author. Be specific so the author has enough to produce a coherent payload:
- katex → which expression, in plain English (e.g. "the equation 2t + 5 = 13 in display mode").
- data-table → columns, row count, what data the cells hold (e.g. "columns: Month, Revenue, Cost; 5 rows of monthly data").
- passage → format + topic + length (e.g. "prose passage, ~3 paragraphs, on the founding of NASA").
- chart → chartType + axes + the pattern the data should show (e.g. "bar chart of Q1-Q4 sales; Q3 is the peak").
- code → language + what the snippet does + intended bug if any (e.g. "Python 8-line bubble-sort with an off-by-one error on line 5").
- number-line → range + tick spacing + which points are labeled (e.g. "[-5, 5], integer ticks, point at -2 labeled 'A'").
- definition-box → term + brief gloss of the meaning to convey.
- equation-setup → name the quantities, the unknown, the canonical equation in plain English, and the misconceptions the distractors should target (e.g. "quantities: flat fee $5, topping cost $2 each, total spent $13; unknown t = number of toppings; canonical 2t + 5 = 13; distractors should target swapped operands and dropped coefficients").

## Rules

1. **Inset fit, not inset volume.** Only attach an inset when the problem is genuinely *anchored* in that visual data. A 2-step linear equation rarely needs an inset; a "find the median from this table" problem requires one.

2. **Word problems → \`equation-setup\` (NOT \`katex\`).** When the topic describes a real-world scenario in prose and asks for a quantity, the equation IS the lesson — gate it with \`equation-setup\` so the student commits to the model before the algebra runs. Do NOT pre-render the equation as a \`katex\` inset next to the prose; that gives away the entire pedagogical point. Reserve \`katex\` for problems that already SHOW the equation in the statement ("Solve $2x + 3 = 7$"), where the lesson is the manipulation, not the modeling.

3. **Pick the inset type (or null) that best teaches the topic**, then author the problem statement and a concrete inset brief.

${context ? `## Additional context\n${context}\n\n` : ''}Plan the problem now.`;
}

// ── Stage 2: per-slot inset author ───────────────────────────────────

function buildInsetAuthorPrompt(
  insetType: AuthorableInsetType,
  topic: string,
  gradeLevel: string,
  problemStatement: string,
  insetBrief: string,
): string {
  const guidance = buildInsetPromptGuidance(insetType);
  return `You are authoring the structured inset payload for a worked-example problem.

Topic: ${topic}
Grade level: ${gradeLevel}

Problem statement (already authored — do NOT rewrite it):
${problemStatement}

Inset brief from the lesson designer (what the inset must contain so it is coherent with the problem):
${insetBrief}

${guidance}

Produce the inset payload now. The student will see this rendered above the problem statement; the data must match the problem exactly.`;
}

async function authorInset(
  insetType: AuthorableInsetType,
  topic: string,
  gradeLevel: string,
  problemStatement: string,
  insetBrief: string,
): Promise<Inset | undefined> {
  const schema = getInsetGeminiSchema(insetType);
  const prompt = buildInsetAuthorPrompt(insetType, topic, gradeLevel, problemStatement, insetBrief);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });

    const text = response.text;
    if (!text) {
      console.warn('[AE Orchestrator] Inset author returned empty text');
      return undefined;
    }

    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(text) as Record<string, unknown>;
    } catch (err) {
      console.warn('[AE Orchestrator] Inset author JSON parse failed:', err);
      return undefined;
    }

    // Force the discriminator even if the LLM omitted it. Defensive parse to
    // surface any remaining schema gaps.
    const candidate = { ...raw, insetType } as Record<string, unknown> & { insetType: AuthorableInsetType };
    const validated = validateAuthoredInset(candidate);
    return validated;
  } catch (err) {
    console.warn('[AE Orchestrator] Inset author errored:', err);
    return undefined;
  }
}

/**
 * Light per-type validation on the authored payload. The monomorphic schema
 * already enforces shape; this is a belt-and-suspenders check that surfaces
 * specific field gaps in logs so future failures aren't opaque.
 */
function validateAuthoredInset(
  raw: Record<string, unknown> & { insetType: AuthorableInsetType },
): Inset | undefined {
  const { insetType } = raw;
  const missing: string[] = [];

  switch (insetType) {
    case 'katex':
      if (typeof raw.expression !== 'string') missing.push('expression');
      break;
    case 'data-table':
      if (!Array.isArray(raw.headers)) missing.push('headers');
      if (!Array.isArray(raw.rows)) missing.push('rows');
      break;
    case 'passage':
      if (typeof raw.text !== 'string') missing.push('text');
      break;
    case 'chart':
      if (!Array.isArray(raw.data)) missing.push('data');
      if (typeof raw.chartType !== 'string') missing.push('chartType');
      break;
    case 'code':
      if (typeof raw.code !== 'string') missing.push('code');
      if (typeof raw.language !== 'string') missing.push('language');
      break;
    case 'number-line':
      if (typeof raw.min !== 'number') missing.push('min');
      if (typeof raw.max !== 'number') missing.push('max');
      if (!Array.isArray(raw.ticks)) missing.push('ticks');
      break;
    case 'definition-box':
      if (typeof raw.term !== 'string') missing.push('term');
      if (typeof raw.definition !== 'string') missing.push('definition');
      break;
    case 'equation-setup': {
      if (typeof raw.scenario !== 'string') missing.push('scenario');
      if (typeof raw.canonicalEquation !== 'string') missing.push('canonicalEquation');
      if (typeof raw.rationale !== 'string') missing.push('rationale');
      if (!Array.isArray(raw.quantities)) missing.push('quantities');
      if (!raw.target || typeof raw.target !== 'object') missing.push('target');
      const distractors = Array.isArray(raw.distractorEquations) ? raw.distractorEquations : [];
      if (distractors.length < 2) missing.push(`distractorEquations(>=2, got ${distractors.length})`);

      // Ensure acceptableForms always contains the canonical equation as the
      // first entry so the renderer's MCQ scoring works without special cases.
      if (typeof raw.canonicalEquation === 'string') {
        const existing = Array.isArray(raw.acceptableForms)
          ? (raw.acceptableForms as unknown[]).filter((f): f is string => typeof f === 'string')
          : [];
        const canonical = raw.canonicalEquation;
        const merged = existing.includes(canonical) ? existing : [canonical, ...existing];
        raw.acceptableForms = merged;
      }
      break;
    }
  }

  if (missing.length > 0) {
    console.warn(
      `[AE Orchestrator] ${insetType} payload missing fields: ${missing.join(', ')}`,
    );
    return undefined;
  }

  return raw as unknown as Inset;
}

// ── Run ──────────────────────────────────────────────────────────────

const VALID_DIFFICULTIES = new Set<AnnotatedExampleDifficulty>(['easy', 'medium', 'hard']);

export interface RunOrchestratorInput {
  topic: string;
  gradeLevel: string;
  /** Optional steering text. */
  context?: string;
}

interface PlanRow {
  difficulty: AnnotatedExampleDifficulty;
  insetType: AnnotatedPlannedInsetType;
  problemStatement: string;
  insetBrief: string;
  rationale: string;
}

export async function runAnnotatedExampleOrchestrator(
  input: RunOrchestratorInput,
): Promise<AnnotatedExampleProblemPlan> {
  const { topic, gradeLevel, context } = input;

  console.log('[AE Orchestrator] Stage 1: planning problem', { topic, gradeLevel });

  const plan = await runPlanningStage(topic, gradeLevel, context);

  console.log(
    '[AE Orchestrator] Stage 2: authoring inset',
    plan.insetType ? `(${plan.insetType})` : '(none)',
  );

  let inset: Inset | undefined;
  if (plan.insetType) {
    inset = await authorInset(
      plan.insetType,
      topic,
      gradeLevel,
      plan.problemStatement,
      plan.insetBrief,
    );
    if (!inset) {
      console.warn(
        `[AE Orchestrator] Planned inset "${plan.insetType}" but authoring failed — falling back to plain text.`,
      );
    }
  }

  const result: AnnotatedExampleProblemPlan = {
    difficulty: plan.difficulty,
    insetType: inset ? plan.insetType : null,
    problemStatement: plan.problemStatement,
    inset,
    rationale: plan.rationale,
  };

  console.log('[AE Orchestrator] Authored:', {
    difficulty: result.difficulty,
    inset: result.insetType ?? 'none',
    preview: result.problemStatement.slice(0, 80),
  });

  return result;
}

async function runPlanningStage(
  topic: string,
  gradeLevel: string,
  context: string | undefined,
): Promise<PlanRow> {
  const prompt = buildPlanningPrompt(topic, gradeLevel, context);

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: PLANNING_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error('[AE Orchestrator] Stage 1 empty response');

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    console.error('[AE Orchestrator] Stage 1 JSON parse failed:', error);
    throw new Error('[AE Orchestrator] Stage 1 malformed plan response');
  }

  const rawDifficulty = typeof raw.difficulty === 'string' ? raw.difficulty : 'medium';
  const difficulty: AnnotatedExampleDifficulty = VALID_DIFFICULTIES.has(
    rawDifficulty as AnnotatedExampleDifficulty,
  )
    ? (rawDifficulty as AnnotatedExampleDifficulty)
    : 'medium';

  const rawInset = raw.insetType;
  const insetType: AnnotatedPlannedInsetType =
    typeof rawInset === 'string' && isAuthorableInsetType(rawInset) ? rawInset : null;

  const problemStatement =
    typeof raw.problemStatement === 'string' ? raw.problemStatement.trim() : '';
  if (!problemStatement) {
    throw new Error('[AE Orchestrator] Stage 1 produced no problem statement');
  }

  const rationale = typeof raw.rationale === 'string' ? raw.rationale.trim() : '';
  const insetBrief = typeof raw.insetBrief === 'string' ? raw.insetBrief.trim() : '';

  if (insetType && !insetBrief) {
    console.warn(
      `[AE Orchestrator] Planned inset "${insetType}" without an insetBrief — synthesizing one from the problem statement.`,
    );
  }

  return {
    difficulty,
    insetType,
    problemStatement,
    insetBrief: insetBrief || `Author the ${insetType} inset coherent with this problem statement.`,
    rationale,
  };
}
