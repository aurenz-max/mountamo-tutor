/**
 * The in-item levers on counting-board, as one lever set (`bossLevers.ts`; `/add-support-tiers`, handoff 21 M1, tables
 * qa/eval-reports/counting-board-levers-2026-09-28.md and qa/support-levers/m1-lever-tables-2026-09-28.md). No
 * real-learner evidence: the misses are what `countMiss` and `countingBoardSpokenMisses` name. Pure: the component
 * draws a pulled lever, the workspace publishes the set.
 *
 * The board's own checks (give_me_n, build_n, subitize_perceptual):
 * - `running_count` (marks): "Counted: k" (or "Put in: k") under the board, k = the learner's own objects so far. Never
 *   the number asked for, never "k of N". On give_me_n `showRunningCount` is where it starts; build_n starts bare.
 * - `count_tags` (marks): the order number on each object the learner took or put in. `showLastNumber` starts it on
 *   give_me_n.
 * - `line_up` (layout): the same objects in one row, none added or taken; not offered on a board already in a row or
 *   of one object. On recount_moved it is the count BEFORE the move: pulled after the move, the set comes back
 *   uncounted in a row and the last tap moves it again.
 * - `smaller_give` (easier): about half as many, at least two, from the same pile (or an empty scene of its size).
 * - `two_hands` (custom): the hand farthest from the group is gone; only when one hand is uniquely farthest.
 * - `pair_up` (custom): after a wrong hand, the group in a row above the fingers of that hand, joined pair by pair.
 * The spoken modes:
 * - `five_groups` (subitize, layout): rows of five; at K also another look at the flash.
 * - `tag_one_group` (group, marks): the first group numbered one to its size, only where the board draws its groups.
 * - `rows_apart` (compare, layout): each group in its own row, left edges lined up.
 * - `smaller_set` (count, recount_moved), `change_of_one` (take_away, add_more), `small_count_on` (count_on),
 *   `fewer_groups` (group), all easier: an ungraded board of the same kind through the family's own item gate,
 *   never the item's own answer and never another session answer where one is free. recount_moved's easier board
 *   moves after its last tap like the full one: holding the number across the move is the task, so no lever acts
 *   across it.
 * No lever's words or scene fact carry a digit, and the hand match's carry no number word (replay 09-28).
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { OFF_BY } from '../../../components/live-activity/boss';
import { countingBoardCard } from './countingBoard.card';
import { evalModeForKind, itemFromChallenge, makesASet, type CountingChallengeLike, type CountingItem } from './countingBoardDomain';

export const COUNT_LEVER = 'running_count';
export const TAGS_LEVER = 'count_tags';
export const LINE_LEVER = 'line_up';
export const SMALLER_LEVER = 'smaller_give';
export const HANDS_LEVER = 'two_hands';
export const PAIR_LEVER = 'pair_up';
export const FIVES_LEVER = 'five_groups';
export const GROUP_TAG_LEVER = 'tag_one_group';
export const ROWS_LEVER = 'rows_apart';
export const SMALLER_SET_LEVER = 'smaller_set';
export const CHANGE_ONE_LEVER = 'change_of_one';
export const COUNT_ON_LEVER = 'small_count_on';
export const FEWER_GROUPS_LEVER = 'fewer_groups';

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

/** The hand `pair_up` pairs with the group, or null: only the learner's own wrong pick, never the matching hand. */
export function pairedHand(item: CountingItem | null, missed: number | null | undefined): number | null {
  if (item?.kind !== 'subitize_perceptual' || missed == null) return null;
  return (HANDS as readonly number[]).includes(missed) && missed !== item.target ? missed : null;
}

/** The easier ask for a handover or a build, or null: about half as many from the same pile, never the number asked for. */
export function smallerGive(item: CountingItem): CountingItem | null {
  if (!makesASet(item.kind)) return null;
  const target = Math.ceil(item.target / 2);
  if (target < 2 || target >= item.target || (item.kind === 'give_me_n' && target >= item.count)) return null;
  return { ...item, id: `${item.id}~smaller`, target, ...(item.kind === 'build_n' ? { count: target } : {}) };
}

/** The practice board a spoken simplify lever opens, built through the family's own item gate; null when none fits. */
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

/** The spoken simplify lever of each kind that has one. */
const SPOKEN_EASIER: Partial<Record<CountingItem['kind'], string>> = {
  count_all: SMALLER_SET_LEVER, recount_moved: SMALLER_SET_LEVER, take_away: CHANGE_ONE_LEVER, add_more: CHANGE_ONE_LEVER,
  count_on: COUNT_ON_LEVER, group_count: FEWER_GROUPS_LEVER,
};

/**
 * The practice item on screen, from its id: a handover or build's easier ask (`~smaller`) or a spoken kind's easier
 * board (`~simpler`), rebuilt from its parent with the builder that made it. Null for a session item.
 */
export function practiceFromId(itemId: string, session: readonly CountingItem[]): CountingItem | null {
  const parent = session.find(i => itemId === `${i.id}~smaller` || itemId === `${i.id}~simpler`);
  if (!parent) return null;
  if (itemId.endsWith('~smaller')) return smallerGive(parent);
  const lever = SPOKEN_EASIER[parent.kind];
  return lever ? spokenPractice(parent, lever, session)?.item ?? null : null;
}

/** The lesson's lever state for the item on screen. */
export interface CountingLeverContext {
  /** The session item's arrangement as generated (a pulled row does not change it). */
  arrangement: string;
  /** Every item of the session: an easier board avoids their answers. */
  session: readonly CountingItem[];
  /** The learner's last wrong hand on this item (subitize_perceptual), which `pair_up` draws. */
  missed: number | null;
  pulled: readonly string[];
  /** recount_moved: the set has moved since it was counted. */
  moved: boolean;
}

const GIVE = ['give_me_n'], BUILD = ['build_n'], HAND = ['subitize_perceptual'];
const ROW_FACT = 'The objects are laid out in a single row.';
const ROW_DOES = 'Lays the objects out in a single row. The same objects; none are added or taken away.';
const EASIER_DOES = 'Opens an easier board of the same kind first. It is not graded; the full item comes back after it.';
const row = (item: CountingItem, { arrangement, pulled }: CountingLeverContext) =>
  lineUpChanges(item, arrangement) || pulled.includes(LINE_LEVER);
const spokenEasier = (lever: string) => (item: CountingItem, { session }: CountingLeverContext) =>
  spokenPractice(item, lever, session)?.item ?? null;

export const COUNTING_LEVERS = leverSet<CountingItem, CountingLeverContext>({
  modeOf: item => evalModeForKind(item.kind),
  missesOf: mode => countingBoardCard.modes[mode]?.misses ?? [],
  specs: [
    { id: COUNT_LEVER, type: 'marks', modes: GIVE, carrier: 'both', answers: ['one_short', 'one_over', 'gave_all'],
      when: 'The learner hands over one too many or one too few, or does not stop and hands over the whole pile.',
      does: 'Shows under the board how many objects the learner has taken so far. Never the number asked for.',
      fact: 'A count of the objects taken so far is under the board.' },
    { id: COUNT_LEVER, type: 'marks', modes: BUILD, carrier: 'both', answers: ['one_short', 'one_over'],
      when: 'The learner puts in one too many or one too few.',
      does: 'Shows under the scene how many objects the learner has put in so far. Never the number asked for.',
      fact: 'A count of the objects put in so far is under the board.' },
    { id: TAGS_LEVER, type: 'marks', modes: GIVE, answers: ['short_by_more', 'over_by_more'],
      when: 'The learner loses count while taking objects.',
      does: 'Puts a small number on each object the learner took, in the order taken.',
      fact: 'Each object taken carries a small number in the order taken.' },
    { id: TAGS_LEVER, type: 'marks', modes: BUILD, answers: ['short_by_more', 'over_by_more'],
      when: 'The learner loses count while putting objects in.',
      does: 'Puts a small number on each object the learner put in, in the order put in.',
      fact: 'Each object put in carries a small number in the order put in.' },
    { id: LINE_LEVER, type: 'layout', modes: GIVE, answers: ['short_by_more', 'over_by_more', 'gave_all'], offer: row,
      when: 'The learner loses track of which ones they took in a scattered pile.', does: ROW_DOES, fact: ROW_FACT },
    // A hand match: the row answers a hand one off; a far hand is what `two_hands` answers.
    { id: LINE_LEVER, type: 'layout', modes: HAND, answers: ['one_short', 'one_over'], offer: row,
      when: 'The learner cannot take the group in at a glance while it is spread out.', does: ROW_DOES, fact: ROW_FACT },
    { id: LINE_LEVER, type: 'layout', modes: ['count', 'count_on'], answers: ['skipped_a_number', 'one_short', 'one_over'], offer: row,
      when: item => `The learner skips or repeats ${item.objectWord} while counting a spread-out board.`, does: ROW_DOES, fact: ROW_FACT },
    { id: LINE_LEVER, type: 'layout', modes: ['take_away', 'add_more', 'recount_moved'], answers: ['one_short', 'one_over'], offer: row,
      when: item => `The learner skips or repeats ${item.objectWord} while counting a spread-out board.`,
      does: item => (item.kind === 'recount_moved'
        ? 'Puts the same objects back, uncounted, in a single row for a fresh count. After the last one is counted they move again.'
        : ROW_DOES),
      // recount_moved: the row holds only until the last tap; once the set has moved it is scattered again.
      fact: (_on: unknown, item, { moved }) => (item.kind === 'recount_moved' && moved ? '' : ROW_FACT) },
    { id: SMALLER_LEVER, type: 'easier', modes: GIVE, answers: ['short_by_more', 'over_by_more', 'gave_all'],
      when: 'The learner cannot make a set this big yet.', content: smallerGive,
      does: 'Opens an easier ask first, about half as many from the same pile. It is not graded; the full item comes back after it.' },
    { id: SMALLER_LEVER, type: 'easier', modes: BUILD, answers: ['short_by_more', 'over_by_more'],
      when: 'The learner cannot make a set this big yet.', content: smallerGive,
      does: 'Opens an easier ask first, about half as many on an empty scene. It is not graded; the full item comes back after it.' },
    { id: HANDS_LEVER, type: 'custom', modes: HAND, carrier: 'shown', answers: ['short_by_more', 'over_by_more'],
      why: 'It takes one wrong hand off the screen on this item rather than marking or rearranging what is there.',
      when: 'The learner picks a hand far from the group.',
      // No number words: the item is pre-numeric, and "one hand went away" spoke the answer to a group of one
      // in every replay sample (counting-board replay 09-28).
      does: 'The hand farthest from the group is gone. The match is still among the hands on screen.',
      content: droppedHand, fact: 'A hand was taken away; the rest are left to choose from.' },
    { id: PAIR_LEVER, type: 'custom', modes: HAND, carrier: 'shown', answers: ['one_short', 'one_over'],
      why: "It draws the learner's own wrong hand against the group, pair by pair; no stock type sets an answer beside the board.",
      offer: (item, { missed, pulled }) => pairedHand(item, missed) !== null || pulled.includes(PAIR_LEVER),
      when: 'The learner picks a hand next to the match, with a finger too many or too few.',
      // What is drawn only: whether a finger or an object is left without a partner is the learner's to see.
      does: 'Sets the group in a row above the fingers of the hand the learner picked last, with a line joining each object to the finger under it.',
      fact: 'Under the board, the group sits in a row above the fingers of the hand the learner picked last, a line joining each object to the finger under it.' },
    { id: FIVES_LEVER, type: 'layout', modes: ['subitize'], answers: OFF_BY,
      when: 'The learner cannot take the set in at a glance.',
      does: 'Rearranges the objects in rows of five and gives the learner another look. No numbers.',
      fact: 'The objects are arranged in rows of five for another look.' },
    // Only where the board draws the groups: numbering "the first group" of a scattered board would be arbitrary.
    { id: GROUP_TAG_LEVER, type: 'marks', modes: ['group'], answers: ['said_group_count', 'one_short', 'one_over'],
      offer: (item, { arrangement }) => arrangement === 'groups' && !!item.groupSize,
      when: 'The learner says how many groups there are, or loses count inside a group.',
      does: 'Numbers the objects of the first group only, from one to the size of one group. Never the total.',
      fact: 'The objects of the first group are numbered, only up to the size of one group.' },
    { id: ROWS_LEVER, type: 'layout', modes: ['compare'], answers: ['smaller_group', 'said_total', ...OFF_BY],
      when: 'The learner counts the smaller group, or both groups together.',
      does: 'Puts each group in its own row with the left edges lined up. No numbers.',
      fact: 'Each group is in its own row, left edges lined up.' },
    { id: SMALLER_SET_LEVER, type: 'easier', modes: ['count'], answers: ['short_by_more', 'over_by_more'],
      when: item => `The learner is far off counting this many ${item.objectWord}.`, does: EASIER_DOES,
      content: spokenEasier(SMALLER_SET_LEVER) },
    { id: SMALLER_SET_LEVER, type: 'easier', modes: ['recount_moved'], answers: OFF_BY,
      when: item => `The learner says a different number once the ${item.objectWord} have moved.`, does: EASIER_DOES,
      content: spokenEasier(SMALLER_SET_LEVER) },
    { id: CHANGE_ONE_LEVER, type: 'easier', modes: ['take_away', 'add_more'],
      answers: ['said_start', 'said_change', 'short_by_more', 'over_by_more'],
      when: item => `The learner says the number before the change, or the change itself, instead of the ${item.objectWord} `
        + `${item.kind === 'take_away' ? 'left' : 'altogether'}.`,
      does: EASIER_DOES, content: spokenEasier(CHANGE_ONE_LEVER) },
    { id: COUNT_ON_LEVER, type: 'easier', modes: ['count_on'], answers: ['said_start', 'short_by_more', 'over_by_more'],
      when: 'The learner stops at the covered group or loses count going on from it.', does: EASIER_DOES,
      content: spokenEasier(COUNT_ON_LEVER) },
    { id: FEWER_GROUPS_LEVER, type: 'easier', modes: ['group'], answers: ['short_by_more', 'over_by_more'],
      when: item => `The learner is far off with this many groups of ${item.objectWord}.`, does: EASIER_DOES,
      content: spokenEasier(FEWER_GROUPS_LEVER) },
  ],
});
