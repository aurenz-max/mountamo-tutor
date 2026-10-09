/**
 * The in-item levers on the counting board's spoken kinds (`/add-support-tiers`, handoff 21 M1 spoken slice; table
 * qa/support-levers/m1-lever-tables-2026-09-28.md). No real-learner evidence: the misses are what
 * `countingBoardSpokenMisses` names (the numbers on this board, then off by one or more).
 *
 * Help (the board shows more; the question is unchanged):
 * - `line_up` (count, count_on, take_away, add_more, recount_moved): the board's objects in one row. Answers a skipped
 *   number and one off. Leak rule: the same objects, none added or taken; not offered when the board is already a row.
 *   On recount_moved the row is for the count BEFORE the move: a pull after the move puts the board back, uncounted,
 *   in a row for a fresh count, and the last tap moves it again (scattered). The number is still the learner's to hold.
 * - `five_groups` (subitize): the objects in rows of five; at K it is also a new look at the flash. Answers off by
 *   one or more. Leak rule: the same objects, no numeral.
 * - `tag_one_group` (group): the objects of the FIRST group numbered one to its size. Answers the number of groups
 *   said, and one off. Leak rule: numbers stop at one group's size, never the total (a group board has two or more).
 * - `rows_apart` (compare): each group in its own row, left edges aligned. Answers the smaller group and both
 *   groups together. Leak rule: no numeral; the longer row is visible, the count is still the learner's to say.
 * Simplify (an ungraded easier board of the same kind, then the full item; never the item's own answer and never
 * another item's in the session):
 * - `smaller_set` (count): about half as many, at least two. recount_moved: about half as many, at least three, and
 *   the easier board moves after its last tap like the full one (the mode's defining property: hold the number
 *   across the move).
 * - `change_of_one` (take_away, add_more): the same start, a change of one.
 * - `small_count_on` (count_on): the same start, two more.
 * - `fewer_groups` (group): two groups of the same size.
 * recount_moved has no lever that helps across the move (holding the number IS the task, table 09-28); its levers
 * act on the count before the move and on the size of the set (class sweep 2026-10-08).
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { itemFromChallenge, type CountingChallengeLike, type CountingItem } from './countingBoardDomain';
import { LINE_LEVER, lineUpChanges } from './countingBoardLevers';

export const FIVES_LEVER = 'five_groups';
export const GROUP_TAG_LEVER = 'tag_one_group';
export const ROWS_LEVER = 'rows_apart';
export const SMALLER_SET_LEVER = 'smaller_set';
export const CHANGE_ONE_LEVER = 'change_of_one';
export const COUNT_ON_LEVER = 'small_count_on';
export const FEWER_GROUPS_LEVER = 'fewer_groups';
export const SPOKEN_SIMPLIFY = new Set([SMALLER_SET_LEVER, CHANGE_ONE_LEVER, COUNT_ON_LEVER, FEWER_GROUPS_LEVER]);

const OFF_BY = ['one_short', 'one_over', 'short_by_more', 'over_by_more'];
const LINE_KINDS = new Set(['count_all', 'count_on', 'take_away', 'add_more', 'recount_moved']);

/** The practice board a simplify lever opens, built through the family's own item gate; null when none fits. */
export function spokenPractice(item: CountingItem, lever: string, session: readonly CountingItem[]):
    { item: CountingItem; challenge: CountingChallengeLike } | null {
  const candidates: Array<Omit<CountingChallengeLike, 'id' | 'type'>> = [];
  if (lever === SMALLER_SET_LEVER && item.kind === 'count_all')
    for (let n = Math.ceil(item.count / 2); n >= 2; n--) candidates.push({ count: n, targetAnswer: n });
  if (lever === SMALLER_SET_LEVER && item.kind === 'recount_moved')
    for (let n = Math.ceil(item.count / 2); n >= 3; n--) candidates.push({ count: n, targetAnswer: n });
  if (lever === CHANGE_ONE_LEVER && (item.kind === 'take_away' || item.kind === 'add_more') && (item.changeBy ?? 0) > 1)
    for (let start = item.count; start >= (item.kind === 'take_away' ? 3 : 2); start--)
      candidates.push({ count: start, changeBy: 1, targetAnswer: item.kind === 'take_away' ? start - 1 : start + 1 });
  if (lever === COUNT_ON_LEVER && item.kind === 'count_on' && item.startFrom !== undefined && item.target - item.startFrom >= 3)
    candidates.push({ count: item.startFrom + 2, startFrom: item.startFrom, targetAnswer: item.startFrom + 2 });
  if (lever === FEWER_GROUPS_LEVER && item.kind === 'group_count' && item.groupSize && item.count / item.groupSize >= 3)
    candidates.push({ count: 2 * item.groupSize, groupSize: item.groupSize, targetAnswer: 2 * item.groupSize });
  // First a board whose answer no session item has; else one that is at least not this item's own answer.
  for (const taken of [new Set([item, ...session].map(i => i.target)), new Set([item.target])])
    for (const c of candidates) {
      if (taken.has(c.targetAnswer)) continue;
      const challenge: CountingChallengeLike = { ...c, id: `${item.id}~simpler`, type: item.kind };
      const built = itemFromChallenge(challenge, { objectWord: item.objectWord, objectSingular: item.objectSingular });
      if (built) return { item: built, challenge };
    }
  return null;
}

export function countingBoardSpokenLevers(item: CountingItem | null, pulled: readonly string[], arrangement: string,
  session: readonly CountingItem[]): WorkspaceLever[] {
  if (!item || item.answerKind !== 'voice') return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: string[], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  const simpler = (id: string, answers: string[], when: string) => spokenPractice(item, id, session)
    ? [lever(id, 'simplify', answers, when, 'Opens an easier board of the same kind first. It is not graded; the full item comes back after it.')] : [];
  const noun = item.objectWord;
  const row = LINE_KINDS.has(item.kind) && (lineUpChanges(item, arrangement) || pulled.includes(LINE_LEVER))
    ? [lever(LINE_LEVER, 'help', [...(item.kind === 'count_all' || item.kind === 'count_on' ? ['skipped_a_number'] : []), 'one_short', 'one_over'],
      `The learner skips or repeats ${noun} while counting a spread-out board.`,
      item.kind === 'recount_moved'
        ? 'Puts the same objects back, uncounted, in a single row for a fresh count. After the last one is counted they move again.'
        : 'Lays the objects out in a single row. The same objects; none are added or taken away.')] : [];
  switch (item.kind) {
    case 'count_all': return [...row, ...simpler(SMALLER_SET_LEVER, ['short_by_more', 'over_by_more'],
      `The learner is far off counting this many ${noun}.`)];
    case 'recount_moved': return [...row, ...simpler(SMALLER_SET_LEVER, OFF_BY,
      `The learner says a different number once the ${noun} have moved.`)];
    case 'count_on': return [...row, ...simpler(COUNT_ON_LEVER, ['said_start', 'short_by_more', 'over_by_more'],
      'The learner stops at the covered group or loses count going on from it.')];
    case 'take_away': case 'add_more': return [...row, ...simpler(CHANGE_ONE_LEVER, ['said_start', 'said_change', 'short_by_more', 'over_by_more'],
      `The learner says the number before the change, or the change itself, instead of the ${noun} ${item.kind === 'take_away' ? 'left' : 'altogether'}.`)];
    case 'subitize': return [lever(FIVES_LEVER, 'help', OFF_BY,
      'The learner cannot take the set in at a glance.',
      'Rearranges the objects in rows of five and gives the learner another look. No numbers.')];
    case 'group_count': return [
      // Only where the board draws the groups: numbering "the first group" of a scattered board would be arbitrary.
      ...(arrangement !== 'groups' || !item.groupSize ? [] : [lever(GROUP_TAG_LEVER, 'help', ['said_group_count', 'one_short', 'one_over'],
        'The learner says how many groups there are, or loses count inside a group.',
        'Numbers the objects of the first group only, from one to the size of one group. Never the total.')]),
      ...simpler(FEWER_GROUPS_LEVER, ['short_by_more', 'over_by_more'], `The learner is far off with this many groups of ${noun}.`)];
    case 'compare': return [lever(ROWS_LEVER, 'help', ['smaller_group', 'said_total', ...OFF_BY],
      'The learner counts the smaller group, or both groups together.',
      'Puts each group in its own row with the left edges lined up. No numbers.')];
    default: return [];
  }
}

/** What the pulled levers put on screen, as a scene fact. Never the answer or a count of the board. */
export function spokenLeverFacts(item: CountingItem | null, pulled: readonly string[], board: { moved?: boolean } = {}): string {
  if (!item || item.answerKind !== 'voice') return '';
  return [
    // recount_moved: the row holds only until the last tap; once the set has moved it is scattered again.
    pulled.includes(LINE_LEVER) && !(item.kind === 'recount_moved' && board.moved) && 'The objects are laid out in a single row.',
    pulled.includes(FIVES_LEVER) && 'The objects are arranged in rows of five for another look.',
    pulled.includes(GROUP_TAG_LEVER) && 'The objects of the first group are numbered, only up to the size of one group.',
    pulled.includes(ROWS_LEVER) && 'Each group is in its own row, left edges lined up.',
  ].filter((s): s is string => !!s).join(' ');
}
