/**
 * transport-challenge's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `transportChallenge.boss.ts`.
 * Every item is one vehicle, keyed by code from the job's load, the vehicles' per-trip figures and the limits: the
 * learner says it (the tutor judges the words against the key) or taps its card and presses Check my pick (the
 * activity judges the tap), so every mode is SAY_OR_SHOW.
 */
import type { TransportMiss, TransportMode } from './transportWorkspace';
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** Each mode's misses (`vehicleMiss`), most specific first: a pick that fits two is named by the first. */
export const TRANSPORT_MISSES: Record<TransportMode, readonly TransportMiss[]> = {
  single_constraint: ['forgot_round_up', 'cheapest_per_trip', 'fewest_trips', 'over_limit'],
  multi_constraint: ['forgot_round_up', 'cheapest_per_trip', 'fewest_trips', 'one_limit_only', 'over_limit'],
  full_optimization: ['forgot_round_up', 'cheapest_per_trip', 'fewest_trips', 'breaks_more'],
};

const TAP = 'may instead tap a vehicle card and press Check my pick';

export const transportChallengeCard = defineCard<TransportMiss>({
  id: 'transport-challenge',
  grades: ['Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    single_constraint: { ...SAY_OR_SHOW, moves: TAP, misses: TRANSPORT_MISSES.single_constraint },
    multi_constraint: { ...SAY_OR_SHOW, moves: TAP, misses: TRANSPORT_MISSES.multi_constraint },
    full_optimization: { ...SAY_OR_SHOW, moves: TAP, misses: TRANSPORT_MISSES.full_optimization },
  },
  words: {
    job: 'plan a transport job: work out each vehicle\'s trips and totals from what one trip carries and costs, and '
      + 'choose the vehicle that keeps the job\'s limits (with three limits, the one that breaks only one)',
    answer: 'the vehicle they choose',
    question: 'the ask, the limits and the vehicle cards',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
