/**
 * Number line on the shared tutor/JEV teaching workspace: what the tutor and the observer are shown of the line, and
 * how the journey harness plays it. The boss is `numberLine.boss.ts`; the levers are `NUMBER_LINE_LEVERS`.
 *
 * Pure: the component and any probe read the same scene. Every challenge is answered on the line and checked by the
 * primitive's own Check (a build: "I'm done!"), so the tutor is never handed the target values.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import type { NumberLineChallenge, NumberLineOperation } from './NumberLine';
import { describeHops, hopsHarnessBuilds, hopsTaskOf, landingOf } from './numberLineBuildHops';

export interface NumberLineView {
  rangeMin: number; rangeMax: number; numberType: string;
  operations: readonly NumberLineOperation[];
  points: readonly number[]; endpoints: readonly number[]; ordered: ReadonlyMap<number, number>;
  /** The numbered-hops lever is on: the learner's jumps are drawn as numbered hops. */
  hops?: boolean;
  /** An easier practice item stands in for the item (a simplify lever). */
  practice?: boolean;
  /** Plot or between with the count-hops lever on: where the count hops start. */
  countFrom?: number;
  /** The part of the line on screen, when it is zoomed in on part of the whole line. */
  window?: { min: number; max: number };
}

const listed = (values: readonly number[]) => values.length ? values.join(', ') : 'none yet';
const round = (v: number) => Math.round(v * 100) / 100;

/** The line, and the zoomed window when it shows only part of it: counting starts from a label on screen. */
function lineFacts(view: NumberLineView) {
  const zoomed = view.window && (view.window.min > view.rangeMin || view.window.max < view.rangeMax);
  return {
    line: `${view.rangeMin} to ${view.rangeMax}`, numbers: view.numberType,
    ...(zoomed ? { window: `The line on screen shows ${round(view.window!.min)} to ${round(view.window!.max)} of the whole `
      + 'line; count from a label on screen, not from the start of the whole line.' } : {}),
  };
}

/** build_hops (open build): the hops on the line now, and the first way once it was checked right. */
export interface HopsBuildView { hops: readonly number[]; first: readonly number[] | null }

/**
 * The open build's scene. The made quantity is published as numbers (`landedAt`, `hopsMade`), so `workHistory`
 * records a fix such as `landedAt 0 → 13 → 12`. The target is the task itself (the ask states it).
 */
export function buildHopsScene(challenge: NumberLineChallenge, view: NumberLineView, build: HopsBuildView): SceneOf {
  const task = hopsTaskOf(challenge);
  const start = task?.start ?? view.rangeMin;
  return {
    objects: [],
    facts: {
      kind: challenge.type, ...lineFacts(view),
      startsAt: start, hopsAsked: task?.hopCount ?? 2, way: build.first ? 'second' : 'first',
      hopsMade: build.hops.length, landedAt: landingOf(start, build.hops),
      learnerWork: task ? describeHops(task, build.hops, null) : listed(build.hops),
      ...(build.first ? { firstWay: `hops of ${build.first.join(', ')}, checked right` } : {}),
      ...(view.practice ? { practice: 'An easier practice build is on screen in place of the item. It is not graded; the full item comes back after it.' } : {}),
    },
  };
}

/** The learner's work on the line, in their terms. */
export function describeLine(challenge: NumberLineChallenge, view: NumberLineView): string {
  if (challenge.type === 'show_jump') return `Landed the jumps at ${listed(view.endpoints)}` + (view.hops && view.endpoints.length
    ? ` (hops drawn: ${view.endpoints.map((e, i) => Math.abs(e - (i === 0 ? view.operations[0]?.startValue ?? e : view.endpoints[i - 1]))).join(', ')})` : '');
  if (challenge.type === 'order_values') return `Placed in order, left to right: ${listed(
    Array.from(view.ordered.entries()).sort((a, b) => a[1] - b[1]).map(e => e[0]))}`;
  const last = view.points[view.points.length - 1];
  return `Placed a point at ${listed(view.points)}` + (view.countFrom !== undefined && last !== undefined && last !== view.countFrom
    ? ` (hops drawn from ${view.countFrom}: ${Math.abs(last - view.countFrom)})` : '');
}

/** A placed-point, jump or order item's scene. What a pulled lever drew is the lever set's (`onScreen`). */
export function workspaceScene(challenge: NumberLineChallenge, view: NumberLineView): SceneOf {
  const jump = challenge.type === 'show_jump' && view.operations[0];
  return {
    objects: [],
    facts: {
      kind: challenge.type, ...lineFacts(view),
      ...(jump ? { startsAt: jump.startValue } : {}),
      learnerWork: describeLine(challenge, view),
      ...(view.practice ? { practice: `An easier practice ${jump ? 'jump' : 'item'} is on screen in place of the item. `
        + 'It is not graded; the full item comes back after it.' } : {}),
    },
  };
}

/**
 * The journey harness's moves on one item, as real learner input (the driver's vocabulary):
 * - build_hops: hop buttons, then I'm done. Right: Start over (Try again keeps the build), a first way, I'm done (kept,
 *   no commit), a different second way, I'm done. Wrong: a first way one short (`one_short`).
 * - order: tap each value, then its own spot on the line (smallest at the left). Wrong: each at its mirror's spot
 *   (`reversed`).
 * - between: one point inside (the exact missing number when the item has one). Wrong: on the lower given number
 *   (`on_end`).
 * - plot, identify, jump: one landing per target, in order. On two chained jumps the wrong answer lands the first right
 *   and the second one past (`second_jump_off`, the miss the easier single jump answers); otherwise one past.
 */
export function numberLineHarnessInputs(c: NumberLineChallenge, right: boolean): DriverInput[] {
  const task = hopsTaskOf(c);
  if (task) {
    const builds = hopsHarnessBuilds(task);
    const hops = (sizes: number[]) => sizes.map((n): DriverInput => ({ type: 'choose', label: `Hop ${n}` }));
    const done: DriverInput = { type: 'choose', label: "I'm done!" };
    if (!right) return [...hops(builds.wrong), done];
    return [{ type: 'choose', label: 'Start over' }, ...hops(builds.first), done, ...hops(builds.second), done];
  }
  if (c.type === 'order_values') {
    const values = c.targetValues, sorted = [...values].sort((a, b) => a - b);
    const spot = (v: number) => (right ? v : sorted[sorted.length - 1 - sorted.indexOf(v)]);
    return [...values.flatMap((v): DriverInput[] => [{ type: 'choose', label: String(v) }, { type: 'place', value: spot(v) }]),
      { type: 'check' }];
  }
  if (c.type === 'find_between') {
    const lo = Math.min(...c.targetValues), hi = Math.max(...c.targetValues);
    const inside = typeof c.exactTargetValue === 'number' ? c.exactTargetValue : lo + 1 < hi ? lo + 1 : (lo + hi) / 2;
    return [{ type: 'place', value: right ? inside : lo }, { type: 'check' }];
  }
  const landings = c.targetValues.filter((v): v is number => typeof v === 'number');
  const placed = right ? landings : landings.map((v, i) => (i === landings.length - 1 ? v + 1 : v));
  return [...placed.map((value): DriverInput => ({ type: 'place', value })), { type: 'check' }];
}
