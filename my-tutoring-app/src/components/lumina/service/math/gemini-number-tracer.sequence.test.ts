import { afterEach, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import { buildSequenceChallenges, generateNumberTracer } from './gemini-number-tracer';

afterEach(() => vi.clearAllMocks());
const seeded = (seed: number) => () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };

it('NT-8: missing numbers are distinct whenever the window has enough, and every item stays solvable in scope', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const items = buildSequenceChallenges(0, 9, 5, 9, seeded(seed));
    const answers = items.map(c => c.digit);
    expect(new Set(answers).size).toBe(5);
    for (const c of items) {
      expect(c.digit).toBe(c.sequenceNumbers![c.missingIndex!]);
      expect(c.missingIndex).toBeGreaterThan(0);
      expect(c.missingIndex).toBeLessThan(c.sequenceNumbers!.length - 1);
      expect(c.sequenceNumbers!.every((n, k, s) => n >= 0 && n <= 9 && (k === 0 || n === s[k - 1] + 1))).toBe(true);
    }
  }
});

it('a narrow window repeats answers only when it must, never on neighbouring items', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const answers = buildSequenceChallenges(1, 5, 5, 9, seeded(seed)).map(c => c.digit);
    // 1..5 in runs of 4 has interior answers 2, 3, 4 only.
    expect(new Set(answers)).toEqual(new Set([2, 3, 4]));
    expect(answers.every((a, i) => i === 0 || a !== answers[i - 1])).toBe(true);
  }
});

it('NT-7: sequence paints no guide for the missing number at any tier; trace keeps its withdrawal ladder', async () => {
  vi.mocked(ai.models.generateContent).mockResolvedValue({ text: JSON.stringify({ rangeMin: 0, rangeMax: 9, title: 'Missing numbers' }) } as never);
  const ctx = (mode: string, tier: 'easy' | 'medium' | 'hard'): GenerationContext => ({ componentId: 'number-tracer', instanceId: 't', topic: 'Counting to 10',
    grade: 'K', gradeLevel: 'Kindergarten', gradeContext: 'kindergarten', objective: {}, scope: { topic: 'Counting' }, targetEvalMode: mode, supportTier: tier,
    raw: { targetEvalMode: mode, difficulty: tier } } as GenerationContext);
  for (const tier of ['easy', 'medium', 'hard'] as const) {
    const data = await generateNumberTracer(ctx('sequence', tier));
    expect(data.challenges).toHaveLength(5);
    expect(data.challenges.every(c => !c.showGhostDigit && !c.showStartDot && !c.showStrokeArrows && c.supportTier === tier)).toBe(true);
  }
  vi.mocked(ai.models.generateContent).mockResolvedValue({ text: JSON.stringify({ title: 'Trace', description: 'd', gradeBand: 'K',
    challenges: [{ id: 'c1', type: 'trace', digit: 4, showModel: false, showArrows: true }] }) } as never);
  const easy = await generateNumberTracer(ctx('trace', 'easy'));
  expect(easy.challenges[0]).toMatchObject({ showGhostDigit: true, showStrokeArrows: true, showStartDot: true });
});
