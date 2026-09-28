import { expect, it } from 'vitest';
import { strategyPickerMiss, type StrategyPickerView } from './strategyPickerWorkspace';
import type { StrategyPickerChallenge } from './StrategyPicker';

const ch = (type: StrategyPickerChallenge['type'], operation: 'addition' | 'subtraction', a: number, b: number,
  extra: Partial<StrategyPickerChallenge> = {}): StrategyPickerChallenge => ({ id: type, type, instruction: '',
  problem: { equation: '', operation, operand1: a, operand2: b, result: operation === 'addition' ? a + b : a - b }, ...extra } as StrategyPickerChallenge);
const view = (v: Partial<StrategyPickerView>): StrategyPickerView => ({ answer: '', chosen: null, match: null, compare: null, ...v });
const add = ch('guided-strategy', 'addition', 5, 3), sub = ch('try-another', 'subtraction', 9, 4);
const match = ch('match-strategy', 'addition', 4, 4, { correctStrategy: 'doubles' });

it.each([
  [add, view({ answer: '8' }), undefined], [add, view({ answer: '2' }), 'other_operation'], [add, view({ answer: '5' }), 'printed_number'],
  [add, view({ answer: '7' }), 'one_short'], [add, view({ answer: '9' }), 'one_over'], [add, view({ answer: '12' }), 'over_by_more'],
  [sub, view({ answer: '13' }), 'other_operation'], [sub, view({ answer: '4' }), 'printed_number'], [sub, view({ answer: '6' }), 'one_over'],
  [match, view({ match: 'near-doubles' }), 'similar_strategy'], [match, view({ match: 'counting-on' }), 'different_strategy'],
  [ch('compare', 'addition', 2, 2), view({ compare: 'doubles' }), undefined],
] as const)('row %#', (c, v, miss) => {
  expect(strategyPickerMiss(c, v)).toBe(miss);
});
