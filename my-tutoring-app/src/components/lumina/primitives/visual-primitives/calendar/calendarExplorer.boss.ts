/**
 * calendar-explorer's boss, on the spoken preset (`components/live-activity/boss.ts`): the chains are said and the
 * tutor judges the successor; identify, count, pattern, day_offset and interval_count are said (judged against the key)
 * or tapped and checked by the activity, SAY_OR_SHOW items; mark_events (and any grid answer that cannot be said) has
 * no key, the activity checks the tap, and it plays through `show`. The card is `calendarExplorer.card.ts`; this file
 * holds the content check, the items, the ask and key, the levers and the harness play.
 */
import type { CalendarExplorerChallenge, CalendarExplorerData } from './CalendarExplorer';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { hasText, spokenBoss } from '../../../components/live-activity/boss';
import { calendarExplorerCard, type CalendarMiss, type SpokenCalendarMiss } from './calendarExplorer.card';
import { CALENDAR_LEVERS, calendarPracticeItem, calendarPracticeParent } from './calendarExplorerLevers';
import {
  calendarAsk, calendarGiven, calendarHarnessWords, calendarItems, calendarKey, calendarSpokenMissesOf, isChain,
  isGridDateAnswer, isSpokenCalendarSession,
} from './calendarExplorerWorkspace';

const TYPES = ['identify', 'count', 'pattern', 'day_sequence', 'month_sequence', 'day_offset', 'mark_events', 'interval_count'];

/** A chain turn has the day or month the tutor says and its successor; a grid question has a month, a question and a key. */
const askable = (c: CalendarExplorerChallenge) => (c.type === 'day_sequence' ? hasText(c.currentDay) && hasText(c.expectedDay)
  : c.type === 'month_sequence' ? hasText(c.currentMonth) && hasText(c.expectedMonth)
    : hasText(c.question) && hasText(c.correctAnswer) && (c.type === 'day_offset' || (c.month >= 1 && c.month <= 12)));

/** Reject a calendar the surface cannot ask, or one mixing the spoken chain and the grid (one surface per session). */
export function validateCalendarExplorerData(value: unknown): CalendarExplorerData {
  const d = value as CalendarExplorerData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || !hasText(c.id) || !TYPES.includes(c.type)))
    throw new Error('Generated calendar explorer has invalid lesson content.');
  if (d.challenges.some(isChain) && !isSpokenCalendarSession(d.challenges))
    throw new Error('A calendar session is the spoken chain or the grid, not both.');
  for (const c of d.challenges) if (!askable(c)) throw new Error(`A calendar ${c.type} question cannot be asked.`);
  return d;
}

const check: DriverInput = { type: 'choose', label: 'Check Answer' };

export const calendarExplorerBoss = spokenBoss<CalendarExplorerData, CalendarExplorerChallenge, CalendarMiss | SpokenCalendarMiss>({
  card: calendarExplorerCard,
  validate: validateCalendarExplorerData,
  items: calendarItems,
  levers: CALENDAR_LEVERS,
  speech: {
    ask: calendarAsk,
    // mark_events has no key: the activity checks the marker.
    key: calendarKey,
    given: calendarGiven,
    misses: calendarSpokenMissesOf,
    say: calendarHarnessWords,
    modeOf: c => c.type,
    // A date tapped on the calendar (a wrong one is the day before, or after on the 1st), or a printed choice; then Check.
    show: (right, c) => {
      if (isGridDateAnswer(c)) {
        const key = Number(c.correctAnswer);
        return [{ type: 'touch', target: `date-${right ? key : key > 1 ? key - 1 : key + 1}` }, check];
      }
      const pick = right ? c.options.find(o => o.trim().toLowerCase() === c.correctAnswer.trim().toLowerCase())
        : c.options.find(o => o.trim().toLowerCase() !== c.correctAnswer.trim().toLowerCase());
      if (!pick) throw new Error(`calendar-explorer ${c.type}: no ${right ? 'right' : 'wrong'} option to choose`);
      return [{ type: 'choose', label: pick }, check];
    },
  },
  drive: {
    component: 'primitives/visual-primitives/calendar/CalendarExplorer.tsx',
    instanceId: 'calendar',
    defaults: { grade: 'Grade 1', mode: 'identify', topic: 'Finding dates on a monthly calendar' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the simpler question a lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const items = calendarItems(ctx.data as CalendarExplorerData);
      const parent = calendarPracticeParent(ctx.itemId, items);
      return parent ? calendarPracticeItem(parent, { challenges: items }) ?? undefined : items.find(c => c.id === ctx.itemId);
    },
  },
});
