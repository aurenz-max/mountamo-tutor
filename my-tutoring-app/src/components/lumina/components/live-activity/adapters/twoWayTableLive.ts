import type { TwoWayTableData } from '../../../primitives/visual-primitives/math/TwoWayTable';
import { locateTarget, probabilityOf, workspaceAssignment } from '../../../primitives/visual-primitives/math/twoWayTableWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const TYPES = ['joint_probability', 'marginal_distribution', 'conditional_probability', 'independence_test'];
const count = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/** Reject a two-way-table lesson whose challenges cannot be attempted. */
export function validateTwoWayTableData(value: unknown): TwoWayTableData {
  const d = value as TwoWayTableData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.challengeType)
        || typeof c.question !== 'string' || !c.question.trim()))
    throw new Error('Generated two-way table has invalid lesson content.');
  // Each item needs what its own check and its levers read: a full table of counts with its category names, a
  // probability between 0 and 1, and a cell, row or column of the table whose probability that is.
  for (const c of d.challenges) {
    const R = c.rowCategories?.length ?? 0, C = c.columnCategories?.length ?? 0;
    const table = Array.isArray(c.frequencies) && R >= 2 && C >= 2 && c.frequencies.length === R
      && c.frequencies.every(row => Array.isArray(row) && row.length === C && row.every(count));
    const p = c.expectedProbability;
    const target = table ? locateTarget(c) : null;
    const ok = table && typeof p === 'number' && p > 0 && p <= 1 && !!target
      && Math.abs((probabilityOf(c.challengeType, c.frequencies, target) ?? -1) - p) < 1e-3;
    if (!ok) throw new Error(`A two-way-table ${c.challengeType} challenge cannot be answered as generated.`);
  }
  return d;
}

/** What the live adapter needs from the two-way table; the catalog's `teachingWorkspace` declares the rest. */
export const twoWayTableLiveDomain: WorkspaceDomain<TwoWayTableData> = {
  validate: validateTwoWayTableData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d.challenges[0]).task, total: d.challenges.length }),
};
