import { expect, it } from 'vitest';
import { itemsFromChallenges } from './placeValueScript';
import { placeValueMiss } from './placeValueWorkspace';

/** A dictated item: the rotation dictates the first challenge and prints the second. */
const dictated = (targetNumber: number) => itemsFromChallenges([{ id: 'b', targetNumber }], { mode: 'build', tier: 'medium' })
  .items.find(i => i.kind === 'build_number')!;
const n406 = dictated(406), n13 = dictated(13), n30 = dictated(30);

it.each([
  [n406, [4, null, 6], 'zero_left_empty'], [n406, [4, 0, null], 'column_empty'], [n406, [0, 4, 6], 'digits_swapped'],
  [n406, [4, 0, 7], 'one_over'], [n406, [4, 0, 5], 'one_short'], [n406, [4, 1, 6], 'one_ten_off'],
  [n406, [3, 0, 6], 'short_by_more'], [n406, [4, 0, 6], undefined],
  [n13, [3, 0], 'teen_ty_swap'], [n30, [1, 3], 'teen_ty_swap'], [n13, [3, 1], 'digits_swapped'],
] as const)('row %#', (item, written, miss) => {
  expect(placeValueMiss(item, written)).toBe(miss);
});

it('a spoken item names no miss', () => {
  const printed = itemsFromChallenges([{ id: 'b', targetNumber: 406 }, { id: 'a', targetNumber: 2345, highlightedDigitPlace: 1 }],
    { mode: 'build', tier: 'medium' }).items.find(i => i.kind !== 'build_number')!;
  expect(placeValueMiss(printed, [])).toBeUndefined();
});
