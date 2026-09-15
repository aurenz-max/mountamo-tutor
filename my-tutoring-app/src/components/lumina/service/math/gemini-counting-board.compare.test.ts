import { afterEach, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../geminiClient';
import { generateCountingBoard } from './gemini-counting-board';
import { countingBoardOracle } from '../qa/oracles/counting-board';
import { itemsFromChallenges } from '../../primitives/visual-primitives/math/countingBoardScript';

const ctxFor = (mode: string, raw: Record<string, unknown> = {}): GenerationContext => ({ componentId: 'counting-board', instanceId: 'test',
  topic: 'Counting to 20', grade: '1', gradeLevel: 'elementary', gradeContext: 'Grade 1', intent: 'Say how many are in the group with more',
  objective: { text: 'Compare two groups of objects.' }, scope: { topic: 'Counting' }, targetEvalMode: mode,
  raw: { targetEvalMode: mode, ...raw } } as GenerationContext);

/** The model's board answer, larger group first the way the prompt describes it; code owns the rest. */
async function generate(mode: string, seed: number, raw: Record<string, unknown> = {}, boards = 5) {
  const random = vi.spyOn(Math, 'random').mockImplementation(() => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; });
  vi.mocked(ai.models.generateContent).mockResolvedValue({ text: JSON.stringify({ title: 'More', description: 'Compare.', objects: { type: 'bears' },
    gradeBand: '1', showOptions: { showRunningCount: false, showGroupCircles: true, highlightOnTap: true, showLastNumber: true },
    challenges: Array.from({ length: boards }, (_, i) => ({ id: `c${i + 1}`, type: mode, instruction: 'Which group has more?', targetAnswer: 6,
      count: 10, arrangement: 'groups', groupSize: 6, hint: 'Count each group.', narration: 'Look at both groups.' })) }) } as never);
  try { return await generateCountingBoard(ctxFor(mode, raw)); } finally { random.mockRestore(); }
}
const oracle = (data: object) => countingBoardOracle.verify(data as Record<string, unknown>,
  { componentId: 'counting-board', evalMode: 'compare', topic: 'Counting to 20', gradeLevel: 'grade 1' }).violations;
afterEach(() => vi.clearAllMocks());

it('compare: the larger group is drawn on either side, balanced within each session, and every board stays askable (CNB-2)', async () => {
  const sessionsWithThreeFirst: number[] = [];
  for (let seed = 1; seed <= 40; seed++) {
    const data = await generate('compare', seed);
    const boards = data.challenges;
    expect(oracle(data)).toEqual([]);
    expect(itemsFromChallenges(boards, { objectWord: 'bears' })).toHaveLength(5);
    const sides = boards.map((c) => {
      const [a, b] = c.compareGroups!;
      expect([a + b, Math.max(a, b), a === b]).toEqual([c.count, c.targetAnswer, false]);
      return a > b;
    });
    const first = sides.filter(Boolean).length;
    expect([2, 3]).toContain(first);
    if (first === 3) sessionsWithThreeFirst.push(seed);
    // The side is not a function of the board's place in the session either.
    if (seed === 1) expect(new Set(sides.map(String)).size).toBe(2);
  }
  // The odd board goes to either side across sessions.
  expect(sessionsWithThreeFirst.length).toBeGreaterThan(10);
  expect(sessionsWithThreeFirst.length).toBeLessThan(30);
});

it('compare: a manifest groupSize or arrangement override does not rewrite the two groups or the key', async () => {
  const data = await generate('compare', 7, { groupSize: 3, arrangement: 'line' });
  expect(data.challenges.every((c) => c.arrangement === 'groups' && c.groupSize === c.targetAnswer)).toBe(true);
  expect(oracle(data)).toEqual([]);
});

it('compare: an empty model answer falls back to one drawn, askable board; other modes carry no compareGroups', async () => {
  const fallback = await generate('compare', 3, {}, 0);
  expect(fallback.challenges).toHaveLength(1);
  expect(itemsFromChallenges(fallback.challenges, { objectWord: 'bears' })).toHaveLength(1);
  const counted = await generate('count_all', 3);
  expect(counted.challenges.some((c) => c.compareGroups)).toBe(false);
});
