import type { CalendarExplorerData } from '../../../primitives/visual-primitives/calendar/CalendarExplorer';
import {
  calendarGridAssignment, calendarSequenceAssignment, calendarSequenceItemsFromChallenges, isSpokenCalendarSession,
} from '../../../primitives/visual-primitives/calendar/calendarExplorerWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a calendar the surface cannot ask: a spoken chain with a turn missing its day or month, or a grid
 *  question without a month, a question or an answer. */
export function validateCalendarExplorerData(value: unknown): CalendarExplorerData {
  const d = value as CalendarExplorerData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length)
    throw new Error('Generated calendar explorer has invalid lesson content.');
  if (isSpokenCalendarSession(d.challenges)) {
    if (calendarSequenceItemsFromChallenges(d.challenges).length !== d.challenges.length)
      throw new Error('A spoken calendar turn has no day or month to say.');
  } else if (!d.challenges.every(c => !!c && typeof c.question === 'string' && !!c.question.trim()
      && typeof c.correctAnswer === 'string' && !!c.correctAnswer.trim() && (c.type === 'day_offset' || (c.month >= 1 && c.month <= 12)))) {
    throw new Error('A calendar question cannot be asked.');
  }
  return d;
}

/** What the live adapter needs from the calendar; the catalog's `teachingWorkspace` declares the rest. */
export const calendarExplorerLiveDomain: WorkspaceDomain<CalendarExplorerData> = {
  validate: validateCalendarExplorerData,
  initialState: data => {
    if (isSpokenCalendarSession(data.challenges)) {
      const items = calendarSequenceItemsFromChallenges(data.challenges);
      return workspaceOpening({ title: data.title, task: calendarSequenceAssignment(items[0]).task, total: items.length });
    }
    return workspaceOpening({ title: data.title, task: calendarGridAssignment(data.challenges[0]).task, total: data.challenges.length });
  },
};
