/**
 * sentence-analyzer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `sentenceAnalyzer.boss.ts`.
 * Every item is one grammar label said out loud (a word's part of speech, its job, its side of the sentence, or the
 * kind of sentence) the tutor judges against the key, so the boss is the spoken preset.
 */
import type { SpokenSentenceMiss } from './sentenceAnalyzerDomain';
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** identify_pos and label_all both name parts of speech (`sentenceSpokenMisses`). */
const POS_MISSES: readonly SpokenSentenceMiss[] = ['confusable_label', 'describing_word', 'other_label'];

export const sentenceAnalyzerCard = defineCard<SpokenSentenceMiss>({
  id: 'sentence-analyzer',
  grades: ['Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  modes: {
    identify_pos: { ...SPOKEN, misses: POS_MISSES },
    identify_role: { ...SPOKEN, misses: ['part_of_speech', 'named_the_side', 'confusable_label', 'other_label'] },
    label_all: { ...SPOKEN, misses: POS_MISSES },
    parse_structure: { ...SPOKEN, misses: ['other_side', 'other_label'] },
  },
  words: {
    job: 'say the grammar label for a printed sentence: the part of speech of the highlighted word, its job in the '
      + 'sentence, whether it is in the subject or the predicate, or what kind of sentence it is',
    answer: 'the spoken label',
    question: 'the sentence and the ask',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
