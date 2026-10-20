/**
 * periodicTableDomain: the tap's checked misses, the spoken misses, the keys, the asks' leak rules, the chemistry
 * build gates and the session invariant. (The build-gate and leak pins moved here from the deleted DI-script test.)
 */
import { describe, expect, it } from 'vitest';
import { askLeaks, spokenKeyText } from '../../components/live-activity/spokenKey';
import { CHEMISTRY_CATALOG } from '../../service/manifest/catalog/chemistry';
import {
  askFor, elementFactsOf, itemFromChallenge, itemsFromChallenges, periodicKey, periodicMiss, periodicSpokenMisses,
  type PeriodicChallengeLike, type PeriodicTableItem,
} from './periodicTableDomain';

const find = (findBy: PeriodicTableItem['findBy'], n = 11) => ({ id: 'p', kind: 'find', findBy, element: elementFactsOf(n)! }) as PeriodicTableItem;
// Sodium (Na, 11): group 1, period 3.
it.each([
  [find('symbol'), 11, undefined], [find('symbol'), 7, 'same_first_letter'], [find('name'), 10, 'other_box'],
  [find('number'), 7, 'other_box'], [find('number'), 12, 'next_box'], [find('number'), 19, 'next_box'], [find('number'), 3, 'next_box'],
  [find('position'), 13, 'same_row'], [find('position'), 37, 'same_column'], [find('position'), 26, 'other_box'],
  [{ ...find('number'), kind: 'name' } as PeriodicTableItem, 12, undefined],
] as const)('row %#', (item, tapped, miss) => {
  expect(periodicMiss(item, tapped)).toBe(miss);
});

// Trends' known wrong answers (handoff 20 Part B): ids in precedence order, and no example is accepted.
const compare = { id: 'c', kind: 'compare', axis: 'size', pair: [elementFactsOf(16)!, elementFactsOf(34)!], answerName: 'Selenium' } as PeriodicTableItem;
const valence = (n: number, count: number) => ({ id: 'v', kind: 'valence', element: elementFactsOf(n)!, answerCount: count }) as PeriodicTableItem;
it.each([
  ['compare', compare, ['other_of_pair'], ['Selenium']],
  ['oxygen', valence(8, 6), ['group_number', 'one_short', 'one_over', 'short_by_more', 'over_by_more'], ['six', '6']],
  ['sodium', valence(11, 1), ['one_over', 'over_by_more'], ['one', '1']],
  ['find', find('name'), [], []],
] as const)('%s: spoken misses', (_name, item, ids, accepted) => {
  const misses = periodicSpokenMisses(item);
  expect(misses.map(m => m.id)).toEqual(ids);
  const ok = accepted.map(a => a.toLowerCase());
  for (const m of misses) for (const e of m.examples ?? []) expect(ok).not.toContain(e.toLowerCase());
});

// All elements distinct (the session invariant would drop reuse).
const FULL_SPREAD: PeriodicChallengeLike[] = [
  { id: 'f1', challengeType: 'explore', findBy: 'name', targetNumber: 20 },      // calcium
  { id: 'f2', challengeType: 'explore', findBy: 'symbol', targetNumber: 26 },    // iron
  { id: 'f3', challengeType: 'explore', findBy: 'number', targetNumber: 8 },     // oxygen
  { id: 'f4', challengeType: 'explore', findBy: 'position', targetNumber: 12 },  // magnesium
  { id: 'n1', challengeType: 'identify', clueBy: 'position', targetNumber: 2 },  // helium
  { id: 'n2', challengeType: 'identify', clueBy: 'number', targetNumber: 11 },   // sodium
  { id: 'n3', challengeType: 'identify', clueBy: 'symbol', targetNumber: 79 },   // gold
  { id: 't1', challengeType: 'trend', axis: 'size', pairNumbers: [3, 19] },      // Li vs K
  { id: 't2', challengeType: 'trend', axis: 'reactivity', pairNumbers: [17, 53] }, // Cl vs I
  { id: 't3', challengeType: 'trend', targetNumber: 16 },                        // sulfur valence
];
const items = itemsFromChallenges(FULL_SPREAD);
const byId = (id: string) => items.find(i => i.id === id)!;

describe('keys and asks', () => {
  it('the full spread builds; finds have no key, every other item a key its ask never says', () => {
    expect(items).toHaveLength(FULL_SPREAD.length);
    for (const item of items) {
      const key = periodicKey(item);
      expect(!key, item.id).toBe(item.kind === 'find');
      if (key) expect(askLeaks(askFor(item), key), item.id).toEqual([]);
    }
  });

  it('a position find never names its element or symbol: the identity is the reveal', () => {
    const ask = askFor(byId('f4')).toLowerCase(); // magnesium at group 2, period 3
    expect(ask).not.toContain('magnesium');
    expect(/\bmg\b/.test(ask)).toBe(false);
    expect(ask).toContain('group 2, period 3');
  });

  it('a compare is a menu key: the ask names both, the key the deeper atom on size', () => {
    const key = periodicKey(byId('t1'))!;
    expect(key.menu).toEqual(['Lithium', 'Potassium']);
    expect(key.answer).toBe('Potassium');
    expect(spokenKeyText(key)).toMatch(/^"Potassium".*"Lithium" is wrong/);
  });

  it('the valence key names the group-label miss where the label lies (group >= 13 only)', () => {
    expect(spokenKeyText(periodicKey(byId('t3'))!)).toMatch(/^"six".*"16" is the group number/);
    const sodium = itemFromChallenge({ id: 'x', challengeType: 'trend', targetNumber: 11 })!;
    expect(spokenKeyText(periodicKey(sodium)!)).not.toMatch(/group number/);
  });
});

describe('chemistry build gates: the spoken ask audits the content', () => {
  it.each([
    ['an unresolvable element', { id: 'x', challengeType: 'identify', clueBy: 'number', targetNumber: 999 }],
    ['helium valence (the tall-column rule says 8, its shell holds 2)', { id: 'x', challengeType: 'trend', targetNumber: 2 }],
    ['transition-metal valence', { id: 'x', challengeType: 'trend', targetNumber: 26 }],
    ['a cross-group compare pair', { id: 'x', challengeType: 'trend', axis: 'size', pairNumbers: [11, 17] }],
    ['fluorine/chlorine, not ear-separable', { id: 'x', challengeType: 'trend', axis: 'size', pairNumbers: [9, 17] }],
    ['hydrogen in a reactivity pair', { id: 'x', challengeType: 'trend', axis: 'reactivity', pairNumbers: [1, 19] }],
    ['a position find on a detached-row element', { id: 'x', challengeType: 'explore', findBy: 'position', targetNumber: 58 }],
    ['a position name on a detached-row element', { id: 'x', challengeType: 'identify', clueBy: 'position', targetNumber: 58 }],
  ] as const)('drops %s', (_why, ch) => {
    expect(itemFromChallenge(ch as unknown as PeriodicChallengeLike)).toBeNull();
  });

  it('an element appears in ONE item per session, in any role', () => {
    const session = itemsFromChallenges([
      { id: 'a', challengeType: 'identify', clueBy: 'number', targetNumber: 11 },
      { id: 'b', challengeType: 'explore', findBy: 'name', targetNumber: 11 },
      { id: 'c', challengeType: 'trend', axis: 'size', pairNumbers: [11, 19] },
      { id: 'd', challengeType: 'explore', findBy: 'name', targetNumber: 19 },
    ]);
    expect(session.map(i => i.id)).toEqual(['a', 'd']);
  });
});

it('the catalog keeps the three eval-mode identities and their betas, and forbids manifest answer keys', () => {
  const entry = CHEMISTRY_CATALOG.find(c => c.id === 'periodic-table')!;
  expect((entry.evalModes ?? []).map(m => [m.evalMode, m.beta])).toEqual([['explore', -1.0], ['identify', 0.5], ['trend', 2.0]]);
  expect(entry.constraints).toContain('must NOT supply element lists');
});
