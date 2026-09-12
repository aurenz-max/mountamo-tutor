import { afterEach, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import { generatePlaceValueChart } from './gemini-place-value';
import { compiledWorthContrast } from './placeValueRemediation';
import { placeValueChartOracle } from '../qa/oracles/place-value-chart';
const focus = 'The student gives the bare digit for its worth regardless of position.';
const ctx: GenerationContext = { componentId: 'place-value-chart', instanceId: 'test', topic: 'Place value in four-digit whole numbers', grade: '3', gradeLevel: 'Grade 3', gradeContext: 'Grade 3', objective: {}, scope: { topic: 'Place value' }, raw: { targetEvalMode: 'compare', difficulty: 'medium' } };
async function generate(remediationFocus?: string, overrides: Partial<GenerationContext> = {}) {
  let seed = 42;
  const random = vi.spyOn(Math, 'random').mockImplementation(() => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; });
  vi.mocked(ai.models.generateContent).mockResolvedValue({ text: JSON.stringify({ title: 'Place value', description: 'Say and write.', challengeType: 'compare' }) } as never);
  const data = await generatePlaceValueChart({ ...ctx, ...overrides, remediationFocus });
  const draws = random.mock.calls.length;
  random.mockRestore();
  return { data, draws };
}
afterEach(() => vi.restoreAllMocks());
it('freezes data and random draw parity for blank, unrelated, wrong grade and named anchors', async () => {
  const baseline = await generate();
  for (const text of ['', ' ', 'The student shifts the place value.']) expect(await generate(text)).toEqual(baseline);
  expect(await generate(focus, { grade: '2' })).toEqual(baseline);
  expect(await generate(focus, { intent: 'Use 2345 as the named number' })).toEqual(baseline);
  expect(await generate(focus, { objective: { text: 'Identify digit worth in three-digit numbers' } })).toEqual(baseline);
});
it('targets through the real generator and never sends private focus to wrapper or child', async () => {
  const { data } = await generate(focus);
  expect(compiledWorthContrast(data.challenges!).count).toBe(2);
  expect(JSON.stringify(data)).not.toMatch(/remediation|bare digit/);
  expect(JSON.stringify(vi.mocked(ai.models.generateContent).mock.calls)).not.toContain(focus);
  const result = placeValueChartOracle.verify(data as unknown as Record<string, unknown>, { componentId: 'place-value-chart', evalMode: 'compare', topic: ctx.topic, gradeLevel: 'Grade 3' });
  expect(result.checkedChallenges).toBe(3);
  expect(result.violations.filter(v => v.check === 'answer-key-desync')).toEqual([]);
});
