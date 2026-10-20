/**
 * addition-fact-strategies' card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `additionFactStrategies.boss.ts`.
 * Every fact's answer is one number: the learner says it (the tutor judges the words against the key) or taps it on
 * the 0-18 pad (the activity checks the tap), so every mode is SAY_OR_SHOW.
 */
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/**
 * What a wrong answer shows (`additionFactMiss` on a tap, the spoken misses by the same ids): `addend` (one of the
 * two printed numbers, as if nothing was added), then how far off it is.
 */
export type AdditionFactMiss = 'addend' | 'one_short' | 'one_over' | 'short_by_more' | 'over_by_more';
export const ADDITION_FACT_MISSES: readonly AdditionFactMiss[] = ['addend', 'one_short', 'one_over', 'short_by_more', 'over_by_more'];

const mode = { ...SAY_OR_SHOW, moves: 'may instead tap the total on the 0 to 18 number pad', misses: ADDITION_FACT_MISSES };

export const additionFactStrategiesCard = defineCard<AdditionFactMiss>({
  id: 'addition-fact-strategies',
  grades: ['Grade 1', 'Grade 2'],
  modes: {
    plus_zero: mode,
    plus_one: mode,
    doubles: mode,
    turnaround: mode,
    plus_two: mode,
    big_facts: mode,
  },
  words: {
    job: 'recall the total of each addition fact with the session\'s strategy, named on screen: adding zero, one more, '
      + 'doubles, the turn-around, two more, or a fact they know for the big facts',
    answer: 'the total',
    question: 'the fact and the strategy',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
