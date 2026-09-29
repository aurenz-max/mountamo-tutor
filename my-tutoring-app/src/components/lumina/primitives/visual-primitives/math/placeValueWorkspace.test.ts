import { expect, it } from 'vitest';
import { itemsFromChallenges, type PlaceValueItem } from './placeValueScript';
import { placeValueMiss, placeValueSpokenMisses, workspaceAssignment } from './placeValueWorkspace';

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

const spoken = (kind: 'find_place' | 'say_value', targetNumber: number, place: number, digit: number, answerText: string) =>
  ({ id: kind, kind, answerKind: 'voice', targetNumber, place, digit, answerText,
    chartPlaces: String(targetNumber).split('').map((_, i, all) => all.length - 1 - i) }) as unknown as PlaceValueItem;

it.each([
  [spoken('find_place', 47, 1, 4, 'tens'), ['said_value', 'said_digit', 'next_place']],
  [spoken('find_place', 32, 0, 2, 'ones'), ['said_digit', 'next_place']],
  [spoken('find_place', 2510, 1, 1, 'tens'), ['said_value', 'said_digit', 'next_place', 'other_place']],
  [spoken('say_value', 47, 1, 4, 'forty'), ['said_digit', 'said_place', 'shifted_place', 'said_number', 'next_digit_value']],
  [spoken('say_value', 32, 0, 2, 'two'), ['shifted_place', 'said_number', 'next_digit_value']],
] as const)('spoken %#: known misses in order, none of them the answer', (item, ids) => {
  expect(workspaceAssignment(item).expectedAnswer).toBe(item.answerText);
  const misses = placeValueSpokenMisses(item);
  expect(misses.map(m => m.id)).toEqual(ids);
  expect(misses.flatMap(m => m.examples ?? []).filter(e => e === item.answerText)).toEqual([]);
});
