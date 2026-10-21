/**
 * measure-lab's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `measureLab.boss.ts`.
 * Every mode is answered on the bench and checked by the activity: a guess then the test (heavier, holds more), cups
 * poured then a number, or three containers tapped in order. The tutor never sees a weight, a capacity, the count or
 * the order. Pouring and ordering are not one tap, so the boss is bespoke.
 */
import type { MeasureLabChallengeType } from './MeasureLab';
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong answer shows (`measureMiss`, `TeachingAttempt.miss`, handoff 20), from the work the check reads:
 * - balance_predict: `picked_lighter` (the guess was the lighter object);
 * - capacity_predict: `tall_means_more` (guessed the tall narrow one, which holds less), `picked_less`;
 * - pour_count: `one_short` / `one_over` (off by one cup), `too_few` / `too_many`;
 * - order_capacity: `most_to_least` (the whole order reversed), `two_swapped` (two jars side by side swapped),
 *   `out_of_order`.
 */
export type MeasureMiss = 'picked_lighter' | 'tall_means_more' | 'picked_less'
  | 'one_short' | 'one_over' | 'too_few' | 'too_many'
  | 'most_to_least' | 'two_swapped' | 'out_of_order';

export const MEASURE_MISSES_BY_MODE: Record<MeasureLabChallengeType, readonly MeasureMiss[]> = {
  balance_predict: ['picked_lighter'],
  capacity_predict: ['tall_means_more', 'picked_less'],
  pour_count: ['one_short', 'one_over', 'too_few', 'too_many'],
  order_capacity: ['most_to_least', 'two_swapped', 'out_of_order'],
};

const GUESS = { answer: 'tap', judge: 'activity', flow: 'one-at-a-time' } as const;

export const measureLabCard = defineCard<MeasureMiss>({
  id: 'measure-lab',
  grades: ['Kindergarten', 'Grade 1'],
  // Every mode publishes levers (`measureLabLevers.ts`); every miss is answered by a drawn lever.
  modes: {
    balance_predict: { ...GUESS,
      moves: 'taps the one they think is heavier, then puts each one on the pan balance; once both are on, the scale '
        + 'tips and the guess is checked',
      misses: MEASURE_MISSES_BY_MODE.balance_predict },
    capacity_predict: { ...GUESS,
      moves: 'taps the one they think holds more, then presses Pour to fill both; the guess is checked',
      misses: MEASURE_MISSES_BY_MODE.capacity_predict },
    pour_count: { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time',
      moves: 'taps a cup to pour it in, one at a time, until the container is full, then taps a number button for how '
        + 'many it took',
      misses: MEASURE_MISSES_BY_MODE.pour_count },
    order_capacity: { answer: 'tap', judge: 'activity', flow: 'board',
      moves: 'taps the containers from the least water to the most (tapping a chosen one takes it out); the order is '
        + 'checked when all are tapped',
      misses: MEASURE_MISSES_BY_MODE.order_capacity },
  },
  words: {
    job: 'guess which of two things is heavier or holds more and then test it, count how many cups fill a container, '
      + 'or put containers in order from the least water to the most',
    answer: 'the guess, the count or the order',
    question: 'the question and the names of the things on the bench',
  },
  levers: true,
});
