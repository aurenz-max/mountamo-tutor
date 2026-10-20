/**
 * The in-item levers on a calendar-explorer item, as one lever set (`CALENDAR_LEVERS`, `bossLevers.ts`;
 * `/add-support-tiers`, report qa/eval-reports/calendar-explorer-levers-2026-10-08.md). No real-learner evidence: the
 * misses are what `calendarMiss` and `calendarSpokenMisses` observe. Pure: the component draws from these, the set
 * publishes them, the tests hold each leak rule. Every simpler item has the id `<item>~simpler`, the same mode, and is
 * built by `calendarPracticeItem`.
 *
 * Help (the screen does more; the question is unchanged):
 * - `day_headers` (marks) the Sun..Sat header row back, only where the tier withdrew it (identify, pattern, count).
 * - `ring_dates` (marks) a ring on each date the question names, never on the answer date (`ringLeaks`; identify, pattern).
 * - `weekday_tint` (marks) every cell of the weekday the question names, only when the answer is a date or a count,
 *   never a weekday (`tintLeaks`; identify, pattern, and count where the tier withdrew its tint).
 * - `time_arrow` (marks) an arrow over the calendar: days go left to right along a row, then on to the next row; on no
 *   cell (identify and pattern items with a today star).
 * - `row_ranges` (marks) each week row's first and last date at its left; no cell marked (mark_events).
 * - `tick_taps` (marks) a tap on a date leaves a tick the learner can take off again; code never ticks (count,
 *   interval_count).
 * - `week_strip` (layout) the seven days in order from the start day, only the start marked (`stripLeaks`; day_offset).
 * - `model_pair` (model; spoken chains) two OTHER days or months in order, never the turn's own or a pair still ahead
 *   in the chain (`modelPairLeaks`). When it comes is the item's support tier (`support`; medium when none).
 *
 * Simplify (`simpler_question`, easier, the same mode one step simpler): identify the FIRST of the asked weekday; mark a
 * date in the top row; count a weekday in February 2026 (four full rows); count forward one day from another start; an
 * interval two days long. Never the item's own answer or another item's question (`practiceLeaks`).
 *
 * The easy tier starts a grid item with its help levers shown (`tierShown`); a starting position is not a pull.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { CalendarExplorerChallenge } from './CalendarExplorer';
import { CALENDAR_MISSES, COUNT_MISSES, DATE_MISSES, OFFSET_MISSES, WEEKDAY_MISSES } from './calendarExplorer.card';
import { isChain } from './calendarExplorerWorkspace';

export const HEADERS_LEVER = 'day_headers';
export const RING_LEVER = 'ring_dates';
export const TINT_LEVER = 'weekday_tint';
export const ARROW_LEVER = 'time_arrow';
export const ROWS_LEVER = 'row_ranges';
export const TICKS_LEVER = 'tick_taps';
export const STRIP_LEVER = 'week_strip';
export const MODEL_PAIR_LEVER = 'model_pair';
export const SIMPLER_LEVER = 'simpler_question';
export const PRACTICE_SUFFIX = '~simpler';
export const PRACTICE_NOTE = 'An easier practice question, ungraded; the full question comes back after it.';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const daysIn = (month: number, year: number) => new Date(year, month, 0).getDate();
const firstDayOf = (month: number, year: number) => new Date(year, month - 1, 1).getDay();
const dayIndex = (s?: string) => WEEKDAYS.findIndex(w => w.toLowerCase() === (s ?? '').trim().toLowerCase());
const lower = (s: string) => (s ?? '').trim().toLowerCase();

/** The answer as a day of the month ("15" or "March 15"), or null when it is a weekday or a count. */
export function answerDate(c: CalendarExplorerChallenge): number | null {
  if (c.type === 'count' || c.type === 'interval_count' || c.type === 'day_offset') return null;
  const m = /^(?:[a-z]+\s+)?(\d{1,2})$/i.exec((c.correctAnswer ?? '').trim());
  return m ? Number(m[1]) : null;
}
const isWeekdayAnswer = (c: CalendarExplorerChallenge) => dayIndex(c.correctAnswer) >= 0;

/** What a lever reads beyond the item: every item in the session (a simpler item never repeats one), the tier, the band. */
export interface CalendarSession {
  challenges: readonly CalendarExplorerChallenge[];
  supportTier?: 'easy' | 'medium' | 'hard';
  gradeBand?: string;
}

// ── ring_dates (identify, pattern) ─────────────────────────────────────────

/** The dates of the item's own month that its question names ("March 15", "the 8th"). */
export function namedDates(c: CalendarExplorerChallenge): number[] {
  if (c.type !== 'identify' && c.type !== 'pattern') return [];
  const out: number[] = [];
  const month = MONTHS[c.month - 1];
  const collect = (re: RegExp) => { let m: RegExpExecArray | null; while ((m = re.exec(c.question))) out.push(Number(m[1])); };
  if (month) collect(new RegExp(`\\b${month}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'gi'));
  collect(/\bthe\s+(\d{1,2})(?:st|nd|rd|th)\b/gi);
  const n = daysIn(c.month, c.year);
  return out.filter((d, i) => d >= 1 && d <= n && out.indexOf(d) === i).sort((a, b) => a - b);
}

/** Leak rule: a ring never sits on the answer date. */
export const ringLeaks = (c: CalendarExplorerChallenge, dates: readonly number[]) => {
  const a = answerDate(c);
  return a !== null && dates.includes(a);
};

/** The dates to ring: the named dates other than the answer; null when none is left. */
export function ringDates(c: CalendarExplorerChallenge): number[] | null {
  const a = answerDate(c);
  const dates = namedDates(c).filter(d => d !== a);
  return dates.length && !ringLeaks(c, dates) ? dates : null;
}

// ── weekday_tint (identify, pattern, count) ────────────────────────────────

const WEEKDAY_RE = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?\b/i;

/** The weekday the item asks about: count's target, else the first weekday its question names. */
export function namedWeekday(c: CalendarExplorerChallenge): string | null {
  if (c.type === 'count') return dayIndex(c.targetDayOfWeek) >= 0 ? WEEKDAYS[dayIndex(c.targetDayOfWeek)] : null;
  const m = WEEKDAY_RE.exec(c.question);
  return m ? WEEKDAYS[dayIndex(m[1])] : null;
}

/** Leak rule: a tinted column whose name is the answer marks the answer, so a weekday answer is never tinted. */
export const tintLeaks = (c: CalendarExplorerChallenge) => isWeekdayAnswer(c);

/** The weekday to tint, or null. identify and pattern: only on a date answer whose question names a weekday. */
export function tintWeekday(c: CalendarExplorerChallenge): string | null {
  if (tintLeaks(c)) return null;
  if (c.type === 'count') return namedWeekday(c);
  if ((c.type === 'identify' || c.type === 'pattern') && answerDate(c) !== null) return namedWeekday(c);
  return null;
}

// ── row_ranges (mark_events) ───────────────────────────────────────────────

/** Each week row of two or more dates as [first, last], top to bottom; a row of one date gets no label. */
export function rowRanges(c: CalendarExplorerChallenge): Array<[number, number]> {
  const n = daysIn(c.month, c.year), lead = firstDayOf(c.month, c.year);
  const rows: Array<[number, number]> = [];
  for (let start = 1 - lead; start <= n; start += 7) {
    const first = Math.max(1, start), last = Math.min(n, start + 6);
    if (last > first) rows.push([first, last]);
  }
  return rows;
}

/** Leak rule: a label that is one date alone would single out that cell; never when it is the answer. */
export const rowsLeak = (ranges: ReadonlyArray<[number, number]>, c: CalendarExplorerChallenge) =>
  ranges.some(([a, b]) => a === b && a === answerDate(c));

// ── week_strip (day_offset) ────────────────────────────────────────────────

/** The seven days in order from the start day. */
export function weekStrip(c: CalendarExplorerChallenge): string[] | null {
  const at = dayIndex(c.startDay);
  return c.type === 'day_offset' && at >= 0 ? Array.from({ length: 7 }, (_, i) => WEEKDAYS[(at + i) % 7]) : null;
}

/** Leak rule: seven days from the start, and the start is the only one marked (the landing is never marked). */
export const stripLeaks = (strip: readonly string[], marked: readonly number[], c: CalendarExplorerChallenge) =>
  strip.length !== 7 || new Set(strip).size !== 7 || lower(strip[0]) !== lower(c.startDay ?? '')
  || marked.length !== 1 || marked[0] !== 0;

// ── model_pair (spoken day and month chains) ───────────────────────────────

const namesOf = (c: CalendarExplorerChallenge) => (c.type === 'day_sequence' ? WEEKDAYS : MONTHS);
const pairOf = (c: CalendarExplorerChallenge): [string, string] => c.type === 'day_sequence'
  ? [c.currentDay ?? '', c.expectedDay ?? ''] : [c.currentMonth ?? '', c.expectedMonth ?? ''];
const pairKey = (a: string, b: string) => `${lower(a)}>${lower(b)}`;
const turnsFrom = (c: CalendarExplorerChallenge, items: readonly CalendarExplorerChallenge[]) => {
  const at = items.findIndex(i => i.id === c.id);
  return (at < 0 ? [c, ...items] : items.slice(at)).filter(i => i.type === c.type);
};

/** Leak rule: neither name is the turn's own day (or month) or its successor, and the pair is no turn still ahead. */
export function modelPairLeaks(pair: readonly [string, string], c: CalendarExplorerChallenge,
  items: readonly CalendarExplorerChallenge[]): boolean {
  const [current, expected] = pairOf(c).map(lower);
  if (pair.some(n => lower(n) === current || lower(n) === expected)) return true;
  const ahead = new Set(turnsFrom(c, items).map(i => pairKey(...pairOf(i))));
  return ahead.has(pairKey(pair[0], pair[1]));
}

/** Two other names in order, as far round the cycle from the turn as the leak rule allows; null if none. */
export function modelPair(c: CalendarExplorerChallenge, items: readonly CalendarExplorerChallenge[]): [string, string] | null {
  if (!isChain(c)) return null;
  const names = namesOf(c), n = names.length;
  const at = names.findIndex(x => lower(x) === lower(pairOf(c)[0]));
  if (at < 0) return null;
  for (let k = 3; k < n + 3; k++) {
    const pair: [string, string] = [names[(at + k) % n], names[(at + k + 1) % n]];
    if (!modelPairLeaks(pair, c, items)) return pair;
  }
  return null;
}

const unitOf = (c: CalendarExplorerChallenge) => (c.type === 'day_sequence' ? 'day' : 'month');

// ── simpler items ──────────────────────────────────────────────────────────

/**
 * Leak rule for a simpler item: never the item's id, never another mode, never the item's own answer, and never the
 * question of any item in the session.
 */
export function practiceLeaks(p: CalendarExplorerChallenge, c: CalendarExplorerChallenge, session: Pick<CalendarSession, 'challenges'>): boolean {
  return p.id === c.id || p.type !== c.type || lower(p.correctAnswer) === lower(c.correctAnswer)
    || session.challenges.some(x => lower(x.question) === lower(p.question));
}

const practiceOf = (c: CalendarExplorerChallenge, fields: Partial<CalendarExplorerChallenge>): CalendarExplorerChallenge =>
  ({ ...c, id: `${c.id}${PRACTICE_SUFFIX}`, hint: '', narration: '', ...fields });

const ORDINAL_RE = /\b(first|second|third|fourth|fifth|last)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;

/** identify "the Nth <weekday>" → the FIRST of that weekday in the same month. Null when the ask is already first. */
function firstOfWeekday(c: CalendarExplorerChallenge): CalendarExplorerChallenge | null {
  if (c.type !== 'identify' || answerDate(c) === null || c.todayDate !== undefined) return null;
  const m = ORDINAL_RE.exec(c.question);
  if (!m || lower(m[1]) === 'first') return null;
  const wd = dayIndex(m[2]);
  const first = 1 + ((wd - firstDayOf(c.month, c.year) + 7) % 7);
  return practiceOf(c, { question: c.question.replace(ORDINAL_RE, (_all, _o, day: string) => `first ${day}`),
    correctAnswer: String(first), options: [], highlightDates: [first] });
}

/** mark_events: a free date in the top row, when the item's date is below it. */
function topRowMark(c: CalendarExplorerChallenge, session: Pick<CalendarSession, 'challenges'>): CalendarExplorerChallenge | null {
  const a = answerDate(c);
  if (c.type !== 'mark_events' || a === null) return null;
  const rowEnd = 7 - firstDayOf(c.month, c.year);
  if (a <= rowEnd) return null;
  const taken = new Set([...(c.markedDates ?? []), ...session.challenges.map(x => x.type === 'mark_events' ? answerDate(x) : null)]);
  const free = Array.from({ length: rowEnd }, (_, i) => i + 1).filter(d => !taken.has(d));
  if (!free.length) return null;
  const d = free[Math.floor((free.length - 1) / 2)];
  const label = c.eventLabel ?? 'the event';
  return practiceOf(c, { question: `Mark ${label} on ${MONTHS[c.month - 1]} ${d}.`, correctAnswer: String(d), highlightDates: [d] });
}

/** count: the same weekday in February 2026, which starts on a Sunday: four full rows, four of every weekday. Null when
 *  the item's own count is 4 (the practice would hand it over) or the item is that month. */
function fourRowCount(c: CalendarExplorerChallenge): CalendarExplorerChallenge | null {
  const wd = namedWeekday(c);
  if (c.type !== 'count' || !wd || c.correctAnswer.trim() === '4' || (c.month === 2 && c.year === 2026)) return null;
  return practiceOf(c, { question: `How many ${wd}s are in February 2026?`, month: 2, year: 2026, correctAnswer: '4',
    options: ['3', '4', '5', '6'], targetDayOfWeek: wd, highlightDates: undefined });
}

/** day_offset: count forward ONE day from another start. Null when the item already counts one. */
function oneDayForward(c: CalendarExplorerChallenge): CalendarExplorerChallenge | null {
  const at = dayIndex(c.startDay);
  if (c.type !== 'day_offset' || at < 0 || (c.offsetDays ?? 0) <= 1) return null;
  const avoid = new Set([lower(c.startDay ?? ''), lower(c.correctAnswer)]);
  for (let k = 3; k < 10; k++) {
    const start = WEEKDAYS[(at + k) % 7], land = WEEKDAYS[(at + k + 1) % 7];
    if (avoid.has(lower(start)) || avoid.has(lower(land))) continue;
    return practiceOf(c, { question: `Start on ${start}. Count forward 1 day. What day do you land on?`,
      correctAnswer: land, options: [...WEEKDAYS], startDay: start, offsetDays: 1 });
  }
  return null;
}

function intervalOptions(answer: number): string[] {
  const values = new Set<number>([answer]);
  for (const delta of [-2, -1, 1, 2, 3]) {
    if (answer + delta >= 0) values.add(answer + delta);
    if (values.size === 4) break;
  }
  return Array.from(values).sort((a, b) => a - b).slice(0, 4).map(String);
}

/** interval_count: two days apart, the same convention, away from the item's markers. Null when already that short. */
function shortInterval(c: CalendarExplorerChallenge): CalendarExplorerChallenge | null {
  const s0 = c.intervalStartDate, e0 = c.intervalEndDate;
  if (c.type !== 'interval_count' || s0 === undefined || e0 === undefined || e0 - s0 <= 2) return null;
  const n = daysIn(c.month, c.year), between = c.countConvention !== 'inclusive';
  const starts = [...Array.from({ length: n - 2 }, (_, i) => i + 1)].filter(s => s + 2 < s0 || s > e0);
  const s = starts[Math.floor((starts.length - 1) / 2)];
  if (s === undefined) return null;
  const e = s + 2, answer = between ? 1 : 3, month = MONTHS[c.month - 1];
  return practiceOf(c, {
    question: between
      ? `How many days are between ${month} ${s} and ${month} ${e}? Do not count the two marked days.`
      : `How many calendar days are there from ${month} ${s} through ${month} ${e}? Count both marked days.`,
    correctAnswer: String(answer), options: intervalOptions(answer), markedDates: [s, e], intervalStartDate: s, intervalEndDate: e,
  });
}

/** The simpler item for a session item, same mode, or null where the item is already the plainest of its kind (or the
 *  mode has no code-built simpler item: pattern, a weekday identify, the chains). */
export function calendarPracticeItem(c: CalendarExplorerChallenge, session: Pick<CalendarSession, 'challenges'>): CalendarExplorerChallenge | null {
  const p = c.type === 'identify' ? firstOfWeekday(c)
    : c.type === 'mark_events' ? topRowMark(c, session)
      : c.type === 'count' ? fourRowCount(c)
        : c.type === 'day_offset' ? oneDayForward(c)
          : c.type === 'interval_count' ? shortInterval(c) : null;
  return p && !practiceLeaks(p, c, session) ? p : null;
}

/** The session item a practice id stands in for. */
export const calendarPracticeParent = (id: string | null | undefined, challenges: readonly CalendarExplorerChallenge[]) =>
  id?.endsWith(PRACTICE_SUFFIX) ? challenges.find(c => `${c.id}${PRACTICE_SUFFIX}` === id) ?? null : null;

// ── what the tier withdrew ─────────────────────────────────────────────────

/** The K band floor withdraws nothing. */
const preReader = (s: CalendarSession) => s.gradeBand === 'K';
/** The tier withdrew the Sun..Sat header row on this item. */
export const headersWithdrawn = (c: CalendarExplorerChallenge, s: CalendarSession) => !preReader(s) && c.showDayHeaders === false;
/** The tier withdrew count's target-day tint on this item. */
export const tintWithdrawn = (c: CalendarExplorerChallenge, s: CalendarSession) =>
  c.type === 'count' && !preReader(s) && c.showTargetDayColumn === false;

// ── the lever set ──────────────────────────────────────────────────────────

const back = 'then this question comes back blank.';
const IDENTIFY_PATTERN = ['identify', 'pattern'] as const;

export const CALENDAR_LEVERS = leverSet<CalendarExplorerChallenge, CalendarSession>({
  modeOf: c => c.type,
  missesOf: mode => CALENDAR_MISSES[mode as keyof typeof CALENDAR_MISSES] ?? [],
  // The model pair is two other days (or months) in order; when it comes is the tier's.
  support: {
    tier: c => c.supportTier ?? 'medium',
    different: c => `two other ${unitOf(c)}s in order`,
    own: c => `the ${unitOf(c)} that comes next`,
  },
  specs: [
    { id: RING_LEVER, type: 'marks', modes: IDENTIFY_PATTERN, answers: [...WEEKDAY_MISSES, ...DATE_MISSES], content: c => ringDates(c),
      when: 'The learner picks a day or date next to the right one, or cannot find the date the question names.',
      does: 'Draws a ring on each date the question names. Point to the ring; never say which column or day it is in.',
      fact: (ring: number[], c) => `A ring on ${ring.map(d => `${MONTHS[c.month - 1]} ${d}`).join(' and ')}, `
        + `the date${ring.length > 1 ? 's' : ''} the question names.` },
    { id: TINT_LEVER, type: 'marks', modes: IDENTIFY_PATTERN, answers: DATE_MISSES, content: c => tintWeekday(c),
      when: 'The learner taps a date in the wrong column, or the wrong week of the right column.',
      does: c => `Tints every ${tintWeekday(c)} on the calendar. You may point to the tinted cells; never say which one is the answer.`,
      fact: (day: string) => `Every ${day} on the calendar is tinted.` },
    { id: TINT_LEVER, type: 'marks', modes: ['count'], answers: COUNT_MISSES,
      content: (c, s) => (tintWithdrawn(c, s) ? tintWeekday(c) : null),
      when: 'The learner cannot find the days to count.',
      // The scene's `shown` names the tint while it is on screen.
      does: c => `Tints every ${tintWeekday(c)} on the calendar again. Never count them or say how many there are.` },
    { id: ARROW_LEVER, type: 'marks', carrier: 'both', modes: IDENTIFY_PATTERN, answers: [...WEEKDAY_MISSES, ...DATE_MISSES],
      offer: c => c.todayDate !== undefined,
      when: 'The learner goes the wrong way from today (before for after), or lands two or more days off.',
      does: 'Draws an arrow over the calendar: days go left to right along a row, then on to the next row. It is on no date; '
        + 'never say which square comes before or after the star.',
      fact: 'An arrow over the calendar shows the days go left to right along a row, then on to the next row; it is on no date.' },
    { id: HEADERS_LEVER, type: 'marks', modes: IDENTIFY_PATTERN, answers: [...WEEKDAY_MISSES, 'next_to_date'],
      offer: (c, s) => headersWithdrawn(c, s),
      when: 'The learner cannot tell which day of the week a column is.',
      does: 'Puts the Sun to Sat header row back above the calendar. You may point to it; never read out the answer column.',
      fact: 'The Sun to Sat header row is back above the calendar.' },
    { id: TICKS_LEVER, type: 'marks', modes: ['count', 'interval_count'], answers: COUNT_MISSES,
      when: 'The learner\'s count is one off or more: they lose track of what they have counted.',
      does: 'Lets the learner tap each date as they count to leave a tick on it (tap again to take it off). Only the learner\'s '
        + 'taps make ticks. Suggest tapping as they count; never count for them or say how many.',
      fact: 'Tapping a date now leaves a tick on it (tap again to take it off); only the learner\'s taps make ticks.' },
    { id: HEADERS_LEVER, type: 'marks', modes: ['count'], answers: ['other_count'], offer: (c, s) => headersWithdrawn(c, s),
      when: 'The learner cannot find which column is the day to count.',
      does: 'Puts the Sun to Sat header row back above the calendar. Never say how many there are.',
      fact: 'The Sun to Sat header row is back above the calendar.' },
    { id: ROWS_LEVER, type: 'marks', modes: ['mark_events'], answers: DATE_MISSES,
      content: c => { const rows = rowRanges(c); return rows.length && !rowsLeak(rows, c) ? rows : null; },
      when: 'The learner puts the marker on the wrong date, a week off or next to it.',
      does: 'Writes each week row\'s first and last date at its left. You may point to the row labels; never say which row or square.',
      fact: 'Each week row has its first and last date written at its left.' },
    { id: STRIP_LEVER, type: 'layout', modes: ['day_offset'], answers: OFFSET_MISSES, content: c => weekStrip(c),
      when: 'The learner lands on the start day, one short, one past, or elsewhere.',
      does: c => `Shows the seven days in order starting at ${c.startDay}, only ${c.startDay} marked. Point to the start; `
        + 'never count along it for them or say where they land.',
      fact: (strip: string[]) => `A strip of the seven days in order starting at ${strip[0]}, only ${strip[0]} marked as the start.` },
    { id: MODEL_PAIR_LEVER, type: 'model', modes: ['day_sequence', 'month_sequence'], answers: 'all',
      content: (c, s) => modelPair(c, s.challenges),
      when: c => `The learner says the given ${unitOf(c)} back, skips one, goes backwards, or says another ${unitOf(c)}.`,
      does: c => `Shows a model card of two OTHER ${unitOf(c)}s in order. Read it once ("after the first comes the second"), then `
        + `ask this turn again. It is not this turn: never say this turn's ${unitOf(c)} or the one after it, and do not go on from the model.`,
      fact: (pair: [string, string], c) => `A model card: ${pair[0]}, then ${pair[1]} (two other ${unitOf(c)}s in order, printed with `
        + `an arrow between them). It is not this turn: never say this turn's ${unitOf(c)} or the one after it.` },
    { id: SIMPLER_LEVER, type: 'easier', carrier: 'shown', modes: ['identify'], answers: ['same_column_date', 'other_date'],
      content: (c, s) => calendarPracticeItem(c, s),
      when: 'The learner cannot find the right one of that weekday even with the help.',
      does: c => `Opens an ungraded practice question asking for the first ${namedWeekday(c)} of the same month; ${back}` },
    { id: SIMPLER_LEVER, type: 'easier', carrier: 'shown', modes: ['mark_events'], answers: DATE_MISSES,
      content: (c, s) => calendarPracticeItem(c, s),
      when: 'The learner still cannot find the date with the row labels on screen.',
      does: `Opens an ungraded practice question: mark a date in the top row; ${back}` },
    { id: SIMPLER_LEVER, type: 'easier', carrier: 'shown', modes: ['count'], answers: COUNT_MISSES,
      content: (c, s) => calendarPracticeItem(c, s),
      when: 'The learner still miscounts with the ticks.',
      does: `Opens an ungraded practice question: count the same day in February 2026, a month of four full rows; ${back}` },
    { id: SIMPLER_LEVER, type: 'easier', carrier: 'shown', modes: ['interval_count'], answers: COUNT_MISSES,
      content: (c, s) => calendarPracticeItem(c, s),
      when: 'The learner still miscounts with the ticks.',
      does: `Opens an ungraded practice question: two marked dates two days apart, the same counting rule; ${back}` },
    { id: SIMPLER_LEVER, type: 'easier', carrier: 'shown', modes: ['day_offset'], answers: OFFSET_MISSES,
      content: (c, s) => calendarPracticeItem(c, s),
      when: 'The learner still cannot count forward with the week strip.',
      does: `Opens an ungraded practice question: count forward one day from another start; ${back}` },
  ],
});

/** The help levers the easy tier starts a grid item with, shown from the start; not a pull. */
export const tierShown = (c: CalendarExplorerChallenge | null, s: CalendarSession): string[] =>
  (c && !isChain(c) && s.supportTier === 'easy'
    ? CALENDAR_LEVERS.declare(c, s, []).filter(l => l.kind === 'help').map(l => l.id) : []);
