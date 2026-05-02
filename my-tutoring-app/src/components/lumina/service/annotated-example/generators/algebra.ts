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

// Up to 3 sub-moves per transition. Each sub-move documents one term-level
// micro-step inside an operation (e.g. one term of a multi-term power-rule
// integration). Flat fields keep flash-lite happy.
function subMoveSchemaFields(transIdx: number): Record<string, Schema> {
  const out: Record<string, Schema> = {};
  for (let s = 0; s < 3; s++) {
    out[`trans${transIdx}sub${s}From`] = { type: Type.STRING, description: `Sub-move ${s} input piece (KaTeX). Optional.`, nullable: true };
    out[`trans${transIdx}sub${s}To`] = { type: Type.STRING, description: `Sub-move ${s} output piece (KaTeX). Optional.`, nullable: true };
    out[`trans${transIdx}sub${s}Rule`] = { type: Type.STRING, description: `Sub-move ${s} short rule label, e.g. "power rule". Optional.`, nullable: true };
  }
  return out;
}

const ALGEBRA_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    trans0From: { type: Type.STRING, description: 'KaTeX: starting expression for transition 1' },
    trans0To: { type: Type.STRING, description: 'KaTeX: result after transition 1' },
    trans0Op: { type: Type.STRING, description: 'Operation label (e.g. "subtract 3 from both sides")' },
    ...subMoveSchemaFields(0),
    trans1From: { type: Type.STRING, description: 'KaTeX: starting expression for transition 2', nullable: true },
    trans1To: { type: Type.STRING, description: 'KaTeX: result after transition 2', nullable: true },
    trans1Op: { type: Type.STRING, nullable: true },
    ...subMoveSchemaFields(1),
    trans2From: { type: Type.STRING, nullable: true },
    trans2To: { type: Type.STRING, nullable: true },
    trans2Op: { type: Type.STRING, nullable: true },
    ...subMoveSchemaFields(2),
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
IMPORTANT: Actually carry out the computation. Do NOT leave expressions unevaluated.

## Per-term sub-moves (transNsub0..2 fields) + hover-link tokens

When a transition applies a NAMED RULE (power rule, chain rule, product rule,
quotient rule, integration by parts, distribute, expand) across MULTIPLE TERMS,
break the work into 1-3 per-term sub-moves so the student sees the mechanism,
not just the result.

- transNsubMfrom: KaTeX for the term/factor in "from" (e.g. "2x", "-x^2").
- transNsubMto:   KaTeX for the corresponding term in "to" (e.g. "x^2", "-\\frac{x^3}{3}").
- transNsubMrule: short rule label ("power rule", "product rule", "distribute").

CRITICAL — bidirectional hover linking. Whenever you populate sub-moves, you
MUST wrap the matching ranges INSIDE the parent transNFrom / transNTo with
\\htmlClass{lumina-tok lumina-tok-M}{...} where M is the sub-move index (0, 1,
or 2). The wrapped string in the parent must be the SAME KaTeX as transNsubMfrom
(or transNsubMto). This is what makes hovering a sub-move row highlight the
matching term in the big expression and vice versa — without it, the link
silently breaks. Use exactly the class name "lumina-tok lumina-tok-M".

Example — for transition $\\int(2x - x^2)\\,dx \\to [x^2 - \\tfrac{x^3}{3}]$:
  trans0From  = "\\\\int_0^2 (\\\\htmlClass{lumina-tok lumina-tok-0}{2x} \\\\htmlClass{lumina-tok lumina-tok-1}{- x^2})\\\\,dx"
  trans0To    = "[\\\\htmlClass{lumina-tok lumina-tok-0}{x^2} \\\\htmlClass{lumina-tok lumina-tok-1}{- \\\\frac{x^3}{3}}]_0^2"
  trans0sub0From="2x",     trans0sub0To="x^2",                trans0sub0Rule="power rule"
  trans0sub1From="- x^2",  trans0sub1To="- \\\\frac{x^3}{3}",   trans0sub1Rule="power rule"

LEAVE SUB-MOVES NULL — and emit transNFrom / transNTo as plain KaTeX with no
\\htmlClass wrappers — when the operation is a single mechanical step that has
no per-term breakdown ("subtract 3 from both sides", "evaluate at x=2",
"substitute u=...", "take the square root", "factor out 2"). For those, the
operation label alone is sufficient.${annotationPromptSuffix(ctx.pedagogicalGoal)}`,
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
      const subMoves: Array<{ from: string; to: string; rule: string }> = [];
      for (let s = 0; s < 3; s++) {
        const sf = data[`trans${i}sub${s}From`];
        const st = data[`trans${i}sub${s}To`];
        const sr = data[`trans${i}sub${s}Rule`];
        if (typeof sf === 'string' && sf && typeof st === 'string' && st && typeof sr === 'string' && sr) {
          subMoves.push({ from: sf, to: st, rule: sr });
        }
      }

      transitions.push({
        from: { latex: from },
        to: { latex: correctedTo },
        operation: op,
        ...(subMoves.length > 0 ? { subMoves } : {}),
      });
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
