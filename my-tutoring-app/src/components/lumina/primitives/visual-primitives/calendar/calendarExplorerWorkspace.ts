/**
 * Calendar explorer on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C4). Its only teaching path: the scripted runner
 * and the click-era Check/Next progression were retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignments and scenes. Two surfaces:
 *  - the calendar grid (identify, mark_events, count, pattern, day_offset, interval_count): the
 *    learner taps a date or an option and presses Check; the activity checks it, and the key never
 *    reaches the tutor;
 *  - the spoken chain (day_sequence, month_sequence): the tutor says a day or month and the
 *    learner says the one that comes next.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { CalendarExplorerChallenge } from './CalendarExplorer';
import { calendarSequenceHarnessAnswers, type CalendarDaySequenceItem, type CalendarSequenceItem } from './calendarExplorerScript';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/** Grid challenges are answered by a date or an option, checked by the activity. */
export const isGridDateAnswer = (c: CalendarExplorerChallenge) =>
  (c.type === 'identify' || c.type === 'mark_events') && /^\d+$/.test((c.correctAnswer ?? '').trim());

export const calendarGridAssignment = (c: CalendarExplorerChallenge): TeachingAssignment =>
  ({ id: c.id, task: c.question, response: 'gesture' });

export interface CalendarGridView {
  showDayHeaders: boolean;
  showMonthLabel: boolean;
  showTargetDayColumn: boolean;
  /** The tier's reveal policy, when a tier is set. */
  revealPolicy: string;
}

export function calendarGridScene(c: CalendarExplorerChallenge, view: CalendarGridView): WorkspaceScene {
  const facts: Record<string, string | number> = {};
  if (c.type === 'day_offset') {
    facts.shown = `Start day ${c.startDay}, with ${c.offsetDays} steps forward drawn as arrows.`;
  } else {
    facts.shown = `The calendar for ${MONTH_NAMES[c.month - 1]} ${c.year}`
      + (view.showDayHeaders ? ', with the Sun to Sat header row' : ', with no day-name header row')
      + (view.showMonthLabel ? ' and its month caption' : '')
      + (c.type === 'count' && view.showTargetDayColumn && c.targetDayOfWeek ? `, every ${c.targetDayOfWeek} tinted` : '') + '.';
    if (c.todayDate !== undefined) facts.today = `The ${c.todayDate} carries a star meaning today.`;
    if (c.markedDates?.length) facts.markedDates = c.markedDates.join(', ');
  }
  if (!isGridDateAnswer(c) && c.options?.length) facts.options = c.options.join(', ');
  facts.constraints = isGridDateAnswer(c)
    ? 'The learner taps a date on the calendar, then presses Check; the activity checks it. You cannot tap.'
    : 'The learner taps one of the printed options, then presses Check; the activity checks it. You cannot tap.';
  if (view.revealPolicy) facts.revealPolicy = view.revealPolicy.replace(/^\[SUPPORT_TIER \w+\]\s*/, '');
  return { objects: [], facts };
}

/** How a check reads to the tutor and the observer: what the learner picked, never the key. */
export const describeCalendarPick = (c: CalendarExplorerChallenge, picked: string) =>
  isGridDateAnswer(c) ? `Picked the date ${picked}.` : `Picked "${picked}".`;

const unitOf = (item: CalendarSequenceItem) => item.type === 'day_sequence'
  ? { unit: 'day', current: item.currentDay, expected: item.expectedDay }
  : { unit: 'month', current: item.currentMonth, expected: item.expectedMonth };

export function calendarSequenceAssignment(item: CalendarSequenceItem): TeachingAssignment {
  const { unit, current, expected } = unitOf(item);
  return { id: item.id, task: `Listen: ${current}. What ${unit} comes next?`, response: 'speech',
    expectedAnswer: `${expected}. ${current} said back, a different ${unit}, or several names that do not land on `
      + `${expected} is not it.` };
}

export function calendarSequenceScene(item: CalendarSequenceItem): WorkspaceScene {
  const { unit, current } = unitOf(item);
  return { objects: [], facts: {
    say: `the ${unit} ${current}`,
    shown: 'A listen card only: no day or month names are printed.',
    constraints: `The learner says the ${unit} that comes next out loud. The chain continues from the next ${unit} on the next turn.`,
  } };
}

/** What the replay button asks the tutor to say: the day or month and the question, never the answer. */
export const hearSequenceRequest = (item: CalendarSequenceItem) =>
  `The learner tapped to hear the question again. Say only this, once: "${calendarSequenceAssignment(item).task}" Never say the answer.`;

/** The journey's spoken answers for the chain: the successor, or the given day said back. */
export function calendarSequenceJourneyAnswers(item: CalendarSequenceItem): { correct: string; plainWrong: string } {
  const { correct, plainWrong } = calendarSequenceHarnessAnswers(item);
  return { correct, plainWrong };
}

/** The spoken chain and the calendar grid are separate surfaces; a session is one or the other. */
export const isSpokenCalendarSession = (challenges: readonly CalendarExplorerChallenge[]) => challenges.length > 0
  && challenges.every((challenge) => challenge.type === 'day_sequence' || challenge.type === 'month_sequence');

export function daySequenceItemsFromChallenges(
  challenges: CalendarExplorerChallenge[],
): CalendarDaySequenceItem[] {
  return calendarSequenceItemsFromChallenges(challenges).filter(
    (item): item is CalendarDaySequenceItem => item.type === 'day_sequence',
  );
}

export function calendarSequenceItemsFromChallenges(
  challenges: CalendarExplorerChallenge[],
): CalendarSequenceItem[] {
  return challenges.flatMap((challenge, index): CalendarSequenceItem[] => {
    if (
      challenge.type === 'day_sequence'
      && challenge.currentDay
      && challenge.expectedDay
    ) {
      return [{
        id: challenge.id,
        type: 'day_sequence',
        answerKind: 'voice',
        responseClass: 'short_spoken_word',
        action: 'day_sequence',
        currentDay: challenge.currentDay,
        expectedDay: challenge.expectedDay,
        chainPosition: challenge.chainPosition ?? index + 1,
      }];
    }
    if (
      challenge.type === 'month_sequence'
      && challenge.currentMonth
      && challenge.expectedMonth
    ) {
      return [{
        id: challenge.id,
        type: 'month_sequence',
        answerKind: 'voice',
        responseClass: 'short_spoken_word',
        action: 'month_sequence',
        currentMonth: challenge.currentMonth,
        expectedMonth: challenge.expectedMonth,
        chainPosition: challenge.chainPosition ?? index + 1,
      }];
    }
    return [];
  });
}
