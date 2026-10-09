import type { DoubleNumberLineData } from '../../../primitives/visual-primitives/math/DoubleNumberLine';
import { workspaceAssignment } from '../../../primitives/visual-primitives/math/doubleNumberLineWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const TYPES = ['equivalent_ratios', 'find_missing', 'unit_rate'];
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Reject a double-number-line lesson whose challenges cannot be attempted. */
export function validateDoubleNumberLineData(value: unknown): DoubleNumberLineData {
  const d = value as DoubleNumberLineData;
  if (!d || typeof d.title !== 'string' || typeof d.topLabel !== 'string' || typeof d.bottomLabel !== 'string'
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.challengeType) || typeof c.prompt !== 'string'))
    throw new Error('Generated double number line has invalid lesson content.');
  // Each target needs what the check reads (a bottom value) and a place on both drawn lines.
  for (const c of d.challenges) {
    const ok = Array.isArray(c.targetPoints) && c.targetPoints.length > 0 && Array.isArray(c.givenPoints)
      && c.topScale?.max > c.topScale?.min && c.bottomScale?.max > c.bottomScale?.min
      && c.targetPoints.every(t => finite(t.topValue) && finite(t.bottomValue)
        && t.topValue >= c.topScale.min && t.topValue <= c.topScale.max
        && t.bottomValue >= c.bottomScale.min && t.bottomValue <= c.bottomScale.max);
    if (!ok) throw new Error(`A double-number-line ${c.challengeType} challenge cannot be answered as generated.`);
  }
  return d;
}

/** What the live adapter needs from the double number line; the catalog's `teachingWorkspace` declares the rest. */
export const doubleNumberLineLiveDomain: WorkspaceDomain<DoubleNumberLineData> = {
  validate: validateDoubleNumberLineData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d.challenges[0]).task, total: d.challenges.length }),
};
