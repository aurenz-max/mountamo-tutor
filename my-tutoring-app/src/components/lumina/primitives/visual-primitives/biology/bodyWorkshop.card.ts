/**
 * body-workshop's card: how each mode is wired to the live tutor (`components/live-activity/boss.ts`). The catalog
 * reads it; the behavior is `bodyWorkshop.boss.ts`. Both modes are a build in one row the activity checks: one animal
 * at a time, no key reaches the tutor. K-5: the tutor speaks to a young child, in short sentences.
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`judgeBuild` in `bodyModel.ts`).
 * deliver_oxygen: `food_path` (a food part in the breath's path), `no_way_in` (an inside part first), `wrong_breather`
 * (gills given air, lungs or a nose given water), `no_pump` (blood with oxygen and no heart), `stops_short` (the path
 * ends before the goal), `not_this_animal` (it flows, but this animal does not use that part), `skips_a_part` (a real
 * part left out), `blocked` (any other break).
 * fuel_the_body: `breath_part` (a breathing part in the food's path), `not_mashed` (food sent to the intestines before
 * it is mashed or ground), and the shared ones above.
 */
export const BODY_MISSES_BY_MODE = {
  deliver_oxygen: ['food_path', 'no_way_in', 'wrong_breather', 'no_pump', 'stops_short', 'not_this_animal', 'skips_a_part', 'blocked'],
  fuel_the_body: ['breath_part', 'no_way_in', 'not_mashed', 'no_pump', 'stops_short', 'not_this_animal', 'skips_a_part', 'blocked'],
} as const;
export type BodyWorkshopMiss = typeof BODY_MISSES_BY_MODE[keyof typeof BODY_MISSES_BY_MODE][number];

export const bodyWorkshopCard = defineCard<BodyWorkshopMiss>({
  id: 'body-workshop',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    deliver_oxygen: { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time',
      misses: BODY_MISSES_BY_MODE.deliver_oxygen,
      moves: 'taps body parts from the bench into the row in order, presses Breathe to send a breath along it and see '
        + 'where it stops, changes the row as often as it likes, and presses "I\'m done!" when the breath gets through' },
    fuel_the_body: { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time',
      misses: BODY_MISSES_BY_MODE.fuel_the_body,
      moves: 'taps body parts from the bench into the row in order, presses Eat to send the food along it and see '
        + 'where it stops, changes the row as often as it likes, and presses "I\'m done!" when the food gets through' },
  },
  words: {
    job: 'build the path a real animal\'s breath or food takes through its body: from where it starts, through the body '
      + 'parts the animal really uses, into its blood (younger grades) or on to a working muscle (grades 4-5)',
    answer: 'the row of body parts the learner built',
    question: 'the animal, where it lives and what it eats, the goal, the bench parts by what they look like, the row '
      + 'built so far, and what each try showed',
    special: 'Talk to a young child: short sentences, everyday words. On each new animal, first say where it lives and '
      + 'that every animal needs oxygen and food to live and move, and point at the animal, then the goal. Invite one '
      + 'idea to try. After a try, say where it stopped and what that part does with air, water or food, in the '
      + 'facts\' words. Never say which parts to use, whether the animal breathes air or water, or what the path is.',
  },
  levers: true,
});
