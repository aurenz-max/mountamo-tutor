import { expect, it } from 'vitest';
import { calendarMiss } from './calendarExplorerWorkspace';
import type { CalendarExplorerChallenge } from './CalendarExplorer';

const ch = (type: CalendarExplorerChallenge['type'], correctAnswer: string, extra: Partial<CalendarExplorerChallenge> = {}) =>
  ({ id: 'c', type, question: '', month: 3, year: 2025, correctAnswer, options: [], hint: '', narration: '', ...extra }) as CalendarExplorerChallenge;
const saturday = ch('identify', 'Saturday'), sunday = ch('identify', 'Sunday');
const date = ch('identify', '15'), marked = ch('mark_events', '9'), patternDate = ch('pattern', 'March 17');
const offset = ch('day_offset', 'Thursday', { startDay: 'Monday', offsetDays: 3 });
const count = ch('count', '5'), interval = ch('interval_count', '6');

it.each([
  [saturday, 'saturday', undefined], [saturday, 'Friday', 'day_before'], [saturday, 'Sunday', 'day_after'], [saturday, 'Tuesday', 'other_day'],
  [sunday, 'Saturday', 'day_before'], [sunday, 'Monday', 'day_after'],
  [offset, 'Monday', 'start_day'], [offset, 'Wednesday', 'day_before'], [offset, 'Friday', 'day_after'], [offset, 'Sunday', 'other_day'],
  [date, '15', undefined], [date, '8', 'same_column_date'], [date, '29', 'same_column_date'], [date, '14', 'next_to_date'],
  [date, '16', 'next_to_date'], [date, '20', 'other_date'], [marked, '2', 'same_column_date'], [marked, '11', 'other_date'],
  [patternDate, 'March 10', 'same_column_date'], [patternDate, 'March 18', 'next_to_date'],
  [count, '4', 'one_less'], [count, '6', 'one_more'], [count, '3', 'other_count'],
  [interval, '5', 'one_less'], [interval, '7', 'one_more'], [interval, '6', undefined],
] as const)('row %#', (c, picked, miss) => {
  expect(calendarMiss(c, picked)).toBe(miss);
});
