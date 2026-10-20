/**
 * picture-vocabulary's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `pictureVocabulary.boss.ts`.
 * naming, opposite, association, gradable_scale and sentence_frame are one spoken word each (the picture's name, the
 * opposite, something that goes with the shown thing, the missing scale word, the word that finishes the sentence),
 * judged by the tutor against the key. receptive_match is one tap: the tutor says a word and the learner taps its
 * picture among four wordless cards; the activity checks the tap. pair_build is the shared pair board
 * (`RhymePairSurface.tsx`): the learner taps two pictures into the tray and presses "I'm done!", and code checks that
 * they are opposites or go together; the tutor is never told a pair that passes.
 */
import { defineCard, SPOKEN, SPOKEN_AUDIO, TAP_ONE } from '../../../components/live-activity/boss';

/** What a wrong spoken answer shows, per mode (`pictureVocabSpokenMisses` names them, in precedence order). */
export const PICTURE_VOCAB_SPOKEN_MISSES = {
  naming: ['category_word', 'other_thing'],
  opposite: ['said_base_word', 'not_opposite'],
  association: ['said_base_word', 'no_link'],
  gradable_scale: ['given_rung', 'off_scale'],
  sentence_frame: ['does_not_fit'],
} as const;
export type SpokenPictureVocabMiss = typeof PICTURE_VOCAB_SPOKEN_MISSES[keyof typeof PICTURE_VOCAB_SPOKEN_MISSES][number];

/** What a checked wrong tap on receptive_match shows (`pictureVocabMiss`), from the recorded kinds of thing:
 *  another animal for "dog" is `same_category`; `other_picture` when a payload records no kinds. */
export const PICTURE_TAP_MISSES = ['same_category', 'other_category', 'other_picture'] as const;
export type PictureVocabMiss = typeof PICTURE_TAP_MISSES[number];

/** The pair board's own check (`picturePairMiss` in `picturePairBuild.ts`). */
export const PICTURE_PAIR_MISSES = ['alike', 'not_opposite', 'same_kind', 'no_link', 'same_pair'] as const;
export type PicturePairMiss = typeof PICTURE_PAIR_MISSES[number];

export type PictureVocabularyMiss = SpokenPictureVocabMiss | PictureVocabMiss | PicturePairMiss;

const moves = 'may tap the picture card to hear the question again';

export const pictureVocabularyCard = defineCard<PictureVocabularyMiss>({
  id: 'picture-vocabulary',
  grades: ['Kindergarten', 'Grade 1'],
  modes: {
    receptive_match: { ...TAP_ONE, moves: 'may tap Hear it again to hear the word again', misses: PICTURE_TAP_MISSES },
    naming: { ...SPOKEN, moves, misses: PICTURE_VOCAB_SPOKEN_MISSES.naming },
    association: { ...SPOKEN, moves, misses: PICTURE_VOCAB_SPOKEN_MISSES.association },
    opposite: { ...SPOKEN, moves, misses: PICTURE_VOCAB_SPOKEN_MISSES.opposite },
    // The board says what it is (`picturePairScene`: how to fill the tray and press I'm done). `same_pair` has no
    // lever: the pair already found stays on screen, and another pair is the whole fix.
    pair_build: { answer: 'build', judge: 'activity', flow: 'one-at-a-time', misses: PICTURE_PAIR_MISSES,
      unanswered: ['same_pair'] },
    sentence_frame: { ...SPOKEN, moves, misses: PICTURE_VOCAB_SPOKEN_MISSES.sentence_frame },
    gradable_scale: { ...SPOKEN, moves, misses: PICTURE_VOCAB_SPOKEN_MISSES.gradable_scale },
  },
  words: {
    job: 'hear a word and tap its picture, or say one word (a picture\'s name, an opposite, something that goes with '
      + 'a thing, the missing word of a scale or a sentence), or put two pictures that are opposites or go together '
      + 'into a pair',
    answer: 'the answer',
    question: 'the words of the ask',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
