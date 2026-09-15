import { afterEach, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import { generateCountingBoard } from './gemini-counting-board';
import { compiledOneMoreCountOn, compiledSameStartContrast } from './countingBoardRemediation';
import { countingBoardOracle } from '../qa/oracles/counting-board';
import { itemsFromChallenges } from '../../primitives/visual-primitives/math/countingBoardScript';

const before = 'On take-away boards the student says how many objects were on the board before any were taken away.';
const ctxFor = (mode: string, grade = 'K'): GenerationContext => ({ componentId: 'counting-board', instanceId: 'test', topic: 'Counting to 10', grade,
  gradeLevel: grade === 'K' ? 'kindergarten' : 'elementary', gradeContext: grade === 'K' ? 'Kindergarten' : 'Grade 1', intent: 'Count what is left after taking some away',
  objective: { text: 'Count backwards from 10 using concrete objects.' }, scope: { topic: 'Counting' }, targetEvalMode: mode, supportTier: 'medium',
  raw: { targetEvalMode: mode, difficulty: 'medium' } } as GenerationContext);
const isPlanner = (contents: unknown) => String(contents).startsWith('Select ONE');
const observation = (id = 'observation-cb1') => [{ id, summary: before, evidence: '{"phases":[{"phase":"take-away","expected":"four (4) left","observed":"Said \\"six\\"."}]}' }];
/** What flash-lite answers for the board: counts the model chose, one per challenge. */
const MODEL_COUNTS: Record<string, number[]> = { take_away: [5, 6, 8, 9, 10], add_more: [5, 6, 7, 8, 9], count_on: [8, 8, 8, 8, 8] };

async function generate(mode: string, overrides: Partial<GenerationContext> = {}, seed = 42, move = 'contrast_same_start_different_change') {
  const random = vi.spyOn(Math, 'random').mockImplementation(() => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; });
  vi.mocked(ai.models.generateContent).mockImplementation(async args => ({ text: JSON.stringify(isPlanner(args.contents)
    ? { move, observationIds: [JSON.parse(String(args.contents).split('DATA ONLY:\n')[1]).observations[0].id] }
    : { title: 'Counting', description: 'Count.', objects: { type: 'bears' }, gradeBand: 'K',
      showOptions: { showRunningCount: false, showGroupCircles: false, highlightOnTap: true, showLastNumber: true },
      challenges: MODEL_COUNTS[mode].map((count, i) => ({ id: `c${i + 1}`, type: mode, instruction: 'Count the bears!', targetAnswer: count, count,
        arrangement: 'scattered', hint: 'Touch each one.', narration: 'Let us count.' })) }) } as never));
  try { return await generateCountingBoard({ ...ctxFor(mode, overrides.grade), ...overrides }); } finally { random.mockRestore(); }
}
const plannerCalls = () => vi.mocked(ai.models.generateContent).mock.calls.filter(([a]) => isPlanner(a.contents));
const otherCalls = () => vi.mocked(ai.models.generateContent).mock.calls.filter(([a]) => !isPlanner(a.contents));
const oracle = (data: object, mode: string) => countingBoardOracle.verify(data as Record<string, unknown>,
  { componentId: 'counting-board', evalMode: mode, topic: 'Counting to 10', gradeLevel: 'kindergarten' }).violations;
afterEach(() => vi.clearAllMocks());

it('take_away: a baseline without the contrast gains one; other boards, ids, options and the answer key hold', async () => {
  const baseline = await generate('take_away');
  expect(compiledSameStartContrast(baseline.challenges).count).toBe(0);
  vi.clearAllMocks();
  const targeted = await generate('take_away', { learningObservations: observation() });
  expect(plannerCalls()).toHaveLength(1);
  expect(targeted.learningAdaptation).toEqual({ move: 'contrast_same_start_different_change', status: 'targeted', comparisonCount: 2 });
  const changed = targeted.challenges.map((c, i) => (JSON.stringify(c) === JSON.stringify(baseline.challenges[i]) ? -1 : i)).filter(i => i >= 0);
  expect(changed).toHaveLength(1);
  const c = targeted.challenges[changed[0]];
  expect(c.count).toBe(targeted.challenges[changed[0] - 1].count);
  expect(c.targetAnswer).toBe(c.count - c.changeBy!);
  expect(c.instruction).toMatch(new RegExp(`^Take away (one|two|three) bears\\. How many are left\\?$`));
  expect(targeted.challenges.map(x => x.id)).toEqual(baseline.challenges.map(x => x.id));
  expect(itemsFromChallenges(targeted.challenges, { objectWord: 'bears' })).toHaveLength(5);
  expect(oracle(targeted, 'take_away')).toEqual([]);
  expect({ ...targeted, challenges: undefined, learningAdaptation: undefined }).toEqual({ ...baseline, challenges: undefined, learningAdaptation: undefined });
  expect(JSON.stringify(targeted)).not.toMatch(/observation-cb1|before any were taken/);
  expect(JSON.stringify(otherCalls())).not.toMatch(/observation-cb1|before any were taken/);
});

it('add_more and count_on in both bands: the compiled contrast is present across seeds, within the bound, oracle clean', async () => {
  for (const [mode, move, compiled] of [
    ['add_more', 'contrast_same_start_different_change', compiledSameStartContrast],
    ['count_on', 'count_on_exactly_one_more', compiledOneMoreCountOn],
  ] as const) {
    for (const grade of ['K', '1']) {
      const statuses: string[] = [];
      for (let seed = 1; seed <= 20; seed++) {
        const data = await generate(mode, { grade, learningObservations: observation() }, seed, move);
        statuses.push(data.learningAdaptation!.status);
        expect(data.learningAdaptation!.move).toBe(move);
        expect(compiled(data.challenges).count).toBeGreaterThan(0);
        expect(Math.max(...data.challenges.map(x => x.targetAnswer))).toBeLessThanOrEqual(10);
        expect(itemsFromChallenges(data.challenges, { objectWord: 'bears' })).toHaveLength(5);
        expect(oracle(data, mode)).toEqual([]);
      }
      expect(statuses.filter(s => s === 'targeted').length, `${mode} ${grade}`).toBeGreaterThanOrEqual(18);
    }
  }
});

it('abstain and a move the capability does not offer leave the baseline byte-identical', async () => {
  const baseline = await generate('take_away');
  for (const move of ['abstain', 'contrast_same_fact_across_places', 'count_on_exactly_one_more']) {
    expect(await generate('take_away', { learningObservations: observation() }, 42, move)).toEqual(baseline);
  }
  expect(plannerCalls()).toHaveLength(3);
});

it('no planner call without observations, in an ineligible mode, or outside Kindergarten and Grade 1', async () => {
  const baseline = await generate('take_away');
  expect(baseline.learningAdaptation).toBeUndefined();
  expect(await generate('take_away', { learningObservations: [] })).toEqual(baseline);
  const count = { targetEvalMode: 'count', raw: { targetEvalMode: 'count', difficulty: 'medium' } };
  MODEL_COUNTS.count = [3, 4, 5, 6, 7, 8, 9];
  expect(await generate('count', { ...count, learningObservations: observation() })).toEqual(await generate('count', count));
  expect(await generate('take_away', { grade: '2', learningObservations: observation() })).toEqual(await generate('take_away', { grade: '2' }));
  expect(plannerCalls()).toHaveLength(0);
});
