import { describe, expect, it } from 'vitest';
import { buildBondItems, numberBondPackBase } from '../numberBondScript';
import { expandSplitAndSay, moveBondCounter, prepareSplit, sortedPair, splitAndSayCue, splitAndSaySummary,
  splitAndSayVerdict, splitCounts, splitQuestion, validSplit, wholeCounters, type BondCounters } from '../numberBondSplit';
import { validateJudgedScriptPack } from '../../../../hooks/judgedScriptContract';
import type { JudgedRunSummary } from '../../../../hooks/useJudgedScriptRunner';

const itemsFor = (whole = 5, type = 'decompose') => expandSplitAndSay(buildBondItems([{ id: 'a', type, whole }], { band: '1', maxNumber: 10 }).items);
describe('split and say contract', () => {
  it('conserves counter identities through reversible whole/part moves', () => {
    const original = wholeCounters(5);
    const left = moveBondCounter(original, 2, 'left')!;
    const right = moveBondCounter(left, 2, 'right')!;
    expect(splitCounts(right)).toEqual({ whole: 4, left: 0, right: 1 });
    expect(moveBondCounter(right, 2, 'whole')).toEqual(original);
    expect(original).toEqual(wholeCounters(5));
    expect(moveBondCounter(right, 8, 'left')).toBeNull();
    expect(moveBondCounter(right, -1, 'left')).toBeNull();
    expect(moveBondCounter(right, 2, 'right')).toBeNull();
  });
  it('expands only the split modes and preserves the two distinct related-fact answers', () => {
    const original = buildBondItems([{ id: 'a', type: 'decompose', whole: 5 },
      { id: 'b', type: 'related-fact', whole: 5, part1: 2 }, { id: 'c', type: 'build-equation', whole: 5, part1: 2 }], { band: '1', maxNumber: 10 }).items;
    const items = expandSplitAndSay(original);
    expect(items.filter((i) => i.kind === 'decompose').map((i) => i.answerKind)).toEqual(['gesture', 'voice', 'gesture', 'voice', 'gesture', 'voice']);
    expect(items.filter((i) => i.kind === 'related-fact').map((i) => i.answer)).toEqual([3, 2]);
    expect(items.find((i) => i.kind === 'build-equation')?.answerKind).toBe('gesture');
  });
  it('uses one nonzero spoken answer for every supported split, including empty parts', () => {
    for (let whole = 2; whole <= 10; whole++) for (let left = 0; left <= whole; left++) {
      const item = itemsFor(whole)[1];
      const board: BondCounters = Array.from({ length: whole }, (_, i) => i < left ? 'left' : 'right');
      const question = splitQuestion(item, board);
      expect(question.answer).toBeGreaterThan(0); expect(question.answer).toBeLessThanOrEqual(20);
      expect(validSplit(item, board, [])).toBe(true);
      expect(validSplit(item, board, [sortedPair(board)])).toBe(false);
    }
  });
  it('requires a ten for teen tasks and asks for the ones on either side', () => {
    for (let whole = 11; whole <= 19; whole++) {
      const item = itemsFor(whole, 'ten-and-ones')[1];
      const board: BondCounters = Array.from({ length: whole }, (_, i) => i < 10 ? 'right' : 'left');
      expect(validSplit(item, board, [])).toBe(true);
      expect(splitQuestion(item, board)).toMatchObject({ answerSide: 'left', answer: whole - 10, ask: 'One ten and how many ones?' });
    }
    const wrong: BondCounters = [...Array(6).fill('left'), ...Array(8).fill('right')];
    expect(validSplit(itemsFor(14, 'ten-and-ones')[0], wrong, [])).toBe(false);
  });
  it('models an unused pair after a cap without accepting a duplicate, and attributes it', () => {
    const item = itemsFor()[1];
    const prepared = prepareSplit(item, wholeCounters(5), [[0, 5]]);
    expect(prepared.modeled).toBe(true); expect(sortedPair(prepared.counters)).toEqual([1, 4]);
    expect(splitAndSayCue(item, {}, wholeCounters(5), [[0, 5]], true)).toContain('I have shown a split');
    expect(splitAndSayVerdict(itemsFor()[0], prepared.counters, [])).not.toContain('four');
  });
  it('passes shared response gates and rejects echoes or unfinished speech', () => {
    const items = itemsFor();
    const board: BondCounters = ['left', 'left', 'right', 'right', 'right'];
    expect(validateJudgedScriptPack({ ...numberBondPackBase(items), itemCue: (item, opts) => splitAndSayCue(item, opts, board, []) })).toEqual([]);
    expect(splitAndSayCue(items[1], {}, board, [])).toContain('Private expected number: 3');
    expect(splitAndSayCue(items[1], {}, board, [])).toContain('Counting without a final answer is unfinished');
  });
  it('counts a construction and its spoken interpretation once, preserving a failed construction', () => {
    const items = itemsFor();
    const raw: JudgedRunSummary = { outcomes: items.map((item) => ({ id: item.id, solved: item.splitPhase === 'say',
      score: item.splitPhase === 'say' ? 100 : 0, corrections: item.splitPhase === 'say' ? 0 : 3, seconds: null })),
      accuracy: 50, passed: false, solvedCount: 3, firstTryCount: 3, attemptsCount: 15, hearTaps: 0, observations: [] };
    const result = splitAndSaySummary(items, raw);
    expect(result.outcomes).toHaveLength(3); expect(result.solvedCount).toBe(0); expect(result.accuracy).toBe(0);
    expect(result.outcomes[0].seconds).toBe(0);
  });
});
