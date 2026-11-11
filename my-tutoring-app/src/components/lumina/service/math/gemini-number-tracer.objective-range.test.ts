/**
 * K numeral window for number-tracer (math-k audit 2026-11-10, "K caps below the
 * objective"): 0-9 is the K default, not a cap. A K lesson that names 0-20
 * (COUNT001-01-B "write numerals 0-20") writes numerals up to 20; no named range
 * keeps 0-9; Grade 1 never calls the resolver.
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
import { generateNumberTracer, spreadNumerals } from './gemini-number-tracer';
import { getDigitPaths } from '../../primitives/visual-primitives/math/numberTracerPaths';

const generateContent = vi.mocked(ai.models.generateContent);
const resolver = vi.mocked(resolveObjectiveRange);

const ctx = (mode: string, grade = 'K', count = 5): GenerationContext => ({
  componentId: 'number-tracer',
  instanceId: 'nt-range',
  topic: 'Write numerals 0-20',
  gradeLevel: 'kindergarten',
  gradeContext: 'kindergarten students (ages 5-6)',
  grade,
  intent: 'Write numerals 0 to 20',
  objective: {},
  scope: { objectiveText: 'Write numerals 0-20' } as GenerationContext['scope'],
  targetEvalMode: mode,
  raw: { targetEvalMode: mode, challengeCount: count },
});

const handwriting = (digits: number[]) => ({
  text: JSON.stringify({
    title: 'Numbers', description: 'Write numbers.', gradeBand: 'K',
    challenges: digits.map((d, i) => ({ id: `c${i + 1}`, type: 'trace', digit: d, showModel: false, showArrows: true })),
  }),
});

beforeEach(() => {
  generateContent.mockReset();
  resolver.mockReset();
});

describe('number-tracer K objective window', () => {
  it('a K lesson naming 0-20 traces numerals up to 20, spread to the top', async () => {
    resolver.mockResolvedValue({ min: 0, max: 20 });
    generateContent.mockResolvedValue(handwriting([1, 2, 3, 4, 5]) as never);
    const data = await generateNumberTracer(ctx('trace'));
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(resolver.mock.calls[0][0]).toMatchObject({ bandDefault: { min: 0, max: 9 }, capacity: { min: 0, max: 20 } });
    const digits = data.challenges.map((c) => c.digit);
    expect(digits.every((d) => d >= 0 && d <= 20)).toBe(true);
    expect(Math.max(...digits)).toBeGreaterThanOrEqual(16);
    expect(digits.filter((d) => d >= 10).length).toBeGreaterThanOrEqual(2);
    expect(new Set(digits).size).toBe(digits.length);
    // The instruction names the code-owned numeral, and the canvas composes a two-digit path.
    for (const c of data.challenges) expect(c.instruction).toBe(`Trace the number ${c.digit}!`);
    const top = Math.max(...digits);
    expect(getDigitPaths(top).length).toBe(getDigitPaths(Math.floor(top / 10)).length + getDigitPaths(top % 10).length);
    // The prompt tells the model the lesson's range.
    expect(String(generateContent.mock.calls[0][0].contents)).toContain('this lesson names 0-20');
  });

  it('a named window fixes the numerals in the prompt; a hint written for another numeral is dropped', async () => {
    resolver.mockResolvedValue({ min: 0, max: 20 });
    generateContent.mockImplementation((async (req: { contents: string }) => {
      const asked = Array.from(String(req.contents).matchAll(/- c\d+: digit (\d+)/g), (m) => Number(m[1]));
      const digits = asked.map((d, i) => (i === 0 ? d + 1 : d)); // the model drifts on c1
      const res = JSON.parse(handwriting(digits).text);
      res.challenges.forEach((c: { hint: string; digit: number }) => { c.hint = `hint for ${c.digit}`; });
      return { text: JSON.stringify(res) };
    }) as never);
    const data = await generateNumberTracer(ctx('trace'));
    expect(data.challenges[0].hint).toBe('Start at the top!');
    for (const c of data.challenges.slice(1)) expect(c.hint).toBe(`hint for ${c.digit}`);
  });

  it('no named range keeps the K band 0-9 (digit 15 clamps to 9)', async () => {
    resolver.mockResolvedValue(null);
    generateContent.mockResolvedValue(handwriting([15, 3]) as never);
    const data = await generateNumberTracer(ctx('trace'));
    expect(data.challenges.map((c) => c.digit)).toEqual([9, 3]);
    expect(String(generateContent.mock.calls[0][0].contents)).toContain('Kindergarten (gradeBand "K"): digits 0-9');
  });

  it('sequence: a named K window builds runs inside it with no window call', async () => {
    resolver.mockResolvedValue({ min: 11, max: 20 });
    const data = await generateNumberTracer(ctx('sequence'));
    expect(generateContent).not.toHaveBeenCalled();
    const nums = data.challenges.flatMap((c) => c.sequenceNumbers ?? []);
    expect(nums.length).toBeGreaterThan(0);
    expect(nums.every((n) => n >= 11 && n <= 20)).toBe(true);
    for (const c of data.challenges) expect(c.digit).toBe(c.sequenceNumbers![c.missingIndex!]);
  });

  it('sequence: no named range keeps the K ceiling 9', async () => {
    resolver.mockResolvedValue(null);
    generateContent.mockResolvedValue({ text: JSON.stringify({ rangeMin: 0, rangeMax: 20 }) } as never);
    const data = await generateNumberTracer(ctx('sequence'));
    expect(data.challenges.flatMap((c) => c.sequenceNumbers ?? []).every((n) => n <= 9)).toBe(true);
  });

  it('Grade 1 never calls the resolver and keeps 0-20', async () => {
    generateContent.mockResolvedValue(handwriting([15]) as never);
    const data = await generateNumberTracer(ctx('trace', '1'));
    expect(resolver).not.toHaveBeenCalled();
    expect(data.challenges[0].digit).toBe(15);
  });

  it('spreadNumerals takes one numeral per slice, distinct, ascending', () => {
    const r = spreadNumerals(0, 20, 5, () => 0.999);
    expect(r).toEqual([3, 7, 11, 15, 20]);
    expect(spreadNumerals(0, 20, 5, () => 0)).toEqual([0, 4, 8, 12, 16]);
    expect(spreadNumerals(4, 5, 4)).toEqual([4, 5, 4, 5]);
  });
});
