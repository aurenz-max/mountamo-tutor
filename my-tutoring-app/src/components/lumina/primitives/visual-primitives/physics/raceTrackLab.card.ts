/**
 * race-track-lab's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `raceTrackLab.boss.ts`.
 * Every item is one closed choice keyed by code from the cars' speeds, starts and times: the learner says it (the tutor
 * judges the words against the key) or taps it and presses Check Answer (the activity judges the tap), so every mode
 * is SAY_OR_SHOW. Observe and measure first need the race run: there is nothing to answer from before that.
 */
import type { RaceMode, RaceTrackMiss } from './raceTrackWorkspace';
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/** What a wrong answer shows (`raceMiss`), by mode, most telling first; the same ids name each spoken item's known misses. */
export const RACE_MISSES: Record<RaceMode, readonly RaceTrackMiss[]> = {
  observe: ['ahead_not_fastest', 'slower_racer'],
  predict: ['fastest_not_winner', 'head_start_not_winner', 'slower_racer'],
  measure: ['read_position', 'farther_total', 'other_racer', 'off_by_one', 'shorter_total', 'added', 'time_as_distance'],
  calculate: ['ignored_start', 'farther_racer', 'distance_as_speed', 'multiplied'],
  graph: ['highest_line', 'ignored_start', 'read_position', 'distance_as_speed', 'slower_racer'],
};

const TAP = 'may instead tap a choice and press Check Answer';
const RUN_FIRST = `presses Run the race before there is anything to answer from, and ${TAP}`;

export const raceTrackLabCard = defineCard<RaceTrackMiss>({
  id: 'race-track-lab',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  modes: {
    observe: { ...SAY_OR_SHOW, moves: RUN_FIRST, misses: RACE_MISSES.observe },
    predict: { ...SAY_OR_SHOW, moves: TAP, misses: RACE_MISSES.predict },
    measure: { ...SAY_OR_SHOW, moves: RUN_FIRST, misses: RACE_MISSES.measure },
    calculate: { ...SAY_OR_SHOW, moves: TAP, misses: RACE_MISSES.calculate },
    graph: { ...SAY_OR_SHOW, moves: TAP, misses: RACE_MISSES.graph },
  },
  words: {
    job: 'compare toy cars moving on a track of numbered squares: which car is fastest, which crosses the finish line '
      + 'first, how many squares a car moved, a car\'s speed in squares per second, or what a position-time graph shows',
    answer: 'their choice',
    question: 'the ask and the choices',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
