/**
 * Inset Helpers — shared infrastructure for the annotated-example pipeline.
 *
 * Three responsibilities:
 *   1. `getInsetGeminiSchema(insetType)` — Gemini structured-output schema for
 *      a single inset variant. Caller picks the type up front; the schema
 *      is monomorphic so Gemini can produce well-formed JSON.
 *   2. `buildInsetPromptGuidance(insetType)` — instruction block injected
 *      into the problem-author prompt so the inset content is internally
 *      consistent with the problem statement.
 *   3. `serializeInsetForPrompt(inset)` — flattens an Inset object into
 *      compact plain text for downstream LLM prompts (judge, transcription,
 *      reviewProgress) so those callers see the same "problem context" the
 *      student does.
 *
 * Mirrors the inset variants supported by the knowledge-check pipeline. The
 * `image` variant is intentionally omitted — Gemini text generation can't
 * produce base64 image data, and the annotated-example flow doesn't have a
 * separate image-generation hop yet.
 */

import { Type, Schema } from '@google/genai';
import type { Inset, InsetType } from '../../types';

/**
 * Inset variants the annotated-problem author can request. Excludes `image`
 * (no base64 generation hop in this pipeline).
 */
export type AuthorableInsetType = Exclude<InsetType, 'image'>;

export function isAuthorableInsetType(t: string | undefined): t is AuthorableInsetType {
  return (
    t === 'katex' ||
    t === 'data-table' ||
    t === 'passage' ||
    t === 'chart' ||
    t === 'code' ||
    t === 'number-line' ||
    t === 'definition-box'
  );
}

// ── Gemini schema per variant ────────────────────────────────────────

export function getInsetGeminiSchema(insetType: AuthorableInsetType): Schema {
  const baseProps: Record<string, Schema> = {
    insetType: { type: Type.STRING, description: `Must be "${insetType}"` },
    label: {
      type: Type.STRING,
      description: 'Short display label, e.g. "Figure 1", "Table A", "Equation".',
    },
  };

  switch (insetType) {
    case 'katex':
      return {
        type: Type.OBJECT,
        properties: {
          ...baseProps,
          expression: {
            type: Type.STRING,
            description:
              'LaTeX source string (e.g. "\\\\frac{d}{dx}[x^3]"). Do NOT wrap in $ or $$.',
          },
          displayMode: {
            type: Type.STRING,
            enum: ['display', 'inline'],
            description: '"display" for centered block, "inline" for flow.',
          },
          caption: { type: Type.STRING, description: 'Optional caption below the expression.' },
        },
        required: ['insetType', 'expression', 'displayMode'],
      };

    case 'data-table':
      return {
        type: Type.OBJECT,
        properties: {
          ...baseProps,
          headers: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Column headers.',
          },
          rows: {
            type: Type.ARRAY,
            items: { type: Type.ARRAY, items: { type: Type.STRING } },
            description: '2D array of cell values.',
          },
          caption: { type: Type.STRING, description: 'Optional table caption.' },
        },
        required: ['insetType', 'headers', 'rows'],
      };

    case 'passage':
      return {
        type: Type.OBJECT,
        properties: {
          ...baseProps,
          text: { type: Type.STRING, description: 'Passage text. Use \\n for line breaks.' },
          format: {
            type: Type.STRING,
            enum: ['prose', 'poem', 'quote', 'letter', 'source'],
            description: 'Typography style.',
          },
          attribution: { type: Type.STRING, description: 'Author/source attribution.' },
        },
        required: ['insetType', 'text', 'format'],
      };

    case 'chart':
      return {
        type: Type.OBJECT,
        properties: {
          ...baseProps,
          chartType: { type: Type.STRING, enum: ['bar', 'line', 'pie'] },
          title: { type: Type.STRING, description: 'Chart title.' },
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
            description: '3-8 data points.',
          },
        },
        required: ['insetType', 'chartType', 'title', 'data'],
      };

    case 'code':
      return {
        type: Type.OBJECT,
        properties: {
          ...baseProps,
          code: { type: Type.STRING, description: 'Source code content.' },
          language: { type: Type.STRING, description: 'e.g. python, javascript, java.' },
        },
        required: ['insetType', 'code', 'language'],
      };

    case 'number-line':
      return {
        type: Type.OBJECT,
        properties: {
          ...baseProps,
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
            description: 'Named points on the line.',
          },
        },
        required: ['insetType', 'min', 'max', 'ticks'],
      };

    case 'definition-box':
      return {
        type: Type.OBJECT,
        properties: {
          ...baseProps,
          term: { type: Type.STRING },
          definition: { type: Type.STRING },
          partOfSpeech: { type: Type.STRING },
          exampleSentence: { type: Type.STRING },
        },
        required: ['insetType', 'term', 'definition'],
      };
  }
}

// ── Author-prompt guidance per variant ───────────────────────────────

const INSET_GUIDANCE: Record<AuthorableInsetType, string> = {
  katex: `
## INSET: Mathematical Expression (KaTeX)
Author a LaTeX expression that the question depends on. The student must read or interpret the expression to solve. Use proper notation (\\frac, \\sqrt, ^{}, _{}, \\int, \\sum, Greek letters). The expression must be non-trivial — not just "x + 2".`,

  'data-table': `
## INSET: Data Table
Author a realistic data table (3-6 columns, 3-8 rows). The problem MUST require reading specific cells to solve — e.g. "from the table, find the row where X meets condition Y, then compute Z". Headers should be meaningful and the data should support a single unambiguous answer.`,

  passage: `
## INSET: Text Passage
Author a passage (2-4 paragraphs prose / 8-16 lines poetry / 1-3 paragraphs quote). The question MUST require comprehending the passage. Include attribution when appropriate. Use \\n for poetry line breaks.`,

  chart: `
## INSET: Chart Data
Author 3-8 data points for a bar/line/pie chart. The question MUST require interpreting the chart (compare bars, read a trend, compute a fraction-of-pie). Title and axis labels should be specific. Data should produce a clear pattern, not noise.`,

  code: `
## INSET: Code Block
Author a 5-20 line code snippet. The question MUST require tracing or understanding the code. Use realistic identifiers and proper indentation. For "find the bug" framings include exactly one subtle, realistic bug.`,

  'number-line': `
## INSET: Number Line
Author a number line with grade-appropriate range, tick marks, and labeled points. The question MUST require interpreting positions, distances, or intervals on the line. Match grade level (integers for elementary, fractions/decimals for middle school, signed reals for high school).`,

  'definition-box': `
## INSET: Definition Box
Author one vocabulary term with definition, part of speech, and example sentence. The question MUST require understanding the definition — not just recognizing the word.`,
};

export function buildInsetPromptGuidance(insetType: AuthorableInsetType): string {
  return (
    INSET_GUIDANCE[insetType] +
    `

CRITICAL: The inset and the problem statement are ONE coherent unit.
- The problem must be UNANSWERABLE without reading the inset.
- The inset must contain exactly the data the problem references — no extra red herrings, no missing values.
- Generate them together; do not author the problem first and bolt an inset on.`
  );
}

// ── Plain-text serialization for downstream prompts ──────────────────

/**
 * Flatten an Inset object into a compact plain-text description that can be
 * pasted into any prompt as "the visual data the student is reading from."
 * Keep it dense — the judge doesn't need the on-screen rendering, just the
 * facts the inset contains.
 */
export function serializeInsetForPrompt(inset: Inset): string {
  const labelPrefix = inset.label ? `[${inset.label}] ` : '';

  switch (inset.insetType) {
    case 'katex':
      return `${labelPrefix}Equation (KaTeX): ${inset.expression}${
        inset.caption ? `  — ${inset.caption}` : ''
      }`;

    case 'data-table': {
      const header = inset.headers.join(' | ');
      const rows = inset.rows.map((r) => r.join(' | ')).join('\n  ');
      return `${labelPrefix}Data table${inset.caption ? ` "${inset.caption}"` : ''}:
  ${header}
  ${rows}`;
    }

    case 'passage':
      return `${labelPrefix}${inset.format} passage${
        inset.attribution ? ` (${inset.attribution})` : ''
      }:
"${inset.text}"`;

    case 'chart': {
      const points = inset.data
        .map((d) => `${d.label}=${d.value}${d.group ? ` [${d.group}]` : ''}`)
        .join(', ');
      const axes =
        inset.xLabel || inset.yLabel
          ? ` (x=${inset.xLabel ?? '?'}, y=${inset.yLabel ?? '?'})`
          : '';
      return `${labelPrefix}${inset.chartType} chart "${inset.title}"${axes}: ${points}`;
    }

    case 'code':
      return `${labelPrefix}${inset.language} code:
\`\`\`
${inset.code}
\`\`\``;

    case 'image':
      return `${labelPrefix}image: ${inset.altText}${
        inset.caption ? ` — ${inset.caption}` : ''
      }`;

    case 'number-line': {
      const ticks = inset.ticks.join(', ');
      const points = inset.points
        ? ` Points: ${inset.points.map((p) => `${p.label}@${p.value}`).join(', ')}.`
        : '';
      const region = inset.region
        ? ` Region: ${inset.region.from}..${inset.region.to}${
            inset.region.label ? ` (${inset.region.label})` : ''
          }.`
        : '';
      return `${labelPrefix}Number line [${inset.min}, ${inset.max}], ticks {${ticks}}.${points}${region}`;
    }

    case 'definition-box':
      return `${labelPrefix}Definition — ${inset.term}${
        inset.partOfSpeech ? ` (${inset.partOfSpeech})` : ''
      }: ${inset.definition}${
        inset.exampleSentence ? `  Example: "${inset.exampleSentence}"` : ''
      }`;
  }
}
