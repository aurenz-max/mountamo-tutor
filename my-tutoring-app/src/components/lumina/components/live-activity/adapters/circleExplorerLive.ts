import type { CircleExplorerData } from '../../../primitives/visual-primitives/math/CircleExplorer';
import { workspaceAssignment } from '../../../primitives/visual-primitives/math/circleExplorerWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const TYPES = ['discover_pi', 'circumference', 'area', 'reverse', 'composite'];
const positive = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** Reject a circle-explorer lesson whose challenges cannot be attempted. */
export function validateCircleExplorerData(value: unknown): CircleExplorerData {
  const d = value as CircleExplorerData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim()))
    throw new Error('Generated circle explorer has invalid lesson content.');
  // Each item needs what its own check and its figure read: a positive radius, key and tolerance; a reverse item its
  // given value; a composite item its shape (and a circle-in-square its side).
  for (const c of d.challenges) {
    const ok = positive(c.radius) && positive(c.expectedAnswer) && positive(c.tolerance)
      && (c.type !== 'reverse' || positive(c.givenValue))
      && (c.type !== 'composite' || (!!c.compositeShape && (c.compositeShape !== 'circle_in_square' || positive(c.squareSide))));
    if (!ok) throw new Error(`A circle-explorer ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** What the live adapter needs from the circle explorer; the catalog's `teachingWorkspace` declares the rest. */
export const circleExplorerLiveDomain: WorkspaceDomain<CircleExplorerData> = {
  validate: validateCircleExplorerData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d.challenges[0]).task, total: d.challenges.length }),
};
