/**
 * Sentence reading's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `diSentenceReading.boss.ts`.
 * Every mode is one printed sentence read aloud; the tutor judges the read word by word against the key.
 */
import type { SpokenSentenceMiss } from './diSentenceReadingDomain';
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

// The spoken read's known wrong answers (`diSentenceSpokenMisses`), the same in every mode.
const READ = ['word_skip', 'word_swap'] as const;

export const diSentenceReadingCard = defineCard<SpokenSentenceMiss>({
  id: 'di-sentence-reading',
  grades: ['Kindergarten', 'Grade 1'],
  modes: {
    decodable_sentence: { ...SPOKEN, misses: READ },
    read_sentence: { ...SPOKEN, misses: READ },
    sentence_review: { ...SPOKEN, misses: READ },
    sight_phrase_sentence: { ...SPOKEN, misses: READ },
  },
  words: {
    job: 'read the printed sentence out loud, every word in order',
    answer: 'the read',
    question: 'the ask',
    // Every word in order, self-correction and no speed judging are each item's key; the model lever and the screen
    // rule are the shared doctrine's.
    special: 'The gold-ringed card shows one printed sentence: never read it, or any word of it, before the learner '
      + 'reads, and never re-read it after a miss; after credit you may say it back. demonstrate takes "sentence".',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
