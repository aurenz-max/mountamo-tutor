import { expect, it } from 'vitest';
import { itemFromChallenge } from './additionSubtractionSceneScript';
import { spokenNumber } from '../../../components/live-activity/runtime/spokenMissContract';
import { addSubMiss, additionSubtractionAssignment, additionSubtractionSpokenMisses } from './additionSubtractionSceneWorkspace';

const item = (type: string, operation: 'addition' | 'subtraction', startCount: number, changeCount: number, band: 'K' | '1' = 'K') =>
  itemFromChallenge({ id: type, type, operation, startCount, changeCount,
    resultCount: operation === 'addition' ? startCount + changeCount : startCount - changeCount,
    storyText: 'A story.', instruction: '', objectType: 'ducks' } as never, { band })!;
const join = item('act-out', 'addition', 3, 2), leave = item('act-out', 'subtraction', 5, 2);
const make = item('create-story', 'addition', 2, 3), tiles = item('build-equation', 'addition', 3, 2, '1');

it.each([
  [join, { placed: 5 }, undefined], [join, { placed: 3 }, 'no_change'], [join, { placed: 2 }, 'wrong_way'],
  [join, { placed: 4 }, 'one_short'], [join, { placed: 6 }, 'one_over'], [join, { placed: 8 }, 'over_by_more'],
  [leave, { placed: 3 }, undefined], [leave, { placed: 5 }, 'no_change'], [leave, { placed: 6 }, 'wrong_way'],
  [leave, { placed: 4 }, 'one_over'], [leave, { placed: 2 }, 'one_short'], [leave, { placed: 0 }, 'short_by_more'],
  [make, { placed: 2 }, 'no_change'], [make, { placed: 1 }, 'short_by_more'], [make, { placed: 4 }, 'one_short'],
  [tiles, { tiles: ['3', '+', '2', '=', '5'] }, undefined], [tiles, { tiles: ['3', '+', '2'] }, 'unfinished_equation'],
  [tiles, { tiles: ['3', '+', '2', '=', '6'] }, 'false_equation'], [tiles, { tiles: ['5', '-', '2', '=', '3'] }, 'other_operation'],
  [tiles, { tiles: ['4', '+', '1', '=', '5'] }, 'other_numbers'],
  [item('solve-story', 'addition', 3, 2), { placed: 4 }, undefined],
] as const)('row %#', (it_, work, miss) => {
  expect(addSubMiss(it_, work)).toBe(miss);
});

const story = (operation: 'addition' | 'subtraction', startCount: number, changeCount: number, unknownPosition = 'result') =>
  itemFromChallenge({ id: `s-${unknownPosition}`, type: 'solve-story', operation, startCount, changeCount, unknownPosition,
    resultCount: operation === 'addition' ? startCount + changeCount : startCount - changeCount,
    storyText: 'A story.', instruction: '', objectType: 'ducks' } as never, { band: '1' })!;

it.each([
  [story('addition', 3, 2), 5, ['said_start', 'said_change', 'other_operation', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
  [story('subtraction', 6, 2), 4, ['said_start', 'said_change', 'other_operation', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
  [story('addition', 4, 3, 'change'), 3, ['said_start', 'said_result', 'other_operation', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
  [story('subtraction', 7, 4, 'start'), 7, ['said_change', 'said_result', 'other_operation', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
] as const)('spoken %#: known misses in order, none of them the answer', (it_, answer, ids) => {
  expect(it_.answer).toBe(answer);
  const misses = additionSubtractionSpokenMisses(it_);
  expect(misses.map(m => m.id)).toEqual(ids);
  expect(misses.flatMap(m => m.examples ?? []).filter(e => e === spokenNumber(answer) || e === String(answer))).toEqual([]);
  expect(additionSubtractionAssignment(it_).misses).toEqual(misses);
});

it('an enacted item lists none', () => expect(additionSubtractionSpokenMisses(join)).toEqual([]));
