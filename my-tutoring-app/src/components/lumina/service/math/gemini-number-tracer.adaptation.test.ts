import { afterEach, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import { generateNumberTracer } from './gemini-number-tracer';
import { compiledGapPositionContrast } from './numberTracerRemediation';

const gap = 'In counting runs such as 3, 4, ?, 6 the student writes the number after the last shown number instead of the hidden one.';
const ctx: GenerationContext = { componentId: 'number-tracer', instanceId: 'test', topic: 'Missing numbers to 10', grade: 'K',
  gradeLevel: 'Kindergarten', gradeContext: 'kindergarten', objective: { text: 'Find the missing number in a counting sequence to 10.' },
  scope: { topic: 'Counting' }, targetEvalMode: 'sequence', supportTier: 'medium', raw: { targetEvalMode: 'sequence', difficulty: 'medium' } } as GenerationContext;
const isPlanner = (contents: unknown) => String(contents).startsWith('Select ONE');
const observation = (id = 'observation-nt1') => [{ id, summary: gap, evidence: '{"phases":[{"phase":"sequence","expected":"5","observed":"Incorrect: the judge read the drawing as 7 (score 10)"}]}' }];

async function generate(overrides: Partial<GenerationContext> = {}, seed = 42, move = 'contrast_gap_positions_in_one_run') {
  const random = vi.spyOn(Math, 'random').mockImplementation(() => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; });
  vi.mocked(ai.models.generateContent).mockImplementation(async args => ({ text: JSON.stringify(isPlanner(args.contents)
    ? { move, observationIds: [JSON.parse(String(args.contents).split('DATA ONLY:\n')[1]).observations[0].id] }
    : String(args.contents).includes('rangeMin')
      ? { title: 'Missing Numbers', description: 'Find the hidden number.', rangeMin: 0, rangeMax: 9 }
      : { title: 'Trace', description: 'Trace numbers.', gradeBand: 'K', challenges: [{ id: 'c1', type: 'trace', digit: 4, showModel: false, showArrows: true }] }) } as never));
  try { return await generateNumberTracer({ ...ctx, ...overrides }); } finally { random.mockRestore(); }
}
const plannerCalls = () => vi.mocked(ai.models.generateContent).mock.calls.filter(([a]) => isPlanner(a.contents));
const otherCalls = () => vi.mocked(ai.models.generateContent).mock.calls.filter(([a]) => !isPlanner(a.contents));
/** Independent solve: every run counts up by one inside 0-9 and its answer is the hidden entry. */
const solvable = (data: Awaited<ReturnType<typeof generateNumberTracer>>) => data.challenges.every(c => c.type === 'sequence'
  && c.sequenceNumbers!.length === 4 && c.sequenceNumbers!.every((n, k, s) => n >= 0 && n <= 9 && (k === 0 || n === s[k - 1] + 1))
  && c.missingIndex! > 0 && c.missingIndex! < 3 && c.digit === c.sequenceNumbers![c.missingIndex!] && !c.showGhostDigit && !c.showStartDot);
afterEach(() => vi.clearAllMocks());

it('a baseline without the contrast gains one; count, ids, tier flags, distinct answers and other items hold', async () => {
  const baseline = await generate();
  expect(compiledGapPositionContrast(baseline.challenges).count).toBe(0);
  vi.clearAllMocks();
  const targeted = await generate({ learningObservations: observation() });
  expect(plannerCalls()).toHaveLength(1);
  expect(targeted.learningAdaptation).toEqual({ move: 'contrast_gap_positions_in_one_run', status: 'targeted', comparisonCount: 2 });
  const [first, second] = compiledGapPositionContrast(targeted.challenges).targets.map(id => targeted.challenges.findIndex(c => c.id === id));
  expect(second).toBe(first + 1);
  expect(targeted.challenges.filter((_, i) => i !== second)).toEqual(baseline.challenges.filter((_, i) => i !== second));
  expect(targeted.challenges.map(c => c.id)).toEqual(baseline.challenges.map(c => c.id));
  expect(new Set(targeted.challenges.map(c => c.digit)).size).toBe(5);
  expect(solvable(targeted)).toBe(true);
  expect({ ...targeted, challenges: undefined, learningAdaptation: undefined }).toEqual({ ...baseline, challenges: undefined, learningAdaptation: undefined });
  expect(JSON.stringify(targeted)).not.toMatch(/observation-nt1|last shown number/);
  expect(JSON.stringify(otherCalls())).not.toMatch(/observation-nt1|last shown number/);
});

it('the contrast holds across seeds and in a Grade 1 window', async () => {
  const statuses: string[] = [];
  for (let seed = 1; seed <= 30; seed++) {
    const data = await generate({ learningObservations: observation() }, seed);
    statuses.push(data.learningAdaptation!.status);
    expect(solvable(data)).toBe(true);
    if (data.learningAdaptation!.status !== 'insufficient-capacity') expect(compiledGapPositionContrast(data.challenges).count).toBeGreaterThan(0);
  }
  expect(statuses.filter(s => s === 'targeted').length).toBeGreaterThanOrEqual(28);
  const g1 = await generate({ grade: '1', learningObservations: observation() }, 7);
  expect(g1.learningAdaptation?.status).toBe('targeted');
});

it('abstain and a move the capability does not offer leave the baseline byte-identical', async () => {
  const baseline = await generate();
  for (const move of ['abstain', 'contrast_same_fact_across_places']) expect(await generate({ learningObservations: observation() }, 42, move)).toEqual(baseline);
  expect(plannerCalls()).toHaveLength(2);
});

it('no planner call without observations, in a handwriting mode, or outside Kindergarten and Grade 1', async () => {
  const baseline = await generate();
  expect(baseline.learningAdaptation).toBeUndefined();
  expect(await generate({ learningObservations: [] })).toEqual(baseline);
  const trace = { targetEvalMode: 'trace', raw: { targetEvalMode: 'trace', difficulty: 'medium' } };
  expect(await generate({ ...trace, learningObservations: observation() })).toEqual(await generate(trace));
  expect(await generate({ grade: '2', learningObservations: observation() })).toEqual(await generate({ grade: '2' }));
  expect(plannerCalls()).toHaveLength(0);
});
