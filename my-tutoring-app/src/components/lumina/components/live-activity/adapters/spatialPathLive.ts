import type { SpatialPathData } from '../../../primitives/visual-primitives/math/SpatialPath';
import { validateSpatialPathChallenge } from '../../../primitives/visual-primitives/math/spatialPathRoutes';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a route lesson whose challenges cannot be attempted: each needs three or more routes and a checkable key. */
export function validateSpatialPathData(value: unknown): SpatialPathData {
  const d = value as SpatialPathData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || c.type !== 'choose_route'
        || typeof c.instruction !== 'string' || !c.instruction.trim() || !Array.isArray(c.routes)
        || validateSpatialPathChallenge(c).length > 0))
    throw new Error('Generated spatial path has invalid lesson content.');
  return d;
}

/** What the live adapter needs from spatial-path; the catalog's `teachingWorkspace` declares the rest. */
export const spatialPathLiveDomain: WorkspaceDomain<SpatialPathData> = {
  validate: validateSpatialPathData,
  initialState: d => workspaceOpening({ title: d.title, task: d.challenges[0].instruction, total: d.challenges.length }),
};
