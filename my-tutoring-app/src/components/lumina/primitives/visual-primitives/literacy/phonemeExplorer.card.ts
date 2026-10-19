/**
 * Phoneme explorer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `phonemeExplorer.boss.ts`.
 * Every mode is one spoken answer (a card word, the blended word, a count, the new word) the tutor judges against the
 * key, so the boss is the spoken preset.
 */
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** Each mode's known wrong answers. isolate and blend emit theirs (`phonemeSpokenMisses`); the rest are declared for
 *  the ladder to come. */
export const PHONEME_MISSES = {
  isolate: ['echo_stimulus', 'letter_name'],
  ending: ['echo_stimulus', 'onset_match'],
  medial: ['echo_stimulus', 'onset_match'],
  blend: ['sounds_no_word', 'near_word'],
  segment: ['word_for_count', 'count_off_one'],
  manipulate: ['echo_original', 'other_position'],
} as const;
export type PhonemeMiss = typeof PHONEME_MISSES[keyof typeof PHONEME_MISSES][number];

// Every miss stays `unanswered` by decision until spoken misses are measured on every mode (J9).
const mode = <K extends keyof typeof PHONEME_MISSES>(k: K) =>
  ({ ...SPOKEN, misses: PHONEME_MISSES[k], unanswered: PHONEME_MISSES[k] });

export const phonemeExplorerCard = defineCard<PhonemeMiss>({
  id: 'phoneme-explorer',
  grades: ['Kindergarten', 'Grade 1'],
  modes: {
    isolate: mode('isolate'),
    ending: mode('ending'),
    medial: mode('medial'),
    blend: mode('blend'),
    segment: mode('segment'),
    manipulate: mode('manipulate'),
  },
  words: {
    job: 'say the card word that shares a beginning, ending or middle sound, the word some sounds blend into, how many '
      + 'sounds a word has, or the new word after one sound changes',
    answer: 'the answer',
    question: 'the ask',
    special: 'Every answer is a word or a count, never a bare sound. Before the learner has tried, never name the ending '
      + 'or middle sound and never break a segment word into its sounds. Read the cards aloud only when the namingCards '
      + 'fact allows it. A tapped card or tile asks you for that word or sound only.',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
