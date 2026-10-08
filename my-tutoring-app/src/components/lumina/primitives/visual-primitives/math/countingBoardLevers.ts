/**
 * The in-item levers on the counting board's gesture items (`/add-support-tiers`, handoff 21 M1).
 *
 * Pure: the component draws from these, the workspace publishes them, the tests hold each leak rule.
 * From the failure inventory (qa/eval-reports/counting-board-levers-2026-09-28.md; no real-learner
 * evidence, the misses below are what `countMiss` observes):
 * - give_me_n
 *   - `running_count` (help): "Counted: k" under the board, k = the objects handed over so far. Answers one off
 *     and handing over the whole pile. Leak rule: never the number asked for, never "k of N".
 *     `showRunningCount` is its starting position.
 *   - `count_tags` (help): the order number on each object the learner took. Answers losing track.
 *     Leak rule: tags only the learner's own taken objects. `showLastNumber` is its starting position.
 *   - `line_up` (help): the pile laid out in one row. Answers losing track in a scattered pile. Leak rule:
 *     the pile keeps its size; not offered when the pile is already a row.
 *   - `smaller_give` (simplify): an ungraded practice ask for about half as many from the same pile, then
 *     the full item. Leak rule: never the number asked for; at least 2; smaller than the pile.
 * - subitize_perceptual (no numerals anywhere)
 *   - `line_up` (help), as above, for a hand one off; not offered for a single object.
 *   - `two_hands` (help): the hand farthest from the group is taken away, two remain. Removing a choice is
 *     assisted work on the same item (ruling 3, handoff 21). Leak rule: the matching hand always remains;
 *     only when one hand is uniquely farthest (a group of 1 or 3).
 * The spoken kinds name no misses and declare no levers yet (help-first, handoff 21).
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { makesASet, type CountingItem } from './countingBoardDomain';

export const COUNT_LEVER = 'running_count';
export const TAGS_LEVER = 'count_tags';
export const LINE_LEVER = 'line_up';
export const SMALLER_LEVER = 'smaller_give';
export const HANDS_LEVER = 'two_hands';

/** The finger hands a hand-match item offers. */
export const HANDS = [1, 2, 3] as const;

/** Levers the tier starts pulled, from the payload's `showOptions`: a starting position, never a recorded pull. */
export function startLevers(item: CountingItem | null, show: { showRunningCount?: boolean; showLastNumber?: boolean }): string[] {
  // build_n starts bare: the child keeping count of what they put in IS the task; the levers come on a miss.
  if (item?.kind !== 'give_me_n') return [];
  return [...(show.showRunningCount !== false ? [COUNT_LEVER] : []), ...(show.showLastNumber !== false ? [TAGS_LEVER] : [])];
}

/** Leak rule for the row: lining up changes nothing when the pile is already a row, or is one object. */
export const lineUpChanges = (item: CountingItem, arrangement: string) => item.kind !== 'build_n' && arrangement !== 'line' && item.count > 1;

/** The hand taken away by `two_hands`, or null: the one farthest from the group, only when it is unique. */
export function droppedHand(item: CountingItem): number | null {
  if (item.kind !== 'subitize_perceptual') return null;
  const far = HANDS.filter(h => Math.abs(h - item.target) === Math.max(...HANDS.map(x => Math.abs(x - item.target))));
  return far.length === 1 && far[0] !== item.target ? far[0] : null;
}

/** The easier ask for `item`, or null: about half as many from the same pile, never the number asked for. */
export function smallerGive(item: CountingItem): CountingItem | null {
  if (!makesASet(item.kind)) return null;
  const target = Math.ceil(item.target / 2);
  if (target < 2 || target >= item.target || (item.kind === 'give_me_n' && target >= item.count)) return null;
  return { ...item, id: `${item.id}~smaller`, target, ...(item.kind === 'build_n' ? { count: target } : {}) };
}

export function countingBoardLevers(item: CountingItem | null, pulled: readonly string[], arrangement: string): WorkspaceLever[] {
  if (!item || item.answerKind !== 'gesture') return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: string[], when: string,
    does: string): WorkspaceLever => ({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  const row = lineUpChanges(item, arrangement) || pulled.includes(LINE_LEVER)
    ? [lever(LINE_LEVER, 'help', 'shown', item.kind === 'give_me_n' ? ['short_by_more', 'over_by_more', 'gave_all']
      // A hand match: the row answers a hand one off; a far hand is what `two_hands` answers.
      : ['one_short', 'one_over'],
      item.kind === 'give_me_n' ? 'The learner loses track of which ones they took in a scattered pile.'
        : 'The learner cannot take the group in at a glance while it is spread out.',
      'Lays the objects out in a single row. The same objects; none are added or taken away.')] : [];
  if (makesASet(item.kind)) return [
    lever(COUNT_LEVER, 'help', 'both', item.kind === 'build_n' ? ['one_short', 'one_over'] : ['one_short', 'one_over', 'gave_all'],
      item.kind === 'build_n' ? 'The learner puts in one too many or one too few.'
        : 'The learner hands over one too many or one too few, or does not stop and hands over the whole pile.',
      item.kind === 'build_n' ? 'Shows under the scene how many objects the learner has put in so far. Never the number asked for.'
        : 'Shows under the board how many objects the learner has taken so far. Never the number asked for.'),
    lever(TAGS_LEVER, 'help', 'shown', ['short_by_more', 'over_by_more'],
      item.kind === 'build_n' ? 'The learner loses count while putting objects in.' : 'The learner loses count while taking objects.',
      item.kind === 'build_n' ? 'Puts a small number on each object the learner put in, in the order put in.'
        : 'Puts a small number on each object the learner took, in the order taken.'),
    ...row,
    ...(smallerGive(item) ? [lever(SMALLER_LEVER, 'simplify', 'shown', item.kind === 'build_n' ? ['short_by_more', 'over_by_more'] : ['short_by_more', 'over_by_more', 'gave_all'],
      'The learner cannot make a set this big yet.',
      item.kind === 'build_n' ? 'Opens an easier ask first, about half as many on an empty scene. It is not graded; the full item comes back after it.'
        : 'Opens an easier ask first, about half as many from the same pile. It is not graded; the full item comes back after it.')] : []),
  ];
  return [...row, ...(droppedHand(item) !== null ? [lever(HANDS_LEVER, 'help', 'shown', ['short_by_more', 'over_by_more'],
    'The learner picks a hand far from the group.',
    // No number words: the item is pre-numeric, and "one hand went away" spoke the answer to a group of one
    // in every replay sample (counting-board replay 09-28).
    'The hand farthest from the group is gone. The match is still among the hands on screen.')] : [])];
}

/** What the pulled levers put on screen, as a scene fact. Never the number asked for or which hand matches. */
export function leverFacts(item: CountingItem | null, pulled: readonly string[]): string {
  if (!item) return '';
  const on = [
    pulled.includes(COUNT_LEVER) && makesASet(item.kind) && (item.kind === 'build_n' ? 'A count of the objects put in so far is under the board.' : 'A count of the objects taken so far is under the board.'),
    pulled.includes(TAGS_LEVER) && makesASet(item.kind) && (item.kind === 'build_n' ? 'Each object put in carries a small number in the order put in.' : 'Each object taken carries a small number in the order taken.'),
    pulled.includes(LINE_LEVER) && 'The objects are laid out in a single row.',
    pulled.includes(HANDS_LEVER) && item.kind === 'subitize_perceptual' && 'A hand was taken away; the rest are left to choose from.',
  ].filter((s): s is string => !!s);
  return on.join(' ');
}
