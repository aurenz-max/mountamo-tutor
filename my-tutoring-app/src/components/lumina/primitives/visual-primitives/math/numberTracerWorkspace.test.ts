import { expect, it } from 'vitest';
import { numberTracerMiss } from './numberTracerWorkspace';

const read = (writtenAs: string) => ({ writtenAs, accuracy: 0, coverage: 0 });
const geo = (accuracy: number, coverage: number) => ({ writtenAs: null, accuracy, coverage });

it.each([
  [7, read('1'), 'other_numeral'], [12, read('21'), 'digits_swapped'], [12, read('13'), 'other_numeral'],
  [3, read('?'), 'not_readable'], [3, read('3'), 'poorly_formed'],
  [3, geo(80, 30), 'part_left_out'], [3, geo(20, 10), 'shape_off'], [3, geo(40, 70), 'shape_off'],
] as const)('row %#: %i', (target, work, miss) => {
  expect(numberTracerMiss(target, work)).toBe(miss);
});
