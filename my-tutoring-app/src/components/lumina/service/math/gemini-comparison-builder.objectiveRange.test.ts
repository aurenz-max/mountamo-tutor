/**
 * K numerals follow the range the lesson names (math-k audit 2026-11-10, COUNT001-03-G "compare numbers
 * 11-20"). The K ceiling of 10 clamped every teen pair to 10 vs 10; a K lesson now reads its window
 * through resolveObjectiveRange, and a lesson that names none keeps 1-10.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
vi.mock('../objectiveNumberWindow', () => ({ resolveObjectiveRange: vi.fn() }));
vi.mock('../scopeRangeResolver', () => ({ resolveScopeRange: vi.fn(async () => null) }));

import { ai } from '../geminiClient';
import { resolveObjectiveRange } from '../objectiveNumberWindow';
import { generateComparisonBuilder } from './gemini-comparison-builder';

const generateContent = vi.mocked(ai.models.generateContent);
const objectiveRange = vi.mocked(resolveObjectiveRange);

function ctxFor(mode: 'compare_numbers' | 'order', difficulty?: string): GenerationContext {
  return {
    componentId: 'comparison-builder',
    instanceId: 'cb-objective-range',
    topic: 'Compare numbers 11-20',
    gradeLevel: 'kindergarten',
    gradeContext: 'kindergarten students',
    grade: 'K',
    intent: 'Compare two numbers between 11-20 using place value',
    objective: { text: 'Compare two numbers between 11-20 using place value understanding and visual models' },
    scope: { topic: 'Compare numbers 11-20', objectiveText: 'Compare two numbers between 11-20' } as GenerationContext['scope'],
    targetEvalMode: mode,
    raw: { targetEvalMode: mode, difficulty, gradeBand: 'K' },
  } as GenerationContext;
}

/** The model writes small numbers, as it did at K: 3 vs 5, 7 vs 2 ... */
function mockModel(type: 'compare-numbers' | 'order') {
  generateContent.mockImplementation(async () => ({
    text: JSON.stringify({
      title: 'Compare', description: 'Compare.', gradeBand: 'K',
      challenges: [[3, 5], [7, 2], [4, 4], [9, 1], [6, 8]].map(([a, b], i) => (type === 'compare-numbers'
        ? { id: `c${i + 1}`, type, instruction: 'Which number is bigger?', leftNumber: a, rightNumber: b, correctSymbol: '<' }
        : { id: `c${i + 1}`, type, instruction: 'Put the numbers in order.', numbers: [a, b, 5], direction: 'ascending' })),
    }),
  }) as never);
}

const pairs = (data: { challenges: { leftNumber?: number; rightNumber?: number }[] }) =>
  data.challenges.map((c) => [c.leftNumber!, c.rightNumber!]);

beforeEach(() => {
  generateContent.mockReset();
  objectiveRange.mockReset();
});

describe('comparison-builder K numerals follow the objective range', () => {
  for (const difficulty of [undefined, 'easy', 'hard']) {
    it(`compare_numbers, K lesson naming 11-20 (${difficulty ?? 'no tier'}): every pair in 11-20, keys from the pair`, async () => {
      objectiveRange.mockResolvedValue({ min: 11, max: 20 });
      mockModel('compare-numbers');
      const data = await generateComparisonBuilder(ctxFor('compare_numbers', difficulty));
      const ps = pairs(data as never);
      expect(ps.length).toBe(5);
      for (const [a, b] of ps) {
        expect(a).toBeGreaterThanOrEqual(11); expect(a).toBeLessThanOrEqual(20);
        expect(b).toBeGreaterThanOrEqual(11); expect(b).toBeLessThanOrEqual(20);
      }
      // Not the clamp collapse: the pairs are not all equal.
      expect(ps.filter(([a, b]) => a === b).length).toBeLessThanOrEqual(1);
      for (const c of data.challenges) {
        expect(c.correctSymbol).toBe(c.leftNumber! > c.rightNumber! ? '>' : c.leftNumber! < c.rightNumber! ? '<' : '=');
      }
      expect(objectiveRange).toHaveBeenCalledWith(expect.objectContaining({
        bandDefault: { min: 1, max: 10 }, capacity: { min: 1, max: 100 },
      }));
    });
  }

  it('compare_numbers, no scope (resolver null): pairs stay in 1-10, unchanged', async () => {
    objectiveRange.mockResolvedValue(null);
    mockModel('compare-numbers');
    const data = await generateComparisonBuilder(ctxFor('compare_numbers'));
    expect(pairs(data as never)).toEqual([[3, 5], [7, 2], [4, 4], [9, 1], [6, 8]]);
    const tiered = await generateComparisonBuilder(ctxFor('compare_numbers', 'medium'));
    for (const [a, b] of pairs(tiered as never)) expect(Math.max(a, b)).toBeLessThanOrEqual(10);
  });

  it('order, K lesson naming 11-20: every set in 11-20; no scope stays in 1-10', async () => {
    objectiveRange.mockResolvedValue({ min: 11, max: 20 });
    mockModel('order');
    const teen = await generateComparisonBuilder(ctxFor('order', 'easy'));
    for (const c of teen.challenges) for (const n of c.numbers!) { expect(n).toBeGreaterThanOrEqual(11); expect(n).toBeLessThanOrEqual(20); }
    objectiveRange.mockResolvedValue(null);
    const plain = await generateComparisonBuilder(ctxFor('order', 'easy'));
    for (const c of plain.challenges) for (const n of c.numbers!) expect(n).toBeLessThanOrEqual(10);
  });
});
