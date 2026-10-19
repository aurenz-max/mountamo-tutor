/**
 * Spoken practice's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `diSpokenPractice.boss.ts`.
 * Every mode is one spoken answer the tutor judges against the key; the observer reads the tutor's feedback.
 */
import type { SpokenPracticeMiss } from './diSpokenPracticeWorkspace';
import { defineCard, SPOKEN, SPOKEN_AUDIO, OFF_BY } from '../../../components/live-activity/boss';


export const diSpokenPracticeCard = defineCard<SpokenPracticeMiss>({
  id: 'di-spoken-practice',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3'],
  // Every mode's known wrong answers (`spokenPracticeSpokenMisses`), named by the `spoken_miss` observer. The explain
  // ids are advisory patterns; judging stays on meaning. `signature_error` exists only where the item has one.
  modes: {
    count_and_say: { ...SPOKEN, misses: ['skipped_a_number', ...OFF_BY] },
    compare_choice: { ...SPOKEN, misses: ['other_menu_word', 'said_same', 'said_thing_name'] },
    read_aloud: { ...SPOKEN, misses: ['misread', 'sounds_not_blended', 'letter_names', 'word_dropped'] },
    say_answer: { ...SPOKEN, misses: ['signature_error', 'said_stimulus'] },
    explain_concept: { ...SPOKEN, misses: ['read_back', 'named_only', 'bare_number', 'opposite_idea'] },
  },
  words: {
    job: 'answer each ask with a short word or phrase, or on explain items one idea in their own words',
    answer: 'the spoken answer',
    question: 'the ask, the names of the pictures and, on a pair, the whole word menu',
    // What the key holds, reading-is-the-answer, the model lever and the screen rule are the shared doctrine's
    // (JUDGED_BY.tutor, ROTATION_DOCTRINE, LEVER_TYPE_DOCTRINE.model); judging an idea on meaning is the meaning key's.
    special: 'The panel shows printed text, a picture, a group of pictures, two pictures, or nothing (the ask carries '
      + 'it); nothing on screen names the answer. The support fact says where levers start.',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
