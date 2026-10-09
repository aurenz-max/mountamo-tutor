import { expect, it } from 'vitest';
import { patternBuilderMiss, repeatKey, type PatternBuilderView } from './patternBuilderWorkspace';
import type { PatternBuilderChallenge } from './PatternBuilder';

// Row A B C A B C | hidden A B C; core A B C.
const data = { sequence: { given: ['A', 'B', 'C', 'A', 'B', 'C'], hidden: ['A', 'B', 'C'], core: ['A', 'B', 'C'], rule: null },
  tokens: { available: ['A', 'B', 'C'], type: 'shapes' as const }, translationTarget: { mapping: { a: 'x', b: 'y', c: 'z' } } };
const ch = (type: PatternBuilderChallenge['type']): PatternBuilderChallenge => ({ id: type, type, instruction: '', answer: '', hint: '', narration: '' });
const view = (v: Partial<PatternBuilderView>): PatternBuilderView => ({ extension: [], coreIndices: [], created: [], translated: [], ...v });
const ext = (...t: string[]) => view({ extension: t });
const growing = { ...data, sequence: { given: ['2', '4', '6'], hidden: ['8', '10'], core: [], rule: null } };

it.each([
  [data, ch('extend'), ext('A', 'B', 'C'), undefined], [data, ch('extend'), ext('A', 'B'), 'blanks_left'],
  [data, ch('extend'), ext('C', 'C', 'C'), 'repeated_last'], [data, ch('extend'), ext('A', 'C', 'B'), 'two_swapped'],
  [data, ch('extend'), ext('A', 'B', 'B'), 'one_wrong'], [data, ch('extend'), ext('B', 'C', 'A'), 'several_wrong'],
  [growing, ch('find_rule'), ext('2', '4'), 'started_over'], [growing, ch('find_rule'), ext('8', '12'), 'one_wrong'],
  [data, ch('translate'), view({ translated: ['x', 'y', 'z', 'x', 'y', 'x'] }), 'one_wrong'],
  [data, ch('translate'), view({ translated: ['x', 'y', 'z', 'x', 'y', 'z', 'x'] }), 'extra_tokens'],
  [data, ch('identify_core'), view({ coreIndices: [0, 1, 2] }), undefined], [data, ch('identify_core'), view({ coreIndices: [0, 1, 2, 3, 4, 5] }), 'two_repeats'],
  [data, ch('identify_core'), view({ coreIndices: [0, 1, 2, 3] }), 'too_long'], [data, ch('identify_core'), view({ coreIndices: [0, 1] }), 'too_short'],
  [data, ch('identify_core'), view({ coreIndices: [1, 2, 3] }), 'other_part'],
  [data, ch('create'), view({ created: ['A', 'B', 'A'] }), 'too_short'], [data, ch('create'), view({ created: ['A', 'B', 'B', 'A'] }), 'no_repeat'],
  [data, ch('create'), view({ created: ['A', 'B', 'A', 'B'] }), undefined],
] as const)('row %#', (d, c, v, miss) => {
  expect(patternBuilderMiss(d, c, v)).toBe(miss);
});

it('the generator keys a repeating row from its shown tokens: AAB shown twice continues A A, not A B', () => {
  expect(repeatKey(['r', 'r', 'b', 'r', 'r', 'b'], 2)).toEqual({ core: ['r', 'r', 'b'], hidden: ['r', 'r'] });
  expect(repeatKey(['r', 'b', 'g', 'r', 'b', 'g', 'r'], 3)).toEqual({ core: ['r', 'b', 'g'], hidden: ['b', 'g', 'r'] });
  expect(repeatKey(['r', 'b', 'g', 'r', 'b'], 3)).toBeNull(); // under two whole repeats: the LLM key stands
  expect(repeatKey(['2', '4', '6', '8'], 2)).toBeNull();
  expect(repeatKey(['r', 'r', 'r', 'r'], 2)).toBeNull();
});
