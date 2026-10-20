/**
 * Letter-sound link's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `letterSoundLink.boss.ts`.
 * see_hear (say the printed letter's sound) and keyword_match (say which of two pictures starts with it) are one
 * spoken answer the tutor judges against the key. hear_see is one tap: the tutor says a sound, the learner taps one of
 * two letters, and the activity checks the tap; a letter NAME has no reliable judge, so the letter is touched.
 */
import { defineCard, SPOKEN, SPOKEN_AUDIO, TAP_ONE } from '../../../components/live-activity/boss';

/** What a wrong hear_see tap shows (`letterSoundMiss`): both vowels, a voicing partner (t/d, p/b, s/z, f/v, k or
 *  c/g), or another letter. */
export type LetterSoundMiss = 'other_short_vowel' | 'voicing_partner' | 'other_letter';
/** What a wrong spoken answer shows (`letterSoundSpokenMisses`). */
export type SpokenLetterMiss = 'letter_name' | 'keyword_word' | 'added_vowel' | 'other_sound' | 'other_picture' | 'said_the_sound';

/** The tap's own check, and the two spoken modes' known wrong answers, by mode. */
export const LETTER_SOUND_MISSES = {
  see_hear: ['letter_name', 'keyword_word', 'added_vowel', 'other_sound'],
  hear_see: ['other_short_vowel', 'voicing_partner', 'other_letter'],
  keyword_match: ['other_picture', 'letter_name', 'said_the_sound'],
} as const satisfies Record<string, readonly (LetterSoundMiss | SpokenLetterMiss)[]>;

export const letterSoundLinkCard = defineCard<LetterSoundMiss | SpokenLetterMiss>({
  id: 'letter-sound-link',
  grades: ['Kindergarten', 'Grade 1'],
  modes: {
    // Another letter's sound does not separate this letter from the one said; only its own keyword does, and that is
    // never shown before credit.
    see_hear: { ...SPOKEN, misses: LETTER_SOUND_MISSES.see_hear, unanswered: ['other_sound'] },
    hear_see: { ...TAP_ONE, misses: LETTER_SOUND_MISSES.hear_see },
    keyword_match: { ...SPOKEN, misses: LETTER_SOUND_MISSES.keyword_match },
  },
  words: {
    job: 'say the sound a printed letter makes, tap which of two letters makes a sound you say, or say which of two '
      + 'pictures starts with a printed letter\'s sound',
    answer: 'the answer',
    question: 'the ask, its sound and its printed letter',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
