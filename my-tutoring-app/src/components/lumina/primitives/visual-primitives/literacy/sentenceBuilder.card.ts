/**
 * sentence-builder's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `sentenceBuilder.boss.ts`.
 * The tile modes (simple, compound, complex, compound_complex) put ALL the given tiles in order to make one sentence:
 * a listed order passes in code, an unlisted full order goes to the shared sentence judge (`sentenceOrder.ts`).
 * build_sentence makes a question or a telling sentence from word tiles: code checks its shape, the shared judge its
 * sense and topic (`sentenceBuild.ts`). Each item is one sentence, checked whole by the activity: one at a time, never
 * a board (a count of tiles in the right place would name the order).
 */
import { defineCard } from '../../../components/live-activity/boss';

/** What a wrong tile order shows (`orderVerdict`, then the judge's verdict). */
export type OrderMiss = 'tiles_left' | 'end_mark_not_last' | 'not_sense';
export const ORDER_MISSES: readonly OrderMiss[] = ['tiles_left', 'end_mark_not_last', 'not_sense'];

/** What a wrong made sentence shows (`sentenceShapeMiss`, then the judge's verdict). */
export type SentenceMiss = 'no_end_mark' | 'end_mark_inside' | 'wrong_end_mark' | 'too_short' | 'not_question_start'
  | 'question_start' | 'same_sentence' | 'not_sense' | 'off_topic';
export const SENTENCE_MISSES: readonly SentenceMiss[] = ['no_end_mark', 'end_mark_inside', 'wrong_end_mark', 'too_short',
  'not_question_start', 'question_start', 'same_sentence', 'not_sense', 'off_topic'];

const ORDER = {
  answer: 'build', judge: 'activity', flow: 'one-at-a-time',
  moves: 'taps every tile into the sentence row in order (tapping a placed tile takes it back), then presses "I\'m done!"',
  misses: ORDER_MISSES,
} as const;

export const sentenceBuilderCard = defineCard<OrderMiss | SentenceMiss>({
  id: 'sentence-builder',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
  // Every mode publishes levers (`sentenceBuilderLevers.ts`).
  modes: {
    simple: ORDER,
    compound: ORDER,
    complex: ORDER,
    compound_complex: ORDER,
    build_sentence: { answer: 'build', judge: 'activity', flow: 'one-at-a-time', misses: SENTENCE_MISSES,
      moves: 'taps word tiles and an end mark into the sentence row (tapping a placed tile takes it back), then presses '
        + '"I\'m done!"',
      // The sentence already made stays on screen, and the check's words say to make a different one.
      unanswered: ['same_sentence'] },
  },
  words: {
    job: 'put all the given tiles in order to make one sentence, or make a question or a telling sentence about a '
      + 'named thing from word tiles',
    answer: 'the learner\'s sentence',
    question: 'the ask and every tile',
  },
  levers: true,
});
