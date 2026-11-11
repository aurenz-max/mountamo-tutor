/**
 * measure-lab's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `measureLab.boss.ts`.
 * The prediction, pouring and ordering modes are answered on the bench and checked by the activity: a guess then the
 * test (heavier, holds more), cups poured then a number, or three containers tapped in order. The tutor never sees a
 * weight, a capacity, the count or the order. fill_level is one sayable choice ("empty", "full", "the left jug"), said
 * (the tutor judges it against the key) or tapped (the activity checks the tap): SAY_OR_SHOW, on the spoken preset.
 */
import type { MeasureLabChallengeType } from './MeasureLab';
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/**
 * What a wrong answer shows (`measureMiss`, `TeachingAttempt.miss`, handoff 20), from the work the check reads:
 * - balance_predict: `picked_lighter` (the guess was the lighter object);
 * - capacity_predict: `tall_means_more` (guessed the tall narrow one, which holds less), `picked_less`;
 * - pour_count: `one_short` / `one_over` (off by one cup), `too_few` / `too_many`;
 * - order_capacity: `most_to_least` (the whole order reversed), `two_swapped` (two jars side by side swapped),
 *   `out_of_order`;
 * - fill_level: `mixed_empty_full` (called an empty container full, or a full one empty), `picked_opposite` (asked
 *   for more, tapped the one with less, or the other way round).
 */
export type MeasureMiss = 'picked_lighter' | 'tall_means_more' | 'picked_less'
  | 'one_short' | 'one_over' | 'too_few' | 'too_many'
  | 'most_to_least' | 'two_swapped' | 'out_of_order'
  | 'mixed_empty_full' | 'picked_opposite';

export const MEASURE_MISSES_BY_MODE: Record<MeasureLabChallengeType, readonly MeasureMiss[]> = {
  balance_predict: ['picked_lighter'],
  capacity_predict: ['tall_means_more', 'picked_less'],
  pour_count: ['one_short', 'one_over', 'too_few', 'too_many'],
  order_capacity: ['most_to_least', 'two_swapped', 'out_of_order'],
  fill_level: ['mixed_empty_full', 'picked_opposite'],
};

const GUESS = { answer: 'tap', judge: 'activity', flow: 'one-at-a-time' } as const;

export const measureLabCard = defineCard<MeasureMiss>({
  id: 'measure-lab',
  grades: ['Kindergarten', 'Grade 1'],
  // Every mode publishes levers (`measureLabLevers.ts`); every miss is answered by a drawn lever.
  // The words are kept short: the family's guidance must fit the backend's offer cap (OFFER_GUIDANCE_MAX).
  modes: {
    balance_predict: { ...GUESS, moves: 'taps a guess, then puts both on the balance; the tip checks the guess',
      misses: MEASURE_MISSES_BY_MODE.balance_predict },
    capacity_predict: { ...GUESS, moves: 'taps a guess, then presses Pour to fill both; the guess is checked',
      misses: MEASURE_MISSES_BY_MODE.capacity_predict },
    pour_count: { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time',
      moves: 'pours one cup per tap until full, then taps how many', misses: MEASURE_MISSES_BY_MODE.pour_count },
    // Said or tapped: "empty", "full", or which of the two named containers (SAY_OR_SHOW).
    fill_level: { ...SAY_OR_SHOW, moves: 'may instead tap Empty or Full, or tap a container',
      misses: MEASURE_MISSES_BY_MODE.fill_level },
    order_capacity: { answer: 'tap', judge: 'activity', flow: 'board',
      moves: 'taps the containers, least water first (a second tap takes one out)', misses: MEASURE_MISSES_BY_MODE.order_capacity },
  },
  words: {
    job: 'test which is heavier or holds more, count the cups that fill a container, order containers by water, or say '
      + 'empty, full, more or less',
    answer: 'their answer',
    question: 'the question and the things on the bench',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
