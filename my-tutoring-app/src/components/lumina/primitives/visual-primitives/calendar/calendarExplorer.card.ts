/**
 * calendar-explorer's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `calendarExplorer.boss.ts`.
 * A grid question whose answer is one weekday, date or count (identify, count, pattern, day_offset, interval_count) is
 * said (the tutor judges the words against the key) or tapped and checked (the activity checks it): SAY_OR_SHOW.
 * Marking an event is a tap on its date and Check: its date is printed in the ask, so saying it back proves nothing.
 * The day and month chains are spoken: the tutor says a day or month, the learner says the one that comes next.
 */
import { defineCard, SAY_OR_SHOW, SPOKEN, SPOKEN_AUDIO, TAP_ONE } from '../../../components/live-activity/boss';

/**
 * What a wrong answer shows (`TeachingAttempt.miss`, handoff 20), by the kind of answer the item asks for:
 * - a weekday (identify, day_offset, pattern): `start_day` (day_offset: the day the count starts from), `day_before` /
 *   `day_after` (the neighbouring day of the week), `other_day`;
 * - a date (identify, mark_events, pattern): `same_column_date` (a whole number of weeks off: the same weekday),
 *   `next_to_date` (one day off), `other_date`;
 * - a count (count, interval_count): `one_less`, `one_more`, `other_count`.
 */
export type CalendarMiss = 'start_day' | 'day_before' | 'day_after' | 'other_day' | 'same_column_date' | 'next_to_date'
  | 'other_date' | 'one_less' | 'one_more' | 'other_count';

/** What a wrong spoken successor shows (handoff 20 Part B): the given day said back, one skipped, counted backwards, other. */
export type SpokenCalendarMiss = Extract<CalendarMiss, 'start_day' | 'day_after' | 'other_day'> | 'day_before_start'
  | 'start_month' | 'month_after' | 'month_before_start' | 'other_month';

export const WEEKDAY_MISSES = ['day_before', 'day_after', 'other_day'] as const;
export const DATE_MISSES = ['same_column_date', 'next_to_date', 'other_date'] as const;
export const COUNT_MISSES = ['one_less', 'one_more', 'other_count'] as const;
export const OFFSET_MISSES = ['start_day', 'day_before', 'day_after', 'other_day'] as const;

/** The activity's check (`calendarMiss`) and the spoken misses (`calendarSpokenMisses`), by mode, same ids. */
export const CALENDAR_MISSES = {
  identify: [...WEEKDAY_MISSES, ...DATE_MISSES],
  mark_events: DATE_MISSES,
  count: COUNT_MISSES,
  day_offset: OFFSET_MISSES,
  interval_count: COUNT_MISSES,
  pattern: [...WEEKDAY_MISSES, ...DATE_MISSES],
  day_sequence: ['start_day', 'day_after', 'day_before_start', 'other_day'],
  month_sequence: ['start_month', 'month_after', 'month_before_start', 'other_month'],
} as const satisfies Record<string, readonly (CalendarMiss | SpokenCalendarMiss)[]>;

const PICK = 'may instead tap a printed choice, then press Check Answer';
const CHAIN = { ...SPOKEN, moves: 'hears a day or month and says the one that comes next' } as const;

export const calendarExplorerCard = defineCard<CalendarMiss | SpokenCalendarMiss>({
  id: 'calendar-explorer',
  grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  modes: {
    identify: { ...SAY_OR_SHOW, moves: 'may instead tap the date on the calendar or a printed choice, then press Check Answer',
      misses: CALENDAR_MISSES.identify },
    mark_events: { ...TAP_ONE, moves: 'taps the date on the calendar to place the marker, then presses Check Answer',
      misses: CALENDAR_MISSES.mark_events },
    day_sequence: { ...CHAIN, misses: CALENDAR_MISSES.day_sequence },
    count: { ...SAY_OR_SHOW, moves: PICK, misses: CALENDAR_MISSES.count },
    month_sequence: { ...CHAIN, misses: CALENDAR_MISSES.month_sequence },
    day_offset: { ...SAY_OR_SHOW, moves: PICK, misses: CALENDAR_MISSES.day_offset },
    interval_count: { ...SAY_OR_SHOW, moves: PICK, misses: CALENDAR_MISSES.interval_count },
    pattern: { ...SAY_OR_SHOW, moves: PICK, misses: CALENDAR_MISSES.pattern },
  },
  words: {
    job: 'find dates and days of the week on a calendar, count days, and say which day or month comes next',
    answer: 'their answer',
    question: 'the ask and the calendar on screen',
  },
  audio: SPOKEN_AUDIO,
  levers: true,
});
