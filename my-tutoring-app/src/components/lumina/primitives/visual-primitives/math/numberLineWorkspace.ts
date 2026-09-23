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

export function workspaceAssignment(challenge: NumberLineChallenge): TeachingAssignment {
  return { id: challenge.id, task: challenge.instruction, response: 'gesture' };
}

export interface NumberLineView {
  rangeMin: number; rangeMax: number; numberType: string;
  operations: readonly NumberLineOperation[];
  points: readonly number[]; endpoints: readonly number[]; ordered: ReadonlyMap<number, number>;
}

const listed = (values: readonly number[]) => values.length ? values.join(', ') : 'none yet';

/** The learner's work on the line, in their terms. */
export function describeLine(challenge: NumberLineChallenge, view: NumberLineView): string {
  if (challenge.type === 'show_jump') return `Landed the jumps at ${listed(view.endpoints)}`;
  if (challenge.type === 'order_values') return `Placed in order, left to right: ${listed(
    Array.from(view.ordered.entries()).sort((a, b) => a[1] - b[1]).map(e => e[0]))}`;
  return `Placed a point at ${listed(view.points)}`;
}

export function workspaceScene(challenge: NumberLineChallenge, view: NumberLineView): WorkspaceScene {
  const jump = challenge.type === 'show_jump' && view.operations[0];
  return {
    objects: [],
    facts: {
      kind: challenge.type, line: `${view.rangeMin} to ${view.rangeMax}`, numbers: view.numberType,
      ...(jump ? { startsAt: jump.startValue } : {}),
      learnerWork: describeLine(challenge, view),
      constraints: 'The learner places points on the line and presses Check; the line checks the work itself. '
        + 'You cannot place, move or clear points.',
    },
  };
}
