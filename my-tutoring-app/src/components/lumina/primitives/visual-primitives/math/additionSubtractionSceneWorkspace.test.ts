import { expect, it } from 'vitest';
import { itemFromChallenge } from './additionSubtractionSceneScript';
import { addSubMiss } from './additionSubtractionSceneWorkspace';

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
