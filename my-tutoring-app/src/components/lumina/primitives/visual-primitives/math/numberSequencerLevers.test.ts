/**
 * The number-sequencer order_cards levers (handoff 21 M2): which lever answers which miss, and each lever's leak rule.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { orderMiss, sequencerItemsForChallenge, type SequencerItem } from './numberSequencerDomain';
import { MARKS_LEVER, STEPS_LEVER, THREE_LEVER, leverFacts, sequencerLevers, threeCards, trainSteps } from './numberSequencerLevers';

const cardsItem = (sequence: number[]): SequencerItem => {
  const correctAnswers = [...sequence].sort((a, b) => a - b);
  const item = sequencerItemsForChallenge({ id: `c${sequence.join('-')}`, type: 'order-cards', instruction: '', sequence, correctAnswers,
    rangeMin: correctAnswers[0], rangeMax: correctAnswers[correctAnswers.length - 1] })[0];
  if (!item) throw new Error(`fixture ${sequence} fails the build gates`);
  return item;
};

describe('which lever comes next', () => {
  const item = cardsItem([13, 14, 11, 12]);
  it.each([['reversed', STEPS_LEVER], ['two_swapped', MARKS_LEVER], ['other_order', MARKS_LEVER]])('after %s: %s', (miss, lever) => {
    expect(nextLever(sequencerLevers(item, []), miss)).toBe(lever);
  });
  it('after the marks, a swap opens the easier train; the check and the table agree', () => {
    expect(nextLever(sequencerLevers(item, [MARKS_LEVER]), 'two_swapped')).toBe(THREE_LEVER);
    expect(orderMiss(item, [14, 13, 12, 11])).toBe('reversed');
    for (const m of ['reversed', 'two_swapped', 'other_order']) expect(sequencerLevers(item, []).flatMap(l => l.answers ?? [])).toContain(m);
  });
  it('no marks over 100; no simplify on three cards already far apart; no levers on spoken items', () => {
    expect(sequencerLevers(cardsItem([110, 102, 106]), []).map(l => l.id)).not.toContain(MARKS_LEVER);
    expect(sequencerLevers(cardsItem([9, 1, 5]), []).map(l => l.id)).not.toContain(THREE_LEVER);
    const spoken = sequencerItemsForChallenge({ id: 's', type: 'before-after', instruction: '', sequence: [7, null], correctAnswers: [8],
      rangeMin: 7, rangeMax: 8 })[0];
    expect(sequencerLevers(spoken, [])).toEqual([]);
  });
});

describe('leak rules', () => {
  it('three_cards: three cards 3 apart, none of the item\'s, never in place, over many item sets', () => {
    let built = 0;
    for (let lo = 1; lo <= 90; lo += 3) for (const size of [3, 4, 5, 6]) {
      const values = Array.from({ length: size }, (_, i) => lo + i * 2);
      const shuffled = [...values.slice(1), values[0]];
      let item: SequencerItem;
      try { item = cardsItem(shuffled); } catch { continue; }
      const easier = threeCards(item);
      if (!easier) continue;
      built++;
      const [a, b, c] = easier.answerOrder;
      expect(b - a).toBeGreaterThanOrEqual(3);
      expect(c - b).toBeGreaterThanOrEqual(3);
      expect(easier.answerOrder.some(n => values.includes(n))).toBe(false);
      const laid = easier.sequence as number[];
      expect(laid.every((n, i) => n !== easier.answerOrder[i])).toBe(true);
      expect(easier.id).toBe(`${item.id}~simpler`);
    }
    expect(built).toBeGreaterThan(50);
  });
  it('train_steps grows left to right and draws heights only; facts name no card', () => {
    expect(trainSteps(3)).toEqual([6, 10, 14]);
    const item = cardsItem([13, 14, 11, 12]);
    expect(leverFacts(item, [STEPS_LEVER, MARKS_LEVER])).not.toMatch(/\d/);
  });
});
