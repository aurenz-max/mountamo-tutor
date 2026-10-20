/**
 * vocabulary-explorer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `vocabularyExplorer.boss.ts`.
 * The learner first studies the word cards, then answers check items code builds from the words. Matching words to
 * meanings has no key: the activity checks the pairs, so explore (every item a match) is a board. Choosing the word
 * that completes a sentence or fits a situation is said (the tutor judges the word against the key) or tapped and
 * checked (the activity checks it), so apply is SAY_OR_SHOW; recall mixes a match with sentence items, split per item.
 */
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/**
 * What a wrong answer shows (`TeachingAttempt.miss`), from the work the check reads, by item kind. The same ids name a
 * spoken item's known wrong answers.
 * - match: `extra_meaning` (a word paired with the meaning that goes with none), `swapped_pair`, `several_wrong`;
 * - fill_blank, context: `related_word` (a word related to the answer), `wrong_kind_of_word` (another kind of word),
 *   `other_word`.
 */
export type MatchMiss = 'extra_meaning' | 'swapped_pair' | 'several_wrong';
export type ChoiceMiss = 'related_word' | 'wrong_kind_of_word' | 'other_word';
export type VocabMiss = MatchMiss | ChoiceMiss;
export const MATCH_MISSES = ['extra_meaning', 'swapped_pair', 'several_wrong'] as const satisfies readonly MatchMiss[];
export const CHOICE_MISSES = ['related_word', 'wrong_kind_of_word', 'other_word'] as const satisfies readonly ChoiceMiss[];

const MATCH = 'taps a word, then the meaning that goes with it, for every word, then presses Check Matches';
const PICK = 'may instead tap a word, then press Check Answer';

export const vocabularyExplorerCard = defineCard<VocabMiss>({
  id: 'vocabulary-explorer',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  modes: {
    explore: { answer: 'tap', judge: 'activity', flow: 'board', moves: MATCH, misses: MATCH_MISSES },
    recall: { ...SAY_OR_SHOW, moves: `${PICK}; on a matching item, ${MATCH}`, misses: [...MATCH_MISSES, ...CHOICE_MISSES] },
    apply: { ...SAY_OR_SHOW, moves: PICK, misses: CHOICE_MISSES },
  },
  words: {
    job: 'study word cards, then match words to their meanings or choose the word that fits a sentence or a situation',
    answer: 'their answer',
    question: 'the printed question, the sentence or situation, and the words and meanings shown',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
