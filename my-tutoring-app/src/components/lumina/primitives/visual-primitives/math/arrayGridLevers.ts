/**
 * array-grid's in-item levers (/add-support-tiers; reports qa/eval-reports/array-grid-levers-2026-10-08.md and the
 * open-build report). The misses are what `arrayMiss` / `makeArrayMiss` observe; no real-learner evidence.
 *
 * Declared once as a lever set (`ARRAY_LEVERS`, `bossLevers.ts`); an item's mode is the session's (`ArrayItem.mode`).
 *
 * make_array (open build: the learner makes any array of N squares on an empty grid). Keeping the rows equal and the
 * squares counted IS the task, so the item starts bare and the levers come on a miss, never from the tier.
 * - `row_counts` (marks): beside each row, how many squares are in it.
 * - `square_count` (marks): under the grid, how many squares are on it. Never the number asked for.
 * - `smaller_array` (easier): an ungraded ask for a smaller array on an empty grid, then the full item.
 * `same_as_first` has no lever: the first array stays on screen beside the grid.
 *
 * build_array / count_array / multiply_array (an array of given rows and columns; the learner types the total, and on
 * multiply the two sides). Every miss is on the total or the sides, so no lever may draw either. The two pictures draw
 * on the array, so on build they are offered once the learner has picked its rows and columns.
 * - `row_strips` (marks): each row of the array outlined in its own coloured strip, two colours taking turns. Rows
 *   become visible groups; no number is drawn.
 * - `number_labels` (marks): numbers every row and column (the session's own label render). Offered only where the
 *   session hides labels, and never on multiply_array, whose sides are what the learner writes.
 * - `smaller_array` (easier): the same mode on a smaller array (two rows, or half the columns on a two-row array),
 *   ungraded, then the full item back blank. None on a 2 × 2 item, the plainest array.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { ArrayGridChallenge, ArrayGridChallengeType } from './ArrayGrid';
import { ARRAY_MISSES_BY_MODE } from './arrayGrid.card';
import { makeArrayAsk, type ArrayItem } from './arrayGridWorkspace';

export const ROW_COUNTS_LEVER = 'row_counts';
export const SQUARE_COUNT_LEVER = 'square_count';
export const SMALLER_LEVER = 'smaller_array';
export const ROW_STRIPS_LEVER = 'row_strips';
export const NUMBER_LABELS_LEVER = 'number_labels';

const SMALLER = '~smaller';
export const isPracticeArray = (c: Pick<ArrayGridChallenge, 'id'>) => c.id.endsWith(SMALLER);
/** The session item a practice id (`<id>~smaller`) came from. */
export const practiceParent = <C extends ArrayGridChallenge>(itemId: string | null | undefined, items: readonly C[]) =>
  itemId?.endsWith(SMALLER) ? items.find(c => `${c.id}${SMALLER}` === itemId) ?? null : null;

const composite = (n: number) => n >= 4 && Array.from({ length: n - 3 }, (_, i) => i + 2).some(d => n % d === 0);

/** Leak rule for a smaller rows × columns item: never the learner's own array (turned or not) or its total. */
export function smallerLeaks(parent: ArrayGridChallenge, simpler: ArrayGridChallenge): boolean {
  const { targetRows: r, targetColumns: c } = parent, { targetRows: sr, targetColumns: sc } = simpler;
  return simpler.id === parent.id || sr * sc === r * c || (sr === r && sc === c) || (sr === c && sc === r)
    || sr < 2 || sc < 2;
}

/**
 * The easier ask, in the item's own mode (the item's other fields, its mode and icon among them, carry over).
 * make_array: the largest number of squares at most half of N that makes more than one row (4 at least).
 * The given-array modes: one structural step smaller — two rows of the same columns, or, on a two-row array, half the
 * columns (at least two). Null on a 2 × 2 array and on a practice item.
 */
export function smallerArray<C extends ArrayGridChallenge>(c: C): C | null {
  if (isPracticeArray(c)) return null;
  const id = `${c.id}${SMALLER}`;
  if (c.total !== undefined) {
    let n = Math.floor(c.total / 2);
    while (n >= 4 && !composite(n)) n--;
    if (n < 4) return null;
    return { ...c, id, total: n, ways: 1, instruction: makeArrayAsk(n), itemSpace: undefined };
  }
  const { targetRows: r, targetColumns: cols } = c;
  const dims = r > 2 ? { targetRows: 2, targetColumns: cols }
    : cols > 2 ? { targetRows: r, targetColumns: Math.max(2, Math.ceil(cols / 2)) } : null;
  if (!dims) return null;
  const simpler: C = { ...c, id, ...dims, itemSpace: undefined };
  return smallerLeaks(c, simpler) ? null : simpler;
}

/**
 * What the screen holds beside the item: the session's labels (on screen, they take the label lever away), and
 * whether an array is drawn yet (on build, once the learner has picked its rows and columns).
 */
export interface ArrayLeverContext { labelsShown: boolean; arrayShown: boolean }

const GIVEN_TOTAL: readonly ArrayGridChallengeType[] = ['build_array', 'count_array'];
const UNGRADED = 'It is not graded; the full item comes back after it';
const STRIPS_DO = 'Outlines each row of the array in its own coloured strip, two colours taking turns, so each row reads '
  + 'as one group. No number is drawn.';
const STRIPS_FACT = 'Each row of the array is outlined in its own coloured strip, two colours taking turns.';
const arrayDrawn = (_c: ArrayItem, ctx: ArrayLeverContext) => ctx.arrayShown;

/**
 * The levers, declared once (`bossLevers.ts`). None is offered on a practice item: the component declares nothing
 * while one is on screen.
 */
export const ARRAY_LEVERS = leverSet<ArrayItem, ArrayLeverContext>({
  modeOf: c => c.mode,
  missesOf: mode => ARRAY_MISSES_BY_MODE[mode as ArrayGridChallengeType] ?? [],
  specs: [
    // make_array
    { id: ROW_COUNTS_LEVER, type: 'marks', modes: ['make_array'], answers: ['ragged', 'one_line_short', 'one_line_over'],
      when: 'The learner puts in rows of different lengths, or leaves a gap, or is one row or column off.',
      does: 'Puts a small number beside each row on the grid: how many squares the learner put in that row.',
      fact: 'Beside each row on the grid is how many squares are in that row.' },
    { id: SQUARE_COUNT_LEVER, type: 'marks', modes: ['make_array'],
      answers: ['too_few', 'too_many', 'one_line_short', 'one_line_over'],
      when: 'The learner loses count of the squares they put in.',
      does: 'Shows under the grid how many squares the learner has put in so far. Never the number asked for.',
      fact: 'Under the grid is how many squares the learner has put in.' },
    { id: SMALLER_LEVER, type: 'easier', modes: ['make_array'], answers: ['ragged', 'too_few', 'too_many'],
      when: 'The learner cannot make an array this big yet.',
      does: `Opens an easier ask first, an array with fewer squares, on an empty grid. ${UNGRADED}.`,
      content: c => smallerArray(c) },
    // build_array, count_array
    { id: ROW_STRIPS_LEVER, type: 'marks', modes: GIVEN_TOTAL,
      answers: ['added_sides', 'one_row_off', 'one_column_off', 'off_by_one', 'other_total'],
      when: 'The learner adds the two sides, or loses track of which rows they have counted.',
      does: STRIPS_DO, offer: arrayDrawn, fact: STRIPS_FACT },
    { id: NUMBER_LABELS_LEVER, type: 'marks', modes: GIVEN_TOTAL, answers: ['one_row_off', 'one_column_off', 'off_by_one'],
      when: 'The learner miscounts the rows or the items in a row.',
      does: 'Numbers every row down the side and every column along the top, as counting marks. The total is not shown.',
      // Never where the session already numbers them; never on multiply, whose sides are written answers.
      offer: (_c, ctx) => !ctx.labelsShown && ctx.arrayShown,
      fact: 'Every row and every column of the array now has a counting number beside it.' },
    { id: SMALLER_LEVER, type: 'easier', modes: GIVEN_TOTAL, answers: ['added_sides', 'other_total', 'one_row_off'],
      when: 'The learner cannot work out an array this big yet.',
      does: `Opens a smaller array of the same kind first. ${UNGRADED}, blank.`,
      content: c => smallerArray(c) },
    // multiply_array
    { id: ROW_STRIPS_LEVER, type: 'marks', modes: ['multiply_array'], answers: 'all',
      when: 'The learner mixes up rows and columns, or adds the two sides, or loses track of the rows.',
      does: STRIPS_DO, offer: arrayDrawn, fact: STRIPS_FACT },
    { id: SMALLER_LEVER, type: 'easier', modes: ['multiply_array'],
      answers: ['swapped_sides', 'wrong_side', 'added_sides', 'other_total'],
      when: 'The learner cannot work out an array this big yet.',
      does: `Opens a smaller array of the same kind first. ${UNGRADED}, blank.`,
      content: c => smallerArray(c) },
  ],
});
