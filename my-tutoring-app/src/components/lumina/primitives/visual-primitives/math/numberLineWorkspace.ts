/**
 * Number line on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch A2).
 *
 * Pure: the component and any probe read the same assignment and scene. Every challenge is
 * answered on the line and checked by the primitive's own Check, so the tutor is never
 * handed the target values.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { NumberLineChallenge, NumberLineOperation } from './NumberLine';
import { describeHops, hopsTaskOf, landingOf } from './numberLineBuildHops';

export function workspaceAssignment(challenge: NumberLineChallenge): TeachingAssignment {
  return { id: challenge.id, task: challenge.instruction, response: 'gesture' };
}

export interface NumberLineView {
  rangeMin: number; rangeMax: number; numberType: string;
  operations: readonly NumberLineOperation[];
  points: readonly number[]; endpoints: readonly number[]; ordered: ReadonlyMap<number, number>;
  /** The numbered-hops lever is on: the learner's jumps are drawn as numbered hops. */
  hops?: boolean;
  /** An easier practice jump stands in for the item (a simplify lever). */
  practice?: boolean;
  /** build_hops: the ways lever's worked example is beside the line. */
  waysModel?: boolean;
  /** Plot, order or between: what the pulled help levers drew (`leverFact`), and where the count hops start. */
  onScreen?: string;
  countFrom?: number;
}

const listed = (values: readonly number[]) => values.length ? values.join(', ') : 'none yet';

/** build_hops (open build): the hops on the line now, and the first way once it was checked right. */
export interface HopsBuildView { hops: readonly number[]; first: readonly number[] | null }

/**
 * The open build's scene. The made quantity is published as numbers (`landedAt`, `hopsMade`), so `workHistory`
 * records a fix such as `landedAt 0 → 13 → 12`. The target is the task itself (the ask states it).
 */
export function buildHopsScene(challenge: NumberLineChallenge, view: NumberLineView, build: HopsBuildView): WorkspaceScene {
  const task = hopsTaskOf(challenge);
  const start = task?.start ?? view.rangeMin;
  return {
    objects: [],
    facts: {
      kind: challenge.type, line: `${view.rangeMin} to ${view.rangeMax}`, numbers: view.numberType,
      startsAt: start, hopsAsked: task?.hopCount ?? 2, way: build.first ? 'second' : 'first',
      hopsMade: build.hops.length, landedAt: landingOf(start, build.hops),
      learnerWork: task ? describeHops(task, build.hops, null) : listed(build.hops),
      ...(build.first ? { firstWay: `hops of ${build.first.join(', ')}, checked right` } : {}),
      ...(view.hops ? { onScreen: "Numbered hops: the spaces inside each of the learner's hops are numbered 1, 2, 3..." } : {}),
      ...(view.waysModel ? { onScreenModel: 'Beside the line: two different ways to land on a small other number.' } : {}),
      ...(view.practice ? { practice: 'An easier practice build is on screen in place of the item. It is not graded; the full item comes back after it.' } : {}),
      constraints: (build.first
        ? 'The first way was checked right and is listed under the line. The learner makes the same number a different way. '
        : 'The learner picks hop sizes on the hop buttons; each hop starts where the last one landed. ')
        + "They tap a landing to take that hop off and press I'm done; the line checks the landing, the hop count and that "
        + 'the second way differs. You cannot make, move or take off hops.',
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

export function workspaceScene(challenge: NumberLineChallenge, view: NumberLineView): WorkspaceScene {
  const jump = challenge.type === 'show_jump' && view.operations[0];
  return {
    objects: [],
    facts: {
      kind: challenge.type, line: `${view.rangeMin} to ${view.rangeMax}`, numbers: view.numberType,
      ...(jump ? { startsAt: jump.startValue } : {}),
      learnerWork: describeLine(challenge, view),
      // What a pulled lever put on screen, in terms of what is drawn; never where the jump lands.
      ...(view.hops ? { onScreen: "Numbered hops: each hop of the learner's jump is drawn and numbered from the start; "
        + 'before they place it, the first hop from the start is drawn as a model.' + (view.onScreen ? ` ${view.onScreen}` : '') }
        : view.onScreen ? { onScreen: view.onScreen } : {}),
      ...(view.practice ? { practice: `An easier practice ${jump ? 'jump' : 'item'} is on screen in place of the item. `
        + 'It is not graded; the full item comes back after it.' } : {}),
      constraints: 'The learner places points on the line and presses Check; the line checks the work itself. '
        + 'You cannot place, move or clear points.',
    },
  };
}
