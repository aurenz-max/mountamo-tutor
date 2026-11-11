/**
 * counting-board K caps and gaps (math-k audit 2026-11-10): give_me_n reaches the teens when the objective names
 * them (COUNT001-02-D), group_count counts by 2s to 20 at K (COUNT001-02-F), name_numeral counts 0-10 with an empty
 * board (COUNT001-01-A), and recount_moved draws the set bigger or smaller after the move (COUNT001-02-C).
 * `resolveObjectiveRange` is mocked: these cases pin what the generator does with the window it returns.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationContext } from '../generation/generationContext';

vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
vi.mock('../objectiveNumberWindow', () => ({ resolveObjectiveRange: vi.fn() }));
vi.mock('../generation/adaptationStep', async (orig) => ({
  ...(await orig<typeof import('../generation/adaptationStep')>()),
  planAdaptation: vi.fn(async () => null),
}));

import { ai } from '../geminiClient';
import { resolveObjectiveRange } from '../objectiveNumberWindow';
import { generateCountingBoard } from './gemini-counting-board';
import { countingBoardItems } from '../../primitives/visual-primitives/math/countingBoard.boss';
import { countMiss, numeralOptions, itemFromChallenge, countingBoardHarnessAnswers } from '../../primitives/visual-primitives/math/countingBoardDomain';
import { countingBoardOracle } from '../qa/oracles/counting-board';
import type { CountingBoardChallenge } from '../../primitives/visual-primitives/math/CountingBoard';

const generateContent = vi.mocked(ai.models.generateContent);
const resolveRange = vi.mocked(resolveObjectiveRange);

function kContext(mode: string, topic: string, raw: Record<string, unknown> = {}): GenerationContext {
  return {
    componentId: 'counting-board', instanceId: 'cb', topic, gradeLevel: 'kindergarten', gradeContext: 'kindergarten students',
    grade: 'K', intent: topic, objective: { text: topic }, scope: { topic, intent: topic }, targetEvalMode: mode,
    raw: { targetEvalMode: mode, ...raw },
  } as GenerationContext;
}

const model = (type: string, n: number, count = 6) => ({
  text: JSON.stringify({
    title: 'Count', description: 'd', objects: { type: 'bears' }, gradeBand: 'K',
    showOptions: { showRunningCount: false, showGroupCircles: false, highlightOnTap: true, showLastNumber: true },
    challenges: Array.from({ length: n }, (_, i) => ({
      id: `c${i + 1}`, type, instruction: 'Count them!', targetAnswer: count, count, arrangement: 'scattered', hint: 'h', narration: 'n',
      ...(type === 'group_count' ? { groupSize: 3, arrangement: 'groups' } : {}),
    })),
  }),
}) as never;

const challengesOf = (data: { challenges: CountingBoardChallenge[] }) => data.challenges;

describe('give_me_n reads the objective window', () => {
  beforeEach(() => { generateContent.mockReset(); resolveRange.mockReset(); });

  it('"count out teens": every request is a teen, every pile is bigger and fits the board', async () => {
    resolveRange.mockResolvedValueOnce({ min: 11, max: 19 });
    generateContent.mockResolvedValueOnce(model('give_me_n', 5, 8));
    const data = await generateCountingBoard(kContext('give_me_n', 'Count out a requested quantity in the teens from a pile'));
    expect(resolveRange.mock.calls[0][0].bandDefault).toEqual({ min: 2, max: 6 });
    expect(resolveRange.mock.calls[0][0].capacity).toEqual({ min: 0, max: 20 });
    const cs = challengesOf(data);
    expect(new Set(cs.map((c) => c.targetAnswer)).size).toBe(cs.length);
    for (const c of cs) {
      expect(c.targetAnswer).toBeGreaterThanOrEqual(11);
      expect(c.count).toBeGreaterThan(c.targetAnswer);
      expect(c.count).toBeLessThanOrEqual(20);
    }
    expect(countingBoardItems(data)).toHaveLength(cs.length);
  });

  it('no window named: the 2-6 requests and the pile of at most 12 stand', async () => {
    resolveRange.mockResolvedValueOnce(null);
    generateContent.mockResolvedValueOnce(model('give_me_n', 5, 9));
    const cs = challengesOf(await generateCountingBoard(kContext('give_me_n', 'Giving a requested number of objects')));
    for (const c of cs) {
      expect(c.targetAnswer).toBeGreaterThanOrEqual(2);
      expect(c.targetAnswer).toBeLessThanOrEqual(6);
      expect(c.count).toBeLessThanOrEqual(12);
    }
  });
});

describe('group_count at K counts by the step the lesson names', () => {
  beforeEach(() => { generateContent.mockReset(); resolveRange.mockReset(); });

  it('"groups of 2 up to 20": groups of two, totals even, reaching the top half of the window', async () => {
    resolveRange.mockResolvedValueOnce({ min: 2, max: 20 });
    generateContent.mockResolvedValueOnce(model('group_count', 5));
    const cs = challengesOf(await generateCountingBoard(kContext('group', 'Count objects in groups of 2 up to 20')));
    for (const c of cs) {
      expect(c.groupSize).toBe(2);
      expect(c.count % 2).toBe(0);
      expect(c.count).toBeLessThanOrEqual(20);
      expect(c.targetAnswer).toBe(c.count);
    }
    expect(Math.max(...cs.map((c) => c.count))).toBeGreaterThanOrEqual(14);
    expect(new Set(cs.map((c) => c.count)).size).toBe(cs.length);
  });

  it('explicit config.groupSize wins over the named step', async () => {
    resolveRange.mockResolvedValueOnce({ min: 2, max: 20 });
    generateContent.mockResolvedValueOnce(model('group_count', 3));
    const cs = challengesOf(await generateCountingBoard(kContext('group', 'Count by 2s to 20', { groupSize: 5 })));
    for (const c of cs) expect(c.groupSize).toBe(5);
  });

  it('no step named: the 2-3 groups of 2-5 stand', async () => {
    resolveRange.mockResolvedValueOnce(null);
    generateContent.mockResolvedValueOnce(model('group_count', 3));
    const cs = challengesOf(await generateCountingBoard(kContext('group', 'Count objects in groups')));
    for (const c of cs) {
      expect(c.groupSize).toBe(3);
      expect([6, 9]).toContain(c.count);
    }
  });
});

describe('name_numeral (COUNT001-01-A)', () => {
  beforeEach(() => { generateContent.mockReset(); resolveRange.mockReset(); });

  it('distinct counts 0-10 with one empty board, keyed by count, no number in the ask, oracle clean', async () => {
    resolveRange.mockResolvedValueOnce(null);
    generateContent.mockResolvedValueOnce(model('name_numeral', 6, 4));
    const data = await generateCountingBoard(kContext('name_numeral', 'Count and recognize numbers 0-10'));
    const cs = challengesOf(data);
    expect(cs).toHaveLength(6);
    expect(cs.some((c) => c.count === 0)).toBe(true);
    expect(new Set(cs.map((c) => c.count)).size).toBe(6);
    for (const c of cs) {
      expect(c.type).toBe('name_numeral');
      expect(c.targetAnswer).toBe(c.count);
      expect(c.count).toBeLessThanOrEqual(10);
      expect(c.instruction).not.toMatch(/\d/);
      // Code writes the text, the same on every board, so nothing tells the empty one apart or names a count.
      expect([c.hint, c.narration].join(' ')).not.toMatch(/\d|\b(one|two|three|four|five|six|seven|eight|nine|ten|empty)\b/i);
    }
    expect(new Set(cs.map((c) => c.hint)).size).toBe(1);
    expect(countingBoardItems(data)).toHaveLength(6);
    const oracle = countingBoardOracle.verify(data as never, { topic: 'Count and recognize numbers 0-10' } as never);
    expect(oracle.violations.filter((v) => v.check !== 'clustering')).toEqual([]);
  });

  it('a window named inside 0-10 bounds the counts', async () => {
    resolveRange.mockResolvedValueOnce({ min: 0, max: 5 });
    generateContent.mockResolvedValueOnce(model('name_numeral', 6, 4));
    const cs = challengesOf(await generateCountingBoard(kContext('name_numeral', 'Count sets of 0 to 5 and match a numeral')));
    for (const c of cs) expect(c.count).toBeLessThanOrEqual(5);
    expect(cs.some((c) => c.count === 0)).toBe(true);
  });

  it('the cards: four, 0-10, the answer and both neighbours, the answer not always in one slot', () => {
    const slots = new Set<number>();
    for (let t = 0; t <= 10; t++) {
      const cards = numeralOptions({ id: `n${t}`, target: t });
      expect(cards).toHaveLength(4);
      expect(new Set(cards).size).toBe(4);
      expect(cards).toContain(t);
      if (t > 0) expect(cards).toContain(t - 1);
      if (t < 10) expect(cards).toContain(t + 1);
      for (const n of cards) expect(n >= 0 && n <= 10).toBe(true);
      slots.add(cards.indexOf(t));
    }
    expect(slots.size).toBeGreaterThan(1);
  });

  it('the item gate takes an empty board and refuses a set past ten; a wrong card is an off-by miss', () => {
    const opts = { objectWord: 'bears' };
    const zero = itemFromChallenge({ id: 'z', type: 'name_numeral', count: 0, targetAnswer: 0 }, opts);
    expect(zero).toMatchObject({ target: 0, answerKind: 'gesture' });
    expect(itemFromChallenge({ id: 'b', type: 'name_numeral', count: 11, targetAnswer: 11 }, opts)).toBeNull();
    expect(countMiss(zero, 1)).toBe('one_over');
    expect(countMiss(zero, 3)).toBe('over_by_more');
    const wrong = countingBoardHarnessAnswers(zero!).placed!.wrong;
    expect(numeralOptions(zero!)).toContain(wrong);
  });
});

describe('recount_moved varies size (COUNT001-02-C)', () => {
  beforeEach(() => { generateContent.mockReset(); resolveRange.mockReset(); });

  it('every board changes size after its move, both ways across the session, and the ask says nothing about it', async () => {
    generateContent.mockResolvedValueOnce(model('recount_moved', 5, 6));
    const data = await generateCountingBoard(kContext('recount_moved', 'Counting conservation with objects of different sizes'));
    const cs = challengesOf(data);
    expect(resolveRange).not.toHaveBeenCalled();
    for (const c of cs) {
      expect(['bigger', 'smaller']).toContain(c.sizeChange);
      expect(c.instruction).not.toMatch(/big|small|size/i);
    }
    expect(new Set(cs.map((c) => c.sizeChange)).size).toBe(2);
    expect(countingBoardItems(data).every((i) => i.sizeChange === 'bigger' || i.sizeChange === 'smaller')).toBe(true);
  });
});
