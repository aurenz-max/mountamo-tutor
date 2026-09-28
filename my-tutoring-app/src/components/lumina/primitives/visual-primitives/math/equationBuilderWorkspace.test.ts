import { expect, it } from 'vitest';
import { equationBuilderMiss, type EquationBuilderView } from './equationBuilderWorkspace';
import type { EquationBuilderChallenge } from './EquationBuilder';

const view = (v: Partial<EquationBuilderView>): EquationBuilderView => ({ slots: [], option: null, truth: null, entry: '', ...v });
const tiles = (eq: string) => view({ slots: eq.split(' ') });
const build: EquationBuilderChallenge = { id: 'b', type: 'build', instruction: '', targetEquation: '3 + 2 = 5' };
const rewrite: EquationBuilderChallenge = { id: 'r', type: 'rewrite', instruction: '', originalEquation: '3 + 2 = 5',
  acceptedForms: ['5 = 3 + 2', '5 = 2 + 3'] };
const missing: EquationBuilderChallenge = { id: 'm', type: 'missing-value', instruction: '', equation: '4 + ? = 7', correctValue: 3 };
const balance: EquationBuilderChallenge = { id: 'x', type: 'balance', instruction: '', leftSide: '3 + 4', rightSide: '? + 2', correctAnswer: 5 };
const tf = (isTrue: boolean): EquationBuilderChallenge => ({ id: 't', type: 'true-false', instruction: '', displayEquation: '', isTrue });

it.each([
  [build, tiles('3 + 2 = 5'), undefined], [build, tiles('5 = 2 + 3'), undefined], [build, tiles('3 + 2 ='), 'unfinished_equation'],
  [build, tiles('3 + 2 = 6'), 'false_equation'], [build, tiles('5 - 2 = 3'), 'other_operation'], [build, tiles('4 + 1 = 5'), 'other_numbers'],
  [rewrite, tiles('5 = 3 + 2'), undefined], [rewrite, tiles('3 + 2 = 5'), 'same_as_printed'], [rewrite, tiles('2 + 3 = 5'), 'other_form'],
  [rewrite, tiles('5 = 4 + 1'), 'other_numbers'], [rewrite, tiles('5 ='), 'unfinished_equation'],
  [missing, view({ option: 3 }), undefined], [missing, view({ option: 11 }), 'sum_of_printed'], [missing, view({ option: 7 }), 'printed_number'],
  [missing, view({ option: 2 }), 'one_short'], [missing, view({ option: 6 }), 'over_by_more'],
  [balance, view({ entry: '7' }), 'other_side_total'], [balance, view({ entry: '2' }), 'printed_number'], [balance, view({ entry: '6' }), 'one_over'],
  [tf(false), view({ truth: true }), 'said_true'], [tf(true), view({ truth: false }), 'said_false'], [tf(true), view({ truth: true }), undefined],
] as const)('row %#', (c, v, miss) => {
  expect(equationBuilderMiss(c, v)).toBe(miss);
});
