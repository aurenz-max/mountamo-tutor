import { expect, it } from 'vitest';
import { countMiss, itemFromChallenge, type CountingItem } from './countingBoardDomain';

const item = (type: CountingItem['kind'], count: number, targetAnswer: number) =>
  itemFromChallenge({ id: `${type}${targetAnswer}`, type, count, targetAnswer }, { objectWord: 'bears' })!;
const give5 = item('give_me_n', 9, 5), hands2 = item('subitize_perceptual', 2, 2), hands1 = item('subitize_perceptual', 1, 1);

it.each([
  [give5, 4, 'one_short'], [give5, 6, 'one_over'], [give5, 2, 'short_by_more'], [give5, 7, 'over_by_more'],
  [give5, 9, 'gave_all'], [give5, 5, undefined], [item('give_me_n', 6, 5), 6, 'one_over'],
  [hands2, 1, 'one_short'], [hands2, 3, 'one_over'], [hands1, 3, 'over_by_more'], [hands2, 2, undefined],
  [item('count_all', 5, 5), 4, undefined],
] as const)('%#: %s committed %i -> %s', (it_, committed, miss) => {
  expect(countMiss(it_, committed)).toBe(miss);
});
