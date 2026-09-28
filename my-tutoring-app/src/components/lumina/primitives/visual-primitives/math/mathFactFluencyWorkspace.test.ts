import { expect, it } from 'vitest';
import { mathFactMiss, type MathFactResponse } from './mathFactFluencyWorkspace';
import type { MathFactFluencyChallenge } from './MathFactFluency';

const fact = (operation: 'addition' | 'subtraction', operand1: number, operand2: number,
  unknownPosition: MathFactFluencyChallenge['unknownPosition'], extra: Partial<MathFactFluencyChallenge> = {}): MathFactFluencyChallenge => {
  const result = operation === 'addition' ? operand1 + operand2 : operand1 - operand2;
  const correctAnswer = unknownPosition === 'result' ? result : unknownPosition === 'operand1' ? operand1 : operand2;
  return { id: 'f', type: 'missing-number', instruction: '', equation: '', operation, operand1, operand2, result, unknownPosition,
    correctAnswer, ...extra };
};
const n = (value: number): MathFactResponse => ({ kind: 'number', value });
const take = fact('subtraction', 7, 3, 'result'), addOn = fact('addition', 3, 4, 'operand2');
const toEq = fact('addition', 2, 3, 'result', { type: 'match', matchDirection: 'visual-to-equation' });
const toPic = fact('addition', 2, 3, 'result', { type: 'match', matchDirection: 'equation-to-visual',
  visualOptions: [{ type: 'dot-array', count: 5 }, { type: 'dot-array', count: 2 }, { type: 'dot-array', count: 8 }] });

it.each([
  [take, n(4), undefined], [take, n(10), 'other_operation'], [take, n(7), 'printed_number'], [take, n(5), 'one_over'],
  [take, n(1), 'short_by_more'], [addOn, n(10), 'other_operation'], [addOn, n(3), 'printed_number'], [addOn, n(5), 'one_over'],
  [toEq, { kind: 'equation', value: '2 + 4 = 6' }, 'one_over'], [toEq, { kind: 'equation', value: '1 + 1 = 2' }, 'short_by_more'],
  [toPic, { kind: 'picture', index: 1 }, 'printed_number'], [toPic, { kind: 'picture', index: 2 }, 'over_by_more'],
  [toPic, { kind: 'picture', index: 0 }, undefined],
] as const)('row %#', (c, r, miss) => {
  expect(mathFactMiss(c, r as MathFactResponse)).toBe(miss);
});
