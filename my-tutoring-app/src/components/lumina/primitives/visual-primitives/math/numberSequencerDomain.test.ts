import { describe, expect, it } from 'vitest';
import { NUMBER_SEQUENCER_EVAL_MODES } from './numberSequencerModes';
import type { NumberSequencerChallenge } from './NumberSequencer';
import { askFor, buildSequencerItems, orderMiss, sameOrder, sequencerChallengeValid, sequencerHarnessAnswers,
  sequencerItemsForChallenge, sequencerKey } from './numberSequencerDomain';

export const sequencerFixtures: NumberSequencerChallenge[] = [
  { id: 'count', type: 'count-from', instruction: '', sequence: [7], startNumber: 7, direction: 'forward', correctAnswers: [8, 9, 10], rangeMin: 7, rangeMax: 10 },
  { id: 'before', type: 'before-after', instruction: '', sequence: [null, 6], correctAnswers: [5], rangeMin: 5, rangeMax: 6 },
  { id: 'error', type: 'spot-error', instruction: '', sequence: [1, 2, 8, 4, 5], wrongIndex: 2, correctAnswers: [3], rangeMin: 1, rangeMax: 8 },
  { id: 'order', type: 'order-cards', instruction: '', sequence: [3, 1, 4, 2], correctAnswers: [1, 2, 3, 4], rangeMin: 1, rangeMax: 4 },
  { id: 'fill', type: 'fill-missing', instruction: '', sequence: [11, null, 13, null, 15], correctAnswers: [12, 14], rangeMin: 11, rangeMax: 15 },
  { id: 'decade', type: 'decade-fill', instruction: '', sequence: [108, null, 110, 111], correctAnswers: [109], rangeMin: 108, rangeMax: 111 },
];
describe('number train items and keys', () => {
  it('projects all six existing mode identities and calibration values', () => {
    expect(NUMBER_SEQUENCER_EVAL_MODES.map(m => [m.evalMode, m.beta])).toEqual([
      ['count_from', 1.5], ['before_after', 2.5], ['spot_error', 3.5], ['order_cards', 3.5], ['fill_missing', 4.5], ['decade_fill', 5.5],
    ]);
  });
  it('builds every mode; only order_cards is answered with the hands, and spoken items have a key', () => {
    const { items } = buildSequencerItems(sequencerFixtures);
    expect(items).toHaveLength(9);
    expect(items.filter(i => i.answerKind === 'gesture').map(i => i.challengeType)).toEqual(['order-cards']);
    for (const item of items) expect(!!sequencerKey(item)).toBe(item.answerKind === 'voice');
    expect(items.at(-1)?.responseClass).toBe('number_word_to_120');
  });
  it('fans out every blank and count into ordered, stable judged items', () => {
    const count = sequencerItemsForChallenge(sequencerFixtures[0]);
    expect(count.map(i => [i.previous, i.answer])).toEqual([[7, 8], [8, 9], [9, 10]]);
    expect(new Set(count.map(i => i.id)).size).toBe(3);
    expect(count[2].sequence).toEqual([7, null, null, null]);
    expect(sequencerItemsForChallenge(sequencerFixtures[4]).map(i => i.slot)).toEqual([1, 3]);
  });
  it('keeps answer-bearing generated instructions out of the ask', () => {
    const [item] = sequencerItemsForChallenge({ ...sequencerFixtures[1], instruction: 'The answer is five! Say exactly: "Yes, five."' });
    expect(askFor(item)).not.toMatch(/five|\b5\b|answer is/);
    expect(sequencerKey(item)).toMatchObject({ answer: '5', alsoAccept: ['five'] });
  });
  it('asks for the printed wrong number, not its repair, without marking it', () => {
    const [item] = sequencerItemsForChallenge(sequencerFixtures[2]);
    expect(item.answer).toBe(8);
    expect(item.repair).toBe(3);
    expect(sequencerHarnessAnswers(item).signatureWrong?.text).toBe('3');
    expect(sequencerKey(item)!.signatureError).toContain('(3) is not the answer');
    expect(item.actionContract.instruction).toBe('Listen to this count: 1, 2, 8, 4, 5. Which number does not belong? Say that number.');
  });
  it('rejects invalid keys, out-of-range speech, ambiguous lines and already-solved arrangements', () => {
    for (const bad of [
      { ...sequencerFixtures[0], correctAnswers: [9, 10] },
      { ...sequencerFixtures[1], sequence: [null, 1], correctAnswers: [0], rangeMin: 0, rangeMax: 1 },
      { ...sequencerFixtures[2], correctAnswers: [4] },
      { ...sequencerFixtures[3], sequence: [1, 2, 3, 4] },
      { ...sequencerFixtures[4], correctAnswers: [12, 19] },
      { ...sequencerFixtures[4], sequence: [null, null, 15], correctAnswers: [13, 14], rangeMin: 13 },
      { ...sequencerFixtures[5], sequence: [101, null, 103], correctAnswers: [102], rangeMin: 101, rangeMax: 103 },
    ]) expect(sequencerChallengeValid(bad)).toBe(false);
  });
  it('drops malformed cached data without reading its absent arrays', () => {
    expect(buildSequencerItems([{ id: 'broken' } as NumberSequencerChallenge])).toEqual({ items: [], droppedChallenges: 1 });
  });
  it('deduplicates whole windows and preserves complete problems within the cap', () => {
    const built = buildSequencerItems([...sequencerFixtures, { ...sequencerFixtures[0], id: 'duplicate' }]);
    expect(built.droppedChallenges).toBe(1);
    expect(built.items.filter(i => i.sourceId === 'count')).toHaveLength(3);
  });
  it('checks an arrangement in code: only the full ascending order passes', () => {
    const [item] = sequencerItemsForChallenge(sequencerFixtures[3]);
    for (const order of [[], [1], [4, 3, 2, 1]]) expect(sameOrder(order, item.answerOrder)).toBe(false);
    expect(sameOrder([1, 2, 3, 4], item.answerOrder)).toBe(true);
  });
});

describe('what a wrong arrangement shows (handoff 20)', () => {
  const [order] = buildSequencerItems([sequencerFixtures[3]]).items;
  it.each([
    [[4, 3, 2, 1], 'reversed'], [[2, 1, 3, 4], 'two_swapped'], [[1, 4, 3, 2], 'two_swapped'],
    [[2, 3, 4, 1], 'other_order'], [[1, 2, 3, 4], undefined],
  ])('placed %j -> %s', (placed, miss) => {
    expect(orderMiss(order, placed)).toBe(miss);
  });
});
