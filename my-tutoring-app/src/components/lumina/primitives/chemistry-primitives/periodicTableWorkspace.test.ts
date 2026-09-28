import { expect, it } from 'vitest';
import { periodicMiss } from './periodicTableWorkspace';
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
