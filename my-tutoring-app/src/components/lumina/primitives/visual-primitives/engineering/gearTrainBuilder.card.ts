/**
 * gear-train-builder's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `gearTrainBuilder.boss.ts`.
 * Every mode is one open build the learner makes and hands in with "I'm done!", and the activity tests it with code
 * (`gearMiss`): a bespoke boss, one train at a time.
 */
import { defineCard } from '../../../components/live-activity/boss';

export type GearMode = 'build_direction' | 'build_speed' | 'build_ratio';

/**
 * What a wrong train shows (`TeachingAttempt.miss`), in the order the activity tests it:
 * - `too_few_gears`: fewer gears than the ask allows (always fewer than two: nothing is driven);
 * - `not_faster` / `not_slower` (build_speed): the last gear turns as fast as or slower than the first, or as slow
 *   as or faster than it;
 * - `too_fast` / `too_slow` (build_ratio): the last gear turns more, or fewer, times than asked;
 * - `wrong_direction`: the speed is right (or not asked), but the last gear turns the other way.
 */
export type GearMiss = 'too_few_gears' | 'not_faster' | 'not_slower' | 'too_fast' | 'too_slow' | 'wrong_direction';
export const GEAR_MISSES: Record<GearMode, readonly GearMiss[]> = {
  build_direction: ['too_few_gears', 'wrong_direction'],
  build_speed: ['too_few_gears', 'not_faster', 'not_slower', 'wrong_direction'],
  build_ratio: ['too_few_gears', 'too_fast', 'too_slow', 'wrong_direction'],
};

const BUILD = { answer: 'build', judge: 'activity', flow: 'one-at-a-time',
  moves: 'taps a gear size in the tray to add a gear to the end of the train, where it meshes with the gear before it '
    + '(tapping a gear in the train takes it out and the rest close up; Clear empties the track), then presses I\'m done! '
    + 'to hand it in; the activity turns the crank on the first gear and checks the last gear',
  // `too_few_gears` has no lever: the ask on screen states the number of gears.
  unanswered: ['too_few_gears'] } as const;

export const gearTrainBuilderCard = defineCard<GearMiss>({
  id: 'gear-train-builder',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  // Every mode publishes levers (`gearLevers.ts`).
  modes: {
    build_direction: { ...BUILD, misses: GEAR_MISSES.build_direction },
    build_speed: { ...BUILD, misses: GEAR_MISSES.build_speed },
    build_ratio: { ...BUILD, misses: GEAR_MISSES.build_ratio },
  },
  words: {
    job: 'build a gear train whose last gear turns the way the ask names, faster or slower than the first gear, or the '
      + 'asked number of times for each turn of the first; many different trains pass',
    answer: 'the gear train they built',
    question: 'the ask and the gear sizes in the tray',
  },
  levers: true,
});
