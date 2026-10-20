import { expect, it } from 'vitest';
import { askLeaks, spokenKeyText } from '../../../components/live-activity/spokenKey';
import { askFor, countingBoardSpokenMisses, countingKey, countMiss, itemFromChallenge, numberWordFor, type CountingItem } from './countingBoardDomain';
import { countingBoardBoss } from './countingBoard.boss';

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

const spoken = (type: CountingItem['kind'], count: number, targetAnswer: number, extra: Record<string, unknown> = {}) =>
  itemFromChallenge({ id: `${type}${targetAnswer}`, type, count, targetAnswer, ...extra }, { objectWord: 'bears' })!;

// The spoken items' known wrong answers (handoff 20 Part B): the board's own numbers first, then the off-by misses.
it.each([
  [spoken('count_all', 5, 5), ['skipped_a_number', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
  [spoken('count_all', 1, 1), ['skipped_a_number', 'one_over', 'over_by_more']],
  [spoken('take_away', 7, 4, { changeBy: 3 }), ['said_start', 'said_change', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
  [spoken('add_more', 4, 6, { changeBy: 2 }), ['said_start', 'said_change', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
  [spoken('compare', 9, 6, { compareGroups: [3, 6] }), ['smaller_group', 'said_total', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
  [spoken('give_me_n', 9, 5), []],
] as const)('%#: spoken misses of %s', (it_, ids) => {
  const misses = countingBoardSpokenMisses(it_);
  expect(misses.map(m => m.id)).toEqual(ids);
  // No listed miss is the key, in any form.
  for (const m of misses) expect(m.examples ?? []).not.toContain(String(it_.target));
  expect(countingBoardBoss.assignment(it_).misses?.map(m => m.id) ?? []).toEqual(ids);
});

// The spoken key (`spokenKeyText` writes it) and the assignment the boss builds from it.
it.each([
  [spoken('count_all', 5, 5), /^"five"\./],
  [spoken('count_on', 8, 8, { startFrom: 5 }), /Five, the number already in the group/],
  [spoken('compare', 9, 6, { compareGroups: [3, 6] }), /smaller group/],
  [spoken('take_away', 7, 4, { changeBy: 3 }), /how many are left/],
  [spoken('recount_moved', 6, 6), /Moving them did not change how many/],
] as const)('%#: a spoken key accepts the count walk and names its fluent miss', (item, pattern) => {
  const key = countingKey(item)!;
  expect([key.answer, key.alsoAccept]).toEqual([numberWordFor(item.target), []]);
  expect(spokenKeyText(key)).toMatch(pattern);
  expect(key.acceptRule).toMatch(/ending on/);
  expect(askLeaks(askFor(item), key)).toEqual([]);
  expect(countingBoardBoss.assignment(item)).toMatchObject({ id: item.id, task: askFor(item), response: 'speech', expectedAnswer: spokenKeyText(key) });
});

it.each([item('give_me_n', 9, 5), hands2, itemFromChallenge({ id: 'b', type: 'build_n', count: 4, targetAnswer: 4 }, { objectWord: 'bears' })!])(
  '%#: an item the board checks has no key, and its assignment carries none to the tutor', it_ => {
    expect(countingKey(it_)).toBeNull();
    expect(countingBoardBoss.assignment(it_)).toEqual({ id: it_.id, task: askFor(it_), response: 'gesture' });
  });
