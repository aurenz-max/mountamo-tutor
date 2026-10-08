/**
 * The in-item levers on array-grid's open build, `make_array` (/add-eval-modes references/build-mode.md). The
 * learner makes any array of N squares on an empty grid. Keeping the rows equal and the squares counted IS the
 * task, so the item starts bare and the levers come on a miss, never from the tier.
 * - `row_counts` (help): beside each row, how many squares are in it.
 * - `square_count` (help): under the grid, how many squares are on it. Never the number asked for.
 * - `smaller_array` (simplify): an ungraded ask for a smaller array on an empty grid, then the full item.
 * `same_as_first` has no lever: the first array stays on screen beside the grid. The other modes declare none.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { ArrayGridChallenge } from './ArrayGrid';
import { makeArrayAsk, type MakeArrayMiss } from './arrayGridWorkspace';

export const ROW_COUNTS_LEVER = 'row_counts';
export const SQUARE_COUNT_LEVER = 'square_count';
export const SMALLER_LEVER = 'smaller_array';

const SMALLER = '~smaller';
export const isPracticeArray = (c: Pick<ArrayGridChallenge, 'id'>) => c.id.endsWith(SMALLER);

const composite = (n: number) => n >= 4 && Array.from({ length: n - 3 }, (_, i) => i + 2).some(d => n % d === 0);

/** The easier ask: the largest number of squares at most half of N that makes more than one row (4 at least). */
export function smallerArray(c: ArrayGridChallenge): ArrayGridChallenge | null {
  if (c.total === undefined || isPracticeArray(c)) return null;
  let n = Math.floor(c.total / 2);
  while (n >= 4 && !composite(n)) n--;
  if (n < 4) return null;
  return { ...c, id: `${c.id}${SMALLER}`, total: n, ways: 1, instruction: makeArrayAsk(n) };
}

export function arrayGridLevers(c: ArrayGridChallenge | null, pulled: readonly string[]): WorkspaceLever[] {
  if (c?.total === undefined) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly MakeArrayMiss[], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
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

/** What the pulled help levers put on screen, for the tutor. */
export function leverFacts(c: ArrayGridChallenge | null, pulled: readonly string[]): string {
  if (c?.total === undefined) return '';
  return [
    pulled.includes(ROW_COUNTS_LEVER) && 'Beside each row on the grid is how many squares are in that row.',
    pulled.includes(SQUARE_COUNT_LEVER) && 'Under the grid is how many squares the learner has put in.',
  ].filter((s): s is string => !!s).join(' ');
}
