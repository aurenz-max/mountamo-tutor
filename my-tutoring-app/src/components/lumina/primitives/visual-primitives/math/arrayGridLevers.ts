/**
 * array-grid's in-item levers (/add-support-tiers; reports qa/eval-reports/array-grid-levers-2026-10-08.md and the
 * open-build report). The misses are what `arrayMiss` / `makeArrayMiss` observe; no real-learner evidence.
 *
 * make_array (open build: the learner makes any array of N squares on an empty grid). Keeping the rows equal and the
 * squares counted IS the task, so the item starts bare and the levers come on a miss, never from the tier.
 * - `row_counts` (help): beside each row, how many squares are in it.
 * - `square_count` (help): under the grid, how many squares are on it. Never the number asked for.
 * - `smaller_array` (simplify): an ungraded ask for a smaller array on an empty grid, then the full item.
 * `same_as_first` has no lever: the first array stays on screen beside the grid.
 *
 * build_array / count_array / multiply_array (an array of given rows and columns; the learner types the total, and on
 * multiply the two sides). Every miss is on the total or the sides, so no lever may draw either.
 * - `row_strips` (help): each row of the array outlined in its own coloured strip, two colours taking turns. Rows
 *   become visible groups; no number is drawn.
 * - `number_labels` (help): numbers every row and column (the session's own label render). Offered only where the
 *   session hides labels, and never on multiply_array, whose sides are what the learner writes.
 * - `smaller_array` (simplify): the same mode on a smaller array (two rows, or half the columns on a two-row array),
 *   ungraded, then the full item back blank. None on a 2 × 2 item, the plainest array.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { ArrayGridChallenge, ArrayGridChallengeType } from './ArrayGrid';
import { makeArrayAsk, type ArrayMiss } from './arrayGridWorkspace';

export const ROW_COUNTS_LEVER = 'row_counts';
export const SQUARE_COUNT_LEVER = 'square_count';
export const SMALLER_LEVER = 'smaller_array';
export const ROW_STRIPS_LEVER = 'row_strips';
export const NUMBER_LABELS_LEVER = 'number_labels';

const SMALLER = '~smaller';
export const isPracticeArray = (c: Pick<ArrayGridChallenge, 'id'>) => c.id.endsWith(SMALLER);

const composite = (n: number) => n >= 4 && Array.from({ length: n - 3 }, (_, i) => i + 2).some(d => n % d === 0);

/** Leak rule for a smaller rows × columns item: never the learner's own array (turned or not) or its total. */
export function smallerLeaks(parent: ArrayGridChallenge, simpler: ArrayGridChallenge): boolean {
  const { targetRows: r, targetColumns: c } = parent, { targetRows: sr, targetColumns: sc } = simpler;
  return simpler.id === parent.id || sr * sc === r * c || (sr === r && sc === c) || (sr === c && sc === r)
    || sr < 2 || sc < 2;
}

/**
 * The easier ask, in the item's own mode.
 * make_array: the largest number of squares at most half of N that makes more than one row (4 at least).
 * The given-array modes: one structural step smaller — two rows of the same columns, or, on a two-row array, half the
 * columns (at least two). Null on a 2 × 2 array and on a practice item.
 */
export function smallerArray(c: ArrayGridChallenge): ArrayGridChallenge | null {
  if (isPracticeArray(c)) return null;
  if (c.total !== undefined) {
    let n = Math.floor(c.total / 2);
    while (n >= 4 && !composite(n)) n--;
    if (n < 4) return null;
    return { ...c, id: `${c.id}${SMALLER}`, total: n, ways: 1, instruction: makeArrayAsk(n) };
  }
  const { targetRows: r, targetColumns: cols } = c;
  const dims = r > 2 ? { targetRows: 2, targetColumns: cols }
    : cols > 2 ? { targetRows: r, targetColumns: Math.max(2, Math.ceil(cols / 2)) } : null;
  if (!dims) return null;
  const simpler: ArrayGridChallenge = { id: `${c.id}${SMALLER}`, ...dims };
  return smallerLeaks(c, simpler) ? null : simpler;
}

/** What the session already draws, for the given-array modes: labels on screen take the label lever away. */
export interface ArrayLeverContext { mode: ArrayGridChallengeType; labelsShown: boolean }

/** Leak rule for `number_labels`: never on multiply_array (the sides are written answers), never where labels show. */
export const labelsOffered = (ctx: ArrayLeverContext) =>
  (ctx.mode === 'build_array' || ctx.mode === 'count_array') && !ctx.labelsShown;

export function arrayGridLevers(c: ArrayGridChallenge | null, pulled: readonly string[], ctx?: ArrayLeverContext): WorkspaceLever[] {
  if (!c) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly ArrayMiss[], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  if (c.total !== undefined) {
    return [
      lever(ROW_COUNTS_LEVER, 'help', ['ragged', 'one_line_short', 'one_line_over'],
        'The learner puts in rows of different lengths, or leaves a gap, or is one row or column off.',
        'Puts a small number beside each row on the grid: how many squares the learner put in that row.'),
      lever(SQUARE_COUNT_LEVER, 'help', ['too_few', 'too_many', 'one_line_short', 'one_line_over'],
        'The learner loses count of the squares they put in.',
        'Shows under the grid how many squares the learner has put in so far. Never the number asked for.'),
      ...(smallerArray(c) ? [lever(SMALLER_LEVER, 'simplify', ['ragged', 'too_few', 'too_many'],
        'The learner cannot make an array this big yet.',
        'Opens an easier ask first, an array with fewer squares, on an empty grid. It is not graded; the full item comes back after it.')] : []),
    ];
  }
  if (!ctx || ctx.mode === 'make_array') return [];
  const multiply = ctx.mode === 'multiply_array';
  return [
    lever(ROW_STRIPS_LEVER, 'help',
      multiply ? ['swapped_sides', 'wrong_side', 'added_sides', 'one_row_off', 'one_column_off', 'off_by_one', 'other_total']
        : ['added_sides', 'one_row_off', 'one_column_off', 'off_by_one', 'other_total'],
      multiply ? 'The learner mixes up rows and columns, or adds the two sides, or loses track of the rows.'
        : 'The learner adds the two sides, or loses track of which rows they have counted.',
      'Outlines each row of the array in its own coloured strip, two colours taking turns, so each row reads as one group. '
        + 'No number is drawn.'),
    ...(labelsOffered(ctx) ? [lever(NUMBER_LABELS_LEVER, 'help', ['one_row_off', 'one_column_off', 'off_by_one'],
      'The learner miscounts the rows or the items in a row.',
      'Numbers every row down the side and every column along the top, as counting marks. The total is not shown.')] : []),
    ...(smallerArray(c) ? [lever(SMALLER_LEVER, 'simplify',
      multiply ? ['swapped_sides', 'wrong_side', 'added_sides', 'other_total'] : ['added_sides', 'other_total', 'one_row_off'],
      'The learner cannot work out an array this big yet.',
      'Opens a smaller array of the same kind first. It is not graded; the full item comes back after it, blank.')] : []),
  ];
}

/** What the pulled help levers put on screen, for the tutor. Pictures only: no number (`/\d/` is the leak test). */
export function leverFacts(c: ArrayGridChallenge | null, pulled: readonly string[]): string {
  if (!c) return '';
  if (c.total === undefined) return [
    pulled.includes(ROW_STRIPS_LEVER) && 'Each row of the array is outlined in its own coloured strip, two colours taking turns.',
    pulled.includes(NUMBER_LABELS_LEVER) && 'Every row and every column of the array now has a counting number beside it.',
  ].filter((s): s is string => !!s).join(' ');
  return [
    pulled.includes(ROW_COUNTS_LEVER) && 'Beside each row on the grid is how many squares are in that row.',
    pulled.includes(SQUARE_COUNT_LEVER) && 'Under the grid is how many squares the learner has put in.',
  ].filter((s): s is string => !!s).join(' ');
}
