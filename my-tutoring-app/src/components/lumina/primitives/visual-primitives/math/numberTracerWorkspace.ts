/**
 * Number tracer on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch A2).
 *
 * Pure: the component and any probe read the same assignment and scene. The canvas checks the
 * writing itself (geometry, then the vision judge), so no key is published; on a sequence item
 * the missing number is the answer and never appears in the scene.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { NumberTracerChallenge } from './NumberTracer';

export function workspaceAssignment(challenge: NumberTracerChallenge): TeachingAssignment {
  return { id: challenge.id, task: challenge.instruction, response: 'gesture' };
}

/** The checked writing in the learner's terms. `writtenAs` is the judge's reading, when it had one. */
export const describeWriting = (score: number, writtenAs: string | null) =>
  `${writtenAs ? `Wrote something read as ${writtenAs}` : 'Wrote on the canvas'}; the canvas scored it ${score}%`;

export function workspaceScene(challenge: NumberTracerChallenge, view: { strokes: number }): WorkspaceScene {
  const sequence = challenge.type === 'sequence';
  const shown = sequence && challenge.sequenceNumbers
    ? challenge.sequenceNumbers.map((n, i) => (i === challenge.missingIndex ? '_' : String(n))).join(', ') : null;
  return {
    objects: [],
    facts: {
      kind: challenge.type,
      ...(shown ? { printedSequence: shown } : { numeral: challenge.digit }),
      strokesDrawn: view.strokes,
      constraints: 'The learner writes on the canvas with a finger and presses Check; the canvas checks the writing '
        + 'itself. You cannot draw, trace or clear.',
    },
  };
}
