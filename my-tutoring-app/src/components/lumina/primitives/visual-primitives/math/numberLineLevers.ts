/**
 * The in-item levers on a number line (`/add-support-tiers`: jump, handoff 18; plot, identify, order and between,
 * 2026-10-08; build_hops, numberLineBuildHops.ts), declared once as a lever set (`NUMBER_LINE_LEVERS`, below).
 *
 * Pure: the component draws from these, the lever set publishes them, and the tests hold each leak rule. From the
 * jump failure inventory (qa/eval-reports/number-line-levers-2026-09-27.md):
 * - `numbered_hops` (marks): the learner's own jump is drawn as numbered unit hops, and hop 1 from
 *   the start is drawn as a model. Answers "counts the start as hop 1" and "loses count".
 *   Leak rule: a hop the learner did not place never reaches or passes the landing.
 * - `simpler_jump` (easier): an easier practice jump first — one jump instead of two, or a
 *   shorter jump — built here from the current item. Leak rule: never the learner's own start,
 *   and neither its start nor its landing is a landing of the full item.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { NUMBER_LINE_MISSES_BY_MODE, type NumberLineMode } from './numberLine.card';
import { hopsTaskOf, simplerHops, waysModel } from './numberLineBuildHops';
import type { NumberLineChallenge, NumberLineData, NumberLineOperation } from './NumberLine';

export const HOPS_LEVER = 'numbered_hops';
export const SIMPLER_LEVER = 'simpler_jump';
/** Beyond this many unit hops the labels no longer read as a count. */
const MAX_HOPS = 30;

export interface Hop { from: number; to: number; label: string }

const landingOf = (op: Pick<NumberLineOperation, 'type' | 'startValue' | 'changeValue'>) =>
  op.type === 'add' ? op.startValue + op.changeValue : op.startValue - op.changeValue;
const integral = (...values: number[]) => values.every(v => Number.isInteger(v));

/** The one hop drawn as a model: hop 1 from the start, only when it cannot be the landing. */
export function modelHop(op: NumberLineOperation): Hop | null {
  if (!integral(op.startValue, op.changeValue) || op.changeValue < 2) return null;
  const to = op.startValue + (op.type === 'add' ? 1 : -1);
  return { from: op.startValue, to, label: '1' };
}

/** The learner's own jump from `from` to where they placed it, as numbered unit hops. */
export function learnerHops(from: number, to: number): Hop[] {
  if (!integral(from, to) || from === to || Math.abs(to - from) > MAX_HOPS) return [];
  const step = to > from ? 1 : -1;
  return Array.from({ length: Math.abs(to - from) }, (_, i) =>
    ({ from: from + i * step, to: from + (i + 1) * step, label: String(i + 1) }));
}

/** Leak rule for hops the learner did not place: true when any reaches or passes the landing. */
export function hopsLeak(op: NumberLineOperation, drawn: readonly Hop[]): boolean {
  const landing = landingOf(op), dir = Math.sign(landing - op.startValue);
  return drawn.some(h => dir === 0 || (h.to - landing) * dir >= 0 || (h.from - landing) * dir >= 0);
}

/**
 * The easier practice jump for `ch`, or null when there is none: two jumps become the first jump's
 * shape alone; one jump becomes a shorter one. Same mode and direction, in the displayed range, and
 * its answer computed here. The start moves to the nearest value that keeps every rule.
 */
export function simplerJump(ch: NumberLineChallenge, range: { min: number; max: number }): NumberLineChallenge | null {
  const ops = ch.operations ?? [];
  if (ch.type !== 'show_jump' || !ops.length) return null;
  const first = ops[0];
  if (!integral(first.startValue, first.changeValue, ...ops.map(o => o.changeValue))) return null;
  const change = ops.length > 1 ? first.changeValue : first.changeValue >= 2 ? Math.ceil(first.changeValue / 2) : 0;
  if (change < 1) return null;
  const answers = new Set(ops.map(landingOf));
  const sign = first.type === 'add' ? 1 : -1;
  for (let d = 1; d <= range.max - range.min; d++) {
    for (const start of [first.startValue + d, first.startValue - d]) {
      const landing = start + sign * change;
      if (start < range.min || start > range.max || landing < range.min || landing > range.max) continue;
      if (answers.has(start) || answers.has(landing)) continue;
      const dir = sign > 0 ? 'forward' : 'back';
      return {
        id: `${ch.id}~simpler`, type: 'show_jump',
        instruction: `Start at ${start}. Jump ${dir} ${change}.`,
        hint: `Count each hop as you make it: ${change} hop${change === 1 ? '' : 's'} ${dir}.`,
        startValue: start, targetValues: [landing],
        operations: [{ type: first.type, startValue: start, changeValue: change, showJumpArc: false }],
      };
    }
  }
  return null;
}

/**
 * `which_way` (help, 2026-10-09): a jump of 1 has no model hop (hop 1 IS the landing), so nothing showed which way
 * the jump goes. The arrow sits at the item's first start (which the instruction names) and is shorter than one hop.
 * Leak rule: the arrow starts at the first start and its tip stays under half a unit away, so it reaches no number.
 */
export const WAY_LEVER = 'which_way';
const WAY_LENGTH = 0.4;
export interface WayArrow { from: number; to: number; dir: 'left' | 'right' }

export function wayArrow(op: NumberLineOperation | undefined): WayArrow | null {
  if (!op || !integral(op.startValue, op.changeValue) || op.changeValue !== 1) return null;
  const sign = op.type === 'add' ? 1 : -1;
  return { from: op.startValue, to: op.startValue + sign * WAY_LENGTH, dir: sign > 0 ? 'right' : 'left' };
}

export const wayArrowLeak = (op: NumberLineOperation, arrow: WayArrow) =>
  arrow.from !== op.startValue || Math.abs(arrow.to - arrow.from) >= 0.5;

/**
 * What a wrong jump shows, as the observable pattern of the placed landings (`TeachingAttempt.miss`):
 * - `one_short` / `one_past`: one hop before or beyond the landing (counting the start as hop 1 lands one short;
 *   the cause is the tutor's and the distiller's to judge, not this check's);
 * - `off_by_more`: two or more hops off, the right way;
 * - `wrong_direction`: placed on the other side of the start, or on the start itself;
 * - `second_jump_off`: every landing before it was right (lost track across chained jumps);
 * - `no_landing`: a landing was never placed.
 * Undefined for a right jump or a non-jump item.
 */
export type JumpMiss = 'one_short' | 'one_past' | 'off_by_more' | 'wrong_direction' | 'second_jump_off' | 'no_landing';

export function jumpMiss(ch: NumberLineChallenge | null, placed: readonly number[]): JumpMiss | undefined {
  const ops = ch?.operations ?? [];
  if (!ch || ch.type !== 'show_jump' || !ops.length) return undefined;
  const at = ops.findIndex((op, i) => placed[i] === undefined || Math.round(placed[i]) !== landingOf(op));
  if (at < 0) return undefined;
  if (placed[at] === undefined) return 'no_landing';
  if (at > 0) return 'second_jump_off';
  const op = ops[at], landing = landingOf(op), dir = Math.sign(landing - op.startValue);
  const moved = Math.round(placed[at]) - op.startValue;
  if (moved === 0 || Math.sign(moved) !== dir) return 'wrong_direction';
  const past = (Math.round(placed[at]) - landing) * dir;
  return past === -1 ? 'one_short' : past === 1 ? 'one_past' : 'off_by_more';
}

// ============================================================================
// Plot, identify, order and between (`/add-support-tiers`, 2026-10-08; report
// qa/eval-reports/number-line-levers-2026-10-08.md). No real-learner evidence: the misses are what the
// line's own Check sees. Integer lines only; a fraction or decimal line declares no lever.
// ============================================================================

export const COUNT_LEVER = 'count_hops';
export const NEARER_LEVER = 'nearer_number';
export const ARROW_LEVER = 'bigger_arrow';
export const FEWER_LEVER = 'fewer_numbers';
export const ENDS_LEVER = 'end_marks';
export const WIDER_LEVER = 'wider_gap';
/** A simplify lever's practice item is `<item>~simpler`, on every mode. */
export const PRACTICE_SUFFIX = '~simpler';

/**
 * What a wrong placed point shows, measured on the snap grid from the target's nearest grid point:
 * `one_short` (one grid step left), `one_past` (one step right), `off_by_more`.
 */
export type PlotMiss = 'one_short' | 'one_past' | 'off_by_more';
/** A wrong order: exactly largest-to-smallest (`reversed`), or any other wrong order (`out_of_order`). */
export type OrderLineMiss = 'reversed' | 'out_of_order';
/**
 * A wrong between point: on one of the two given numbers (`on_end`), left of both or right of both (`outside`),
 * or, on an exact missing-number item, inside but not the missing number (`wrong_inside`; only a fraction or
 * decimal grid has room for it).
 */
export type BetweenMiss = 'on_end' | 'outside' | 'wrong_inside';
export type LineMiss = JumpMiss | PlotMiss | OrderLineMiss | BetweenMiss;

export interface LineWork {
  points: readonly number[]; endpoints: readonly number[]; ordered: ReadonlyMap<number, number>;
  /** The snap step of the line's number type. */
  grid: number;
}

export function plotMiss(ch: NumberLineChallenge, points: readonly number[], grid: number): PlotMiss | undefined {
  if (ch.type !== 'plot_point' || ch.targetValues.length !== 1 || !points.length) return undefined;
  const target = Math.round(ch.targetValues[0] / grid) * grid;
  const steps = Math.round((points[points.length - 1] - target) / grid);
  return steps === 0 ? undefined : steps === -1 ? 'one_short' : steps === 1 ? 'one_past' : 'off_by_more';
}

export function orderMiss(ch: NumberLineChallenge, ordered: ReadonlyMap<number, number>): OrderLineMiss | undefined {
  if (ch.type !== 'order_values' || ordered.size < ch.targetValues.length) return undefined;
  const sorted = [...ch.targetValues].sort((a, b) => a - b);
  const placed = Array.from(ordered.entries()).sort((a, b) => a[1] - b[1]).map(e => e[0]);
  if (placed.every((v, i) => v === sorted[i])) return undefined;
  return placed.every((v, i) => v === sorted[sorted.length - 1 - i]) ? 'reversed' : 'out_of_order';
}

export function betweenMiss(ch: NumberLineChallenge, points: readonly number[]): BetweenMiss | undefined {
  if (ch.type !== 'find_between' || ch.targetValues.length < 2 || !points.length) return undefined;
  const p = points[points.length - 1], lo = Math.min(...ch.targetValues), hi = Math.max(...ch.targetValues);
  if (Math.abs(p - lo) < 1e-6 || Math.abs(p - hi) < 1e-6) return 'on_end';
  if (p < lo || p > hi) return 'outside';
  const exact = ch.exactTargetValue;
  return typeof exact === 'number' && Math.abs(p - exact) > 1e-3 ? 'wrong_inside' : undefined;
}

/** The miss a wrong Check shows, for any item. Undefined for a right answer. */
export function lineMiss(ch: NumberLineChallenge | null, work: LineWork): LineMiss | undefined {
  if (!ch) return undefined;
  if (ch.type === 'show_jump') return jumpMiss(ch, work.endpoints);
  if (ch.type === 'plot_point') return plotMiss(ch, work.points, work.grid);
  if (ch.type === 'order_values') return orderMiss(ch, work.ordered);
  return ch.type === 'find_between' ? betweenMiss(ch, work.points) : undefined;
}

/** The one value a placed-point item asks for: a plot target, or an exact missing number. */
export function countTarget(ch: NumberLineChallenge | null): number | null {
  if (ch?.type === 'plot_point' && ch.targetValues.length === 1) return ch.targetValues[0];
  if (ch?.type === 'find_between' && typeof ch.exactTargetValue === 'number') return ch.exactTargetValue;
  return null;
}

/**
 * Where counting starts, from the labels the line shows: on a line with every tick labelled, its first label
 * (counting from the start of the line); otherwise the nearest label at least two below the target, so the
 * model hop from it never reaches the target. Null when no such label is in view or the line is not integers.
 */
export function countStart(target: number, labels: readonly number[]): number | null {
  if (!Number.isInteger(target) || !labels.length || !labels.every(v => Number.isInteger(v))) return null;
  const everyTick = labels.length > 1 && labels.every((v, i) => i === 0 || v - labels[i - 1] === 1);
  if (everyTick) return labels[0] < target ? labels[0] : null;
  const below = labels.filter(v => v <= target - 2);
  return below.length ? Math.max(...below) : null;
}

const countOp = (start: number, target: number): NumberLineOperation =>
  ({ type: 'add', startValue: start, changeValue: target - start, showJumpArc: false });

/** Hop 1 from the count start, drawn as a model only when it cannot reach the target. */
export function countModelHop(start: number, target: number): Hop | null {
  return target - start >= 2 ? { from: start, to: start + 1, label: '1' } : null;
}

/** Leak rule for count hops the learner did not place: true when any reaches or passes the target. */
export const countHopsLeak = (start: number, target: number, drawn: readonly Hop[]) => hopsLeak(countOp(start, target), drawn);

/** The two given numbers a between item's rings mark; none on an exact item, where they would isolate the answer. */
export function endMarks(ch: NumberLineChallenge | null): [number, number] | null {
  if (ch?.type !== 'find_between' || ch.targetValues.length < 2 || typeof ch.exactTargetValue === 'number') return null;
  return [Math.min(...ch.targetValues), Math.max(...ch.targetValues)];
}

/** Leak rule for end marks: a mark strictly between the two numbers is an answer; an exact item gets no marks. */
export function endMarksLeak(ch: NumberLineChallenge, marks: readonly number[]): boolean {
  if (typeof ch.exactTargetValue === 'number') return marks.length > 0;
  const lo = Math.min(...ch.targetValues), hi = Math.max(...ch.targetValues);
  return marks.some(m => m > lo && m < hi);
}

export interface SettledLine { window: { min: number; max: number }; labels: readonly number[] }

/** Easier plot: a target half as far from the count start; same line, never the item's own target. */
export function simplerPlot(ch: NumberLineChallenge, view: SettledLine): NumberLineChallenge | null {
  if (ch.type !== 'plot_point') return null;
  const target = countTarget(ch), start = target === null ? null : countStart(target, view.labels);
  if (target === null || start === null || target - start < 2) return null;
  const value = start + Math.ceil((target - start) / 2);
  return { id: `${ch.id}${PRACTICE_SUFFIX}`, type: 'plot_point', instruction: `Place a point at ${value} on the number line.`,
    hint: 'Find a number you can read on the line, then count the spaces one at a time.', targetValues: [value] };
}

/**
 * Easier order: one number fewer, spread across the window, none of them from the item. Listed out of order
 * (a sorted list would state the answer).
 */
export function fewerNumbers(ch: NumberLineChallenge, view: SettledLine, range: { min: number; max: number }): NumberLineChallenge | null {
  const set = ch.targetValues;
  if (ch.type !== 'order_values' || set.length < 3 || !set.every(v => Number.isInteger(v))) return null;
  const k = set.length - 1;
  const lo = Math.ceil(Math.max(view.window.min, range.min)), hi = Math.floor(Math.min(view.window.max, range.max));
  const taken = new Set(set), chosen: number[] = [];
  for (let i = 0; i < k; i++) {
    const ideal = Math.round(lo + ((i + 1) * (hi - lo)) / (k + 1));
    let pick: number | null = null;
    for (let d = 0; d <= hi - lo && pick === null; d++) {
      for (const v of [ideal + d, ideal - d]) if (v >= lo && v <= hi && !taken.has(v)) { pick = v; break; }
    }
    if (pick === null) return null;
    taken.add(pick); chosen.push(pick);
  }
  const sorted = [...chosen].sort((a, b) => a - b);
  const listed = [...sorted.slice(1), sorted[0]];
  return { id: `${ch.id}${PRACTICE_SUFFIX}`, type: 'order_values',
    instruction: `Put ${listed.join(', ')} in order on the line, from smallest to largest.`,
    hint: 'Find each number on the line first.', targetValues: listed };
}

/** Easier between: two numbers two farther apart, in view; only for a pair with at most three numbers between. */
export function widerGap(ch: NumberLineChallenge, view: SettledLine, range: { min: number; max: number }): NumberLineChallenge | null {
  const ends = endMarks(ch);
  if (!ends || !ends.every(v => Number.isInteger(v)) || ends[1] - ends[0] > 4) return null;
  const lo = Math.ceil(Math.max(view.window.min, range.min)), hi = Math.floor(Math.min(view.window.max, range.max));
  const gap = ends[1] - ends[0] + 2;
  if (gap > hi - lo) return null;
  const a = Math.max(lo, Math.min(ends[0] - 1, hi - gap)), b = a + gap;
  return { id: `${ch.id}${PRACTICE_SUFFIX}`, type: 'find_between', instruction: `Find a number between ${a} and ${b}. Place a point there.`,
    hint: 'Find both numbers on the line first.', targetValues: [a, b] };
}

/** The easier practice item a simplify lever opens on `parent`; the journey row rebuilds it with this too. */
export function simplerItem(parent: NumberLineChallenge, data: Pick<NumberLineData, 'range'>, view: SettledLine): NumberLineChallenge | null {
  const range = { min: data.range?.min ?? 0, max: data.range?.max ?? 10 };
  if (parent.type === 'show_jump') return simplerJump(parent, range);
  if (parent.type === 'plot_point') return simplerPlot(parent, view);
  if (parent.type === 'order_values') return fewerNumbers(parent, view, range);
  return parent.type === 'find_between' ? widerGap(parent, view, range) : null;
}

/** The session item a practice id stands in for. */
export const practiceParent = (id: string | null | undefined, challenges: readonly NumberLineChallenge[]) =>
  id?.endsWith(PRACTICE_SUFFIX) ? challenges.find(c => `${c.id}${PRACTICE_SUFFIX}` === id) ?? null : null;

/**
 * `last_try` (help, 2026-10-09): on a plot or identify item whose target has no labelled number at least two below it
 * (the target is the line's first label, e.g. 0), counting hops from a label would start on the answer, so no count
 * lever exists. The ring marks the learner's own last wrong point instead, kept after Try again, so the tutor can
 * point at it. Leak rule: the ring is only ever on the learner's checked wrong point, never on the target.
 */
export const LAST_TRY_LEVER = 'last_try';

export function lastTry(ch: NumberLineChallenge | null, view: SettledLine, tried: number | null): number | null {
  const target = countTarget(ch);
  if (ch?.type !== 'plot_point' || target === null || tried === null || countStart(target, view.labels) !== null) return null;
  return lastTryLeak(ch, tried) ? null : tried;
}

export const lastTryLeak = (ch: NumberLineChallenge, ring: number) => ch.targetValues.some(t => Math.abs(t - ring) < 1e-6);

/** Easy starts with the item's help lever shown (the line's self-check); a starting position is not a pull. */
export function helpStartsShown(tier: string | undefined, ch: NumberLineChallenge | null): string[] {
  if (tier !== 'easy' || !ch || ch.type === 'show_jump') return [];
  if (ch.type === 'order_values') return [ARROW_LEVER];
  return ch.type === 'plot_point' ? [COUNT_LEVER] : ch.type !== 'find_between' ? [] : endMarks(ch) ? [ENDS_LEVER] : [COUNT_LEVER];
}

// ============================================================================
// The lever set (boss framework, 2026-10-20): every lever of every mode, declared once by type.
// ============================================================================

/** build_hops help for a repeated way: a worked pair of ways on a small example that is never the item's. */
export const WAYS_LEVER = 'ways_model';

/** Each item's eval mode, from its type. identify and plot are both `plot_point` and share every lever. */
const MODE_OF: Record<NumberLineChallenge['type'], NumberLineMode> = {
  plot_point: 'plot', show_jump: 'jump', order_values: 'order', find_between: 'between', build_hops: 'build_hops',
};

/** What a lever reads beyond the item: the line, and the learner's work on it now. */
export interface NumberLineLeverContext {
  range: { min: number; max: number };
  /** The line this item settles on (`settledView`); null on a fraction or decimal line, which has no point levers. */
  settled: SettledLine | null;
  /** Levers on screen on the session item (pulled, or shown from the start on easy). */
  pulled: readonly string[];
  /** Placed points, jump landings, the last checked wrong point (plot), and build hops. */
  points: readonly number[];
  endpoints: readonly number[];
  tried: number | null;
  hops: readonly number[];
}

/** A jump's operations when every start and change is whole; null otherwise (no jump lever then). */
const jumpOps = (c: NumberLineChallenge) => {
  const ops = c.type === 'show_jump' ? c.operations ?? [] : [];
  return ops.length && integral(...ops.flatMap(o => [o.startValue, o.changeValue])) ? ops : null;
};
const multiJump = (c: NumberLineChallenge) => (c.operations?.length ?? 0) > 1;
/** The labelled number counting starts from, on an integer line. */
const countFrom = (c: NumberLineChallenge, ctx: NumberLineLeverContext) => {
  const target = countTarget(c);
  return target === null || !ctx.settled ? null : countStart(target, ctx.settled.labels);
};
const COUNT_ANSWERS: Record<string, readonly string[]> = {
  plot_point: ['one_short', 'one_past', 'off_by_more'], find_between: ['on_end', 'outside'],
};
const BACK = 'It is not graded; the full item comes back after it.';

export const NUMBER_LINE_LEVERS = leverSet<NumberLineChallenge, NumberLineLeverContext>({
  modeOf: c => MODE_OF[c.type],
  missesOf: mode => NUMBER_LINE_MISSES_BY_MODE[mode as NumberLineMode] ?? [],
  // Only build_hops has a model (`ways_model`); the generator stamps each item's tier.
  support: {
    tier: c => c.supportTier ?? 'medium',
    different: 'two ways to land on a small other number',
    own: 'a hop size to use or where the hops land',
  },
  specs: [
    // jump
    { id: WAY_LEVER, type: 'marks', carrier: 'both', modes: ['jump'], answers: ['wrong_direction', 'no_landing'],
      when: 'On a jump of 1: the learner stays on the start, jumps the wrong way, or does not know which way to go.',
      does: c => `Draws a short arrow at the start pointing ${wayArrow(c.operations?.[0])?.dir}, the way this jump goes. `
        + 'It is shorter than one hop and reaches no other number.',
      content: c => {
        const op = jumpOps(c)?.[0], way = wayArrow(op);
        return op && way && !wayArrowLeak(op, way) ? way : null;
      },
      fact: (way: WayArrow) => `A short arrow at ${way.from} points ${way.dir}, the way this jump goes; it is shorter than one hop.` },
    { id: HOPS_LEVER, type: 'marks', carrier: 'both', modes: ['jump'],
      // A learner who checks with no landing placed does not know how to begin: the model hop from the start shows it.
      answers: ['one_short', 'one_past', 'off_by_more', 'wrong_direction', 'no_landing'],
      when: 'The learner lands one hop off, counts the start as a hop, loses count, or does not know where to begin.',
      does: "Numbers every hop of the learner's own jump on the line (1, 2, 3...) and draws hop 1 from the start as a model.",
      // Offered when pulling changes the screen: a model hop that stops short of the landing (a jump of 2 or more), or
      // a jump the learner placed away from the start.
      content: (c, ctx) => {
        const ops = jumpOps(c);
        if (!ops) return null;
        if (ctx.pulled.includes(HOPS_LEVER)) return true;
        const model = modelHop(ops[0]);
        if (model) return hopsLeak(ops[0], [model]) ? null : true;
        return ctx.endpoints.some((e, i) => learnerHops(i === 0 ? ops[0].startValue : ctx.endpoints[i - 1], e).length > 0) || null;
      },
      fact: "Numbered hops: each hop of the learner's jump is drawn and numbered from the start; before they place it, "
        + 'the first hop from the start is drawn as a model.' },
    { id: SIMPLER_LEVER, type: 'easier', carrier: 'shown', modes: ['jump'],
      // Losing track across two jumps is what one jump instead of two answers; help (hops) comes first otherwise.
      answers: ['second_jump_off', 'off_by_more'],
      answersOn: c => (multiJump(c) ? ['second_jump_off', 'off_by_more'] : ['off_by_more']),
      when: c => (multiJump(c) ? 'The learner cannot keep track across two jumps.' : 'The learner cannot manage a jump this long yet.'),
      does: c => `Opens an easier practice jump first, ${multiJump(c) ? 'one jump instead of two' : 'a shorter jump'} from a `
        + `different start. ${BACK}`,
      content: (c, ctx) => (jumpOps(c) ? simplerJump(c, ctx.range) : null) },
    // identify, plot, between (an exact missing number)
    { id: COUNT_LEVER, type: 'marks', carrier: 'both', modes: ['identify', 'plot', 'between'],
      answers: ['one_short', 'one_past', 'off_by_more', 'on_end', 'outside'], answersOn: c => COUNT_ANSWERS[c.type] ?? [],
      when: 'The learner places the point one or more spaces off, or does not know where to start counting.',
      does: (c, ctx) => {
        const start = countFrom(c, ctx);
        return `Draws hops counted from the labelled number ${start}: every hop from ${start} to the learner's point, numbered `
          + `1, 2, 3..., and before they place it, hop 1 from ${start} as a model. No hop the learner did not make is drawn past hop 1.`;
      },
      // Offered when pulling changes the screen: a model hop that stops short of the target, or the learner's point
      // away from the count start. A model hop that reached the target is never offered.
      content: (c, ctx) => {
        const target = countTarget(c), start = countFrom(c, ctx);
        if (target === null || start === null) return null;
        const model = countModelHop(start, target);
        if (model && countHopsLeak(start, target, [model])) return null;
        const last = ctx.points[ctx.points.length - 1];
        return ctx.pulled.includes(COUNT_LEVER) || model || (last !== undefined && learnerHops(start, last).length > 0) ? start : null;
      },
      fact: (start: number) => `Numbered hops counted from ${start}: each hop from ${start} to the learner's point is drawn `
        + `and numbered; before they place it, hop 1 from ${start} is drawn as a model.` },
    { id: LAST_TRY_LEVER, type: 'marks', carrier: 'both', modes: ['identify', 'plot'], answers: ['one_short', 'one_past', 'off_by_more'],
      when: 'The learner placed the point on the wrong number, and the line has no labelled number to count from below it.',
      does: (c, ctx) => `Draws a dashed ring on ${ctx.settled ? lastTry(c, ctx.settled, ctx.tried) : ''}, where the learner's last `
        + 'checked point was. It stays after Try again and marks no other number.',
      content: (c, ctx) => (ctx.settled ? lastTry(c, ctx.settled, ctx.tried) : null),
      fact: (ring: number) => `A dashed ring marks ${ring}, where the learner's last checked point was.` },
    // order
    { id: ARROW_LEVER, type: 'legend', carrier: 'both', modes: ['order'], answers: ['reversed', 'out_of_order'],
      when: 'The learner puts the numbers in reverse or in another wrong order.',
      does: 'Draws an arrow under the line pointing right, with "smaller" written at its left end and "bigger" at its right end. '
        + 'It marks no number.',
      content: (_c, ctx) => (ctx.settled ? true : null),
      fact: 'An arrow under the line points right: "smaller" is written at its left end, "bigger" at its right end.' },
    // between (two given numbers, any point inside)
    { id: ENDS_LEVER, type: 'marks', modes: ['between'], answers: ['on_end', 'outside'],
      when: 'The learner places the point on one of the two numbers, or outside them.',
      does: 'Marks the two given numbers as rings on the line, each with its number above it. Nothing is drawn between them.',
      content: (c, ctx) => (ctx.settled ? endMarks(c) : null),
      fact: ([lo, hi]: [number, number]) => `Rings mark ${lo} and ${hi} on the line, each with its number above it.` },
    // simplify: identify and plot, order, between
    { id: NEARER_LEVER, type: 'easier', carrier: 'shown', modes: ['identify', 'plot'], answers: ['off_by_more'],
      when: 'The learner cannot count that far from a labelled number yet.',
      does: `Opens an easier practice point first, nearer a labelled number. ${BACK}`,
      content: (c, ctx) => (ctx.settled ? simplerPlot(c, ctx.settled) : null) },
    { id: FEWER_LEVER, type: 'easier', carrier: 'shown', modes: ['order'], answers: ['out_of_order', 'reversed'],
      when: 'The learner cannot order this many numbers yet.',
      does: c => `Opens an easier practice set first: ${c.targetValues.length - 1} numbers instead of ${c.targetValues.length}, `
        + `spread apart, none from this item. ${BACK}`,
      content: (c, ctx) => (ctx.settled ? fewerNumbers(c, ctx.settled, ctx.range) : null) },
    { id: WIDER_LEVER, type: 'easier', carrier: 'shown', modes: ['between'], answers: ['outside', 'on_end'],
      when: 'The learner cannot find a number between two close numbers yet.',
      does: `Opens an easier practice pair first: two numbers farther apart. ${BACK}`,
      content: (c, ctx) => (ctx.settled ? widerGap(c, ctx.settled, ctx.range) : null) },
    // build_hops: bare at the start (keeping track of the hops is the task)
    { id: HOPS_LEVER, type: 'marks', carrier: 'both', modes: ['build_hops'], answers: ['one_short', 'one_past', 'off_by_more'],
      when: "The learner's hops land one off or further from the number, or they lose count of how far a hop goes.",
      does: 'Numbers the spaces inside each hop the learner puts on the line (1, 2, 3...), so they can count how far each of their hops goes.',
      // Declared once a hop is on.
      content: (c, ctx) => (hopsTaskOf(c) && (ctx.hops.length || ctx.pulled.includes(HOPS_LEVER)) ? true : null),
      fact: "Numbered hops: the spaces inside each of the learner's hops are numbered 1, 2, 3..." },
    { id: WAYS_LEVER, type: 'model', modes: ['build_hops'], answers: ['same_way_again'],
      when: 'The learner makes the same hops again and cannot find a different way, or does not know how to start.',
      does: 'Beside the line, shows two different ways to land on a small other number (a longer first hop and a shorter '
        + "second hop). Never the learner's number.",
      content: c => { const task = hopsTaskOf(c); return task ? waysModel(task) : null; },
      fact: (m: ReturnType<typeof waysModel>) => `Beside the line, a worked example: two ways to land on ${m.target} from 0, `
        + `${m.ways.map(w => w.join(' then ')).join(', or ')}.` },
    { id: SIMPLER_LEVER, type: 'easier', carrier: 'shown', modes: ['build_hops'], answers: ['off_by_more'],
      when: "The learner's hops land far from the number, again and again.",
      does: `Opens an easier practice build first: the same number of hops to a smaller number. ${BACK}`,
      content: (c, ctx) => simplerHops(c, ctx.range) },
  ],
});
