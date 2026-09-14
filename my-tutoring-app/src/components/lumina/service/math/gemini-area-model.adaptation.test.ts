import { afterEach, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import { generateAreaModel } from './gemini-area-model';
import { compiledEqualAreaContrast, compiledSameFactContrast } from './areaModelRemediation';
import { areaModelOracle } from '../qa/oracles/area-model';

const zeros = 'When a cell multiplies two place-value parts such as 30 and 40, the student multiplies only the leading digits and writes 12 or 120.';
const product = 'Asked for the perimeter of a rectangle, the student multiplies the length by the width.';
const ctx: GenerationContext = { componentId: 'area-model', instanceId: 'test', topic: 'Multiply two-digit numbers with an area model', grade: '4',
  gradeLevel: 'Grade 4', gradeContext: 'Grade 4', objective: {}, scope: { topic: 'Multiplication' }, raw: { targetEvalMode: 'find_area', difficulty: 'medium' } };
const isPlanner = (contents: unknown) => String(contents).startsWith('Select ONE');

async function generate(overrides: Partial<GenerationContext> = {}, seed = 42, move = 'contrast_same_fact_across_places') {
  const random = vi.spyOn(Math, 'random').mockImplementation(() => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; });
  vi.mocked(ai.models.generateContent).mockImplementation(async args => ({ text: JSON.stringify(isPlanner(args.contents)
    ? { move, observationIds: [JSON.parse(String(args.contents).split('DATA ONLY:\n')[1]).observations[0].id] }
    : { title: 'Area Model Practice', description: 'Split each factor into parts.', challengeType: String((overrides.raw ?? ctx.raw).targetEvalMode) }) } as never));
  try { return await generateAreaModel({ ...ctx, ...overrides }); } finally { random.mockRestore(); }
}
const plannerCalls = () => vi.mocked(ai.models.generateContent).mock.calls.filter(([a]) => isPlanner(a.contents));
const wrapperCalls = () => vi.mocked(ai.models.generateContent).mock.calls.filter(([a]) => !isPlanner(a.contents));
const oracle = (data: unknown, evalMode: string) => areaModelOracle.verify(data as Record<string, unknown>,
  { componentId: 'area-model', evalMode, topic: ctx.topic, gradeLevel: 'grade 4' }).violations;
afterEach(() => vi.clearAllMocks());

it('find_area: a baseline without the contrast gains one same-fact model; count, tier flags and other models hold', async () => {
  let seed = 1, baseline = await generate({}, seed);
  while (compiledSameFactContrast(baseline.challenges).count && seed < 60) baseline = await generate({}, ++seed);
  expect(compiledSameFactContrast(baseline.challenges).count).toBe(0);
  vi.clearAllMocks();
  const targeted = await generate({ remediationFocus: zeros }, seed);
  expect(plannerCalls()).toHaveLength(1);
  expect(targeted.learningAdaptation).toEqual({ move: 'contrast_same_fact_across_places', status: 'targeted', comparisonCount: 1 });
  expect(compiledSameFactContrast(targeted.challenges).targets).toEqual(['area-model-2']);
  expect(targeted.challenges).toHaveLength(5);
  expect(targeted.challenges.filter((_, i) => i !== 1)).toEqual(baseline.challenges.filter((_, i) => i !== 1));
  expect({ ...targeted.challenges[1], factor1Parts: 0, factor2Parts: 0 }).toEqual({ ...baseline.challenges[1], factor1Parts: 0, factor2Parts: 0 });
  expect({ ...targeted, challenges: undefined, learningAdaptation: undefined }).toEqual({ ...baseline, challenges: undefined, learningAdaptation: undefined });
  expect(oracle(targeted, 'find_area')).toEqual([]);
  expect(JSON.stringify(targeted)).not.toContain(zeros);
  expect(JSON.stringify(wrapperCalls())).not.toContain(zeros);
});

it('multiply and build_model execute the same move inside their own operand windows', async () => {
  for (const [mode, f1Len, f2Len] of [['multiply', 3, 2], ['build_model', 1, 2]] as const) {
    const data = await generate({ raw: { targetEvalMode: mode, difficulty: 'hard' }, remediationFocus: zeros }, 11);
    expect(['targeted', 'already-targeted']).toContain(data.learningAdaptation?.status);
    const contrast = data.challenges.find(c => compiledSameFactContrast([c]).count)!;
    expect([contrast.factor1Parts.length, contrast.factor2Parts.length]).toEqual([f1Len, f2Len]);
    expect(data.challenges.every(c => c.showCellEquations === false)).toBe(true);
    expect(oracle(data, mode)).toEqual([]);
  }
});

it('perimeter: two consecutive rectangles share an area with different perimeters', async () => {
  const raw = { targetEvalMode: 'perimeter', difficulty: 'medium' };
  let seed = 1, baseline = await generate({ raw }, seed);
  while (compiledEqualAreaContrast(baseline.challenges).count && seed < 60) baseline = await generate({ raw }, ++seed);
  const targeted = await generate({ raw, remediationFocus: product }, seed, 'contrast_equal_area_perimeters');
  expect(targeted.learningAdaptation).toMatchObject({ move: 'contrast_equal_area_perimeters', status: 'targeted', comparisonCount: 2 });
  expect(compiledEqualAreaContrast(targeted.challenges).count).toBe(2);
  expect(targeted.challenges).toHaveLength(baseline.challenges.length);
  expect(targeted.challenges.every(c => c.factor1Parts[0] !== c.factor2Parts[0] && [...c.factor1Parts, ...c.factor2Parts].every(s => s >= 5 && s <= 30))).toBe(true);
  expect(oracle(targeted, 'perimeter')).toEqual([]);
});

it('makes no planner call and no change without observations, in factor mode, or outside grades 3-5', async () => {
  const baseline = await generate();
  expect(baseline.learningAdaptation).toBeUndefined();
  for (const overrides of [{ remediationFocus: '' }, { learningObservations: [] }]) expect(await generate(overrides)).toEqual(baseline);
  const factorRaw = { targetEvalMode: 'factor', difficulty: 'medium' };
  expect(await generate({ raw: factorRaw, remediationFocus: zeros })).toEqual(await generate({ raw: factorRaw }));
  expect(await generate({ grade: '2', remediationFocus: zeros })).toEqual(await generate({ grade: '2' }));
  expect(plannerCalls()).toHaveLength(0);
});

it('keeps baseline content when the planner abstains or names a move from the other capability', async () => {
  const baseline = await generate();
  for (const move of ['abstain', 'contrast_equal_area_perimeters']) expect(await generate({ remediationFocus: zeros }, 42, move)).toEqual(baseline);
  expect(plannerCalls()).toHaveLength(2);
});

it('sends delivered observations with evidence to the planner only', async () => {
  const learningObservations = [{ id: 'observation-am1', summary: zeros, evidence: '{"phases":[{"phase":"cell","expected":"1200","observed":"Incorrect: entered 120"}]}' }];
  const data = await generate({ learningObservations }, 5);
  expect(JSON.stringify(plannerCalls())).toContain('observation-am1');
  expect(JSON.stringify(wrapperCalls())).not.toMatch(/observation-am1|leading digits/);
  expect(JSON.stringify(data)).not.toMatch(/observation-am1|leading digits|phases/);
  expect(data.learningAdaptation?.move).toBe('contrast_same_fact_across_places');
});
