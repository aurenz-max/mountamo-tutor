/**
 * flight-forces-explorer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `flightForcesExplorer.boss.ts`.
 * predict and observe ask what a plane's height or speed does, a closed choice keyed by code from the force sizes: the
 * learner says it (the tutor judges the words against the key) or taps it and presses Check Answer (the activity judges
 * the tap), so both are SAY_OR_SHOW. adjust sets the thrust and the nose angle and flies them; the activity checks the
 * flight against the goal.
 */
import type { FlightMiss, FlightMode } from './flightForcesWorkspace';
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong answer shows (`flightMiss`), by mode; the same ids name a spoken item's known misses. */
export const FLIGHT_MISSES: Record<FlightMode, readonly FlightMiss[]> = {
  predict: ['stall_more_lift', 'missed_balance', 'said_no_change', 'opposite_way'],
  observe: ['followed_nose', 'missed_balance', 'said_no_change', 'opposite_way'],
  adjust: ['stalled', 'forgot_drag', 'lift_vs_weight', 'thrust_vs_drag'],
};

export const flightForcesExplorerCard = defineCard<FlightMiss>({
  id: 'flight-forces-explorer',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    predict: { ...SAY_OR_SHOW, moves: 'may instead tap a choice and press Check Answer', misses: FLIGHT_MISSES.predict },
    observe: { ...SAY_OR_SHOW, moves: 'may instead tap one choice in each asked row and press Check Answer',
      misses: FLIGHT_MISSES.observe },
    adjust: { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time',
      moves: 'sets the thrust and the nose angle with the buttons, then presses Fly and check', misses: FLIGHT_MISSES.adjust },
  },
  words: {
    job: 'work out what a plane does from its four force arrows: predict what it does after one change, read what its '
      + 'arrows say, or set the thrust and the nose angle so it meets a goal',
    answer: 'their answer',
    question: 'the ask, the choices and the goal',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
