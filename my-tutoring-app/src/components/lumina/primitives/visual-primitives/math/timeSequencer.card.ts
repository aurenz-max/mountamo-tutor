/**
 * time-sequencer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `timeSequencer.boss.ts`.
 * Matching an activity to a time of day, the card before or after another, the step missing from the middle of a
 * routine, which activity takes longer and the activity at a schedule time each ask for one sayable choice: the learner says it (the tutor judges the words against the key)
 * or taps it and presses Check (the activity checks it), so they are SAY_OR_SHOW. Putting three or five cards, or the
 * clock cards, in the order of the day, or three activities from the shortest to the longest, is a board the activity
 * checks.
 */
import { defineCard, SAY_OR_SHOW, SPOKEN_AUDIO } from '../../../components/live-activity/boss';

/**
 * What a wrong answer shows (`TeachingAttempt.miss`, handoff 20), from the work the check reads. Only the observable
 * pattern:
 * - ordering: `reversed` (the whole day backwards), `swapped_pair` (exactly two cards trade places),
 *   `wrong_first` (the day starts on the wrong card), `out_of_order` (none of those; three cards cannot show it);
 * - time of day: `next_period` (a neighbouring part of the day: the afternoon/evening boundary), `far_period`
 *   (the opposite part of the day);
 * - before-after: `other_event`;
 * - missing-middle: `before_first` (a step that comes before the first card), `after_last` (one after the last card);
 * - duration: `said_same` (one is longer, the learner said the same), `missed_same`, `shorter_one`;
 * - schedule: `next_row` (the activity one row above or below the time), `other_row`, `not_on_schedule`.
 */
export type TimeSequencerMiss = 'reversed' | 'swapped_pair' | 'wrong_first' | 'out_of_order'
  | 'next_period' | 'far_period' | 'other_event' | 'before_first' | 'after_last'
  | 'said_same' | 'missed_same' | 'shorter_one'
  | 'next_row' | 'other_row' | 'not_on_schedule';

const ORDER_MISSES = ['reversed', 'swapped_pair', 'wrong_first', 'out_of_order'] as const;

/** The activity's check (`timeSequencerMiss`) and the spoken items' known misses (`timeSpokenMisses`), by mode, same ids. */
export const TIME_MISSES = {
  'sequence-3': ['reversed', 'swapped_pair', 'wrong_first'],
  'time-of-day': ['next_period', 'far_period'],
  'sequence-5': ORDER_MISSES,
  'before-after': ['other_event'],
  'missing-middle': ['before_first', 'after_last'],
  'duration-compare': ['said_same', 'missed_same', 'shorter_one'],
  'clock-sequence': ORDER_MISSES,
  'read-schedule': ['next_row', 'other_row', 'not_on_schedule'],
  // Three cards: a wrong order is backwards, two traded, or the wrong card first (as sequence-3).
  'duration-order': ['reversed', 'swapped_pair', 'wrong_first'],
} as const satisfies Record<string, readonly TimeSequencerMiss[]>;

const ORDER = { answer: 'tap', judge: 'activity', flow: 'board',
  moves: 'taps the cards in the order they happen in the day (tapping a placed card takes it back out), then presses Check' } as const;
const PICK = 'may instead tap a choice, then press Check';

export const timeSequencerCard = defineCard<TimeSequencerMiss>({
  id: 'time-sequencer',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2'],
  modes: {
    'sequence-3': { ...ORDER, misses: TIME_MISSES['sequence-3'] },
    'time-of-day': { ...SAY_OR_SHOW, moves: PICK, misses: TIME_MISSES['time-of-day'] },
    'sequence-5': { ...ORDER, misses: TIME_MISSES['sequence-5'] },
    'before-after': { ...SAY_OR_SHOW, moves: PICK, misses: TIME_MISSES['before-after'] },
    'missing-middle': { ...SAY_OR_SHOW, moves: 'may instead tap the card that goes in the empty middle place, then press Check',
      misses: TIME_MISSES['missing-middle'] },
    'duration-compare': { ...SAY_OR_SHOW, moves: PICK, misses: TIME_MISSES['duration-compare'] },
    'clock-sequence': { ...ORDER, misses: TIME_MISSES['clock-sequence'] },
    'read-schedule': { ...SAY_OR_SHOW, moves: PICK, misses: TIME_MISSES['read-schedule'] },
    'duration-order': { ...ORDER, moves: 'taps the cards from the activity that takes the shortest time to the one that takes '
      + 'the longest (tapping a placed card takes it back out), then presses Check', misses: TIME_MISSES['duration-order'] },
  },
  words: {
    job: 'put the events of a day in order, find the step missing from the middle of a routine, tell when things '
      + 'happen, and tell which takes longer or put activities in order of how long they take',
    answer: 'their answer',
    question: 'the ask and the cards on screen',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
