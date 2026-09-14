import { afterEach, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import { generateFractionBar } from './gemini-fraction-bar';
import { compiledSharedDigitRoleContrast } from './fractionBarRemediation';
import { fractionBarOracle } from '../qa/oracles/fraction-bar';

const focus = 'The student swaps the roles of the two numbers in a fraction, choosing the bottom number as the shaded count.';
const ctx: GenerationContext = { componentId: 'fraction-bar', instanceId: 'test', topic: 'Building fractions on a bar', grade: '3',
  gradeLevel: 'Grade 3', gradeContext: 'Grade 3', objective: {}, scope: { topic: 'Fractions' }, raw: { targetEvalMode: 'build', difficulty: 'medium' } };
const isPlanner = (contents: unknown) => String(contents).startsWith('Select ONE');

async function generate(overrides: Partial<GenerationContext> = {}, seed = 42, move = 'contrast_shared_digit_roles') {
  const random = vi.spyOn(Math, 'random').mockImplementation(() => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; });
  vi.mocked(ai.models.generateContent).mockImplementation(async args => ({ text: JSON.stringify(isPlanner(args.contents)
    ? { move, observationIds: [JSON.parse(String(args.contents).split('DATA ONLY:\n')[1]).observations[0].id] }
    : { title: 'Building Fractions on a Bar', description: 'Shade parts to build each fraction.', challengeType: String((overrides.raw ?? ctx.raw).targetEvalMode) }) } as never));
  try { return await generateFractionBar({ ...ctx, ...overrides }); } finally { random.mockRestore(); }
}
const plannerCalls = () => vi.mocked(ai.models.generateContent).mock.calls.filter(([a]) => isPlanner(a.contents));
const wrapperCalls = () => vi.mocked(ai.models.generateContent).mock.calls.filter(([a]) => !isPlanner(a.contents));
afterEach(() => vi.clearAllMocks());

it('changes a baseline without the contrast into one with it, holding count, tier, window and answers', async () => {
  let seed = 1, baseline = await generate({}, seed);
  while (compiledSharedDigitRoleContrast(baseline.challenges).count === 2 && seed < 60) baseline = await generate({}, ++seed);
  expect(compiledSharedDigitRoleContrast(baseline.challenges).count).toBe(0);
  vi.clearAllMocks();
  const targeted = await generate({ remediationFocus: focus }, seed);
  expect(plannerCalls()).toHaveLength(1);
  expect(targeted.learningAdaptation).toEqual({ move: 'contrast_shared_digit_roles', status: 'targeted', comparisonCount: 2 });
  expect(compiledSharedDigitRoleContrast(targeted.challenges).count).toBe(2);
  expect(targeted.challenges).toHaveLength(baseline.challenges.length);
  expect({ ...targeted, challenges: undefined, learningAdaptation: undefined }).toEqual({ ...baseline, challenges: undefined, learningAdaptation: undefined });
  expect(fractionBarOracle.verify(targeted as unknown as Record<string, unknown>, { componentId: 'fraction-bar', evalMode: 'build', topic: ctx.topic, gradeLevel: 'grade 3' }).violations).toEqual([]);
  expect(JSON.stringify(targeted)).not.toContain(focus);
  expect(JSON.stringify(wrapperCalls())).not.toContain(focus);
});

it('makes no planner call and no change without observations or outside build', async () => {
  const baseline = await generate();
  expect(plannerCalls()).toHaveLength(0);
  expect(baseline.learningAdaptation).toBeUndefined();
  for (const overrides of [{ remediationFocus: '' }, { learningObservations: [] }]) expect(await generate(overrides)).toEqual(baseline);
  const identifyRaw = { targetEvalMode: 'identify', difficulty: 'medium' };
  const identify = await generate({ raw: identifyRaw });
  expect(await generate({ raw: identifyRaw, remediationFocus: focus })).toEqual(identify);
  expect(plannerCalls()).toHaveLength(0);
});

it('keeps baseline content when the planner abstains or returns an unknown move', async () => {
  const baseline = await generate();
  for (const move of ['abstain', 'contrast_digit_worth']) {
    expect(await generate({ remediationFocus: focus }, 42, move)).toEqual(baseline);
  }
  expect(plannerCalls()).toHaveLength(2);
});

it('sends delivered observations with evidence to the planner only', async () => {
  const learningObservations = [{ id: 'observation-abc', summary: focus, evidence: '{"phases":[{"phase":"numerator","expected":"3","observed":"4"}]}' }];
  const data = await generate({ learningObservations });
  expect(JSON.stringify(plannerCalls())).toContain('observation-abc');
  expect(JSON.stringify(wrapperCalls())).not.toMatch(/observation-abc|swaps the roles/);
  expect(JSON.stringify(data)).not.toMatch(/observation-abc|swaps the roles|phases/);
  expect(data.learningAdaptation?.move).toBe('contrast_shared_digit_roles');
});
