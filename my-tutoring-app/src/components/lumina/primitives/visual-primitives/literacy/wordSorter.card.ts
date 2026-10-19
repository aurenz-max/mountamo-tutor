/**
 * Word sorter's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `wordSorter.boss.ts`.
 * Every mode is one spoken answer (a group name, or a partner from the printed bank) the tutor judges against the
 * key, so the boss is the spoken preset.
 */
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong spoken answer shows (`wordSorterSpokenMisses`, handoff 20 Part B). */
export type SpokenWordSorterMiss = 'other_group' | 'other_bank_word' | 'said_word_back';

const SORT = ['other_group', 'said_word_back'] as const;

export const wordSorterCard = defineCard<SpokenWordSorterMiss>({
  id: 'word-sorter',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2'],
  modes: {
    binary_sort: { ...SPOKEN, misses: SORT },
    ternary_sort: { ...SPOKEN, misses: SORT },
    // The word said back on a match has no lever by decision: the filed pairs answer another bank word only.
    match_pairs: { ...SPOKEN, misses: ['other_bank_word', 'said_word_back'], unanswered: ['said_word_back'] },
  },
  words: {
    job: 'say which group a word belongs with, or its partner from the printed word bank (an opposite, synonym, '
      + 'plural or rhyme)',
    answer: 'the answer',
    question: 'the word and the ask',
    special: 'Name the groups or bank words aloud only when the namingChoices fact allows it: at the hardest level '
      + 'for readers the learner reads them.',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
