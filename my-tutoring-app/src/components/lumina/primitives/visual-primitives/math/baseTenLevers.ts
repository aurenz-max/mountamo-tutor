/**
 * The in-item levers on base-ten-blocks' click mat (`/add-support-tiers`, handoff 21 M1; approved table
 * qa/support-levers/m1-lever-tables-2026-09-28.md): build_number (slice 1) and operate (slice 2). The spoken mat is
 * a later slice. No real-learner evidence: the misses are what `plainMiss` observes, plus the catalog's documented
 * struggles (a column left with ten or more, too many in one column, a lost carry).
 *
 * build_number:
 * - `column_counts` (help): the count of the learner's own blocks above each column. Answers one off, a ten off
 *   and swapped digits. Leak rule: counts the learner's blocks only; on build_number the number to build is
 *   printed already. The tier's `showColumnCounts` is its starting position.
 * - `blocks_total` (help): the running total of the learner's blocks. Answers far off. Leak rule: build_number only,
 *   never operate (there the total is the typed answer, contract R13). `showBlocksTotal` is its starting position.
 * - `ten_bracket` (help): a bracket round every column of the learner's that holds ten or more, with no count on
 *   it. Answers `not_traded_up`. Leak rule: only the learner's own full columns; offered only while one holds ten.
 * - `plainer_build` (simplify): an ungraded build of a plainer number first (same digit count, no zero, smaller
 *   digits), then the full item. Answers far off. Leak rule: never the number to build or its digits reversed.
 *
 * operate (add_with_blocks, subtract_with_blocks; the result is typed, so the total is never a lever, R13):
 * - `column_counts` (help): as above; answers one short and one over. `showColumnCounts` is its starting position.
 * - `ten_bracket` (help): as above; answers a ten off, which is what a carry left as ten ones reads as.
 * - `single_regroup` (simplify): an ungraded operation first with one carry or borrow fewer (floor one), new
 *   operands, the same places, M > S; then the full item. Answers a ten off and far off. Leak rule: never the
 *   item's operands (either order) or its result. `digits_swapped` has no lever on operate.
 *
 * build_two_ways (open build, references/build-mode.md). Starts bare at every tier: keeping track of the blocks is the
 * task, so the counts come on a miss, and no total is ever offered (the value of the build IS the skill).
 * - `column_counts` (help): as above, on the learner's own blocks. Answers every value miss.
 * - `ten_model` (help): beside the mat, one ten-stick next to ten ones cubes (and one hundred-flat next to ten
 *   ten-sticks when the mat has hundreds), with no count. Answers `same_as_first`: a learner who cannot find a second
 *   way has not seen that one bigger block can be swapped for ten smaller ones.
 * - `smaller_number` (simplify): the same two-ways build on about half the number (at least ten, so a second way
 *   exists), ungraded, then the full item on an empty mat. Answers far off. Leak rule: never the number or its reversal.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { analyzeBorrows, buildAdditionOperands, buildSubtractionOperands, countCarries } from './baseTenOperands';

export const COUNTS_LEVER = 'column_counts';
export const TOTAL_LEVER = 'blocks_total';
export const BRACKET_LEVER = 'ten_bracket';
export const PLAINER_LEVER = 'plainer_build';
export const SIMPLER_OP_LEVER = 'single_regroup';
export const TEN_MODEL_LEVER = 'ten_model';
export const SMALLER_LEVER = 'smaller_number';

/** The smaller number to show two ways first, or null: about half, at least ten, never the number or its reversal. */
export function smallerTwoWaysNumber(target: number): number | null {
  if (!Number.isInteger(target) || target <= 10) return null;
  const half = Math.max(10, Math.round(target / 2));
  // Half of 73 rounds to 37, its reversal: step down one.
  const smaller = half === reversed(target) && half > 10 ? half - 1 : half;
  return smaller < target && smaller !== reversed(target) ? smaller : null;
}

const reversed = (n: number) => Number(String(n).split('').reverse().join(''));

/** The plainer number to build first, or null: same digit count, every digit about half and at least one. */
export function plainerNumber(target: number): number | null {
  if (!Number.isInteger(target) || target < 2) return null;
  const digits = String(target).split('').map(Number).map(d => Math.max(1, Math.ceil(d / 2)));
  let plain = Number(digits.join(''));
  if (plain === target || plain === reversed(target)) {
    const ones = digits[digits.length - 1];
    digits[digits.length - 1] = ones < 9 ? ones + 1 : ones - 1;
    plain = Number(digits.join(''));
  }
  return plain !== target && plain !== reversed(target) && String(plain).length === String(target).length ? plain : null;
}

export const isOperate = (type: string | undefined) => type === 'add_with_blocks' || type === 'subtract_with_blocks';

export interface LeverItem { type: string; targetNumber: number; secondNumber?: number }
export interface SimplerOperation { first: number; second: number; targetNumber: number; instruction: string }

/** An operate item's operands, place count and carries or borrows; null when they do not reconcile. */
export function operateShape(item: LeverItem): { first: number; second: number; places: number; regroups: number } | null {
  const second = item.secondNumber;
  if (!isOperate(item.type) || !Number.isInteger(item.targetNumber) || !Number.isInteger(second) || (second as number) <= 0) return null;
  const add = item.type === 'add_with_blocks';
  const first = add ? item.targetNumber - (second as number) : item.targetNumber + (second as number);
  if (first <= 0 || (!add && first <= (second as number))) return null;
  const places = String(Math.max(first, second as number)).length;
  const regroups = add ? countCarries(first, second as number, places) : analyzeBorrows(first, second as number, places).borrows;
  return { first, second: second as number, places, regroups };
}

export const operateInstruction = (type: string, first: number, second: number) =>
  type === 'add_with_blocks' ? `Add ${first} + ${second} using blocks.` : `Subtract ${second} from ${first} using blocks.`;

/** A seeded source, so an item always gets the same practice operation. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The operation to do first: one carry or borrow fewer, never below one; null when the item has one or none. */
export function simplerOperation(item: LeverItem): SimplerOperation | null {
  const shape = operateShape(item);
  if (!shape || shape.places < 2 || shape.regroups < 2) return null;
  const add = item.type === 'add_with_blocks';
  // The builders keep the top column free of a regroup, so a place count caps the regroups it can hold.
  const want = Math.min(shape.regroups - 1, shape.places - 1);
  const rand = seeded(shape.first * 1009 + shape.second * 31 + (add ? 1 : 2));
  for (let tries = 0; tries < 40; tries++) {
    const [first, second] = add ? buildAdditionOperands(shape.places, want, false, rand)
      : buildSubtractionOperands(shape.places, want, false, rand);
    const targetNumber = add ? first + second : first - second;
    const built = operateShape({ type: item.type, targetNumber, secondNumber: second });
    const sameOperands = [first, second].sort().join() === [shape.first, shape.second].sort().join();
    if (built?.regroups === want && built.places === shape.places && !sameOperands && targetNumber !== item.targetNumber)
      return { first, second, targetNumber, instruction: operateInstruction(item.type, first, second) };
  }
  return null;
}

/** Levers the tier starts pulled: a starting position, never a recorded pull. */
export function startLevers(type: string | undefined, show: { showColumnCounts?: boolean; showBlocksTotal?: boolean }): string[] {
  if (isOperate(type)) return show.showColumnCounts ?? true ? [COUNTS_LEVER] : [];
  if (type !== 'build_number') return [];
  return [...(show.showColumnCounts ?? true ? [COUNTS_LEVER] : []), ...(show.showBlocksTotal ?? true ? [TOTAL_LEVER] : [])];
}

/** The learner's columns a `ten_bracket` draws round: only their own, only ten or more. */
export const bracketColumns = (columns: Readonly<Record<string, number>>) =>
  Object.entries(columns).filter(([, n]) => n >= 10).map(([place]) => place);

export function baseTenLevers(challenge: LeverItem | null, pulled: readonly string[],
  columns: Readonly<Record<string, number>> = {}): WorkspaceLever[] {
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: string[], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  // Offered only while a column of the learner's holds ten: with none, a pull would change nothing on screen.
  const bracket = (answers: string[], when: string) => bracketColumns(columns).length > 0 || pulled.includes(BRACKET_LEVER)
    ? [lever(BRACKET_LEVER, 'help', answers, when,
      'Draws a bracket round any column where the learner has ten or more blocks, with no count on it.')] : [];
  const counts = (answers: string[], when: string) => lever(COUNTS_LEVER, 'help', answers, when,
    'Shows above each column how many of its blocks the learner has placed.');

  if (challenge && isOperate(challenge.type)) return [
    counts(['one_short', 'one_over'], 'The learner miscounts the blocks after modelling the operation.'),
    ...bracket(['one_ten_off'], 'The learner has ten or more blocks in a column and reads the result without trading them.'),
    ...(simplerOperation(challenge) !== null ? [lever(SIMPLER_OP_LEVER, 'simplify', ['one_ten_off', 'short_by_more', 'over_by_more'],
      'The learner loses track when an operation needs several trades.',
      'Opens an easier operation first, needing fewer trades, with the same number of places. It is not graded; the full item comes back after it.')] : []),
  ];
  if (challenge?.type === 'build_two_ways') return [
    counts(['one_short', 'one_over', 'one_ten_off', 'digits_swapped', 'short_by_more', 'over_by_more'],
      'The learner miscounts the blocks in a column, so the build is not the number.'),
    lever(TEN_MODEL_LEVER, 'help', ['same_as_first'],
      'The learner cannot find a second way and builds the first way again.',
      'Shows beside the mat a ten-stick next to the ones cubes it is worth, and a hundred-flat next to the ten-sticks it is worth, with no count.'),
    ...(smallerTwoWaysNumber(challenge.targetNumber) !== null ? [lever(SMALLER_LEVER, 'simplify', ['short_by_more', 'over_by_more'],
      'The learner cannot build a number this big yet.',
      'Opens a smaller number to build both ways first. It is not graded; the full item comes back after it, on an empty mat.')] : []),
  ];
  if (challenge?.type !== 'build_number') return [];
  return [
    counts(['one_short', 'one_over', 'one_ten_off', 'digits_swapped'],
      'The learner miscounts a column, or puts blocks in the wrong column.'),
    lever(TOTAL_LEVER, 'help', ['short_by_more', 'over_by_more'],
      'The learner cannot tell how far their blocks are from the number.',
      "Shows the total of the learner's blocks under the mat."),
    ...bracket(['not_traded_up'], 'The learner leaves ten or more blocks in a column instead of trading them up.'),
    ...(plainerNumber(challenge.targetNumber) !== null ? [lever(PLAINER_LEVER, 'simplify', ['short_by_more', 'over_by_more'],
      'The learner cannot build a number this big yet.',
      'Opens an easier number to build first, with the same number of places. It is not graded; the full item comes back after it.')] : []),
  ];
}

/** What the pulled levers put on screen, as a scene fact. Never a count or the number to build. */
export function leverFacts(pulled: readonly string[], started: readonly string[]): string {
  const live = pulled.filter(id => !started.includes(id));
  return [
    live.includes(COUNTS_LEVER) && "Each column shows how many of the learner's blocks are in it.",
    live.includes(TOTAL_LEVER) && "The total of the learner's blocks is under the mat.",
    pulled.includes(BRACKET_LEVER) && 'Any column holding ten or more blocks has a bracket round it.',
    pulled.includes(TEN_MODEL_LEVER) && 'Beside the mat, a big block is shown next to the smaller blocks it is worth.',
  ].filter((s): s is string => !!s).join(' ');
}
