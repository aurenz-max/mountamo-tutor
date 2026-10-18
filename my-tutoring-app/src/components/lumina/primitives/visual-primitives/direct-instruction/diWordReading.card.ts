/**
 * Word reading's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `diWordReading.boss.ts`.
 * Every mode is one printed word read aloud; the tutor judges the read against the key.
 */
import type { SpokenWordReadingMiss } from './diWordReadingDomain';
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

const POSITION = ['first_sound_changed', 'middle_sound_changed', 'last_sound_changed'] as const;
const MIXED = ['letter_name', 'sounds_no_word', 'read_backwards', 'similar_word', ...POSITION] as const;

export const diWordReadingCard = defineCard<SpokenWordReadingMiss>({
  id: 'di-word-reading',
  grades: ['Kindergarten', 'Grade 1'],
  // The spoken read's known wrong answers (`diWordReadingSpokenMisses`). A decodable word is never named
  // `similar_word`, and a sight word never a position miss.
  modes: {
    cvc_reading: { ...SPOKEN, misses: ['letter_name', 'sounds_no_word', 'read_backwards', ...POSITION] },
    sight_word: { ...SPOKEN, misses: ['letter_name', 'sounds_no_word', 'similar_word'] },
    read_word: { ...SPOKEN, misses: MIXED },
    word_reading_review: { ...SPOKEN, misses: MIXED },
  },
  words: {
    job: 'read the printed word out loud',
    answer: 'the read',
    question: 'the ask',
    // Reading-is-the-answer, the model lever and the screen rule are the shared doctrine's; what counts as a read is
    // each item's key.
    special: 'The gold-ringed card shows one printed word: never read, blend or sound it out, even after a miss, and '
      + 'never name a word still to come. A decodable word may be blended from its letters; an irregular sight word is '
      + 'recalled whole, and its letters are not marking targets. demonstrate takes "word", or a letter target on a '
      + 'decodable word.',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
