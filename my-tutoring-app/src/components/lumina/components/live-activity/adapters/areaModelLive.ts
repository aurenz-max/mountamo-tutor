import type { AreaModelData } from '../../../primitives/visual-primitives/math/AreaModel';
import { workspaceTask } from '../../../primitives/visual-primitives/math/areaModelWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const MODES = ['build_model', 'find_area', 'perimeter', 'multiply', 'factor'];
const partsOk = (parts: unknown) => Array.isArray(parts) && parts.length > 0 && parts.length <= 4
  && parts.every(p => Number.isInteger(p) && (p as number) > 0);

/** Reject an area-model lesson whose challenges cannot be attempted. */
export function validateAreaModelData(value: unknown): AreaModelData {
  const d = value as AreaModelData;
  if (!d || typeof d.title !== 'string' || !MODES.includes(d.challengeType) || !Array.isArray(d.challenges)
      || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !partsOk(c.factor1Parts) || !partsOk(c.factor2Parts)))
    throw new Error('Generated area model has invalid lesson content.');
  return d;
}

/** What the live adapter needs from the area model; the catalog's `teachingWorkspace` declares the rest. */
export const areaModelLiveDomain: WorkspaceDomain<AreaModelData> = {
  validate: validateAreaModelData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceTask(d.challenges[0], d.challengeType), total: d.challenges.length }),
};
