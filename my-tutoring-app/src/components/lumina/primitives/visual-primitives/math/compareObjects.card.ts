/**
 * compare-objects' card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `compareObjects.boss.ts`.
 * Three modes are one spoken answer the tutor judges against the key (what the picture measures, an object's name, a
 * count). order_three is answered on the page: the learner touches the objects in order, and the board checks it.
 */
import { defineCard, OFF_BY, SPOKEN, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong ordering shows (`compareOrderMiss`): not every object touched, the whole order reversed, two swapped,
 *  another order. */
export type CompareOrderMiss = 'not_all_placed' | 'reversed' | 'two_swapped' | 'other_order';
/** What a wrong spoken answer shows (`compareObjectsSpokenMisses`): the other object, another menu choice, a count off. */
export type SpokenCompareMiss = (typeof OFF_BY)[number] | 'other_object' | 'other_attribute';
export type CompareObjectsMiss = CompareOrderMiss | SpokenCompareMiss;

/** The board's own check of an ordering, and the three spoken modes' known wrong answers, by mode. */
export const COMPARE_MISSES = {
  identify_attribute: ['other_attribute'],
  compare_two: ['other_object'],
  order_three: ['not_all_placed', 'reversed', 'two_swapped', 'other_order'],
  non_standard: OFF_BY,
} as const satisfies Record<string, readonly CompareObjectsMiss[]>;

export const compareObjectsCard = defineCard<CompareObjectsMiss>({
  id: 'compare-objects',
  grades: ['Kindergarten', 'Grade 1'],
  modes: {
    identify_attribute: { ...SPOKEN, misses: COMPARE_MISSES.identify_attribute },
    compare_two: { ...SPOKEN, misses: COMPARE_MISSES.compare_two },
    order_three: { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time',
      moves: 'touches the three objects one at a time in the asked order; the board checks the order once the learner '
        + 'stops touching, whether or not all three are touched',
      misses: COMPARE_MISSES.order_three },
    non_standard: { ...SPOKEN, misses: COMPARE_MISSES.non_standard },
  },
  words: {
    job: 'say what a picture of two objects lets us measure, say which of two objects is longer, taller, heavier or '
      + 'holds more, count the units laid along an object and say how many, or put three objects in order by size',
    answer: 'the answer',
    question: 'the ask and the objects it names',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
