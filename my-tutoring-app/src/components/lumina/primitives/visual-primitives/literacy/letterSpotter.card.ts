/**
 * Letter spotter's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `letterSpotter.boss.ts`.
 * name_it is one spoken letter (the one a starred word starts with; its name or its sound), judged by the tutor
 * against the key. find_it (tap the one cell holding the named letter) and match_it (tap the little form of the big
 * letter) are one tap each, checked by the activity: their answers are a position and a letterform, which have no
 * spoken form.
 */
import { defineCard, SPOKEN, SPOKEN_AUDIO, TAP_ONE } from '../../../components/live-activity/boss';

/**
 * What a checked wrong tap shows (`letterSpotterMiss`), by the tapped letter's shape against the target's:
 * `mirror_form` (match it: the little letter flipped or turned, b/d, p/q, n/u, m/w), `same_shape_family` (the
 * letterform family the generator draws near distractors from), `other_letter`.
 */
export type LetterSpotterMiss = 'mirror_form' | 'same_shape_family' | 'other_letter';
/** What a wrong spoken letter on name_it shows (`letterSpotterSpokenMisses`). */
export type SpokenLetterSpotterMiss = 'said_the_word' | 'later_letter' | 'letter_not_in_word';

/** The taps' own check and name_it's known wrong answers, by mode. */
export const LETTER_SPOTTER_MISSES = {
  name_it: ['said_the_word', 'later_letter', 'letter_not_in_word'],
  find_it: ['same_shape_family', 'other_letter'],
  match_it: ['mirror_form', 'same_shape_family', 'other_letter'],
} as const satisfies Record<string, readonly (LetterSpotterMiss | SpokenLetterSpotterMiss)[]>;

export const letterSpotterCard = defineCard<LetterSpotterMiss | SpokenLetterSpotterMiss>({
  id: 'letter-spotter',
  grades: ['Kindergarten', 'Grade 1'],
  modes: {
    name_it: { ...SPOKEN, moves: 'may tap the sentence to hear the question again', misses: LETTER_SPOTTER_MISSES.name_it },
    find_it: { ...TAP_ONE, moves: 'may tap the speaker to hear the letter again', misses: LETTER_SPOTTER_MISSES.find_it },
    match_it: { ...TAP_ONE, moves: 'may tap the big letter to hear the question again', misses: LETTER_SPOTTER_MISSES.match_it },
  },
  words: {
    job: 'say the letter a starred word starts with, tap the named letter in a grid, or tap the little letter that '
      + 'goes with a big one',
    answer: 'the answer',
    question: 'the ask, its sentence and the named letter',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
