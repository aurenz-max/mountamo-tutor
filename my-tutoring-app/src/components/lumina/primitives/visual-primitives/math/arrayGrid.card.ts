/**
 * array-grid's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `arrayGrid.boss.ts`.
 * Every mode is answered on the screen and checked by the activity: build picks the rows and columns asked for and
 * types the total, count types the total, multiply writes rows × columns = total, make builds any array of N squares on
 * an empty grid. One item at a time, activity-judged: a bespoke boss.
 */
import type { ArrayGridChallengeType } from './ArrayGrid';
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong make shows (`makeArrayMiss`, `TeachingAttempt.miss`):
 * - `ragged`: the squares are not one full rectangle (rows of different lengths, or a gap);
 * - `one_line_short` / `one_line_over`: a rectangle one row or one column away from the number asked for;
 * - `too_few` / `too_many`: any other rectangle of the wrong size;
 * - `same_as_first`: on the second ask, the same rows and columns as the first array (a turned array is different).
 */
export type MakeArrayMiss = 'ragged' | 'one_line_short' | 'one_line_over' | 'too_few' | 'too_many' | 'same_as_first';
export const MAKE_ARRAY_MISSES: readonly MakeArrayMiss[] = ['ragged', 'one_line_short', 'one_line_over', 'too_few', 'too_many', 'same_as_first'];

/**
 * The observable pattern of a wrong typed answer, every mode but make_array (`arrayMiss`):
 * - a total: `added_sides` (rows + columns), `one_row_off` (a row too many or too few), `one_column_off`,
 *   `off_by_one`, `other_total`;
 * - multiply_array's sides: `swapped_sides` (rows and columns exchanged), `wrong_side` (another number).
 */
export type ArrayTotalMiss = 'added_sides' | 'one_row_off' | 'one_column_off' | 'off_by_one' | 'other_total';
export type ArrayMiss = ArrayTotalMiss | 'swapped_sides' | 'wrong_side' | MakeArrayMiss;

const TOTAL_MISSES: readonly ArrayTotalMiss[] = ['added_sides', 'one_row_off', 'one_column_off', 'off_by_one', 'other_total'];
export const ARRAY_MISSES_BY_MODE: Record<ArrayGridChallengeType, readonly ArrayMiss[]> = {
  build_array: TOTAL_MISSES,
  count_array: TOTAL_MISSES,
  multiply_array: ['swapped_sides', 'wrong_side', ...TOTAL_MISSES],
  make_array: MAKE_ARRAY_MISSES,
};

const CHECKED = { judge: 'activity', flow: 'one-at-a-time' } as const;

export const arrayGridCard = defineCard<ArrayMiss>({
  id: 'array-grid',
  grades: ['Grade 2', 'Grade 3', 'Grade 4'],
  // Every mode publishes levers (`arrayGridLevers.ts`); every miss is answered by a lever in its mode but one.
  modes: {
    build_array: { ...CHECKED, answer: 'build', misses: ARRAY_MISSES_BY_MODE.build_array,
      moves: 'presses a Rows button and a Columns button to build the array asked for, then types the total and presses '
        + 'Check' },
    make_array: { ...CHECKED, answer: 'build', misses: ARRAY_MISSES_BY_MODE.make_array,
      // `same_as_first` has no lever: the first array stays on screen beside the grid, and "different" has no smaller form.
      unanswered: ['same_as_first'],
      moves: 'taps empty cells to put squares in (tapping a square takes it out), then presses I\'m done!; on some items '
        + 'the learner then makes a different array with the same number of squares' },
    count_array: { ...CHECKED, answer: 'type', misses: ARRAY_MISSES_BY_MODE.count_array,
      moves: 'types the total in the Total box, then presses Check' },
    multiply_array: { ...CHECKED, answer: 'type', misses: ARRAY_MISSES_BY_MODE.multiply_array,
      moves: 'types the rows, the columns and the total into rows × columns = total, then presses Check' },
  },
  words: {
    job: 'find how many are in an array of equal rows: build the array asked for and type its total, type the total of '
      + 'an array drawn, write its multiplication sentence, or make any array of a given number of squares on an empty grid',
    answer: 'the total they type, the rows and columns they write on multiply, and on make the array they make (how '
      + 'many rows, columns or squares it uses)',
    question: 'the ask, on build the rows and columns it names, on make the number of squares it names, and the icons drawn',
  },
  levers: true,
});
