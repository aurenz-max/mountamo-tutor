import type { RatioTableData } from '../../../primitives/visual-primitives/math/RatioTable';
import { SLIDER_MIN, SLIDER_STEP, matchesKey, workspaceAssignment } from '../../../primitives/visual-primitives/math/ratioTableWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const TYPES = ['missing-value', 'find-multiplier', 'build-ratio', 'unit-rate'];
const positive = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** Reject a ratio-table lesson whose challenges cannot be attempted. */
export function validateRatioTableData(value: unknown): RatioTableData {
  const d = value as RatioTableData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim()))
    throw new Error('Generated ratio table has invalid lesson content.');
  // Each item needs what its own check reads: two positive base numbers, a positive multiplier, two labels, and on a
  // build item a multiplier the slider can reach within the check's band.
  const max = d.maxMultiplier ?? 10;
  for (const c of d.challenges) {
    const ok = Array.isArray(c.baseRatio) && c.baseRatio.length === 2 && c.baseRatio.every(positive)
      && positive(c.targetMultiplier) && Array.isArray(c.rowLabels) && c.rowLabels.length === 2
      && (c.type !== 'build-ratio' || (() => {
        const nearest = Math.min(max, Math.max(SLIDER_MIN, Math.round(c.targetMultiplier / SLIDER_STEP) * SLIDER_STEP));
        return matchesKey(c, nearest);
      })());
    if (!ok) throw new Error(`A ratio-table ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** What the live adapter needs from the ratio table; the catalog's `teachingWorkspace` declares the rest. */
export const ratioTableLiveDomain: WorkspaceDomain<RatioTableData> = {
  validate: validateRatioTableData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d.challenges[0]).task, total: d.challenges.length }),
};
