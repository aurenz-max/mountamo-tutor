import { afterEach, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import { generateTenFrame } from './gemini-ten-frame';
import { compiledSameFirstContrast } from './tenFrameRemediation';
import { itemsFromChallenges } from '../../primitives/visual-primitives/math/tenFrameScript';

const repeatsStart = 'On take-away items the student answers with the starting number instead of how many are left.';
const ctxFor = (mode: string, grade = 'K'): GenerationContext => ({ componentId: 'ten-frame', instanceId: 'test', topic: 'Subtraction within 10', grade,
  gradeLevel: grade === 'K' ? 'kindergarten' : 'elementary', gradeContext: grade === 'K' ? 'Kindergarten' : 'Grade 1', intent: 'Take away on the ten frame',
  objective: { text: 'Model and solve subtraction problems within 10 using ten frames and number lines' }, scope: { topic: 'Subtraction' },
  targetEvalMode: mode, supportTier: 'medium', raw: { targetEvalMode: mode, difficulty: 'medium' } } as GenerationContext);
const isPlanner = (contents: unknown) => String(contents).startsWith('Select ONE');
const observation = (id = 'observation-tf1') => [{ id, summary: repeatsStart, evidence: '{"phases":[{"phase":"operate","expected":"four (4) left","observed":"Said \\"seven\\"."}]}' }];
/** What flash-lite returned for these objectives (real draws, 2026-09-14). */
const MODEL: Record<string, object[]> = {
  K: [[5, 2], [6, 2], [7, 5], [8, 3], [9, 5]].map(([s, r], i) => ({ id: `c${i + 1}`, type: 'subtract', startCount: s, targetCount: s - r, hint: `Take ${r} away.`, narration: 'n' })),
  '1': [['add', 8, 3], ['add', 7, 6], ['add', 9, 6], ['subtract', 12, 6], ['subtract', 15, 8]].map(([type, a, b], i) => (type === 'add'
    ? { id: `c${i + 1}`, type, addend1: a, addend2: b, targetCount: (a as number) + (b as number), hint: 'h', narration: 'n' }
    : { id: `c${i + 1}`, type, startCount: a, targetCount: (a as number) - (b as number), hint: 'h', narration: 'n' })),
  make_ten: [8, 7, 5, 9, 6, 4, 3].map((n, i) => ({ id: `c${i + 1}`, type: 'make_ten', targetCount: n, hint: 'h', narration: 'n' })),
};

async function generate(mode: string, overrides: Partial<GenerationContext> = {}, seed = 42, move = 'contrast_same_first_number_different_second') {
  const random = vi.spyOn(Math, 'random').mockImplementation(() => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; });
  const grade = overrides.grade ?? 'K';
  vi.mocked(ai.models.generateContent).mockImplementation(async args => ({ text: JSON.stringify(isPlanner(args.contents)
    ? { move, observationIds: [JSON.parse(String(args.contents).split('DATA ONLY:\n')[1]).observations[0].id] }
    : { title: 'Ten frame', description: 'd', mode: grade === 'K' ? 'single' : 'double', gradeBand: grade === 'K' ? 'K' : '1-2',
      counters: { count: 0, color: 'red', positions: [] }, showOptions: { showCount: false, showEquation: true, showEmptyCount: false, allowFlip: false },
      challenges: MODEL[mode === 'make_ten' ? 'make_ten' : grade] }) } as never));
  try { return await generateTenFrame({ ...ctxFor(mode, grade), ...overrides }); } finally { random.mockRestore(); }
}
const plannerCalls = () => vi.mocked(ai.models.generateContent).mock.calls.filter(([a]) => isPlanner(a.contents));
const otherCalls = () => vi.mocked(ai.models.generateContent).mock.calls.filter(([a]) => !isPlanner(a.contents));
const capacityOf = (data: { mode: string }) => (data.mode === 'double' ? 20 : 10);
afterEach(() => vi.clearAllMocks());

it('K subtraction: a baseline without the contrast gains one; other items, ids, instruction text and the key hold', async () => {
  const baseline = await generate('operate');
  expect(compiledSameFirstContrast(baseline.challenges, 10).count).toBe(0);
  vi.clearAllMocks();
  const targeted = await generate('operate', { learningObservations: observation() });
  expect(plannerCalls()).toHaveLength(1);
  expect(targeted.learningAdaptation).toEqual({ move: 'contrast_same_first_number_different_second', status: 'targeted', comparisonCount: 2 });
  const changed = targeted.challenges.map((c, i) => (JSON.stringify(c) === JSON.stringify(baseline.challenges[i]) ? -1 : i)).filter(i => i >= 0);
  expect(changed).toHaveLength(1);
  const c = targeted.challenges[changed[0]];
  const prev = targeted.challenges[changed[0] - 1];
  expect(c.startCount).toBe(prev.startCount);
  expect(c.instruction).toBe(`The frame starts with ${c.startCount} counters. Take away ${c.startCount! - c.targetCount}. How many are left?`);
  expect([c.hint, c.narration]).toEqual(['Take the counters off one at a time.', "Let's take some away on the ten frame."]);
  expect(targeted.challenges.map(x => x.id)).toEqual(baseline.challenges.map(x => x.id));
  expect(itemsFromChallenges(targeted.challenges, { capacity: 10, band: 'K' })).toHaveLength(5);
  expect({ ...targeted, challenges: undefined, learningAdaptation: undefined }).toEqual({ ...baseline, challenges: undefined, learningAdaptation: undefined });
  expect(JSON.stringify(targeted)).not.toMatch(/observation-tf1|starting number instead/);
  expect(JSON.stringify(otherCalls())).not.toMatch(/observation-tf1|starting number instead/);
});

it('K and Grade 1 across seeds: the compiled contrast is present, within the session bounds, every item askable', async () => {
  for (const grade of ['K', '1']) {
    const statuses: string[] = [];
    const baseline = await generate('operate', { grade });
    for (let seed = 1; seed <= 20; seed++) {
      const data = await generate('operate', { grade, learningObservations: observation() }, seed);
      statuses.push(data.learningAdaptation!.status);
      expect(compiledSameFirstContrast(data.challenges, capacityOf(data)).count).toBeGreaterThan(0);
      expect(data.challenges.map(x => x.type)).toEqual(baseline.challenges.map(x => x.type));
      expect(Math.max(...data.challenges.map(x => x.targetCount))).toBeLessThanOrEqual(Math.max(...baseline.challenges.map(x => x.targetCount)));
      expect(itemsFromChallenges(data.challenges, { capacity: capacityOf(data), band: grade === 'K' ? 'K' : '1-2' })).toHaveLength(5);
    }
    expect(statuses.filter(s => s === 'targeted').length, grade).toBe(20);
  }
});

it('abstain and a move the capability does not offer leave the baseline byte-identical', async () => {
  const baseline = await generate('operate');
  for (const move of ['abstain', 'contrast_same_start_different_change', 'count_on_exactly_one_more']) {
    expect(await generate('operate', { learningObservations: observation() }, 42, move)).toEqual(baseline);
  }
  expect(plannerCalls()).toHaveLength(3);
});

it('no planner call without observations, in make_ten, or above Grade 2', async () => {
  const baseline = await generate('operate');
  expect(baseline.learningAdaptation).toBeUndefined();
  expect(await generate('operate', { learningObservations: [] })).toEqual(baseline);
  const makeTen = { targetEvalMode: 'make_ten', raw: { targetEvalMode: 'make_ten', difficulty: 'medium' } };
  expect(await generate('make_ten', { grade: '1', ...makeTen, learningObservations: observation() })).toEqual(await generate('make_ten', { grade: '1', ...makeTen }));
  expect(await generate('operate', { grade: '3', learningObservations: observation() })).toEqual(await generate('operate', { grade: '3' }));
  expect(plannerCalls()).toHaveLength(0);
});
