/**
 * Item spaces for time: reading a clock (1.MD.3, 2.MD.7, 3.MD.1) and elapsed time (3.MD.1, 4.MD.2).
 *
 * clock-time — the task is one reading: the time an analog clock shows. Its items are the 720 times on
 * a 12-hour dial. A lesson's scope is the minute grid it reads to (hours and half hours, quarter hours,
 * five minutes, one minute); the consumer passes that grid as `accept`. What makes a time harder to read:
 *   - the minute hand off twelve: half past, then quarter past and to, then a five-minute mark, then a
 *     minute between the marks (the order children learn them in, and the order their errors fall in:
 *     Friedman & Laycock 1989, Burny, Valcke & Desoete 2009);
 *   - late: from :40 the short hand sits near the NEXT number, and children read that number as the hour
 *     (2:50 read as 3:50), the most common reading error in both studies;
 *   - twelve: the hour hand near the top, between 12 and 1 (12:45 read as 1:45, or as 0).
 * Which hour it is (3:20 vs 8:20) is incidental. A clock reading needs a picture of the clock, so this
 * space is offered only to consumers that draw one (`needsPicture`).
 *
 * elapsed-time — how much time passes from a start time to an end time, durations up to three hours,
 * on a five-minute grid. What makes it harder:
 *   - crossHour: the interval passes an hour mark from a start that is not on the hour (3:50 to 4:10).
 *     Subtracting the clock times as whole numbers (410 − 350 = 60) is the "100 minutes in an hour"
 *     error, the strand's signature mistake (Earnest 2015; Kamii & Russell 2012);
 *   - overHour and mixed: a duration of an hour or more, then one of hours and minutes;
 *   - startOff: the start is not on the hour;
 *   - fiveGrain: the start or the duration is off the quarter-hour grid (count by fives);
 *   - past12: the interval passes twelve o'clock (12 then 1, not 13).
 *
 * Betas are logits for a typical learner at the strand's grade who was taught it (grade 2 for a clock
 * reading to five minutes, grade 3 for elapsed time). The weights are priors set from the error orders
 * above, not fitted; refit them from attempts' `first_try` when the data exists.
 */
import type { ItemSpace } from './types';
import { linearBeta, pickSpread } from './spread';

// ── clock-time ────────────────────────────────────────────────────────────────────────────────────

export interface ClockFeatures { half: number; quarter: number; five: number; oneMin: number; late: number; twelve: number }
export interface ClockTimeItem { h: number; m: number; features: ClockFeatures; beta: number; structure: string }

export const CLOCK_WEIGHTS: Record<keyof ClockFeatures | 'base', number> = {
  base: -1.8, half: 0.8, quarter: 1.3, five: 1.8, oneMin: 2.6, late: 0.6, twelve: 0.2,
};

/** "H:MM", the hour 1-12. */
export const clockText = (h: number, m: number): string => `${((h - 1 + 12) % 12) + 1}:${String(m).padStart(2, '0')}`;
const shift = (h: number, d: number) => ((h - 1 + d) % 12 + 12) % 12 + 1;

export function clockFeatures(h: number, m: number): ClockFeatures {
  const half = m === 30 ? 1 : 0;
  const quarter = m === 15 || m === 45 ? 1 : 0;
  const five = m % 5 === 0 && !half && !quarter && m !== 0 ? 1 : 0;
  return {
    half, quarter, five, oneMin: m % 5 !== 0 ? 1 : 0, late: m >= 40 ? 1 : 0,
    twelve: (h === 12 && m > 0) || (h === 11 && m >= 40) ? 1 : 0,
  };
}

const minuteClass = (m: number): string => (m === 0 ? 'hour' : m === 30 ? 'half' : m === 15 ? 'quarter-past'
  : m === 45 ? 'quarter-to' : m % 5 === 0 ? (m < 40 ? 'five' : 'five-late') : (m < 40 ? 'minute' : 'minute-late'));

let clockCache: ClockTimeItem[] | null = null;
export const clockItems = (): ClockTimeItem[] => (clockCache ??= Array.from({ length: 12 * 60 }, (_, i) => {
  const h = Math.floor(i / 60) + 1;
  const m = i % 60;
  const features = clockFeatures(h, m);
  return { h, m, features, beta: linearBeta(features, CLOCK_WEIGHTS), structure: `${minuteClass(m)}${features.twelve ? '|twelve' : ''}` };
}));

/** The minute grid a lesson reads to: 30 (hours and half hours), 15, 5 or 1. */
export const onGrid = (grid: number) => (it: { m: number }) => it.m % grid === 0;

/**
 * Three wrong times. Near: the hour read from the number the short hand is nearest (2:50 read as 3:50;
 * 2:10 read as 1:10), the hands swapped (7:30 read as 6:35), the minute read as the number the long hand
 * points at (2:20 read as 2:04), quarter past and quarter to confused. Far: three or six hours off.
 * `grid` keeps every option on the lesson's minute grid when given (a 2:04 among quarter hours is never
 * tempting).
 */
export function clockDistractors(
  it: ClockTimeItem, rand: () => number = Math.random, grid = 1,
): { value: string; distance: 'near' | 'far' }[] {
  const answer = clockText(it.h, it.m);
  const on = (m: number) => m % grid === 0;
  const near: string[] = [];
  if (it.m >= 30) near.push(clockText(shift(it.h, 1), it.m));
  else if (it.m > 0) near.push(clockText(shift(it.h, -1), it.m));
  if (it.m % 5 === 0) {
    const swapH = it.m === 0 ? 12 : it.m / 5;
    const swapM = (it.h % 12) * 5;
    if (on(swapM) && clockText(swapH, swapM) !== answer) near.push(clockText(swapH, swapM));
    if (it.m > 0 && on(it.m / 5)) near.push(clockText(it.h, it.m / 5));
  }
  if (it.m === 15 || it.m === 45) near.push(clockText(it.h, 60 - it.m));
  const nearPicked = Array.from(new Set(near.filter((v) => v !== answer)))
    .sort(() => rand() - 0.5).slice(0, it.beta < -0.6 ? 1 : 2);
  const out = nearPicked.map((value): { value: string; distance: 'near' | 'far' } => ({ value, distance: 'near' }));
  for (const d of [3, -3, 6, 4, -4, 5]) {
    if (out.length === 3) break;
    const v = clockText(shift(it.h, d), it.m);
    if (v !== answer && !out.some((o) => o.value === v)) out.push({ value: v, distance: 'far' });
  }
  return out;
}

export const CLOCK_TIME: ItemSpace<ClockTimeItem> = {
  id: 'clock-time',
  describe: 'tell time: read the time an analog clock shows, or set a clock to a time (hours, half hours, quarter hours, five minutes, the minute)',
  grades: ['1', '2', '3'],
  criterion: 'Tell and write time from an analog clock',
  wordingGrade: 'grade 2',
  needsPicture: true,
  pick: (n, lo, hi, rand, accept) => pickSpread(clockItems(), n, lo, hi, rand, accept, (it) => `${it.h}:${it.m}`, (it) => String(it.h)),
  items: clockItems,
  solve: (it) => ({ answer: clockText(it.h, it.m), shown: [], spec: `the clock shows ${clockText(it.h, it.m)}; the learner reads it` }),
  distractors: (it, rand) => clockDistractors(it, rand),
  plainQuestion: () => 'What time does the clock show?',
};

// ── elapsed-time ──────────────────────────────────────────────────────────────────────────────────

export interface ElapsedFeatures { crossHour: number; overHour: number; mixed: number; startOff: number; fiveGrain: number; past12: number }
export interface ElapsedItem {
  sh: number; sm: number; d: number; features: ElapsedFeatures; beta: number; structure: string;
}

export const ELAPSED_WEIGHTS: Record<keyof ElapsedFeatures | 'base', number> = {
  base: -1.6, crossHour: 1.1, overHour: 0.5, mixed: 0.6, startOff: 0.4, fiveGrain: 0.5, past12: 0.3,
};

/** The end time of an item, hour 1-12. */
export const elapsedEnd = (it: { sh: number; sm: number; d: number }): { h: number; m: number } => {
  const total = (it.sh % 12) * 60 + it.sm + it.d;
  return { h: ((Math.floor(total / 60) % 12) || 12), m: total % 60 };
};

/** "20 minutes", "1 hour", "1 hour 25 minutes". */
export function durationText(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const hs = `${h} hour${h > 1 ? 's' : ''}`;
  const ms = `${m} minute${m > 1 ? 's' : ''}`;
  return h && m ? `${hs} ${ms}` : h ? hs : ms;
}

/** Minutes in a duration text, or NaN. */
export function durationMinutes(text: string): number {
  const h = text.match(/(\d+)\s*hours?/);
  const m = text.match(/(\d+)\s*minutes?/);
  return h || m ? Number(h?.[1] ?? 0) * 60 + Number(m?.[1] ?? 0) : NaN;
}

export function elapsedFeatures(sh: number, sm: number, d: number): ElapsedFeatures {
  return {
    // Passes an hour mark partway through the minutes (3:50 to 4:10), not landing on it (3:40 to 4:00).
    crossHour: sm > 0 && sm + (d % 60) > 60 ? 1 : 0,
    overHour: d >= 60 ? 1 : 0,
    mixed: d > 60 && d % 60 !== 0 ? 1 : 0,
    startOff: sm > 0 ? 1 : 0,
    fiveGrain: sm % 15 !== 0 || d % 15 !== 0 ? 1 : 0,
    // Passes one o'clock coming from twelve: 12:40 to 1:10 (the hour after 12 is 1, not 13).
    past12: sh * 60 + sm + d >= 780 ? 1 : 0,
  };
}

let elapsedCache: ElapsedItem[] | null = null;
export const elapsedItems = (): ElapsedItem[] => (elapsedCache ??= (() => {
  const out: ElapsedItem[] = [];
  for (let sh = 1; sh <= 12; sh++) {
    for (let sm = 0; sm < 60; sm += 5) {
      for (let d = 10; d <= 180; d += 5) {
        const features = elapsedFeatures(sh, sm, d);
        const structure = `${features.crossHour ? 'cross' : 'within'}|${d >= 60 ? (features.mixed ? 'h+m' : 'hours') : 'minutes'}`
          + `|${features.startOff ? 'off' : 'on'}|${features.fiveGrain ? 'fives' : 'quarters'}${features.past12 ? '|past12' : ''}`;
        out.push({ sh, sm, d, features, beta: linearBeta(features, ELAPSED_WEIGHTS), structure });
      }
    }
  }
  return out;
})());

/** An interval on a lesson's grid that the 12-hour dial can show: start, duration, end all on it, at most `maxMinutes`. */
export const elapsedOnGrid = (grid: number, maxMinutes = 180) => (it: ElapsedItem) =>
  it.sm % grid === 0 && it.d % grid === 0 && it.d <= maxMinutes;

/**
 * Three wrong durations, in minutes. Near: the clock times subtracted as whole numbers (3:50 to 4:10:
 * 410 − 350 = 60), the minutes subtracted with the hour ignored (50 − 10 = 40), the hours counted with
 * the minutes dropped, a tick of five or a quarter miscounted. Far: an hour or two off.
 */
export function elapsedDistractors(it: ElapsedItem, rand: () => number = Math.random): { value: number; distance: 'near' | 'far' }[] {
  const end = elapsedEnd(it);
  const ok = (v: number) => v > 0 && v <= 240 && v !== it.d;
  const e = (end.h < it.sh ? end.h + 12 : end.h) * 100 + end.m;
  const s = it.sh * 100 + it.sm;
  const whole = e - s;
  // The whole-number subtraction leads when it is wrong: it is the strand's signature mistake.
  const lead = whole > 0 ? [Math.floor(whole / 100) * 60 + (whole % 100)] : [];
  const others: number[] = [];
  if (end.h !== it.sh) others.push(Math.abs(end.m - it.sm));
  if (it.features.mixed) others.push(Math.floor(it.d / 60) * 60);
  others.push(it.d + (it.features.fiveGrain ? 5 : 15));
  const picked = Array.from(new Set([...lead, ...others.sort(() => rand() - 0.5)].filter(ok)))
    .slice(0, it.beta < -0.6 ? 1 : 2).map((value): { value: number; distance: 'near' | 'far' } => ({ value, distance: 'near' }));
  for (const v of [it.d + 60, it.d - 60 >= 10 ? it.d - 60 : it.d + 120, it.d + 120, it.d + 30]) {
    if (picked.length === 3) break;
    if (ok(v) && !picked.some((p) => p.value === v)) picked.push({ value: v, distance: 'far' });
  }
  return picked;
}

export const ELAPSED_TIME: ItemSpace<ElapsedItem> = {
  id: 'elapsed-time',
  describe: 'elapsed time: find how much time passes from a start time to an end time (minutes and hours, on a clock)',
  grades: ['2', '3', '4'],
  criterion: 'Find elapsed time from a start time to an end time',
  wordingGrade: 'grade 3',
  pick: (n, lo, hi, rand, accept) => pickSpread(elapsedItems(), n, lo, hi, rand, accept, (it) => `${it.sh}:${it.sm}+${it.d}`, (it) => String(it.d)),
  items: elapsedItems,
  solve: (it) => {
    const end = elapsedEnd(it);
    const start = clockText(it.sh, it.sm);
    const stop = clockText(end.h, end.m);
    return {
      answer: durationText(it.d),
      shown: [start, stop],
      spec: `something starts at ${start} and ends at ${stop}; the learner finds how much time passes (${durationText(it.d)})`,
    };
  },
  distractors: (it, rand) => elapsedDistractors(it, rand).map((d) => ({ value: durationText(d.value), distance: d.distance })),
  plainQuestion: (it) => {
    const end = elapsedEnd(it);
    return `A game starts at ${clockText(it.sh, it.sm)} and ends at ${clockText(end.h, end.m)}. How much time passes?`;
  },
};
