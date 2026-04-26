/**
 * Case split primitive — break into 2-3 cases by a condition.
 *
 * E.g. piecewise functions, sign of an expression, |x|>a → x>a OR x<-a.
 * Renders each case in parallel.
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../../geminiClient';
import type { CaseSplitStepContent, StepAnnotations } from '../../../primitives/annotated-example/types';
import {
  ANNOTATIONS_SCHEMA_FIELDS,
  ANNOTATIONS_REQUIRED,
  annotationPromptSuffix,
  buildStepContextPrefix,
  extractAnnotations,
  type PrimitiveDef,
  type StepGeneratorContext,
} from './_shared';

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

Split into 2-3 cases. Each case needs a label, condition, KaTeX work, and result.
Provide an overall result combining all cases.
IMPORTANT: Use the GROUNDING PROSE as your source of truth for the cases and their work.${annotationPromptSuffix(ctx.pedagogicalGoal)}`,
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

export const caseSplitPrimitive: PrimitiveDef = {
  id: 'case-split',
  whenToUse:
    'Break into 2-3 cases by a condition (e.g. piecewise, sign of an expression, |x|>a → x>a OR x<-a). Renders each case in parallel.',
  generate: generateCaseSplitStep,
  extractResult: (_c, explicit) => explicit ?? '',
};
