import { expect, it } from 'vitest';
import { periodicMiss, periodicSpokenMisses } from './periodicTableWorkspace';
import { elementFactsOf, type PeriodicTableItem } from './periodicTableScript';

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
