/**
 * The in-item levers on base-ten-blocks, slice 1: build_number on the click mat (`/add-support-tiers`, handoff 21
 * M1; approved table qa/support-levers/m1-lever-tables-2026-09-28.md). operate and the spoken mat are later slices.
 * No real-learner evidence: the misses are what `plainMiss` observes, plus the catalog's documented struggles
 * (a column left with ten or more, too many in one column).
 *
 * - `column_counts` (help): the count of the learner's own blocks above each column. Answers one off, a ten off
 *   and swapped digits. Leak rule: counts the learner's blocks only; on build_number the number to build is
 *   printed already. The tier's `showColumnCounts` is its starting position.
 * - `blocks_total` (help): the running total of the learner's blocks. Answers far off. Leak rule: build_number only,
 *   never operate (there the total is the typed answer, contract R13). `showBlocksTotal` is its starting position.
 * - `ten_bracket` (help): a bracket round every column of the learner's that holds ten or more, with no count on
 *   it. Answers `not_traded_up`. Leak rule: only the learner's own full columns; offered only while one holds ten.
 * - `plainer_build` (simplify): an ungraded build of a plainer number first (same digit count, no zero, smaller
 *   digits), then the full item. Answers far off. Leak rule: never the number to build or its digits reversed.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';

export const COUNTS_LEVER = 'column_counts';
export const TOTAL_LEVER = 'blocks_total';
export const BRACKET_LEVER = 'ten_bracket';
export const PLAINER_LEVER = 'plainer_build';

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

/** Levers the tier starts pulled: a starting position, never a recorded pull. */
export function startLevers(type: string | undefined, show: { showColumnCounts?: boolean; showBlocksTotal?: boolean }): string[] {
  if (type !== 'build_number') return [];
  return [...(show.showColumnCounts ?? true ? [COUNTS_LEVER] : []), ...(show.showBlocksTotal ?? true ? [TOTAL_LEVER] : [])];
}

/** The learner's columns a `ten_bracket` draws round: only their own, only ten or more. */
export const bracketColumns = (columns: Readonly<Record<string, number>>) =>
  Object.entries(columns).filter(([, n]) => n >= 10).map(([place]) => place);

export function baseTenLevers(challenge: { type: string; targetNumber: number } | null, pulled: readonly string[],
  columns: Readonly<Record<string, number>> = {}): WorkspaceLever[] {
  if (challenge?.type !== 'build_number') return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: string[], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  return [
    lever(COUNTS_LEVER, 'help', ['one_short', 'one_over', 'one_ten_off', 'digits_swapped'],
      'The learner miscounts a column, or puts blocks in the wrong column.',
      'Shows above each column how many of its blocks the learner has placed.'),
    lever(TOTAL_LEVER, 'help', ['short_by_more', 'over_by_more'],
      'The learner cannot tell how far their blocks are from the number.',
      "Shows the total of the learner's blocks under the mat."),
    // Offered only while a column of the learner's holds ten: with none, a pull would change nothing on screen.
    ...(bracketColumns(columns).length > 0 || pulled.includes(BRACKET_LEVER) ? [lever(BRACKET_LEVER, 'help', ['not_traded_up'],
      'The learner leaves ten or more blocks in a column instead of trading them up.',
      'Draws a bracket round any column where the learner has ten or more blocks, with no count on it.')] : []),
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
  ].filter((s): s is string => !!s).join(' ');
}
