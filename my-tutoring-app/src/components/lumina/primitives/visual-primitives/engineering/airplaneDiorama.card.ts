/**
 * airplane-diorama's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `airplaneDiorama.boss.ts`.
 * Both modes are gestures on the 3D jet's display that the activity checks: one item at a time, no key reaches the tutor.
 */
import { defineCard } from '../../../components/live-activity/boss';

/**
 * What a wrong check shows (`TeachingAttempt.miss`), from each task's own check in `airplaneModel.ts`:
 * - find_part (`airplaneMiss`): `close_part` (a part next to or like the asked one), `wrong_part`;
 * - flight_plan (`flightMiss`): `too_little_fuel` (the jet comes down short), `no_spare_fuel` (it lands on empty
 *   tanks), `too_much_fuel` (more than the spare left).
 */
export const AIRPLANE_MISSES_BY_MODE = {
  find_part: ['close_part', 'wrong_part'],
  flight_plan: ['too_little_fuel', 'no_spare_fuel', 'too_much_fuel'],
} as const;
export type AirplaneMiss = typeof AIRPLANE_MISSES_BY_MODE[keyof typeof AIRPLANE_MISSES_BY_MODE][number];

/** The family declares no levers yet (/add-support-tiers): every miss is answered by the tutor's own teaching. */
const mode = <K extends keyof typeof AIRPLANE_MISSES_BY_MODE>(k: K) =>
  ({ misses: AIRPLANE_MISSES_BY_MODE[k], unanswered: AIRPLANE_MISSES_BY_MODE[k] });
const CHECKED = { judge: 'activity', flow: 'one-at-a-time' } as const;

export const airplaneDioramaCard = defineCard<AirplaneMiss>({
  id: 'airplane-diorama',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    find_part: { ...CHECKED, answer: 'tap', ...mode('find_part'),
      moves: 'drags to turn the jet, pinches or scrolls to zoom, then taps a part of the jet; that tap is the check '
        + '(Turn back to the start only resets the view)' },
    flight_plan: { ...CHECKED, answer: 'build', ...mode('flight_plan'),
      moves: 'loads fuel tanks with Add a tank and Take out a tank, then presses Fly!; the flight is the check' },
  },
  words: {
    job: 'find a part of a 3D jet by its name or by the job it does and tap it, or load the fuel tanks a trip needs '
      + 'and fly it',
    answer: 'which part the learner taps or how many fuel tanks they load',
    question: 'the task, the part\'s name or job as the ask gives it, the trip, the map and the fuel rule',
  },
});
