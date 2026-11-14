/**
 * Letter sounds' card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `diLetterSounds.boss.ts`.
 * Every mode is one spoken sound the tutor judges against the key; the tutor's feedback is the only record of it.
 */
import type { SpokenDiLetterSoundMiss } from './diLetterSoundsDomain';
import { defineCard, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

const GRAPHEME = ['keyword_word', 'letter_name', 'added_vowel', 'other_sound'] as const;

export const diLetterSoundsCard = defineCard<SpokenDiLetterSoundMiss>({
  id: 'di-letter-sounds',
  grades: ['Kindergarten', 'Grade 1'],
  // The spoken sound's known wrong answers (`diLetterSoundSpokenMisses`). `last_sound` needs the printed word, so it
  // is named on first_sound_in_word only.
  modes: {
    letter_sound: { ...SPOKEN, misses: GRAPHEME },
    letter_sound_review: { ...SPOKEN, misses: GRAPHEME },
    first_sound_in_word: { ...SPOKEN, misses: ['keyword_word', 'letter_name', 'added_vowel', 'last_sound', 'other_sound'] },
  },
  words: {
    job: 'say the sound of the printed letter, or the first sound of the printed word, out loud',
    answer: 'the spoken sound',
    question: 'the ask and the printed word',
    // A name is not a sound, what a keyword counts for, and the "uh" after a stop are each item's key; the model lever
    // and the screen rule are the shared doctrine's.
    special: 'The gold-ringed card is the stimulus. Its keyword picture is drawn on an onset item, and on a letter item '
      + 'only as the keyword_picture lever. Never route this item\'s sound through its picture before the learner tries. '
      + 'Your feedback is the only record of the sound. demonstrate takes "stimulus" or "picture". '
      // USER 11-13: the tutor called a short "s"/"m" the letter's name and asked for a longer hold.
      + 'Judge the letter-to-sound link, not the length: a short sound is a right answer, so say so and move on. '
      + 'Call it the letter\'s name only when you heard the name with its vowel ("ess", "em"), not a short sound. '
      + 'Right after you ask, a hum like "mhm" or "mm" is the learner answering with the sound, never a yes.',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
