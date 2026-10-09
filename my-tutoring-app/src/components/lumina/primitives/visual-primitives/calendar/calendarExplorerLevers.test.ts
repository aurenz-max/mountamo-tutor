/**
 * calendar-explorer levers (`calendarExplorerLevers.ts`): each leak rule per mode, each simpler-question builder over
 * many items (same mode, its key recomputed, never the item's own answer), the miss → lever table, and lever coverage
 * on the saved payloads' items (a lever that exists only on made-up items is not a lever).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { CalendarExplorerChallenge } from './CalendarExplorer';
import { calendarMiss, calendarSequenceItemsFromChallenges } from './calendarExplorerWorkspace';
import type { CalendarSequenceItem } from './calendarExplorerScript';
import {
  ARROW_LEVER, HEADERS_LEVER, MODEL_PAIR_LEVER, RING_LEVER, ROWS_LEVER, SIMPLER_LEVER, STRIP_LEVER, TICKS_LEVER, TINT_LEVER,
  calendarGridLevers, calendarLeverFacts, calendarPracticeItem, calendarPracticeParent, calendarSequenceLevers, modelPair,
  modelPairLeaks, namedDates, practiceLeaks, ringDates, ringLeaks, rowRanges, rowsLeak, stripLeaks, tintLeaks, tintWeekday,
  weekStrip,
} from './calendarExplorerLevers';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dayOf = (d: number, m: number, y: number) => WEEKDAYS[new Date(y, m - 1, d).getDay()];
const daysIn = (m: number, y: number) => new Date(y, m, 0).getDate();

const ch = (over: Partial<CalendarExplorerChallenge>): CalendarExplorerChallenge => ({ id: 'c1', type: 'identify', question: '',
  month: 3, year: 2025, correctAnswer: '', options: [], hint: 'h', narration: 'n', ...over });
const solo = (c: CalendarExplorerChallenge) => ({ challenges: [c] });
const none = { headers: false, tint: false };

/** Every "Nth <weekday>" identify in 2024-2026. */
const ordinalItems = () => [2024, 2025, 2026].flatMap(year => Array.from({ length: 12 }, (_, i) => i + 1).flatMap(month =>
  WEEKDAYS.flatMap(wd => (['second', 'third', 'fourth'] as const).map((ord, k) => {
    const dates = Array.from({ length: daysIn(month, year) }, (_, d) => d + 1).filter(d => dayOf(d, month, year) === wd);
    return ch({ question: `What date is the ${ord} ${wd} of ${MONTHS[month - 1]} ${year}?`, month, year, correctAnswer: String(dates[k + 1]) });
  }))));

describe('help levers: each leak rule', () => {
  it('ring_dates: rings the named dates, never the answer date', () => {
    const weekday = ch({ question: 'What day of the week is March 15, 2025?', correctAnswer: 'Saturday' });
    expect(ringDates(weekday)).toEqual([15]);
    const pattern = ch({ type: 'pattern', question: 'What is the date exactly 2 weeks after March 5, 2025?', correctAnswer: '19' });
    expect(ringDates(pattern)).toEqual([5]);
    const patternNamed = ch({ type: 'pattern', question: 'March 5 is a Wednesday. Is March 19 also one? Tap March 19.', correctAnswer: 'March 19' });
    expect(namedDates(patternNamed)).toEqual([5, 19]);
    expect(ringDates(patternNamed)).toEqual([5]);
    expect(ringLeaks(patternNamed, [5, 19])).toBe(true);
    expect(ringDates(ch({ question: 'What date is the second Tuesday of March 2025?', correctAnswer: '11' }))).toBeNull();
    // The year after the caption month is not a date.
    expect(namedDates(ch({ question: 'How about March 2025?' }))).toEqual([]);
    for (let d = 1; d <= 31; d++) {
      const c = ch({ type: 'pattern', question: `What is the date one week after March ${d}?`, correctAnswer: String(d + 7) });
      const ring = ringDates(c);
      if (ring) expect(ringLeaks(c, ring)).toBe(false);
    }
  });

  it('weekday_tint: never on a weekday answer (the tinted column would be the answer)', () => {
    expect(tintWeekday(ch({ type: 'pattern', question: 'March 3 is a Monday. What day is March 17?', correctAnswer: 'Monday' }))).toBeNull();
    expect(tintLeaks(ch({ correctAnswer: 'Friday' }))).toBe(true);
    expect(tintWeekday(ch({ question: 'What date is the second Tuesday of March 2025?', correctAnswer: '11' }))).toBe('Tuesday');
    expect(tintWeekday(ch({ type: 'count', targetDayOfWeek: 'Friday', correctAnswer: '5' }))).toBe('Friday');
    expect(calendarGridLevers(ch({ question: 'What day of the week is March 15, 2025?', correctAnswer: 'Saturday' }), { challenges: [] }, none, [])
      .map(l => l.id)).not.toContain(TINT_LEVER);
  });

  it('row_ranges: every row of two or more dates, in order, and no label singles out the answer', () => {
    for (const year of [2024, 2025, 2026]) for (let month = 1; month <= 12; month++) {
      const c = ch({ type: 'mark_events', month, year, correctAnswer: '1' });
      const rows = rowRanges(c);
      expect(rows.every(([a, b]) => b > a)).toBe(true);
      // A last row of one date gets no label.
      expect(rows.at(-1)![1]).toBeGreaterThanOrEqual(daysIn(month, year) - 1);
      expect(rowsLeak(rows, c)).toBe(false);
    }
  });

  it('week_strip: seven days from the start, only the start marked', () => {
    for (const start of WEEKDAYS) {
      const c = ch({ type: 'day_offset', startDay: start, offsetDays: 3, correctAnswer: WEEKDAYS[(WEEKDAYS.indexOf(start) + 3) % 7] });
      const strip = weekStrip(c)!;
      expect(strip[0]).toBe(start);
      expect(stripLeaks(strip, [0], c)).toBe(false);
      expect(stripLeaks(strip, [0, 3], c)).toBe(true);
    }
  });

  it('model_pair: on every day and month chain, at every turn, two other names that are no turn still ahead', () => {
    for (const unit of ['day', 'month'] as const) {
      const names = unit === 'day' ? WEEKDAYS : MONTHS;
      for (let start = 0; start < names.length; start++) {
        const items: CalendarSequenceItem[] = Array.from({ length: 5 }, (_, i) => unit === 'day'
          ? { id: `t${i}`, type: 'day_sequence', currentDay: names[(start + i) % 7], expectedDay: names[(start + i + 1) % 7] } as CalendarSequenceItem
          : { id: `t${i}`, type: 'month_sequence', currentMonth: names[(start + i) % 12], expectedMonth: names[(start + i + 1) % 12] } as CalendarSequenceItem);
        for (const item of items) {
          const pair = modelPair(item, items)!;
          expect(pair).not.toBeNull();
          expect(modelPairLeaks(pair, item, items)).toBe(false);
          expect(names.indexOf(pair[1])).toBe((names.indexOf(pair[0]) + 1) % names.length);
          expect(calendarSequenceLevers(item, items, []).map(l => l.id)).toEqual([MODEL_PAIR_LEVER]);
        }
      }
    }
    const item = { id: 'x', type: 'day_sequence', currentDay: 'Monday', expectedDay: 'Tuesday' } as CalendarSequenceItem;
    expect(modelPairLeaks(['Tuesday', 'Wednesday'], item, [item])).toBe(true);
    expect(modelPairLeaks(['Monday', 'Tuesday'], item, [item])).toBe(true);
  });

  it('the scene facts name what is drawn, never the answer', () => {
    const c = ch({ question: 'What day of the week is March 15, 2025?', correctAnswer: 'Saturday' });
    const fact = calendarLeverFacts(c, [RING_LEVER, HEADERS_LEVER])!;
    expect(fact).toMatch(/A ring on March 15/);
    expect(fact).not.toMatch(/Saturday/);
    const offset = ch({ type: 'day_offset', startDay: 'Tuesday', offsetDays: 3, correctAnswer: 'Friday' });
    expect(calendarLeverFacts(offset, [STRIP_LEVER])).not.toMatch(/Friday/);
  });
});

describe('simpler questions: same mode, recomputed key, never the item\'s own', () => {
  it('identify: the first of the asked weekday, over every Nth-weekday ask in three years', () => {
    for (const c of ordinalItems()) {
      const p = calendarPracticeItem(c, solo(c))!;
      expect(p).not.toBeNull();
      expect(p).toMatchObject({ id: 'c1~simpler', type: 'identify', month: c.month, year: c.year });
      const wd = /first (\w+)/.exec(p.question)![1];
      expect(dayOf(Number(p.correctAnswer), c.month, c.year)).toBe(wd);
      expect(Number(p.correctAnswer)).toBeLessThanOrEqual(7);
      expect(practiceLeaks(p, c, solo(c))).toBe(false);
    }
    expect(calendarPracticeItem(ch({ question: 'What date is the first Monday of October 2024?', month: 10, year: 2024, correctAnswer: '7' }),
      { challenges: [] })).toBeNull();
    expect(calendarPracticeItem(ch({ question: 'What day of the week is March 15?', correctAnswer: 'Saturday' }), { challenges: [] })).toBeNull();
  });

  it('mark_events: a free date in the top row, not marked already and not another item\'s date', () => {
    for (const year of [2024, 2025, 2026]) for (let month = 1; month <= 12; month++) for (let d = 8; d <= 28; d += 5) {
      const items = [4, d, d + 1].map((x, i) => ch({ id: `m${i}`, type: 'mark_events', month, year, correctAnswer: String(x),
        question: `Mark Field Trip on ${MONTHS[month - 1]} ${x}.`, eventLabel: 'Field Trip', markedDates: i ? [4] : [] }));
      const c = items[1], p = calendarPracticeItem(c, { challenges: items });
      const rowEnd = 7 - new Date(year, month - 1, 1).getDay();
      if (!p) { expect(Array.from({ length: rowEnd }, (_, i) => i + 1).every(x => x === 4)).toBe(true); continue; }
      const date = Number(p.correctAnswer);
      expect(p.type).toBe('mark_events');
      expect(date).toBeLessThanOrEqual(rowEnd);
      expect(date).not.toBe(4);
      expect(p.question).toBe(`Mark Field Trip on ${MONTHS[month - 1]} ${date}.`);
      expect(practiceLeaks(p, c, { challenges: items })).toBe(false);
    }
    expect(calendarPracticeItem(ch({ type: 'mark_events', month: 3, year: 2025, correctAnswer: '1' }), { challenges: [] })).toBeNull();
  });

  it('count: February 2026 has four of every weekday; never when the item\'s own count is 4', () => {
    for (const wd of WEEKDAYS) {
      const c = ch({ type: 'count', question: `How many ${wd}s are in March 2025?`, targetDayOfWeek: wd,
        correctAnswer: String(Array.from({ length: 31 }, (_, d) => d + 1).filter(d => dayOf(d, 3, 2025) === wd).length) });
      const p = calendarPracticeItem(c, solo(c));
      if (c.correctAnswer === '4') { expect(p).toBeNull(); continue; }
      expect(p).toMatchObject({ type: 'count', month: 2, year: 2026, targetDayOfWeek: wd, correctAnswer: '4' });
      expect(Array.from({ length: 28 }, (_, d) => d + 1).filter(d => dayOf(d, 2, 2026) === wd)).toHaveLength(4);
      expect(p!.options).toContain('4');
    }
  });

  it('day_offset: one day forward from another start, over every start and step', () => {
    for (const start of WEEKDAYS) for (const k of [1, 2, 3, 5, 7]) {
      const answer = WEEKDAYS[(WEEKDAYS.indexOf(start) + k) % 7];
      const c = ch({ type: 'day_offset', startDay: start, offsetDays: k, correctAnswer: answer, options: [...WEEKDAYS],
        question: `Start on ${start}. Count forward ${k} days. What day do you land on?` });
      const p = calendarPracticeItem(c, solo(c));
      if (k === 1) { expect(p).toBeNull(); continue; }
      expect(p).toMatchObject({ type: 'day_offset', offsetDays: 1 });
      expect(p!.correctAnswer).toBe(WEEKDAYS[(WEEKDAYS.indexOf(p!.startDay!) + 1) % 7]);
      expect([start, answer]).not.toContain(p!.startDay);
      expect([start, answer]).not.toContain(p!.correctAnswer);
    }
  });

  it('interval_count: two days apart, the same rule, away from the item\'s markers', () => {
    for (let s = 1; s <= 20; s++) for (const span of [2, 3, 5, 7]) for (const rule of ['between', 'inclusive'] as const) {
      const answer = rule === 'between' ? span - 1 : span + 1;
      const c = ch({ type: 'interval_count', month: 3, year: 2025, intervalStartDate: s, intervalEndDate: s + span, countConvention: rule,
        markedDates: [s, s + span], correctAnswer: String(answer), question: `q${s}-${span}-${rule}` });
      const p = calendarPracticeItem(c, solo(c));
      if (span <= 2) { expect(p).toBeNull(); continue; }
      expect(p).toMatchObject({ type: 'interval_count', countConvention: rule, correctAnswer: rule === 'between' ? '1' : '3' });
      expect(p!.intervalEndDate! - p!.intervalStartDate!).toBe(2);
      expect(p!.intervalEndDate! < s || p!.intervalStartDate! > s + span).toBe(true);
      expect(p!.options).toContain(p!.correctAnswer);
      expect(practiceLeaks(p!, c, solo(c))).toBe(false);
    }
  });

  it('pattern has no code-built simpler question', () => {
    const c = ch({ type: 'pattern', question: 'What is the date exactly 2 weeks after March 5, 2025?', correctAnswer: '19' });
    expect(calendarPracticeItem(c, solo(c))).toBeNull();
  });

  it('the practice id finds its parent', () => {
    const c = ch({ id: 'c4' });
    expect(calendarPracticeParent('c4~simpler', [c])).toBe(c);
    expect(calendarPracticeParent('c4', [c])).toBeNull();
  });
});

describe('this wrong answer, then this lever', () => {
  const weekdayIdentify = ch({ question: 'What day of the week is March 15, 2025?', correctAnswer: 'Saturday', options: ['Thursday', 'Friday', 'Saturday', 'Sunday'] });
  const ordinal = ch({ question: 'What date is the third Wednesday of January 2025?', month: 1, year: 2025, correctAnswer: '15' });
  const today = ch({ question: 'The ⭐ shows today. Tap tomorrow on the calendar.', correctAnswer: '13', todayDate: 12 });
  const mark = ch({ type: 'mark_events', question: 'Mark Library Day on March 11.', correctAnswer: '11', eventLabel: 'Library Day', markedDates: [] });
  const count = ch({ type: 'count', question: 'How many Fridays are in October 2025?', month: 10, correctAnswer: '5', targetDayOfWeek: 'Friday' });
  const interval = ch({ type: 'interval_count', question: 'between 4 and 9', correctAnswer: '4', intervalStartDate: 4, intervalEndDate: 9, countConvention: 'between' });
  const offset = ch({ type: 'day_offset', startDay: 'Tuesday', offsetDays: 3, correctAnswer: 'Friday', options: [...WEEKDAYS] });
  const pattern = ch({ type: 'pattern', question: 'March 3, 2025 is a Monday. What day of the week is March 17, 2025?', correctAnswer: 'Monday' });

  it.each([
    [weekdayIdentify, 'Friday', [], RING_LEVER],
    [weekdayIdentify, 'Tuesday', [RING_LEVER], null],
    [ordinal, '14', [], TINT_LEVER],
    [ordinal, '22', [TINT_LEVER], SIMPLER_LEVER],
    [today, '12', [], ARROW_LEVER],
    [mark, '4', [], ROWS_LEVER],
    [mark, '12', [ROWS_LEVER], SIMPLER_LEVER],
    [count, '4', [], TICKS_LEVER],
    [count, '6', [TICKS_LEVER], SIMPLER_LEVER],
    [interval, '5', [], TICKS_LEVER],
    [interval, '3', [TICKS_LEVER], SIMPLER_LEVER],
    [offset, 'Tuesday', [], STRIP_LEVER],
    [offset, 'Saturday', [STRIP_LEVER], SIMPLER_LEVER],
    [pattern, 'Sunday', [], RING_LEVER],
  ] as const)('%#: %s', (c, picked, pulled, want) => {
    const miss = calendarMiss(c, picked);
    expect(miss).toBeDefined();
    const levers = calendarGridLevers(c, solo(c), none, pulled as unknown as string[]);
    if (want) expect(levers.find(l => l.id === want)!.answers).toContain(miss);
    expect(nextLever(levers, miss)).toBe(want);
  });

  it('hard withdrew the header row and the tint: each comes back as a lever; K never withdraws them', () => {
    const levers = calendarGridLevers(count, solo(count), { headers: true, tint: true }, []);
    expect(levers.map(l => l.id)).toEqual([TINT_LEVER, TICKS_LEVER, HEADERS_LEVER, SIMPLER_LEVER]);
    expect(calendarGridLevers(weekdayIdentify, solo(weekdayIdentify), { headers: true, tint: false }, []).map(l => l.id))
      .toEqual([RING_LEVER, HEADERS_LEVER]);
  });

  it('easy starts with the help shown, not pulled', () => {
    const levers = calendarGridLevers(mark, { challenges: [mark], supportTier: 'easy' }, none, []);
    expect(levers.find(l => l.id === ROWS_LEVER)!.pulled).toBe(true);
    expect(levers.find(l => l.id === SIMPLER_LEVER)!.pulled).toBe(false);
  });
});

describe('the saved payloads: every checked miss has a lever on its own item', () => {
  const dir = join(__dirname, '../../../components/live-activity/runtime/testing/w1-payloads');
  const load = (f: string) => JSON.parse(readFileSync(join(dir, f), 'utf-8')).data as { challenges: CalendarExplorerChallenge[] };

  it('identify: every wrong option on every item is answered by a lever on that item', () => {
    const data = load('calendar-explorer.identify.json');
    let simplerOffered = 0;
    for (const c of data.challenges) {
      const levers = calendarGridLevers(c, data, none, []);
      if (levers.some(l => l.id === SIMPLER_LEVER)) simplerOffered++;
      const wrongs = c.options.filter(o => o !== c.correctAnswer);
      for (const w of wrongs) {
        const miss = calendarMiss(c, w)!;
        expect(levers.some(l => l.answers?.includes(miss)), `${c.id} ${w} ${miss}`).toBe(true);
      }
    }
    expect(simplerOffered).toBeGreaterThan(0);
  });

  it('day_sequence: every turn has the model pair', () => {
    const items = calendarSequenceItemsFromChallenges(load('calendar-explorer.day_sequence.json').challenges);
    for (const item of items) expect(calendarSequenceLevers(item, items, []).map(l => l.id)).toEqual([MODEL_PAIR_LEVER]);
  });
});
