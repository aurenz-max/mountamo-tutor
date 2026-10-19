/**
 * The in-item levers on word-sorter (`/add-support-tiers`, handoff 22 L4), as one lever set (`bossLevers.ts`). The
 * answer is spoken: a group name, or a partner word from the printed bank.
 *
 * - `group_pictures` (sorts): the picture cue on EVERY group mat, so the groups become things to choose between. Not
 *   offered when a group picture is the item's own picture (`groupPicturesLeak`): that is picture matching, not
 *   sorting.
 * - `filed_examples`: the words the learner has already had credited in this challenge, on their mats (or as pairs).
 *   Only the learner's own credited work, never the current word. Offered once something is filed.
 *
 * The tier is the starting position (`itemsFromChallenge`): a lever is offered only where the tier withdrew the aid.
 * No simplify: a simpler word needs a word pool keyed by the generated group labels, which does not exist, and
 * another session word would spend a later item. `said_word_back` on match_pairs has no lever by decision.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { wordSorterCard } from './wordSorter.card';
import type { WordSorterItem } from './wordSorterDomain';

export const PICTURES_LEVER = 'group_pictures';
export const FILED_LEVER = 'filed_examples';

/** What the levers read beside the item: how many items of this challenge are already credited. */
export interface WordSorterLeverContext { filed: number }

/** Leak rule: a group picture that is the item's own picture answers the sort by matching. */
export const groupPicturesLeak = (item: WordSorterItem) =>
  !!item.emoji && item.choiceEmojis.some(e => e === item.emoji);

/** The tier's aids plus the pulled levers. */
export const aidsOnScreen = (item: WordSorterItem, pulled: readonly string[]) => ({
  showChoiceEmojis: item.showChoiceEmojis || pulled.includes(PICTURES_LEVER),
  showFiledWords: item.showFiledWords || pulled.includes(FILED_LEVER),
});

const SORTS = ['binary_sort', 'ternary_sort'];
const FILED_WHY = 'Shows only the learner\'s own credited work in this challenge, which no stock type does.';
const filedOffer = (item: WordSorterItem, ctx: WordSorterLeverContext) => !item.showFiledWords && ctx.filed > 0;

export const WORD_SORTER_LEVERS = leverSet<WordSorterItem, WordSorterLeverContext>({
  modeOf: item => item.mode,
  missesOf: mode => wordSorterCard.modes[mode].misses,
  answersOf: item => [item.answer],
  specs: [
    { id: PICTURES_LEVER, type: 'meaning', modes: SORTS, carrier: 'shown', answers: ['other_group', 'said_word_back'],
      when: 'The learner names another group, or says the word back instead of a group.',
      does: 'Puts a picture on every group mat. Marks no group as right.',
      offer: item => !item.showChoiceEmojis && item.choiceEmojis.every(Boolean) && !groupPicturesLeak(item),
      fact: 'a picture on every group mat' },
    { id: FILED_LEVER, type: 'custom', modes: SORTS, carrier: 'shown', why: FILED_WHY, answers: ['other_group'],
      when: 'The learner names another group.',
      does: 'Shows the words the learner already sorted, on their mats. Not this word.',
      offer: filedOffer, fact: 'the words the learner already sorted, on their mats' },
    { id: FILED_LEVER, type: 'custom', modes: ['match_pairs'], carrier: 'shown', why: FILED_WHY, answers: ['other_bank_word'],
      when: 'The learner names another word from the bank.',
      does: 'Shows the pairs the learner already made. Not this word.',
      offer: filedOffer, fact: 'the pairs the learner already made' },
  ],
});
