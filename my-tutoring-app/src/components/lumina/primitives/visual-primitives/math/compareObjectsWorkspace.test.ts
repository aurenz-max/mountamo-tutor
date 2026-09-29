import { expect, it } from 'vitest';
import { buildCompareItems, type CompareObjectsItem } from './compareObjectsScript';
import { compareObjectsSpokenMisses, compareOrderMiss, workspaceAssignment } from './compareObjectsWorkspace';

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

const spoken = (kind: CompareObjectsItem['kind'], extra: Partial<CompareObjectsItem>) =>
  ({ id: kind, kind, answerKind: 'voice', attribute: 'length', comparisonWord: 'longer', objectNames: ['red ribbon', 'blue string'],
    askOrder: ['blue string', 'red ribbon'], answerNames: ['red ribbon'], attributeOptions: ['length', 'weight'], unitName: 'cube',
    unitCount: 4, ...extra }) as CompareObjectsItem;

it.each([
  [spoken('compare_two', {}), 'red ribbon', ['other_object'], ['blue string']],
  [spoken('compare_two', { comparisonWord: 'holds_less', attribute: 'capacity' }), 'red ribbon', ['other_object'], ['blue string']],
  [spoken('identify_attribute', { attributeOptions: ['weight', 'length', 'capacity'] }), 'length', ['other_attribute'],
    ['how heavy they are', 'how much they hold']],
  [spoken('non_standard', {}), '4', ['one_short', 'one_over', 'short_by_more', 'over_by_more'], ['three', 'five', 'two', 'six']],
] as const)('spoken %#: known misses in order, none of them the answer', (item, key, ids, examples) => {
  expect(workspaceAssignment(item).expectedAnswer).toBe(key);
  const misses = compareObjectsSpokenMisses(item);
  expect(misses.map(m => m.id)).toEqual(ids);
  expect(misses.flatMap(m => m.examples ?? [])).toEqual(examples);
});

it('an ordering lists none', () => expect(compareObjectsSpokenMisses(order)).toEqual([]));
