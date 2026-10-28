/**
 * analog-clock's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `analogClock.boss.ts`.
 * Reading a time, matching a dial to a digital time, how long something took and which hand tells the hour or the
 * minutes each ask for one sayable answer: the learner says it (the tutor judges the words against the key) or picks
 * it and presses Check (the activity checks it), so they are SAY_OR_SHOW. Picking the clock face for a heard time is a
 * tap and Check. Setting the hands and counting round the face are boards the activity checks.
 */
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO, TAP_ONE } from '../../../components/live-activity/boss';

/**
 * What a wrong answer shows (`TeachingAttempt.miss`, handoff 20), from the old catalog's commonStruggles (the two hands
 * confused; the hour hand read as the next number near half past; the minute number read as minutes):
 * - hand_name: `other_hand`;
 * - read, match, hear_time and set_time: `hands_swapped` (the hour read off the long hand and the minutes off the short
 *   one), `next_hour` / `previous_hour` (the minutes right, the hour one number off), `wrong_hour`, `minute_as_number`
 *   (the number the long hand points at taken as the minutes: 3:03 for 3:15), `wrong_minute` (the hour right),
 *   `other_time`;
 * - set_time_ampm: the time misses, then `wrong_period` (the hands right, a.m. and p.m. the other way round).
 * - elapsed: `hour_off` (an hour too long or short), `too_short`, `too_long`.
 * count_face has none: an out-of-order touch starts the count again and Check opens only at 12 in order.
 */
export type ClockMiss = 'other_hand' | 'wrong_period'
  | 'hands_swapped' | 'next_hour' | 'previous_hour' | 'wrong_hour' | 'minute_as_number' | 'wrong_minute' | 'other_time'
  | 'hour_off' | 'too_short' | 'too_long';

const TIME_MISSES = ['hands_swapped', 'next_hour', 'previous_hour', 'wrong_hour', 'minute_as_number', 'wrong_minute', 'other_time'] as const;

/** The activity's check (`clockMiss`) and the spoken items' known misses (`clockSpokenMisses`), by mode, same ids. */
export const CLOCK_MISSES = {
  hand_name: ['other_hand'],
  count_face: [],
  hear_time: ['next_hour', 'previous_hour', 'wrong_hour'],
  read: TIME_MISSES,
  match: TIME_MISSES,
  set_time: TIME_MISSES,
  set_time_ampm: [...TIME_MISSES, 'wrong_period'],
  elapsed: ['hour_off', 'too_short', 'too_long'],
} as const satisfies Record<string, readonly ClockMiss[]>;

const PICK = 'may instead tap a time, then press Check';

export const analogClockCard = defineCard<ClockMiss>({
  id: 'analog-clock',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    hand_name: { ...SAY_OR_SHOW, moves: 'may instead touch a hand, then press Check', misses: CLOCK_MISSES.hand_name },
    count_face: { answer: 'tap', judge: 'activity', flow: 'board',
      moves: 'touches the numbers 1 to 12 in order (one out of order starts the count again at 1), then presses Check',
      misses: CLOCK_MISSES.count_face },
    hear_time: { ...TAP_ONE, moves: 'taps a clock face, then presses Check', misses: CLOCK_MISSES.hear_time },
    read: { ...SAY_OR_SHOW, moves: PICK, misses: CLOCK_MISSES.read },
    set_time: { answer: 'manipulate', judge: 'activity', flow: 'board',
      moves: 'drags round the clock face to move the hands, then presses Check',
      misses: CLOCK_MISSES.set_time },
    set_time_ampm: { answer: 'manipulate', judge: 'activity', flow: 'board',
      moves: 'drags round the clock face to move the hands, picks a.m. or p.m., then presses Check',
      misses: CLOCK_MISSES.set_time_ampm },
    match: { ...SAY_OR_SHOW, moves: PICK, misses: CLOCK_MISSES.match },
    elapsed: { ...SAY_OR_SHOW, moves: 'may run the stopwatch (Start, Stop, Reset) first; may instead tap a duration, then press Check',
      misses: CLOCK_MISSES.elapsed },
  },
  words: {
    job: 'name the clock hands, count round the face, or read, set (with a.m. or p.m. from the event), match and time a clock',
    answer: 'their answer',
    question: 'the ask and the clock on screen',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
