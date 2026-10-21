/**
 * construction-site-diorama's card: how its mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `constructionSiteDiorama.boss.ts`.
 * The one mode is a load the learner builds scoop by scoop on the 3D site; sending the truck is the check, one load at
 * a time, and no key reaches the tutor.
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong send shows (`TeachingAttempt.miss`), from `loadMiss` in `constructionModel.ts`: `one_short` and
 * `one_over` (a counting slip), `too_few` and `too_many` (further off).
 */
export const CONSTRUCTION_MISSES_BY_MODE = {
  load_truck: ['one_short', 'too_few', 'one_over', 'too_many'],
} as const;
export type ConstructionMiss = typeof CONSTRUCTION_MISSES_BY_MODE.load_truck[number];

export const constructionSiteDioramaCard = defineCard<ConstructionMiss>({
  id: 'construction-site-diorama',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    // The family declares no levers yet (/add-support-tiers): every miss is answered by the tutor's own teaching.
    load_truck: { judge: 'activity', flow: 'one-at-a-time', answer: 'build',
      misses: CONSTRUCTION_MISSES_BY_MODE.load_truck, unanswered: CONSTRUCTION_MISSES_BY_MODE.load_truck,
      moves: 'taps the pile to dig a scoop and taps the truck to dump it (with an empty bucket, a tap on the truck takes a '
        + 'scoop back out), drags to turn the site, then presses Send the truck; sending is the check (Turn back to the '
        + 'start only resets the view)' },
  },
  words: {
    job: 'work an excavator to load a dump truck with the right amount of dirt, sand, gravel or rocks and send it',
    answer: 'how many scoops the learner puts in the truck before sending it',
    question: 'the task, the material, where the load goes, and on a weight ask the truck\'s limit and one scoop\'s weight',
  },
});
