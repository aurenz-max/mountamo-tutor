/**
 * Calendar explorer on the shared tutor/JEV teaching workspace: the items, the ask, the spoken key, the activity's
 * check and the scenes, which the boss (`calendarExplorer.boss.ts`), the component, the levers and the tests read.
 *
 * Two surfaces:
 *  - the calendar grid (identify, mark_events, count, pattern, day_offset, interval_count): the learner taps a date or
 *    an option and presses Check Answer, and the activity checks it. A question whose answer is one weekday, date or
 *    count may also be said aloud: the boss hands the tutor its key (`calendarKey`). mark_events has no key: its date is
 *    printed in the ask, so the task is placing the marker;
 *  - the spoken chain (day_sequence, month_sequence): the tutor says a day or month and the learner says the one that
 *    comes next.
 *
 * Pure: no React.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import { spokenNumber, type KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { CalendarExplorerChallenge, CalendarExplorerData } from './CalendarExplorer';
import type { CalendarMiss, SpokenCalendarMiss } from './calendarExplorer.card';

export type { CalendarMiss, SpokenCalendarMiss };

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const weekday = (s: string) => WEEKDAYS.indexOf((s ?? '').trim().toLowerCase());
/** "15" or "March 15" as the day of the month. */
const dateNumber = (s: string) => { const m = /^(?:[a-z]+\s+)?(\d{1,2})$/i.exec(s.trim()); return m ? Number(m[1]) : NaN; };
const dayName = (i: number) => { const d = WEEKDAYS[((i % 7) + 7) % 7]; return d[0].toUpperCase() + d.slice(1); };
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

/** A spoken chain turn (the tutor says a day or month, the learner says the next one). */
export const isChain = (c: Pick<CalendarExplorerChallenge, 'type'>) => c.type === 'day_sequence' || c.type === 'month_sequence';

/** The spoken chain and the calendar grid are separate surfaces; a session is one or the other. */
export const isSpokenCalendarSession = (challenges: readonly CalendarExplorerChallenge[]) =>
  challenges.length > 0 && challenges.every(isChain);

/** The lesson's items, in order, each carrying the lesson's support tier (the model lever's timing reads it). */
export const calendarItems = (d: Pick<CalendarExplorerData, 'challenges' | 'supportTier'>): CalendarExplorerChallenge[] =>
  (d.challenges ?? []).map(c => (c.supportTier || !d.supportTier ? c : { ...c, supportTier: d.supportTier }));

/** Grid challenges answered by a date on the calendar (a date identify, mark_events); the rest by a printed option. */
export const isGridDateAnswer = (c: CalendarExplorerChallenge) =>
  (c.type === 'identify' || c.type === 'mark_events') && /^\d+$/.test((c.correctAnswer ?? '').trim());

// ── The chain ────────────────────────────────────────────────────────────────

const unitOf = (c: CalendarExplorerChallenge) => c.type === 'day_sequence'
  ? { unit: 'day', current: c.currentDay ?? '', expected: c.expectedDay ?? '' }
  : { unit: 'month', current: c.currentMonth ?? '', expected: c.expectedMonth ?? '' };

// ── The ask and the key ──────────────────────────────────────────────────────

/** The kind of one sayable answer a grid question has; none for a placement (mark_events) or an answer of another shape. */
export type CalendarAnswerKind = 'weekday' | 'date' | 'count';

export function calendarAnswerKind(c: CalendarExplorerChallenge): CalendarAnswerKind | undefined {
  const key = (c.correctAnswer ?? '').trim();
  if (c.type === 'count' || c.type === 'interval_count') return /^\d+$/.test(key) ? 'count' : undefined;
  if (c.type !== 'identify' && c.type !== 'pattern' && c.type !== 'day_offset') return undefined;
  if (weekday(key) >= 0) return 'weekday';
  return c.type !== 'day_offset' && Number.isFinite(dateNumber(key)) ? 'date' : undefined;
}

/** What the learner is asked: a grid question as printed; a chain turn says its day or month. Never the answer. */
export function calendarAsk(c: CalendarExplorerChallenge): string {
  if (!isChain(c)) return c.question;
  const { unit, current } = unitOf(c);
  return `Listen: ${current}. What ${unit} comes next?`;
}

/** The key a spoken answer is judged against; null on a placement (mark_events) or an answer that cannot be said. */
export function calendarKey(c: CalendarExplorerChallenge): SpokenKey | null {
  if (isChain(c)) {
    const { unit, current, expected } = unitOf(c);
    return { answer: expected, alsoAccept: [],
      signatureError: `"${current}" said back, another ${unit}, or several names that do not land on ${expected} is wrong.` };
  }
  const kind = calendarAnswerKind(c), key = (c.correctAnswer ?? '').trim();
  if (kind === 'weekday') {
    const day = dayName(weekday(key));
    const start = c.type === 'day_offset' && c.startDay && weekday(c.startDay) !== weekday(key) ? dayName(weekday(c.startDay)) : '';
    return { answer: day, alsoAccept: [], acceptRule: `A sentence that says it, such as "it's ${day}" or "on a ${day}", counts.`,
      signatureError: `${start ? `${start}, the start day, or any` : 'Any'} other day of the week is wrong.` };
  }
  if (kind === 'date') {
    const n = dateNumber(key), month = /^[a-z]+/i.exec(key)?.[0] ?? (c.type === 'identify' ? MONTH_NAMES[c.month - 1] : undefined);
    const also = [String(n), spokenNumber(n), ...(month ? [`${month} ${n}`] : [])];
    return { answer: `the ${ordinal(n)}`, alsoAccept: Array.from(new Set(also)),
      signatureError: 'A date one day or a week away is wrong.' };
  }
  if (kind === 'count') {
    const n = Number(key);
    const unit = c.type === 'count' && c.targetDayOfWeek ? dayName(weekday(c.targetDayOfWeek)) : 'day';
    const said = spokenNumber(n);
    return { answer: String(n), alsoAccept: Array.from(new Set([said, `${said} ${unit}${n === 1 ? '' : 's'}`])),
      signatureError: 'One more or one fewer is wrong.' };
  }
  return null;
}

/**
 * What the ask says by design, which may contain the answer: a pattern question names the weekday it starts from
 * ("March 3 is a Monday. What day is March 10?"), a seven-day count starts on its answer, and an interval names its
 * marked dates and "the two marked days".
 */
export function calendarGiven(c: CalendarExplorerChallenge): string[] {
  if (c.type === 'pattern') return WEEKDAYS.filter(d => new RegExp(`\\b${d}\\b`, 'i').test(c.question)).map(d => dayName(weekday(d)));
  if (c.type === 'day_offset') return c.startDay ? [c.startDay] : [];
  if (c.type === 'interval_count') return [c.intervalStartDate, c.intervalEndDate].filter((d): d is number => d !== undefined)
    .map(String).concat('the two marked days');
  return [];
}

/** The journey's spoken answers: the key's own words, or a plainly different answer of the same kind. */
export function calendarHarnessWords(c: CalendarExplorerChallenge): { correct: string; plainWrong: string } {
  if (isChain(c)) { const { current, expected } = unitOf(c); return { correct: expected, plainWrong: current }; }
  const kind = calendarAnswerKind(c), key = (c.correctAnswer ?? '').trim();
  if (kind === 'weekday') return { correct: dayName(weekday(key)), plainWrong: dayName(weekday(key) + 1) };
  if (kind === 'date') { const n = dateNumber(key); return { correct: String(n), plainWrong: String(n > 1 ? n - 1 : n + 1) }; }
  if (kind === 'count') return { correct: key, plainWrong: String(Number(key) + 1) };
  throw new Error(`calendar-explorer ${c.id}: a ${c.type} item has no spoken answer`);
}

// ── Misses ───────────────────────────────────────────────────────────────────

/** A spoken item's known wrong answers, with the check's ids: a grid answer's (`calendarGridSpokenMisses`) or a chain's. */
export const calendarSpokenMissesOf = (c: CalendarExplorerChallenge): KnownMiss[] =>
  (isChain(c) ? calendarSpokenMisses(c) : calendarGridSpokenMisses(c));

/**
 * A spoken grid answer's known wrong answers, with the tap's ids (`calendarMiss`, the card's lists), most specific
 * first: a weekday's start day (day_offset), the day before and after, any other day; a date a week away, one day
 * away, any other date; a count one less, one more, any other count.
 */
export function calendarGridSpokenMisses(c: CalendarExplorerChallenge): KnownMiss[] {
  const kind = calendarAnswerKind(c), key = (c.correctAnswer ?? '').trim();
  if (kind === 'weekday') {
    const want = weekday(key), start = c.type === 'day_offset' && c.startDay ? weekday(c.startDay) : -1;
    const fact = `The answer is ${dayName(want)}.`;
    const hasStart = start >= 0 && start !== want;
    const near = [[-1, 'day_before', 'the day before it'], [1, 'day_after', 'the day after it']] as const;
    const other = [3, 2, 4].map(d => (want + d) % 7).find(d => d !== start)!;
    return [
      ...(hasStart ? [{ id: 'start_day', pattern: `${fact} The learner's answer is ${dayName(start)}, the day the count starts from.`,
        examples: [dayName(start)] }] : []),
      ...near.filter(([d]) => !hasStart || (want + d + 7) % 7 !== start).map(([d, id, what]) =>
        ({ id, pattern: `${fact} The learner's answer is ${dayName(want + d)}, ${what}.`, examples: [dayName(want + d)] })),
      { id: 'other_day', pattern: `${fact} The learner's answer is another day of the week, not ${dayName(want - 1)}, `
        + `${dayName(want)} or ${dayName(want + 1)}${hasStart ? ` (or ${dayName(start)}, the start day)` : ''}.`, examples: [dayName(other)] },
    ];
  }
  if (kind === 'date') {
    const n = dateNumber(key), last = new Date(c.year, c.month, 0).getDate() || 31;
    const fact = `The answer is the ${ordinal(n)}.`;
    const inMonth = (d: number) => d >= 1 && d <= last;
    const week = [n - 7, n + 7].filter(inMonth), next = [n - 1, n + 1].filter(inMonth);
    const other = [n + 3, n - 3, n + 2, n - 2].find(inMonth);
    const say = (ds: number[]) => ds.map(d => `the ${ordinal(d)}`).join(' or ');
    return [
      ...(week.length ? [{ id: 'same_column_date', pattern: `${fact} The learner's answer is a whole number of weeks away, such as `
        + `${say(week)}: the same day of the week.`, examples: week.map(d => `the ${ordinal(d)}`) }] : []),
      ...(next.length ? [{ id: 'next_to_date', pattern: `${fact} The learner's answer is ${say(next)}, one day away.`,
        examples: next.map(d => `the ${ordinal(d)}`) }] : []),
      ...(other ? [{ id: 'other_date', pattern: `${fact} The learner's answer is another date, not one day or a whole number of `
        + 'weeks away.', examples: [`the ${ordinal(other)}`] }] : []),
    ];
  }
  if (kind === 'count') {
    const n = Number(key), fact = `The answer is ${n}.`;
    return [
      ...(n - 1 >= 0 ? [{ id: 'one_less', pattern: `${fact} The learner's answer is ${n - 1}, one less.`, examples: [spokenNumber(n - 1)] }] : []),
      { id: 'one_more', pattern: `${fact} The learner's answer is ${n + 1}, one more.`, examples: [spokenNumber(n + 1)] },
      { id: 'other_count', pattern: `${fact} The learner's answer is another number, not ${n - 1}, ${n} or ${n + 1}.`,
        examples: [spokenNumber(n + 2)] },
    ];
  }
  return [];
}

/**
 * The chain's known wrong answers, in precedence order, for the `spoken_miss` observer: the given day said back
 * (`start_day`, the tap's id), the day after the answer (one skipped), the day before the given one (counted
 * backwards), any other day. A month chain names the same four (`start_month`, `month_after`, `month_before_start`,
 * `other_month`).
 */
export function calendarSpokenMisses(c: CalendarExplorerChallenge): KnownMiss[] {
  if (c.type === 'month_sequence') return monthSpokenMisses(c.currentMonth ?? '', c.expectedMonth ?? '');
  const at = weekday(c.currentDay ?? ''), want = weekday(c.expectedDay ?? '');
  if (at < 0 || want < 0) return [];
  const fact = `The day after ${dayName(at)} is ${dayName(want)}.`;
  return [
    { id: 'start_day', pattern: `${fact} The learner's answer is ${dayName(at)}, the day they were given, said back.`, examples: [dayName(at)] },
    { id: 'day_after', pattern: `${fact} The learner's answer is ${dayName(want + 1)}, one day past ${dayName(want)}.`, examples: [dayName(want + 1)] },
    { id: 'day_before_start', pattern: `${fact} The learner's answer is ${dayName(at - 1)}, the day before ${dayName(at)}: counting backwards.`,
      examples: [dayName(at - 1)] },
    { id: 'other_day', pattern: `${fact} The learner's answer is another day of the week, not ${dayName(at)}, ${dayName(want)}, `
      + `${dayName(want + 1)} or ${dayName(at - 1)}.`, examples: [dayName(want + 3)] },
  ];
}

function monthSpokenMisses(currentMonth: string, expectedMonth: string): KnownMiss[] {
  const at = MONTH_NAMES.findIndex(m => m.toLowerCase() === currentMonth.trim().toLowerCase());
  const want = MONTH_NAMES.findIndex(m => m.toLowerCase() === expectedMonth.trim().toLowerCase());
  if (at < 0 || want < 0) return [];
  const month = (i: number) => MONTH_NAMES[(i + 12) % 12];
  const fact = `The month after ${month(at)} is ${month(want)}.`;
  return [
    { id: 'start_month', pattern: `${fact} The learner's answer is ${month(at)}, the month they were given, said back.`, examples: [month(at)] },
    { id: 'month_after', pattern: `${fact} The learner's answer is ${month(want + 1)}, one month past ${month(want)}.`, examples: [month(want + 1)] },
    { id: 'month_before_start', pattern: `${fact} The learner's answer is ${month(at - 1)}, the month before ${month(at)}: counting backwards.`,
      examples: [month(at - 1)] },
    { id: 'other_month', pattern: `${fact} The learner's answer is another month, not ${month(at)}, ${month(want)}, ${month(want + 1)} or ${month(at - 1)}.`,
      examples: [month(want + 4)] },
  ];
}

/** What a checked wrong pick shows (handoff 20), by the kind of answer the item asks for; the ids are the card's. */
export function calendarMiss(c: CalendarExplorerChallenge, picked: string): CalendarMiss | undefined {
  const key = c.correctAnswer ?? '';
  if (!picked || picked.trim().toLowerCase() === key.trim().toLowerCase()) return undefined;
  if (c.type === 'count' || c.type === 'interval_count') {
    const d = Number(picked) - Number(key);
    if (!Number.isFinite(d)) return undefined;
    return d === -1 ? 'one_less' : d === 1 ? 'one_more' : 'other_count';
  }
  const want = weekday(key), got = weekday(picked);
  if (want >= 0 && got >= 0) {
    if (c.type === 'day_offset' && c.startDay && got === weekday(c.startDay)) return 'start_day';
    return (got + 1) % 7 === want ? 'day_before' : (want + 1) % 7 === got ? 'day_after' : 'other_day';
  }
  const d = dateNumber(picked) - dateNumber(key);
  if (!Number.isFinite(d) || c.type === 'day_offset') return undefined;
  return d % 7 === 0 ? 'same_column_date' : Math.abs(d) === 1 ? 'next_to_date' : 'other_date';
}

/** How a check reads to the tutor and the observer: what the learner picked, never the key. */
export const describeCalendarPick = (c: CalendarExplorerChallenge, picked: string) =>
  isGridDateAnswer(c) ? `Picked the date ${picked}.` : `Picked "${picked}".`;

// ── The scenes ───────────────────────────────────────────────────────────────

export interface CalendarGridView {
  showDayHeaders: boolean;
  showMonthLabel: boolean;
  showTargetDayColumn: boolean;
  /** The tier withdrew the header row and the `day_headers` lever put it back. */
  headersBack: boolean;
}

/**
 * This item's never-say rules, from the old catalog guidance and reveal policy. What the shared rules already say
 * (never the answer before a try, you cannot tap) is not repeated.
 */
function constraintsOf(c: CalendarExplorerChallenge, view: CalendarGridView): string {
  if (c.type === 'day_offset') return '';
  if (view.headersBack) return 'The header row is back on screen: you may point to it; never name the answer column.';
  if (!view.showDayHeaders) return 'The day-name header row is withdrawn on purpose: never recite the days of the week in order '
    + 'or say which column to look at; ask what the learner notices about where the dates sit.'
    + (c.type === 'count' && !view.showTargetDayColumn ? ' The days to count are not tinted: never say where they are.' : '');
  return '';
}

/** What the grid shows. The key, the highlight dates and the marker's answer date are never in it. */
export function calendarGridScene(c: CalendarExplorerChallenge, view: CalendarGridView): SceneOf {
  const facts: Record<string, string | number> = { kind: c.type };
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
  const constraints = constraintsOf(c, view);
  if (constraints) facts.constraints = constraints;
  return { objects: [], facts };
}

export function calendarSequenceScene(c: CalendarExplorerChallenge): SceneOf {
  const { unit, current } = unitOf(c);
  return { objects: [], facts: {
    kind: c.type,
    say: `the ${unit} ${current}`,
    shown: 'A listen card only: no day or month names are printed.',
    chain: `The chain goes on from the next ${unit} on the next turn.`,
  } };
}

/** What the replay button asks the tutor to say: the day or month and the question, never the answer. */
export const hearSequenceRequest = (c: CalendarExplorerChallenge) =>
  `The learner tapped to hear the question again. Say only this, once: "${calendarAsk(c)}" Never say the answer.`;
