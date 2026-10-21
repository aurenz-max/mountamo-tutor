/**
 * train-yard's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `trainYard.boss.ts`.
 * Every job is one train the learner builds (or the part of it the yard leaves to them) and sends with Highball; the
 * run is the check (`trainYardMiss`): a bespoke boss, one job at a time.
 */
import { defineCard, TAP_ONE } from '../../../components/live-activity/boss';

export type TrainYardMode = 'match_car' | 'enough_cars' | 'enough_pull' | 'build_train';

/**
 * What a checked build shows, in precedence order:
 *   - `wrong_car`: none of its cars can carry this cargo;
 *   - `mixed_cars`: some cars are a kind that cannot carry it (dead weight);
 *   - `too_few_cars`: the right cars cannot hold the whole load;
 *   - `stalled`: the engines cannot pull the train up the hill;
 *   - `extra_cars`: the load fits in fewer cars;
 *   - `extra_engines`: fewer engines would climb the hill.
 * `undefined` is the fewest-cars, fewest-engines train: the one correct build.
 */
export type TrainYardMiss = 'wrong_car' | 'mixed_cars' | 'too_few_cars' | 'stalled' | 'extra_cars' | 'extra_engines';
export const TRAIN_YARD_MISSES: readonly TrainYardMiss[] =
  ['wrong_car', 'mixed_cars', 'too_few_cars', 'stalled', 'extra_cars', 'extra_engines'];

/** The misses each mode's run can show: the yard sets every other part of the train to the fewest that work. */
export const TRAIN_YARD_MISSES_BY_MODE: Record<TrainYardMode, readonly TrainYardMiss[]> = {
  match_car: ['wrong_car'],
  enough_cars: ['too_few_cars', 'extra_cars'],
  enough_pull: ['stalled', 'extra_engines'],
  build_train: TRAIN_YARD_MISSES,
};

const SEND = 'then presses Highball! Send the train';

export const trainYardCard = defineCard<TrainYardMiss>({
  id: 'train-yard',
  grades: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  // Every mode publishes levers (`trainYardLevers.ts`).
  modes: {
    match_car: { ...TAP_ONE, misses: TRAIN_YARD_MISSES_BY_MODE.match_car,
      moves: `presses Choose on one car card (the yard couples that kind, as many as the load needs, and the engines), ${SEND}` },
    enough_cars: { ...TAP_ONE, misses: TRAIN_YARD_MISSES_BY_MODE.enough_cars,
      moves: `presses + and − on the one car card the yard puts out to add or remove cars (the yard adds the engines), ${SEND}` },
    enough_pull: { ...TAP_ONE, misses: TRAIN_YARD_MISSES_BY_MODE.enough_pull,
      moves: `presses + and − under the engine to add or remove engines (the yard has coupled the loaded cars), ${SEND}` },
    build_train: { answer: 'build', judge: 'activity', flow: 'one-at-a-time', misses: TRAIN_YARD_MISSES_BY_MODE.build_train,
      moves: `presses + and − under the engine and on the car cards to couple engines and cars of any kind, ${SEND}` },
  },
  words: {
    job: 'send a rail job\'s load over the hill in a train with the kind of car built for the cargo, the fewest cars that '
      + 'hold the whole load and the fewest engines that climb the hill, or build the part of that train the yard leaves '
      + 'to them',
    answer: 'the train they sent',
    question: 'the job ticket, the hill sign, and the engine and car cards',
  },
  levers: true,
});
