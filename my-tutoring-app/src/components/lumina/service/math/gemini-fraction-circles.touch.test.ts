import { beforeEach, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import { generateFractionCircles } from './gemini-fraction-circles';
const generate = vi.mocked(ai.models.generateContent);
const ctx = (pin: string): GenerationContext => ({ componentId: 'fraction-circles', instanceId: 'test', topic: 'Fractions', grade: '2', gradeLevel: 'elementary', gradeContext: 'Grade 2', objective: {}, scope: {} as GenerationContext['scope'], targetEvalMode: pin, raw: {} });
const response = (types: string[]) => ({ text: JSON.stringify({ title: 'Fractions', challenges: types.map((type, i) => ({ id: `f${i}`, type, numerator: 1, denominator: 4, compareFraction: { numerator: 1, denominator: 3 }, equivalentDenominator: 8, instruction: 'Generated text', hint: 'Look', narration: 'Look' })) }) }) as never;
beforeEach(() => vi.clearAllMocks());
it('pins the schema from canonical context and authors the spoken question from the numeric target', async () => {
  generate.mockResolvedValue(response(['touch_fraction']));
  const data = await generateFractionCircles(ctx('touch_fraction'));
  const schema = (generate.mock.calls[0][0].config!.responseSchema as any);
  expect(schema.properties.challenges.items.properties.type.enum).toEqual(['touch_fraction']);
  expect(data.challenges[0].instruction).toBe('Touch the picture showing one fourth.');
  expect(generate).toHaveBeenCalledTimes(1);
});
it('retries missing blend coverage with the same narrowed schema instead of silently omitting a task', async () => {
  generate.mockResolvedValueOnce(response(['build'])).mockResolvedValueOnce(response(['touch_fraction', 'build']));
  const data = await generateFractionCircles(ctx('touch_fraction|build'));
  expect(data.challenges.map(c => c.type)).toEqual(['touch_fraction', 'build']);
  expect(generate).toHaveBeenCalledTimes(2);
});
it('fails when both draws omit a required task', async () => {
  generate.mockResolvedValue(response(['build']));
  await expect(generateFractionCircles(ctx('touch_fraction|build'))).rejects.toThrow('required task types');
});
it('rejects unexpected modes even when required coverage is present', async () => {
  generate.mockResolvedValue(response(['touch_fraction', 'build']));
  await expect(generateFractionCircles(ctx('touch_fraction'))).rejects.toThrow('outside the resolved modes');
});

it('keeps mixed legacy wording synchronized with grade-legal diagram values', async () => {
  generate.mockResolvedValue(response(['touch_fraction', 'identify', 'build', 'compare', 'equivalent']));
  const data = await generateFractionCircles(ctx('mixed'));
  const compare = data.challenges.find(c => c.type === 'compare')!;
  const equivalent = data.challenges.find(c => c.type === 'equivalent')!;
  expect(compare.instruction).toBe('Compare 1/4 and 1/3. Which fraction is larger, or are they equal?');
  expect(equivalent.equivalentDenominator).toBeLessThanOrEqual(4);
  expect(equivalent.instruction).toContain(`using ${equivalent.equivalentDenominator} equal slices`);
  expect(data.challenges.every(c => c.narration === c.instruction)).toBe(true);
});
