import type { TransformationLabData } from '../../../primitives/visual-primitives/math/TransformationLab';
import { composeOf, inGrid, workspaceAssignment } from '../../../primitives/visual-primitives/math/transformationLabWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const TYPES = ['apply_translation_reflection', 'apply_rotation', 'identify_transformation', 'compose_sequence', 'dilation_similarity'];
const KINDS: Record<string, string> = {
  apply_translation_reflection: 'drag', apply_rotation: 'drag', dilation_similarity: 'drag',
  identify_transformation: 'identify', compose_sequence: 'sequence',
};
const points = (pts: unknown, n?: number) => Array.isArray(pts) && pts.length >= 3 && (n === undefined || pts.length === n)
  && pts.every(p => p && Number.isInteger(p.x) && Number.isInteger(p.y) && inGrid(p));

/** Reject a transformation-lab lesson whose challenges cannot be attempted. */
export function validateTransformationLabData(value: unknown): TransformationLabData {
  const d = value as TransformationLabData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.type)
        || c.answerKind !== KINDS[c.type] || typeof c.instruction !== 'string' || !c.instruction.trim()))
    throw new Error('Generated transformation lab has invalid lesson content.');
  // Each item needs what its own check reads: a pre-image and an image of the same corner count on the grid; on an
  // identify item the right option among four; on a compose item a palette move and slides that reach the target.
  for (const c of d.challenges) {
    const ok = points(c.preImage) && points(c.expectedImage, c.preImage.length)
      && (c.answerKind !== 'identify' || (Array.isArray(c.options) && c.options.length >= 2
        && Number.isInteger(c.correctOption) && !!c.options[c.correctOption ?? -1]))
      && (c.answerKind !== 'sequence' || composeOf(c) !== null);
    if (!ok) throw new Error(`A transformation-lab ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** What the live adapter needs from the transformation lab; the catalog's `teachingWorkspace` declares the rest. */
export const transformationLabLiveDomain: WorkspaceDomain<TransformationLabData> = {
  validate: validateTransformationLabData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d.challenges[0]).task, total: d.challenges.length }),
};
