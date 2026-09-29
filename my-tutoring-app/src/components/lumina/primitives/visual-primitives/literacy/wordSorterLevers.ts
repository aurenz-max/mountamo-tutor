/**
 * The in-item levers on word-sorter (`/add-support-tiers`, handoff 22 L4). The answer is spoken: a group name, or a
 * partner word from the printed bank.
 *
 * - `group_pictures` (help, shown; sorts): the picture cue on EVERY group mat. Answers another group and the word said
 *   back (the groups become things to choose between). Not offered when a group picture is the item's own picture
 *   (`groupPicturesLeak`): that is picture matching, not sorting.
 * - `filed_examples` (help, shown): the words the learner has already had credited in this challenge, on their mats
 *   (or as pairs). Only the learner's own credited work, never the current word. Offered once something is filed.
 *
 * The tier is the starting position (`itemsFromChallenge`): a lever is offered only where the tier withdrew the aid.
 * No simplify: a simpler word needs a word pool keyed by the generated group labels, which does not exist, and
 * another session word would spend a later item. `said_word_back` on match_pairs has no lever by decision.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { WordSorterItem } from './wordSorterScript';
import type { SpokenWordSorterMiss } from './wordSorterWorkspace';

export const PICTURES_LEVER = 'group_pictures';
export const FILED_LEVER = 'filed_examples';

/** Leak rule: a group picture that is the item's own picture answers the sort by matching. */
export const groupPicturesLeak = (item: WordSorterItem) =>
  !!item.emoji && item.choiceEmojis.some(e => e === item.emoji);

const sort = (item: WordSorterItem) => item.mode !== 'match_pairs';

/** The tier's aids plus the pulled levers. */
export const aidsOnScreen = (item: WordSorterItem, pulled: readonly string[]) => ({
  showChoiceEmojis: item.showChoiceEmojis || pulled.includes(PICTURES_LEVER),
  showFiledWords: item.showFiledWords || pulled.includes(FILED_LEVER),
});

/** What the pulled levers put on screen, for the tutor. Never which group or partner is right. */
export function leversOnScreen(item: WordSorterItem, pulled: readonly string[]): string | null {
  const lines = [
    pulled.includes(PICTURES_LEVER) && !item.showChoiceEmojis && 'a picture on every group mat',
    pulled.includes(FILED_LEVER) && !item.showFiledWords
      && (sort(item) ? 'the words the learner already sorted, on their mats' : 'the pairs the learner already made'),
  ].filter(Boolean);
  return lines.length ? lines.join('; ') : null;
}

/** The levers this item declares, with their state. `filed` = credited items of this challenge so far. */
export function wordSorterLevers(item: WordSorterItem | null, pulled: readonly string[], filed: number): WorkspaceLever[] {
  if (!item) return [];
  const levers: WorkspaceLever[] = [];
  if (sort(item) && !item.showChoiceEmojis && item.choiceEmojis.every(Boolean) && !groupPicturesLeak(item))
    levers.push({ id: PICTURES_LEVER, kind: 'help', carrier: 'shown', pulled: pulled.includes(PICTURES_LEVER),
      answers: ['other_group', 'said_word_back'] satisfies SpokenWordSorterMiss[],
      when: 'The learner names another group, or says the word back instead of a group.',
      does: 'Puts a picture on every group mat. Marks no group as right.' });
  if (!item.showFiledWords && filed > 0)
    levers.push({ id: FILED_LEVER, kind: 'help', carrier: 'shown', pulled: pulled.includes(FILED_LEVER),
      answers: [sort(item) ? 'other_group' : 'other_bank_word'] satisfies SpokenWordSorterMiss[],
      when: sort(item) ? 'The learner names another group.' : 'The learner names another word from the bank.',
      does: sort(item) ? 'Shows the words the learner already sorted, on their mats. Not this word.'
        : 'Shows the pairs the learner already made. Not this word.' });
  return levers;
}
