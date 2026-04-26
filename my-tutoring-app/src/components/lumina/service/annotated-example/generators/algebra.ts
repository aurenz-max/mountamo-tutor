/**
 * Algebra primitive — the default renderer.
 *
 * Renders a chain of from→to KaTeX transitions with operation labels.
 * Use for symbolic manipulation: simplify, factor, isolate, expand,
 * apply an inverse operation. The most general renderer; default fallback.
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../../geminiClient';
import { tryEvaluateKatex, patchResultString } from '../mathEvaluator';
import type { AlgebraStepContent, StepAnnotations } from '../../../primitives/annotated-example/types';
import {
  ANNOTATIONS_SCHEMA_FIELDS,
  ANNOTATIONS_REQUIRED,
  annotationPromptSuffix,
  buildStepContextPrefix,
  extractAnnotations,
  type PrimitiveDef,
  type StepGeneratorContext,
} from './_shared';

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

Write 1-3 algebraic transitions. Each transition has a "from" KaTeX expression, a "to" KaTeX expression, and an operation label.
Use proper KaTeX syntax (\\frac{}{}, \\sqrt{}, ^{}, etc.). The "result" is the final expression after all transitions.
IMPORTANT: Use the GROUNDING PROSE as your source of truth — extract the actual KaTeX expressions and operations from it; do not invent math.
IMPORTANT: Actually carry out the computation. Do NOT leave expressions unevaluated.${annotationPromptSuffix(ctx.pedagogicalGoal)}`,
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
      // Numerical correction — if both sides evaluate to pure numbers and the
      // LLM's answer disagrees with the computed value, patch the `to` side.
      const fromVal = tryEvaluateKatex(from);
      const toVal = tryEvaluateKatex(to);
      let correctedTo = to;
      if (fromVal != null && toVal != null) {
        const delta = Math.abs(fromVal - toVal);
        const rel = Math.abs(fromVal) > 1e-9 ? delta / Math.abs(fromVal) : delta;
        if (delta > 0.01 && rel > 0.005 && /\b(evaluate|compute|calculate|simplify)\b/i.test(op)) {
          const patched = patchResultString(to, fromVal);
          if (patched && patched !== to) {
            console.log(`[AnnotatedExample] Algebra transition ${i} corrected: "${to}" → "${patched}"`);
            correctedTo = patched;
          }
        }
      }
      transitions.push({ from: { latex: from }, to: { latex: correctedTo }, operation: op });
    }
  }

  let result: string = data.result;
  if (transitions.length > 0) {
    const lastTo = transitions[transitions.length - 1].to.latex;
    const lastVal = tryEvaluateKatex(lastTo);
    const resultVal = tryEvaluateKatex(result);
    if (lastVal != null && resultVal != null) {
      const delta = Math.abs(lastVal - resultVal);
      const rel = Math.abs(lastVal) > 1e-9 ? delta / Math.abs(lastVal) : delta;
      if (delta > 0.01 && rel > 0.005) {
        const patched = patchResultString(result, lastVal);
        if (patched && patched !== result) {
          console.log(`[AnnotatedExample] Algebra result corrected: "${result}" → "${patched}"`);
          result = patched;
        }
      }
    }
  }

  return {
    content: { type: 'algebra', transitions, result },
    annotations: extractAnnotations(data),
  };
}

export const algebraPrimitive: PrimitiveDef = {
  id: 'algebra',
  whenToUse:
    'Symbolic manipulation: simplify, factor, isolate, expand, apply an inverse operation. Renders as a chain of from→to transitions with operation labels. The default; use when nothing more specific fits.',
  generate: generateAlgebraStep,
  extractResult: (c) => (c.type === 'algebra' ? c.result : ''),
};
