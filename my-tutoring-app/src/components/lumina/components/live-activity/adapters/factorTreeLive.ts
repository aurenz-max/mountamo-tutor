import type { FactorTreeData } from '../../../primitives/visual-primitives/math/FactorTree';
import { isPrime, workspaceAssignment } from '../../../primitives/visual-primitives/math/factorTreeWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a factor-tree lesson whose challenges cannot be attempted: every root must be a composite to split. */
export function validateFactorTreeData(value: unknown): FactorTreeData {
  const d = value as FactorTreeData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id))
    throw new Error('Generated factor tree has invalid lesson content.');
  for (const c of d.challenges) {
    if (!Number.isInteger(c.rootValue) || c.rootValue < 4 || isPrime(c.rootValue))
      throw new Error(`A factor-tree challenge's number ${c.rootValue} is not a composite to split.`);
  }
  return d;
}

/** What the live adapter needs from the factor tree; the catalog's `teachingWorkspace` declares the rest. */
export const factorTreeLiveDomain: WorkspaceDomain<FactorTreeData> = {
  validate: validateFactorTreeData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d.challenges[0]).task, total: d.challenges.length }),
};
