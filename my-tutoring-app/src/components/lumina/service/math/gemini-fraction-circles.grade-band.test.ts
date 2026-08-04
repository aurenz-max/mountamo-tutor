/**
 * Grade-band resolution for fraction-circles — canonical `ctx.grade` first,
 * prose fallback (systemic 14m sweep).
 *
 * The defect shape: `resolveGradeBand()` tests gradeContext PROSE for
 * 'kinder'/'k-2'/'1st'/'2nd' — the production elementary sentence
 * ("elementary students (grades 1-5)") matches none, so Grade-1/2 lessons
 * landed the 3-5 band: a candidate pool with denominators up to 12, and a
 * gradeBand stamp left to the LLM. These tests pin:
 *   • the canonical mapper (K/1/2 → 'K-2', 3+ → '3-5', null without a grade),
 *   • the POOL wiring — a Grade-1 objective rolls K-2 denominators (≤4) into
 *     the prompt even under elementary prose (reverting the threading fails it),
 *   • the STAMP wiring — with a canonical grade, code overrides the LLM's
 *     gradeBand claim,
 *   • the legacy fallback — no canonical grade ⇒ prose path + LLM stamp kept.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import { generateFractionCircles, fractionCirclesGradeBandFromGrade } from './gemini-fraction-circles';

const generateContent = vi.mocked(ai.models.generateContent);

// The literal prose production sends for grades 1-5 (geminiService.getGradeLevelContext).
const ELEMENTARY_PROSE =
  'elementary students (grades 1-5) - Use age-appropriate vocabulary, concrete examples, structured learning objectives, and interactive elements. Build fundamental understanding.';

function contextFor(opts: { grade?: string }): GenerationContext {
  return {
    componentId: 'fraction-circles',
    instanceId: 'fraction-circles-test',
    topic: 'Understanding fractions',
    gradeLevel: 'elementary',
    gradeContext: ELEMENTARY_PROSE,
    grade: opts.grade,
    intent: undefined,
    objective: {},
    scope: {} as GenerationContext['scope'],
    targetEvalMode: undefined,
    raw: {},
  };
}

function mockChallenges(gradeBandStamp: string) {
  generateContent.mockResolvedValue({
    text: JSON.stringify({
      title: 'Fraction Fun',
      description: 'Explore fractions with circles.',
      gradeBand: gradeBandStamp,
      challenges: [
        {
          id: 'fc1', type: 'identify', instruction: 'What fraction is shaded?',
          denominator: 4, numerator: 2, hint: 'Count the shaded slices.',
          narration: 'Look at the circle.',
        },
      ],
    }),
  } as never);
}

/** Denominators offered in the prompt's "Candidate fractions: 1/2, 2/3, ..." line. */
function promptPoolDenominators(): number[] {
  const prompt = String((generateContent.mock.calls[0]?.[0] as { contents: string }).contents);
  const line = prompt.split('\n').find((l) => l.includes('Candidate fractions:')) ?? '';
  return Array.from(line.matchAll(/\d+\/(\d+)/g), (m) => Number(m[1]));
}

describe('fractionCirclesGradeBandFromGrade (canonical mapper)', () => {
  it('maps canonical grades onto the component bands', () => {
    expect(fractionCirclesGradeBandFromGrade('K')).toBe('K-2');
    expect(fractionCirclesGradeBandFromGrade('1')).toBe('K-2');
    expect(fractionCirclesGradeBandFromGrade('2')).toBe('K-2');
    expect(fractionCirclesGradeBandFromGrade('3')).toBe('3-5');
    expect(fractionCirclesGradeBandFromGrade('5')).toBe('3-5');
    expect(fractionCirclesGradeBandFromGrade('12')).toBe('3-5');
  });

  it('returns null when there is no canonical grade — the prose fallback must stay reachable', () => {
    expect(fractionCirclesGradeBandFromGrade(undefined)).toBeNull();
    expect(fractionCirclesGradeBandFromGrade('')).toBeNull();
    expect(fractionCirclesGradeBandFromGrade('not-a-grade')).toBeNull();
  });
});

describe('generateFractionCircles grade-band wiring', () => {
  beforeEach(() => {
    generateContent.mockReset();
  });

  it('a Grade-1 objective rolls a K-2 pool and stamps K-2, even under elementary prose', async () => {
    // Non-vacuity: elementary prose matches no K-2 marker, so without the
    // canonical threading the pool draws 3-5 denominators (up to 12) and the
    // LLM's 3-5 stamp survives — both assertions fail.
    mockChallenges('3-5');
    const data = await generateFractionCircles(contextFor({ grade: '1' }));
    expect(data.gradeBand).toBe('K-2');
    const dens = promptPoolDenominators();
    expect(dens.length).toBeGreaterThan(0);
    for (const d of dens) expect(d).toBeLessThanOrEqual(4);
  });

  it('a Grade-4 objective rolls the 3-5 pool and stamps 3-5', async () => {
    mockChallenges('K-2');
    const data = await generateFractionCircles(contextFor({ grade: '4' }));
    expect(data.gradeBand).toBe('3-5');
    const dens = promptPoolDenominators();
    expect(Math.max(...dens)).toBeGreaterThan(4); // 3-5 pool reaches past fourths
  });

  it('no canonical grade → prose fallback pool and the LLM stamp are unchanged (fallback kept)', async () => {
    mockChallenges('3-5');
    const data = await generateFractionCircles(contextFor({}));
    // Elementary prose matches no K-2 marker → legacy 3-5 pool + valid LLM stamp kept.
    expect(data.gradeBand).toBe('3-5');
    const dens = promptPoolDenominators();
    expect(Math.max(...dens)).toBeGreaterThan(4);
  });
});
