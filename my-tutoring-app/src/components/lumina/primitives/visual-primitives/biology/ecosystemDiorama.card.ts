/**
 * ecosystem-diorama's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `ecosystemDiorama.boss.ts`.
 * Every mode is an experiment the learner runs in the 3D island tank and the activity checks: one item at a time,
 * no key reaches the tutor.
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`TeachingAttempt.miss`), from each task's own check in `ecosystemModel.ts`:
 * - plant_needs (`plantNeedsMiss`): `no_sun`, `no_water`, `no_soil` (the first need the setup leaves out),
 *   `gave_animal_things` (a den or berries added to the pot);
 * - sun_test (`readMiss`): `picked_cooler`;
 * - season_behavior (`winterMiss`): `wrong_place`;
 * - season_from_log (`seasonLogMiss`): `wrong_season`, `present_not_most` (a weather in the log, not the most common);
 * - compare_logs (`compareMiss`): `picked_fewer`, `picked_colder`;
 * - keep_it_cool (`coolMiss`): `no_shade`, `clear_cover` (a clear sheet lets the sunlight through).
 */
export const ECOSYSTEM_MISSES_BY_MODE = {
  plant_needs: ['no_sun', 'no_water', 'no_soil', 'gave_animal_things'],
  sun_test: ['picked_cooler'],
  season_behavior: ['wrong_place'],
  season_from_log: ['wrong_season', 'present_not_most'],
  compare_logs: ['picked_fewer', 'picked_colder'],
  keep_it_cool: ['no_shade', 'clear_cover'],
} as const;
export type EcosystemMiss = typeof ECOSYSTEM_MISSES_BY_MODE[keyof typeof ECOSYSTEM_MISSES_BY_MODE][number];

/** The family declares no levers yet (/add-support-tiers): every miss is answered by the tutor's own teaching. */
const mode = <K extends keyof typeof ECOSYSTEM_MISSES_BY_MODE>(k: K) =>
  ({ misses: ECOSYSTEM_MISSES_BY_MODE[k], unanswered: ECOSYSTEM_MISSES_BY_MODE[k] });
const CHECKED = { judge: 'activity', flow: 'one-at-a-time' } as const;

export const ecosystemDioramaCard = defineCard<EcosystemMiss>({
  id: 'ecosystem-diorama',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    plant_needs: { ...CHECKED, answer: 'build', ...mode('plant_needs'),
      moves: 'sets where the pot stands, what fills it, whether it is watered and whether to add a den or berries, then presses Watch it grow' },
    sun_test: { ...CHECKED, answer: 'tap', ...mode('sun_test'),
      moves: 'taps the thing they guess will get warmer, drags the sun across the sky (or presses Let the day go by), '
        + 'then taps the thing that got warmer; that last tap is the check, and the guess is never graded' },
    season_behavior: { ...CHECKED, answer: 'manipulate', ...mode('season_behavior'),
      moves: 'presses Bring winter, taps an animal and then a winter place for it (an animal can move again), then presses Done' },
    season_from_log: { ...CHECKED, answer: 'tap', ...mode('season_from_log'),
      moves: 'plays the month (Play the month, or Next day), taps a season card, then taps the row of weather in the log that shows it' },
    compare_logs: { ...CHECKED, answer: 'tap', ...mode('compare_logs'),
      moves: 'plays both months (Play the months, or Next day), then presses Pick under the log that answers the question' },
    keep_it_cool: { ...CHECKED, answer: 'build', ...mode('keep_it_cool'),
      moves: 'picks a cover (or moves the thing into the shade hut), then drags the sun across the sky or presses Let the day go by; '
        + 'the end of the day is the check' },
  },
  words: {
    job: 'run an experiment in the island tank and read what happened: give a plant what it needs to grow, find which '
      + 'of two things the sun warms more, move animals to their winter places, name a season from a weather log, '
      + 'compare two weather logs, or build shade that keeps a treat cool',
    answer: 'what the learner sets up or picks',
    question: 'the task, the things in the tank, the choices on screen and the question asked',
  },
});
