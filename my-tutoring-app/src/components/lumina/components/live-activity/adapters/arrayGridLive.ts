import type { ArrayGridData } from '../../../primitives/visual-primitives/math/ArrayGrid';
import { arraysOf, workspaceAssignment } from '../../../primitives/visual-primitives/math/arrayGridWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const CHALLENGE_TYPES = ['build_array', 'count_array', 'multiply_array', 'make_array'];
const dim = (n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 12;

/** Reject an array lesson whose challenges cannot be attempted. */
export function validateArrayGridData(value: unknown): ArrayGridData {
  const d = value as ArrayGridData;
  if (!d || typeof d.title !== 'string' || !CHALLENGE_TYPES.includes(d.challengeType) || !Array.isArray(d.challenges)
      || !d.challenges.length || d.challenges.length > 12 || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id))
    throw new Error('Generated array grid has invalid lesson content.');
  // make_array needs a number the empty grid can hold as more than one array; the others need real dimensions.
  for (const c of d.challenges) {
    const ok = d.challengeType === 'make_array'
      ? Number.isInteger(c.total) && arraysOf(c.total!).length > 1
      : dim(c.targetRows) && dim(c.targetColumns);
    if (!ok) throw new Error(`An array-grid ${d.challengeType} challenge cannot be answered as generated.`);
  }
  return d;
}

const firstTask = (d: ArrayGridData) =>
  workspaceAssignment(d.challenges[0], d.challengeType, d.challengeType === 'make_array' ? 'square' : d.iconType ?? 'star').task;

/** What the live adapter needs from the array grid; the catalog's `teachingWorkspace` declares the rest. */
export const arrayGridLiveDomain: WorkspaceDomain<ArrayGridData> = {
  validate: validateArrayGridData,
  initialState: d => workspaceOpening({ title: d.title, task: firstTask(d), total: d.challenges.length }),
};
