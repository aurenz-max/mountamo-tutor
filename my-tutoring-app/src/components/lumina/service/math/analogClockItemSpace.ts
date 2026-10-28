/**
 * analog-clock items from the time item spaces (service/itemSpace/time.ts, skill /add-item-space).
 *
 * Before (10-13 probe, grade 2, "nearest five minutes"): the tiers changed only the reading aids, and the
 * times did not move with them. read and match opened 3:15, 7:30, 10:45 in most runs at every tier; hard
 * elapsed gave 15- to 45-minute spans from an o'clock start, easier than easy (which crossed hours).
 * With a tier, code picks the times: read, match and set_time from clock-time, elapsed from elapsed-time,
 * and writes every instruction, hint and option. The tier still sets the reading aids as before.
 *
 * Which items the clock can draw (contract, item-space clause): times on the lesson's minute grid
 * (hours and half hours, quarter hours, five minutes, one minute); set_time on a grid of five or coarser,
 * because the hands snap to five minutes at the finest. An elapsed interval has its start, duration and
 * end on the grid, at most two hours on a quarter-hour grid. The dial and the digital readout show the
 * start, so the instruction names the end time; code checks it does.
 */
import type { ClockChallenge } from '../../primitives/visual-primitives/math/AnalogClock';
import {
  clockDistractors, clockText, durationText, elapsedDistractors, elapsedEnd, elapsedOnGrid, onGrid,
  type ClockTimeItem, type ElapsedItem,
} from '../itemSpace/time';

type Pick<I> = (n: number, lo: number, hi: number, rand?: () => number, accept?: (item: I) => boolean) => I[];
export type ClockSpaceMode = 'read' | 'set_time' | 'match' | 'elapsed';

/**
 * The minute grid a lesson reads to: what the objective says ("nearest five minutes", "quarter hour",
 * "half hour", "nearest minute"), else the grade's standard (1.MD.3 hours and half hours, 2.MD.7 five
 * minutes, 3.MD.1 the minute).
 */
export function clockGrid(grade: string | undefined, text: string): 1 | 5 | 15 | 30 {
  const t = text.toLowerCase();
  if (/nearest minute|to the minute|one minute|1 minute/.test(t)) return 1;
  if (/five minute|5 minute|5-minute|five-minute/.test(t)) return 5;
  if (/quarter/.test(t)) return 15;
  if (/half[- ]hour|half past|hour and half/.test(t)) return 30;
  const g = grade?.trim().toUpperCase();
  return g === 'K' || g === '1' ? 30 : g === '2' ? 5 : 1;
}

/** The grade band whose snap fits a grid: the hands snap to 30 (K), 15 (1-2) or 5 (3-5) minutes. */
export const bandForGrid = (grid: number, grade?: string): 'K' | '1-2' | '3-5' =>
  grid >= 30 && grade?.toUpperCase() === 'K' ? 'K' : grid >= 15 ? '1-2' : '3-5';

const SNAP: Record<string, number> = { K: 30, '1-2': 15, '3-5': 5 };
/** A band whose hands can reach every set_time target (a 2:25 on a 15-minute snap cannot be set). */
export function bandFittingTargets(band: 'K' | '1-2' | '3-5', challenges: { type: string; targetMinute: number }[]): 'K' | '1-2' | '3-5' {
  const minutes = challenges.filter((c) => c.type === 'set_time' || c.type === 'set_time_ampm').map((c) => c.targetMinute);
  if (minutes.every((m) => m % SNAP[band] === 0)) return band;
  return minutes.every((m) => m % 15 === 0) && band === 'K' ? '1-2' : '3-5';
}

const shuffle = <T>(xs: T[], rand: () => number): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

const ASK: Record<'read' | 'match', string[]> = {
  read: ['What time does the clock show?', 'Read the clock. What time is it?', 'Look at both hands. What time is it?'],
  match: ['Which digital time matches the clock?', 'Find the digital clock that shows the same time.', 'Pick the time that matches the clock face.'],
};

const timeHint = (it: ClockTimeItem): string => it.m === 0
  ? 'Look at the short hand first. Where is the long hand pointing?'
  : it.m >= 40
    ? 'The short hand is close to the next number. Which number has it passed? Then count the minutes by fives.'
    : 'Which number has the short hand passed? Then count by fives to the long hand.';

/** Five times for read, match or set_time at the tier's band, or empty (the caller keeps its own path). */
export function clockChallenges(opts: {
  pick: Pick<ClockTimeItem>; band: [number, number]; count: number; grid: number; mode: 'read' | 'set_time' | 'match';
  rand?: () => number;
}): ClockChallenge[] {
  const rand = opts.rand ?? Math.random;
  // set_time: the hands snap to five minutes at the finest.
  const grid = opts.mode === 'set_time' ? Math.max(5, opts.grid) : opts.grid;
  const items = opts.pick(opts.count, opts.band[0], opts.band[1], rand, onGrid(grid));
  if (items.length < opts.count) return [];
  return items.map((it, i) => {
    const base = {
      id: `c${i + 1}`, type: opts.mode, targetHour: it.h, targetMinute: it.m, hint: timeHint(it),
      itemSpace: { space: 'clock-time', structure: it.structure, beta: it.beta },
    } as const;
    if (opts.mode === 'set_time') return { ...base, instruction: `Set the clock to ${clockText(it.h, it.m)}.` };
    const answer = clockText(it.h, it.m);
    const options = shuffle([answer, ...clockDistractors(it, rand, grid).map((d) => d.value)], rand);
    return {
      ...base, instruction: ASK[opts.mode][i % ASK[opts.mode].length],
      option0: options[0], option1: options[1], option2: options[2], option3: options[3],
      correctOptionIndex: options.indexOf(answer),
    };
  });
}

/** The instruction names the end time and never the duration. */
export const elapsedTextFits = (text: string, it: ElapsedItem): boolean => {
  const end = elapsedEnd(it);
  return text.includes(clockText(end.h, end.m)) && !text.includes(durationText(it.d))
    && !new RegExp(`\\b${it.d}\\s*min`).test(text) && text.trim().endsWith('?');
};

const FALLBACK_ACTIVITIES = ['Recess', 'Art class', 'Soccer practice', 'The movie', 'Story time', 'The bake sale'];

/**
 * Five elapsed intervals at the tier's band, or empty. `activities` are short names the wording call
 * wrote for the lesson ("Soccer practice"); code writes the sentence around them, so the end time is
 * always in it and the duration never is.
 */
export function elapsedChallenges(opts: {
  pick: Pick<ElapsedItem>; band: [number, number]; count: number; grid: number; activities?: string[]; rand?: () => number;
}): ClockChallenge[] {
  const rand = opts.rand ?? Math.random;
  const grid = Math.max(5, opts.grid);
  const items = opts.pick(opts.count, opts.band[0], opts.band[1], rand, elapsedOnGrid(grid, grid >= 15 ? 120 : 180));
  if (items.length < opts.count) return [];
  const names = [...(opts.activities ?? []), ...FALLBACK_ACTIVITIES.filter((a) => !opts.activities?.includes(a))];
  return items.map((it, i) => {
    const end = elapsedEnd(it);
    const answer = durationText(it.d);
    const options = shuffle([answer, ...elapsedDistractors(it, rand).map((d) => durationText(d.value))], rand);
    let instruction = `${names[i]} starts at the time on the clock and ends at ${clockText(end.h, end.m)}. How much time passes?`;
    if (!elapsedTextFits(instruction, it)) instruction = `It starts at the time on the clock and ends at ${clockText(end.h, end.m)}. How much time passes?`;
    return {
      id: `c${i + 1}`, type: 'elapsed', instruction,
      startHour: it.sh, startMinute: it.sm, targetHour: end.h, targetMinute: end.m,
      hint: it.features.crossHour
        ? 'Count the minutes up to the next hour first, then on to the end time.'
        : 'Count on from the start time to the end time: hours first, then minutes.',
      option0: options[0], option1: options[1], option2: options[2], option3: options[3],
      correctOptionIndex: options.indexOf(answer),
      itemSpace: { space: 'elapsed-time', structure: it.structure, beta: it.beta },
    };
  });
}
