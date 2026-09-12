import { Type, ThinkingLevel } from '@google/genai';
import { ai } from '../geminiClient';
import type { GeneratedStep, StepGeneratorContext } from './generators/_shared';

/** Semantic checks use the same thinking model as the solver/judge, not the
 * lightweight renderer. A review is supporting evidence, not a math oracle. */
export async function reviewStepContent(ctx: StepGeneratorContext, candidate: GeneratedStep): Promise<string[]> {
  const response = await ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: `Check this worked-example step independently against the problem and solved grounding.
Problem: ${ctx.problemStatement}
Reader: ${ctx.gradeContext}
Intended move: ${ctx.pedagogicalGoal}
Grounding: ${ctx.groundingProse}
Constraints: ${ctx.authoringGuidance || 'none'}
Candidate: ${JSON.stringify(candidate)}
Return only concrete errors in issues; an empty array means valid.
For EVERY table, check EVERY cell's meaning against its column header, source quantities, units, and row labels. Recompute arithmetic, sums, running totals, comparisons, signs, and substitutions independently. An added amount is not a cumulative amount. Check that all requested rows/groups are covered. Do not demand a running total for a comparison, sign chart, or other valid table.
For diagrams, structured visual is the actual figure: check bounds, jump start/direction/end, group counts, shaded fraction parts, and geometry against the source. Text/alt text cannot excuse an incorrect figure. The code derives dot counts and number-line landing positions from that data. Every group automatically receives its group-number label; scales and fractions also generate their own numeric labels. The legacy labels array may be empty because it is not needed for these structured visuals. Do not demand an image URL or a total label.
Check annotations and the result agree with the content. Do not flag harmless paraphrases, equivalent math, or style. Do not invent errors. Explain each concrete error sufficiently to regenerate this same move.`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      responseMimeType: 'application/json',
      responseSchema: { type: Type.OBJECT, properties: { issues: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['issues'] },
    },
  });
  const parsed = JSON.parse(response.text || '{}');
  if (!Array.isArray(parsed.issues) || !parsed.issues.every((s: unknown) => typeof s === 'string')) throw new Error('Malformed content review');
  return parsed.issues.filter((s: string) => s.trim());
}

export async function generateVerifiedStep(
  ctx: StepGeneratorContext,
  generate: (ctx: StepGeneratorContext) => Promise<GeneratedStep>,
): Promise<GeneratedStep> {
  const rejections: string[][] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    let issues: string[];
    try {
      const candidate = await generate({ ...ctx, repairFeedback: rejections.flat().join('\n') });
      issues = await reviewStepContent(ctx, candidate);
      if (!issues.length) return { ...candidate, generationReview: { attempts: attempt + 1, rejections } };
    } catch (error) {
      issues = [error instanceof Error ? error.message : String(error)];
    }
    rejections.push(issues);
    console.warn('[AnnotatedExample] Step rejected', { attempt: attempt + 1, issues });
  }
  // Never silently omit a required move or publish an unreviewed table/figure.
  throw new Error(`Worked step failed both validation attempts: ${rejections.flat().join('; ')}`);
}
