/**
 * The ordinal-line build_sequence levers (handoff 21 M2): which lever answers which miss, and each lever's leak rule.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { itemsFromChallenge, type OrdinalLineItem } from './ordinalLineScript';
import { lineMiss } from './ordinalLineWorkspace';
import { DOTS_LEVER, FLAG_LEVER, THREE_LEVER, leverFacts, ordinalLevers, threePlaces } from './ordinalLineLevers';

const NAMES = ['Fox', 'Bear', 'Duck', 'Mole', 'Hen'];
const EMOJI = ['🦊', '🐻', '🦆', '🐹', '🐔'];
const build = (n: number, band: 'K' | '1' = 'K'): OrdinalLineItem => itemsFromChallenge({ id: `b${n}`, type: 'build-sequence',
  characters: NAMES.slice(0, n).map((name, i) => ({ name, emoji: EMOJI[i] })),
  clues: NAMES.slice(0, n).map((character, i) => ({ character, position: i + 1 })).reverse() }, { band, context: 'race' })[0];

describe('which lever comes next', () => {
  it.each([['reversed', FLAG_LEVER], ['place_left_empty', DOTS_LEVER], ['two_swapped', DOTS_LEVER], ['other_order', DOTS_LEVER]])(
    'after %s: %s', (miss, lever) => { expect(nextLever(ordinalLevers(build(4), []), miss)).toBe(lever); });
  it('after the dots, a swap opens the easier line; the check and the table agree', () => {
    expect(nextLever(ordinalLevers(build(4), [DOTS_LEVER]), 'two_swapped')).toBe(THREE_LEVER);
    expect(lineMiss(build(4), ['Mole', 'Duck', 'Bear', 'Fox'])).toBe('reversed');
    for (const m of ['reversed', 'place_left_empty', 'two_swapped', 'other_order'])
      expect(ordinalLevers(build(3), []).flatMap(l => l.answers ?? [])).toContain(m);
  });
  it('three places get no simplify; spoken kinds get no levers', () => {
    expect(ordinalLevers(build(3), []).map(l => l.id)).toEqual([FLAG_LEVER, DOTS_LEVER]);
    const identify = itemsFromChallenge({ id: 'i', type: 'identify', characters: NAMES.slice(0, 3).map((name, i) => ({ name, emoji: EMOJI[i] })),
      targetPosition: 2, correctAnswer: 2 }, { band: 'K', context: 'race' })[0];
    expect(ordinalLevers(identify, [])).toEqual([]);
  });
});

describe('leak rules', () => {
  it.each([4])('three_places on %i places (four is the most spoken clues a build allows): three new pictures, contiguous clues, never spoken front to back, its own id', n => {
    for (const band of ['K', '1'] as const) {
      const item = build(n, band);
      const easier = threePlaces(item)!;
      expect(easier.item).toMatchObject({ kind: 'build_sequence', id: `b${n}~simpler`, band, context: 'race' });
      expect(easier.item.answerOrder).toHaveLength(3);
      expect(easier.item.answerOrder.some(name => item.lineNames.includes(name))).toBe(false);
      expect(easier.item.clues.map(c => c.position)).not.toEqual([1, 2, 3]);
      for (const name of easier.item.answerOrder) expect(easier.emojis.get(name)).toBeTruthy();
    }
  });
  it('the scene facts name no picture', () => {
    const facts = leverFacts(build(4), [FLAG_LEVER, DOTS_LEVER]);
    for (const n of NAMES) expect(facts).not.toContain(n);
  });
});
