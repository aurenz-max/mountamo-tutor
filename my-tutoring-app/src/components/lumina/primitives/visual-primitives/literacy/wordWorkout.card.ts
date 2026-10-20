/**
 * word-workout's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `wordWorkout.boss.ts`.
 * Every mode but picture_match is read or answered aloud and the tutor judges it against the key: the real word of
 * two, each word of a chain, a word with an ending or two parts, a near word, the word that fits a sentence, a
 * sentence and an answer about it. picture_match is one tap: the learner reads the printed word silently and taps its
 * picture, and the activity checks the tap.
 */
import { defineCard, SPOKEN, SPOKEN_AUDIO, TAP_ONE } from '../../../components/live-activity/boss';

/**
 * What a checked wrong picture tap shows (`wordWorkoutMiss`), from the tapped picture's word against the printed one:
 * `same_start` (the same first letter: pig for pin), `same_end` (a rhyme, the same last two letters: bat for cat),
 * `same_vowel` (only the middle letter shared), `other_word`.
 */
export type WordWorkoutMiss = 'same_start' | 'same_end' | 'same_vowel' | 'other_word';
export const PICTURE_MISSES = ['same_start', 'same_end', 'same_vowel', 'other_word'] as const satisfies readonly WordWorkoutMiss[];

/**
 * What a wrong spoken answer shows, per mode: what was said, never a guessed cause. real_vs_nonsense's is named from
 * the learner's words (`wordWorkoutSpokenMisses`); the others are the levers' targets.
 */
export const WORD_WORKOUT_SPOKEN_MISSES = {
  real_vs_nonsense: ['said_nonword'],
  word_chains: ['previous_word', 'other_word'],
  read_inflected: ['base_only', 'other_word'],
  read_compound: ['base_only', 'other_word'],
  choose_in_context: ['misread_word', 'wrong_fit'],
  sentence_reading: ['word_swap', 'word_skip', 'lifted_word'],
} as const;
export type SpokenWordWorkoutMiss = typeof WORD_WORKOUT_SPOKEN_MISSES[keyof typeof WORD_WORKOUT_SPOKEN_MISSES][number];

const moves = 'may tap the hear-again button to hear the instruction or question again';

export const wordWorkoutCard = defineCard<WordWorkoutMiss | SpokenWordWorkoutMiss>({
  id: 'word-workout',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2'],
  modes: {
    real_vs_nonsense: { ...SPOKEN, moves, misses: WORD_WORKOUT_SPOKEN_MISSES.real_vs_nonsense },
    picture_match: { ...TAP_ONE, moves, misses: PICTURE_MISSES },
    word_chains: { ...SPOKEN, moves, misses: WORD_WORKOUT_SPOKEN_MISSES.word_chains },
    read_inflected: { ...SPOKEN, moves, misses: WORD_WORKOUT_SPOKEN_MISSES.read_inflected },
    // A compound has no easier word, and the divider answers only reading the first part alone.
    read_compound: { ...SPOKEN, moves, misses: WORD_WORKOUT_SPOKEN_MISSES.read_compound, unanswered: ['other_word'] },
    // wrong_fit: with two printed words, any mark about fit points at the answer, and the ask already says the sentence.
    choose_in_context: { ...SPOKEN, moves, misses: WORD_WORKOUT_SPOKEN_MISSES.choose_in_context, unanswered: ['wrong_fit'] },
    sentence_reading: { ...SPOKEN, moves, misses: WORD_WORKOUT_SPOKEN_MISSES.sentence_reading },
  },
  words: {
    job: 'read printed words aloud (which of two is a real word, each word of a chain, a word with an ending or two '
      + 'parts, a sentence) and answer about what was read, or read a word silently and tap its picture',
    answer: 'the answer',
    question: 'the instruction and any question about what was read',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
