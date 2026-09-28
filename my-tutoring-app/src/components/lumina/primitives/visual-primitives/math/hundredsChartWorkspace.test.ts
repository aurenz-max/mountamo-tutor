import { expect, it } from 'vitest';
import { hundredsChartMiss } from './hundredsChartWorkspace';
import type { HundredsChartChallenge } from './HundredsChart';

const ch = (type: HundredsChartChallenge['type'], extra: Partial<HundredsChartChallenge> = {}): HundredsChartChallenge =>
  ({ id: type, type, instruction: '', skipValue: 5, startNumber: 5, givenCells: [], correctCells: [5, 10, 15, 20],
    correctAnswer: '', options: [], hint: '', ...extra });
const cells = (...ns: number[]) => ({ cells: new Set(ns), option: null });
const pick = (option: string) => ({ cells: new Set<number>(), option });
const all = ch('highlight_sequence'), rest = ch('complete_sequence', { givenCells: [5, 10] }), skip = ch('find_skip_value');

it.each([
  [all, cells(5, 10, 15, 20), undefined], [all, cells(5, 10), 'stopped_early'], [all, cells(5, 15, 20), 'gaps_left'],
  [all, cells(5, 10, 15, 20, 25), 'extra_cells'], [all, cells(2, 4, 6, 8), 'other_step'], [all, cells(5, 10, 15, 21), 'stray_cells'],
  [rest, cells(15, 20), undefined], [rest, cells(15), 'stopped_early'], [rest, cells(12, 14), 'stray_cells'],
  [ch('complete_sequence', { givenCells: [4, 8], correctCells: [4, 8, 12, 16], skipValue: 4 }), cells(12, 16, 20), 'extra_cells'],
  [ch('complete_sequence', { givenCells: [2, 4], correctCells: [2, 4, 6, 8], skipValue: 2 }), cells(7, 10, 13), 'other_step'],
  [skip, pick('5'), undefined], [skip, pick('10'), 'twice_the_step'], [ch('find_skip_value', { skipValue: 10 }), pick('5'), 'half_the_step'],
  [skip, pick('4'), 'one_short'], [skip, pick('2'), 'short_by_more'], [ch('identify_pattern', { correctAnswer: 'a' }), pick('b'), undefined],
] as const)('row %#', (c, view, miss) => {
  expect(hundredsChartMiss(c, view)).toBe(miss);
});
