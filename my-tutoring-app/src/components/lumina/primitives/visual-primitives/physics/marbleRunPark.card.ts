/**
 * marble-run-park's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `marbleRunPark.boss.ts`.
 * make_the_loop is an experiment on a 3D marble run the activity checks: one item at a time, no key reaches the tutor.
 * The guess before each run is said to the tutor and never graded.
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`TeachingAttempt.miss`), from `loopMiss` in `marbleModel.ts`: `too_low` (a peg lower than
 * the loop's top), `top_height_only` (a peg as high as the loop's top that still fails: level with the top is not
 * enough), `not_lowest` (a peg that works when a lower one also does, on a "lowest peg" item).
 */
export const MARBLE_MISSES_BY_MODE = {
  make_the_loop: ['too_low', 'top_height_only', 'not_lowest'],
} as const;
export type MarbleMiss = typeof MARBLE_MISSES_BY_MODE[keyof typeof MARBLE_MISSES_BY_MODE][number];

export const marbleRunParkCard = defineCard<MarbleMiss>({
  id: 'marble-run-park',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    make_the_loop: { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time', misses: MARBLE_MISSES_BY_MODE.make_the_loop,
      moves: 'says aloud whether the marble will make the loop (never judged), taps a peg on the ramp then the marble to '
        + 'let it go, runs it from as many pegs as it likes, and presses "I\'m done!" with the marble on its peg' },
  },
  levers: true,
  words: {
    job: 'find where to start a marble on a ramp so it goes all the way round a loop-the-loop: higher starts make it go '
      + 'faster, and level with the top of the loop is not high enough',
    answer: 'the peg the marble starts from',
    question: 'the pegs, where the loop\'s top sits beside them, and what each run did',
  },
});
