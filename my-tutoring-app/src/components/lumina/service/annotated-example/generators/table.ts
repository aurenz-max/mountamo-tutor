/**
 * Table primitive — multiple parallel computations or structured comparison.
 *
 * Renders as a 2-4 column table. Use when the block computes the same thing
 * for several inputs (e.g. test points, sign analysis across intervals).
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../../geminiClient';
import type { TableStepContent, StepAnnotations } from '../../../primitives/annotated-example/types';
import {
  ANNOTATIONS_SCHEMA_FIELDS,
  ANNOTATIONS_REQUIRED,
  annotationPromptSuffix,
  buildStepContextPrefix,
  extractAnnotations,
  type PrimitiveDef,
  type StepGeneratorContext,
} from './_shared';

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

Create a structured table with 2-4 columns and 2-5 rows. Cells can use KaTeX (wrap in $...$).
Include a result field — the KaTeX expression summarizing what we learn from the table.
IMPORTANT: Use the GROUNDING PROSE as your source of truth for the values that fill the table.${annotationPromptSuffix(ctx.pedagogicalGoal)}`,
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

export const tablePrimitive: PrimitiveDef = {
  id: 'table',
  whenToUse:
    'Multiple parallel computations or a structured comparison. Renders as a 2-4 column table. Use when the block computes the same thing for several inputs (e.g. test points, sign analysis across intervals).',
  generate: generateTableStep,
  extractResult: (_c, explicit) => explicit ?? '',
};
