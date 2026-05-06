/**
 * Annotated-Example Orchestrator — Stage 0.
 *
 * One Gemini Lite call frames an N-problem worked-example flow on a topic.
 * Index 0 is the watched worked example (what the student sees solved with
 * annotation layers). Indices 1..N-1 are isomorphic practice problems the
 * student solves themselves on the Try-It canvas.
 *
 * The orchestrator is the SOLE problem author for the fresh path. It
 * authors the actual problem statement and (when applicable) the structured
 * inset payload for every slot in one shot, so the downstream pipeline
 * never has to author — it just hydrates the already-pinned problems.
 *
 * Sibling-problem authoring across slots (same skill family, different
 * surface numbers, structurally analogous insets) is enforced in the
 * prompt: indices 1..N-1 must be isomorphic siblings of index 0.
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import { isAuthorableInsetType, type AuthorableInsetType } from './inset-helpers';
import type {
  AnnotatedExampleDifficulty,
  AnnotatedExampleProblemPlan,
  AnnotatedExampleSetPlan,
  AnnotatedPlannedInsetType,
} from '../../primitives/annotated-example/types';
import type { Inset } from '../../types';

// ── Inset schema (discriminated bag) ─────────────────────────────────
//
// The orchestrator may author different inset types across slots in a single
// response, so the per-slot inset schema is the union of all authorable
// variants' fields, all optional, with `insetType` as the discriminator. We
// post-hoc coerce / normalize each slot's inset using the discriminator and
// drop any that fail validation.

const INSET_BAG_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    insetType: {
      type: Type.STRING,
      enum: ['katex', 'data-table', 'passage', 'chart', 'code', 'number-line', 'definition-box'],
      description: 'Discriminator. Determines which other fields are required.',
    },
    label: { type: Type.STRING, description: 'Short display label, e.g. "Figure 1".' },

    // katex
    expression: { type: Type.STRING, description: 'KaTeX source. Required when insetType=katex.' },
    displayMode: { type: Type.STRING, enum: ['display', 'inline'] },

    // shared with data-table / chart / number-line / passage / definition-box
    caption: { type: Type.STRING },

    // data-table
    headers: { type: Type.ARRAY, items: { type: Type.STRING } },
    rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } },

    // passage
    text: { type: Type.STRING },
    format: { type: Type.STRING, enum: ['prose', 'poem', 'quote', 'letter', 'source'] },
    attribution: { type: Type.STRING },

    // chart
    chartType: { type: Type.STRING, enum: ['bar', 'line', 'pie'] },
    title: { type: Type.STRING },
    xLabel: { type: Type.STRING },
    yLabel: { type: Type.STRING },
    data: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          value: { type: Type.NUMBER },
        },
        required: ['label', 'value'],
      },
    },

    // code
    code: { type: Type.STRING },
    language: { type: Type.STRING },

    // number-line
    min: { type: Type.NUMBER },
    max: { type: Type.NUMBER },
    ticks: { type: Type.ARRAY, items: { type: Type.NUMBER } },
    points: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          value: { type: Type.NUMBER },
          label: { type: Type.STRING },
        },
        required: ['value', 'label'],
      },
    },

    // definition-box
    term: { type: Type.STRING },
    definition: { type: Type.STRING },
    partOfSpeech: { type: Type.STRING },
    exampleSentence: { type: Type.STRING },
  },
  required: ['insetType'],
};

// ── Top-level schema ─────────────────────────────────────────────────

const ORCHESTRATOR_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    problems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          index: { type: Type.NUMBER, description: 'Ordinal position (0-based). 0 = watched example, 1+ = student-solved siblings.' },
          difficulty: {
            type: Type.STRING,
            enum: ['easy', 'medium', 'hard'],
            description: 'Targeted difficulty band for this slot.',
          },
          insetType: {
            type: Type.STRING,
            nullable: true,
            enum: ['katex', 'data-table', 'passage', 'chart', 'code', 'number-line', 'definition-box'],
            description:
              'Inset to attach, or null for plain text. Slot 0 sets the inset type — slots 1+ MUST use the same inset type (or null if slot 0 is null).',
          },
          problemStatement: {
            type: Type.STRING,
            description:
              'The problem as a student will read it on a worksheet. Self-contained, no meta-commentary, no solution. Reference the inset by label when applicable.',
          },
          inset: {
            ...INSET_BAG_SCHEMA,
            nullable: true,
            description:
              'Structured inset payload. Required when insetType is set; null otherwise. Discriminator determines required fields per type.',
          },
          rationale: {
            type: Type.STRING,
            description:
              'One sentence on the problem design — what skill is exercised (slot 0) or what was preserved/changed from slot 0 (siblings).',
          },
        },
        required: ['index', 'difficulty', 'insetType', 'problemStatement', 'rationale'],
      },
    },
  },
  required: ['problems'],
};

// ── Prompt ───────────────────────────────────────────────────────────

function buildOrchestratorPrompt(
  topic: string,
  gradeLevel: string,
  count: number,
  context?: string,
): string {
  const isSet = count > 1;
  return `You are an expert lesson designer AND problem author.

Author ${count} ${isSet ? 'related problems' : 'problem'} on "${topic}" for a ${gradeLevel} student.${
    isSet
      ? ` Slot 0 is the WATCHED worked example. Slots 1..${count - 1} are ISOMORPHIC PRACTICE PROBLEMS the student will solve themselves on a canvas.`
      : ''
  }

For each slot you decide:
1. Difficulty band (easy / medium / hard).
2. Whether to attach a visual inset (and which type — see below).
3. The actual problem statement.
4. The structured inset payload (when an inset is attached).
5. A one-sentence design rationale.

## Available inset types

- **katex**: a LaTeX expression the problem hinges on.
- **data-table**: 3-6 columns × 3-8 rows. The problem MUST require reading specific cells.
- **passage**: prose / poem / quote. Use only for reading-heavy topics.
- **chart**: 3-8 data points (bar / line / pie). The problem MUST require chart interpretation.
- **code**: 5-20 line snippet. The problem MUST require tracing or debugging.
- **number-line**: range, ticks, optional named points. For number-sense / inequalities / fractions.
- **definition-box**: term + definition + example. Use sparingly.
- **null**: plain text problem, no inset.

## Inset payload requirements per type

When you attach an inset, fill the matching fields on the \`inset\` object (alongside \`insetType\` and an optional \`label\`):
- katex → \`expression\` (LaTeX, no $ wrapping), \`displayMode\` ("display" | "inline").
- data-table → \`headers\` (string[]), \`rows\` (string[][]), optional \`caption\`.
- passage → \`text\`, \`format\` ("prose" | "poem" | "quote" | "letter" | "source"), optional \`attribution\`.
- chart → \`chartType\` ("bar" | "line" | "pie"), \`title\`, \`data\` ([{label,value},...]), optional \`xLabel\` / \`yLabel\`.
- code → \`code\`, \`language\`.
- number-line → \`min\`, \`max\`, \`ticks\` (number[]), optional \`points\` ([{value,label},...]).
- definition-box → \`term\`, \`definition\`, optional \`partOfSpeech\`, \`exampleSentence\`.

The inset and the problem statement are ONE coherent unit: the problem must be UNANSWERABLE without the inset, and the inset must contain exactly the data the problem references.

## Rules

1. **Inset fit, not inset volume.** Only attach an inset when the problem is genuinely *anchored* in that visual data. A 2-step linear equation rarely needs an inset; a "find the median from this table" problem requires one.
${
  isSet
    ? `
2. **Slot 0 sets the frame; slots 1+ are isomorphic siblings.**
   - Same skill family. If slot 0 is a 2-step linear equation, slots 1+ are 2-step linear equations. If slot 0 is integration by substitution, slots 1+ are integration by substitution.
   - Same step structure. The canonical solve has the same number of major moves.
   - Different surface numbers. Don't reuse the same constants. \`2x + 5 = 7\` should not become \`2x + 5 = 9\`.
   - Comparable difficulty (same grade, same conceptual challenge — siblings can be slightly harder for variety, not significantly).
   - Same misconception structure preserved.
   - Same inset TYPE as slot 0 (or null if slot 0 is null), with the SAME COLUMNS / AXES / FORMAT / SHAPE but DIFFERENT VALUES. A table stays a table with the same headers; a number line stays a number line with the same axis style.

3. **Difficulty ordering across the set.** Slot 0 should be a clear teaching example (medium is fine). Sibling slots can stay at slot 0's level or step up gently — never harder than the topic warrants for ${gradeLevel}.`
    : `
2. **Single problem.** Pick the inset type (or null) that best teaches the topic, then author the problem and inset together as one coherent unit.`
}

${context ? `## Additional context\n${context}\n\n` : ''}Author ${isSet ? `the ${count} problems` : 'the problem'} now.`;
}

// ── Inset coercion ───────────────────────────────────────────────────

const VALID_DIFFICULTIES = new Set<AnnotatedExampleDifficulty>(['easy', 'medium', 'hard']);

/**
 * Coerce the discriminated bag the LLM returned into a typed Inset. Returns
 * undefined when the required fields for the discriminator aren't present —
 * caller treats the slot as plain-text in that case.
 */
function coerceInset(insetType: AuthorableInsetType, raw: Record<string, unknown>): Inset | undefined {
  const label = typeof raw.label === 'string' ? raw.label : undefined;
  const caption = typeof raw.caption === 'string' ? raw.caption : undefined;

  switch (insetType) {
    case 'katex': {
      if (typeof raw.expression !== 'string') return undefined;
      const displayMode: 'display' | 'inline' =
        raw.displayMode === 'inline' ? 'inline' : 'display';
      return { insetType, label, expression: raw.expression, displayMode, caption };
    }
    case 'data-table': {
      if (!Array.isArray(raw.headers) || !Array.isArray(raw.rows)) return undefined;
      const headers = raw.headers.filter((h): h is string => typeof h === 'string');
      const rows = (raw.rows as unknown[]).map((row) =>
        Array.isArray(row) ? row.filter((c): c is string => typeof c === 'string') : [],
      );
      if (headers.length === 0 || rows.length === 0) return undefined;
      return { insetType, label, headers, rows, caption };
    }
    case 'passage': {
      if (typeof raw.text !== 'string') return undefined;
      const format: 'prose' | 'poem' | 'quote' | 'letter' | 'source' =
        raw.format === 'poem' || raw.format === 'quote' || raw.format === 'letter' || raw.format === 'source'
          ? raw.format
          : 'prose';
      const attribution = typeof raw.attribution === 'string' ? raw.attribution : undefined;
      return { insetType, label, text: raw.text, format, attribution };
    }
    case 'chart': {
      if (!Array.isArray(raw.data)) return undefined;
      const chartType: 'bar' | 'line' | 'pie' =
        raw.chartType === 'line' || raw.chartType === 'pie' ? raw.chartType : 'bar';
      const title = typeof raw.title === 'string' ? raw.title : '';
      const data = (raw.data as unknown[])
        .map((d) => {
          if (!d || typeof d !== 'object') return null;
          const r = d as Record<string, unknown>;
          if (typeof r.label !== 'string' || typeof r.value !== 'number') return null;
          return { label: r.label, value: r.value };
        })
        .filter((d): d is { label: string; value: number } => d !== null);
      if (data.length === 0) return undefined;
      const xLabel = typeof raw.xLabel === 'string' ? raw.xLabel : undefined;
      const yLabel = typeof raw.yLabel === 'string' ? raw.yLabel : undefined;
      return { insetType, label, chartType, title, data, xLabel, yLabel };
    }
    case 'code': {
      if (typeof raw.code !== 'string' || typeof raw.language !== 'string') return undefined;
      return { insetType, label, code: raw.code, language: raw.language };
    }
    case 'number-line': {
      if (typeof raw.min !== 'number' || typeof raw.max !== 'number' || !Array.isArray(raw.ticks)) {
        return undefined;
      }
      const ticks = (raw.ticks as unknown[]).filter((t): t is number => typeof t === 'number');
      const points = Array.isArray(raw.points)
        ? (raw.points as unknown[])
            .map((p) => {
              if (!p || typeof p !== 'object') return null;
              const r = p as Record<string, unknown>;
              if (typeof r.value !== 'number' || typeof r.label !== 'string') return null;
              return { value: r.value, label: r.label };
            })
            .filter((p): p is { value: number; label: string } => p !== null)
        : undefined;
      return { insetType, label, min: raw.min, max: raw.max, ticks, points };
    }
    case 'definition-box': {
      if (typeof raw.term !== 'string' || typeof raw.definition !== 'string') return undefined;
      const partOfSpeech = typeof raw.partOfSpeech === 'string' ? raw.partOfSpeech : undefined;
      const exampleSentence = typeof raw.exampleSentence === 'string' ? raw.exampleSentence : undefined;
      return { insetType, label, term: raw.term, definition: raw.definition, partOfSpeech, exampleSentence };
    }
  }
}

// ── Run ──────────────────────────────────────────────────────────────

export interface RunOrchestratorInput {
  topic: string;
  gradeLevel: string;
  /** Total problems to author. Index 0 = watched example, 1..N-1 = student-solved siblings. */
  count: number;
  /** Optional steering text. */
  context?: string;
}

export async function runAnnotatedExampleOrchestrator(
  input: RunOrchestratorInput,
): Promise<AnnotatedExampleSetPlan> {
  const { topic, gradeLevel, count, context } = input;
  const safeCount = Math.max(1, count);
  const prompt = buildOrchestratorPrompt(topic, gradeLevel, safeCount, context);

  console.log('[AE Orchestrator] Authoring problems:', { topic, gradeLevel, count: safeCount });

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

    const problemStatement =
      typeof row.problemStatement === 'string' ? row.problemStatement.trim() : '';
    if (!problemStatement) {
      console.warn('[AE Orchestrator] Slot missing problemStatement, dropping');
      continue;
    }

    const rationale = typeof row.rationale === 'string' ? row.rationale.trim() : '';

    let inset: Inset | undefined;
    if (insetType && row.inset && typeof row.inset === 'object') {
      inset = coerceInset(insetType, row.inset as Record<string, unknown>);
      if (!inset) {
        console.warn(
          `[AE Orchestrator] Slot ${validProblems.length} declared inset "${insetType}" but payload was malformed — falling back to plain text.`,
        );
      }
    }

    validProblems.push({
      index: validProblems.length,
      difficulty,
      insetType: inset ? insetType : null,
      problemStatement,
      inset,
      rationale,
    });
  }

  if (validProblems.length === 0) {
    throw new Error('[AE Orchestrator] Produced no valid problems');
  }

  if (validProblems.length !== safeCount) {
    console.warn(
      `[AE Orchestrator] Requested ${safeCount} problems, got ${validProblems.length}`,
    );
  }

  console.log('[AE Orchestrator] Authored:', {
    problems: validProblems.map((p) => ({
      index: p.index,
      difficulty: p.difficulty,
      inset: p.insetType ?? 'none',
      preview: p.problemStatement.slice(0, 80),
    })),
  });

  return { problems: validProblems };
}
