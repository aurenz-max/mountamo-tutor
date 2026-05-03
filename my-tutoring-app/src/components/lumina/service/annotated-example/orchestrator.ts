/**
 * Annotated-Example Orchestrator — Stage 0 of an N-example lesson.
 *
 * Mirrors the knowledge-check orchestrator. One lightweight Gemini call
 * plans the cognitive arc of N worked examples on a topic: per-slot
 * difficulty, inset type, and content brief. Each slot is hydrated
 * through `generateAnnotatedExample` ONE AT A TIME — unlike KC, the
 * per-example surface is too large to batch in parallel, and the student
 * is consuming examples sequentially anyway.
 *
 * Output shape: `AnnotatedExampleSetPlan`. Callers iterate slot by slot
 * and call `generateAnnotatedExampleFromPlan` for each as the student
 * progresses.
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import { isAuthorableInsetType } from './inset-helpers';
import type {
  AnnotatedExampleDifficulty,
  AnnotatedExampleProblemPlan,
  AnnotatedExampleSetPlan,
  AnnotatedPlannedInsetType,
} from '../../primitives/annotated-example/types';

// ── Schema ───────────────────────────────────────────────────────────

const ORCHESTRATOR_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    lessonArc: {
      type: Type.STRING,
      description:
        '1-2 sentence narrative of the cognitive journey across the set (e.g. "Start with reading a value off a table, build to a 2-step linear solve, finish with a multi-case problem requiring a graph sketch").',
    },
    problems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          index: { type: Type.NUMBER, description: 'Ordinal position (0-based).' },
          difficulty: {
            type: Type.STRING,
            enum: ['easy', 'medium', 'hard'],
            description: 'Targeted difficulty band for this slot.',
          },
          insetType: {
            type: Type.STRING,
            nullable: true,
            description:
              'Inset to attach, or null for plain text. One of: katex, data-table, passage, chart, code, number-line, definition-box, or null.',
          },
          brief: {
            type: Type.STRING,
            description:
              "Detailed content brief for the downstream author+solver. Self-contained — the generator sees only this brief, not the other slots. Specify: what concept the example must teach, what angle / misconception to target, and (when an inset is attached) what the inset's data looks like in shape (number of rows, axis range, etc.) without naming the actual values.",
          },
          cognitiveNote: {
            type: Type.STRING,
            description:
              'One sentence on why this difficulty + inset + angle were chosen for this position in the arc.',
          },
        },
        required: ['index', 'difficulty', 'insetType', 'brief', 'cognitiveNote'],
      },
    },
  },
  required: ['lessonArc', 'problems'],
};

// ── Prompt ───────────────────────────────────────────────────────────

function buildOrchestratorPrompt(
  topic: string,
  gradeLevel: string,
  count: number,
  context?: string,
): string {
  return `You are an expert lesson designer. Plan a ${count}-example worked-example lesson on "${topic}" for ${gradeLevel} students.

Your job is to decide the cognitive arc — per-example difficulty, inset (visual context), and content brief — that will best teach this topic at this level. You are NOT generating the examples themselves. A separate pipeline will produce each one from your brief.

Each "annotated example" in this set is:
1. A worked example the student watches (rich step-by-step solution with annotations).
2. Followed by an isomorphic sibling problem the student solves on a canvas, judged by a separate model.

So each slot must support BOTH a teachable worked solution AND a solvable practice problem.

## Available Inset Types (visual context attached above the problem)

- **katex**: LaTeX expression. Use when the problem hinges on reading or transforming a specific equation.
- **data-table**: Headers + rows of data. Use when the problem requires reading specific cells (e.g. "from the table, find the row where X meets condition Y, then compute Z"). Strong fit for stats, science, comparison problems.
- **passage**: Prose / poem / quote. Use only for reading-heavy topics — rare for math/science.
- **chart**: Bar / line / pie chart. Use when the problem requires interpreting a trend or comparing values from a visualization.
- **code**: Source code snippet. Use when the problem requires tracing or debugging code.
- **number-line**: Visual number line with points. Use for number sense, fractions, decimals, inequalities, ordering on a continuum.
- **definition-box**: Vocabulary term + definition + example. Use sparingly — usually a worked example needs more than a definition to solve.
- **null**: Plain text problem, no inset. Perfectly fine — many algebra / calculus problems don't need a visual.

## Rules

1. **Inset fit, not inset volume.** Only attach an inset when the problem is genuinely *anchored* in that visual data. Don't bolt an inset onto a problem that solves the same way without it. A 2-step linear equation rarely needs an inset; a "find the median from this table" problem requires one.

2. **Difficulty progression.** Sequence from easier to harder across the set. The first slot should be accessible (warm-up); the last should challenge.

3. **Inset diversity when sets allow.** For sets of 3+, vary inset types across slots when the topic supports it — don't make every slot a data-table just because the topic happens to have data.

4. **Brief quality.** Each brief must be self-contained: the downstream author + solver see ONLY this brief plus the topic. Specify what concept the example must teach, what angle or misconception to target, and (when an inset is attached) the SHAPE of the inset content (e.g. "table with 4 columns: month / sales / cost / profit; 5 rows of fictional small-business data") without committing to specific numeric values — the author chooses those.

5. **Topic + grade in every brief.** Always include "${topic}" and "${gradeLevel}" context in the brief so the generator stays on-target.

6. **Plan ${count} examples — no more, no less.**

${context ? `## Additional context\n${context}\n\n` : ''}Plan the ${count} examples now.`;
}

// ── Run ──────────────────────────────────────────────────────────────

const VALID_DIFFICULTIES = new Set<AnnotatedExampleDifficulty>(['easy', 'medium', 'hard']);

export interface RunOrchestratorInput {
  topic: string;
  gradeLevel: string;
  count: number;
  /** Optional steering text — same role as `context` in the KC orchestrator. */
  context?: string;
}

export async function runAnnotatedExampleOrchestrator(
  input: RunOrchestratorInput,
): Promise<AnnotatedExampleSetPlan> {
  const { topic, gradeLevel, count, context } = input;
  const prompt = buildOrchestratorPrompt(topic, gradeLevel, count, context);

  console.log('[AE Orchestrator] Planning lesson:', { topic, gradeLevel, count });

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: ORCHESTRATOR_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error('[AE Orchestrator] Empty response');

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    console.error('[AE Orchestrator] JSON parse failed:', error);
    throw new Error('[AE Orchestrator] Malformed plan response');
  }

  const rawProblems = Array.isArray(raw.problems) ? raw.problems : [];
  const validProblems: AnnotatedExampleProblemPlan[] = [];

  for (const r of rawProblems) {
    if (!r || typeof r !== 'object') continue;
    const row = r as Record<string, unknown>;

    const rawDifficulty = typeof row.difficulty === 'string' ? row.difficulty : 'medium';
    const difficulty: AnnotatedExampleDifficulty = VALID_DIFFICULTIES.has(
      rawDifficulty as AnnotatedExampleDifficulty,
    )
      ? (rawDifficulty as AnnotatedExampleDifficulty)
      : 'medium';

    const rawInset = row.insetType;
    const insetType: AnnotatedPlannedInsetType =
      typeof rawInset === 'string' && isAuthorableInsetType(rawInset) ? rawInset : null;

    const brief =
      typeof row.brief === 'string' && row.brief.trim()
        ? row.brief.trim()
        : `Generate a ${difficulty} worked example on "${topic}" for ${gradeLevel} students.`;

    const cognitiveNote =
      typeof row.cognitiveNote === 'string' ? row.cognitiveNote.trim() : '';

    validProblems.push({
      index: validProblems.length,
      difficulty,
      insetType,
      brief,
      cognitiveNote,
    });
  }

  if (validProblems.length === 0) {
    throw new Error('[AE Orchestrator] Produced no valid problems');
  }

  if (validProblems.length !== count) {
    console.warn(
      `[AE Orchestrator] Requested ${count} examples, got ${validProblems.length}`,
    );
  }

  const lessonArc = typeof raw.lessonArc === 'string' ? raw.lessonArc.trim() : '';

  const plan: AnnotatedExampleSetPlan = { lessonArc, problems: validProblems };

  console.log('[AE Orchestrator] Plan:', {
    arc: plan.lessonArc,
    problems: plan.problems.map((p) => ({
      difficulty: p.difficulty,
      inset: p.insetType ?? 'none',
    })),
  });

  return plan;
}
