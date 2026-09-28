import { expect, it } from 'vitest';
import { buildCompareItems } from './compareObjectsScript';
import { compareOrderMiss } from './compareObjectsWorkspace';

const [order] = buildCompareItems([{ id: 'co-1', type: 'order_three', attribute: 'length', comparisonWord: 'longer',
  objects: [{ name: 'yellow pencil', visualSize: 50, actualValue: 7 }, { name: 'blue string', visualSize: 20, actualValue: 3 },
    { name: 'red ribbon', visualSize: 80, actualValue: 12 }], correctAnswer: 'red ribbon, yellow pencil, blue string' }], { band: '1' }).items;

it.each([
  [['blue string', 'yellow pencil', 'red ribbon'], 'reversed'], [['yellow pencil', 'red ribbon', 'blue string'], 'two_swapped'],
  [['yellow pencil', 'blue string', 'red ribbon'], 'other_order'], [['red ribbon', 'yellow pencil'], 'not_all_placed'], [['red ribbon', 'yellow pencil', 'blue string'], undefined],
])('placed %j -> %s', (placed, miss) => {
  expect(order.answerNames).toEqual(['red ribbon', 'yellow pencil', 'blue string']);
  expect(compareOrderMiss(order, placed)).toBe(miss);
});
