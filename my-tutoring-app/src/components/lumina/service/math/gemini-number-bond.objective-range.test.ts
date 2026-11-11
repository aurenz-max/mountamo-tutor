/**
 * K bond window for number-bond (math-k audit 2026-11-10, "K caps below the
 * objective"): wholes to 5 is the K default, not a cap. A K lesson that names
 * "within 10" (OPS001-02-G) gets wholes up to 10; an explicit config.maxNumber
 * wins over the resolver (which then does not run); no named range keeps 5.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
vi.mock('../objectiveNumberWindow', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../objectiveNumberWindow')>()),
  resolveObjectiveRange: vi.fn(),
}));

import { ai } from '../geminiClient';
import { resolveObjectiveRange } from '../objectiveNumberWindow';
import { generateNumberBond } from './gemini-number-bond';

const generateContent = vi.mocked(ai.models.generateContent);
const resolver = vi.mocked(resolveObjectiveRange);

const ctx = (mode: string, raw: Record<string, unknown> = {}, grade = 'K'): GenerationContext => ({
  componentId: 'number-bond',
  instanceId: 'nb-range',
  topic: 'Related facts within 10',
  gradeLevel: 'kindergarten',
  gradeContext: grade === 'K' ? 'kindergarten students (ages 5-6)' : 'elementary students (grades 1-5)',
  grade,
  intent: 'Say related addition and subtraction facts within 10',
  objective: {},
  scope: { objectiveText: 'Related addition and subtraction facts within 10' } as GenerationContext['scope'],
  targetEvalMode: mode,
  raw: { targetEvalMode: mode, ...raw },
});

// The model returns maxNumber 5 (the K default it was taught) and a mix of wholes.
const bonds = (type: string, wholes: number[]) => ({
  text: JSON.stringify({
    title: 'Bonds', description: 'Bonds.', maxNumber: 5, showCounters: true, showEquation: false, gradeBand: 'K',
    challenges: wholes.map((w, i) => ({ id: `c${i + 1}`, type, instruction: `Look at ${w}.`, whole: w, part1: 1, part2: w - 1 })),
  }),
});

beforeEach(() => {
  generateContent.mockReset();
  resolver.mockReset();
});

describe('number-bond K objective window', () => {
  it('a K lesson naming "within 10" keeps wholes up to 10', async () => {
    resolver.mockResolvedValue({ min: 0, max: 10 });
    generateContent.mockResolvedValue(bonds('related-fact', [4, 7, 10]) as never);
    const data = await generateNumberBond(ctx('related_fact'));
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(resolver.mock.calls[0][0]).toMatchObject({ bandDefault: { min: 0, max: 5 }, capacity: { min: 0, max: 10 } });
    expect(data.maxNumber).toBe(10);
    expect(data.gradeBand).toBe('K');
    expect(data.challenges.map((c) => c.whole)).toEqual([4, 7, 10]);
    for (const c of data.challenges) {
      expect(c.part1! + c.part2!).toBe(c.whole);
      expect(c.part1).not.toBe(c.part2);
    }
    expect(String(generateContent.mock.calls[0][0].contents)).toContain('Max number: 10');
  });

  it('decompose at K within 10: all pairs of a whole of 9 are recomputed', async () => {
    resolver.mockResolvedValue({ min: 0, max: 10 });
    generateContent.mockResolvedValue(bonds('decompose', [6, 9, 10]) as never);
    const data = await generateNumberBond(ctx('decompose'));
    expect(data.challenges.map((c) => c.whole)).toEqual([6, 9, 10]);
    expect(data.challenges[1].allPairs).toEqual([[0, 9], [1, 8], [2, 7], [3, 6], [4, 5]]);
  });

  it('no named range keeps the K band of 5 (wholes clamp to 5)', async () => {
    resolver.mockResolvedValue(null);
    generateContent.mockResolvedValue(bonds('related-fact', [4, 9]) as never);
    const data = await generateNumberBond(ctx('related_fact'));
    expect(data.maxNumber).toBe(5);
    expect(data.challenges.map((c) => c.whole)).toEqual([4, 5]);
    expect(String(generateContent.mock.calls[0][0].contents)).not.toContain('Max number:');
  });

  it('an explicit maxNumber wins: no resolver call, K window 8', async () => {
    generateContent.mockResolvedValue(bonds('related-fact', [4, 9]) as never);
    const data = await generateNumberBond(ctx('related_fact', { maxNumber: 8 }));
    expect(resolver).not.toHaveBeenCalled();
    expect(data.maxNumber).toBe(8);
    expect(data.challenges.map((c) => c.whole)).toEqual([4, 8]);
  });

  it('Grade 1 and the teen mode never call the resolver', async () => {
    generateContent.mockResolvedValue(bonds('related-fact', [9]) as never);
    await generateNumberBond(ctx('related_fact', {}, '1'));
    generateContent.mockResolvedValue(bonds('ten-and-ones', [14]) as never);
    await generateNumberBond(ctx('ten_and_ones')).catch(() => undefined);
    expect(resolver).not.toHaveBeenCalled();
  });
});
