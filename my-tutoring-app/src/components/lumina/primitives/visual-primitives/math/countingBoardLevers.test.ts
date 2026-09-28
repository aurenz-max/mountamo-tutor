/**
 * The counting-board levers (handoff 21 M1): which lever answers which miss, and each lever's leak rule, held on
 * the saved generated payloads and on every small board the generator can draw.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { itemsFromChallenges, numberWordFor, type CountingItem } from './countingBoardDomain';
import { COUNT_LEVER, HANDS, HANDS_LEVER, LINE_LEVER, SMALLER_LEVER, TAGS_LEVER, countingBoardLevers, droppedHand,
  leverFacts, smallerGive, startLevers } from './countingBoardLevers';

const payload = (mode: string) => JSON.parse(readFileSync(join(process.cwd(),
  `src/components/lumina/components/live-activity/runtime/testing/w1-payloads/counting-board.${mode}.json`), 'utf-8')).data;
const saved = (mode: string) => { const d = payload(mode);
  return { items: itemsFromChallenges(d.challenges, { objectWord: d.objects.word ?? 'bears' }), challenges: d.challenges as { id: string; arrangement: string }[] }; };
const give = (target: number, count: number): CountingItem => itemsFromChallenges([{ id: 'g', type: 'give_me_n', count, targetAnswer: target }],
  { objectWord: 'bears' })[0];
const hand = (target: number): CountingItem => itemsFromChallenges([{ id: 'h', type: 'subitize_perceptual', count: target, targetAnswer: target }],
  { objectWord: 'bears' })[0];
const ids = (levers: { id: string }[]) => levers.map(l => l.id);

describe('which lever answers which miss (nextLever over the declared levers)', () => {
  it.each([
    ['one_short', COUNT_LEVER], ['one_over', COUNT_LEVER], ['gave_all', COUNT_LEVER],
    ['short_by_more', TAGS_LEVER], ['over_by_more', TAGS_LEVER], [undefined, COUNT_LEVER],
  ])('give_me_n, nothing pulled: after %s, %s', (miss, lever) => {
    expect(nextLever(countingBoardLevers(give(4, 8), [], 'scattered'), miss)).toBe(lever);
  });
  it('give_me_n, both counting aids already on (the easy tier): a lost count gets the row, then the easier ask', () => {
    const levers = countingBoardLevers(give(4, 8), [COUNT_LEVER, TAGS_LEVER], 'scattered');
    expect(nextLever(levers, 'short_by_more')).toBe(LINE_LEVER);
    expect(nextLever(countingBoardLevers(give(4, 8), [COUNT_LEVER, TAGS_LEVER, LINE_LEVER], 'scattered'), 'gave_all')).toBe(SMALLER_LEVER);
    expect(nextLever(levers, 'one_over', 'simplify')).toBe(SMALLER_LEVER);
  });
  it.each([
    [1, 'over_by_more', HANDS_LEVER], [3, 'short_by_more', HANDS_LEVER], [2, 'one_over', LINE_LEVER], [3, 'one_short', LINE_LEVER],
  ])('a hand match of %i, after %s: %s', (target, miss, lever) => {
    expect(nextLever(countingBoardLevers(hand(target), [], 'scattered'), miss)).toBe(lever);
  });
  it('spoken kinds declare no levers', () => {
    const count = itemsFromChallenges([{ id: 'c', type: 'count_all', count: 5, targetAnswer: 5 }], { objectWord: 'bears' })[0];
    expect(countingBoardLevers(count, [], 'scattered')).toEqual([]);
  });
});

describe('leak rules', () => {
  const boards = Array.from({ length: 5 }, (_, i) => i + 2).flatMap(target =>
    Array.from({ length: 6 }, (_, j) => give(target, target + 1 + j)));

  it.each(boards.map(b => [b.target, b.count, b] as const))('smaller_give on %i from %i: a new id, never the ask, at least 2, less than the pile', (_t, _c, item) => {
    const easier = smallerGive(item);
    if (item.target < 3) { expect(easier).toBeNull(); return; }
    expect(easier).toMatchObject({ kind: 'give_me_n', count: item.count, id: `${item.id}~smaller` });
    expect(easier!.target).not.toBe(item.target);
    expect(easier!.target).toBeGreaterThanOrEqual(2);
    expect(easier!.target).toBeLessThan(item.count);
    expect(ids(countingBoardLevers(item, [], 'scattered')).includes(SMALLER_LEVER)).toBe(!!easier);
  });

  it.each([1, 2, 3])('two_hands on a group of %i never takes the matching hand, and leaves two', target => {
    const dropped = droppedHand(hand(target));
    if (target === 2) { expect(dropped).toBeNull(); return; }
    expect(dropped).not.toBe(target);
    expect(HANDS.filter(h => h !== dropped)).toContain(target);
    expect(HANDS.filter(h => h !== dropped)).toHaveLength(2);
  });

  it('the row is not offered when the pile is already a row, or one object', () => {
    expect(ids(countingBoardLevers(give(4, 8), [], 'line'))).not.toContain(LINE_LEVER);
    expect(ids(countingBoardLevers(hand(1), [], 'scattered'))).not.toContain(LINE_LEVER);
  });

  it('the scene facts for every pulled lever name no number at all', () => {
    for (const item of [...boards, hand(1), hand(2), hand(3)]) {
      const facts = leverFacts(item, [COUNT_LEVER, TAGS_LEVER, LINE_LEVER, HANDS_LEVER, SMALLER_LEVER]);
      expect(facts).not.toMatch(/\d/);
      for (let n = 1; n <= 20; n++) expect(facts.toLowerCase()).not.toMatch(new RegExp(`\\b${numberWordFor(n)}\\b`));
    }
  });

  it('what each lever says it does names no number', () => {
    for (const item of [...boards, hand(1), hand(3)]) for (const l of countingBoardLevers(item, [], 'scattered'))
      // Pre-numeric hand matches carry no number word at all: the tutor repeats a lever's words (replay 09-28).
      expect(`${l.when} ${l.does}`).not.toMatch(item.kind === 'subitize_perceptual' ? /\d|\b(one|two|three)\b/i : /\d|\b(two|three|four|five|six)\b/i);
  });
});

describe('on the saved generated payloads', () => {
  it('give_me_n: the tier starts both counting aids pulled, and every item still has an open help lever or an easier ask', () => {
    const { items, challenges } = saved('give_me_n');
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      const start = startLevers(item, payload('give_me_n').showOptions);
      expect(start).toEqual([COUNT_LEVER, TAGS_LEVER]);
      const arrangement = challenges.find(c => c.id === item.id)!.arrangement;
      const open = countingBoardLevers(item, start, arrangement).filter(l => !l.pulled);
      expect(open.length, `${item.id} (${arrangement})`).toBeGreaterThan(0);
      const easier = smallerGive(item);
      if (easier) expect(easier.target).not.toBe(item.target);
    }
  });

  it('subitize_perceptual: every item offers a help lever, and none states the group', () => {
    const { items, challenges } = saved('subitize_perceptual');
    for (const item of items) {
      const levers = countingBoardLevers(item, [], challenges.find(c => c.id === item.id)!.arrangement);
      expect(levers.every(l => l.kind === 'help'), item.id).toBe(true);
      if (droppedHand(item) !== null) expect(droppedHand(item)).not.toBe(item.target);
    }
  });
});
