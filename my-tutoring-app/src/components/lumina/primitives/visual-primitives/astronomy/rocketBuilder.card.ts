/**
 * rocket-builder's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `rocketBuilder.boss.ts`.
 * Every item is one closed choice keyed by code from the flight model: the learner says it (the tutor judges the words
 * against the key) or taps it and presses the check (the activity judges the tap), so every mode is SAY_OR_SHOW.
 */
import type { RocketMiss, RocketMode } from './rocketWorkspace';
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong answer shows (`optionMiss`), by mode; the same ids name each spoken item's known misses. */
export const ROCKET_MISSES: Record<RocketMode, readonly RocketMiss[]> = {
  can_it_lift: ['said_equal_lifts', 'said_lifts', 'said_stays'],
  add_to_lift: ['heavy_engine', 'added_no_push', 'too_weak'],
  on_budget: ['fails_both', 'over_budget', 'no_lift'],
  reach_target: ['picked_no_lift', 'picked_lower', 'picked_higher'],
};

export const rocketBuilderCard = defineCard<RocketMiss>({
  id: 'rocket-builder',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    can_it_lift: { ...SAY_OR_SHOW, moves: 'may instead tap a choice and press Check Answer',
      misses: ROCKET_MISSES.can_it_lift },
    add_to_lift: { ...SAY_OR_SHOW, moves: 'may instead tap a part and press Add it and check',
      misses: ROCKET_MISSES.add_to_lift },
    on_budget: { ...SAY_OR_SHOW, moves: 'may instead tap a rocket and press Check Answer',
      misses: ROCKET_MISSES.on_budget },
    reach_target: { ...SAY_OR_SHOW, moves: 'may instead tap a rocket and press Check Answer',
      misses: ROCKET_MISSES.reach_target },
  },
  words: {
    job: 'predict what rockets made of parts will do: whether one lifts off, which part makes a grounded one lift off, '
      + 'which one lifts off within a budget of coins, or which one flies highest',
    answer: 'their choice',
    question: 'the ask and the choices',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
